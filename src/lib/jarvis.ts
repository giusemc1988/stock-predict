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
import { brokenRules, minBrokeFor, PLAYBOOK, ruleById, ruleEvidence, type RuleEvidence } from './playbook'
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
    const { broken, followed, checked } = brokenRules(last, s.trades)
    const out: Bi[] = [
      {
        en: `${last.symbol}, ${kindOf(last) === 'day' ? 'a day trade' : 'a long-term trade'}. The analyst said ${i.verdict} (${i.score >= 0 ? '+' : ''}${i.score.toFixed(2)})${i.tradeScore != null ? `, Trade Score ${i.tradeScore}${i.grade ? ` (${i.grade})` : ''}` : ''}${i.learner !== 'n/a' ? `, learner ${i.learner}` : ''}. ${i.reason}`,
        vi: `${last.symbol}, ${kindOf(last) === 'day' ? 'lệnh trong ngày' : 'lệnh dài hạn'}. Phân tích nói ${i.verdict} (${i.score >= 0 ? '+' : ''}${i.score.toFixed(2)})${i.tradeScore != null ? `, Điểm GD ${i.tradeScore}${i.grade ? ` (${i.grade})` : ''}` : ''}${i.learner !== 'n/a' ? `, bộ học ${i.learner}` : ''}.`,
      },
    ]
    if (i.pick) out.push({ en: `Why this stock: ${i.pick.en}.`, vi: `Vì sao chọn mã này: ${i.pick.vi}.` })
    out.push({
      en: `Playbook: followed ${followed.length} of ${checked} rules${broken.length ? `; broke ${broken.map((b) => b.en.name).join(', ')}` : ''}.`,
      vi: `Sổ tay: tuân theo ${followed.length} trên ${checked} quy tắc${broken.length ? `; vi phạm ${broken.map((b) => b.vi.name).join(', ')}` : ''}.`,
    })
    return out
  }
  if (id === 'learned') {
    const today = dayKey(now)
    const ls = tradeLessons(s, 50).filter((l) => dayKey(l.time) === today)
    return ls.length ? ls.slice(0, 5) : [{ en: 'No trades closed today, so no new lessons yet.', vi: 'Hôm nay chưa đóng lệnh nào nên chưa có bài học mới.' }]
  }
  if (id === 'rules') {
    const proven = ev.filter((e) => e.status === 'proven')
    const harmful = ev.filter((e) => e.status === 'harmful')
    const out: Bi[] = []
    if (!proven.length && !harmful.length) {
      out.push({
        en: `None of my ${PLAYBOOK.length} rules is proven on our paper trades yet. A rule needs ${c.rules.minSample} trades that follow it and ${minBrokeFor(c.rules.minSample)} that break it, and following it must win at least ${c.rules.learnEdgeMarginPct} points more often. I have ${s.trades.length} closed trades.`,
        vi: `Chưa quy tắc nào trong ${PLAYBOOK.length} quy tắc được chứng minh trên lệnh thử. Mỗi quy tắc cần ${c.rules.minSample} lệnh tuân theo và ${minBrokeFor(c.rules.minSample)} lệnh vi phạm, và tuân theo phải thắng nhiều hơn ít nhất ${c.rules.learnEdgeMarginPct} điểm. Tôi có ${s.trades.length} lệnh đã đóng.`,
      })
    }
    for (const e of proven) out.push({ en: `Works: ${ruleById(e.id)!.en.name}. ${evidenceLine(e).en}`, vi: `Hiệu quả: ${ruleById(e.id)!.vi.name}. ${evidenceLine(e).vi}` })
    for (const e of harmful) out.push({ en: `Hurting: ${ruleById(e.id)!.en.name}. ${evidenceLine(e).en} I'll keep watching; it may be luck.`, vi: `Gây hại: ${ruleById(e.id)!.vi.name}. ${evidenceLine(e).vi} Tôi sẽ tiếp tục theo dõi; có thể do may rủi.` })
    return out
  }
  if (id === 'risk') {
    const eq = practiceEquity(s)
    const exposure = s.open.reduce((a, p) => a + p.qty * (c.priceOf(p.symbol) || p.entry), 0)
    const atRisk = s.open.reduce((a, p) => a + p.qty * Math.max(0, p.entry - p.stop), 0)
    return [
      {
        en: `${s.open.length} open practice trades (limit ${c.rules.maxOpenPositions}), $${exposure.toFixed(0)} invested = ${eq ? Math.round((exposure / eq) * 100) : 0}% of the account (limit ${c.rules.maxExposurePct}%).`,
        vi: `${s.open.length} lệnh luyện tập đang mở (giới hạn ${c.rules.maxOpenPositions}), $${exposure.toFixed(0)} đã vào lệnh = ${eq ? Math.round((exposure / eq) * 100) : 0}% tài khoản (giới hạn ${c.rules.maxExposurePct}%).`,
      },
      { en: `If every stop is hit: about −$${atRisk.toFixed(2)}.`, vi: `Nếu mọi cắt lỗ đều bị chạm: khoảng −$${atRisk.toFixed(2)}.` },
      { en: `Kill switch ${c.killSwitch ? 'ON' : 'off'}. Paper money only.`, vi: `Công tắc dừng khẩn cấp ${c.killSwitch ? 'BẬT' : 'tắt'}. Chỉ tiền thử nghiệm.` },
    ]
  }
  // idle
  const out: Bi[] = []
  if (!c.rules.practiceMode) out.push({ en: 'Practice mode is off.', vi: 'Chế độ luyện tập đang tắt.' })
  if (c.killSwitch) out.push({ en: 'The kill switch is on.', vi: 'Công tắc dừng khẩn cấp đang bật.' })
  const rejected = (s.audit ?? []).find((a: AuditEntry) => !a.accepted && a.side === 'buy')
  if (rejected) out.push({ en: `Last blocked buy: ${rejected.en}.`, vi: `Lệnh mua bị chặn gần nhất: ${rejected.vi}.` })
  const base = baseRate(c.journal)
  if (base) out.push({ en: `I only trade when the analyst says BUY. The learner says my AI buys don't yet beat buying every bar (${pct(base.probability)}), so be skeptical of every trade.`, vi: `Tôi chỉ giao dịch khi phân tích nói MUA. Bộ học cho thấy lệnh MUA của AI chưa hơn việc mua mọi nến (${pct(base.probability)}), nên hãy hoài nghi mỗi lệnh.` })
  out.push(marketState(now))
  return out
}

/** Jarvis's one-line take on the analyst's call, in plain words. Wording only; the call is unchanged. */
export function jarvisSays(a: Analysis, symbol: string): Bi {
  const conf = a.confidenceLabel === 'High' ? 'fairly confident' : a.confidenceLabel === 'Medium' ? 'somewhat confident' : 'not confident'
  const confVi = a.confidenceLabel === 'High' ? 'khá tự tin' : a.confidenceLabel === 'Medium' ? 'hơi tự tin' : 'không tự tin'
  if (a.verdict === 'HOLD')
    return { en: `No clear edge on ${symbol} right now. Waiting is a position too.`, vi: `Chưa có lợi thế rõ ở ${symbol} lúc này. Chờ đợi cũng là một vị thế.` }
  const side = a.verdict === 'BUY' ? 'leans up' : 'leans down'
  const sideVi = a.verdict === 'BUY' ? 'nghiêng lên' : 'nghiêng xuống'
  return {
    en: `${symbol} ${side}, and I'm ${conf}. Size small, respect the stop, and remember nothing here is proven to beat buy-and-hold yet.`,
    vi: `${symbol} ${sideVi}, và tôi ${confVi}. Vào nhỏ, tôn trọng cắt lỗ, và nhớ rằng chưa có gì ở đây được chứng minh tốt hơn mua và giữ.`,
  }
}
