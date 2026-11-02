/** Kronos forecast helpers for the Hub's Atlas card (KronosChart, AtlasCouncil). */

export interface KronosForecast {
  symbol: string
  lastClose: number
  pred: Record<string, number>
  /** every predicted close, +1 to +5 (runs from 2026-10-23 on) */
  path?: number[]
  /** the bar the forecast starts from, YYYY-MM-DD */
  asOf?: string
}

/**
 * The forecasts worth showing: the newest one per symbol, and only symbols still in the latest run.
 * The log keeps every forecast ever made, so a symbol dropped from the list would otherwise stay on the
 * card for good (its last forecast is not removed, it just stops being renewed).
 */
export function currentForecasts<T extends { symbol: string; asOf?: string }>(all: T[], days = 4): T[] {
  const latest = new Map<string, T>()
  for (const f of all) latest.set(f.symbol, f)
  const t = (f: T) => (f.asOf ? Date.parse(f.asOf) : NaN)
  const newest = Math.max(0, ...[...latest.values()].map(t).filter((x) => !Number.isNaN(x)))
  return [...latest.values()].filter((f) => Number.isNaN(t(f)) || t(f) >= newest - days * 86_400_000)
}

/** "ETH/USDT", "ETH-USD" and "eth" are one coin; stocks stay as they are. */
export const baseSymbol = (s: string) => s.replace(/(\/USDT|-USD)$/i, '').toUpperCase()

/** Kronos's 5-day forecast move in percent, by base symbol, for the symbols it currently covers. */
export function kronosPct5(all: KronosForecast[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of currentForecasts(all)) if (f.pred['5'] && f.lastClose) out[baseSymbol(f.symbol)] = (f.pred['5'] / f.lastClose - 1) * 100
  return out
}

/** The 7 voices a Kronos forecast passes before it is drawn: Atlas's six agents, then Kronos itself. */
export const COUNCIL_IDS = ['scanner', 'flow', 'news', 'signals', 'learner', 'risk', 'kronos'] as const
export type CouncilId = (typeof COUNCIL_IDS)[number]

/** The 5 forecast closes: Kronos's own path when the run saved it, else a line through +1 and +5. */
export function forecastPath(f: KronosForecast): number[] {
  if (f.path?.length === 5) return f.path
  const p1 = f.pred['1'] ?? f.lastClose
  const p5 = f.pred['5'] ?? p1
  return [p1, ...[2, 3, 4, 5].map((d) => p1 + ((p5 - p1) * (d - 1)) / 4)]
}

/** Daily volatility from closes (standard deviation of log returns); 1.5% when history is short. */
export function dailyVol(closes: number[]): number {
  if (closes.length < 6) return 0.015
  const r = closes.slice(1).map((c, i) => Math.log(c / closes[i]))
  const m = r.reduce((a, b) => a + b, 0) / r.length
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length)
}
