/**
 * 24/7 auto learning. Each cycle:
 *  - Old trades: replays a chunk of past bars on two rotating markets, as if each bar
 *    were "now". Every bar is scored by the whole analyst (trading-analyst rules,
 *    Trade Score, volatility rule, sizing ladder) plus simple mechanical signals,
 *    then graded against what price actually did HORIZON bars later.
 *  - New bars: every bar that closed since the last cycle is scored the same way and
 *    waits until HORIZON more bars exist, then it is graded. AI calls on new bars
 *    make the self-scorecard, and the PAPER arena trades them with simulated money.
 *  - Every graded AI call goes into the trade-journal learner, which only says BUY
 *    when a score bucket beats always-buy by a margin.
 *
 * Learning here means measured outcomes and a calibrated learner, not a retrained
 * neural network. The same code runs in the browser and in the hourly server job.
 * Paper only: nothing here places an order with any broker.
 */
import type { Candle, OrderFlow } from '../types'
import { runStrategy } from './strategy'
import { analyze } from './analyst'
import { macd, rsi, sma } from './indicators'
import type { AiRules } from './aiRules'
import { baseRate, BUCKETS, calibrate, decide, MIN_TRADES, type JournalEntry } from './journal'

/** Bars between a call and its grade. */
export const HORIZON = 5
const WARMUP = 120
const WINDOW = 250
/** Old bars per market per cycle, and markets per cycle (the server passes bigger numbers). */
export const OLD_CHUNK = 150
export const OLD_MARKETS_PER_CYCLE = 2
const MAX_NEW_PER_CYCLE = 200
const MAX_JOURNAL = 2000
const MAX_LOG = 120
const MAX_PENDING = 600
const MAX_ARENA_TRADES = 60
const RECENT = 20
export const ARENA_START = 10_000
/** How often a cycle runs in the browser while the app is open. */
export const CYCLE_MS = 60 * 60_000

/**
 * The server job's schedule (keep in step with .github/workflows/auto-learn.yml): minute 17
 * of every hour 13:00-21:00 UTC on weekdays (US market hours) and 12:17 UTC on weekends.
 * About 210 runs a month, well inside GitHub's free 2,000 minutes. New bars missed
 * overnight are scored on the next run, so no bars are skipped.
 */
export function nextServerRun(nowMs: number): number {
  const d = new Date(nowMs)
  d.setUTCMinutes(17, 0, 0)
  if (d.getTime() <= nowMs) d.setUTCHours(d.getUTCHours() + 1)
  for (let k = 0; k < 72; k++) {
    const day = d.getUTCDay()
    const h = d.getUTCHours()
    const weekday = day >= 1 && day <= 5
    if ((weekday && h >= 13 && h <= 21) || (!weekday && h === 12)) return d.getTime()
    d.setUTCHours(h + 1)
  }
  return d.getTime()
}

export type SignalKey =
  | 'every_bar'
  | 'ai_buy'
  | 'ai_sell'
  | 'ai_buy_strong'
  | 'ai_buy_sized'
  | 'robot_buy'
  | 'robot_sell'
  | 'sma_up'
  | 'sma_down'
  | 'macd_up'
  | 'macd_down'
  | 'rsi_exit_oversold'
  | 'rsi_exit_overbought'

/** The playbook: every method the learner grades. side 1 = expects up, -1 = expects down. */
export const SIGNALS: { key: SignalKey; side: 1 | -1; en: string; vi: string }[] = [
  { key: 'every_bar', side: 1, en: 'Buy every bar (baseline)', vi: 'Mua mọi nến (mốc so sánh)' },
  { key: 'ai_buy', side: 1, en: 'AI analyst BUY', vi: 'Phân tích AI: MUA' },
  { key: 'ai_sell', side: -1, en: 'AI analyst SELL', vi: 'Phân tích AI: BÁN' },
  { key: 'ai_buy_strong', side: 1, en: 'AI BUY with Trade Score 70+', vi: 'AI MUA với Điểm Giao dịch 70+' },
  { key: 'ai_buy_sized', side: 1, en: 'AI BUY that passes sizing and volatility rules', vi: 'AI MUA đạt quy tắc khối lượng và biến động' },
  { key: 'robot_buy', side: 1, en: 'Robot buy signal', vi: 'Tín hiệu mua của robot' },
  { key: 'robot_sell', side: -1, en: 'Robot sell signal', vi: 'Tín hiệu bán của robot' },
  { key: 'sma_up', side: 1, en: 'SMA 20 crosses above SMA 50', vi: 'SMA 20 cắt lên SMA 50' },
  { key: 'sma_down', side: -1, en: 'SMA 20 crosses below SMA 50', vi: 'SMA 20 cắt xuống SMA 50' },
  { key: 'macd_up', side: 1, en: 'MACD crosses up', vi: 'MACD cắt lên' },
  { key: 'macd_down', side: -1, en: 'MACD crosses down', vi: 'MACD cắt xuống' },
  { key: 'rsi_exit_oversold', side: 1, en: 'RSI leaves oversold (back above 30)', vi: 'RSI thoát vùng quá bán (lên trên 30)' },
  { key: 'rsi_exit_overbought', side: -1, en: 'RSI leaves overbought (back below 70)', vi: 'RSI thoát vùng quá mua (xuống dưới 70)' },
]
const SIDE = Object.fromEntries(SIGNALS.map((s) => [s.key, s.side])) as Record<SignalKey, 1 | -1>

export interface SigStat {
  n: number
  wins: number
  /** Sum of returns in the signal's direction, percent. */
  sumRet: number
  /** Last RECENT outcomes, 1 = win, 0 = loss, oldest first. */
  recent: number[]
}

export interface Pending {
  symbol: string
  time: number
  entry: number
  keys: SignalKey[]
  verdict: 'BUY' | 'SELL' | 'HOLD'
  score: number
  /** Simulated dollars the PAPER arena put on this call (0 = not traded). */
  notional: number
}

export interface ArenaTrade {
  symbol: string
  openedAt: number
  closedAt: number
  entry: number
  exit: number
  notional: number
  pnl: number
}

export interface LogEntry {
  time: number // ms
  kind: 'cycle' | 'correction' | 'preference'
  en: string
  vi: string
}

export interface MarketCursor {
  /** Old-trade replay has covered every bar from this time onward. */
  oldBefore: number
  /** Latest closed bar already scored as a new bar. */
  lastSeen: number
  oldDone: boolean
}

export interface LearnState {
  v: 1
  source: 'browser' | 'server'
  cycles: number
  oldTests: number
  newBars: number
  lastCycle: number | null // ms
  rotate: number
  markets: Record<string, MarketCursor>
  /** Graded outcomes per market and signal, old and new together. */
  stats: Record<string, Partial<Record<SignalKey, SigStat>>>
  /** New bars only, all markets: the forward record. */
  forward: Partial<Record<SignalKey, SigStat>>
  journal: JournalEntry[]
  pending: Pending[]
  score: { right: number; wrong: number }
  arena: { realized: number; peak: number; trades: ArenaTrade[]; n: number; wins: number; skipped: { learner: number; drawdown: number; busy: number } }
  log: LogEntry[]
  latest: { en: string; vi: string } | null
}

export function emptyState(source: LearnState['source']): LearnState {
  return {
    v: 1,
    source,
    cycles: 0,
    oldTests: 0,
    newBars: 0,
    lastCycle: null,
    rotate: 0,
    markets: {},
    stats: {},
    forward: {},
    journal: [],
    pending: [],
    score: { right: 0, wrong: 0 },
    arena: { realized: 0, peak: ARENA_START, trades: [], n: 0, wins: 0, skipped: { learner: 0, drawdown: 0, busy: 0 } },
    log: [],
    latest: null,
  }
}

/** Accept a saved or downloaded state only if it has the expected shape. */
export function parseState(raw: unknown): LearnState | null {
  const s = raw as LearnState | null
  if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.journal) || !Array.isArray(s.pending) || !s.stats || !s.arena || !Array.isArray(s.log)) return null
  s.arena.skipped ??= { learner: 0, drawdown: 0, busy: 0 }
  s.forward ??= {}
  return s
}

const NO_FLOW: OrderFlow = { bids: [], asks: [], trades: [], buyVolume: 0, sellVolume: 0, windowSec: 0, hasBook: false, estimated: true, source: 'replay', live: false }

interface Indicators {
  close: number[]
  s20: (number | null)[]
  s50: (number | null)[]
  hist: (number | null)[]
  rsi: (number | null)[]
}

function indicators(c: Candle[]): Indicators {
  const close = c.map((x) => x.close)
  return { close, s20: sma(close, 20), s50: sma(close, 50), hist: macd(close).hist, rsi: rsi(close, 14) }
}

interface BarCall {
  keys: SignalKey[]
  verdict: 'BUY' | 'SELL' | 'HOLD'
  score: number
  sizePct: number
}

/** Score bar i exactly as the app would have if it were the latest closed bar. */
function scoreBar(c: Candle[], ind: Indicators, i: number, rules: AiRules): BarCall {
  const keys: SignalKey[] = ['every_bar']
  const crossed = (a: (number | null)[], b: (number | null)[] | number, up: boolean) => {
    const bi = typeof b === 'number' ? b : b[i]
    const bp = typeof b === 'number' ? b : b[i - 1]
    const ai = a[i]
    const ap = a[i - 1]
    if (ai == null || ap == null || bi == null || bp == null) return false
    return up ? ap <= bp && ai > bi : ap >= bp && ai < bi
  }
  if (crossed(ind.s20, ind.s50, true)) keys.push('sma_up')
  if (crossed(ind.s20, ind.s50, false)) keys.push('sma_down')
  if (crossed(ind.hist, 0, true)) keys.push('macd_up')
  if (crossed(ind.hist, 0, false)) keys.push('macd_down')
  if (crossed(ind.rsi, 30, true)) keys.push('rsi_exit_oversold')
  if (crossed(ind.rsi, 70, false)) keys.push('rsi_exit_overbought')

  const win = c.slice(Math.max(0, i - WINDOW + 1), i + 1)
  const strat = runStrategy(win)
  const last = strat.signals[strat.signals.length - 1]
  if (last && last.index === win.length - 1) keys.push(last.side === 'buy' ? 'robot_buy' : 'robot_sell')
  const a = analyze(win, strat, strat.prediction, NO_FLOW, rules)
  const verdict = a?.verdict ?? 'HOLD'
  const sizePct = a?.sizing?.pctOfAccount ?? 0
  if (verdict === 'BUY') {
    keys.push('ai_buy')
    if (a?.tradeScore && a.tradeScore.score >= 70) keys.push('ai_buy_strong')
    if (sizePct > 0) keys.push('ai_buy_sized')
  } else if (verdict === 'SELL') keys.push('ai_sell')
  return { keys, verdict, score: strat.prediction?.probUp ?? 0.5, sizePct }
}

function bump(table: Partial<Record<SignalKey, SigStat>>, key: SignalKey, retPct: number) {
  const s = (table[key] ??= { n: 0, wins: 0, sumRet: 0, recent: [] })
  const r = retPct * SIDE[key]
  s.n++
  s.sumRet += r
  if (r > 0) s.wins++
  s.recent.push(r > 0 ? 1 : 0)
  if (s.recent.length > RECENT) s.recent.shift()
}

function grade(st: LearnState, symbol: string, call: { keys: SignalKey[]; verdict: string; score: number }, time: number, entry: number, exitTime: number, exit: number, forward: boolean) {
  const ret = (exit / entry - 1) * 100
  const table = (st.stats[symbol] ??= {})
  for (const k of call.keys) {
    bump(table, k, ret)
    if (forward) bump(st.forward, k, ret)
  }
  if (call.verdict === 'BUY' || call.verdict === 'SELL') {
    st.journal.push({ id: `${symbol}|${time}`, symbol, signal: call.verdict, score: +call.score.toFixed(3), openedAt: time, entryPrice: entry, exitAt: exitTime, exitPrice: exit })
    if (st.journal.length > MAX_JOURNAL) st.journal.splice(0, st.journal.length - MAX_JOURNAL)
    if (forward) {
      if ((call.verdict === 'BUY' ? ret : -ret) > 0) st.score.right++
      else st.score.wrong++
    }
  }
}

/** First index whose bar time is >= t (n when none). */
function lowerBound(c: Candle[], t: number) {
  let lo = 0
  let hi = c.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (c[mid].time < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

export const arenaEquity = (st: LearnState) => ARENA_START + st.arena.realized

/** PAPER arena entry: the analyst's size, the learner's veto once it has data, and the risk gates that apply to simulated money. */
function arenaNotional(st: LearnState, symbol: string, call: BarCall, rules: AiRules): number {
  if (call.verdict !== 'BUY' || call.sizePct <= 0) return 0
  const skip = (k: keyof LearnState['arena']['skipped']) => (st.arena.skipped[k]++, 0)
  if (st.pending.some((p) => p.symbol === symbol && p.notional > 0)) return skip('busy') // one open trade per market
  const eq = arenaEquity(st)
  if (rules.gatesOn && eq < st.arena.peak * (1 - rules.maxDrawdownPct / 100)) return skip('drawdown')
  if (baseRate(st.journal) && decide(st.journal, call.score, 0.55, rules.learnEdgeMarginPct / 100).signal !== 'BUY') return skip('learner')
  const open = st.pending.reduce((a, p) => a + p.notional, 0)
  const size = Math.min(eq * call.sizePct, eq * (rules.maxPositionPct / 100), Math.max(0, eq - open))
  return Math.floor(size)
}

export interface CycleReport {
  oldTested: number
  newTested: number
  graded: number
  markets: string[]
  failed: { symbol: string; error: string }[]
}

export type CandleSource = (symbol: string) => Promise<Candle[]>

/**
 * One learning cycle over `symbols`. `fetchCandles` returns bars oldest first; the last
 * (possibly still forming) bar is dropped so only closed bars are ever scored.
 */
export async function runCycle(
  prev: LearnState,
  symbols: string[],
  fetchCandles: CandleSource,
  rules: AiRules,
  now = Date.now(),
  pace = { oldChunk: OLD_CHUNK, oldMarkets: OLD_MARKETS_PER_CYCLE },
): Promise<{ state: LearnState; report: CycleReport }> {
  const st: LearnState = structuredClone(prev)
  const report: CycleReport = { oldTested: 0, newTested: 0, graded: 0, markets: [], failed: [] }
  const needOld = symbols.filter((s) => !st.markets[s]?.oldDone)
  const oldSet = new Set<string>()
  for (let k = 0; k < Math.min(pace.oldMarkets, needOld.length); k++) oldSet.add(needOld[(st.rotate + k) % needOld.length])
  st.rotate = (st.rotate + pace.oldMarkets) % Math.max(1, needOld.length)
  const oldBySym: Record<string, number> = {}

  for (const symbol of symbols) {
    let c: Candle[]
    try {
      c = (await fetchCandles(symbol)).slice(0, -1)
    } catch (e) {
      report.failed.push({ symbol, error: e instanceof Error ? e.message : String(e) })
      continue
    }
    const n = c.length
    if (n < WARMUP + HORIZON + 10) {
      report.failed.push({ symbol, error: `only ${n} bars` })
      continue
    }
    report.markets.push(symbol)
    const ind = indicators(c)
    const cur = (st.markets[symbol] ??= { oldBefore: c[n - 1].time + 1, lastSeen: c[n - 1].time, oldDone: false })

    // 1) grade new-bar calls whose HORIZON bars have now closed
    st.pending = st.pending.filter((p) => {
      if (p.symbol !== symbol) return true
      const i = lowerBound(c, p.time)
      if (i >= n || c[i].time !== p.time) return now - p.time * 1000 < 14 * 86400_000 // gap in the data: give up after two weeks
      if (i + HORIZON > n - 1) return true
      const exit = c[i + HORIZON]
      grade(st, symbol, p, p.time, p.entry, exit.time, exit.close, true)
      if (p.notional > 0) {
        const pnl = p.notional * (exit.close / p.entry - 1)
        st.arena.realized += pnl
        st.arena.peak = Math.max(st.arena.peak, arenaEquity(st))
        st.arena.n++
        if (pnl > 0) st.arena.wins++
        st.arena.trades.push({ symbol, openedAt: p.time, closedAt: exit.time, entry: p.entry, exit: exit.close, notional: p.notional, pnl: +pnl.toFixed(2) })
        if (st.arena.trades.length > MAX_ARENA_TRADES) st.arena.trades.shift()
      }
      report.graded++
      return false
    })

    // 2) score bars that closed since the last cycle
    let from = lowerBound(c, cur.lastSeen + 1)
    from = Math.max(from, WARMUP, n - MAX_NEW_PER_CYCLE)
    for (let i = from; i < n; i++) {
      const call = scoreBar(c, ind, i, rules)
      const notional = arenaNotional(st, symbol, call, rules)
      st.pending.push({ symbol, time: c[i].time, entry: c[i].close, keys: call.keys, verdict: call.verdict, score: call.score, notional })
      report.newTested++
      st.newBars++
    }
    cur.lastSeen = c[n - 1].time
    if (st.pending.length > MAX_PENDING) st.pending.splice(0, st.pending.length - MAX_PENDING)

    // 3) old trades: replay a chunk of history just before what is already covered
    if (oldSet.has(symbol) && !cur.oldDone) {
      const end = Math.min(lowerBound(c, cur.oldBefore), n - HORIZON)
      const start = Math.max(WARMUP, end - pace.oldChunk)
      for (let i = start; i < end; i++) {
        const call = scoreBar(c, ind, i, rules)
        grade(st, symbol, call, c[i].time, c[i].close, c[i + HORIZON].time, c[i + HORIZON].close, false)
        st.oldTests++
        report.oldTested++
        oldBySym[symbol] = (oldBySym[symbol] ?? 0) + 1
      }
      if (start < end) cur.oldBefore = c[start].time
      if (start <= WARMUP) cur.oldDone = true
    }
    await new Promise((r) => setTimeout(r, 0)) // let the page breathe between markets
  }

  st.cycles++
  st.lastCycle = now
  st.latest = summarize(st, report, oldBySym)
  st.log.unshift({ time: now, kind: 'cycle', ...st.latest })
  if (st.log.length > MAX_LOG) st.log.length = MAX_LOG
  return { state: st, report }
}

// ---------- read-outs ----------

export const winRate = (s?: SigStat) => (s && s.n ? s.wins / s.n : null)
export const avgRet = (s?: SigStat) => (s && s.n ? s.sumRet / s.n : null)

/** Recent vs overall: needs 10+ graded outcomes, and a 10-point change to call it a trend. */
export function trendOf(s?: SigStat): 'insufficient' | 'improving' | 'worsening' | 'flat' {
  if (!s || s.n < 10 || s.recent.length < 10) return 'insufficient'
  const recent = s.recent.reduce((a, b) => a + b, 0) / s.recent.length
  const all = s.wins / s.n
  return recent - all > 0.1 ? 'improving' : all - recent > 0.1 ? 'worsening' : 'flat'
}

/** One market's table, or every market added together when symbol is null. */
export function statsFor(st: LearnState, symbol: string | null): Partial<Record<SignalKey, SigStat>> {
  if (symbol) return st.stats[symbol] ?? {}
  const out: Partial<Record<SignalKey, SigStat>> = {}
  for (const table of Object.values(st.stats))
    for (const [k, s] of Object.entries(table) as [SignalKey, SigStat][]) {
      const o = (out[k] ??= { n: 0, wins: 0, sumRet: 0, recent: [] })
      o.n += s.n
      o.wins += s.wins
      o.sumRet += s.sumRet
      o.recent = [...o.recent, ...s.recent].slice(-RECENT)
    }
  return out
}

/** Signals with enough outcomes that beat the buy-every-bar baseline by 5+ points. */
export function beatsBaseline(table: Partial<Record<SignalKey, SigStat>>, minN = 30) {
  const base = winRate(table.every_bar)
  if (base == null) return []
  return SIGNALS.filter((s) => s.key !== 'every_bar')
    .map((s) => ({ ...s, stat: table[s.key]! }))
    .filter((s) => s.stat && s.stat.n >= minN && s.side === 1 && winRate(s.stat)! >= base + 0.05)
    .sort((a, b) => winRate(b.stat)! - winRate(a.stat)!)
}

export interface BucketRow {
  from: number
  to: number
  n: number
  learned: number | null
}

/** The learner's view: base rate and learned hit rate per model-score bucket (BUY calls). */
export function learnerView(st: LearnState) {
  const base = baseRate(st.journal)
  const rows: BucketRow[] = []
  for (let b = 0; b < BUCKETS; b++) {
    const mid = (b + 0.5) / BUCKETS
    const c = calibrate(st.journal, mid)
    rows.push({ from: b / BUCKETS, to: (b + 1) / BUCKETS, n: c?.n ?? 0, learned: c && c.n > 0 ? c.probability : null })
  }
  const closedBuys = st.journal.filter((e) => e.signal === 'BUY').length
  return { base, rows, closedBuys, minTrades: MIN_TRADES }
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`

function summarize(st: LearnState, r: CycleReport, oldBy: Record<string, number>): { en: string; vi: string } {
  const oldPart = Object.entries(oldBy)
  const oldEn = oldPart.length ? oldPart.map(([s, k]) => `${k} old bars on ${s}`).join(' and ') : 'no old bars (history fully replayed)'
  const oldVi = oldPart.length ? oldPart.map(([s, k]) => `${k} nến cũ của ${s}`).join(' và ') : 'không có nến cũ (đã chạy lại hết lịch sử)'
  const all = statsFor(st, null)
  const best = beatsBaseline(all)[0]
  const base = winRate(all.every_bar)
  const bestEn = best
    ? `Best so far: ${best.en} wins ${pct(winRate(best.stat)!)} over ${best.stat.n} tests vs ${pct(base!)} for buying every bar.`
    : base != null
      ? `No method beats buying every bar (${pct(base)}) by 5 points yet.`
      : ''
  const bestVi = best
    ? `Tốt nhất hiện tại: ${best.vi} thắng ${pct(winRate(best.stat)!)} qua ${best.stat.n} lần thử so với ${pct(base!)} khi mua mọi nến.`
    : base != null
      ? `Chưa có phương pháp nào hơn mua mọi nến (${pct(base)}) 5 điểm.`
      : ''
  const lv = baseRate(st.journal)
  const learnEn = lv ? `Learner base rate ${pct(lv.probability)} from ${lv.n} graded AI buys.` : `Learner needs ${MIN_TRADES} graded AI buys (has ${st.journal.filter((e) => e.signal === 'BUY').length}).`
  const learnVi = lv ? `Tỷ lệ gốc của bộ học ${pct(lv.probability)} từ ${lv.n} lệnh MUA của AI đã chấm.` : `Bộ học cần ${MIN_TRADES} lệnh MUA của AI đã chấm (đang có ${st.journal.filter((e) => e.signal === 'BUY').length}).`
  const failEn = r.failed.length ? ` Skipped ${r.failed.map((f) => f.symbol).join(', ')} (no data).` : ''
  const failVi = r.failed.length ? ` Bỏ qua ${r.failed.map((f) => f.symbol).join(', ')} (không có dữ liệu).` : ''
  return {
    en: `Cycle ${st.cycles} replayed ${oldEn}, scored ${r.newTested} new bars and graded ${r.graded} waiting calls. ${bestEn} ${learnEn}${failEn}`.replace(/\s+/g, ' ').trim(),
    vi: `Chu kỳ ${st.cycles} chạy lại ${oldVi}, chấm ${r.newTested} nến mới và chấm điểm ${r.graded} lệnh đang chờ. ${bestVi} ${learnVi}${failVi}`.replace(/\s+/g, ' ').trim(),
  }
}
