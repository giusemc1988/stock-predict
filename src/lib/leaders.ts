/**
 * Atlas "Leaders" funnel, stage 1 (v2.0.13): from the whole liquid US market (about 3,300 names after Atlas's own
 * entry filters) pick about 100 relative-strength leaders every night. One TradingView screener call gives every
 * column used here (scripts/tv-leaders.py); this file only ranks them. Paper only, nothing here places an order.
 *
 *  List A (Minervini-style leaders): price > SMA50 > SMA150 > SMA200, at least 30% above the 52-week low,
 *    within 25% of the 52-week high, and relative strength (RS) in the top 10% of the universe.
 *  List B (Qullamaggie-style movers): up 25% in 1 month, or 50% in 3 months, or 150% in 6 months, and above SMA50.
 *  RS = 0.4 x 3-month + 0.2 x 6-month + 0.2 x 1-year + 0.2 x 1-month performance, ranked as a percentile 0-100.
 *  Sector strength: median 3-month performance per sector; the 3 strongest are flagged (a flag, not a filter yet).
 * The numbers are starting points taken from public descriptions of the methods; they are tuned on paper, not official.
 */
export interface TvRow {
  symbol: string
  name?: string
  close: number
  marketCap: number
  avgVol30: number
  sector: string | null
  p1m: number | null
  p3m: number | null
  p6m: number | null
  py: number | null
  sma50: number | null
  sma150: number | null
  sma200: number | null
  high52: number | null
  low52: number | null
  rvol: number | null
}

export interface Leader {
  symbol: string
  price: number
  rs: number
  p1m: number
  p3m: number
  p6m: number
  py: number | null
  sector: string | null
  inTopSector: boolean
  /** 'A' trend-template leader, 'B' big mover. */
  tags: ('A' | 'B')[]
  /** % below the 52-week high. */
  offHigh: number
  rvol: number | null
}

export interface SectorStrength {
  sector: string
  median3m: number
  n: number
}

export interface LeadersReport {
  source: 'tradingview-screener'
  generated: string
  universe: number
  listA: number
  listB: number
  topSectors: SectorStrength[]
  leaders: Leader[]
}

export const MIN_PRICE = 5
export const MIN_CAP = 300e6
/** Same liquidity floor as Atlas's entry filter ($26M traded per day). */
export const MIN_DOLLAR_VOL = 26e6
export const RS_MIN = 90
export const LEADERS_TOP = 100
export const TOP_SECTORS = 3

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Atlas's entry filters: a real, liquid name with the numbers this funnel needs. */
export function inUniverse(r: TvRow): boolean {
  return (
    /^[A-Z]{1,5}$/.test(r.symbol) &&
    num(r.close) && r.close >= MIN_PRICE &&
    num(r.marketCap) && r.marketCap >= MIN_CAP &&
    num(r.avgVol30) && r.avgVol30 * r.close >= MIN_DOLLAR_VOL &&
    num(r.p1m) && num(r.p3m) && num(r.p6m)
  )
}

export function rsScore(r: Pick<TvRow, 'p1m' | 'p3m' | 'p6m' | 'py'>): number {
  // a name under a year old has no 1-year number: use its 6-month number so it is not punished for being new
  return 0.4 * (r.p3m ?? 0) + 0.2 * (r.p6m ?? 0) + 0.2 * (r.py ?? r.p6m ?? 0) + 0.2 * (r.p1m ?? 0)
}

/** Percentile 0-100 of each score among all scores (ties share the lower rank). */
export function percentiles(scores: number[]): number[] {
  const sorted = [...scores].sort((a, b) => a - b)
  const n = sorted.length
  return scores.map((s) => {
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] < s) lo = mid + 1
      else hi = mid
    }
    return n > 1 ? (100 * lo) / (n - 1) : 100
  })
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function sectorStrength(rows: TvRow[], top = TOP_SECTORS): SectorStrength[] {
  const by = new Map<string, number[]>()
  for (const r of rows) if (r.sector && num(r.p3m)) (by.get(r.sector) ?? by.set(r.sector, []).get(r.sector)!).push(r.p3m)
  return [...by.entries()]
    .filter(([, v]) => v.length >= 10)
    .map(([sector, v]) => ({ sector, median3m: Math.round(median(v) * 10) / 10, n: v.length }))
    .sort((a, b) => b.median3m - a.median3m)
    .slice(0, top)
}

export function trendTemplate(r: TvRow): boolean {
  return (
    num(r.sma50) && num(r.sma150) && num(r.sma200) && num(r.high52) && num(r.low52) &&
    r.close > r.sma50 && r.sma50 > r.sma150 && r.sma150 > r.sma200 &&
    r.close >= 1.3 * r.low52 && r.close >= 0.75 * r.high52
  )
}

export function bigMover(r: TvRow): boolean {
  return num(r.sma50) && r.close > r.sma50 && ((r.p1m ?? 0) >= 25 || (r.p3m ?? 0) >= 50 || (r.p6m ?? 0) >= 150)
}

const r1 = (x: number) => Math.round(x * 10) / 10

export function rankLeaders(raw: TvRow[], generated: string, top = LEADERS_TOP): LeadersReport {
  const rows = raw.filter(inUniverse)
  const pct = percentiles(rows.map(rsScore))
  const sectors = sectorStrength(rows)
  const hot = new Set(sectors.map((s) => s.sector))
  const out: Leader[] = []
  let listA = 0
  let listB = 0
  rows.forEach((r, i) => {
    const tags: ('A' | 'B')[] = []
    if (pct[i] >= RS_MIN && trendTemplate(r)) tags.push('A')
    if (bigMover(r)) tags.push('B')
    if (tags.includes('A')) listA++
    if (tags.includes('B')) listB++
    if (!tags.length) return
    out.push({
      symbol: r.symbol,
      price: Math.round(r.close * 100) / 100,
      rs: Math.round(pct[i]),
      p1m: r1(r.p1m ?? 0),
      p3m: r1(r.p3m ?? 0),
      p6m: r1(r.p6m ?? 0),
      py: num(r.py) ? r1(r.py) : null,
      sector: r.sector,
      inTopSector: !!r.sector && hot.has(r.sector),
      tags,
      offHigh: num(r.high52) && r.high52 > 0 ? r1((100 * (r.high52 - r.close)) / r.high52) : 0,
      rvol: num(r.rvol) ? Math.round(r.rvol * 100) / 100 : null,
    })
  })
  // best first: higher RS, then both lists, then closer to the high
  out.sort((a, b) => b.rs - a.rs || b.tags.length - a.tags.length || a.offHigh - b.offHigh || a.symbol.localeCompare(b.symbol))
  return { source: 'tradingview-screener', generated, universe: rows.length, listA, listB, topSectors: sectors, leaders: out.slice(0, top) }
}

/** The saved file, or null when it is missing or broken (the card then says so instead of showing nothing). */
export function parseLeaders(raw: unknown): LeadersReport | null {
  const f = raw as Partial<LeadersReport> | null
  if (!f || typeof f.generated !== 'string' || !Array.isArray(f.leaders) || typeof f.universe !== 'number') return null
  return f as LeadersReport
}
