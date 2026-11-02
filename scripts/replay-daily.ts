/**
 * Atlas daily replay lab: do swing strategies (days to weeks) beat costs where 15-minute trading cannot?
 *
 * 1. Fetch Yahoo DAILY bars (free, since 2010) for the same liquid US stocks and ETFs as the 15m lab.
 *    Prices are scaled by adjclose/close so splits and dividends do not create fake moves.
 * 2. Run four published swing strategies (src/lib/replayDaily.ts): entry at the next day's open, stops on
 *    later highs/lows, the same per-side costs as the 15m lab.
 * 3. Split by date: the first 2/3 of days are the "book", the last 1/3 the "exam". Each strategy is also
 *    rerun at 0x, 1x and 2x costs. SPY buy-and-hold over the exam is shown next to them.
 *
 *   npm run replay:daily                          full run, writes public/replay-daily.json
 *   npm run replay:daily -- --symbols 8 --out x   quick run on the first 8 markets
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { costsFrom } from '../src/lib/costs'
import { dayKey } from '../src/lib/practice'
import type { Costs } from '../src/lib/costs'
import { buyHold, controlDaily, COST_MULTS, DAILY_STRATEGIES, evalDaily, runDaily, scaleCosts, type DailyResult, type DailySignal, type DailyTrade, type Series } from '../src/lib/replayDaily'
import { ETF_UNIVERSE, ROUND2_TRIALS, addBar, addStream, boundaryPx, dailyReturns, gateSignals, legStream, monthEnds, perf, portfolioMonthly, realizedVol, sideCost, spyLeg, tsmomWeights, unitTrade, vixDays, vixGate, volScale, type AddMode } from '../src/lib/replayRound2'
import { atr } from '../src/lib/replayStrategies'
import { STOCKS } from '../src/lib/replayUniverse'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-daily.json'
const LIMIT = Number(arg('--symbols') ?? 0)
const FROM = Date.UTC(2010, 0, 1) / 1000

const UA = { 'User-Agent': 'Mozilla/5.0 (atlas replay lab)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Quote = { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }

async function yahooDaily(symbol: string, from = FROM): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${from}&period2=${Math.floor(Date.now() / 1000)}`
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const json = (await res.json()) as { chart: { result?: { timestamp?: number[]; indicators: { quote: Quote[]; adjclose?: { adjclose: (number | null)[] }[] } }[] } }
      const r = json.chart.result?.[0]
      const q = r?.indicators.quote[0]
      const adj = r?.indicators.adjclose?.[0]?.adjclose
      if (!r?.timestamp || !q) return []
      const out: Candle[] = []
      r.timestamp.forEach((t, k) => {
        const [o, h, l, c, v] = [q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k]]
        if (o == null || h == null || l == null || c == null) return
        const f = adj?.[k] != null && c > 0 ? adj[k]! / c : 1
        out.push({ time: t, open: o * f, high: h * f, low: l * f, close: c * f, volume: v ?? 0 })
      })
      return out
    }
    await sleep(1000 * (i + 1))
  }
  throw new Error(`Yahoo failed for ${symbol}`)
}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(3)}%`

// ---- round 2: follow-ups on D1 (src/lib/replayRound2.ts) ----

const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const f = (v: number, d = 2) => v.toFixed(d)
const slim = (r: DailyResult) => ({
  book: { n: r.book.n, avgRet: r.book.avgRet },
  exam: { n: r.exam.n, avgRet: r.exam.avgRet, winRate: r.exam.winRate, tstat: r.exam.sharpe * Math.sqrt(r.exam.n) },
  examAvgByCost: r.examAvgByCost,
  control: r.control,
  excess: r.excess,
  p: r.p,
  dsr: r.dsr,
  passed: r.passed,
})

interface R2In {
  universe: Series[]
  spy: Candle[]
  examFrom: string
  costs: Costs | null
  sigsAll: DailySignal[][]
  runs: Record<number, DailyTrade[]>[]
  controls: ReturnType<typeof controlDaily>[]
  play: (sigs: DailySignal[]) => Record<number, DailyTrade[]>
}

async function round2({ universe, spy, examFrom, costs, sigsAll, runs, controls, play }: R2In) {
  const id = (k: string) => DAILY_STRATEGIES.findIndex((s) => s.id === k)
  const [d1, d3] = [id('D1'), id('D3')]
  const mults = [1, 2] as const

  // E1: VIX gate (thresholds fixed in advance, nothing is tuned) and E2: D1 minus SPY, the control built the same way
  const vix = vixDays(await yahooDaily('^VIX'))
  const gated = (kind: 'A' | 'B') => {
    const ok = vixGate(vix, kind)
    const sigs = gateSignals(universe, sigsAll[d1], ok)
    const r = play(sigs)
    return { sigs, r, c: controlDaily(universe, sigs, r[1], examFrom, costs, 200, 1, { allow: ok }) }
  }
  const [gA, gB] = [gated('A'), gated('B')]
  const leg = spyLeg(spy)
  const rn = Object.fromEntries(COST_MULTS.map((m) => [m, runs[d1][m].map((t) => ({ ...t, retPct: t.retPct - leg(t, scaleCosts(costs, m)) }))])) as Record<number, DailyTrade[]>
  const cn = controlDaily(universe, sigsAll[d1], runs[d1][1], examFrom, costs, 200, 1, { adj: leg })
  const extra = ['E1A', 'E1B', 'E2'].map((k) => ({ id: k, en: k, vi: k }))
  const ev = evalDaily(examFrom, [...DAILY_STRATEGIES, ...extra], [...runs, gA.r, gB.r, rn], [...controls, gA.c, gB.c, cn], ROUND2_TRIALS)
  const [e1base, e1a, e1b, e2] = [ev[d1], ev[4], ev[5], ev[6]]

  // E3: ETF time-series momentum; an ETF joins when it starts trading (no survivorship)
  const etf = new Map<string, Candle[]>()
  for (const s of ETF_UNIVERSE) {
    etf.set(s, await yahooDaily(s, Date.UTC(2007, 0, 1) / 1000))
    await sleep(250)
  }
  const cal = etf.get('SPY')!.map((b) => dayKey(b.time * 1000))
  const align = (g: (b: Candle) => number) => ETF_UNIVERSE.map((s) => {
    const m = new Map(etf.get(s)!.map((b) => [dayKey(b.time * 1000), g(b)]))
    return cal.map((d) => m.get(d) ?? NaN)
  })
  const [eo, ec] = [align((b) => b.open), align((b) => b.close)]
  const ends = monthEnds(cal)
  const px = boundaryPx(eo, ec, ends)
  const P = ends.length - 12
  const startDay = ends.slice(12).map((e) => cal[e + 1])
  const [iSpy, iIef] = [ETF_UNIVERSE.indexOf('SPY'), ETF_UNIVERSE.indexOf('IEF')]
  const hold = (wa: number, wb: number) => Array.from({ length: P }, () => ETF_UNIVERSE.map((_, k) => (k === iSpy ? wa : k === iIef ? wb : 0)))
  const plans: Record<string, number[][]> = { tsmomEq: tsmomWeights(ec, ends, 'eq'), tsmomInvVol: tsmomWeights(ec, ends, 'ivol'), spy: hold(1, 0), sixty40: hold(0.6, 0.4) }
  // book / exam by the first day of each period (monthly) or each day (daily), the same cut as round 1
  const split = (rets: number[], ppy: number, first: string[]) => {
    const yrs = first.map((d) => Number(d.slice(0, 4)))
    const pick = (keep: (d: string) => boolean) => perf(rets.filter((_, k) => keep(first[k])), yrs.filter((_, k) => keep(first[k])), ppy)
    return { book: pick((d) => d < examFrom), exam: pick((d) => d >= examFrom) }
  }
  const e3: Record<string, Record<string, ReturnType<typeof split>>> = {}
  for (const [name, w] of Object.entries(plans)) {
    e3[name] = {}
    for (const m of mults) e3[name][`x${m}`] = split(portfolioMonthly(px, w, sideCost(scaleCosts(costs, m))), 12, startDay)
  }
  const e3pass = (name: string, half: 'exam' | 'book') => mults.every((m) => {
    const k = `x${m}`
    return e3[name][k][half].sharpe > Math.max(e3.spy[k][half].sharpe, e3.sixty40[k][half].sharpe) && Math.abs(e3[name][k][half].maxDD) < Math.abs(e3.spy[k][half].maxDD)
  })
  const verdict = (exam: boolean, book: boolean, [yes, no, agree, differ]: string[]) => `${exam ? yes : no} (book ${book ? agree : differ})`

  // E4 and E5 share a daily portfolio: each unit of size is 1/30 of equity
  const days = spy.map((b) => dayKey(b.time * 1000))
  const bySym = new Map(universe.map((s) => [s.symbol, s.bars]))
  const rv = realizedVol(spy.map((b) => b.close))
  const rvBy = new Map(days.map((d, i) => [d, rv[i]]))
  const target = median(days.map((d, i) => (d < examFrom ? rv[i] : NaN)).filter(Number.isFinite)) // chosen on the book only
  const portfolio = (totals: Map<string, number>) => {
    const d = days.slice(days.findIndex((x) => totals.has(x)))
    return split(dailyReturns(totals, d, 30), 252, d)
  }
  const e4: Record<string, { base: ReturnType<typeof split>; scaled: ReturnType<typeof split>; meanSize: number }> = {}
  for (const m of mults) {
    const [base, scaled] = [new Map<string, number>(), new Map<string, number>()]
    let sz = 0
    for (const t of runs[d1][m]) {
      const bars = bySym.get(t.symbol)!
      const path = legStream(bars, t.entryBar!, t.entry!, t.exitBar!, t.exit!, t.retPct / 100)
      const s = volScale(rvBy.get(dayKey(bars[t.entryBar! - 1].time * 1000)) ?? NaN, target)
      addStream(base, path, 1)
      addStream(scaled, path, s)
      sz += s
    }
    e4[`x${m}`] = { base: portfolio(base), scaled: portfolio(scaled), meanSize: sz / runs[d1][m].length }
  }
  const e4pass = (half: 'exam' | 'book') => mults.every((m) => e4[`x${m}`].scaled[half].sharpe > e4[`x${m}`].base[half].sharpe && Math.abs(e4[`x${m}`].scaled[half].maxDD) < Math.abs(e4[`x${m}`].base[half].maxDD))

  const atrBy = new Map(universe.map((s) => [s.symbol, atr(s.bars, 14)]))
  const e5: Record<string, Record<string, Record<string, unknown>>> = {}
  const helps: Record<string, Record<string, boolean>> = {}
  for (const [name, k] of [['D1', d1], ['D3', d3]] as const) {
    e5[name] = {}
    const res: Record<string, { avg: number[]; dd: number }> = {}
    for (const mode of ['base', 'pyramid', 'down'] as const) {
      const row: Record<string, unknown> = {}
      res[mode] = { avg: [], dd: 0 }
      for (const m of mults) {
        const tot = new Map<string, number>()
        const ut: { pnl: number; cap: number; add: boolean }[] = []
        for (const t of runs[k][m]) {
          const bars = bySym.get(t.symbol)!
          const b = mode === 'base' ? -1 : addBar(bars, t, atrBy.get(t.symbol)![t.entryBar! - 1], mode as AddMode)
          const u = unitTrade(bars, t, b, scaleCosts(costs, m))
          addStream(tot, legStream(bars, t.entryBar!, t.entry!, t.exitBar!, t.exit!, u.r1 / 100), 1)
          if (b >= 0) addStream(tot, legStream(bars, b, bars[b].open, t.exitBar!, t.exit!, u.r2 / 100), 1)
          if (dayKey(t.openedAt) >= examFrom) ut.push({ pnl: u.pnl, cap: u.cap, add: b >= 0 })
        }
        const pf = portfolio(tot)
        const pnl = ut.reduce((a, q) => a + q.pnl, 0)
        const avg = pnl / Math.max(1, ut.reduce((a, q) => a + q.cap, 0))
        row[`x${m}`] = { examTrades: ut.length, addedShare: ut.filter((q) => q.add).length / Math.max(1, ut.length), avgPerCapital: avg, avgPerTrade: pnl / Math.max(1, ut.length), worstTrade: Math.min(...ut.map((q) => q.pnl)), examMaxDD: pf.exam.maxDD, bookMaxDD: pf.book.maxDD, examSharpe: pf.exam.sharpe }
        res[mode].avg.push(avg)
        res[mode].dd = Math.min(res[mode].dd, pf.exam.maxDD)
      }
      e5[name][mode] = row
    }
    helps[name] = Object.fromEntries((['pyramid', 'down'] as const).map((mode) => [mode, res[mode].avg.every((a, i) => a > res.base.avg[i]) && Math.abs(res[mode].dd) <= Math.abs(res.base.dd)]))
  }

  const sh = (name: string) => `${name} Sharpe ${f(e3[name].x1.exam.sharpe)} maxDD ${f(e3[name].x1.exam.maxDD, 1)}%`
  const e5x = (name: string, mode: string) => {
    const r = e5[name][mode].x1 as { avgPerCapital: number; worstTrade: number; examMaxDD: number }
    return `${mode} ${pct(r.avgPerCapital)} worst ${f(r.worstTrade, 1)}% DD ${f(r.examMaxDD, 1)}%`
  }
  const t2 = e2.exam.sharpe * Math.sqrt(e2.exam.n)
  const e3v = (names: string[], w: string[]) => names.map((n) => `${n} ${verdict(e3pass(n, 'exam'), e3pass(n, 'book'), w)}`).join(', ')
  const W = ['PASS', 'no', 'agrees', 'does not agree']
  const WVI = ['QUA', 'không', 'đồng ý', 'không đồng ý']
  const en = [
    `E1 VIX gate: A ${e1a.passed ? 'PASS' : 'no edge'} (exam n=${e1a.exam.n}, 1x ${pct(e1a.examAvgByCost.x1)}, excess ${pct(e1a.excess.examX1)}, p=${f(e1a.p.x1, 3)}); B ${e1b.passed ? 'PASS' : 'no edge'} (n=${e1b.exam.n}, ${pct(e1b.examAvgByCost.x1)}, excess ${pct(e1b.excess.examX1)}, p=${f(e1b.p.x1, 3)}); D1 always-on ${pct(e1base.examAvgByCost.x1)}, excess ${pct(e1base.excess.examX1)}.`,
    `E2 market-neutral D1: ${e2.passed ? 'PASS' : 'no edge'}; exam mean ${pct(e2.examAvgByCost.x1)} (2x ${pct(e2.examAvgByCost.x2)}), t=${f(t2)}, p vs neutral control ${f(e2.p.x1, 3)}/${f(e2.p.x2, 3)}.`,
    `E3 ETF momentum (exam, 1x): ${sh('tsmomEq')}; ${sh('tsmomInvVol')}; ${sh('spy')}; ${sh('sixty40')}. ${e3v(['tsmomEq', 'tsmomInvVol'], W)}.`,
    `E4 vol-targeted D1 (exam, 1x): Sharpe ${f(e4.x1.scaled.exam.sharpe)} vs ${f(e4.x1.base.exam.sharpe)}, maxDD ${f(e4.x1.scaled.exam.maxDD, 1)}% vs ${f(e4.x1.base.exam.maxDD, 1)}%. ${verdict(e4pass('exam'), e4pass('book'), W)}.`,
    `E5 adding to positions (exam, 1x, per unit of capital): D1 ${e5x('D1', 'base')}; ${e5x('D1', 'pyramid')}; ${e5x('D1', 'down')}. D3 ${e5x('D3', 'base')}; ${e5x('D3', 'pyramid')}; ${e5x('D3', 'down')}. Helps: ${JSON.stringify(helps)}.`,
  ]
  const vi = [
    `E1 cổng VIX: A ${e1a.passed ? 'QUA' : 'không có lợi thế'} (bài thi n=${e1a.exam.n}, 1x ${pct(e1a.examAvgByCost.x1)}, vượt trội ${pct(e1a.excess.examX1)}, p=${f(e1a.p.x1, 3)}); B ${e1b.passed ? 'QUA' : 'không có lợi thế'} (n=${e1b.exam.n}, ${pct(e1b.examAvgByCost.x1)}, vượt trội ${pct(e1b.excess.examX1)}, p=${f(e1b.p.x1, 3)}); D1 luôn bật ${pct(e1base.examAvgByCost.x1)}, vượt trội ${pct(e1base.excess.examX1)}.`,
    `E2 D1 trung hòa thị trường: ${e2.passed ? 'QUA' : 'không có lợi thế'}; trung bình bài thi ${pct(e2.examAvgByCost.x1)} (2x ${pct(e2.examAvgByCost.x2)}), t=${f(t2)}, p so với nhóm đối chứng trung hòa ${f(e2.p.x1, 3)}/${f(e2.p.x2, 3)}.`,
    `E3 động lượng ETF (bài thi, 1x): ${sh('tsmomEq')}; ${sh('tsmomInvVol')}; ${sh('spy')}; ${sh('sixty40')}. ${e3v(['tsmomEq', 'tsmomInvVol'], WVI)}.`,
    `E4 D1 theo mục tiêu biến động (bài thi, 1x): Sharpe ${f(e4.x1.scaled.exam.sharpe)} so với ${f(e4.x1.base.exam.sharpe)}, sụt giảm tối đa ${f(e4.x1.scaled.exam.maxDD, 1)}% so với ${f(e4.x1.base.exam.maxDD, 1)}%. ${verdict(e4pass('exam'), e4pass('book'), WVI)}.`,
    `E5 mua thêm (bài thi, 1x, trên mỗi đơn vị vốn): D1 ${e5x('D1', 'base')}; ${e5x('D1', 'pyramid')}; ${e5x('D1', 'down')}. D3 ${e5x('D3', 'base')}; ${e5x('D3', 'pyramid')}; ${e5x('D3', 'down')}. Có ích: ${JSON.stringify(helps)}.`,
  ]
  const passDef = {
    en: 'E1/E2 PASS = round 1 rule: exam excess over the 200-draw random-entry control (restricted to the same VIX days for E1, made market-neutral the same way for E2) > 0 at 1x and 2x costs, p <= 0.05 at both, 100+ exam trades, DSR >= 0.95 counting 14 trials. E3 PASS (judged on the exam; E3 and E4 also say whether the book agrees) = exam Sharpe above both SPY buy-and-hold and 60/40 at 1x and 2x costs AND exam max drawdown shallower than SPY. E4 PASS = vol-targeted exam Sharpe higher AND max drawdown shallower than equal size, at 1x and 2x. E5 "helps" = exam average per unit of capital above base at 1x and 2x AND exam max drawdown no deeper than base.',
    vi: 'E1/E2 QUA = quy tắc vòng 1: phần vượt trội của bài thi so với 200 lần vào lệnh ngẫu nhiên (E1: chỉ trong cùng những ngày VIX; E2: cũng trung hòa thị trường) > 0 ở phí 1x và 2x, p <= 0,05 ở cả hai, từ 100 lệnh thi, DSR >= 0,95 tính 14 lần thử. E3 QUA (chấm trên bài thi; E3 và E4 ghi thêm phần book có đồng ý không) = Sharpe bài thi cao hơn cả SPY mua-giữ lẫn 60/40 ở phí 1x và 2x VÀ sụt giảm tối đa nông hơn SPY. E4 QUA = Sharpe bài thi cao hơn VÀ sụt giảm tối đa nông hơn cỡ lệnh đều, ở 1x và 2x. E5 "có ích" = lợi nhuận trung bình bài thi trên mỗi đơn vị vốn cao hơn gốc ở 1x và 2x VÀ sụt giảm tối đa không sâu hơn gốc.',
  }
  return {
    trials: ROUND2_TRIALS,
    passDef,
    e1: { rule: 'thresholds fixed in advance (VIX close >= median of its trailing 252 closes; >= 25), not tuned; the signal day\'s VIX close only', signalShare: { A: gA.sigs.length / sigsAll[d1].length, B: gB.sigs.length / sigsAll[d1].length }, always: slim(e1base), A: slim(e1a), B: slim(e1b) },
    e2: { rule: 'D1 trade return minus a short SPY hedge (its move plus its round trip of costs, no borrow fee) from the same entry open to the same exit close; control drawn and neutralised the same way', result: slim(e2) },
    e3: { universe: ETF_UNIVERSE, rule: '12-1 month signal at month-end, fill at the next open; equal weight 1/N or inverse 63-day vol, held only while the signal is on, else cash at 0%; Sharpe has cash at 0%; worst year includes partial years', periods: P, firstPeriod: startDay[0], results: e3, pass: Object.fromEntries(['tsmomEq', 'tsmomInvVol'].map((n) => [n, { exam: e3pass(n, 'exam'), book: e3pass(n, 'book') }])) },
    e4: { rule: 'trade size = target / trailing 20-day SPY vol at the signal close, cap 2x; target = book median of that vol; each unit of size = 1/30 of equity', target, results: e4, pass: { exam: e4pass('exam'), book: e4pass('book') } },
    e5: { rule: 'second equal unit at the next open once a close is 1 ATR(14, signal day) above (pyramid) or below (down) the entry; same exits; trade figures in percent of one unit, avgPerCapital in percent of capital deployed', results: e5, helps },
    en,
    vi,
  }
}

async function main() {
  const t0 = Date.now()
  const markets = LIMIT ? STOCKS.slice(0, LIMIT) : STOCKS
  const universe: Series[] = []
  const failed: string[] = []
  let bars = 0
  for (const symbol of markets) {
    try {
      const b = await yahooDaily(symbol)
      bars += b.length
      universe.push({ symbol, bars: b })
      console.log(`${symbol}: ${b.length} bars`)
      await sleep(250)
    } catch (e) {
      failed.push(symbol)
      console.log(`${symbol}: failed (${e instanceof Error ? e.message : e})`)
    }
  }
  // book/exam cut: the day 2/3 of the way through SPY's history (the first 2/3 of days = book)
  const spy = universe.find((s) => s.symbol === 'SPY')?.bars ?? universe[0]?.bars ?? []
  const days = spy.map((b) => dayKey(b.time * 1000))
  const examFrom = days[Math.floor(days.length * (2 / 3))] ?? days[days.length - 1]
  const costs = costsFrom(DEFAULT_AI_RULES)
  const sigsAll = DAILY_STRATEGIES.map((s) => s.run(universe))
  const play = (sigs: DailySignal[]) => {
    const byCost: Record<number, DailyTrade[]> = {}
    for (const m of COST_MULTS) byCost[m] = runDaily(universe, sigs, scaleCosts(costs, m))
    return byCost
  }
  const runs = sigsAll.map(play)
  const controls = sigsAll.map((sigs, k) => controlDaily(universe, sigs, runs[k][1], examFrom, costs))
  const strategies = evalDaily(examFrom, DAILY_STRATEGIES, runs, controls)
  // D4 without the 5 symbols that contributed most on the exam (a diagnostic, picked on the exam on purpose)
  const d4 = DAILY_STRATEGIES.findIndex((x) => x.id === 'D4')
  const gain = new Map<string, number>()
  for (const t of runs[d4][1]) if (dayKey(t.openedAt) >= examFrom) gain.set(t.symbol, (gain.get(t.symbol) ?? 0) + t.retPct)
  const top5 = [...gain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k)
  const skip = new Set(universe.map((s, k) => (top5.includes(s.symbol) ? k : -1)))
  const sigs5 = sigsAll[d4].filter((x) => !skip.has(x.sym))
  const runs5 = play(sigs5)
  const d4Ex = evalDaily(examFrom, [DAILY_STRATEGIES[d4]], [runs5], [controlDaily(universe, sigs5, runs5[1], examFrom, costs)])[0]
  const d4ExTop5 = { removed: top5, exam: d4Ex.exam, examAvgByCost: d4Ex.examAvgByCost, control: d4Ex.control, excess: d4Ex.excess, p: d4Ex.p }
  const r2 = await round2({ universe, spy, examFrom, costs, sigsAll, runs, controls, play })
  const benchmark = { id: 'SPY', ...buyHold(spy, examFrom, costs) }
  const won = strategies.filter((x) => x.passed)
  const en = (won.length ? `Strategies with an edge over random entries on the exam: ${won.map((x) => x.id).join(', ')}.` : 'No strategy shows an edge over random entries on the exam.') + ' Raw return is NOT edge: a random-entry control with the same symbols, counts, exits and costs also earns money in a rising market. Judge the excess over control, not the average return.'
  const vi = (won.length ? `Chiến lược có lợi thế so với vào lệnh ngẫu nhiên trên bài thi: ${won.map((x) => `${x.id} (${x.vi})`).join('; ')}.` : 'Chưa chiến lược nào có lợi thế so với vào lệnh ngẫu nhiên trên bài thi.') + ' Lợi nhuận thô KHÔNG phải lợi thế: lệnh vào ngẫu nhiên (cùng mã, số lệnh, cách thoát và phí) cũng có lãi khi thị trường tăng. Hãy xem phần vượt trội so với nhóm đối chứng, không phải lợi nhuận trung bình.'
  const note = 'Raw average return is not edge: it includes market drift (the control earns it too). PASS needs excess over 200 seeded random-entry draws > 0 at 1x and 2x costs, p <= 0.05, 100+ exam trades and DSR >= 0.95. Survivorship bias: the list is today\'s liquid names applied back to 2010, so firms that fell out of the index or went bust are missing and results are flattered (the control shares this bias only partly, since the strategies can pick the winners). D4 is a proxy (gap + volume), not real earnings dates.'
  const noteVi = 'Lợi nhuận trung bình thô không phải lợi thế: nó gồm cả xu hướng chung của thị trường (nhóm đối chứng cũng hưởng). QUA cần vượt trội so với 200 lần vào lệnh ngẫu nhiên (có seed) > 0 ở phí 1x và 2x, p <= 0,05, từ 100 lệnh thi và DSR >= 0,95. Thiên lệch người sống sót: danh sách là các mã thanh khoản hôm nay áp ngược về 2010, nên các công ty đã rớt hạng hay phá sản bị bỏ sót và kết quả bị tô hồng (nhóm đối chứng chỉ chịu một phần, vì chiến lược có thể chọn trúng mã thắng). D4 chỉ là ước lượng (gap + khối lượng), không phải ngày báo cáo thật.'
  const out = {
    updated: new Date().toISOString(),
    markets: markets.length,
    failed,
    bars,
    seconds: Math.round((Date.now() - t0) / 1000),
    split: { bookDays: days.filter((d) => d < examFrom).length, examDays: days.filter((d) => d >= examFrom).length, examFrom },
    trades: runs.reduce((a, r) => a + r[1].length, 0),
    strategies,
    d4ExTop5,
    benchmark,
    round2: r2,
    en,
    vi,
    note,
    noteVi,
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`\n${markets.length - failed.length} markets, ${bars} bars in ${out.seconds}s; exam from ${examFrom}`)
  console.log(en)
  for (const x of strategies) console.log(`${x.passed ? 'PASS' : '    '} ${x.id} book ${pct(x.book.avgRet)} (excess ${pct(x.excess.book)}) | exam n=${x.exam.n} WR=${(x.exam.winRate * 100).toFixed(0)}% 0x ${pct(x.examAvgByCost.x0)} 1x ${pct(x.examAvgByCost.x1)} 2x ${pct(x.examAvgByCost.x2)} | control 1x ${pct(x.control.examX1)} excess 1x ${pct(x.excess.examX1)} 2x ${pct(x.excess.examX2)} p=${x.p.x1.toFixed(3)}/${x.p.x2.toFixed(3)} DSR=${x.dsr.toFixed(2)}`)
  console.log(`D4 without ${top5.join(',')}: n=${d4Ex.exam.n} 1x ${pct(d4Ex.examAvgByCost.x1)} control ${pct(d4Ex.control.examX1)} excess 1x ${pct(d4Ex.excess.examX1)} 2x ${pct(d4Ex.excess.examX2)} p=${d4Ex.p.x1.toFixed(3)}/${d4Ex.p.x2.toFixed(3)}`)
  if (benchmark.retPct != null) console.log(`SPY buy-and-hold ${benchmark.from}..${benchmark.to}: ${pct(benchmark.retPct)}`)
  console.log(note)
  console.log('\nRound 2')
  for (const l of r2.en) console.log(l)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
