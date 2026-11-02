/**
 * Atlas signal board: what Atlas is learning, toward what goal, and each signal with its entry, target (TP),
 * stop (SL) and the real win rate of that kind of signal in Atlas's own record. Pure functions, no I/O:
 * the board (src/components/AtlasSignalBoard.tsx) and the Hub card read the practice state and
 * /api/practice/learning (the shadow-lead report) and pass them here. Nothing here trades or changes a rule.
 */
import type { PracticeKind, PracticePosition, PracticeState, PracticeTrade } from './practice'
import type { LeadsReport } from './shadowLeads'

type Bi = { en: string; vi: string }

/** The day the shadow tests are graded (L1-L4, the volume filter, Kronos): set when they started on 2026-11-02. */
export const REVIEW_DAY = '2026-11-16'
export const LEARN_START_DAY = '2026-11-02'
/** New (live) trades each test needs before its result means anything. */
export const LEARN_GOAL = 50
/** Below this many past trades a win rate is shown with a "too few to trust" warning. */
export const TRUST_MIN = 30

/** Replay labs so far (public/replay-*.json; TRIAL_LEDGER in src/lib/replayEdges.ts). Update when a lab round lands. */
export const LAB = { trials: 402, passed: 0, bestDsr: 0.39, needDsr: 0.95, best: { en: 'L4 overnight winners', vi: 'L4 mua mã tăng mạnh, bán sáng mai' } }

const dayMs = 86_400_000
const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`)
const r1 = (x: number) => Math.round(x * 10) / 10

export interface SignalStats {
  /** closed trades of the same kind and source */
  n: number
  winRate: number | null
  /** average result per trade after costs, $ */
  avgPnl: number | null
  /** share that reached the target (TP), % */
  tpRate: number | null
  /** n < TRUST_MIN */
  thin: boolean
}

export const sourceOf = (t: Pick<PracticePosition, 'info'>) => t.info.pick?.source ?? 'chart'
export const kindOf = (t: Pick<PracticePosition, 'kind'>): PracticeKind => t.kind ?? 'day'

/** Win rate of past trades like this one (same kind: day/long, same pick source). Real record only. */
export function signalStats(trades: PracticeTrade[], kind: PracticeKind, source: string): SignalStats {
  const same = trades.filter((t) => kindOf(t) === kind && sourceOf(t) === source)
  const n = same.length
  if (!n) return { n: 0, winRate: null, avgPnl: null, tpRate: null, thin: true }
  const wins = same.filter((t) => t.pnl > 0).length
  const tp = same.filter((t) => t.exitReason === 'target').length
  const pnl = same.reduce((a, t) => a + t.pnl, 0)
  return { n, winRate: Math.round((wins / n) * 100), avgPnl: Math.round((pnl / n) * 100) / 100, tpRate: Math.round((tp / n) * 100), thin: n < TRUST_MIN }
}

export interface Signal {
  id: string
  symbol: string
  kind: PracticeKind
  source: string
  entry: number
  tp: number
  sl: number
  tpPct: number
  slPct: number
  openedAt: number
  /** open now, or closed today with its result */
  status: 'open' | 'win' | 'loss'
  pnl?: number
  stats: SignalStats
}

const toSignal = (p: PracticePosition, trades: PracticeTrade[], closed?: PracticeTrade): Signal => ({
  id: p.id,
  symbol: p.symbol,
  kind: kindOf(p),
  source: sourceOf(p),
  entry: p.entry,
  tp: p.target,
  sl: p.stop,
  tpPct: r1((p.target / p.entry - 1) * 100),
  slPct: r1((p.stop / p.entry - 1) * 100),
  openedAt: p.openedAt,
  status: closed ? (closed.pnl > 0 ? 'win' : 'loss') : 'open',
  pnl: closed?.pnl,
  // the record before this trade, so a closed one doesn't count itself
  stats: signalStats(closed ? trades.filter((t) => t.id !== closed.id) : trades, kindOf(p), sourceOf(p)),
})

/** Signals = trades Atlas really took: the open ones first, then the ones closed on `day` (ET day key). */
export function atlasSignals(s: PracticeState, day: string, dayOf: (ms: number) => string): Signal[] {
  const open = s.open.map((p) => toSignal(p, s.trades)).sort((a, b) => b.openedAt - a.openedAt)
  const closed = s.trades.filter((t) => dayOf(t.closedAt) === day).sort((a, b) => b.closedAt - a.closedAt).map((t) => toSignal(t, s.trades, t))
  return [...open, ...closed]
}

export interface LearnTest {
  id: 'l1' | 'l2' | 'l3' | 'l4' | 'vol' | 'kronos'
  label: Bi
  /** two or three words, for the Hub card */
  short: Bi
  /** what it measures, one line */
  what: Bi
  n: number
  goal: number
  unit: 'trades' | 'days'
  pct: number
}

/** Days since the tests started (L3 counts days, it rebalances monthly and has no trades to count). */
export const learnDays = (now: number) => Math.max(0, Math.min(14, Math.floor((now - dayNum(LEARN_START_DAY)) / dayMs)))
export const daysLeft = (now: number) => Math.max(0, Math.ceil((dayNum(REVIEW_DAY) - now) / dayMs))

/** The six shadow tests, with how much data each has toward its goal. */
export function learnTests(trades: PracticeTrade[], leads: LeadsReport | null, now: number): LearnTest[] {
  const live = trades.filter((t) => t.info.shadow)
  const kron = live.filter((t) => (t.info.shadow?.kronos ?? 'n/a') !== 'n/a').length
  const days = learnDays(now)
  const T = (id: LearnTest['id'], label: Bi, what: Bi, n: number, goal = LEARN_GOAL, unit: LearnTest['unit'] = 'trades'): LearnTest => ({ id, label, short: SHORT[id], what, n, goal, unit, pct: Math.min(100, Math.round((n / goal) * 100)) })
  return [
    T('l1', { en: 'L1 Reversal when VIX is high', vi: 'L1 Đảo chiều khi VIX cao' }, { en: 'Buy the 5-day losers when fear is high, sell after 5 days', vi: 'Mua mã giảm mạnh 5 ngày khi thị trường sợ, bán sau 5 ngày' }, leads?.l1.n ?? 0),
    T('l2', { en: 'L2 Hold winners overnight', vi: 'L2 Giữ lệnh thắng qua đêm' }, { en: 'Would selling winners at the next open beat selling before the close?', vi: 'Bán lệnh thắng sáng hôm sau có hơn bán trước giờ đóng cửa?' }, leads?.l2.n ?? 0),
    T('l3', { en: 'L3 ETF trend', vi: 'L3 ETF theo xu hướng' }, { en: 'Hold the strongest ETFs, compared with SPY', vi: 'Giữ các ETF mạnh nhất, so với SPY' }, leads?.l3 ? days : 0, 14, 'days'),
    T('l4', { en: 'L4 Big gainers, sell next morning', vi: 'L4 Mua mã tăng mạnh, bán sáng mai' }, { en: 'Buy a +3% day on 2x volume at the close, sell at the next open', vi: 'Mua mã tăng 3%+ với khối lượng gấp đôi lúc đóng cửa, bán lúc mở cửa' }, leads?.l4.n ?? 0),
    T('vol', { en: 'Volume filter ≥ 1x', vi: 'Lọc khối lượng ≥ 1x' }, { en: 'Do trades on normal-or-better volume win more?', vi: 'Lệnh có khối lượng từ bình thường trở lên có thắng hơn không?' }, live.length),
    T('kronos', { en: 'Kronos objects', vi: 'Kronos phản đối' }, { en: 'Do trades Kronos warned about lose more?', vi: 'Lệnh bị Kronos cảnh báo có thua nhiều hơn không?' }, kron),
  ]
}

const SHORT: Record<LearnTest['id'], Bi> = {
  l1: { en: 'L1 VIX reversal', vi: 'L1 Đảo chiều' },
  l2: { en: 'L2 Overnight', vi: 'L2 Qua đêm' },
  l3: { en: 'L3 ETF trend', vi: 'L3 ETF' },
  l4: { en: 'L4 Big gainers', vi: 'L4 Tăng mạnh' },
  vol: { en: 'Volume ≥1x', vi: 'Khối lượng' },
  kronos: { en: 'Kronos', vi: 'Kronos' },
}

export interface LearnProgress {
  tests: LearnTest[]
  /** average progress of the tests toward their goal, % */
  pct: number
  daysLeft: number
  reviewDay: string
  /** the test with the most data so far, null when all are at 0 */
  lead: LearnTest | null
}

export function learnProgress(trades: PracticeTrade[], leads: LeadsReport | null, now: number): LearnProgress {
  const tests = learnTests(trades, leads, now)
  const pct = Math.round(tests.reduce((a, t) => a + t.pct, 0) / tests.length)
  const lead = [...tests].sort((a, b) => b.pct - a.pct)[0]
  return { tests, pct, daysLeft: daysLeft(now), reviewDay: REVIEW_DAY, lead: lead && lead.pct > 0 ? lead : null }
}

export interface AtlasVerdict {
  level: 'learning' | 'hint' | 'none'
  title: Bi
  line: Bi
  n: number
  winRate: number | null
  net: number
  pf: number | null
  gross: number | null
  costs: number | null
}

/**
 * One honest sentence. "hint" needs 100+ trades, profit factor ≥ 1.1 and a positive net, and still says
 * it is not proven; a real edge is only claimed by the review on REVIEW_DAY, never here.
 */
export function atlasVerdict(trades: PracticeTrade[]): AtlasVerdict {
  const n = trades.length
  const wins = trades.filter((t) => t.pnl > 0)
  const net = Math.round(trades.reduce((a, t) => a + t.pnl, 0) * 100) / 100
  const up = wins.reduce((a, t) => a + t.pnl, 0)
  const down = -trades.filter((t) => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0)
  const pf = down > 0 ? Math.round((up / down) * 100) / 100 : null
  const withCost = trades.filter((t) => t.costPaid != null && t.gross != null)
  const gross = withCost.length ? Math.round(withCost.reduce((a, t) => a + (t.gross ?? 0), 0) * 100) / 100 : null
  const costs = withCost.length ? Math.round(withCost.reduce((a, t) => a + (t.costPaid ?? 0), 0) * 100) / 100 : null
  const winRate = n ? Math.round((wins.length / n) * 100) : null
  const money = (x: number) => `${x < 0 ? '−' : '+'}$${Math.abs(x).toFixed(0)}`
  const base = { n, winRate, net, pf, gross, costs }
  if (!n)
    return { ...base, level: 'none', title: { en: 'No trades yet', vi: 'Chưa có lệnh nào' }, line: { en: 'Atlas has not closed a practice trade yet.', vi: 'Atlas chưa đóng lệnh tập nào.' } }
  const rec = { en: `${n} practice trades: ${winRate}% won, ${money(net)}.`, vi: `${n} lệnh tập: thắng ${winRate}%, ${money(net)}.` }
  if (n >= 100 && pf != null && pf >= 1.1 && net > 0)
    return { ...base, level: 'hint', title: { en: 'Promising, not proven yet', vi: 'Có dấu hiệu tốt, chưa chắc chắn' }, line: { en: `${rec.en} Still practice only until the ${REVIEW_DAY.slice(8, 10)}/${REVIEW_DAY.slice(5, 7)} review.`, vi: `${rec.vi} Vẫn chỉ tập đến lần chấm điểm ${REVIEW_DAY.slice(8, 10)}/${REVIEW_DAY.slice(5, 7)}.` } }
  return {
    ...base,
    level: 'learning',
    title: { en: 'Learning. No edge yet.', vi: 'Đang học. Chưa có lợi thế.' },
    line: { en: `${rec.en} These signals are for watching and testing, not real money.`, vi: `${rec.vi} Tín hiệu chỉ để xem và kiểm chứng, chưa dùng tiền thật.` },
  }
}

export interface WhyToday {
  day: string | null
  decisions: number
  accepted: number
  /** blocked counts by the check that stopped it, biggest first */
  blocked: { by: string; n: number }[]
}

/** Why Atlas did or didn't trade on its last scan day (same count as atlas-status `diag.today`). */
export function whyToday(s: PracticeState, dayOf: (ms: number) => string): WhyToday {
  const last = s.server?.lastRun ?? (s.audit?.[0]?.time ?? null)
  const day = last ? dayOf(last) : null
  const audit = (s.audit ?? []).filter((e) => e.account === 'practice' && day && dayOf(e.time) === day)
  const m: Record<string, number> = {}
  for (const e of audit) if (!e.accepted) m[e.blockedBy ?? 'Other'] = (m[e.blockedBy ?? 'Other'] ?? 0) + 1
  return { day, decisions: audit.length, accepted: audit.filter((e) => e.accepted).length, blocked: Object.entries(m).map(([by, n]) => ({ by, n })).sort((a, b) => b.n - a.n) }
}

/** Plain names for the checks that block a trade (src/lib/practiceScan.ts gates). */
export const BLOCK_LABEL: Record<string, Bi> = {
  Slots: { en: 'out of slots or already held', vi: 'hết lượt hoặc đang giữ mã' },
  Other: { en: 'other', vi: 'lý do khác' },
}
