/**
 * End-of-day practice report: what the AI traded on one US trading day, what it cost,
 * which decisions were rejected and why, how many wins were skill or luck, and lessons.
 * Built from the practice account; saved with it each time a trade closes.
 */
import type { PracticeState, PracticeTrade } from './practice'
import { reviewCounts, type ReviewBucket } from './review'

export interface DailyReport {
  day: string
  trades: number
  wins: number
  /** P&L after costs, before costs, and the costs (fees, spread, slippage). */
  net: number
  gross: number
  costs: number
  opened: number
  rejected: number
  /** Most common reasons a decision was rejected: check name and count. */
  topRejects: { check: string; n: number }[]
  review: Record<ReviewBucket, number>
  best: { symbol: string; pnl: number } | null
  worst: { symbol: string; pnl: number } | null
  lessons: { en: string; vi: string }[]
}

const money = (x: number) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(2)}`

/** `dayOf` maps a time (ms) to its trading day; passed in to keep this file free of the market clock. */
export function buildDailyReport(s: PracticeState, day: string, dayOf: (ms: number) => string = defaultDayOf): DailyReport {
  const tr: PracticeTrade[] = s.trades.filter((t) => dayOf(t.closedAt) === day)
  const sum = (f: (t: PracticeTrade) => number) => +tr.reduce((a, t) => a + f(t), 0).toFixed(2)
  const net = sum((t) => t.pnl)
  const costs = sum((t) => t.costPaid ?? 0)
  const log = (s.audit ?? []).filter((e) => e.account === 'practice' && e.side === 'buy' && dayOf(e.time) === day)
  const rejects = new Map<string, number>()
  for (const e of log) if (!e.accepted) rejects.set(e.blockedBy ?? 'Other', (rejects.get(e.blockedBy ?? 'Other') ?? 0) + 1)
  const sorted = [...tr].sort((a, b) => b.pnl - a.pnl)
  const review = reviewCounts(tr.map((t) => t.review))
  const wins = tr.filter((t) => t.pnl > 0).length

  const lessons: { en: string; vi: string }[] = []
  if (!tr.length) lessons.push({ en: 'No trades closed today.', vi: 'Hôm nay không có lệnh nào đóng.' })
  else {
    lessons.push({
      en: `${tr.length} trades closed, ${wins} won. Net ${money(net)}${costs ? ` after $${costs.toFixed(2)} in costs` : ''}.`,
      vi: `${tr.length} lệnh đã đóng, ${wins} lệnh thắng. Ròng ${money(net)}${costs ? ` sau $${costs.toFixed(2)} chi phí` : ''}.`,
    })
    if (review.lucky)
      lessons.push({
        en: `${review.lucky} win${review.lucky > 1 ? 's' : ''} broke the rules and got lucky: don't copy ${review.lucky > 1 ? 'them' : 'it'}.`,
        vi: `${review.lucky} lệnh thắng phạm quy tắc và chỉ gặp may: đừng lặp lại.`,
      })
    if (review.mistake)
      lessons.push({
        en: `${review.mistake} loss${review.mistake > 1 ? 'es' : ''} came from breaking the rules: avoidable.`,
        vi: `${review.mistake} lệnh thua do phạm quy tắc: có thể tránh được.`,
      })
    if (review.unlucky) lessons.push({ en: `${review.unlucky} loss${review.unlucky > 1 ? 'es' : ''} followed the rules: normal cost of trading.`, vi: `${review.unlucky} lệnh thua đúng quy tắc: chi phí bình thường của giao dịch.` })
    if (net < 0 && net + costs > 0) lessons.push({ en: 'Costs turned a small gain into a loss.', vi: 'Chi phí biến khoản lãi nhỏ thành lỗ.' })
  }
  const top = [...rejects.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (top.length) lessons.push({ en: `Most rejected by: ${top.map(([k, n]) => `${k} (${n})`).join(', ')}.`, vi: `Bị từ chối nhiều nhất bởi: ${top.map(([k, n]) => `${k} (${n})`).join(', ')}.` })

  return {
    day,
    trades: tr.length,
    wins,
    net,
    gross: sum((t) => t.gross ?? t.pnl),
    costs,
    opened: log.filter((e) => e.accepted).length,
    rejected: log.length - log.filter((e) => e.accepted).length,
    topRejects: top.map(([check, n]) => ({ check, n })),
    review,
    best: sorted[0] ? { symbol: sorted[0].symbol, pnl: sorted[0].pnl } : null,
    worst: sorted.length ? { symbol: sorted[sorted.length - 1].symbol, pnl: sorted[sorted.length - 1].pnl } : null,
    lessons,
  }
}

const ET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
/** US Eastern trading day, YYYY-MM-DD (same as practice's dayKey). */
const defaultDayOf = (ms: number) => ET.format(new Date(ms))
