/**
 * Daily-bar replay lab: swing strategies (days to weeks) on years of free Yahoo daily bars. The 15-minute lab
 * showed a round trip costs about 0.1%, the size of an average 15-minute move, so this one asks whether
 * moves that last days can beat the same costs. Pure functions; scripts/replay-daily.ts fetches the bars.
 *
 * No look-ahead: a signal uses data up to day t's close; the entry fills at day t+1's OPEN. A stop is checked
 * on each later day's low (a gap through it fills at the open); if a stop and a target are both touched on
 * the same day the stop is assumed to hit first. A time exit fills at the close; a rule exit (decided at a
 * close) fills at the next open. Costs are the same per-side costs as the 15-minute lab.
 *
 *  D1 Short-term reversal (Lehmann 1990; large-cap weekly reversal, Quantpedia): each day rank the universe
 *     by 5-day return, buy the bottom 10%, hold 5 trading days.
 *  D2 52-week-high momentum (George & Hwang 2004): close within 2% of its 252-day high and above its
 *     200-day SMA; hold 10 days; stop 2 ATR(14).
 *  D3 Trend pullback (Connors RSI(2)): close above the 200-day SMA and RSI(2) under 10; out when the close
 *     is above the 5-day SMA (next open) or after 10 days.
 *  D4 Event drift PROXY (post-earnings-announcement drift, Bernard & Thomas 1989): there is no free earnings
 *     calendar, so a gap up of 4%+ at the open on 2x its 20-day average volume stands in for "news day".
 *     Buy the next open; hold 20 days; stop 2 ATR(14).
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { dayKey } from './practice'
import { deflatedSharpe, stats, type Stats } from './replayLab'
import { atr, netRetPct, rsi } from './replayStrategies'

export interface Series {
  symbol: string
  bars: Candle[]
}

/** A signal on the close of bar `i` of series `sym`; the entry is the open of bar i+1. */
export interface DailySignal {
  sym: number
  i: number
  /** Trading days held, the entry day counted as day 1. */
  hold: number
  /** Stop and target distances below / above the entry price (null = none). */
  stopDist: number | null
  targetDist: number | null
  /** The stop in ATR(14) multiples (the random-entry control re-applies it on its own days). */
  stopAtr?: number
  /** Leave when the close is above the 5-day SMA (filled at the next open). */
  sma5Exit?: boolean
}

export interface DailyTrade {
  symbol: string
  openedAt: number
  retPct: number
  /** Fill prices (before costs), so a trade can be re-priced at other cost levels. */
  entry?: number
  exit?: number
  limit?: boolean
  exitReason: 'stop' | 'target' | 'time' | 'rule'
  /** First bar index where a new entry open is allowed (no overlapping trades per symbol). */
  freeFrom: number
}

export interface DailyStrategy {
  id: string
  en: string
  vi: string
  run: (u: Series[]) => DailySignal[]
}

export const scaleCosts = (c: Costs | null, m: number): Costs | null =>
  c && m > 0 ? { feeBps: c.feeBps * m, spreadBps: c.spreadBps * m, slippageBps: c.slippageBps * m } : null

/** Simple moving average of closes; NaN until `n` bars exist. */
export function sma(bars: Candle[], n: number): number[] {
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close
    if (i >= n) sum -= bars[i - n].close
    out.push(i >= n - 1 ? sum / n : NaN)
  }
  return out
}

const sma5Cache = new WeakMap<Candle[], number[]>()
const sma5 = (bars: Candle[]) => sma5Cache.get(bars) ?? (sma5Cache.set(bars, sma(bars, 5)), sma5Cache.get(bars)!)

/** Play one signal forward on `bars`. Returns null when there is no next bar to enter on. */
export function simulateDaily(bars: Candle[], sig: Pick<DailySignal, 'i' | 'hold' | 'stopDist' | 'targetDist' | 'sma5Exit'>, costs: Costs | null, symbol = ''): DailyTrade | null {
  const e = sig.i + 1
  if (e >= bars.length) return null
  const entry = bars[e].open
  const stop = sig.stopDist != null ? entry - sig.stopDist : null
  const target = sig.targetDist != null ? entry + sig.targetDist : null
  const last = Math.min(e + sig.hold - 1, bars.length - 1)
  const s5 = sig.sma5Exit ? sma5(bars) : []
  const done = (price: number, reason: DailyTrade['exitReason'], freeFrom: number, limit = false): DailyTrade => ({
    symbol,
    openedAt: bars[e].time * 1000,
    retPct: netRetPct(entry, price, costs, limit),
    entry,
    exit: price,
    limit,
    exitReason: reason,
    freeFrom,
  })
  for (let j = e; j <= last; j++) {
    const b = bars[j]
    if (stop != null && b.open <= stop) return done(b.open, 'stop', j) // gapped through: filled at the open
    if (stop != null && b.low <= stop) return done(stop, 'stop', j + 1) // checked before the target
    if (target != null && b.high >= target) return done(Math.max(target, b.open), 'target', j + 1, true)
    if (j === last) return done(b.close, 'time', j + 1)
    if (sig.sma5Exit && b.close > s5[j]) return done(bars[j + 1].open, 'rule', j + 1)
  }
  return null
}

/** Run signals through the simulator, one open trade per symbol at a time. */
export function runDaily(u: Series[], sigs: DailySignal[], costs: Costs | null): DailyTrade[] {
  const free = new Map<number, number>()
  const out: DailyTrade[] = []
  for (const s of [...sigs].sort((a, b) => a.i - b.i || a.sym - b.sym)) {
    if (s.i + 1 < (free.get(s.sym) ?? 0)) continue
    const t = simulateDaily(u[s.sym].bars, s, costs, u[s.sym].symbol)
    if (!t) continue
    free.set(s.sym, t.freeFrom)
    out.push(t)
  }
  return out
}

// ---- strategies ----

export function d1Reversal(u: Series[]): DailySignal[] {
  const byDay = new Map<string, { sym: number; i: number; ret: number }[]>()
  u.forEach((s, sym) => {
    for (let i = 5; i < s.bars.length; i++) {
      const k = dayKey(s.bars[i].time * 1000)
      if (!byDay.has(k)) byDay.set(k, [])
      byDay.get(k)!.push({ sym, i, ret: s.bars[i].close / s.bars[i - 5].close - 1 })
    }
  })
  const out: DailySignal[] = []
  for (const rows of byDay.values()) {
    if (rows.length < 10) continue
    rows.sort((a, b) => a.ret - b.ret)
    for (const r of rows.slice(0, Math.floor(rows.length * 0.1))) out.push({ sym: r.sym, i: r.i, hold: 5, stopDist: null, targetDist: null })
  }
  return out
}

export function d2High52(u: Series[]): DailySignal[] {
  const out: DailySignal[] = []
  u.forEach((s, sym) => {
    const m200 = sma(s.bars, 200)
    const a = atr(s.bars, 14)
    for (let i = 252; i < s.bars.length; i++) {
      let hi = 0
      for (let k = i - 251; k <= i; k++) hi = Math.max(hi, s.bars[k].close)
      const c = s.bars[i].close
      if (c >= hi * 0.98 && c > m200[i]) out.push({ sym, i, hold: 10, stopDist: 2 * a[i], stopAtr: 2, targetDist: null })
    }
  })
  return out
}

export function d3Rsi2(u: Series[]): DailySignal[] {
  const out: DailySignal[] = []
  u.forEach((s, sym) => {
    const m200 = sma(s.bars, 200)
    const r = rsi(s.bars, 2)
    for (let i = 200; i < s.bars.length; i++) if (s.bars[i].close > m200[i] && r[i] < 10) out.push({ sym, i, hold: 10, stopDist: null, targetDist: null, sma5Exit: true })
  })
  return out
}

export function d4GapDrift(u: Series[]): DailySignal[] {
  const out: DailySignal[] = []
  u.forEach((s, sym) => {
    const a = atr(s.bars, 14)
    for (let i = 21; i < s.bars.length; i++) {
      const b = s.bars[i]
      let v = 0
      for (let k = i - 20; k < i; k++) v += s.bars[k].volume
      if (b.open >= s.bars[i - 1].close * 1.04 && v > 0 && b.volume >= 2 * (v / 20)) out.push({ sym, i, hold: 20, stopDist: 2 * a[i], stopAtr: 2, targetDist: null })
    }
  })
  return out
}

export const DAILY_STRATEGIES: DailyStrategy[] = [
  { id: 'D1', en: 'Short-term reversal: buy the worst 10% by 5-day return, hold 5 days', vi: 'Đảo chiều ngắn hạn: mua 10% giảm mạnh nhất 5 ngày, giữ 5 ngày', run: d1Reversal },
  { id: 'D2', en: '52-week-high momentum: near the 252-day high above the 200-day average, hold 10 days, stop 2 ATR', vi: 'Động lượng đỉnh 52 tuần: sát đỉnh 252 ngày và trên MA200, giữ 10 ngày, stop 2 ATR', run: d2High52 },
  { id: 'D3', en: 'Trend pullback (RSI(2) under 10 above the 200-day average), out above the 5-day average or after 10 days', vi: 'Hồi trong xu hướng tăng (RSI(2) dưới 10, trên MA200), thoát khi trên MA5 hoặc sau 10 ngày', run: d3Rsi2 },
  { id: 'D4', en: 'Event drift PROXY (no earnings calendar): gap up 4%+ on 2x volume, hold 20 days, stop 2 ATR', vi: 'Xu hướng sau tin (ƯỚC LƯỢNG, không có lịch báo cáo): gap tăng 4%+ với khối lượng 2x, giữ 20 ngày, stop 2 ATR', run: d4GapDrift },
]

// ---- evaluation ----

export const COST_MULTS = [0, 1, 2] as const

export interface DailyResult {
  id: string
  en: string
  vi: string
  book: Stats
  exam: Stats
  /** Exam average return per trade at 0x, 1x and 2x costs. */
  examAvgByCost: Record<'x0' | 'x1' | 'x2', number>
  /** Average return per trade by entry year (regime breakdown), at 1x costs. */
  byYear: Record<string, { n: number; avgRet: number }>
  /** Random-entry control: mean over the draws of the average return per trade (same symbols, counts, exits, costs). */
  control: { book: number; examX1: number; examX2: number }
  /** Strategy minus control: the edge over drift. */
  excess: { book: number; examX1: number; examX2: number }
  /** Share of control draws whose exam average is at least the strategy's (at 1x and 2x costs). */
  p: { x1: number; x2: number }
  dsr: number
  passed: boolean
}

/** Mulberry32: a small seeded random generator, so a control run is reproducible. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ControlDraws {
  book1: number[]
  exam1: number[]
  exam2: number[]
  /** Trades in each draw (equals the strategy's own count when the days are available). */
  count: number[]
}

/** Random-entry control for one strategy: the SAME symbols, the same number of trades per symbol, year and
 *  book/exam half, the same exit rule (hold, stop in ATR, SMA exit) and costs, but entered on random days where
 *  the symbol had data and no trade of its own was open. Returns each draw's average return per trade. */
export function controlDaily(u: Series[], sigs: DailySignal[], actual: DailyTrade[], examFrom: string, costs: Costs | null, draws = 200, seed = 1): ControlDraws {
  const out: ControlDraws = { book1: [], exam1: [], exam2: [], count: [] }
  if (!sigs.length) return out
  const tpl = sigs[0]
  const warm = sigs.reduce((m, s) => Math.min(m, s.i), Infinity)
  const keyOf = (ms: number) => `${new Date(ms).getUTCFullYear()}|${dayKey(ms) >= examFrom ? 1 : 0}`
  const idx = new Map(u.map((s, k) => [s.symbol, k]))
  const counts = new Map<number, Map<string, number>>()
  for (const t of actual) {
    const sym = idx.get(t.symbol)!
    if (!counts.has(sym)) counts.set(sym, new Map())
    const m = counts.get(sym)!
    const k = keyOf(t.openedAt)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  const prep = [...counts.keys()].map((sym) => {
    const bars = u[sym].bars
    const a = atr(bars, 14)
    const cands = new Map<string, number[]>()
    for (let i = Math.max(warm, 14); i + tpl.hold < bars.length; i++) { // the full holding period must fit in the data
      const k = keyOf(bars[i + 1].time * 1000)
      if (!cands.has(k)) cands.set(k, [])
      cands.get(k)!.push(i)
    }
    return { sym, bars, a, cands, want: counts.get(sym)! }
  })
  const c1 = scaleCosts(costs, 1)
  const c2 = scaleCosts(costs, 2)
  for (let d = 0; d < draws; d++) {
    const rnd = seededRng(seed * 100_003 + d)
    const sum = { b1: 0, bn: 0, e1: 0, e2: 0, en: 0 }
    for (const p of prep) {
      const taken: { e: number; free: number }[] = []
      for (const [k, n] of p.want) {
        const pool = [...(p.cands.get(k) ?? [])]
        for (let x = pool.length - 1; x > 0; x--) {
          const y = Math.floor(rnd() * (x + 1))
          ;[pool[x], pool[y]] = [pool[y], pool[x]]
        }
        let got = 0
        for (const i of pool) {
          if (got >= n) break
          const t = simulateDaily(p.bars, { ...tpl, i, stopDist: tpl.stopAtr != null ? tpl.stopAtr * p.a[i] : tpl.stopDist }, null)
          if (!t || taken.some((o) => i + 1 < o.free && o.e < t.freeFrom)) continue
          taken.push({ e: i + 1, free: t.freeFrom })
          got++
          if (k.endsWith('|1')) {
            sum.e1 += netRetPct(t.entry!, t.exit!, c1, !!t.limit)
            sum.e2 += netRetPct(t.entry!, t.exit!, c2, !!t.limit)
            sum.en++
          } else {
            sum.b1 += netRetPct(t.entry!, t.exit!, c1, !!t.limit)
            sum.bn++
          }
        }
      }
    }
    out.count.push(sum.bn + sum.en)
    out.book1.push(sum.bn ? sum.b1 / sum.bn : 0)
    out.exam1.push(sum.en ? sum.e1 / sum.en : 0)
    out.exam2.push(sum.en ? sum.e2 / sum.en : 0)
  }
  return out
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)

/** Judge each strategy on the exam (the newest third) by its edge over drift: excess over the random-entry
 *  control > 0 at 1x AND 2x costs with p <= 0.05 at both, at least 100 trades and a Deflated Sharpe >= 0.95
 *  counting every strategy tried here. `runs[k][m]` = trades of strategy k at cost multiplier m. */
export function evalDaily(examFrom: string, strategies: Pick<DailyStrategy, 'id' | 'en' | 'vi'>[], runs: Record<number, DailyTrade[]>[], controls: ControlDraws[]): DailyResult[] {
  const split = (rows: DailyTrade[]) => [rows.filter((t) => dayKey(t.openedAt) < examFrom), rows.filter((t) => dayKey(t.openedAt) >= examFrom)]
  const exams = runs.map((r) => split(r[1])[1])
  const srs = exams.map((e) => stats(e).sharpe)
  const mu = srs.reduce((a, b) => a + b, 0) / Math.max(1, srs.length)
  const v = srs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, srs.length - 1)
  return strategies.map((s, k) => {
    const [b, e] = split(runs[k][1])
    const exam = stats(e)
    const avgAt = (m: number) => stats(split(runs[k][m])[1]).avgRet
    const examAvgByCost = { x0: avgAt(0), x1: exam.avgRet, x2: avgAt(2) }
    const byYear: DailyResult['byYear'] = {}
    for (const y of [...new Set(runs[k][1].map((t) => new Date(t.openedAt).getUTCFullYear()))].sort()) {
      const st = stats(runs[k][1].filter((t) => new Date(t.openedAt).getUTCFullYear() === y))
      byYear[y] = { n: st.n, avgRet: st.avgRet }
    }
    const dsr = deflatedSharpe(e.map((t) => t.retPct), strategies.length, v)
    const book = stats(b)
    const cd = controls[k]
    const control = { book: mean(cd.book1), examX1: mean(cd.exam1), examX2: mean(cd.exam2) }
    const excess = { book: book.avgRet - control.book, examX1: examAvgByCost.x1 - control.examX1, examX2: examAvgByCost.x2 - control.examX2 }
    const p = { x1: cd.exam1.filter((x) => x >= examAvgByCost.x1).length / Math.max(1, cd.exam1.length), x2: cd.exam2.filter((x) => x >= examAvgByCost.x2).length / Math.max(1, cd.exam2.length) }
    const passed = excess.examX1 > 0 && excess.examX2 > 0 && p.x1 <= 0.05 && p.x2 <= 0.05 && exam.n >= 100 && dsr >= 0.95
    return { id: s.id, en: s.en, vi: s.vi, book, exam, examAvgByCost, byYear, control, excess, p, dsr, passed }
  })
}

/** Buy at the open of the first exam day, sell at the last close, one round trip of costs. Not a candidate. */
export function buyHold(bars: Candle[], examFrom: string, costs: Costs | null) {
  const i = bars.findIndex((b) => dayKey(b.time * 1000) >= examFrom)
  if (i < 0) return null
  const last = bars[bars.length - 1]
  return { from: dayKey(bars[i].time * 1000), to: dayKey(last.time * 1000), retPct: netRetPct(bars[i].open, last.close, costs, false), days: bars.length - i }
}
