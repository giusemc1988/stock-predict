/**
 * Trade review: grades each closed trade on how it was taken (process), separately
 * from whether it made money (outcome). A win from a bad process is luck and
 * shouldn't be repeated; a loss from a good process is the cost of trading.
 */
import type { DataStamp } from './dataGuard'

export type ReviewBucket = 'skill' | 'unlucky' | 'lucky' | 'mistake'

export interface TradeReview {
  good: boolean
  bucket: ReviewBucket
  /** Codes of the rules the entry broke (empty for a good process). */
  fails: ReviewFail[]
}

export type ReviewFail = 'rr' | 'score' | 'data' | 'learner'

/** Reward must be at least this many times the risk in the plan. */
export const MIN_RR = 1.5
/** Trade Score below this is a weak setup (the same as the default warning level). */
export const MIN_SCORE = 40

export const REVIEW_FAIL: Record<ReviewFail, { en: string; vi: string }> = {
  rr: { en: `reward under ${MIN_RR}x the risk`, vi: `lợi nhuận dưới ${MIN_RR} lần rủi ro` },
  score: { en: `Trade Score under ${MIN_SCORE}`, vi: `Điểm Giao dịch dưới ${MIN_SCORE}` },
  data: { en: 'stale or simulated data', vi: 'dữ liệu cũ hoặc giả lập' },
  learner: { en: 'the learner said HOLD', vi: 'bộ học nói GIỮ' },
}

export const BUCKET_LABEL: Record<ReviewBucket, { en: string; vi: string }> = {
  skill: { en: 'Good process, won', vi: 'Quy trình tốt, thắng' },
  unlucky: { en: 'Good process, lost (unlucky)', vi: 'Quy trình tốt, thua (kém may)' },
  lucky: { en: 'Bad process, won (lucky)', vi: 'Quy trình kém, thắng (may mắn)' },
  mistake: { en: 'Bad process, lost (mistake)', vi: 'Quy trình kém, thua (sai lầm)' },
}

export interface ReviewInput {
  signal: number
  stop: number
  target: number
  tradeScore: number | null
  learner: 'BUY' | 'HOLD' | 'n/a'
  data?: DataStamp
  /** The data limit at entry, seconds; missing means the age isn't judged. */
  dataLimitSec?: number
  pnl: number
}

export function reviewTrade(t: ReviewInput): TradeReview {
  const fails: ReviewFail[] = []
  const risk = t.signal - t.stop
  if (!(risk > 0) || (t.target - t.signal) / risk < MIN_RR) fails.push('rr')
  if (t.tradeScore != null && t.tradeScore < MIN_SCORE) fails.push('score')
  if (t.data && (t.data.label === 'mock' || (t.dataLimitSec != null && t.data.ageSec > t.dataLimitSec))) fails.push('data')
  if (t.learner === 'HOLD') fails.push('learner')
  const good = fails.length === 0
  const won = t.pnl > 0
  return { good, fails, bucket: good ? (won ? 'skill' : 'unlucky') : won ? 'lucky' : 'mistake' }
}

export function reviewCounts(reviews: (TradeReview | undefined)[]): Record<ReviewBucket, number> {
  const out: Record<ReviewBucket, number> = { skill: 0, unlucky: 0, lucky: 0, mistake: 0 }
  for (const r of reviews) if (r) out[r.bucket]++
  return out
}
