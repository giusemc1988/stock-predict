/**
 * Jarvis, the Arc Brain: one voice for what the app's AI knows. Everything here is built
 * from the app's own data (practice account, decision log, trade reviews, playbook evidence,
 * the learner). No AI model and no API key: the rules and the learner make every decision,
 * Jarvis only explains them. Never promises profits. Paper only.
 */
import type { Analysis } from '../types'
import type { AiRules } from './aiRules'
import type { AuditEntry } from './audit'
import { baseRate, type JournalEntry } from './journal'
import { dayKey, kindOf, PRACTICE_START, practiceEquity, type PracticeState, type PracticeTrade } from './practice'
import { brokenRules, PLAYBOOK, ruleById, ruleEvidence, type RuleEvidence } from './playbook'
import { REVIEW_FAIL } from './review'

export interface Bi {
  en: string
  vi: string
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const money = (x: number) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(2)}`

export const evidenceOpts = (rules: AiRules) => ({ minFollowed: rules.minSample, margin: rules.learnEdgeMarginPct / 100 })

/** Experience in reps, never in years. */
export interface Experience {
  practiceTrades: number
  reviewed: number
  replayed: number
  graded: number
  rules: number
  proven: number
  noEdge: number
  harmful: number
  unproven: number
}

export function experience(s: PracticeState, ev: RuleEvidence[], learn?: { oldTests: number; newBars: number; journal: JournalEntry[] } | null): Experience {
  return {
    practiceTrades: s.trades.length,
    reviewed: s.trades.filter((t) => t.review).length,
    replayed: learn ? learn.oldTests + learn.newBars : 0,
    graded: learn ? learn.journal.length : 0,
    rules: PLAYBOOK.length,
    proven: ev.filter((e) => e.status === 'proven').length,
    noEdge: ev.filter((e) => e.status === 'noEdge').length,
    harmful: ev.filter((e) => e.status === 'harmful').length,
    unproven: ev.filter((e) => e.status === 'unproven').length,
  }
}

/** US stock market state right now (regular hours only, holidays not known). */
export function marketState(now: number): Bi {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const o: Record<string, string> = {}
  for (const x of f.formatToParts(new Date(now))) o[x.type] = x.value
  const m = +o.hour * 60 + +o.minute
  if (o.weekday === 'Sat' || o.weekday === 'Sun') return { en: 'US stock market is closed for the weekend. Crypto trades 24/7.', vi: 'Thị trường chứng khoán Mỹ nghỉ cuối tuần. Tiền mã hóa giao dịch 24/7.' }
  if (m < 9 * 60 + 30) return { en: 'US stock market opens at 9:30 am New York time.', vi: 'Thị trường chứng khoán Mỹ mở cửa lúc 9:30 sáng giờ New York.' }
  if (m >= 16 * 60) return { en: 'US stock market has closed for today.', vi: 'Thị trường chứng khoán Mỹ đã đóng cửa hôm nay.' }
  return { en: `US stock market is open (closes 4:00 pm New York time, ${Math.floor((16 * 60 - m) / 60)} h ${(16 * 60 - m) % 60} min left).`, vi: `Thị trường chứng khoán Mỹ đang mở (đóng 4:00 chiều giờ New York, còn ${Math.floor((16 * 60 - m) / 60)} giờ ${(16 * 60 - m) % 60} phút).` }
}

/** The rule broken most often in the last `n` trades. */
function mostBroken(trades: PracticeTrade[], n = 20) {
  const recent = trades.slice(-n)
  const count = new Map<string, number>()
  for (const t of recent) for (const r of brokenRules(t, trades).broken) count.set(r.id, (count.get(r.id) ?? 0) + 1)
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
  return top ? { rule: ruleById(top[0])!, times: top[1], of: recent.length } : null
}

/** Morning briefing lines. */
export function briefing(s: PracticeState, rules: AiRules, journal: JournalEntry[], killSwitch: boolean, now = Date.now()): Bi[] {
  const out: Bi[] = [marketState(now)]
  const today = dayKey(now)
  const used = (k: 'day' | 'long') => [...s.trades, ...s.open].filter((t) => kindOf(t) === k && dayKey(t.openedAt) === today).length
  if (!rules.practiceMode) out.push({ en: 'Practice mode is off, so I am not placing practice trades.', vi: 'Chế độ luyện tập đang tắt nên tôi không đặt lệnh luyện tập.' })
  else
    out.push({
      en: `Plan for today: up to ${rules.practiceDayOn ? rules.practiceDayTrades : 0} day trades and ${rules.practiceLongOn ? rules.practiceLongTrades : 0} long-term trade. Used so far: ${used('day')} day, ${used('long')} long-term. ${s.open.length} open now.`,
      vi: `Kế hoạch hôm nay: tối đa ${rules.practiceDayOn ? rules.practiceDayTrades : 0} lệnh trong ngày và ${rules.practiceLongOn ? rules.practiceLongTrades : 0} lệnh dài hạn. Đã dùng: ${used('day')} trong ngày, ${used('long')} dài hạn. Đang mở ${s.open.length}.`,
    })
  const eq = practiceEquity(s)
  const dd = s.peak ? (1 - eq / s.peak) * 100 : 0
  out.push({
    en: `Practice account $${eq.toFixed(2)} (${money(eq - PRACTICE_START)} since start), ${dd.toFixed(1)}% below its peak; buys pause at ${rules.maxDrawdownPct}%.${killSwitch ? ' Kill switch is ON: no buys.' : ''}`,
    vi: `Tài khoản luyện tập $${eq.toFixed(2)} (${money(eq - PRACTICE_START)} từ đầu), thấp hơn đỉnh ${dd.toFixed(1)}%; dừng mua khi giảm ${rules.maxDrawdownPct}%.${killSwitch ? ' Công tắc dừng khẩn cấp đang BẬT: không mua.' : ''}`,
  })
  const prevDay = [...new Set(s.trades.map((t) => dayKey(t.closedAt)))].filter((d) => d < today).sort().pop()
  if (prevDay) {
    const ts = s.trades.filter((t) => dayKey(t.closedAt) === prevDay)
    const pnl = ts.reduce((a, t) => a + t.pnl, 0)
    const wins = ts.filter((t) => t.pnl > 0).length
    out.push({ en: `Last trading day (${prevDay}): ${ts.length} trades closed, ${wins} won, ${money(pnl)}.`, vi: `Ngày giao dịch trước (${prevDay}): đóng ${ts.length} lệnh, thắng ${wins}, ${money(pnl)}.` })
  }
  const base = baseRate(journal)
  out.push(
    base
      ? { en: `Learner: buying every bar wins ${pct(base.probability)} of the time (${base.n} graded AI calls). AI buys must beat that by ${rules.learnEdgeMarginPct} points before the learner says BUY.`, vi: `Bộ học: mua mọi nến thắng ${pct(base.probability)} (${base.n} lệnh AI đã chấm). Lệnh MUA của AI phải hơn mức đó ${rules.learnEdgeMarginPct} điểm thì bộ học mới nói MUA.` }
      : { en: 'Learner: not enough graded AI calls yet to judge anything.', vi: 'Bộ học: chưa đủ lệnh AI đã chấm để đánh giá.' },
  )
  const mb = mostBroken(s.trades)
  if (mb && mb.times >= 2)
    out.push({ en: `Focus today: "${mb.rule.en.name}". I broke it in ${mb.times} of my last ${mb.of} trades.`, vi: `Trọng tâm hôm nay: "${mb.rule.vi.name}". Tôi đã vi phạm ${mb.times} trong ${mb.of} lệnh gần nhất.` })
  return out
}

export interface Lesson extends Bi {
  time: number
  tone: 'good' | 'bad' | 'info'
}

/** Lessons Jarvis writes after each reviewed trade, newest first, plus what the evidence says per rule. */
export function tradeLessons(s: PracticeState, max = 12): Lesson[] {
  const out: Lesson[] = []
  for (const t of [...s.trades].reverse()) {
    if (out.length >= max) break
    const r = t.review
    if (!r) continue
    const { broken } = brokenRules(t, s.trades)
    const why = broken.length ? broken.map((b) => b.en.name).join('; ') : r.fails.map((f) => REVIEW_FAIL[f].en).join('; ')
    const whyVi = broken.length ? broken.map((b) => b.vi.name).join('; ') : r.fails.map((f) => REVIEW_FAIL[f].vi).join('; ')
    const res = `${money(t.pnl)} (${t.retPct >= 0 ? '+' : ''}${t.retPct.toFixed(2)}%)`
    if (r.bucket === 'lucky')
      out.push({ time: t.closedAt, tone: 'bad', en: `Lucky win on ${t.symbol}, ${res}. Broke: ${why}. Don't repeat it.`, vi: `Thắng may mắn ở ${t.symbol}, ${res}. Vi phạm: ${whyVi}. Đừng lặp lại.` })
    else if (r.bucket === 'mistake')
      out.push({ time: t.closedAt, tone: 'bad', en: `Avoidable loss on ${t.symbol}, ${res}. Broke: ${why}.`, vi: `Thua có thể tránh ở ${t.symbol}, ${res}. Vi phạm: ${whyVi}.` })
    else if (r.bucket === 'unlucky')
      out.push({ time: t.closedAt, tone: 'info', en: `Good process, lost on ${t.symbol}, ${res}. That is the cost of trading; no change.${broken.length ? ` (Playbook note: ${why}.)` : ''}`, vi: `Quy trình tốt nhưng thua ở ${t.symbol}, ${res}. Đó là chi phí giao dịch; không cần đổi.${broken.length ? ` (Ghi chú: ${whyVi}.)` : ''}` })
    else out.push({ time: t.closedAt, tone: 'good', en: `Good process, won on ${t.symbol}, ${res}. One good trade proves little; keep doing it the same way.`, vi: `Quy trình tốt, thắng ở ${t.symbol}, ${res}. Một lệnh tốt chưa chứng minh gì; cứ làm đúng như vậy.` })
  }
  return out
}

/** One line per rule: what the paper trades say so far. */
export function evidenceLine(e: RuleEvidence): Bi {
  if (e.status === 'unproven') {
    const needF = e.need.followed ? `${e.need.followed} more trades that follow it` : ''
    const needB = e.need.broke ? `${e.need.broke} more that break it` : ''
    const needFv = e.need.followed ? `thêm ${e.need.followed} lệnh tuân theo` : ''
    const needBv = e.need.broke ? `thêm ${e.need.broke} lệnh vi phạm` : ''
    return { en: `Needs ${[needF, needB].filter(Boolean).join(' and ')}.`, vi: `Cần ${[needFv, needBv].filter(Boolean).join(' và ')}.` }
  }
  const f = e.followedRate ?? 0
  const b = e.brokeRate ?? 0
  return {
    en: `Followed: won ${pct(f)} of ${e.followed.n}. Broken: won ${pct(b)} of ${e.broke.n}.`,
    vi: `Tuân theo: thắng ${pct(f)} của ${e.followed.n}. Vi phạm: thắng ${pct(b)} của ${e.broke.n}.`,
  }
}

// ---------- Ask Jarvis: fixed questions answered from the app's own data ----------

export type AskId = 'whyBuy' | 'learned' | 'rules' | 'risk' | 'idle'

export const ASK_QUESTIONS: Record<AskId, Bi> = {
  whyBuy: { en: 'Why did you buy your last trade?', vi: 'Vì sao bạn mua lệnh gần nhất?' },
  learned: { en: 'What did you learn today?', vi: 'Hôm nay bạn học được gì?' },
  rules: { en: 'Which rules work so far?', vi: 'Quy tắc nào hiệu quả đến giờ?' },
  risk: { en: 'What is my risk right now?', vi: 'Rủi ro của tôi lúc này là gì?' },
  idle: { en: "Why aren't you trading?", vi: 'Vì sao bạn không giao dịch?' },
}

export interface AskContext {
  state: PracticeState
  rules: AiRules
  journal: JournalEntry[]
  killSwitch: boolean
  priceOf: (symbol: string) => number
  now?: number
}

export function ask(id: AskId, c: AskContext): Bi[] {
  const s = c.state
  const now = c.now ?? Date.now()
  const ev = ruleEvidence(s.trades, evidenceOpts(c.rules))
  if (id === 'whyBuy') {
    const last = [...s.open, ...s.trades].sort((a, b) => b.openedAt - a.openedAt)[0]
    if (!last) return [{ en: "I haven't made a practice trade yet.", vi: 'Tôi chưa có lệnh luyện tập nào.' }]
    const i = last.info
    const { broken } = brokenRules(last, s.trades)
    const kind = kindOf(last) === 'day' ? { en: 'a quick day trade', vi: 'lệnh lướt trong ngày' } : { en: 'a longer hold', vi: 'lệnh giữ dài hơn' }
    const strong = Math.abs(i.score) >= 0.5
    const setup = i.tradeScore != null ? { en: ` and the setup scored ${i.tradeScore} out of 100`, vi: ` và thiết lập đạt ${i.tradeScore} trên 100 điểm` } : { en: '', vi: '' }
    const out: Bi[] = [
      {
        en: `I bought ${last.symbol} as ${kind.en} because the chart looked ${strong ? 'strong' : 'decent'}${setup.en}.`,
        vi: `Tôi mua ${last.symbol} như ${kind.vi} vì biểu đồ trông ${strong ? 'mạnh' : 'khá ổn'}${setup.vi}.`,
      },
    ]
    if (i.pick) {
      const up = i.pick.gainPct != null ? { en: `, up ${i.pick.gainPct.toFixed(1)}% today`, vi: `, tăng ${i.pick.gainPct.toFixed(1)}% hôm nay` } : { en: '', vi: '' }
      out.push({ en: `It was my number ${i.pick.place} pick of ${i.pick.of}${up.en}.`, vi: `Đó là mã thứ ${i.pick.place} trong ${i.pick.of} mã tôi chọn${up.vi}.` })
    }
    out.push(
      broken.length
        ? { en: `Honestly, it broke ${broken.length === 1 ? 'one of my rules' : `${broken.length} of my rules`}: ${broken.map((r) => r.en.name.toLowerCase()).join(', and ')}.`, vi: `Nói thật, lệnh này vi phạm ${broken.length} quy tắc: ${broken.map((r) => r.vi.name.toLowerCase()).join(', và ')}.` }
        : { en: 'It passed every rule in my playbook.', vi: 'Lệnh này đạt mọi quy tắc trong sổ tay.' },
    )
    return out
  }
  if (id === 'learned') {
    const today = dayKey(now)
    const ls = tradeLessons(s, 50).filter((l) => dayKey(l.time) === today)
    return ls.length ? ls.slice(0, 3) : [{ en: "Nothing new yet. No trades have closed today.", vi: 'Chưa có gì mới. Hôm nay chưa có lệnh nào đóng.' }]
  }
  if (id === 'rules') {
    const proven = ev.filter((e) => e.status === 'proven')
    const harmful = ev.filter((e) => e.status === 'harmful')
    const out: Bi[] = []
    if (!proven.length && !harmful.length)
      out.push({
        en: `None yet, to be honest. I've only closed ${s.trades.length} practice trades, and I need about ${c.rules.minSample} per rule before I trust it.`,
        vi: `Nói thật là chưa có. Tôi mới đóng ${s.trades.length} lệnh luyện tập, và cần khoảng ${c.rules.minSample} lệnh cho mỗi quy tắc trước khi tin nó.`,
      })
    for (const e of proven) out.push({ en: `"${ruleById(e.id)!.en.name}" is working. When I follow it I win ${pct(e.followedRate ?? 0)} of the time, versus ${pct(e.brokeRate ?? 0)} when I don't.`, vi: `"${ruleById(e.id)!.vi.name}" đang hiệu quả. Khi tuân theo tôi thắng ${pct(e.followedRate ?? 0)}, so với ${pct(e.brokeRate ?? 0)} khi không.` })
    for (const e of harmful) out.push({ en: `"${ruleById(e.id)!.en.name}" seems to hurt so far, but that could be luck. I'm watching it.`, vi: `"${ruleById(e.id)!.vi.name}" có vẻ gây hại, nhưng có thể do may rủi. Tôi đang theo dõi.` })
    return out
  }
  if (id === 'risk') {
    const eq = practiceEquity(s)
    const exposure = s.open.reduce((a, p) => a + p.qty * (c.priceOf(p.symbol) || p.entry), 0)
    const atRisk = s.open.reduce((a, p) => a + p.qty * Math.max(0, p.entry - p.stop), 0)
    if (!s.open.length) return [{ en: "Nothing right now. I'm not holding any practice trades.", vi: 'Hiện không có gì. Tôi không giữ lệnh luyện tập nào.' }]
    const share = eq ? Math.round((exposure / eq) * 100) : 0
    return [
      {
        en: `Pretty small. I'm in ${s.open.length} ${s.open.length === 1 ? 'trade' : 'trades'} with about ${share}% of the practice account, and if every stop gets hit we'd lose around $${atRisk.toFixed(0)}.`,
        vi: `Khá nhỏ. Tôi đang có ${s.open.length} lệnh với khoảng ${share}% tài khoản luyện tập, và nếu mọi cắt lỗ đều bị chạm thì mất khoảng $${atRisk.toFixed(0)}.`,
      },
      ...(c.killSwitch ? [{ en: 'The kill switch is on, so I won\'t buy anything new.', vi: 'Công tắc dừng khẩn cấp đang bật nên tôi sẽ không mua thêm.' }] : []),
    ]
  }
  // idle
  if (!c.rules.practiceMode) return [{ en: 'Practice mode is switched off, so I\'m sitting out.', vi: 'Chế độ luyện tập đang tắt nên tôi đứng ngoài.' }]
  if (c.killSwitch) return [{ en: 'The kill switch is on, so I\'m not allowed to buy.', vi: 'Công tắc dừng khẩn cấp đang bật nên tôi không được mua.' }]
  const out: Bi[] = []
  const m = marketState(now)
  if (!/is open/.test(m.en)) out.push({ en: 'The stock market is closed right now, so I wait.', vi: 'Thị trường chứng khoán đang đóng cửa nên tôi chờ.' })
  const rejected = (s.audit ?? []).find((a: AuditEntry) => !a.accepted && a.side === 'buy')
  if (rejected?.blockedBy) out.push({ en: `The last time I wanted to buy, my ${rejected.blockedBy.toLowerCase()} check stopped me.`, vi: `Lần gần nhất tôi muốn mua, bước kiểm tra ${rejected.blockedBy} đã chặn lại.` })
  out.push({ en: "Mostly, I only buy when I see a clear setup, and I'd rather wait than force a trade.", vi: 'Chủ yếu là tôi chỉ mua khi thấy thiết lập rõ ràng, và tôi thà chờ còn hơn ép lệnh.' })
  return out
}

/** Jarvis's one-line take on the analyst's call, in plain words. Wording only; the call is unchanged. */
export function jarvisSays(a: Analysis, symbol: string): Bi {
  if (a.verdict === 'HOLD') return { en: `Nothing clear on ${symbol} right now. I'd wait.`, vi: `${symbol} lúc này chưa rõ ràng. Tôi sẽ chờ.` }
  const up = a.verdict === 'BUY'
  const sure = a.confidenceLabel === 'High' ? { en: "and I like it", vi: 'và tôi khá thích' } : a.confidenceLabel === 'Medium' ? { en: "but I'm only half sure", vi: 'nhưng tôi chỉ chắc một nửa' } : { en: "but I wouldn't bet much on it", vi: 'nhưng tôi không dám đặt nhiều' }
  return {
    en: `${symbol} looks like it wants to go ${up ? 'up' : 'down'}, ${sure.en}. Keep it small and stick to the stop.`,
    vi: `${symbol} có vẻ muốn ${up ? 'đi lên' : 'đi xuống'}, ${sure.vi}. Vào nhỏ và giữ đúng cắt lỗ.`,
  }
}
