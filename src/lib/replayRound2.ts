/**
 * Atlas daily lab, round 2: five follow-up experiments on round 1's one survivor (D1, short-term reversal).
 * Pure functions; scripts/replay-daily.ts fetches the bars and writes the `round2` section of replay-daily.json.
 * Same rules as round 1: a signal uses data up to day t's close, the fill is day t+1's open, same costs.
 *
 *  E1 VIX regime gate (Nagel 2012: reversal pays more when volatility is high): trade D1 only on signal days when
 *     the VIX close is >= its trailing 252-day median (A) or >= 25 (B). Both thresholds are fixed in advance, not tuned.
 *  E2 Market-neutral D1: each trade's return minus a short SPY hedge (its move plus its costs) over the same dates.
 *  E3 ETF time-series momentum (Moskowitz-Ooi-Pedersen 2012), monthly, 12-1 month signal, vs SPY and 60/40.
 *  E4 Volatility-targeted sizing (Moreira & Muir 2017): trade size = target vol / trailing 20-day SPY vol, cap 2x.
 *  E5 Adding to positions: a second equal unit at the next open once the trade is 1 ATR up (pyramid) or down.
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { dayKey } from './practice'
import type { DailySignal, DailyTrade, Series } from './replayDaily'
import { netRetPct } from './replayStrategies'

/** How many strategy variants round 1 and round 2 tried in all: D1-D4, E1 A/B, E2, E3 equal/inverse-vol, E4, E5 x4. */
export const ROUND2_TRIALS = 14

// ---- E1: VIX gate ----

export interface VixDay {
  close: number
  /** Median of the last 252 closes including today (NaN until 252 exist). */
  med: number
}

/** VIX close and trailing median per day; each day uses only that day and the days before it. */
export function vixDays(bars: Candle[], n = 252): Map<string, VixDay> {
  const out = new Map<string, VixDay>()
  for (let i = 0; i < bars.length; i++) {
    let med = NaN
    if (i >= n - 1) {
      const w = bars.slice(i - n + 1, i + 1).map((b) => b.close).sort((a, b) => a - b)
      med = (w[(n - 1) >> 1] + w[n >> 1]) / 2
    }
    out.set(dayKey(bars[i].time * 1000), { close: bars[i].close, med })
  }
  return out
}

/** A: VIX close >= its own trailing 252-day median. B: VIX close >= 25. A missing day is closed. */
export const vixGate = (m: Map<string, VixDay>, kind: 'A' | 'B') => (day: string): boolean => {
  const v = m.get(day)
  return !!v && v.close >= (kind === 'A' ? v.med : 25)
}

export const gateSignals = (u: Series[], sigs: DailySignal[], ok: (day: string) => boolean): DailySignal[] =>
  sigs.filter((s) => ok(dayKey(u[s.sym].bars[s.i].time * 1000)))

// ---- E2: market-neutral ----

/** What a short SPY hedge over a trade's dates costs the trade, percent: SPY's move from the entry day's open to the
 *  exit day's close PLUS the round trip of costs `c` the hedge pays (no borrow fee). Subtract it from the trade's
 *  own net return. Exact for time exits (D1); 0 when SPY lacks either date. */
export function spyLeg(spy: Candle[]): (t: DailyTrade, c: Costs | null) => number {
  const at = new Map(spy.map((b, k) => [dayKey(b.time * 1000), k]))
  return (t, c) => {
    const a = at.get(dayKey(t.openedAt))
    const z = at.get(dayKey(t.exitAt ?? 0))
    if (a == null || z == null || z < a) return 0
    const gross = netRetPct(spy[a].open, spy[z].close, null, false)
    return gross + (gross - netRetPct(spy[a].open, spy[z].close, c, false))
  }
}

// ---- performance of a return series ----

export interface Perf {
  n: number
  /** Percent. */
  cagr: number
  vol: number
  /** Annualised mean / sd, cash at 0%. */
  sharpe: number
  /** Percent, negative. */
  maxDD: number
  /** Worst calendar year (compounded, partial years included), percent. */
  worstYear: number
}

/** `rets` are fractions per period, `years[k]` the calendar year of period k, `ppy` periods per year. */
export function perf(rets: number[], years: number[], ppy: number): Perf {
  const n = rets.length
  if (!n) return { n: 0, cagr: 0, vol: 0, sharpe: 0, maxDD: 0, worstYear: 0 }
  const mean = rets.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1))
  let eq = 1
  let peak = 1
  let dd = 0
  const yr = new Map<number, number>()
  rets.forEach((r, k) => {
    eq *= 1 + r
    peak = Math.max(peak, eq)
    dd = Math.min(dd, eq / peak - 1)
    yr.set(years[k], (yr.get(years[k]) ?? 1) * (1 + r))
  })
  return { n, cagr: (eq ** (ppy / n) - 1) * 100, vol: sd * Math.sqrt(ppy) * 100, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(ppy) : 0, maxDD: dd * 100, worstYear: (Math.min(...yr.values()) - 1) * 100 }
}

/** One side of a trade costs this fraction: half the spread, slippage and the fee. */
export const sideCost = (c: Costs | null) => (c ? (c.spreadBps / 2 + c.slippageBps + c.feeBps) / 1e4 : 0)

// ---- E3: ETF time-series momentum ----

export const ETF_UNIVERSE = ['SPY', 'QQQ', 'IWM', 'EFA', 'EEM', 'TLT', 'IEF', 'LQD', 'HYG', 'GLD', 'SLV', 'DBC', 'USO', 'VNQ', 'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLU', 'XLB']

/** Index of each month's last trading day that has a next bar (the signal days). */
export function monthEnds(days: string[]): number[] {
  const out: number[] = []
  for (let i = 0; i + 1 < days.length; i++) if (days[i].slice(0, 7) !== days[i + 1].slice(0, 7)) out.push(i)
  return out
}

/** 12-1 month signal at month-end k: the return from month-end k-12 to month-end k-1 (the last month is skipped)
 *  is positive. `c` holds the asset's closes (NaN before it existed), `ends` the month-end bar indices. */
export function tsmomOn(c: number[], ends: number[], k: number): boolean {
  return k >= 12 && c[ends[k - 1]] / c[ends[k - 12]] - 1 > 0
}

/** Target weights per rebalance k = 12.. (row p = k-12). An ETF is held only when its signal is on; the weight is
 *  1/N (equal) or (1/vol)/sum(1/vol) (inverse volatility, 63-day daily vol) over the N ETFs that existed 12 months
 *  ago, so the rest sits in cash. Uses closes up to the month-end only. */
export function tsmomWeights(close: number[][], ends: number[], mode: 'eq' | 'ivol', volWin = 63): number[][] {
  const out: number[][] = []
  for (let k = 12; k < ends.length; k++) {
    const e = ends[k]
    const iv = close.map((c) => {
      if (![c[e], c[ends[k - 1]], c[ends[k - 12]]].every(Number.isFinite)) return NaN
      if (mode === 'eq') return 1
      const r: number[] = []
      for (let j = e - volWin + 1; j <= e; j++) r.push(c[j] / c[j - 1] - 1)
      if (!r.every(Number.isFinite)) return NaN
      const m = r.reduce((a, b) => a + b, 0) / r.length
      const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1))
      return sd > 0 ? 1 / sd : NaN
    })
    const tot = iv.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
    out.push(close.map((c, a) => (Number.isFinite(iv[a]) && tsmomOn(c, ends, k) ? iv[a] / tot : 0)))
  }
  return out
}

/** Price of each asset at each rebalance fill (the next bar's open) plus the last close: columns 0..P. */
export function boundaryPx(open: number[][], close: number[][], ends: number[]): number[][] {
  return open.map((o, a) => [...ends.slice(12).map((e) => o[e + 1]), close[a][close[a].length - 1]])
}

/** Monthly net returns of a portfolio rebalanced to `w[p]` at boundary p and held to boundary p+1; each side of
 *  every rebalance trade pays `side` (turnover measured against the weights after the month's drift). */
export function portfolioMonthly(px: number[][], w: number[][], side: number): number[] {
  const out: number[] = []
  let prev = px.map(() => 0)
  w.forEach((row, p) => {
    const r = row.map((x, a) => (x > 0 && Number.isFinite(px[a][p + 1] / px[a][p]) ? px[a][p + 1] / px[a][p] - 1 : 0))
    const turn = row.reduce((s, x, a) => s + Math.abs(x - prev[a]), 0)
    const gross = row.reduce((s, x, a) => s + x * r[a], 0)
    out.push(gross - turn * side)
    prev = row.map((x, a) => (x * (1 + r[a])) / (1 + gross))
  })
  return out
}

// ---- daily portfolio from trade paths (E4, E5) ----

/** Daily returns (fractions) of one position: bought at `fromPx` on bar `fromBar`, marked at each close, out at
 *  `toPx` on bar `toBar` (a close for time exits, an open for rule exits). The exit day absorbs the costs so the
 *  days compound to `net` (a fraction). Returns [day, return] pairs. */
export function legStream(bars: Candle[], fromBar: number, fromPx: number, toBar: number, toPx: number, net: number): [string, number][] {
  const out: [string, number][] = []
  let prev = fromPx
  let growth = 1
  for (let j = fromBar; j <= toBar; j++) {
    const mark = j === toBar ? toPx : bars[j].close
    const r = mark / prev - 1
    if (j < toBar) growth *= 1 + r
    out.push([dayKey(bars[j].time * 1000), r])
    prev = mark
  }
  out[out.length - 1][1] = (1 + net) / growth - 1 // the exit day carries the costs, so the days compound to `net`
  return out
}

/** Trailing realized volatility of closes, annualised; NaN until `n` returns exist. Row i uses closes up to i. */
export function realizedVol(close: number[], n = 20): number[] {
  const r = close.map((c, i) => (i ? c / close[i - 1] - 1 : NaN))
  return close.map((_, i) => {
    if (i < n) return NaN
    const w = r.slice(i - n + 1, i + 1)
    const m = w.reduce((a, b) => a + b, 0) / n
    return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) * Math.sqrt(252)
  })
}

/** Size multiplier: target vol over realized vol, at most `cap`; 1 when the vol is not known. */
export const volScale = (rv: number, target: number, cap = 2) => (rv > 0 ? Math.min(cap, target / rv) : 1)

/** Add a position's daily path, times `size`, into the per-day totals. */
export function addStream(into: Map<string, number>, path: [string, number][], size: number) {
  for (const [d, r] of path) into.set(d, (into.get(d) ?? 0) + r * size)
}

/** Daily portfolio return from the per-day totals: each unit of size is 1/k0 of equity. */
export const dailyReturns = (totals: Map<string, number>, days: string[], k0: number) => days.map((d) => (totals.get(d) ?? 0) / k0)

// ---- E5: adding to positions ----

export type AddMode = 'pyramid' | 'down'

/** Bar whose OPEN a second unit is bought at, or -1. After the close of bar j (entry bar onward) the trade is up
 *  (pyramid) or down (down) by at least `atrAbs`; the buy is bar j+1's open, which must come before the exit fill. */
export function addBar(bars: Candle[], t: DailyTrade, atrAbs: number, mode: AddMode): number {
  const last = t.exitReason === 'rule' ? t.exitBar! - 2 : t.exitBar! - 1 // a rule exit fills at an open: no add on that bar
  for (let j = t.entryBar!; j <= last; j++) {
    const move = (mode === 'pyramid' ? 1 : -1) * (bars[j].close - t.entry!)
    if (move >= atrAbs) return j + 1
  }
  return -1
}

/** Result of a trade with one optional second unit, in percent of one unit; capital deployed = 1 or 2 units. */
export function unitTrade(bars: Candle[], t: DailyTrade, b: number, costs: Costs | null) {
  const r2 = b >= 0 ? netRetPct(bars[b].open, t.exit!, costs, !!t.limit) : 0
  return { r1: t.retPct, r2, pnl: t.retPct + r2, cap: b >= 0 ? 2 : 1 }
}
