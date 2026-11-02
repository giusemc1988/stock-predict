/**
 * Atlas momentum lab (round 5): 12-1 month cross-sectional momentum on the shared stock list and on ETFs.
 * Rules, statistics and the fixed pass rule: src/lib/replayMomentum.ts.
 *
 * Data: Yahoo daily bars since 2007 (adjusted, free). Costs per name from its median dollar volume (the same
 * model as the intraday lab), then 2x. Book = first 2/3 of the months, exam = newest 1/3; nothing is tuned.
 *
 *   npm run replay:momentum                      full run, writes public/replay-momentum.json
 *   npm run replay:momentum -- --symbols 12 --out x.json   quick run on the first 12 stocks
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Candle } from '../src/types'
import { scaleCosts } from '../src/lib/replayDaily'
import { symbolCosts } from '../src/lib/replayIntraday'
import { sideCost } from '../src/lib/replayRound2'
import { HOLDOUT_TRIALS, TRIAL_LEDGER } from '../src/lib/replayEdges'
import { HIGH_VOL, STOCKS } from '../src/lib/replayUniverse'
import {
  ETF_TOP_N, MOMENTUM_ETFS, MOMENTUM_TRIALS, PASS_MOMENTUM_EN, PASS_MOMENTUM_VI, STOCK_TOP_N, TREND_DAYS,
  evalMomentum, fillPx, finalPass, monthEndIdx, momentumPlan, monthlyNet, type MomentumEval,
} from '../src/lib/replayMomentum'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-momentum.json'
const LIMIT = Number(arg('--symbols') ?? 0)
const FROM = Date.UTC(2007, 0, 1) / 1000
const UA = { 'User-Agent': 'Mozilla/5.0 (atlas replay lab)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

async function main() {
  const t0 = Date.now()
  const stocks = (LIMIT ? STOCKS.slice(0, LIMIT) : [...STOCKS]).filter((s) => s !== 'SPY')
  const etfs = (LIMIT ? MOMENTUM_ETFS.slice(0, LIMIT) : [...MOMENTUM_ETFS]).filter((s) => s !== 'SPY')
  const need = [...new Set(['SPY', ...stocks, ...etfs])]
  const bars = new Map<string, Candle[]>()
  const failed: string[] = []
  for (const s of need) {
    try {
      const b = await yahooDaily(s)
      if (b.length > 300) bars.set(s, b)
      else failed.push(s)
    } catch {
      failed.push(s)
    }
    await sleep(120)
  }
  const spyBars = bars.get('SPY')
  if (!spyBars) throw new Error('no SPY bars')
  const days = spyBars.map((b) => dayOf(b.time))
  const years = days.map((d) => Number(d.slice(0, 4)))
  const dayIdx = new Map(days.map((d, i) => [d, i]))
  const align = (b: Candle[], g: (c: Candle) => number) => {
    const a = new Array<number>(days.length).fill(NaN)
    for (const c of b) {
      const i = dayIdx.get(dayOf(c.time))
      if (i != null) a[i] = g(c)
    }
    return a
  }
  const spyClose = align(spyBars, (c) => c.close)
  const ends = monthEndIdx(days)
  const P = ends.length - 12
  const examIdx = Math.floor((P * 2) / 3)
  const examFrom = days[ends[12 + examIdx] + 1]
  const monthYears = Array.from({ length: P }, (_, p) => years[ends[12 + p] + 1])

  const spyOpen = align(spyBars, (c) => c.open)
  const spyPx = fillPx([spyOpen], [spyClose], ends)[0]
  const sc = symbolCosts(median(spyBars.map((b) => b.close * b.volume)))
  const spyMonthly = monthlyNet([spyPx], Array.from({ length: P }, () => [1]), [sideCost(sc)])

  interface Uni { names: string[]; close: number[][]; open: number[][]; px: number[][]; side1: number[]; side2: number[] }
  const build = (list: string[]): Uni => {
    const names = list.filter((s) => bars.has(s))
    const close = names.map((s) => align(bars.get(s)!, (c) => c.close))
    const open = names.map((s) => align(bars.get(s)!, (c) => c.open))
    const costs = names.map((s) => symbolCosts(median(bars.get(s)!.map((b) => b.close * b.volume))))
    return { names, close, open, px: fillPx(open, close, ends), side1: costs.map(sideCost), side2: costs.map((c) => sideCost(scaleCosts(c, 2))) }
  }
  const U = { stocks: build(stocks), etfs: build(etfs) }

  const defs = [
    { id: 'M1-stocks', u: 'stocks' as const, n: STOCK_TOP_N, trend: false, en: `Stocks: top ${STOCK_TOP_N} by 12-1 month return, monthly, equal weight`, vi: `Cổ phiếu: ${STOCK_TOP_N} mã có lợi nhuận 12-1 tháng cao nhất, mỗi tháng đổi, chia đều` },
    { id: 'M2-stocks-trend', u: 'stocks' as const, n: STOCK_TOP_N, trend: true, en: `Stocks: same, in cash while SPY is below its ${TREND_DAYS}-day average`, vi: `Cổ phiếu: như trên, giữ tiền mặt khi SPY dưới trung bình ${TREND_DAYS} ngày` },
    { id: 'M3-etfs', u: 'etfs' as const, n: ETF_TOP_N, trend: false, en: `ETFs: top ${ETF_TOP_N} by 12-1 month return, monthly, equal weight`, vi: `ETF: ${ETF_TOP_N} quỹ có lợi nhuận 12-1 tháng cao nhất, mỗi tháng đổi, chia đều` },
    { id: 'M4-etfs-trend', u: 'etfs' as const, n: ETF_TOP_N, trend: true, en: `ETFs: same, in cash while SPY is below its ${TREND_DAYS}-day average`, vi: `ETF: như trên, giữ tiền mặt khi SPY dưới trung bình ${TREND_DAYS} ngày` },
  ]
  const plans = defs.map((d) => momentumPlan(U[d.u].close, U[d.u].open, spyClose, ends, d.n, d.trend))
  const trials = HOLDOUT_TRIALS
  const run = (i: number, id = defs[i].id, plan = plans[i]): MomentumEval =>
    evalMomentum({ id, en: defs[i].en, vi: defs[i].vi, px: U[defs[i].u].px, plan, side1: U[defs[i].u].side1, side2: U[defs[i].u].side2, years: monthYears, spyMonthly, examIdx, trials })
  const results = defs.map((_, i) => run(i))

  // robustness (not a trial): stocks M1 without the 14 high-volatility names
  const drop = new Set(U.stocks.names.map((s, i) => (HIGH_VOL.has(s) ? i : -1)).filter((i) => i >= 0))
  const exHv = run(0, 'M1-stocks-exHighVol', momentumPlan(U.stocks.close, U.stocks.open, spyClose, ends, STOCK_TOP_N, false, drop))

  const final = [
    { id: 'M1-stocks', passed: finalPass(results[0], results[2]), needs: 'M3-etfs' },
    { id: 'M2-stocks-trend', passed: finalPass(results[1], results[3]), needs: 'M4-etfs-trend' },
    { id: 'M3-etfs', passed: results[2].passed, needs: null },
    { id: 'M4-etfs-trend', passed: results[3].passed, needs: null },
  ]
  const won = final.filter((f) => f.passed).map((f) => f.id)
  const f = (x: number) => x.toFixed(2)
  const line = (r: MomentumEval) => `${r.id}: Sharpe ${f(r.exam.sharpe)} (SPY ${f(r.spyExam.sharpe)}), CAGR ${f(r.exam.cagr)}%, maxDD ${f(r.exam.maxDD)}%, p(1x)=${f(r.control.p)} p(2x)=${f(r.control2x.p)}, DSR ${f(r.dsr)}, ${r.passed ? 'PASS' : 'fail'}`
  const out = {
    generated: new Date().toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
    examFrom,
    months: P,
    examMonths: P - examIdx,
    universe: { stocks: U.stocks.names.length, etfs: U.etfs.names.length, failed },
    trials: { ledger: TRIAL_LEDGER, total: trials, round5: MOMENTUM_TRIALS },
    pass: { en: PASS_MOMENTUM_EN(trials), vi: PASS_MOMENTUM_VI(trials) },
    results,
    robustness: { stocksM1WithoutHighVol: exHv },
    final,
    verdict: {
      en: won.length ? `Passed: ${won.join(', ')}.` : `Nothing passed with all ${trials} trials counted.`,
      vi: won.length ? `Đạt: ${won.join(', ')}.` : `Không ý tưởng nào đạt khi tính cả ${trials} lần thử.`,
      lines: [...results, exHv].map(line),
    },
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(out.verdict.lines.join('\n'))
  console.log(`\n${out.verdict.en}\nexam from ${examFrom}, ${P} months, ${out.seconds}s, trials ${trials}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
