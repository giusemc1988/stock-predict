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
  /** Leave when the close is above the 5-day SMA (filled at the next open). */
  sma5Exit?: boolean
}

export interface DailyTrade {
  symbol: string
  openedAt: number
  retPct: number
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

/** Play one signal forward on `bars`. Returns null when there is no next bar to enter on. */
export function simulateDaily(bars: Candle[], sig: Pick<DailySignal, 'i' | 'hold' | 'stopDist' | 'targetDist' | 'sma5Exit'>, costs: Costs | null, symbol = ''): DailyTrade | null {
  const e = sig.i + 1
  if (e >= bars.length) return null
  const entry = bars[e].open
  const stop = sig.stopDist != null ? entry - sig.stopDist : null
  const target = sig.targetDist != null ? entry + sig.targetDist : null
  const last = Math.min(e + sig.hold - 1, bars.length - 1)
  const s5 = sig.sma5Exit ? sma(bars, 5) : []
  const done = (price: number, reason: DailyTrade['exitReason'], freeFrom: number, limit = false): DailyTrade => ({
    symbol,
    openedAt: bars[e].time * 1000,
    retPct: netRetPct(entry, price, costs, limit),
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
      if (c >= hi * 0.98 && c > m200[i]) out.push({ sym, i, hold: 10, stopDist: 2 * a[i], targetDist: null })
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
      if (b.open >= s.bars[i - 1].close * 1.04 && v > 0 && b.volume >= 2 * (v / 20)) out.push({ sym, i, hold: 20, stopDist: 2 * a[i], targetDist: null })
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
  dsr: number
  passed: boolean
}

/** Judge each strategy on the exam (the newest third): average > 0 at 1x AND 2x costs, at least 100 trades and a
 *  Deflated Sharpe >= 0.95 counting every strategy tried here. `runs[k][m]` = trades of strategy k at cost multiplier m. */
export function evalDaily(examFrom: string, strategies: Pick<DailyStrategy, 'id' | 'en' | 'vi'>[], runs: Record<number, DailyTrade[]>[]): DailyResult[] {
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
    const passed = examAvgByCost.x1 > 0 && examAvgByCost.x2 > 0 && exam.n >= 100 && dsr >= 0.95
    return { id: s.id, en: s.en, vi: s.vi, book: stats(b), exam, examAvgByCost, byYear, dsr, passed }
  })
}

/** Buy at the open of the first exam day, sell at the last close, one round trip of costs. Not a candidate. */
export function buyHold(bars: Candle[], examFrom: string, costs: Costs | null) {
  const i = bars.findIndex((b) => dayKey(b.time * 1000) >= examFrom)
  if (i < 0) return null
  const last = bars[bars.length - 1]
  return { from: dayKey(bars[i].time * 1000), to: dayKey(last.time * 1000), retPct: netRetPct(bars[i].open, last.close, costs, false), days: bars.length - i }
}
