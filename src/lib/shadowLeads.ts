/**
 * Atlas shadow leads ("chạy bóng" for the three leads the replay labs found, approved by Chanh 2026-11-01).
 * Shadow = record what each lead WOULD do and its paper result. Nothing here places, changes, blocks or closes a
 * real paper trade; it reads closed trades and public daily bars and writes only its own KV keys. Pure functions:
 * src/worker/shadowLeads.ts does the fetching and the KV I/O.
 *
 *  L1 "D1 + VIX gate" (replayDaily D1, replayRound2 E1-A): after the US close rank the universe by 5-day return;
 *     when the VIX close is >= its trailing 252-day median, open a $1,000 shadow long in the bottom 10% at the NEXT
 *     open, hold 5 trading days (the entry day is day 1), exit at the close. Costs: costsFrom(DEFAULT_AI_RULES).
 *  L2 "Hold winners overnight": Atlas's own day trades closed by the before-close rule (not stop or target) that
 *     were up >= 1% net. Shadow result = sold at the NEXT session's open instead, with the costs stored on the trade.
 *  L3 "ETF trend core" (replayRound2 E3): each month's first run, hold each ETF whose 12-month return skipping the
 *     last month is > 0 at weight 1/N (N = ETFs with a signal), the rest in cash, from $10,000, with rebalance
 *     costs, against SPY buy-and-hold from the same day. Only daily closes are used, so a rebalance fills at that
 *     day's close (the lab filled at the next open); the signal itself uses month-end closes only.
 */
import { feeFor, fillPrice, type Costs } from './costs'
import { dayKey, kindOf, type PracticeTrade } from './practice'
import { ETF_UNIVERSE, sideCost } from './replayRound2'
import { netRetPct } from './replayStrategies'

export const L1_NOTIONAL = 1000
export const L1_HOLD = 5
export const L1_DECILE = 0.1
export const L2_MIN_RET = 1
export const L3_START = 10_000
/** Trades kept per lead; totals are kept apart so they stay exact after older rows drop off. */
export const KEEP = 200
export const CURVE_KEEP = 400

/** [YYYY-MM-DD in US Eastern, close or open], oldest first. */
export type Px = [string, number][]
export type Opens = Record<string, Px>

export interface Agg {
  n: number
  wins: number
  /** Sum of per-trade percent returns. */
  sumRet: number
  /** Total paper result in dollars. */
  total: number
}
const emptyAgg = (): Agg => ({ n: 0, wins: 0, sumRet: 0, total: 0 })
const addAgg = (a: Agg, ret: number, pnl: number): Agg => ({ n: a.n + 1, wins: a.wins + (pnl > 0 ? 1 : 0), sumRet: a.sumRet + ret, total: a.total + pnl })
const keep = <T>(rows: T[], x: T): T[] => [...rows, x].slice(-KEEP)

// ---- L1 ----

export interface L1Pending { sym: string; signalDay: string; ret5: number }
export interface L1Pos { sym: string; signalDay: string; entryDay: string; entry: number }
export interface L1Trade { sym: string; entryDay: string; exitDay: string; entry: number; exit: number; retPct: number; pnl: number }
export interface L1State { pending: L1Pending[]; open: L1Pos[]; trades: L1Trade[]; agg: Agg; gateDays: number; signalDays: number }
export const emptyL1 = (): L1State => ({ pending: [], open: [], trades: [], agg: emptyAgg(), gateDays: 0, signalDays: 0 })

/** VIX close on the last day >= the median of its last `n` closes (that day included). False until `n` closes exist. */
export function vixGateOpen(closes: number[], n = 252): boolean {
  if (closes.length < n) return false
  const w = closes.slice(-n).sort((a, b) => a - b)
  const med = (w[(n - 1) >> 1] + w[n >> 1]) / 2
  return closes[closes.length - 1] >= med
}

/** Bars up to and including `day` only. */
const upTo = (px: Px, day: string): Px => px.filter(([d]) => d <= day)

/** Bottom 10% by 5-day return on `day` (needs a bar that day and 5 bars before it; at least 10 names). Data after
 *  `day` is ignored. Ties break by symbol so the order is the same on every run. */
export function l1Rank(series: Record<string, Px>, day: string): { sym: string; ret5: number }[] {
  const rows: { sym: string; ret5: number }[] = []
  for (const [sym, all] of Object.entries(series)) {
    const px = upTo(all, day)
    if (px.length < 6 || px[px.length - 1][0] !== day) continue
    rows.push({ sym, ret5: px[px.length - 1][1] / px[px.length - 6][1] - 1 })
  }
  if (rows.length < 10) return []
  rows.sort((a, b) => a.ret5 - b.ret5 || (a.sym < b.sym ? -1 : 1))
  return rows.slice(0, Math.floor(rows.length * L1_DECILE))
}

/** First bar strictly after `day`, or null. */
export const firstAfter = (px: Px | undefined, day: string): [string, number] | null => px?.find(([d]) => d > day) ?? null

export interface L1In {
  day: string
  /** Closes per symbol (spark), enough to cover the 5-day rank and a 5-day hold. */
  series: Record<string, Px>
  /** Daily opens per symbol (chart), only for names with a pending entry. */
  opens: Opens
  /** VIX closes up to `day`, or null when they could not be fetched (then no new signals). */
  vix: number[] | null
  /** False when some of the universe is missing today, so a decile cannot be trusted: no new signals. */
  rankOk: boolean
  costs: Costs | null
}

export function l1Step(prev: L1State, a: L1In): L1State {
  const s: L1State = structuredClone(prev)
  // 1. entries: a signal from an earlier day fills at the next bar's open
  const still: L1Pending[] = []
  for (const p of s.pending) {
    if (p.signalDay >= a.day) { still.push(p); continue }
    const o = firstAfter(a.opens[p.sym], p.signalDay)
    if (o && !s.open.some((x) => x.sym === p.sym)) s.open.push({ sym: p.sym, signalDay: p.signalDay, entryDay: o[0], entry: o[1] })
    else if (!o && upTo(a.series[p.sym] ?? [], a.day).filter(([d]) => d > p.signalDay).length <= 3) still.push(p) // open not fetched yet: try again
  }
  s.pending = still
  // 2. exits: the 5th trading day from the entry day (entry day = day 1), at its close
  const open: L1Pos[] = []
  for (const p of s.open) {
    const px = upTo(a.series[p.sym] ?? [], a.day)
    const i = px.findIndex(([d]) => d === p.entryDay)
    if (i >= 0 && i + L1_HOLD - 1 < px.length) {
      const [exitDay, exit] = px[i + L1_HOLD - 1]
      const ret = netRetPct(p.entry, exit, a.costs, false)
      const pnl = +((L1_NOTIONAL * ret) / 100).toFixed(2)
      s.trades = keep(s.trades, { sym: p.sym, entryDay: p.entryDay, exitDay, entry: p.entry, exit, retPct: +ret.toFixed(3), pnl })
      s.agg = addAgg(s.agg, ret, pnl)
    } else if (i < 0 && px.length && px[0][0] > p.entryDay) {
      // the entry day fell out of the data window: drop it rather than hold it forever (never counted as a trade)
    } else open.push(p)
  }
  s.open = open
  // 3. new signals from today's close; they enter on a later run, at the next open
  if (a.rankOk && a.vix) {
    s.signalDays++
    if (vixGateOpen(a.vix)) {
      s.gateDays++
      for (const r of l1Rank(a.series, a.day))
        if (!s.open.some((x) => x.sym === r.sym) && !s.pending.some((x) => x.sym === r.sym)) s.pending.push({ sym: r.sym, signalDay: a.day, ret5: +r.ret5.toFixed(4) })
    }
  }
  return s
}

// ---- L2 ----

export interface L2Pending {
  id: string
  sym: string
  closedDay: string
  qty: number
  entry: number
  entryFee: number
  cost?: Costs
  actualPnl: number
  actualRet: number
  /** Lab proxy "strong day": the pick was up 3%+ on 2x the usual volume. null when the pick info is missing. */
  proxy: boolean | null
}
export interface L2Trade { id: string; sym: string; closedDay: string; nextDay: string; actualPnl: number; actualRet: number; shadowPnl: number; shadowRet: number; proxy: boolean | null }
export interface L2State {
  /** First day this lead ran: older trades are history, not shadow. */
  since: string
  seen: string[]
  pending: L2Pending[]
  trades: L2Trade[]
  agg: L2Agg
}
export interface L2Agg extends Agg { actualTotal: number; actualSumRet: number; proxyN: number; proxyDelta: number }
export const emptyL2 = (): L2State => ({ since: '', seen: [], pending: [], trades: [], agg: { ...emptyAgg(), actualTotal: 0, actualSumRet: 0, proxyN: 0, proxyDelta: 0 } })

type L2Src = Pick<PracticeTrade, 'id' | 'symbol' | 'qty' | 'entry' | 'entryFee' | 'cost' | 'closedAt' | 'exitReason' | 'pnl' | 'retPct' | 'kind' | 'asset' | 'info'>

/** Atlas stock day trades the before-close rule closed (not stop, target, signal) that were up >= 1% net. */
export function l2Candidates(trades: L2Src[], seen: string[], since = ''): L2Pending[] {
  const out: L2Pending[] = []
  for (const t of trades) {
    if (kindOf(t) !== 'day' || t.exitReason !== 'close' || !(t.retPct >= L2_MIN_RET) || t.asset === 'crypto' || t.symbol.includes('/') || seen.includes(t.id) || dayKey(t.closedAt) < since) continue
    const pk = t.info?.pick
    out.push({
      id: t.id,
      sym: t.symbol,
      closedDay: dayKey(t.closedAt),
      qty: t.qty,
      entry: t.entry,
      entryFee: t.entryFee ?? 0,
      ...(t.cost ? { cost: t.cost } : {}),
      actualPnl: t.pnl,
      actualRet: t.retPct,
      proxy: pk && pk.gainPct != null && pk.volVsAvg != null ? pk.gainPct >= 3 && pk.volVsAvg >= 2 : null,
    })
  }
  return out
}

/** What the same trade makes if it is sold at `open` instead (same cost model and formulas as practice.ts close()). */
export function l2Shadow(p: Pick<L2Pending, 'qty' | 'entry' | 'entryFee' | 'cost'>, open: number): { pnl: number; ret: number } {
  const price = fillPrice(open, 'sell', p.cost, false)
  const pnl = (price - p.entry) * p.qty - (p.entryFee + feeFor(price * p.qty, p.cost))
  return { pnl: +pnl.toFixed(2), ret: (pnl / (p.entry * p.qty)) * 100 }
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export function l2Step(prev: L2State, a: { day: string; trades: L2Src[]; opens: Opens }): L2State {
  const s: L2State = structuredClone(prev)
  if (!s.since) s.since = a.day
  for (const c of l2Candidates(a.trades, s.seen, s.since)) {
    s.pending.push(c)
    s.seen = [...s.seen, c.id].slice(-400)
  }
  const still: L2Pending[] = []
  for (const p of s.pending) {
    const o = firstAfter(a.opens[p.sym], p.closedDay)
    if (!o) {
      if (dayDiff(p.closedDay, a.day) <= 6) still.push(p) // next open not in yet (or not fetched): try again; after 6 days give up
      continue
    }
    const r = l2Shadow(p, o[1])
    s.trades = keep(s.trades, { id: p.id, sym: p.sym, closedDay: p.closedDay, nextDay: o[0], actualPnl: p.actualPnl, actualRet: +p.actualRet.toFixed(3), shadowPnl: r.pnl, shadowRet: +r.ret.toFixed(3), proxy: p.proxy })
    const g = s.agg
    s.agg = { ...addAgg(g, r.ret, r.pnl), actualTotal: g.actualTotal + p.actualPnl, actualSumRet: g.actualSumRet + p.actualRet, proxyN: g.proxyN + (p.proxy ? 1 : 0), proxyDelta: g.proxyDelta + (p.proxy ? r.pnl - p.actualPnl : 0) }
  }
  s.pending = still
  return s
}

// ---- L3 ----

export interface EtfData {
  lastDay: string
  last: number
  /** Last close of each complete calendar month (YYYY-MM), the latest 14. */
  me: Record<string, number>
}
export interface L3State {
  startDay: string
  cash: number
  units: Record<string, number>
  /** Last known price of each held ETF, so a missing quote does not zero a position. */
  px: Record<string, number>
  lastRebal: string
  equity: number
  spyUnits: number
  spyEquity: number
  /** [day, shadow equity, SPY equity], newest last. */
  curve: [string, number, number][]
  rebalances: number
}

export const monthOf = (day: string) => day.slice(0, 7)
export function addMonths(m: string, k: number): string {
  const [y, mo] = m.split('-').map(Number)
  const t = y * 12 + (mo - 1) + k
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** Month-end closes of a close series (complete months only: the month of the last bar is still running). */
export function etfCompact(px: Px): EtfData | null {
  if (!px.length) return null
  const [lastDay, last] = px[px.length - 1]
  const cur = monthOf(lastDay)
  const me: Record<string, number> = {}
  for (const [d, c] of px) if (monthOf(d) !== cur) me[monthOf(d)] = c // later days overwrite: the month's last close
  const keepMonths = Object.keys(me).sort().slice(-14)
  return { lastDay, last, me: Object.fromEntries(keepMonths.map((m) => [m, me[m]])) }
}

/** Weights at the first run of month `m`: 1/N for each ETF with a positive 12-1 signal, N = ETFs with a signal.
 *  The signal is the return from the month-end of m-13 to the month-end of m-2 (the month just ended is skipped). */
export function l3Weights(etf: Record<string, EtfData>, m: string, universe: string[] = ETF_UNIVERSE): Record<string, number> {
  const have = universe.filter((s) => {
    const e = etf[s]
    return e && Number.isFinite(e.me[addMonths(m, -2)]) && Number.isFinite(e.me[addMonths(m, -13)]) && e.last > 0
  })
  const w: Record<string, number> = {}
  for (const s of have) if (etf[s].me[addMonths(m, -2)] / etf[s].me[addMonths(m, -13)] - 1 > 0) w[s] = 1 / have.length
  return w
}

export function l3Step(prev: L3State | null, a: { day: string; etf: Record<string, EtfData>; costs: Costs | null }): L3State | null {
  const spy = a.etf.SPY
  if (!spy || spy.lastDay !== a.day) return prev // no SPY close for today: skip the day
  const side = sideCost(a.costs)
  const s: L3State = prev
    ? structuredClone(prev)
    : { startDay: a.day, cash: L3_START, units: {}, px: {}, lastRebal: '', equity: L3_START, spyUnits: (L3_START * (1 - side)) / spy.last, spyEquity: L3_START, curve: [], rebalances: 0 }
  for (const [sym, e] of Object.entries(a.etf)) if (e.lastDay === a.day && e.last > 0) s.px[sym] = e.last
  const value = () => s.cash + Object.entries(s.units).reduce((v, [sym, u]) => v + u * (s.px[sym] ?? 0), 0)
  const m = monthOf(a.day)
  if (s.lastRebal !== m) {
    const eq = value()
    const w = l3Weights(a.etf, m)
    // turnover against the weights the book has drifted to; each side of every trade pays `side`
    const cur = (sym: string) => ((s.units[sym] ?? 0) * (s.px[sym] ?? 0)) / eq
    const syms = new Set([...Object.keys(s.units), ...Object.keys(w)])
    let turn = 0
    for (const sym of syms) turn += Math.abs((w[sym] ?? 0) - cur(sym))
    const eqAfter = eq * (1 - turn * side)
    s.units = {}
    let used = 0
    for (const [sym, x] of Object.entries(w)) {
      if (!(s.px[sym] > 0)) continue
      s.units[sym] = (x * eqAfter) / s.px[sym]
      used += x * eqAfter
    }
    s.cash = eqAfter - used
    s.lastRebal = m
    s.rebalances++
  }
  s.equity = +value().toFixed(2)
  s.spyEquity = +(s.spyUnits * spy.last).toFixed(2)
  s.curve = [...s.curve.filter(([d]) => d !== a.day), [a.day, s.equity, s.spyEquity] as [string, number, number]].slice(-CURVE_KEEP)
  return s
}

// ---- state and report ----

export interface ShadowLeads {
  v: 1
  /** The trading day whose close was last processed (the idempotency marker). */
  doneDay: string
  l1: L1State
  l2: L2State
  l3: L3State | null
}
export const emptyLeads = (): ShadowLeads => ({ v: 1, doneDay: '', l1: emptyL1(), l2: emptyL2(), l3: null })

export function parseLeads(raw: unknown): ShadowLeads | null {
  const r = raw as Partial<ShadowLeads> | null
  if (!r || r.v !== 1 || typeof r.doneDay !== 'string' || !r.l1 || !r.l2) return null
  return { v: 1, doneDay: r.doneDay, l1: { ...emptyL1(), ...r.l1 }, l2: { ...emptyL2(), ...r.l2 }, l3: r.l3 ?? null }
}

export interface LeadsReport {
  asOf: string | null
  l1: { n: number; winRate: number | null; avgRet: number | null; total: number; open: number; pending: number; signalDays: number; gateDays: number }
  l2: { n: number; winRate: number | null; shadowTotal: number; actualTotal: number; delta: number; avgDeltaRet: number | null; pending: number; proxy: { n: number; delta: number } }
  l3: { since: string; equity: number; spy: number; diffPct: number; hold: string[]; rebalances: number } | null
  /** Plain Vietnamese lines for the daily Telegram summary. */
  vi: string[]
}

const r2 = (x: number) => +x.toFixed(2)
const money = (x: number) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(0)}`
const pc = (x: number, d = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}%`

export function leadsReport(leads: ShadowLeads | null): LeadsReport {
  const L = leads ?? emptyLeads()
  const a1 = L.l1.agg
  const a2 = L.l2.agg
  const l1 = { n: a1.n, winRate: a1.n ? r2((a1.wins / a1.n) * 100) : null, avgRet: a1.n ? r2(a1.sumRet / a1.n) : null, total: r2(a1.total), open: L.l1.open.length, pending: L.l1.pending.length, signalDays: L.l1.signalDays, gateDays: L.l1.gateDays }
  const l2 = {
    n: a2.n,
    winRate: a2.n ? r2((a2.wins / a2.n) * 100) : null,
    shadowTotal: r2(a2.total),
    actualTotal: r2(a2.actualTotal),
    delta: r2(a2.total - a2.actualTotal),
    avgDeltaRet: a2.n ? r2((a2.sumRet - a2.actualSumRet) / a2.n) : null,
    pending: L.l2.pending.length,
    proxy: { n: a2.proxyN, delta: r2(a2.proxyDelta) },
  }
  const t = L.l3
  const l3 = t ? { since: t.startDay, equity: t.equity, spy: t.spyEquity, diffPct: r2((t.equity / t.spyEquity - 1) * 100), hold: Object.keys(t.units).sort(), rebalances: t.rebalances } : null
  const vi = [
    l1.n
      ? `L1 đảo chiều+VIX: ${l1.n} lệnh, thắng ${Math.round(l1.winRate!)}%, TB ${pc(l1.avgRet!, 2)}/lệnh, ${money(l1.total)}, mở ${l1.open}`
      : `L1 đảo chiều+VIX: chưa có lệnh đóng (mở ${l1.open}, chờ vào ${l1.pending})`,
    l2.n ? `L2 giữ qua đêm: ${l2.n} lệnh, ${money(l2.shadowTotal)} so với thật ${money(l2.actualTotal)} (chênh ${money(l2.delta)})` : `L2 giữ qua đêm: chưa có lệnh (chờ ${l2.pending})`,
    l3 ? `L3 ETF xu hướng: $${l3.equity.toFixed(0)} so với SPY $${l3.spy.toFixed(0)} (${pc(l3.diffPct)}), giữ ${l3.hold.length} ETF` : 'L3 ETF xu hướng: chưa bắt đầu',
  ]
  return { asOf: L.doneDay || null, l1, l2, l3, vi }
}
