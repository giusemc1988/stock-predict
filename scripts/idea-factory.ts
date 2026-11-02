/**
 * Atlas idea factory: Atlas invents its own rules, tests them in three locked stages and keeps only survivors.
 * Rules and statistics: src/lib/ideaFactory.ts. Seeds: src/data/ideaSeeds.ts.
 *
 * Data: Yahoo daily bars since 2007 (adjusted, free) for the shared stock list. Costs per name from its median
 * dollar volume (the intraday lab's model), then 2x. Each run reads the previous public/idea-factory.json:
 * its best rules join the next population (Atlas keeps learning) and its trial count is carried forward, so
 * the bar a rule must clear rises with every rule ever tried.
 *
 *   npm run ideas                                   full run, writes public/idea-factory.json
 *   npm run ideas -- --symbols 12 --gens 2 --out x.json   quick run
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Candle } from '../src/types'
import { SEEDS } from '../src/data/ideaSeeds'
import {
  DISCOVERY_END, FINALISTS, familyOf, GENERATIONS, MIN_VALIDATION_TRADES, VALIDATION_END, baselines, describeRule, features, fitOf,
  PASS_EN, PASS_VI, gradeSignal, latestSignals, quantileCuts, signalScore, type FactorySignal, ruleKey, ruleSignals, search, trialSharpeVar, vaultExam, type Cuts, type Rule, type Scored, type Universe, type VaultResult,
} from '../src/lib/ideaFactory'
import { runDaily, scaleCosts } from '../src/lib/replayDaily'
import { ALL_ROUNDS_TRIALS } from '../src/lib/replayEdges'
import { symbolCosts } from '../src/lib/replayIntraday'
import { atr } from '../src/lib/replayStrategies'
import { HIGH_VOL, STOCKS } from '../src/lib/replayUniverse'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/idea-factory.json'
const LIMIT = Number(arg('--symbols') ?? 0)
const GENS = Number(arg('--gens') ?? GENERATIONS)
/** signals only: no new search (no new trials), just today's signals from the saved rules and grading the old ones */
const SIGNALS_ONLY = args.includes('--signals-only') || process.env.IDEA_MODE === 'signals'
const FROM = Date.UTC(2007, 0, 1) / 1000
const UA = { 'User-Agent': 'Mozilla/5.0 (atlas idea factory)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ERA_CUTS = ['2011-01-01', '2014-07-01']

type Quote = { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }
type YahooJson = { chart: { result?: { timestamp?: number[]; indicators: { quote: Quote[]; adjclose?: { adjclose: (number | null)[] }[] } }[] } }

async function yahooDaily(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${FROM}&period2=${Math.floor(Date.now() / 1000)}`
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const r = ((await res.json()) as YahooJson).chart.result?.[0]
      const q = r?.indicators.quote[0]
      const adj = r?.indicators.adjclose?.[0]?.adjclose
      if (!r?.timestamp || !q) return []
      const out: Candle[] = []
      r.timestamp.forEach((t, k) => {
        const [o, h, l, c, v] = [q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k]]
        if (o == null || h == null || l == null || c == null || !(c > 0)) return
        const f = adj?.[k] != null ? adj[k]! / c : 1
        out.push({ time: t, open: (o > 0 ? o : c) * f, high: h * f, low: l * f, close: c * f, volume: v ?? 0 })
      })
      // a bar of today while the US market is still open is not a close yet: drop it
      const lastDay = out.length ? dayOf(out[out.length - 1].time) : ''
      if (lastDay === new Date().toISOString().slice(0, 10) && new Date().getUTCHours() < 21) out.pop()
      return out
    }
    await sleep(1500 * (i + 1))
  }
  throw new Error(`Yahoo failed for ${symbol}`)
}

const dayOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}
const r3 = (x: number) => Math.round(x * 1000) / 1000

interface Prev {
  run?: number
  trials?: { factoryTotal?: number }
  best?: (Omit<Rule, 'origin'> & { origin?: string })[]
  history?: { run: number; generated: string; tried: number; passed: number }[]
  signals?: FactorySignal[]
  rules?: (Omit<Rule, 'origin'> & { origin?: string; family?: string; key: string })[]
  [k: string]: unknown
}

/** Log today's signals of `rules`, grade every waiting one with the bars we have. */
function signalLog(u: Universe, used: string[], rules: Rule[], cuts: Cuts, prevLog: FactorySignal[]) {
  const fresh = latestSignals(u, rules, cuts)
  const seen = new Set(prevLog.map((x) => `${x.day}|${x.symbol}|${x.key}`))
  const log = [...prevLog, ...fresh.filter((x) => !seen.has(`${x.day}|${x.symbol}|${x.key}`))]
    .map((x) => {
      const k = used.indexOf(x.symbol)
      return k < 0 ? x : gradeSignal(x, u.series[k].bars, u.days[k], u.costs[k])
    })
    .slice(-400)
  const why = (key: string) => SEEDS.find((sd) => sd.id === rules.find((r) => ruleKey(r) === key)?.origin)?.why ?? null
  return { log, today: fresh.map((x) => ({ ...x, why: why(x.key) })) }
}

async function main() {
  const t0 = Date.now()
  const prev: Prev = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Prev) : {}
  const run = (prev.run ?? 0) + 1
  const names = LIMIT ? STOCKS.slice(0, LIMIT) : [...STOCKS]
  const bars = new Map<string, Candle[]>()
  const failed: string[] = []
  for (const s of [...new Set(['SPY', ...names])]) {
    try {
      const b = await yahooDaily(s)
      if (b.length > 600) bars.set(s, b)
      else failed.push(s)
    } catch {
      failed.push(s)
    }
    await sleep(120)
  }
  const spy = bars.get('SPY')
  if (!spy) throw new Error('no SPY bars')
  const spyBy = new Map(spy.map((b) => [dayOf(b.time), b.close]))

  const used = names.filter((s) => bars.has(s))
  const u: Universe = { series: [], mats: [], days: [], atr: [], costs: [] }
  for (const s of used) {
    const b = bars.get(s)!
    const days = b.map((c) => dayOf(c.time))
    let last = NaN
    const spyClose = days.map((d) => (last = spyBy.get(d) ?? last)) // forward-filled so averages never see a gap
    u.series.push({ symbol: s, bars: b })
    u.mats.push(features(b, spyClose))
    u.days.push(days)
    u.atr.push(atr(b, 14))
    u.costs.push(symbolCosts(median(b.map((c) => c.close * c.volume))))
  }
  const inDisc = u.days.map((d) => d.map((x) => x < DISCOVERY_END))
  const cuts = quantileCuts(u.mats, inDisc)
  const allDays = [...new Set(u.days.flat())].sort()
  const first = allDays.find((d) => d >= '2008-01-01') ?? allDays[0]
  const vaultFrom = VALIDATION_END
  const vaultTo = allDays[allDays.length - 1]

  const lastDay = allDays[allDays.length - 1]
  if (SIGNALS_ONLY && prev.rules?.length) {
    const rules: Rule[] = prev.rules.map((r) => ({ conds: r.conds, hold: r.hold, stop: r.stop, origin: r.origin ?? r.family ?? 'prev' }))
    const { log, today } = signalLog(u, used, rules, cuts, prev.signals ?? [])
    const out = { ...prev, generated: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), mode: 'signals', signals: log, today: { day: lastDay, signals: today }, score: signalScore(log) }
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify(out, null, 1))
    console.log(`signals only: ${today.length} new on ${lastDay}, ${JSON.stringify(out.score)}, ${out.seconds}s`)
    return
  }

  const c1 = (s: string) => u.costs[used.indexOf(s)]
  const c2 = (s: string) => scaleCosts(c1(s), 2)
  const baseDisc = baselines(u, first, DISCOVERY_END)
  const baseVal2 = baselines(u, DISCOVERY_END, VALIDATION_END, 2)
  const score = (r: Rule) => {
    const tr = runDaily(u.series, ruleSignals(u, r, cuts, first, DISCOVERY_END), c1)
    return fitOf(u, tr, baseDisc, r.hold, ERA_CUTS)
  }

  // start: the seeds, last run's best (Atlas remembers), then random rules fill the rest
  const start: Rule[] = [...SEEDS.map((s) => ({ ...s.rule, origin: s.id })), ...(prev.best ?? []).map((r) => ({ conds: r.conds, hold: r.hold, stop: r.stop, origin: r.origin ?? 'prev' }))]
  const { all, best } = search(start, score, 1000 + run, GENS)
  const tried = all.size
  const seedFit = SEEDS.map((s) => ({ id: s.id, ...all.get(ruleKey(s.rule))!.fit }))

  // validation: the 30 best discovery rules must stay positive at 2x costs on 2018-2022
  const cand = best.filter((s) => s.fit.fitness > 0).slice(0, 30)
  const val = cand.map((s) => {
    const tr = runDaily(u.series, ruleSignals(u, s.rule, cuts, DISCOVERY_END, VALIDATION_END), c2)
    return { s, v: fitOf(u, tr, baseVal2, s.rule.hold) }
  })
  const finalists = val
    .filter((x) => x.v.n >= MIN_VALIDATION_TRADES && x.v.days >= 30 && x.v.excess > 0 && x.v.t > 1)
    .sort((a, b) => b.v.t - a.v.t)
    .filter((x, k, a) => a.findIndex((y) => familyOf(y.s.rule) === familyOf(x.s.rule)) === k)
    .slice(0, FINALISTS)

  // vault: one-shot exam with the full lab rule; the DSR counts every lab trial and every factory rule ever tried
  const factoryTotal = (prev.trials?.factoryTotal ?? 0) + tried
  const trials = ALL_ROUNDS_TRIALS + factoryTotal
  const tv = trialSharpeVar(all.values())
  const vault = finalists.map((x) => vaultExam(u, x.s.rule, cuts, vaultFrom, trials, tv, HIGH_VOL))
  const passed = vault.filter((v) => v.passed).length

  // signals: the finalists' rules (or the best discovery families when none got through) on the latest close,
  // logged and graded with real prices on later runs, so the factory gets a live record next to Atlas's own
  const sigRules = (finalists.length ? finalists.map((x) => x.s) : cand.filter((s, k, a) => a.findIndex((y) => familyOf(y.rule) === familyOf(s.rule)) === k).slice(0, 3)).map((s) => s.rule)
  const { log, today } = signalLog(u, used, sigRules, cuts, prev.signals ?? [])

  const why = (r: Scored) => SEEDS.find((s) => s.id === r.rule.origin)?.why ?? null
  const stageOf = (k: number) => (k < 0 ? 'discovery' : vault[k]?.passed ? 'passed' : 'vault')
  const show = [...finalists.map((x) => x.s), ...cand.filter((s) => !finalists.some((f) => f.s.key === s.key)).slice(0, Math.max(0, 8 - finalists.length))]
  const top = show.map((s) => {
    const k = finalists.findIndex((f) => f.s.key === s.key)
    const v = val.find((x) => x.s.key === s.key)?.v
    const vr: VaultResult | null = k >= 0 ? vault[k] : null
    return {
      key: s.key,
      family: s.rule.origin,
      exactSeed: SEEDS.some((x) => ruleKey(x.rule) === s.key),
      ...describeRule(s.rule, cuts),
      why: why(s),
      stage: k >= 0 ? stageOf(k) : v && v.n >= MIN_VALIDATION_TRADES && v.excess > 0 ? 'validation-weak' : 'validation-failed',
      discovery: { n: s.fit.n, days: s.fit.days, excessPct: r3(s.fit.excess), t: r3(s.fit.t), eras: r3(s.fit.eras) },
      validation: v ? { n: v.n, excessPct2x: r3(v.excess), t: r3(v.t) } : null,
      vault: vr && { ...Object.fromEntries(Object.entries(vr).map(([a, b]) => [a, typeof b === 'number' ? r3(b) : b])) },
    }
  })

  const f = (x: number) => x.toFixed(2)
  const out = {
    generated: new Date().toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
    run,
    periods: { discovery: [first, DISCOVERY_END], validation: [DISCOVERY_END, VALIDATION_END], vault: [vaultFrom, vaultTo] },
    universe: { symbols: used.length, failed },
    search: { generations: GENS, seeds: SEEDS.length, fromLastRun: prev.best?.length ?? 0 },
    trials: { labs: ALL_ROUNDS_TRIALS, thisRun: tried, factoryTotal, total: trials },
    funnel: { tried, discovery: best.filter((s) => s.fit.fitness > 0).length, validation: finalists.length, vault: passed },
    pass: { en: PASS_EN(trials), vi: PASS_VI(trials) },
    top,
    seeds: seedFit.map((s) => ({ id: s.id, n: s.n, excessPct: r3(s.excess), t: r3(s.t), fitness: r3(s.fitness) })),
    signals: log,
    mode: 'full',
    today: { day: lastDay, signals: today },
    score: signalScore(log),
    /** the rules that make the signals, with their vault record (old data, never seen by the search) */
    rules: sigRules.map((r) => {
      const k = finalists.findIndex((f) => f.s.key === ruleKey(r))
      const v = k >= 0 ? vault[k] : null
      return { key: ruleKey(r), family: r.origin, conds: r.conds, hold: r.hold, stop: r.stop, ...describeRule(r, cuts), why: SEEDS.find((sd) => sd.id === r.origin)?.why ?? null, passed: !!v?.passed, vault: v ? { n: v.n, winRate: v.winRate, excessPct: r3(v.excess1), dsr: r3(v.dsr) } : null }
    }),
    best: best.slice(0, 15).map((s) => ({ conds: s.rule.conds, hold: s.rule.hold, stop: s.rule.stop, origin: s.rule.origin })),
    history: [...(prev.history ?? []), { run, generated: new Date().toISOString(), tried, passed }].slice(-20),
    verdict: {
      en: passed ? `${passed} rule(s) survived the vault. Next: a record-only shadow line, and your OK before anything more.` : `No rule survived the vault this run (${tried} new rules, ${trials} trials counted). The good ones are remembered for the next run.`,
      vi: passed ? `${passed} luật sống sót qua két khóa. Bước tiếp: chạy bóng (chỉ ghi lại), và cần anh OK trước khi làm gì thêm.` : `Lần này chưa luật nào qua được két khóa (${tried} luật mới, tính ${trials} lần thử). Các luật tốt nhất được nhớ lại cho lần chạy sau.`,
      lines: top.map((t) => `${t.stage.padEnd(17)} ${t.family.padEnd(6)} disc ex ${f(t.discovery.excessPct)}% t ${f(t.discovery.t)} | val ${t.validation ? `${f(t.validation.excessPct2x)}% t ${f(t.validation.t)}` : '-'}${t.vault ? ` | vault n ${t.vault.n}/${t.vault.days}d ex ${t.vault.excess1}% p ${t.vault.p1} dsr ${t.vault.dsr}` : ''} :: ${t.en}`),
    },
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(out.verdict.lines.join('\n'))
  console.log(`\n${out.verdict.en}\nfunnel ${JSON.stringify(out.funnel)}, ${out.seconds}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
