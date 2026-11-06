/**
 * Atlas Leaders, steps 2-3 (v2.0.14): a paper-only strategy slot that trades the nightly leaders list (src/lib/leaders.ts)
 * with multi-day holds. Nothing here places an order, and the main practice book is not touched.
 *
 *  Setup (checked on the daily bars at each close, for names in the leaders list):
 *    average daily range (ADR, 20 days) >= 4%; a tight base: the last 10 days span <= min(15%, 3 x ADR);
 *    price above its 10 and 20-day average; higher lows (lowest low of the last 5 days above the 5 before);
 *    volume drying up (5-day average below the 50-day); price within 5% of the pivot.
 *  Entry: within 5 trading days, the first day the price trades through the pivot (highest high of the last 10 days) on
 *    volume >= 1.5x its 50-day average. A gap above the pivot fills at the open.
 *  Stop: the tighter of the lowest low of the last 5 days and 1 x ADR under the pivot. A gap below the stop fills at the open.
 *  Exit: close under the 20-day average (10-day when ADR > 10%), or 30 days. Returns are after a flat 0.3% round trip cost.
 *  Same grading as the idea-factory slots: after 20 graded trades it is "working" (wins 55%+ and average above 0) or "failing".
 * Daily bars only, so intraday order of events is unknown: a day that trades through both the pivot and the stop is
 * counted as stopped out. All numbers are starting points, tuned on paper.
 */
import type { Candle } from '../types'
import { SLOT_MIN_GRADED, SLOT_MIN_WIN_RATE } from './ideaFactory'

export const CFG = {
  adrMin: 4,
  baseDays: 10,
  baseMaxPct: 15,
  baseMaxAdr: 3,
  nearPivot: 0.95,
  volBreak: 1.5,
  watchDays: 5,
  maxHold: 30,
  costPct: 0.3,
  trailBigAdr: 10,
}

export interface Watch {
  symbol: string
  setupDay: string
  entry: number
  stop: number
  adr: number
  age: number
}
export interface Position {
  symbol: string
  entryDay: string
  entry: number
  stop: number
  adr: number
  days: number
  lastClose: number
}
export interface ClosedTrade {
  symbol: string
  entryDay: string
  exitDay: string
  entry: number
  exit: number
  retPct: number
  /** Result in units of the planned risk (entry to stop). */
  r: number
  days: number
  reason: 'stop' | 'trail' | 'time'
}
export interface PaperState {
  asOf: string | null
  watching: Watch[]
  open: Position[]
  closed: ClosedTrade[]
}
export const emptyState = (): PaperState => ({ asOf: null, watching: [], open: [], closed: [] })

export const dayOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
const r2 = (x: number) => Math.round(x * 100) / 100
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Exponential average of the closes, one value per bar (seeded with the first close). */
export function ema(closes: number[], n: number): number[] {
  const k = 2 / (n + 1)
  const out: number[] = []
  closes.forEach((c, i) => out.push(i === 0 ? c : c * k + out[i - 1] * (1 - k)))
  return out
}

/** Average daily range in percent over the last n bars. */
export function adrPct(bars: Candle[], n = 20): number {
  return mean(bars.slice(-n).map((b) => (b.high / b.low - 1) * 100))
}

export interface Setup {
  entry: number
  stop: number
  adr: number
}

/** A tight-base setup on the bars up to and including the signal day, or null. */
export function findSetup(bars: Candle[]): Setup | null {
  if (bars.length < 60) return null
  const last = bars[bars.length - 1]
  const adr = adrPct(bars)
  if (!(adr >= CFG.adrMin)) return null
  const base = bars.slice(-CFG.baseDays)
  const hi = Math.max(...base.map((b) => b.high))
  const lo = Math.min(...base.map((b) => b.low))
  if (((hi - lo) / last.close) * 100 > Math.min(CFG.baseMaxPct, CFG.baseMaxAdr * adr)) return null
  const closes = bars.map((b) => b.close)
  if (!(last.close > ema(closes, 10)[closes.length - 1] && last.close > ema(closes, 20)[closes.length - 1])) return null
  const lows5 = Math.min(...bars.slice(-5).map((b) => b.low))
  const lowsPrev5 = Math.min(...bars.slice(-10, -5).map((b) => b.low))
  if (!(lows5 > lowsPrev5)) return null
  if (!(mean(bars.slice(-5).map((b) => b.volume)) < mean(bars.slice(-50).map((b) => b.volume)))) return null
  if (last.close < hi * CFG.nearPivot) return null
  // the tighter of the 5-day low and one ADR under the pivot, so the planned loss is never more than about one ADR
  const stop = Math.max(lows5, hi * (1 - adr / 100))
  if (!(stop < hi)) return null
  return { entry: r2(hi), stop: r2(stop), adr: r2(adr) }
}

const widthPct = (entry: number, stop: number) => ((entry - stop) / entry) * 100

function close(p: { symbol: string; entryDay: string; entry: number; stop: number }, exitDay: string, exit: number, reason: ClosedTrade['reason'], days: number): ClosedTrade {
  const retPct = (exit / p.entry - 1) * 100 - CFG.costPct
  return { symbol: p.symbol, entryDay: p.entryDay, exitDay, entry: r2(p.entry), exit: r2(exit), retPct: r2(retPct), r: r2(retPct / widthPct(p.entry, p.stop)), days, reason }
}

/**
 * Move the paper book forward over every closed daily bar after `state.asOf`. `bars` are the daily bars per symbol
 * (oldest first, today's unfinished bar already removed). Never looks at a bar before it happened.
 */
export function advance(state: PaperState, bars: Record<string, Candle[]>): PaperState {
  const days = [...new Set(Object.values(bars).flatMap((b) => b.map((c) => dayOf(c.time))))].sort()
  const s: PaperState = { asOf: state.asOf, watching: [...state.watching], open: [...state.open], closed: [...state.closed] }
  // first run: start at the newest bar, never replay history (that would be hindsight)
  const todo = s.asOf == null ? [] : days.filter((d) => d > s.asOf!)
  if (s.asOf == null && days.length) s.asOf = days[days.length - 1]
  for (const d of todo) {
    const idx = (sym: string) => (bars[sym] ?? []).findIndex((c) => dayOf(c.time) === d)
    const nextOpen: Position[] = []
    for (const p of s.open) {
      const i = idx(p.symbol)
      if (i < 0) {
        nextOpen.push(p)
        continue
      }
      const b = bars[p.symbol][i]
      const days2 = p.days + 1
      if (b.low <= p.stop) s.closed.push(close(p, d, Math.min(b.open, p.stop), 'stop', days2))
      else {
        const cl = bars[p.symbol].slice(0, i + 1).map((c) => c.close)
        const trail = ema(cl, p.adr > CFG.trailBigAdr ? 10 : 20)[i]
        if (b.close < trail) s.closed.push(close(p, d, b.close, 'trail', days2))
        else if (days2 >= CFG.maxHold) s.closed.push(close(p, d, b.close, 'time', days2))
        else nextOpen.push({ ...p, days: days2, lastClose: r2(b.close) })
      }
    }
    s.open = nextOpen
    const nextWatch: Watch[] = []
    for (const w of s.watching) {
      const i = idx(w.symbol)
      if (i < 0) {
        nextWatch.push(w)
        continue
      }
      const bs = bars[w.symbol]
      const b = bs[i]
      const avgVol = mean(bs.slice(Math.max(0, i - 50), i).map((c) => c.volume))
      const age = w.age + 1
      if (b.high >= w.entry && avgVol > 0 && b.volume >= CFG.volBreak * avgVol) {
        const fill = Math.max(b.open, w.entry)
        const pos = { symbol: w.symbol, entryDay: d, entry: fill, stop: w.stop, adr: w.adr }
        if (b.low <= w.stop) s.closed.push(close(pos, d, w.stop, 'stop', 1))
        else s.open.push({ ...pos, entry: r2(fill), days: 1, lastClose: r2(b.close) })
      } else if (b.close < w.stop || age >= CFG.watchDays) {
        // base broke before the breakout, or the 5 days ran out
      } else nextWatch.push({ ...w, age })
    }
    s.watching = nextWatch
    s.asOf = d
  }
  s.closed = s.closed.slice(-300)
  return s
}

/** Add tonight's setups for the leaders list (names already watched, held or closed in the last 10 days are skipped). */
export function addSetups(state: PaperState, leaders: string[], bars: Record<string, Candle[]>): PaperState {
  const s: PaperState = { ...state, watching: [...state.watching] }
  const busy = new Set([...s.watching.map((w) => w.symbol), ...s.open.map((p) => p.symbol)])
  const cool = new Set(s.closed.filter((c) => state.asOf != null && Date.parse(state.asOf) - Date.parse(c.exitDay) < 10 * 86_400_000).map((c) => c.symbol))
  for (const sym of leaders) {
    const bs = bars[sym]
    if (!bs?.length || busy.has(sym) || cool.has(sym)) continue
    if (dayOf(bs[bs.length - 1].time) !== state.asOf) continue
    const su = findSetup(bs)
    if (su) s.watching.push({ symbol: sym, setupDay: state.asOf!, ...su, age: 0 })
  }
  return s
}

export interface PaperScore {
  graded: number
  wins: number
  winRate: number | null
  avgPct: number | null
  avgR: number | null
  profitFactor: number | null
  status: 'testing' | 'working' | 'failing'
  need: number
}

export function paperScore(closed: ClosedTrade[]): PaperScore {
  const n = closed.length
  const wins = closed.filter((c) => c.retPct > 0).length
  const gain = closed.filter((c) => c.retPct > 0).reduce((a, c) => a + c.retPct, 0)
  const loss = -closed.filter((c) => c.retPct <= 0).reduce((a, c) => a + c.retPct, 0)
  const winRate = n ? Math.round((1000 * wins) / n) / 10 : null
  const avgPct = n ? r2(mean(closed.map((c) => c.retPct))) : null
  const status: PaperScore['status'] = n < SLOT_MIN_GRADED ? 'testing' : winRate! >= SLOT_MIN_WIN_RATE && avgPct! > 0 ? 'working' : 'failing'
  return { graded: n, wins, winRate, avgPct, avgR: n ? r2(mean(closed.map((c) => c.r))) : null, profitFactor: loss > 0 ? r2(gain / loss) : null, status, need: SLOT_MIN_GRADED }
}

export interface PaperReport {
  generated: string
  asOf: string | null
  strategy: 'leaders-tight-base'
  score: PaperScore
  watching: Watch[]
  open: (Position & { openPct: number })[]
  closed: ClosedTrade[]
}

export function paperReport(s: PaperState, generated: string): PaperReport {
  return {
    generated,
    asOf: s.asOf,
    strategy: 'leaders-tight-base',
    score: paperScore(s.closed),
    watching: s.watching,
    open: s.open.map((p) => ({ ...p, openPct: r2((p.lastClose / p.entry - 1) * 100) })),
    closed: s.closed,
  }
}

export function parsePaper(raw: unknown): PaperReport | null {
  const f = raw as Partial<PaperReport> | null
  if (!f || typeof f.generated !== 'string' || !Array.isArray(f.closed) || !Array.isArray(f.open) || !Array.isArray(f.watching) || !f.score) return null
  return f as PaperReport
}

/** State to carry into the next night, from a saved report. */
export function stateOf(rep: PaperReport | null): PaperState {
  if (!rep) return emptyState()
  return { asOf: rep.asOf, watching: rep.watching, open: rep.open.map(({ openPct: _o, ...p }) => p), closed: rep.closed }
}
