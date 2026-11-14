/**
 * Atlas shadow setups L5 "Red to green" and L6 "Opening drive" (found 2026-11-14 in the 60-day 15m study, rules in
 * /mnt/project-files/atlas/fable-setups/SPEC.md; approved for SHADOW by Chanh, live trading stays off).
 * Record-only: this file reads one finished session of 15m bars per gap name and writes its own trades. It never
 * places, changes or blocks a paper trade. Pure functions; src/worker/shadowLeads.ts fetches the bars.
 *
 * Gap names: today's open >= +3% over the previous close, previous close >= $3 (daily bars from Alpaca, the same
 * request L4 makes). RVOL = cumulative volume up to the bar / median of the same cumulative volume on the previous
 * (up to 20) sessions.
 *
 *  L5 Red to green: RVOL >= 1.5, price traded >= 1% under the open, then a 15m bar closes back above the open (the
 *     bar before closed at or under it). Signal bar starts 9:45-12:00 ET, first signal per name per day. Buy at the
 *     next bar's open. Stop = low of the day so far x 0.998 (floor 0.7% away, skip when over 6%). Exit: stop, else the
 *     session's last close. No target.
 *  L6 Opening drive: first 15m bar green, closes in the top 25% of its range, first-bar RVOL >= 2. Buy at the 9:45
 *     open. Stop = first-bar low x 0.998 (same floor and cap). Exit at the 11:00 open unless stopped first.
 *
 * Study numbers (in-sample, universe bias: Atlas only saw names that had been gainers): L5 n=66 +1.23%/trade, PF 2.66
 * (control +0.57%); L6 n=70 +0.85%/trade, PF 2.99. Expect less live. Regrade after ~50 shadow signals per setup.
 */
import type { Costs } from './costs'
import { netRetPct } from './replayStrategies'

export const GAP_MIN = 0.03
export const MIN_PRICE = 3
export const SETUP_NOTIONAL = 1000
export const RVOL_DAYS = 20
export const A_RVOL = 1.5
export const A_DIP = 0.01
export const A_FROM_MIN = 585 // 9:45 ET, bar start in minutes
export const A_TO_MIN = 720 // 12:00 ET
export const B_RVOL = 2
export const B_EXIT_MIN = 660 // 11:00 ET
export const MIN_STOP_PCT = 0.7
export const MAX_STOP_PCT = 6
const SESSION_FROM = 570 // 9:30 ET
const SESSION_TO = 960 // 16:00 ET

/** One 15m bar: start time in seconds, open, high, low, close, volume. */
export type Bar15 = [number, number, number, number, number, number]
/** Daily bar as L4 holds it: day, open, close, volume. */
export type DailyBar = [string, number, number, number]

export interface SetupTrade {
  sym: string
  day: string
  entry: number
  stop: number
  exit: number
  why: 'stop' | 'time' | 'close'
  /** Gap at the open and RVOL at the signal bar, for the report. */
  gap: number
  rvol: number
  retPct: number
  pnl: number
}

const dayOf = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t * 1000))
const minOf = (t: number) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(t * 1000))
  return (Number(p.find((x) => x.type === 'hour')!.value) % 24) * 60 + Number(p.find((x) => x.type === 'minute')!.value)
}

/** Regular-session bars grouped by New York day, oldest day first. */
export function bySession(bars: Bar15[]): { day: string; bars: Bar15[]; mins: number[] }[] {
  const m = new Map<string, { bars: Bar15[]; mins: number[] }>()
  for (const b of [...bars].sort((a, c) => a[0] - c[0])) {
    if (![1, 2, 3, 4, 5].every((i) => Number.isFinite(b[i]))) continue
    const mi = minOf(b[0])
    if (mi < SESSION_FROM || mi >= SESSION_TO) continue
    const d = dayOf(b[0])
    const e = m.get(d) ?? { bars: [], mins: [] }
    e.bars.push(b)
    e.mins.push(mi)
    m.set(d, e)
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, v]) => ({ day, ...v }))
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? (s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN
}

/** Names whose open on `day` was >= 3% over the previous close (>= $3). Sorted by symbol. */
export function gapNames(bars: Record<string, DailyBar[]>, day: string): { sym: string; gap: number }[] {
  const out: { sym: string; gap: number }[] = []
  for (const [sym, b] of Object.entries(bars)) {
    const i = b.length - 1
    if (i < 1 || b[i][0] !== day) continue
    const pc = b[i - 1][2]
    if (!(pc >= MIN_PRICE) || !(b[i][1] > 0)) continue
    const gap = b[i][1] / pc - 1
    if (gap >= GAP_MIN) out.push({ sym, gap })
  }
  return out.sort((a, b) => a.sym.localeCompare(b.sym))
}

interface Ctx { d: Bar15[]; mins: number[]; cum: number[]; rvol: number[]; gap: number }

/** Session `day` of `bars` with its cumulative volume and RVOL per bar, or null when the data is too thin. */
function context(bars: Bar15[], day: string, prevClose: number): Ctx | null {
  const ss = bySession(bars)
  const i = ss.findIndex((s) => s.day === day)
  if (i < 5) return null // need a few earlier sessions for the volume profile
  const s = ss[i]
  if (s.bars.length < 20) return null // a half session or holes: do not grade
  const cumOf = (x: { bars: Bar15[] }) => x.bars.reduce<number[]>((a, b) => [...a, (a.at(-1) ?? 0) + b[5]], [])
  const cum = cumOf(s)
  const prior = ss.slice(Math.max(0, i - RVOL_DAYS), i)
  const rvol = s.bars.map((_, k) => {
    const med = median(prior.map((p) => cumOf(p)[p.mins.indexOf(s.mins[k])]).filter((v): v is number => v != null && Number.isFinite(v)))
    return med > 0 ? cum[k] / med : NaN
  })
  const gap = s.bars[0][1] / prevClose - 1
  return { d: s.bars, mins: s.mins, cum, rvol, gap }
}

/** Stop rules shared by both setups. Returns the stop to use, or null to skip the trade. */
function fixStop(entry: number, stop: number): number | null {
  if (!(stop < entry)) return null
  let sp = ((entry - stop) / entry) * 100
  if (sp < MIN_STOP_PCT) {
    stop = entry * (1 - MIN_STOP_PCT / 100)
    sp = MIN_STOP_PCT
  }
  return sp > MAX_STOP_PCT ? null : stop
}

/** Walk from bar k (entered at its open): stop first (a gap through it fills at the open), then the time exit at `exitAt` bar's open, else the last close. */
function walk(c: Ctx, k: number, stop: number, exitAtMin: number | null): { exit: number; why: SetupTrade['why'] } {
  for (let j = k; j < c.d.length; j++) {
    if (exitAtMin != null && j > k && c.mins[j] >= exitAtMin) return { exit: c.d[j][1], why: 'time' }
    if (c.d[j][3] <= stop) return { exit: Math.min(stop, c.d[j][1]), why: 'stop' }
  }
  return { exit: c.d[c.d.length - 1][4], why: 'close' }
}

function finish(sym: string, day: string, c: Ctx, k: number, stopRaw: number, exitAtMin: number | null, rv: number, costs: Costs | null): SetupTrade | null {
  if (k >= c.d.length) return null
  const entry = c.d[k][1]
  const stop = fixStop(entry, stopRaw)
  if (stop == null) return null
  const r = walk(c, k, stop, exitAtMin)
  const ret = netRetPct(entry, r.exit, costs, false)
  return { sym, day, entry: +entry.toFixed(4), stop: +stop.toFixed(4), exit: +r.exit.toFixed(4), why: r.why, gap: +(c.gap * 100).toFixed(2), rvol: +rv.toFixed(2), retPct: +ret.toFixed(3), pnl: +((SETUP_NOTIONAL * ret) / 100).toFixed(2) }
}

/** L5 Red to green on one name and one finished session. Null when no signal (or no gap, thin data). */
export function redToGreen(sym: string, day: string, bars: Bar15[], prevClose: number, costs: Costs | null): SetupTrade | null {
  const c = context(bars, day, prevClose)
  if (!c || c.gap < GAP_MIN) return null
  const open0 = c.d[0][1]
  let dipped = false
  for (let k = 2; k < c.d.length - 1; k++) {
    if (!(c.rvol[k] >= A_RVOL)) continue
    const lod = Math.min(...c.d.slice(0, k + 1).map((b) => b[3]))
    if (lod <= open0 * (1 - A_DIP)) dipped = true
    const m = c.mins[k]
    if (dipped && m >= A_FROM_MIN && m <= A_TO_MIN && c.d[k][4] > open0 && c.d[k - 1][4] <= open0) return finish(sym, day, c, k + 1, lod * 0.998, null, c.rvol[k], costs)
  }
  return null
}

/** L6 Opening drive on one name and one finished session. */
export function openingDrive(sym: string, day: string, bars: Bar15[], prevClose: number, costs: Costs | null): SetupTrade | null {
  const c = context(bars, day, prevClose)
  if (!c || c.gap < GAP_MIN || c.mins[0] !== SESSION_FROM) return null
  const [, o, h, l, cl] = c.d[0]
  // first-bar RVOL: first-bar volume against the median first-bar volume of the earlier sessions
  if (!(c.rvol[0] >= B_RVOL) || !(cl > o) || h <= l || (cl - l) / (h - l) < 0.75) return null
  return finish(sym, day, c, 1, l * 0.998, B_EXIT_MIN, c.rvol[0], costs)
}

// ---- state ----

export interface SetupAgg { n: number; wins: number; sumRet: number; total: number }
export interface SetupState {
  trades: SetupTrade[]
  agg: SetupAgg
  /** Sessions graded, and the gap names looked at over all of them. */
  days: number
  names: number
}
export const emptySetup = (): SetupState => ({ trades: [], agg: { n: 0, wins: 0, sumRet: 0, total: 0 }, days: 0, names: 0 })
export const SETUP_KEEP = 200

/** Adds one day's signals (already graded) to a setup. A name signals at most once a day. */
export function addSetupDay(prev: SetupState | undefined, day: string, names: number, signals: SetupTrade[]): SetupState {
  const s: SetupState = structuredClone(prev ?? emptySetup())
  if (s.trades.some((t) => t.day === day)) return s // the day was already recorded
  s.days++
  s.names += names
  for (const t of signals) {
    s.agg = { n: s.agg.n + 1, wins: s.agg.wins + (t.pnl > 0 ? 1 : 0), sumRet: s.agg.sumRet + t.retPct, total: s.agg.total + t.pnl }
    s.trades.push(t)
  }
  s.trades = s.trades.slice(-SETUP_KEEP)
  return s
}
