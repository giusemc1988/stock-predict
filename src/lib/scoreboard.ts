import { PRACTICE_START, type Baseline, type PracticeState } from './practice'
import type { Candle } from '../types'

/** What the practice account is worth beyond closed trades, and how it compares with just holding SPY. */
export function scoreboardFigures(s: PracticeState, priceOf: (symbol: string) => number) {
  let unrealized = 0
  let unpriced = 0
  for (const p of s.open) {
    const px = s.marks?.[p.symbol] ?? priceOf(p.symbol)
    if (px > 0) unrealized += (px - p.entry) * p.qty
    else unpriced++
  }
  const total = s.realized + unrealized
  const totalPct = (total / PRACTICE_START) * 100
  const b = s.baseline
  const spyPct = b && b.startPrice > 0 ? (b.lastPrice / b.startPrice - 1) * 100 : null
  return { realized: s.realized, unrealized, total, totalPct, openCount: s.open.length, unpriced, spyPct, vsSpyPct: spyPct == null ? null : totalPct - spyPct, spyAt: b?.lastAt ?? null }
}

/**
 * SPY's price at the account's start and now. The start is the first bar at or after `startAt` and is
 * kept once set; with no bars (a failed fetch) the old baseline stays, and with no bar that old there is none.
 */
export function makeBaseline(prev: Baseline | undefined, bars: Candle[], startAt: number, now: number): Baseline | undefined {
  const last = bars[bars.length - 1]
  if (!last) return prev
  if (prev) return { ...prev, lastPrice: last.close, lastAt: now }
  const first = bars.find((b) => b.time * 1000 >= startAt)
  if (!first) return undefined
  return { symbol: 'SPY', startPrice: first.close, startAt: first.time * 1000, lastPrice: last.close, lastAt: now }
}
