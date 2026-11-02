/**
 * Atlas short lab (round 6): four short-side ideas on free Yahoo daily bars since 2007 (adjusted), judged with the same
 * controls as the other rounds. Rules, costs and borrow: src/lib/replayShort.ts.
 *
 *   npm run replay:short                      full run, writes public/replay-short.json
 *   npm run replay:short -- --symbols 12 --out x.json   quick run on the first 12 stocks
 *
 * Costs per name from its median dollar volume (the other labs' model) plus a borrow fee, then 2x. Book = the first 2/3
 * of the days, exam = the newest 1/3; nothing is tuned. The control draws RANDOM shorts of the same names, years and
 * halves with the same exits, costs and borrow (200 seeded draws). Paper only: nothing here places an order.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Candle } from '../src/types'
import type { Costs } from '../src/lib/costs'
import { symbolCosts } from '../src/lib/replayIntraday'
import { ALL_ROUNDS_TRIALS, PASS_TRADES_EN, PASS_TRADES_VI, TRIAL_LEDGER, evalTrades, poolControl, sharpeVar, type EdgeEval, type Group } from '../src/lib/replayEdges'
import { deflatedSharpe, stats } from '../src/lib/replayLab'
import { HIGH_VOL, STOCKS } from '../src/lib/replayUniverse'
import { monthEndIdx, mom121 } from '../src/lib/replayMomentum'
import {
  BREAK_HOLD, BREAK_STOP, LOSER_N, LOSER_STOP, SHORT_TRIALS, SPIKE_HOLD, SPIKE_STOP,
  dropBars, newLowBars, shortFill, shortNet, spikeUpBars, tradeStream, weakMarketDays, worstN, type ShortFill,
} from '../src/lib/replayShort'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-short.json'
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
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
const f2 = (x: number) => x.toFixed(2)

interface Sym { name: string; bars: Candle[]; days: string[]; byDay: Map<string, number>; costs: Costs; hard: boolean }
interface Trade { sym: number; fill: ShortFill; entryDay: string; exitDay: string; r1: number; r2: number }
interface Idea { id: string; en: string; vi: string }

const IDEAS: Idea[] = [
  { id: 'S1-fade-spike', en: `Fade a spike: short the next open after a +7% day on 2x volume, hold ${SPIKE_HOLD} days, stop +${SPIKE_STOP * 100}%`, vi: `Bán khống sau cú tăng vọt: bán khống ở giá mở cửa hôm sau khi mã tăng 7% trong 1 ngày với volume gấp 2, giữ ${SPIKE_HOLD} ngày, cắt lỗ +${SPIKE_STOP * 100}%` },
  { id: 'S2-weak-market-breakdown', en: `Weak-market break-down: SPY under its 200-day average and the name at a new 20-day closing low, short the next open, hold ${BREAK_HOLD} days, stop +${BREAK_STOP * 100}%`, vi: `Phá đáy khi thị trường yếu: SPY dưới trung bình 200 ngày và mã chạm đáy đóng cửa 20 ngày, bán khống ở giá mở cửa hôm sau, giữ ${BREAK_HOLD} ngày, cắt lỗ +${BREAK_STOP * 100}%` },
  { id: 'S3-12-1-losers', en: `Momentum losers: each month short the ${LOSER_N} worst 12-1 month returns until the next rebalance, stop +${LOSER_STOP * 100}%`, vi: `Nhóm yếu nhất: mỗi tháng bán khống ${LOSER_N} mã có lợi nhuận 12-1 tháng thấp nhất đến kỳ đổi tháng sau, cắt lỗ +${LOSER_STOP * 100}%` },
  { id: 'S4-overnight-losers', en: 'Overnight short of big losers: short the close of a -3% day on 2x volume, cover the next open (no stop possible overnight)', vi: 'Bán khống qua đêm mã giảm mạnh: bán khống ở giá đóng cửa ngày giảm 3% với volume gấp 2, mua lại ở giá mở cửa hôm sau (qua đêm không đặt được cắt lỗ)' },
]

function runAll(syms: Sym[], spyDays: string[], spyOpen: number[], spyClose: number[], examFrom: string) {
  const weak = weakMarketDays(spyDays, spyClose)
  const examStart = spyDays.findIndex((d) => d >= examFrom)
  const half = (day: string) => (day >= examFrom ? 'exam' : 'book') as 'exam' | 'book'
  const spyIdx = new Map(spyDays.map((d, i) => [d, i]))
  const spyPx = (day: string, kind: 'o' | 'c') => {
    const i = spyIdx.get(day)
    return i == null ? NaN : kind === 'o' ? spyOpen[i] : spyClose[i]
  }

  const mk = (si: number, fill: ShortFill): Trade => {
    const s = syms[si]
    return { sym: si, fill, entryDay: s.days[fill.eBar], exitDay: s.days[fill.xBar], r1: shortNet(fill, s.costs, s.hard, 1), r2: shortNet(fill, s.costs, s.hard, 2) }
  }

  // a per-symbol idea: signal bars -> a fill; the control pool is every bar of the same name (gated for S2)
  const symbolIdea = (
    sig: (s: Sym) => number[],
    fillAt: (s: Sym, i: number) => ShortFill | null,
    candOk: (s: Sym, i: number) => boolean,
  ) => {
    const trades: Trade[] = []
    const pools = new Map<string, { sym: number; half: 'book' | 'exam'; r1: number[]; r2: number[]; want: number }>()
    const slot = (si: number, day: string) => {
      const key = `${si}|${day.slice(0, 4)}|${half(day)}`
      if (!pools.has(key)) pools.set(key, { sym: si, half: half(day), r1: [], r2: [], want: 0 })
      return pools.get(key)!
    }
    syms.forEach((s, si) => {
      for (let i = 21; i < s.bars.length; i++) {
        if (!candOk(s, i)) continue
        const f = fillAt(s, i)
        if (!f) continue
        const sl = slot(si, s.days[f.eBar])
        sl.r1.push(shortNet(f, s.costs, s.hard, 1))
        sl.r2.push(shortNet(f, s.costs, s.hard, 2))
      }
      let prevX = -1
      for (const i of sig(s)) {
        const f = fillAt(s, i)
        if (!f || f.eBar < prevX + (f.eKind === 'c' ? 0 : 1)) continue
        prevX = f.xBar
        const t = mk(si, f)
        trades.push(t)
        slot(si, t.entryDay).want++
      }
    })
    const groups: Group[] = [...pools.values()].map((p) => ({
      want: { book: p.half === 'book' ? p.want : 0, exam: p.half === 'exam' ? p.want : 0 },
      pool: { book: p.half === 'book' ? { r1: p.r1, r2: p.r2 } : { r1: [], r2: [] }, exam: p.half === 'exam' ? { r1: p.r1, r2: p.r2 } : { r1: [], r2: [] } },
    }))
    return { trades, groups }
  }

  // S3: one group per month, the pool is every name that was eligible that month
  const monthly = () => {
    const ends = monthEndIdx(spyDays)
    const closeAt = syms.map((s) => spyDays.map((d) => { const i = s.byDay.get(d); return i == null ? NaN : s.bars[i].close }))
    const trades: Trade[] = []
    const groups: Group[] = []
    for (let k = 12; k + 1 < ends.length; k++) {
      const eDay = spyDays[ends[k] + 1]
      const xDay = spyDays[ends[k + 1] + 1]
      if (!xDay) break
      const ret: number[] = []
      const fills = new Map<number, ShortFill>()
      syms.forEach((s, si) => {
        const r = mom121(closeAt[si], ends, k)
        const [eb, xb] = [s.byDay.get(eDay), s.byDay.get(xDay)]
        if (!Number.isFinite(r) || eb == null || xb == null) return
        const f = shortFill(s.bars, eb, 'o', xb, 'o', LOSER_STOP)
        if (!f) return
        ret[si] = r
        fills.set(si, f)
      })
      const elig = [...fills.keys()]
      if (elig.length < LOSER_N * 2) continue
      for (const si of worstN(ret, elig, LOSER_N)) trades.push(mk(si, fills.get(si)!))
      const h = half(eDay)
      const pool = { r1: elig.map((si) => shortNet(fills.get(si)!, syms[si].costs, syms[si].hard, 1)), r2: elig.map((si) => shortNet(fills.get(si)!, syms[si].costs, syms[si].hard, 2)) }
      const empty = { r1: [] as number[], r2: [] as number[] }
      groups.push({ want: { book: h === 'book' ? LOSER_N : 0, exam: h === 'exam' ? LOSER_N : 0 }, pool: { book: h === 'book' ? pool : empty, exam: h === 'exam' ? pool : empty } })
    }
    return { trades, groups }
  }

  const raw = [
    symbolIdea((s) => spikeUpBars(s.bars), (s, i) => shortFill(s.bars, i + 1, 'o', i + SPIKE_HOLD, 'c', SPIKE_STOP), () => true),
    symbolIdea(
      (s) => newLowBars(s.bars).filter((i) => weak.has(s.days[i])),
      (s, i) => shortFill(s.bars, i + 1, 'o', i + BREAK_HOLD, 'c', BREAK_STOP),
      (s, i) => weak.has(s.days[i]),
    ),
    monthly(),
    symbolIdea((s) => dropBars(s.bars), (s, i) => shortFill(s.bars, i, 'c', i + 1, 'o', null), () => true),
  ]

  const streams = raw.map((r) => tradeStream(spyDays, examStart, r.trades.filter((t) => t.entryDay >= examFrom).map((t) => ({ entryDay: t.entryDay, exitDay: t.exitDay, eKind: t.fill.eKind, retPct: t.r1 }))))
  const dsh = streams.map((s) => { const m = mean(s); const sd = Math.sqrt(mean(s.map((x) => (x - m) ** 2))); return sd > 0 ? m / sd : 0 })
  const dayVar = sharpeVar(dsh)
  const tradeVar = sharpeVar(raw.map((r) => stats(r.trades.filter((t) => t.entryDay >= examFrom).map((t) => ({ retPct: t.r1 }))).sharpe))

  return raw.map((r, k) => {
    const book = r.trades.filter((t) => t.entryDay < examFrom)
    const exam = r.trades.filter((t) => t.entryDay >= examFrom)
    const control = poolControl(r.groups)
    const ev: EdgeEval = evalTrades(IDEAS[k].id, IDEAS[k].en, IDEAS[k].vi, { book1: book.map((t) => t.r1), exam1: exam.map((t) => t.r1), exam2: exam.map((t) => t.r2) }, control, ALL_ROUNDS_TRIALS, tradeVar, deflatedSharpe(streams[k], ALL_ROUNDS_TRIALS, dayVar))
    // info only: the same shorts hedged with a long SPY over the same days (the market move removed)
    const hedged = exam.map((t) => {
      const [a, b] = [spyPx(t.entryDay, t.fill.eKind), spyPx(t.exitDay, t.fill.xKind)]
      return Number.isFinite(a) && Number.isFinite(b) && a > 0 ? t.r1 + (b / a - 1) * 100 : NaN
    }).filter(Number.isFinite)
    const byYear: Record<string, { n: number; avg1x: number }> = {}
    for (const y of [...new Set(exam.map((t) => t.entryDay.slice(0, 4)))].sort()) {
      const ys = exam.filter((t) => t.entryDay.startsWith(y))
      byYear[y] = { n: ys.length, avg1x: mean(ys.map((t) => t.r1)) }
    }
    const grossAvg = mean(exam.map((t) => shortNet(t.fill, null, false, 0)))
    return {
      ...ev,
      stopRate: exam.length ? exam.filter((t) => t.fill.stopped).length / exam.length : 0,
      worstTrade1x: exam.length ? Math.min(...exam.map((t) => t.r1)) : 0,
      avgDays: mean(exam.map((t) => t.fill.days)),
      grossAvgNoCostNoBorrow: grossAvg,
      hedgedAvg1x: mean(hedged),
      byYear,
      examTrades: exam.length,
    }
  })
}

async function main() {
  const t0 = Date.now()
  const list = (LIMIT ? STOCKS.slice(0, LIMIT) : [...STOCKS]).filter((s) => !['SPY', 'QQQ', 'IWM'].includes(s))
  const need = [...new Set(['SPY', ...list])]
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
  const spyDays = spyBars.map((b) => dayOf(b.time))
  const spyOpen = spyBars.map((b) => b.open)
  const spyClose = spyBars.map((b) => b.close)
  const examFrom = spyDays[Math.floor((spyDays.length * 2) / 3)]

  const mkSym = (name: string): Sym => {
    const b = bars.get(name)!
    const days = b.map((c) => dayOf(c.time))
    return { name, bars: b, days, byDay: new Map(days.map((d, i) => [d, i])), costs: symbolCosts(median(b.map((c) => c.close * c.volume))), hard: HIGH_VOL.has(name) }
  }
  const all = list.filter((s) => bars.has(s)).map(mkSym)
  const results = runAll(all, spyDays, spyOpen, spyClose, examFrom)
  // robustness (not a trial): the same four ideas without the 14 high-volatility names
  const calm = runAll(all.filter((s) => !s.hard), spyDays, spyOpen, spyClose, examFrom)

  const line = (r: (typeof results)[number]) =>
    `${r.id}: exam ${r.exam.n} trades, avg ${f2(r.exam.avg1x)}% (2x ${f2(r.exam.avg2x)}%), random shorts ${f2(r.exam.ctrl1x)}%, excess ${f2(r.exam.excess1x)}% p=${f2(r.exam.p1x)}, hedged vs SPY ${f2(r.hedgedAvg1x)}%, stops hit ${f2(r.stopRate * 100)}%, DSR ${f2(r.dsr)}, ${r.passed ? 'PASS' : 'fail'}`
  const won = results.filter((r) => r.passed).map((r) => r.id)
  const out = {
    generated: new Date().toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
    examFrom,
    universe: { stocks: all.length, failed, hardToBorrow: all.filter((s) => s.hard).map((s) => s.name) },
    assumptions: { borrowEasyPerYear: 0.01, borrowHardPerYear: 0.08, stopsAreHard: true, kronos: 'not testable: no history of Kronos forecasts' },
    trials: { ledger: TRIAL_LEDGER, total: ALL_ROUNDS_TRIALS, round6: SHORT_TRIALS },
    pass: { en: PASS_TRADES_EN, vi: PASS_TRADES_VI },
    results,
    robustness: { withoutHighVol: calm.map((r) => ({ ...r, id: `${r.id}-exHighVol` })) },
    verdict: {
      en: won.length ? `Passed: ${won.join(', ')}.` : `Nothing passed with all ${ALL_ROUNDS_TRIALS} trials counted.`,
      vi: won.length ? `Đạt: ${won.join(', ')}.` : `Không ý tưởng nào đạt khi tính cả ${ALL_ROUNDS_TRIALS} lần thử.`,
      lines: [...results, ...calm.map((r) => ({ ...r, id: `${r.id}-exHighVol` }))].map(line),
    },
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(out.verdict.lines.join('\n'))
  console.log(`\n${out.verdict.en}\nexam from ${examFrom}, ${all.length} stocks, ${out.seconds}s, trials ${ALL_ROUNDS_TRIALS}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
