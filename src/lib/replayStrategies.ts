/**
 * Strategy variants for the Atlas replay lab. Each one turns 15-minute bars into paper trades with the
 * same costs Atlas pays (spread + slippage on market fills, fee both sides, a target fills at its price),
 * so they can be compared with Atlas on the same book/exam split.
 *
 *  S1 Atlas entries, held until stop, target or the close (no 12-bar time exit, no SELL-signal exit)
 *  S2 Atlas entries with stop 1.5 ATR and target 3 ATR, held until the close
 *  S3 Last-half-hour momentum (Gao, Han, Li, Zhou, JFE 2018): if a stock is up from yesterday's close at
 *     10:00 ET, buy at 15:30 and sell at the 16:00 close. Long only.
 *  S4 Intraday bounce: a stock down 2%+ today, RSI(14) under 35 on the last bar, then a green bar
 *     (10:00-14:30 ET): buy, stop below today's low, target 1.5 ATR, out by the close. One a day per stock.
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { dayKey } from './practice'

export interface Fill {
  i: number
  price: number
  stop: number
  target: number
}

export interface SimTrade {
  openedAt: number
  retPct: number
  exitReason: 'stop' | 'target' | 'close' | 'time'
}

const BAR_MS = 15 * 60_000
const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false })
/** Minutes after midnight ET at the START of each bar. */
export function etMinutes(bars: Candle[]): number[] {
  return bars.map((b) => {
    const [h, m] = ET.format(new Date(b.time * 1000)).split(':').map(Number)
    return (h % 24) * 60 + m
  })
}

export function atr(bars: Candle[], n = 14): number[] {
  const out: number[] = []
  let a = 0
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const tr = i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : b.high - b.low
    a = i < n ? (a * i + tr) / (i + 1) : (a * (n - 1) + tr) / n
    out.push(a)
  }
  return out
}

export function rsi(bars: Candle[], n = 14): number[] {
  const out: number[] = []
  let up = 0
  let dn = 0
  for (let i = 0; i < bars.length; i++) {
    const d = i ? bars[i].close - bars[i - 1].close : 0
    const u = Math.max(d, 0)
    const v = Math.max(-d, 0)
    if (i <= n) {
      up = (up * Math.max(i - 1, 0) + u) / Math.max(i, 1)
      dn = (dn * Math.max(i - 1, 0) + v) / Math.max(i, 1)
    } else {
      up = (up * (n - 1) + u) / n
      dn = (dn * (n - 1) + v) / n
    }
    out.push(dn === 0 ? 100 : 100 - 100 / (1 + up / dn))
  }
  return out
}

/** Return after costs, percent of the money put in. */
export function netRetPct(entry: number, exit: number, c: Costs | null, limitExit: boolean): number {
  const slip = c ? (c.spreadBps / 2 + c.slippageBps) / 1e4 : 0
  const fee = c ? c.feeBps / 1e4 : 0
  const buy = entry * (1 + slip)
  const sell = limitExit ? exit : exit * (1 - slip)
  return ((sell * (1 - fee) - buy * (1 + fee)) / buy) * 100
}

/**
 * Walk forward from the bar after entry: stop (gap-through fills at the open), then target, else out at the
 * open of the first bar that ends after `dayEnd` (or at the last bar's close), or after `maxBars` bars.
 */
export function simulateExit(bars: Candle[], f: Fill, dayEnd: number, c: Costs | null, maxBars?: number): SimTrade {
  const openedAt = (bars[f.i].time * 1000) + BAR_MS
  for (let j = f.i + 1; j < bars.length; j++) {
    const b = bars[j]
    if (b.time * 1000 + BAR_MS > dayEnd) return { openedAt, retPct: netRetPct(f.price, b.open, c, false), exitReason: 'close' }
    if (b.low <= f.stop) return { openedAt, retPct: netRetPct(f.price, Math.min(b.open, f.stop), c, false), exitReason: 'stop' }
    if (b.high >= f.target) return { openedAt, retPct: netRetPct(f.price, f.target, c, true), exitReason: 'target' }
    if (maxBars && j - f.i >= maxBars) return { openedAt, retPct: netRetPct(f.price, b.close, c, false), exitReason: 'time' }
  }
  const last = bars[bars.length - 1]
  return { openedAt, retPct: netRetPct(f.price, last.close, c, false), exitReason: 'close' }
}

export interface StrategyInput {
  bars: Candle[]
  asset: 'stock' | 'crypto'
  /** Bars where Atlas opened a trade, with its plan. */
  atlas: Fill[]
  costs: Costs | null
  dayEnd: (ms: number) => number
}

export function s1HoldToClose(x: StrategyInput): SimTrade[] {
  return x.atlas.map((f) => simulateExit(x.bars, f, x.dayEnd(x.bars[f.i].time * 1000 + BAR_MS), x.costs))
}

export function s2AtrExits(x: StrategyInput): SimTrade[] {
  const a = atr(x.bars)
  return x.atlas.map((f) => simulateExit(x.bars, { ...f, stop: f.price - 1.5 * a[f.i], target: f.price + 3 * a[f.i] }, x.dayEnd(x.bars[f.i].time * 1000 + BAR_MS), x.costs))
}

export function s3LastHalfHour(x: StrategyInput): SimTrade[] {
  if (x.asset !== 'stock') return []
  const mins = etMinutes(x.bars)
  const days = x.bars.map((b) => dayKey(b.time * 1000))
  const out: SimTrade[] = []
  let prevClose: number | null = null
  let i = 0
  while (i < x.bars.length) {
    let j = i
    while (j < x.bars.length && days[j] === days[i]) j++
    // bars of one day: [i, j)
    const idx = (m: number) => {
      for (let k = i; k < j; k++) if (mins[k] === m) return k
      return -1
    }
    const k945 = idx(9 * 60 + 45)
    const k1515 = idx(15 * 60 + 15)
    const k1545 = idx(15 * 60 + 45)
    if (prevClose && k945 >= 0 && k1515 >= 0 && k1545 >= 0 && x.bars[k945].close > prevClose) {
      out.push({ openedAt: (x.bars[k1515].time * 1000) + BAR_MS, retPct: netRetPct(x.bars[k1515].close, x.bars[k1545].close, x.costs, false), exitReason: 'close' })
    }
    prevClose = x.bars[j - 1].close
    i = j
  }
  return out
}

export function s4Bounce(x: StrategyInput): SimTrade[] {
  if (x.asset !== 'stock') return []
  const mins = etMinutes(x.bars)
  const a = atr(x.bars)
  const r = rsi(x.bars)
  const out: SimTrade[] = []
  let day = ''
  let prevClose: number | null = null
  let lastClose: number | null = null
  let low = Infinity
  let traded = false
  for (let k = 1; k < x.bars.length; k++) {
    const b = x.bars[k]
    const d = dayKey(b.time * 1000)
    if (d !== day) {
      prevClose = lastClose
      day = d
      low = Infinity
      traded = false
    }
    low = Math.min(low, b.low)
    lastClose = b.close
    // signal on the close of a bar that starts between 09:45 and 14:15 (decided by 14:30)
    if (traded || prevClose == null || mins[k] < 9 * 60 + 45 || mins[k] > 14 * 60 + 15) continue
    const down = (b.close / prevClose - 1) * 100
    const prev = x.bars[k - 1]
    if (down <= -2 && r[k - 1] < 35 && b.close > b.open && prev.close < prev.open) {
      traded = true
      const f = { i: k, price: b.close, stop: low - 0.2 * a[k], target: b.close + 1.5 * a[k] }
      out.push(simulateExit(x.bars, f, x.dayEnd(b.time * 1000 + BAR_MS), x.costs))
    }
  }
  return out
}

export const STRATEGIES = [
  { id: 'S1', vi: 'Tín hiệu Atlas, giữ đến cuối phiên (bỏ thoát sau 12 nến)', run: s1HoldToClose },
  { id: 'S2', vi: 'Tín hiệu Atlas, stop 1.5 ATR / chốt lời 3 ATR', run: s2AtrExits },
  { id: 'S3', vi: 'Động lượng nửa giờ cuối (Gao et al. 2018)', run: s3LastHalfHour },
  { id: 'S4', vi: 'Mua bật lại sau khi giảm ≥2% trong ngày', run: s4Bounce },
] as const
