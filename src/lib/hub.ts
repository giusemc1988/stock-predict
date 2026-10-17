/**
 * Hub home (version B): how each of the six agents on the sphere feels about a pick.
 * Every vote comes from real data the page already has; when an agent has nothing on a
 * symbol it says "no data" instead of guessing.
 */
import type { NodeId } from './brief'
import type { PickRow } from './practice'
import { analyzeSentiment } from './newsSentiment'

/** Agent colors, in briefNodes order: scanner, order flow, news, signals, learner, risk guard. */
export const AGENT_COLORS: [number, number, number][] = [[89, 214, 255], [55, 215, 156], [255, 138, 107], [242, 196, 90], [165, 139, 255], [255, 107, 181]]

export type Vote = 'yes' | 'no' | 'none'

export interface AgentVote {
  id: NodeId
  vote: Vote
  /** Why, in both languages, shown on hover. */
  why: { en: string; vi: string }
}

export interface VoteContext {
  /** Order flow is only measured for the market open on the chart. */
  flow: { symbol: string; buyShare: number | null }
  headlines: string[]
  learner: { right: number; wrong: number }
  risk: { killSwitch: boolean; dayPL: number; lossLimit: number; lossLimitOn: boolean }
}

/** The learner needs this many graded calls before its record counts. */
export const LEARNER_MIN_CALLS = 10

const mentions = (headline: string, symbol: string) => {
  const base = symbol.split('/')[0].toUpperCase()
  return new RegExp(`(^|[^A-Z])${base.replace(/[^A-Z0-9]/g, '')}([^A-Z]|$)`).test(headline.toUpperCase())
}

export function agentVotes(pick: PickRow, ctx: VoteContext): AgentVote[] {
  const v = (id: NodeId, vote: Vote, en: string, vi: string): AgentVote => ({ id, vote, why: { en, vi } })
  const out: AgentVote[] = []

  out.push(pick.place != null ? v('scanner', 'yes', `Scanner ranked it #${pick.place}`, `Máy quét xếp hạng #${pick.place}`) : v('scanner', 'none', 'Not ranked by the scanner', 'Máy quét chưa xếp hạng'))

  if (ctx.flow.symbol === pick.symbol && ctx.flow.buyShare != null) {
    const pct = Math.round(ctx.flow.buyShare * 100)
    out.push(v('flow', ctx.flow.buyShare >= 0.5 ? 'yes' : 'no', `${pct}% of recent volume from buyers`, `${pct}% khối lượng gần đây từ người mua`))
  } else out.push(v('flow', 'none', 'Order flow is measured only for the chart market', 'Dòng lệnh chỉ đo cho mã đang mở trên biểu đồ'))

  const own = ctx.headlines.filter((h) => mentions(h, pick.symbol))
  if (own.length) {
    const s = analyzeSentiment(own)
    out.push(v('news', s.isPositive ? 'yes' : s.sentiment <= -0.2 ? 'no' : 'none', `${own.length} headline(s), tone ${s.sentiment.toFixed(2)}`, `${own.length} tin, sắc thái ${s.sentiment.toFixed(2)}`))
  } else out.push(v('news', 'none', 'No recent headline names it', 'Chưa có tin nào nhắc tới mã này'))

  out.push(
    pick.verdict === 'BUY' ? v('signals', 'yes', 'Analyst says BUY', 'Phân tích nói MUA') : pick.verdict === 'SELL' ? v('signals', 'no', 'Analyst says SELL', 'Phân tích nói BÁN') : v('signals', 'none', 'Analyst has no BUY or SELL', 'Phân tích chưa nói MUA hay BÁN'),
  )

  const calls = ctx.learner.right + ctx.learner.wrong
  if (calls >= LEARNER_MIN_CALLS) {
    const rate = Math.round((ctx.learner.right / calls) * 100)
    out.push(v('learner', rate >= 50 ? 'yes' : 'no', `Learner is right ${rate}% of ${calls} calls`, `Bộ học đúng ${rate}% trong ${calls} lần`))
  } else out.push(v('learner', 'none', `Learner has ${calls} of ${LEARNER_MIN_CALLS} calls needed`, `Bộ học mới có ${calls}/${LEARNER_MIN_CALLS} lần cần thiết`))

  const used = ctx.risk.lossLimitOn && ctx.risk.lossLimit > 0 ? Math.max(0, -ctx.risk.dayPL) / ctx.risk.lossLimit : 0
  out.push(
    ctx.risk.killSwitch ? v('risk', 'no', 'Kill switch is on', 'Đang bật dừng khẩn cấp') : used >= 1 ? v('risk', 'no', 'Daily loss limit reached', 'Đã chạm giới hạn lỗ ngày') : v('risk', 'yes', 'Within risk limits', 'Trong giới hạn rủi ro'),
  )
  return out
}

export const agreeCount = (votes: AgentVote[]) => votes.filter((x) => x.vote === 'yes').length
