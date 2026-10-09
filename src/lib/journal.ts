/**
 * Trade journal and a small, honest learner. Every AI signal is recorded with the
 * model score it had at the time; when the trade closes, the outcome is written back.
 * The learner only uses closed trades, shrinks each score bucket toward 50% so a few
 * lucky trades can't move it, and says "not enough data" below a minimum sample.
 * Paper trading only.
 */

export type JournalSignal = 'BUY' | 'HOLD' | 'SELL'

export interface JournalEntry {
  id: string
  symbol: string
  signal: JournalSignal
  /** Model probability that price is higher after `horizon` bars (0..1). */
  score: number
  openedAt: number // unix seconds
  entryPrice: number
  exitAt?: number
  exitPrice?: number
}

/** Minimum closed trades before the learner reports a calibrated probability. */
export const MIN_TRADES = 30
/** Pseudo-trades at 50% added to each bucket, so small samples stay near a coin flip. */
const PRIOR_WEIGHT = 10
export const BUCKETS = 5

export const isClosed = (e: JournalEntry) => e.exitPrice !== undefined && e.exitAt !== undefined

/** Simple return of a closed BUY trade, in percent. SELL is treated as a short. */
export function tradeReturnPct(e: JournalEntry): number | null {
  if (!isClosed(e) || e.signal === 'HOLD') return null
  const r = (e.exitPrice! / e.entryPrice - 1) * 100
  return e.signal === 'BUY' ? r : -r
}

export function recordSignal(entries: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  return [...entries.filter((e) => e.id !== entry.id), entry].slice(-1000)
}

export function closeTrade(entries: JournalEntry[], id: string, exitPrice: number, exitAt: number): JournalEntry[] {
  return entries.map((e) => (e.id === id && !isClosed(e) ? { ...e, exitPrice, exitAt } : e))
}

export interface Scorecard {
  closed: number
  wins: number
  hitRate: number | null
  avgReturnPct: number | null
  enoughData: boolean
  bySignal: Record<JournalSignal, { closed: number; hitRate: number | null }>
}

export function scorecard(entries: JournalEntry[]): Scorecard {
  const bySignal = { BUY: { closed: 0, hits: 0 }, SELL: { closed: 0, hits: 0 }, HOLD: { closed: 0, hits: 0 } }
  let closed = 0
  let wins = 0
  let retSum = 0
  for (const e of entries) {
    const r = tradeReturnPct(e)
    if (r === null) continue
    closed++
    retSum += r
    const hit = r > 0
    if (hit) wins++
    bySignal[e.signal].closed++
    if (hit) bySignal[e.signal].hits++
  }
  const rate = (hits: number, n: number) => (n ? hits / n : null)
  return {
    closed,
    wins,
    hitRate: rate(wins, closed),
    avgReturnPct: closed ? retSum / closed : null,
    enoughData: closed >= MIN_TRADES,
    bySignal: {
      BUY: { closed: bySignal.BUY.closed, hitRate: rate(bySignal.BUY.hits, bySignal.BUY.closed) },
      SELL: { closed: bySignal.SELL.closed, hitRate: rate(bySignal.SELL.hits, bySignal.SELL.closed) },
      HOLD: { closed: 0, hitRate: null },
    },
  }
}

const bucketOf = (score: number) => Math.min(BUCKETS - 1, Math.max(0, Math.floor(score * BUCKETS)))

/**
 * Learned probability of an up move for a model score, from closed trades in the same
 * score bucket. Returns null until there are enough closed trades overall.
 */
export function calibrate(entries: JournalEntry[], score: number): { probability: number; n: number } | null {
  const closed = entries.filter((e) => tradeReturnPct(e) !== null && e.signal === 'BUY')
  if (closed.length < MIN_TRADES) return null
  const b = bucketOf(score)
  let n = 0
  let hits = 0
  for (const e of closed) {
    if (bucketOf(e.score) !== b) continue
    n++
    if (tradeReturnPct(e)! > 0) hits++
  }
  // shrink toward 50% so a bucket with a handful of trades cannot look certain
  return { probability: (hits + PRIOR_WEIGHT * 0.5) / (n + PRIOR_WEIGHT), n }
}

/**
 * Share of all closed BUY trades that went up, shrunk toward 50% like a bucket.
 * This is what "always buy" would have scored, so a bucket has to beat it to mean anything.
 */
export function baseRate(entries: JournalEntry[]): { probability: number; n: number } | null {
  const closed = entries.filter((e) => tradeReturnPct(e) !== null && e.signal === 'BUY')
  if (closed.length < MIN_TRADES) return null
  const hits = closed.filter((e) => tradeReturnPct(e)! > 0).length
  return { probability: (hits + PRIOR_WEIGHT * 0.5) / (closed.length + PRIOR_WEIGHT), n: closed.length }
}

/** Default extra hit rate a score bucket needs over the base rate before the learner says BUY. */
export const EDGE_MARGIN = 0.03

/**
 * BUY only when the learned probability clears the threshold AND beats the base rate
 * (always buying) by the margin; otherwise HOLD. Without the base-rate check a rising
 * market makes every bucket look good and the learner just copies "always buy".
 */
export function decide(entries: JournalEntry[], score: number, threshold = 0.55, margin = EDGE_MARGIN): { signal: JournalSignal; reason: string } {
  const c = calibrate(entries, score)
  const base = baseRate(entries)
  if (!c || !base) return { signal: 'HOLD', reason: `not enough closed trades yet (need ${MIN_TRADES})` }
  const p = (x: number) => `${(x * 100).toFixed(0)}%`
  if (c.probability < threshold) return { signal: 'HOLD', reason: `learned ${p(c.probability)} up, below ${p(threshold)}` }
  if (c.probability < base.probability + margin)
    return { signal: 'HOLD', reason: `learned ${p(c.probability)} up, but always buying scored ${p(base.probability)}, so no edge` }
  return { signal: 'BUY', reason: `learned ${p(c.probability)} up from ${c.n} similar trades, vs ${p(base.probability)} for always buying` }
}
