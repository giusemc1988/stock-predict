/**
 * Atlas lab audit: does the lab's pass rule let a REAL edge through? Positive and negative controls on the
 * idea factory's vault gate (src/lib/ideaFactory.ts vaultExam), with the Deflated Sharpe as it was and as fixed.
 *
 *  - Negative control: random entry days (no edge). Should pass about never.
 *  - Planted edge: the same random days, but each trade gets +delta% (the bars from the exit day on are lifted),
 *    so the edge size is known exactly. A sound rule passes a big enough edge and fails a zero one.
 *  - Known real edge: SPY buy-and-hold daily returns, 2023-now, through the Deflated Sharpe alone.
 *
 *   npm run lab:audit       writes public/lab-audit.json (needs Yahoo, ~1 minute, no tokens)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Candle } from '../src/types'
import { SEEDS } from '../src/data/ideaSeeds'
import { DISCOVERY_END, GENERATIONS, MIN_DISCOVERY_TRADES, MIN_VAULT_DAYS, MIN_VAULT_TRADES, VALIDATION_END, baselines, features, fitOf, quantileCuts, ruleSignals, search, type Universe } from '../src/lib/ideaFactory'
import { atr } from '../src/lib/replayStrategies'
import { controlDaily, runDaily, scaleCosts, seededRng, type DailySignal, type Series } from '../src/lib/replayDaily'
import { ALL_ROUNDS_TRIALS, HOLDOUT_TRIALS } from '../src/lib/replayEdges'
import { symbolCosts } from '../src/lib/replayIntraday'
import { deflatedSharpe, normCdf, normInv, stats } from '../src/lib/replayLab'
import { HIGH_VOL, STOCKS } from '../src/lib/replayUniverse'

const OUT = 'public/lab-audit.json'
const CACHE = '.learn/audit-bars.json'
const FROM = Date.UTC(2007, 0, 1) / 1000
const UA = { 'User-Agent': 'Mozilla/5.0 (atlas lab audit)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const dayOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0
const r3 = (x: number) => Math.round(x * 1000) / 1000

async function yahooDaily(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${FROM}&period2=${Math.floor(Date.now() / 1000)}`
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const j = (await res.json()) as { chart: { result?: { timestamp?: number[]; indicators: { quote: Record<string, (number | null)[]>[]; adjclose?: { adjclose: (number | null)[] }[] } }[] } }
      const r = j.chart.result?.[0]
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
      return out
    }
    await sleep(1500 * (i + 1))
  }
  throw new Error(`Yahoo failed for ${symbol}`)
}

/** The Deflated Sharpe as the labs computed it before 2026-11-02: the luck spread passed in from outside
 *  (the spread of the Sharpes of the other rules tried), here only to show the difference. */
function dsrBefore(rets: number[], trials: number, trialSharpeVar: number): number {
  const n = rets.length
  if (n < 3) return 0
  const m = mean(rets)
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1))
  if (!(sd > 0)) return 0
  const sr = m / sd
  const skew = rets.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / n
  const kurt = rets.reduce((a, b) => a + ((b - m) / sd) ** 4, 0) / n
  const EM = 0.5772156649
  const N = Math.max(2, trials)
  const sr0 = Math.sqrt(trialSharpeVar) * ((1 - EM) * normInv(1 - 1 / N) + EM * normInv(1 - 1 / (N * Math.E)))
  return normCdf(((sr - sr0) * Math.sqrt(n - 1)) / Math.sqrt(Math.max(1e-9, 1 - skew * sr + ((kurt - 1) / 4) * sr * sr)))
}

/** Gate of the vault exam, on any list of signals (the same checks as vaultExam). */
function gate(u: Series[], costs: ReturnType<typeof symbolCosts>[], sigs: DailySignal[], trials: number, trialVar: number) {
  const c1 = (s: string) => costs[u.findIndex((x) => x.symbol === s)]
  const c2 = (s: string) => scaleCosts(c1(s), 2)
  const t1 = runDaily(u, sigs, c1)
  const t2 = runDaily(u, sigs, c2)
  const cd = controlDaily(u, sigs, t1, VALIDATION_END, c1, 100, 7)
  const avg1 = stats(t1).avgRet
  const avg2 = stats(t2).avgRet
  const p1 = cd.exam1.filter((x) => x >= avg1).length / Math.max(1, cd.exam1.length)
  const p2 = cd.exam2.filter((x) => x >= avg2).length / Math.max(1, cd.exam2.length)
  const byDay = new Map<number, number[]>()
  for (const t of t1) byDay.set(t.openedAt, [...(byDay.get(t.openedAt) ?? []), t.retPct])
  const dayRets = [...byDay.values()].map(mean)
  const keep = sigs.filter((s) => !HIGH_VOL.has(u[s.sym].symbol))
  const k1 = runDaily(u, keep, c1)
  const kd = controlDaily(u, keep, k1, VALIDATION_END, c1, 50, 9)
  const exHighVol = stats(k1).avgRet - mean(kd.exam1)
  const control = p1 <= 0.05 && p2 <= 0.05 && avg1 - mean(cd.exam1) > 0 && avg2 - mean(cd.exam2) > 0 && exHighVol > 0 && t1.length >= MIN_VAULT_TRADES && dayRets.length >= MIN_VAULT_DAYS
  return { n: t1.length, days: dayRets.length, excess1: avg1 - mean(cd.exam1), p1, p2, exHighVol, control, dayRets, dsr: dsrBefore(dayRets, trials, trialVar) }
}

async function main() {
  const t0 = Date.now()
  let raw: Record<string, Candle[]> = {}
  if (existsSync(CACHE)) raw = JSON.parse(readFileSync(CACHE, 'utf8'))
  else {
    for (const s of STOCKS) {
      try {
        const b = await yahooDaily(s)
        if (b.length > 600) raw[s] = b
      } catch {
        /* skipped */
      }
      await sleep(120)
    }
    mkdirSync(dirname(CACHE), { recursive: true })
    writeFileSync(CACHE, JSON.stringify(raw))
  }
  const names = Object.keys(raw)
  const costs = names.map((s) => symbolCosts(median(raw[s].map((c) => c.close * c.volume))))

  /** Random entry days in the vault (2023-now), `rate` of all symbol-days, hold `hold`, with `delta`% planted on each. */
  const plant = (delta: number, rate: number, hold: number, seed: number) => {
    const rnd = seededRng(seed)
    const sigs: DailySignal[] = []
    const series: Series[] = names.map((s, k) => {
      const bars = raw[s].map((b) => ({ ...b }))
      const days = bars.map((b) => dayOf(b.time))
      for (let i = 252; i + hold < bars.length; i++) {
        if (days[i] < VALIDATION_END || rnd() >= rate) continue
        sigs.push({ sym: k, i, hold, stopDist: null, targetDist: null })
        const f = 1 + delta / 100
        for (let j = i + hold; j < bars.length; j++) {
          // lift the exit day's open too, so the trade (in at i+1 open, out at i+hold close) gains exactly delta
          bars[j].open *= f
          bars[j].high *= f
          bars[j].low *= f
          bars[j].close *= f
        }
      }
      return { symbol: s, bars }
    })
    return { series, sigs }
  }

  // the factory's first run (2026-11-02) again, to get the exact trial count and Sharpe spread its vault DSR used
  const spyBy = new Map(raw.SPY.map((b) => [dayOf(b.time), b.close]))
  const u: Universe = { series: [], mats: [], days: [], atr: [], costs: [] }
  names.forEach((s, k) => {
    const b = raw[s]
    const days = b.map((c) => dayOf(c.time))
    let last = NaN
    u.series.push({ symbol: s, bars: b })
    u.mats.push(features(b, days.map((d) => (last = spyBy.get(d) ?? last))))
    u.days.push(days)
    u.atr.push(atr(b, 14))
    u.costs.push(costs[k])
  })
  const cuts = quantileCuts(u.mats, u.days.map((d) => d.map((x) => x < DISCOVERY_END)))
  const baseDisc = baselines(u, '2008-01-01', DISCOVERY_END)
  const c1f = (s: string) => costs[names.indexOf(s)]
  const { all } = search(SEEDS.map((s) => ({ ...s.rule, origin: s.id })), (r) => fitOf(u, runDaily(u.series, ruleSignals(u, r, cuts, '2008-01-01', DISCOVERY_END), c1f), baseDisc, r.hold, ['2011-01-01', '2014-07-01']), 1001, GENERATIONS)
  const factoryTrials = ALL_ROUNDS_TRIALS + all.size
  const disc = [...all.values()].filter((x) => x.fit.n >= MIN_DISCOVERY_TRADES).map((x) => x.fit.sharpe)
  const OLD_TRIAL_VAR = disc.reduce((a, b) => a + (b - mean(disc)) ** 2, 0) / Math.max(1, disc.length - 1)
  const NEW_TRIALS = HOLDOUT_TRIALS + 5 // the labs' recent-years ideas + the first run's 5 vault finalists
  console.log(`factory replay: ${all.size} rules, trials ${factoryTrials}, trial Sharpe variance ${OLD_TRIAL_VAR.toExponential(3)}`)
  const rows: Record<string, unknown>[] = []
  for (const delta of [0, 0.25, 0.5, 1, 2]) {
    let passOld = 0
    let passNew = 0
    let passControl = 0
    const runs = 5
    const detail: unknown[] = []
    for (let k = 0; k < runs; k++) {
      const { series, sigs } = plant(delta, 0.01, 5, 100 + k)
      const g = gate(series, costs, sigs, factoryTrials, OLD_TRIAL_VAR)
      const dsrNew = deflatedSharpe(g.dayRets, NEW_TRIALS)
      if (g.control) passControl++
      if (g.control && g.dsr >= 0.95) passOld++
      if (g.control && dsrNew >= 0.95) passNew++
      detail.push({ n: g.n, days: g.days, excess1: r3(g.excess1), p1: r3(g.p1), p2: r3(g.p2), exHighVol: r3(g.exHighVol), dsrBefore: r3(g.dsr), dsrNow: r3(dsrNew) })
    }
    rows.push({ deltaPct: delta, runs, passControl, passBefore: passOld, passNow: passNew, detail })
    console.log(`delta ${delta}%: control-gate ${passControl}/${runs}, before ${passOld}/${runs}, now ${passNew}/${runs}`, JSON.stringify(detail[0]))
  }

  // a known real edge: SPY buy-and-hold vs cash, daily, in the vault years
  const spy = raw.SPY.filter((b) => dayOf(b.time) >= VALIDATION_END)
  const spyRets = spy.slice(1).map((b, i) => (b.close / spy[i].close - 1) * 100)
  const spySharpe = (mean(spyRets) / Math.sqrt(mean(spyRets.map((x) => (x - mean(spyRets)) ** 2)))) * Math.sqrt(252)
  const spy1 = { annualSharpe: r3(spySharpe), dsrBefore: r3(dsrBefore(spyRets, factoryTrials, OLD_TRIAL_VAR)), dsrNow: r3(deflatedSharpe(spyRets, NEW_TRIALS)), dsrNowAllTrials: r3(deflatedSharpe(spyRets, factoryTrials)) }
  console.log('SPY buy-and-hold (vault years):', JSON.stringify(spy1))

  const out = { generated: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), symbols: names.length, factoryTrials, factoryTrialVar: OLD_TRIAL_VAR, newTrials: NEW_TRIALS, planted: rows, spyBuyHold: spy1 }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
