/**
 * Atlas short lab (round 6): can Atlas make money on the SHORT side? Daily bars, paper only, lab only.
 * Atlas has only ever bought. A short is not a mirror image of a long:
 *  - the loss is not capped, so every idea here has a HARD stop above the entry (a gap through it fills at the open);
 *  - a borrow fee is paid for every day the stock is held short (1% a year for easy names, 8% a year for the
 *    14 high-volatility names, which are the ones that are hard to borrow; doubled in the 2x cost run);
 *  - the market drifts up, so a random short loses on its own. The pass rule therefore asks for an average
 *    trade above zero NET of costs and borrow (a real profit), AND a win over random shorts of the same names.
 *
 *  S1 Fade a spike: the close is up 7%+ on the previous close on 2x the 20-day average volume; short the next open,
 *     hold 5 days, stop +8%.
 *  S2 Break-down in a weak market: SPY closes below its 200-day average AND the name closes under its prior 20-day
 *     low; short the next open, hold 10 days, stop +8%.
 *  S3 Losers of the 12-1 momentum rank: each month short the 10 worst 12-1 month returns, hold until the next
 *     month's rebalance, stop +15%.
 *  S4 Overnight short of big losers: the close is down 3%+ on 2x volume; short that close, cover the next open.
 *     No stop is possible overnight (the gap risk is real and is in the numbers). The decision uses the close
 *     it trades at (slight look-ahead, same as the L4 overnight lead).
 *
 * Kronos "forecast strongly down" cannot be replayed: there is no history of its forecasts. The live Kronos
 * shadow log would have to gather that data first.
 *
 * Pure functions; scripts/replay-short.ts fetches the bars. Paper only; the live Atlas never reads this file.
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { scaleCosts } from './replayDaily'

/** Ideas tried in this round (S1-S4). Counted in TRIAL_LEDGER (shortRound6). */
export const SHORT_TRIALS = 4
export const SPIKE_PCT = 0.07
export const SPIKE_VOL = 2
export const SPIKE_HOLD = 5
export const SPIKE_STOP = 0.08
export const BREAK_HOLD = 10
export const BREAK_STOP = 0.08
export const BREAK_LOOKBACK = 20
export const REGIME_DAYS = 200
export const LOSER_N = 10
export const LOSER_STOP = 0.15
export const DROP_PCT = 0.03
export const DROP_VOL = 2
/** Borrow fee, per year, as a fraction of the position. */
export const BORROW_EASY = 0.01
export const BORROW_HARD = 0.08
export const TRADING_DAYS = 252

export const borrowRate = (hard: boolean) => (hard ? BORROW_HARD : BORROW_EASY)

/** A short's fills before costs. Bars are indexes into the symbol's own bar list. */
export interface ShortFill {
  entry: number
  exit: number
  /** Trading days the short is open (the borrow is paid for each). */
  days: number
  eBar: number
  xBar: number
  eKind: 'o' | 'c'
  xKind: 'o' | 'c'
  stopped: boolean
}

/**
 * Short at bar `eBar`'s open (or close), cover at bar `lastBar`'s close (or open). A stop `stopPct` above the entry
 * is checked on every later bar: a bar that OPENS at or above it covers at the open, a bar whose HIGH reaches it
 * covers at the stop price; the stop is checked before the exit of the same bar. Null when the bars do not reach.
 */
export function shortFill(
  bars: Candle[],
  eBar: number,
  eKind: 'o' | 'c',
  lastBar: number,
  xKind: 'o' | 'c',
  stopPct: number | null,
): ShortFill | null {
  if (eBar < 0 || lastBar >= bars.length || lastBar < eBar) return null
  const entry = eKind === 'o' ? bars[eBar].open : bars[eBar].close
  if (!(entry > 0)) return null
  const stop = stopPct != null ? entry * (1 + stopPct) : null
  const done = (exit: number, xBar: number, x: 'o' | 'c', stopped: boolean): ShortFill => ({
    entry, exit, eBar, xBar, eKind, xKind: x, stopped,
    days: xBar - eBar + (eKind === 'o' && x === 'c' ? 1 : 0),
  })
  for (let j = eKind === 'o' ? eBar : eBar + 1; j <= lastBar; j++) {
    const b = bars[j]
    if (!(b.open > 0) || !(b.close > 0)) return null
    if (stop != null && j > eBar && b.open >= stop) return done(b.open, j, 'o', true)
    if (j === lastBar && xKind === 'o') return done(b.open, j, 'o', false)
    if (stop != null && b.high >= stop) return done(stop, j, 'c', true)
    if (j === lastBar) return done(b.close, j, 'c', false)
  }
  return null
}

/** Net percent return of a short after costs and borrow, on the entry notional. `m` scales costs and borrow (1x, 2x). */
export function shortNet(f: Pick<ShortFill, 'entry' | 'exit' | 'days'>, c: Costs | null, hard: boolean, m: number): number {
  const cc = scaleCosts(c, m)
  const slip = cc ? (cc.spreadBps / 2 + cc.slippageBps) / 1e4 : 0
  const fee = cc ? cc.feeBps / 1e4 : 0
  const gross = ((f.entry * (1 - slip) * (1 - fee) - f.exit * (1 + slip) * (1 + fee)) / f.entry) * 100
  return gross - borrowRate(hard) * m * (f.days / TRADING_DAYS) * 100
}

/** Bars i where the close beats the previous close by `pct` or more on at least `vol` x the prior 20-day average volume. */
export function spikeUpBars(bars: Candle[], pct = SPIKE_PCT, vol = SPIKE_VOL): number[] {
  return volumeMoveBars(bars, (c, p) => c >= p * (1 + pct), vol)
}

/** Bars i where the close is down `pct` or more on at least `vol` x the prior 20-day average volume. */
export function dropBars(bars: Candle[], pct = DROP_PCT, vol = DROP_VOL): number[] {
  return volumeMoveBars(bars, (c, p) => c <= p * (1 - pct), vol)
}

function volumeMoveBars(bars: Candle[], ok: (close: number, prev: number) => boolean, vol: number): number[] {
  const out: number[] = []
  for (let i = 21; i < bars.length; i++) {
    let v = 0
    for (let k = i - 20; k < i; k++) v += bars[k].volume
    if (v > 0 && bars[i - 1].close > 0 && ok(bars[i].close, bars[i - 1].close) && bars[i].volume >= vol * (v / 20)) out.push(i)
  }
  return out
}

/** Bars i where the close is below the lowest close of the `n` bars before it (a new n-day closing low). */
export function newLowBars(bars: Candle[], n = BREAK_LOOKBACK): number[] {
  const out: number[] = []
  for (let i = n; i < bars.length; i++) {
    let lo = Infinity
    for (let k = i - n; k < i; k++) lo = Math.min(lo, bars[k].close)
    if (bars[i].close < lo) out.push(i)
  }
  return out
}

/** True for each day (by YYYY-MM-DD) on which SPY closes below its n-day simple average. */
export function weakMarketDays(days: string[], spyClose: number[], n = REGIME_DAYS): Set<string> {
  const out = new Set<string>()
  let sum = 0
  for (let i = 0; i < spyClose.length; i++) {
    sum += spyClose[i]
    if (i >= n) sum -= spyClose[i - n]
    if (i >= n - 1 && spyClose[i] < sum / n) out.add(days[i])
  }
  return out
}

/** The `n` names with the WORST 12-1 return among `elig` (ties keep the lower index). */
export function worstN(ret: number[], elig: number[], n: number): number[] {
  return [...elig].sort((x, y) => ret[x] - ret[y] || x - y).slice(0, n)
}

/**
 * A daily return stream (fractions) of a set of trades, spread evenly over the days each is open, averaged over the
 * trades open that day (0 on idle days). `idx` maps a trading day to its position in `days`; a trade covers the days
 * from its first day (the entry day, or the day after a close entry) to its exit day.
 */
export function tradeStream(
  days: string[],
  from: number,
  trades: { entryDay: string; exitDay: string; eKind: 'o' | 'c'; retPct: number }[],
): number[] {
  const idx = new Map(days.map((d, i) => [d, i]))
  const sum = new Array<number>(days.length).fill(0)
  const cnt = new Array<number>(days.length).fill(0)
  for (const t of trades) {
    const a = idx.get(t.entryDay)
    const b = idx.get(t.exitDay)
    if (a == null || b == null) continue
    const s = t.eKind === 'c' ? a + 1 : a
    const e = Math.max(s, b)
    const share = t.retPct / 100 / (e - s + 1)
    for (let d = s; d <= e && d < days.length; d++) {
      sum[d] += share
      cnt[d]++
    }
  }
  return days.slice(from).map((_, k) => (cnt[from + k] ? sum[from + k] / cnt[from + k] : 0))
}
