/**
 * Practice mode: the AI paper-trades small, on live data, while the app is open, even
 * though no method has proven an edge yet. Its own $10,000 practice account, separate
 * from your paper account and from the auto-learning scorecard. Every trade keeps the
 * reasons it was taken and how it ended, so the report can show what worked and what failed.
 * Paper only: nothing here reaches a broker.
 */
import type { Analysis } from '../types'

export const PRACTICE_START = 10_000
/** A practice trade that has neither stopped out nor hit target is closed after this many bars. */
export const MAX_BARS = 12
const MAX_TRADES = 500
const MAX_EVENTS = 200

export type ExitReason = 'target' | 'stop' | 'signal' | 'time'

export interface PracticeEntryInfo {
  verdict: Analysis['verdict']
  /** Analyst score, -1..1. */
  score: number
  grade: string | null
  tradeScore: number | null
  regime: string | null
  learner: 'BUY' | 'HOLD' | 'n/a'
  reason: string
}

export interface PracticePosition {
  id: string
  symbol: string
  tf: string
  qty: number
  entry: number
  stop: number
  target: number
  openedAt: number // ms
  barTime: number // chart bar time (s) for the marker
  bars: number
  info: PracticeEntryInfo
}

export interface PracticeTrade extends PracticePosition {
  exit: number
  closedAt: number
  exitBarTime: number
  exitReason: ExitReason
  pnl: number
  retPct: number
}

export interface PracticeEvent {
  id: string
  time: number // ms
  kind: 'buy' | 'sell' | 'skip'
  symbol: string
  en: string
  vi: string
  pnl?: number
}

export interface PracticeState {
  v: 1
  realized: number
  peak: number
  open: PracticePosition[]
  trades: PracticeTrade[]
  events: PracticeEvent[]
  /** Equity after each closed trade, for the curve. */
  curve: { t: number; equity: number }[]
}

export const emptyPractice = (): PracticeState => ({ v: 1, realized: 0, peak: PRACTICE_START, open: [], trades: [], events: [], curve: [{ t: Date.now(), equity: PRACTICE_START }] })

export function parsePractice(raw: unknown): PracticeState | null {
  const s = raw as PracticeState | null
  if (!s || s.v !== 1 || !Array.isArray(s.open) || !Array.isArray(s.trades) || !Array.isArray(s.events) || !Array.isArray(s.curve)) return null
  return s
}

export const practiceEquity = (s: PracticeState) => PRACTICE_START + s.realized

const fmt = (p: number) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.toPrecision(5))
const money = (x: number) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(2)}`
let seq = 0
const newId = (now: number) => `${now.toString(36)}${(seq++).toString(36)}`

function pushEvent(s: PracticeState, e: Omit<PracticeEvent, 'id'>) {
  s.events.unshift({ ...e, id: newId(e.time) })
  if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS
}

export interface EntryContext {
  symbol: string
  tf: string
  price: number
  barTime: number
  analysis: Analysis | null
  learner: 'BUY' | 'HOLD' | 'n/a'
  /** % of practice equity per trade. */
  sizePct: number
  gatesOn: boolean
  maxDrawdownPct: number
  maxTradesPerDay: number
  killSwitch: boolean
  now: number
}

/** Called once per closed bar on the open chart: maybe enter, and age or signal-exit open trades. */
export function onBarClose(prev: PracticeState, ctx: EntryContext): PracticeState {
  const s: PracticeState = structuredClone(prev)
  const a = ctx.analysis
  // age open trades on this market; exit on a SELL call or after MAX_BARS
  for (const p of [...s.open]) {
    if (p.symbol !== ctx.symbol || p.tf !== ctx.tf) continue
    p.bars++
    if (a?.verdict === 'SELL') close(s, p, ctx.price, 'signal', ctx.barTime, ctx.now)
    else if (p.bars >= MAX_BARS) close(s, p, ctx.price, 'time', ctx.barTime, ctx.now)
  }
  if (!a || a.verdict !== 'BUY' || s.open.some((p) => p.symbol === ctx.symbol)) return s

  const skip = (why: string, whyVi: string) => {
    pushEvent(s, { time: ctx.now, kind: 'skip', symbol: ctx.symbol, en: `Skipped a BUY on ${ctx.symbol}: ${why}`, vi: `Bỏ qua lệnh MUA ${ctx.symbol}: ${whyVi}` })
    return s
  }
  // risk gates for the practice account (the kill switch always applies)
  if (ctx.killSwitch) return skip('kill switch is on', 'công tắc dừng khẩn cấp đang bật')
  const eq = practiceEquity(s)
  if (ctx.gatesOn && eq < s.peak * (1 - ctx.maxDrawdownPct / 100)) return skip(`practice account is down ${ctx.maxDrawdownPct}%+ from its peak`, `tài khoản luyện tập giảm hơn ${ctx.maxDrawdownPct}% từ đỉnh`)
  const today = new Date(ctx.now).toDateString()
  const todays = s.trades.filter((t) => new Date(t.openedAt).toDateString() === today).length + s.open.length
  if (ctx.gatesOn && todays >= ctx.maxTradesPerDay) return skip(`${ctx.maxTradesPerDay} trades today already`, `đã đủ ${ctx.maxTradesPerDay} lệnh hôm nay`)
  const regime = a.tradeScore?.regime ?? null
  if (ctx.gatesOn && regime === 'extreme') return skip('price swings are extreme', 'giá dao động quá mạnh')
  const plan = a.exitPlan ?? (a.plan ? { stop: a.plan.stop, target: a.plan.target } : null)
  if (!plan || !(plan.stop < ctx.price) || !(plan.target > ctx.price)) return skip('no valid stop and target', 'không có cắt lỗ và chốt lời hợp lệ')

  // small, fixed practice size; halved in high volatility
  const pct = (ctx.sizePct / 100) * (regime === 'high' ? 0.5 : 1)
  const qty = (eq * pct) / ctx.price
  if (!(qty > 0)) return s
  const info: PracticeEntryInfo = {
    verdict: a.verdict,
    score: +a.score.toFixed(3),
    grade: a.tradeScore?.grade ?? null,
    tradeScore: a.tradeScore?.score ?? null,
    regime,
    learner: ctx.learner,
    reason: a.headline,
  }
  const pos: PracticePosition = { id: newId(ctx.now), symbol: ctx.symbol, tf: ctx.tf, qty, entry: ctx.price, stop: plan.stop, target: plan.target, openedAt: ctx.now, barTime: ctx.barTime, bars: 0, info }
  s.open.push(pos)
  const g = info.grade ? `, Trade Score ${info.grade}` : ''
  pushEvent(s, {
    time: ctx.now,
    kind: 'buy',
    symbol: ctx.symbol,
    en: `Bought ${+qty.toPrecision(4)} ${ctx.symbol} at ${fmt(ctx.price)} ($${(qty * ctx.price).toFixed(0)}). AI BUY${g}. Stop ${fmt(plan.stop)}, target ${fmt(plan.target)}.`,
    vi: `Mua ${+qty.toPrecision(4)} ${ctx.symbol} giá ${fmt(ctx.price)} ($${(qty * ctx.price).toFixed(0)}). AI MUA${g}. Cắt lỗ ${fmt(plan.stop)}, chốt lời ${fmt(plan.target)}.`,
  })
  return s
}

/** Called on every live price: closes trades that hit their stop or target. Returns null when nothing changed. */
export function onPrice(prev: PracticeState, symbol: string, price: number, barTime: number, now: number): PracticeState | null {
  const hits = prev.open.filter((p) => p.symbol === symbol && (price <= p.stop || price >= p.target))
  if (!hits.length) return null
  const s: PracticeState = structuredClone(prev)
  for (const h of hits) {
    const p = s.open.find((x) => x.id === h.id)!
    close(s, p, price, price >= p.target ? 'target' : 'stop', barTime, now)
  }
  return s
}

const REASON: Record<ExitReason, { en: string; vi: string }> = {
  target: { en: 'hit target', vi: 'chạm chốt lời' },
  stop: { en: 'hit stop', vi: 'chạm cắt lỗ' },
  signal: { en: 'AI turned SELL', vi: 'AI chuyển sang BÁN' },
  time: { en: `no move in ${MAX_BARS} bars`, vi: `không chạy sau ${MAX_BARS} nến` },
}

function close(s: PracticeState, p: PracticePosition, price: number, why: ExitReason, barTime: number, now: number) {
  s.open = s.open.filter((x) => x.id !== p.id)
  const pnl = (price - p.entry) * p.qty
  const t: PracticeTrade = { ...p, exit: price, closedAt: now, exitBarTime: barTime, exitReason: why, pnl: +pnl.toFixed(2), retPct: (price / p.entry - 1) * 100 }
  s.trades.push(t)
  if (s.trades.length > MAX_TRADES) s.trades.shift()
  s.realized += pnl
  s.peak = Math.max(s.peak, practiceEquity(s))
  s.curve.push({ t: now, equity: +practiceEquity(s).toFixed(2) })
  if (s.curve.length > MAX_TRADES) s.curve.shift()
  pushEvent(s, {
    time: now,
    kind: 'sell',
    symbol: p.symbol,
    pnl: t.pnl,
    en: `Sold ${p.symbol} at ${fmt(price)}: ${REASON[why].en}. ${money(pnl)} (${t.retPct >= 0 ? '+' : ''}${t.retPct.toFixed(2)}%).`,
    vi: `Bán ${p.symbol} giá ${fmt(price)}: ${REASON[why].vi}. ${money(pnl)} (${t.retPct >= 0 ? '+' : ''}${t.retPct.toFixed(2)}%).`,
  })
}

export const exitReasonLabel = REASON

// ---------- report ----------

export interface GroupRow {
  key: string
  n: number
  winRate: number
  avgPnl: number
}

function groupBy(trades: PracticeTrade[], keyOf: (t: PracticeTrade) => string): GroupRow[] {
  const m = new Map<string, PracticeTrade[]>()
  for (const t of trades) m.set(keyOf(t), [...(m.get(keyOf(t)) ?? []), t])
  return [...m.entries()]
    .map(([key, ts]) => ({ key, n: ts.length, winRate: ts.filter((t) => t.pnl > 0).length / ts.length, avgPnl: ts.reduce((a, t) => a + t.pnl, 0) / ts.length }))
    .sort((a, b) => b.n - a.n)
}

export function practiceReport(s: PracticeState) {
  const tr = s.trades
  const wins = tr.filter((t) => t.pnl > 0)
  const losses = tr.filter((t) => t.pnl <= 0)
  const sum = (xs: PracticeTrade[]) => xs.reduce((a, t) => a + t.pnl, 0)
  return {
    n: tr.length,
    winRate: tr.length ? wins.length / tr.length : null,
    pnl: s.realized,
    avgWin: wins.length ? sum(wins) / wins.length : null,
    avgLoss: losses.length ? sum(losses) / losses.length : null,
    profitFactor: losses.length && sum(losses) !== 0 ? sum(wins) / Math.abs(sum(losses)) : null,
    byGrade: groupBy(tr, (t) => t.info.grade ?? 'n/a'),
    byExit: groupBy(tr, (t) => t.exitReason),
    byRegime: groupBy(tr, (t) => t.info.regime ?? 'n/a'),
    byLearner: groupBy(tr, (t) => t.info.learner),
    bySymbol: groupBy(tr, (t) => t.symbol),
  }
}

/** Plain-language lessons from groups with at least `minN` trades. Honest when there is too little data. */
export function lessons(s: PracticeState, minN = 5): { en: string; vi: string }[] {
  const r = practiceReport(s)
  const out: { en: string; vi: string }[] = []
  if (r.n < 30)
    out.push({
      en: `Only ${r.n} practice trades so far. Under 30 the numbers below are mostly luck.`,
      vi: `Mới có ${r.n} lệnh luyện tập. Dưới 30 lệnh, các con số dưới đây phần lớn là may rủi.`,
    })
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const best = (rows: GroupRow[]) => rows.filter((g) => g.n >= minN).sort((a, b) => b.winRate - a.winRate)
  const g = best(r.byGrade)
  if (g.length >= 2)
    out.push({
      en: `Trade Score ${g[0].key} trades won ${pct(g[0].winRate)} (${g[0].n}); ${g[g.length - 1].key} won ${pct(g[g.length - 1].winRate)} (${g[g.length - 1].n}).`,
      vi: `Lệnh Điểm Giao dịch ${g[0].key} thắng ${pct(g[0].winRate)} (${g[0].n}); ${g[g.length - 1].key} thắng ${pct(g[g.length - 1].winRate)} (${g[g.length - 1].n}).`,
    })
  const stops = r.byExit.find((x) => x.key === 'stop')
  const targets = r.byExit.find((x) => x.key === 'target')
  if (r.n >= minN)
    out.push({
      en: `${stops?.n ?? 0} trades hit the stop and ${targets?.n ?? 0} hit the target; the rest closed on a SELL call or after ${MAX_BARS} bars.`,
      vi: `${stops?.n ?? 0} lệnh chạm cắt lỗ và ${targets?.n ?? 0} lệnh chạm chốt lời; còn lại đóng do lệnh BÁN hoặc sau ${MAX_BARS} nến.`,
    })
  const l = best(r.byLearner)
  const agree = l.find((x) => x.key === 'BUY')
  const disagree = l.find((x) => x.key === 'HOLD')
  if (agree && disagree)
    out.push({
      en: `When the learner agreed, trades won ${pct(agree.winRate)} (${agree.n}); when it said HOLD, ${pct(disagree.winRate)} (${disagree.n}).`,
      vi: `Khi bộ học đồng ý, lệnh thắng ${pct(agree.winRate)} (${agree.n}); khi nó nói GIỮ, ${pct(disagree.winRate)} (${disagree.n}).`,
    })
  const v = best(r.byRegime)
  if (v.length >= 2)
    out.push({
      en: `Best in ${v[0].key} volatility (${pct(v[0].winRate)} of ${v[0].n}), worst in ${v[v.length - 1].key} (${pct(v[v.length - 1].winRate)} of ${v[v.length - 1].n}).`,
      vi: `Tốt nhất khi biến động ${v[0].key} (${pct(v[0].winRate)} của ${v[0].n}), kém nhất khi ${v[v.length - 1].key} (${pct(v[v.length - 1].winRate)} của ${v[v.length - 1].n}).`,
    })
  return out
}
