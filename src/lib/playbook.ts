/**
 * Jarvis's playbook: rules experienced traders use, written down as checks on each practice
 * trade. This is "encoded experience". Every closed paper trade is then scored against every
 * rule, and a rule is only called proven when trades that followed it beat trades that broke
 * it by the learner's margin, on enough trades. Until then Jarvis says "unproven".
 *
 * Rules are built in; nothing is downloaded or written by an AI at run time. Paper only.
 */
import type { PracticePosition, PracticeTrade } from './practice'

export type RuleResult = boolean | null // null = not enough information on this trade

export interface PlaybookRule {
  id: string
  en: { name: string; why: string }
  vi: { name: string; why: string }
  check: (p: PracticePosition, history: PracticeTrade[]) => RuleResult
}

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function et(ms: number) {
  const o: Record<string, string> = {}
  for (const x of ET.formatToParts(new Date(ms))) if (x.type !== 'literal') o[x.type] = x.value
  return { day: `${o.year}-${o.month}-${o.day}`, min: +o.hour * 60 + +o.minute }
}
const isStock = (p: PracticePosition) => (p.asset ?? (p.symbol.includes('/') ? 'crypto' : 'stock')) === 'stock'
const isDay = (p: PracticePosition) => (p.kind ?? 'day') === 'day'
const OPEN = 9 * 60 + 30

/** Reward must be this many times the risk; matches the trade review. */
export const PB_MIN_RR = 1.5

export const PLAYBOOK: PlaybookRule[] = [
  {
    id: 'rr',
    en: { name: `Reward at least ${PB_MIN_RR}x the risk`, why: 'A trade that can win more than it risks can be wrong often and still pay.' },
    vi: { name: `Lợi nhuận ít nhất ${PB_MIN_RR} lần rủi ro`, why: 'Lệnh có thể thắng nhiều hơn mức rủi ro thì dù sai nhiều lần vẫn có lãi.' },
    check: (p) => {
      const at = p.signal ?? p.entry
      const risk = at - p.stop
      return risk > 0 ? (p.target - at) / risk >= PB_MIN_RR : false
    },
  },
  {
    id: 'score',
    en: { name: 'Trade Score 40 or more', why: 'Skip weak setups; wait for the good ones.' },
    vi: { name: 'Điểm Giao dịch từ 40 trở lên', why: 'Bỏ qua thiết lập yếu; chờ thiết lập tốt.' },
    check: (p) => (p.info.tradeScore == null ? null : p.info.tradeScore >= 40),
  },
  {
    id: 'grade',
    en: { name: 'Only A or B setups', why: 'Professionals pass on most setups and take the best few.' },
    vi: { name: 'Chỉ thiết lập hạng A hoặc B', why: 'Người chuyên nghiệp bỏ qua phần lớn và chỉ vào vài thiết lập tốt nhất.' },
    check: (p) => (p.info.grade == null ? null : /^[AB]/.test(p.info.grade)),
  },
  {
    id: 'data',
    en: { name: 'Fresh, real price data', why: 'Never trade on stale or simulated prices.' },
    vi: { name: 'Dữ liệu giá thật và mới', why: 'Không bao giờ giao dịch trên giá cũ hoặc giả lập.' },
    check: (p) => {
      const d = p.info.data
      if (!d) return null
      return d.label !== 'mock' && (p.info.dataLimitSec == null || d.ageSec <= p.info.dataLimitSec)
    },
  },
  {
    id: 'learner',
    en: { name: 'The learner agrees', why: "Don't fight your own track record." },
    vi: { name: 'Bộ học đồng ý', why: 'Đừng đi ngược lại lịch sử của chính mình.' },
    check: (p) => (p.info.learner === 'n/a' ? null : p.info.learner === 'BUY'),
  },
  {
    id: 'calm',
    en: { name: 'Avoid wild markets', why: 'In high volatility, stops get hit by noise.' },
    vi: { name: 'Tránh thị trường biến động mạnh', why: 'Khi biến động cao, cắt lỗ dễ bị chạm vì nhiễu.' },
    check: (p) => (p.info.regime == null ? null : p.info.regime !== 'high' && p.info.regime !== 'extreme'),
  },
  {
    id: 'conviction',
    en: { name: 'Strong analyst signal', why: 'A barely-BUY is close to a coin flip.' },
    vi: { name: 'Tín hiệu phân tích mạnh', why: 'MUA sát ngưỡng gần như tung đồng xu.' },
    check: (p) => Math.abs(p.info.score) >= 0.35,
  },
  {
    id: 'openRush',
    en: { name: 'No buys in the first 15 minutes', why: 'The open is the most erratic part of the day.' },
    vi: { name: 'Không mua trong 15 phút đầu phiên', why: 'Đầu phiên là lúc giá thất thường nhất trong ngày.' },
    check: (p) => {
      if (!isStock(p)) return null
      const m = et(p.openedAt).min
      return !(m >= OPEN && m < OPEN + 15)
    },
  },
  {
    id: 'lateDay',
    en: { name: 'No new day trades in the last 30 minutes', why: 'Too little time left for the trade to work.' },
    vi: { name: 'Không mở lệnh trong ngày ở 30 phút cuối', why: 'Còn quá ít thời gian để lệnh kịp chạy.' },
    check: (p) => (!isStock(p) || !isDay(p) ? null : et(p.openedAt).min < 15 * 60 + 30),
  },
  {
    id: 'noChase',
    en: { name: "Don't chase a stock already up 8%+ today", why: 'Late buyers often get the pullback.' },
    vi: { name: 'Không đuổi theo mã đã tăng 8%+ hôm nay', why: 'Người mua muộn thường dính nhịp điều chỉnh.' },
    check: (p) => (p.info.pick?.gainPct == null ? null : p.info.pick.gainPct < 8),
  },
  {
    id: 'volume',
    en: { name: 'Volume confirms the move', why: 'Moves on thin volume fade easily.' },
    vi: { name: 'Khối lượng xác nhận', why: 'Giá chạy khi khối lượng mỏng dễ tắt.' },
    check: (p) => (p.info.pick?.volVsAvg == null ? null : p.info.pick.volVsAvg >= 1),
  },
  {
    id: 'tightStop',
    en: { name: 'Stop within 3% (8% long-term)', why: 'A far stop means one loss can undo many wins.' },
    vi: { name: 'Cắt lỗ trong 3% (dài hạn 8%)', why: 'Cắt lỗ xa thì một lần thua có thể xóa nhiều lần thắng.' },
    check: (p) => {
      const at = p.signal ?? p.entry
      return at > 0 ? (at - p.stop) / at <= (isDay(p) ? 0.03 : 0.08) : null
    },
  },
  {
    id: 'streak',
    en: { name: 'Pause after 3 losses in a row', why: 'Step back when the market is not matching your read.' },
    vi: { name: 'Tạm dừng sau 3 lần thua liên tiếp', why: 'Lùi lại khi thị trường không giống nhận định của bạn.' },
    check: (p, h) => {
      const before = h.filter((t) => t.id !== p.id && t.closedAt <= p.openedAt).sort((a, b) => a.closedAt - b.closedAt).slice(-3)
      return before.length < 3 ? null : !before.every((t) => t.pnl <= 0)
    },
  },
  {
    id: 'revenge',
    en: { name: 'No re-buy after a stop-out the same day', why: 'Revenge trades repeat the same mistake.' },
    vi: { name: 'Không mua lại mã vừa cắt lỗ trong ngày', why: 'Giao dịch trả thù lặp lại cùng sai lầm.' },
    check: (p, h) => {
      const day = et(p.openedAt).day
      return !h.some((t) => t.id !== p.id && t.symbol === p.symbol && t.exitReason === 'stop' && t.closedAt <= p.openedAt && et(t.closedAt).day === day)
    },
  },
]

export const ruleById = (id: string) => PLAYBOOK.find((r) => r.id === id)

/** Every rule's result on one trade. */
export function checkTrade(p: PracticePosition, history: PracticeTrade[]): Record<string, RuleResult> {
  const out: Record<string, RuleResult> = {}
  for (const r of PLAYBOOK) {
    try {
      out[r.id] = r.check(p, history)
    } catch {
      out[r.id] = null
    }
  }
  return out
}

/** Names of the rules a trade broke, and how many it was checked on. */
export function brokenRules(p: PracticePosition, history: PracticeTrade[]) {
  const res = checkTrade(p, history)
  const checked = PLAYBOOK.filter((r) => res[r.id] != null)
  return { broken: checked.filter((r) => res[r.id] === false), followed: checked.filter((r) => res[r.id] === true), checked: checked.length }
}

// ---------- evidence: does following a rule pay on our own paper trades? ----------

export type RuleStatus = 'unproven' | 'proven' | 'noEdge' | 'harmful'

export interface RuleEvidence {
  id: string
  followed: { n: number; wins: number; avgRet: number }
  broke: { n: number; wins: number; avgRet: number }
  /** Win rates shrunk toward the overall win rate, so a few lucky trades can't move them. */
  followedRate: number | null
  brokeRate: number | null
  status: RuleStatus
  /** Trades still needed (followed, broke) before it can be judged. */
  need: { followed: number; broke: number }
}

/** Pseudo-trades at the overall win rate added to each side (same idea as the journal learner). */
const PRIOR = 10

export interface EvidenceOptions {
  /** Trades that followed a rule needed before it is judged (AI rules > track record). */
  minFollowed: number
  /** Win-rate points (0..1) following must beat breaking by; the learner's margin. */
  margin: number
}

export const minBrokeFor = (minFollowed: number) => Math.max(5, Math.round(minFollowed / 3))

export function ruleEvidence(trades: PracticeTrade[], opts: EvidenceOptions): RuleEvidence[] {
  const base = trades.length ? trades.filter((t) => t.pnl > 0).length / trades.length : 0.5
  const minBroke = minBrokeFor(opts.minFollowed)
  const results = trades.map((t) => ({ t, res: checkTrade(t, trades) }))
  return PLAYBOOK.map((r) => {
    const side = (want: boolean) => {
      const ts = results.filter((x) => x.res[r.id] === want).map((x) => x.t)
      return { n: ts.length, wins: ts.filter((t) => t.pnl > 0).length, avgRet: ts.length ? ts.reduce((a, t) => a + t.retPct, 0) / ts.length : 0 }
    }
    const followed = side(true)
    const broke = side(false)
    const shrink = (s: { n: number; wins: number }) => (s.n ? (s.wins + PRIOR * base) / (s.n + PRIOR) : null)
    const fr = shrink(followed)
    const br = shrink(broke)
    const need = { followed: Math.max(0, opts.minFollowed - followed.n), broke: Math.max(0, minBroke - broke.n) }
    let status: RuleStatus = 'unproven'
    if (!need.followed && !need.broke && fr != null && br != null) {
      if (fr - br >= opts.margin && followed.avgRet > 0) status = 'proven'
      else if (br - fr >= opts.margin) status = 'harmful'
      else status = 'noEdge'
    }
    return { id: r.id, followed, broke, followedRate: fr, brokeRate: br, status, need }
  })
}

/** For the optional gate: the first proven rule this new trade would break, if any. */
export function provenRuleBroken(p: PracticePosition, trades: PracticeTrade[], opts: EvidenceOptions): PlaybookRule | null {
  const proven = new Set(ruleEvidence(trades, opts).filter((e) => e.status === 'proven').map((e) => e.id))
  if (!proven.size) return null
  const res = checkTrade(p, trades)
  return PLAYBOOK.find((r) => proven.has(r.id) && res[r.id] === false) ?? null
}

export const STATUS_LABEL: Record<RuleStatus, { en: string; vi: string }> = {
  unproven: { en: 'Unproven', vi: 'Chưa chứng minh' },
  proven: { en: 'Proven on your paper trades', vi: 'Đã chứng minh trên lệnh thử của bạn' },
  noEdge: { en: 'No difference yet', vi: 'Chưa thấy khác biệt' },
  harmful: { en: 'Hurting results', vi: 'Đang làm kết quả xấu đi' },
}
