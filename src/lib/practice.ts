/**
 * Practice mode: the AI paper-trades small, on live data, while the app is open, even
 * though no method has proven an edge yet. Its own $10,000 practice account, separate
 * from your paper account and from the auto-learning scorecard. Every trade keeps the
 * reasons it was taken and how it ended, so the report can show what worked and what failed.
 * Paper only: nothing here reaches a broker.
 */
import type { Analysis, AssetClass, Candle } from '../types'

export const PRACTICE_START = 10_000
/** A day trade that has neither stopped out nor hit target is closed after this many bars. */
export const MAX_BARS = 12
/** Long-term trades get stops and targets this many times wider than the analyst's day plan. */
export const LONG_WIDTH = 2
/** Day trades are closed this long before the market closes, and none open in the last LAST_ENTRY_MS. */
const CLOSE_BUFFER_MS = 5 * 60_000
const LAST_ENTRY_MS = 15 * 60_000
const MAX_TRADES = 500
const MAX_EVENTS = 200

export type ExitReason = 'target' | 'stop' | 'signal' | 'time' | 'close' | 'hold'
/** Day trades are in and out the same day; long-term trades are held for days. */
export type PracticeKind = 'day' | 'long'

export interface PracticeEntryInfo {
  verdict: Analysis['verdict']
  /** Analyst score, -1..1. */
  score: number
  grade: string | null
  tradeScore: number | null
  regime: string | null
  learner: 'BUY' | 'HOLD' | 'n/a'
  reason: string
  /** Why the stock picker chose this market (missing when it traded the open chart). */
  pick?: PracticePickInfo
}

export interface PracticePickInfo {
  place: number
  of: number
  source: 'watchlist' | 'gainer' | 'active'
  gainPct: number | null
  volVsAvg: number | null
  en: string
  vi: string
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
  /** Missing on trades saved before v1.2.0: treated as day trades. */
  kind?: PracticeKind
  asset?: AssetClass
  /** Day trades: closed at this time (just before market close). Long-term: closed at this time if still open. */
  closeBy?: number
}

export const kindOf = (p: { kind?: PracticeKind }): PracticeKind => p.kind ?? 'day'

// ---------- market clock (US Eastern) ----------

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
function etParts(ms: number) {
  const o: Record<string, number> = {}
  for (const p of ET.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = +p.value
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}
/** The trading day a time belongs to, in US Eastern time (YYYY-MM-DD). */
export function dayKey(ms: number) {
  const e = etParts(ms)
  return `${e.year}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`
}
/** When a day trade opened at `ms` must be out: 4:00 pm ET for stocks, midnight ET for crypto, less a 5 minute buffer. */
export function sessionEnd(asset: AssetClass, ms: number) {
  const e = etParts(ms)
  const offset = Date.UTC(e.year, e.month - 1, e.day, e.hour, e.minute, e.second) - Math.floor(ms / 1000) * 1000
  const end = asset === 'stock' ? Date.UTC(e.year, e.month - 1, e.day, 16, 0) : Date.UTC(e.year, e.month - 1, e.day + 1, 0, 0)
  return end - offset - CLOSE_BUFFER_MS
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
  trade?: PracticeKind
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
  /** Set by the server job (scripts/practice-cycle.ts): when it ran, what it picked, and bars it has seen. */
  server?: PracticeServerInfo
}

/** One row of a stock-picker scan, small enough to save. */
export interface PickRow {
  symbol: string
  source: 'watchlist' | 'gainer' | 'active'
  verdict: Analysis['verdict'] | null
  gainPct: number | null
  volVsAvg: number | null
  tradeScore: number | null
  place: number | null
}

export interface PracticeServerInfo {
  lastRun: number
  lastBars: Record<string, number>
  picks: PickRow[]
  failed: string[]
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
  asset: AssetClass
  /** Quick in-and-out trades per day (0 or dayOn false = none). */
  dayOn: boolean
  dayTrades: number
  /** Long-term trades opened per day, held up to holdDays. */
  longOn: boolean
  longTrades: number
  holdDays: number
  pick?: PracticePickInfo
  /** When day trades must be out, if not the market's own close (the server closes all of them with the stock market). */
  dayEnd?: number
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
  // age open day trades on this market; exit on a SELL call or after MAX_BARS. Long-term trades ride.
  for (const p of [...s.open]) {
    if (p.symbol !== ctx.symbol || p.tf !== ctx.tf || kindOf(p) !== 'day') continue
    p.bars++
    if (a?.verdict === 'SELL') close(s, p, ctx.price, 'signal', ctx.barTime, ctx.now)
    else if (p.bars >= MAX_BARS) close(s, p, ctx.price, 'time', ctx.barTime, ctx.now)
  }
  if (!a || a.verdict !== 'BUY') return s

  // which slot this BUY fills: the day's long-term trade first, then the quick day trades
  const today = dayKey(ctx.now)
  const openedToday = (k: PracticeKind) => [...s.trades, ...s.open].filter((t) => kindOf(t) === k && dayKey(t.openedAt) === today).length
  const holding = (k: PracticeKind) => s.open.some((p) => p.symbol === ctx.symbol && kindOf(p) === k)
  const dayEnd = ctx.dayEnd ?? sessionEnd(ctx.asset, ctx.now)
  let kind: PracticeKind
  if (ctx.longOn && openedToday('long') < ctx.longTrades && !holding('long')) kind = 'long'
  else if (ctx.dayOn && openedToday('day') < ctx.dayTrades && !holding('day') && ctx.now < dayEnd - LAST_ENTRY_MS) kind = 'day'
  else return s

  const skip = (why: string, whyVi: string) => {
    pushEvent(s, { time: ctx.now, kind: 'skip', symbol: ctx.symbol, en: `Skipped a BUY on ${ctx.symbol}: ${why}`, vi: `Bỏ qua lệnh MUA ${ctx.symbol}: ${whyVi}` })
    return s
  }
  // risk gates for the practice account (the kill switch always applies)
  if (ctx.killSwitch) return skip('kill switch is on', 'công tắc dừng khẩn cấp đang bật')
  const eq = practiceEquity(s)
  if (ctx.gatesOn && eq < s.peak * (1 - ctx.maxDrawdownPct / 100)) return skip(`practice account is down ${ctx.maxDrawdownPct}%+ from its peak`, `tài khoản luyện tập giảm hơn ${ctx.maxDrawdownPct}% từ đỉnh`)
  const todays = s.trades.filter((t) => dayKey(t.openedAt) === today).length + s.open.length
  if (ctx.gatesOn && todays >= ctx.maxTradesPerDay) return skip(`${ctx.maxTradesPerDay} trades today already`, `đã đủ ${ctx.maxTradesPerDay} lệnh hôm nay`)
  const regime = a.tradeScore?.regime ?? null
  if (ctx.gatesOn && regime === 'extreme') return skip('price swings are extreme', 'giá dao động quá mạnh')
  const dayPlan = a.exitPlan ?? (a.plan ? { stop: a.plan.stop, target: a.plan.target } : null)
  if (!dayPlan || !(dayPlan.stop < ctx.price) || !(dayPlan.target > ctx.price)) return skip('no valid stop and target', 'không có cắt lỗ và chốt lời hợp lệ')
  const w = kind === 'long' ? LONG_WIDTH : 1
  const plan = { stop: ctx.price - (ctx.price - dayPlan.stop) * w, target: ctx.price + (dayPlan.target - ctx.price) * w }
  if (!(plan.stop > 0)) return skip('no valid stop and target', 'không có cắt lỗ và chốt lời hợp lệ')

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
    ...(ctx.pick ? { pick: ctx.pick } : {}),
  }
  const closeBy = kind === 'day' ? dayEnd : ctx.now + ctx.holdDays * 86_400_000
  const pos: PracticePosition = { id: newId(ctx.now), symbol: ctx.symbol, tf: ctx.tf, qty, entry: ctx.price, stop: plan.stop, target: plan.target, openedAt: ctx.now, barTime: ctx.barTime, bars: 0, info, kind, asset: ctx.asset, closeBy }
  s.open.push(pos)
  const g = info.grade ? `, Trade Score ${info.grade}` : ''
  const label = kind === 'day' ? { en: 'Day trade', vi: 'Lệnh trong ngày' } : { en: `Long-term trade (up to ${ctx.holdDays} days)`, vi: `Lệnh dài hạn (tối đa ${ctx.holdDays} ngày)` }
  pushEvent(s, {
    time: ctx.now,
    kind: 'buy',
    symbol: ctx.symbol,
    trade: kind,
    en: `${label.en}: bought ${+qty.toPrecision(4)} ${ctx.symbol} at ${fmt(ctx.price)} ($${(qty * ctx.price).toFixed(0)}). AI BUY${g}. Stop ${fmt(plan.stop)}, target ${fmt(plan.target)}.${ctx.pick ? ` Picked: ${ctx.pick.en}.` : ''}`,
    vi: `${label.vi}: mua ${+qty.toPrecision(4)} ${ctx.symbol} giá ${fmt(ctx.price)} ($${(qty * ctx.price).toFixed(0)}). AI MUA${g}. Cắt lỗ ${fmt(plan.stop)}, chốt lời ${fmt(plan.target)}.${ctx.pick ? ` Lý do chọn: ${ctx.pick.vi}.` : ''}`,
  })
  return s
}

/** Bars since the last check, oldest first: closes trades whose stop or target the bar's low or high reached,
 *  at the stop or target price (the stop first when one bar reaches both). Returns null when nothing changed. */
export function onBars(prev: PracticeState, symbol: string, bars: Candle[], now: number): PracticeState | null {
  if (!prev.open.some((p) => p.symbol === symbol)) return null
  let s: PracticeState | null = null
  for (const b of bars) {
    const cur: PracticeState = s ?? prev
    const hits = cur.open.filter((p) => p.symbol === symbol && b.time > p.barTime && (b.low <= p.stop || b.high >= p.target))
    if (!hits.length) continue
    const next: PracticeState = s ?? structuredClone(prev)
    for (const h of hits) {
      const p = next.open.find((x) => x.id === h.id)!
      if (b.low <= p.stop) close(next, p, p.stop, 'stop', b.time, now)
      else close(next, p, p.target, 'target', b.time, now)
    }
    s = next
  }
  return s
}

const exitFor = (p: PracticePosition, price: number, now: number): ExitReason | null =>
  price >= p.target ? 'target' : price <= p.stop ? 'stop' : p.closeBy != null && now >= p.closeBy ? (kindOf(p) === 'day' ? 'close' : 'hold') : null

/** Called on every live price and once a minute: closes trades at stop, target, market close (day trades)
 *  or the end of the holding period (long-term). Returns null when nothing changed. */
export function onPrice(prev: PracticeState, symbol: string, price: number, barTime: number, now: number): PracticeState | null {
  const hits = prev.open.filter((p) => p.symbol === symbol && exitFor(p, price, now))
  if (!hits.length) return null
  const s: PracticeState = structuredClone(prev)
  for (const h of hits) {
    const p = s.open.find((x) => x.id === h.id)!
    close(s, p, price, exitFor(p, price, now)!, barTime, now)
  }
  return s
}

const REASON: Record<ExitReason, { en: string; vi: string }> = {
  target: { en: 'hit target', vi: 'chạm chốt lời' },
  stop: { en: 'hit stop', vi: 'chạm cắt lỗ' },
  signal: { en: 'AI turned SELL', vi: 'AI chuyển sang BÁN' },
  time: { en: `no move in ${MAX_BARS} bars`, vi: `không chạy sau ${MAX_BARS} nến` },
  close: { en: 'closed before market close', vi: 'đóng trước giờ đóng cửa' },
  hold: { en: 'holding period ended', vi: 'hết thời gian giữ' },
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
    trade: kindOf(p),
    en: `${kindOf(p) === 'day' ? 'Day trade' : 'Long-term trade'}: sold ${p.symbol} at ${fmt(price)}: ${REASON[why].en}. ${money(pnl)} (${t.retPct >= 0 ? '+' : ''}${t.retPct.toFixed(2)}%).`,
    vi: `${kindOf(p) === 'day' ? 'Lệnh trong ngày' : 'Lệnh dài hạn'}: bán ${p.symbol} giá ${fmt(price)}: ${REASON[why].vi}. ${money(pnl)} (${t.retPct >= 0 ? '+' : ''}${t.retPct.toFixed(2)}%).`,
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

export function practiceReport(s: PracticeState, kind?: PracticeKind) {
  const tr = kind ? s.trades.filter((t) => kindOf(t) === kind) : s.trades
  const wins = tr.filter((t) => t.pnl > 0)
  const losses = tr.filter((t) => t.pnl <= 0)
  const sum = (xs: PracticeTrade[]) => xs.reduce((a, t) => a + t.pnl, 0)
  return {
    n: tr.length,
    winRate: tr.length ? wins.length / tr.length : null,
    pnl: kind ? sum(tr) : s.realized,
    avgWin: wins.length ? sum(wins) / wins.length : null,
    avgLoss: losses.length ? sum(losses) / losses.length : null,
    profitFactor: losses.length && sum(losses) !== 0 ? sum(wins) / Math.abs(sum(losses)) : null,
    byGrade: groupBy(tr, (t) => t.info.grade ?? 'n/a'),
    byKind: groupBy(tr, (t) => kindOf(t)),
    bySource: groupBy(tr, (t) => t.info.pick?.source ?? 'chart'),
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
  const day = r.byKind.find((x) => x.key === 'day')
  const long = r.byKind.find((x) => x.key === 'long')
  if (day && long)
    out.push({
      en: `Day trades won ${pct(day.winRate)} of ${day.n} (avg ${money(day.avgPnl)}); long-term trades won ${pct(long.winRate)} of ${long.n} (avg ${money(long.avgPnl)}).`,
      vi: `Lệnh trong ngày thắng ${pct(day.winRate)} của ${day.n} (TB ${money(day.avgPnl)}); lệnh dài hạn thắng ${pct(long.winRate)} của ${long.n} (TB ${money(long.avgPnl)}).`,
    })
  const stops = r.byExit.find((x) => x.key === 'stop')
  const targets = r.byExit.find((x) => x.key === 'target')
  if (r.n >= minN)
    out.push({
      en: `${stops?.n ?? 0} trades hit the stop and ${targets?.n ?? 0} hit the target${r.n - (stops?.n ?? 0) - (targets?.n ?? 0) ? '; the rest closed on a SELL call, on time, or at market close' : ''}.`,
      vi: `${stops?.n ?? 0} lệnh chạm cắt lỗ và ${targets?.n ?? 0} lệnh chạm chốt lời${r.n - (stops?.n ?? 0) - (targets?.n ?? 0) ? '; còn lại đóng do lệnh BÁN, hết giờ, hoặc trước giờ đóng cửa' : ''}.`,
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
