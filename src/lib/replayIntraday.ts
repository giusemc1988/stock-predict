/**
 * Atlas lab, round 3: day-trading experiments on 5-minute and 60-minute bars. Pure functions;
 * scripts/replay-intraday.ts fetches the bars and writes public/replay-intraday.json.
 *
 * No look-ahead: a signal uses bars up to and including bar t; a market entry fills at bar t+1's open. A LIMIT
 * entry sits at bar t's close and fills only if a later bar trades through it (buy: low < limit; sell: high >
 * limit), at the limit or the bar's open if that is better; it pays no spread or slippage but can be missed.
 * Everything is out by the close unless the rule says "next open". Regular session only (09:30-16:00 ET).
 *
 *  I1 Opening-range breakout on stocks in play (Zarattini, Barbon, Aziz, SSRN 2023-24)
 *  I2 Intraday momentum on SPY/QQQ (Gao, Han, Li, Zhou, JFE 2018): first half-hour -> last half-hour
 *  I3 Overnight vs intraday returns, and holding strong-volume winners overnight
 *
 * Costs (assumption, no free source has real quotes): half-spread by median daily dollar volume of the symbol
 * (>$5B 0.5 bps, $1-5B 1.5, $0.2-1B 4, below 10), slippage 1 bp per market fill, fee 0 (commission-free broker).
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { dayKey } from './practice'
import { scaleCosts, seededRng } from './replayDaily'
import { deflatedSharpe } from './replayLab'

/** Variants tried in round 3: I1 4, I2 4, I3 6. Rounds 1+2 tried 14 (ROUND2_TRIALS), so the DSR counts 28. */
export const ROUND3_TRIALS = 14
export const ALL_TRIALS = 14 + ROUND3_TRIALS

// ---- sessions ----

export interface Day {
  key: string
  bars: Candle[]
  /** Minutes after midnight ET at each bar's start. */
  min: number[]
}
export interface SymDays {
  symbol: string
  days: Day[]
}

const ETM = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
/** Minutes after midnight in New York at epoch second `t` (Intl handles daylight saving). */
export function etMinutes(t: number): number {
  const p = ETM.formatToParts(new Date(t * 1000))
  return +p.find((x) => x.type === 'hour')!.value * 60 + +p.find((x) => x.type === 'minute')!.value
}

/** Regular-session bars (start 09:30 to before 16:00 ET) grouped by day. A day needs its 09:30 bar and a bar
 *  starting at or after `lastMin` (partial and half days are dropped so "the close" always means 16:00). */
export function sessionDays(bars: Candle[], lastMin: number): Day[] {
  const by = new Map<string, Day>()
  for (const b of [...bars].sort((a, c) => a.time - c.time)) {
    const m = etMinutes(b.time)
    if (m < 570 || m >= 960) continue
    const k = dayKey(b.time * 1000)
    if (!by.has(k)) by.set(k, { key: k, bars: [], min: [] })
    const d = by.get(k)!
    if (d.min.length && d.min[d.min.length - 1] >= m) continue // duplicate stamp
    d.bars.push(b)
    d.min.push(m)
  }
  return [...by.values()].filter((d) => d.min[0] === 570 && d.min[d.min.length - 1] >= lastMin)
}

// ---- costs ----

/** Half-spread in bps from the median daily dollar volume. */
export const halfSpreadBps = (dollarVol: number) => (dollarVol > 5e9 ? 0.5 : dollarVol > 1e9 ? 1.5 : dollarVol > 2e8 ? 4 : 10)
export const SLIPPAGE_BPS = 1
/** Per-symbol costs in the shape the other labs use (spreadBps is the FULL spread, each market fill pays half). */
export const symbolCosts = (dollarVol: number): Costs => ({ feeBps: 0, spreadBps: 2 * halfSpreadBps(dollarVol), slippageBps: SLIPPAGE_BPS })

export function medianDollarVolume(days: Day[]): number {
  const v = days.map((d) => d.bars.reduce((a, b) => a + b.close * b.volume, 0)).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : 0
}

export interface CostModel {
  sym: Map<string, Costs>
  /** The flat costs rounds 1-2 used (costsFrom(DEFAULT_AI_RULES)). */
  old: Costs | null
}
export type CostMode = 'new' | 'old' | 'x2'
export const costOf = (m: CostModel, mode: CostMode, symbol: string): Costs | null => {
  if (mode === 'old') return m.old
  const c = m.sym.get(symbol) ?? symbolCosts(0)
  return mode === 'x2' ? scaleCosts(c, 2) : c
}

// ---- trades ----

export interface Rule {
  /** Bars held counting the entry bar, or 'close' (last bar's close) or 'nextOpen' (next session's open). */
  hold: number | 'close' | 'nextOpen'
  /** Stop distance as a fraction of the entry price. */
  stopPct?: number
  limit?: boolean
  /** Buy at bar t's close (market on close) instead of bar t+1's open; only for overnight holds. */
  moc?: boolean
}
export interface ITrade {
  symbol: string
  openedAt: number
  dir: 1 | -1
  entry: number
  exit: number
  limitEntry: boolean
  rule: Rule
}

/** Return after costs, percent of the entry value. A limit entry pays no spread or slippage; exits are market. */
export function retPct(t: Pick<ITrade, 'dir' | 'entry' | 'exit' | 'limitEntry'>, c: Costs | null): number {
  const slip = c ? (c.spreadBps / 2 + c.slippageBps) / 1e4 : 0
  const fee = c ? c.feeBps / 1e4 : 0
  const inSlip = t.limitEntry ? 0 : slip
  if (t.dir > 0) {
    const buy = t.entry * (1 + inSlip)
    return ((t.exit * (1 - slip) * (1 - fee) - buy * (1 + fee)) / buy) * 100
  }
  const sell = t.entry * (1 - inSlip)
  return ((sell * (1 - fee) - t.exit * (1 + slip) * (1 + fee)) / sell) * 100
}

const dayGap = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000

/** Where a signal on bar t enters: `{i, price}` or null (no next bar, or a limit never trades through). */
export function fillEntry(bars: Candle[], t: number, dir: 1 | -1, limit: boolean): { i: number; price: number } | null {
  if (!limit) return t + 1 < bars.length ? { i: t + 1, price: bars[t + 1].open } : null
  const px = bars[t].close
  for (let j = t + 1; j < bars.length; j++) {
    if (dir > 0 && bars[j].low < px) return { i: j, price: Math.min(px, bars[j].open) }
    if (dir < 0 && bars[j].high > px) return { i: j, price: Math.max(px, bars[j].open) }
  }
  return null
}

/** Exit price from the entry bar `e` onward: stop first (a gap through fills at the open; in the entry bar the stop
 *  is assumed hit if the bar's range reaches it), then the rule's time exit. Null when the next session is missing. */
function exitPrice(days: Day[], di: number, e: number, entry: number, dir: 1 | -1, rule: Rule): number | null {
  const bars = days[di].bars
  const last = rule.hold === 'close' || rule.hold === 'nextOpen' ? bars.length - 1 : Math.min(bars.length - 1, e + rule.hold - 1)
  const stop = rule.stopPct ? entry * (1 - dir * rule.stopPct) : null
  for (let j = e; j <= last; j++) {
    if (stop != null) {
      if (j > e && (dir > 0 ? bars[j].open <= stop : bars[j].open >= stop)) return bars[j].open
      if (dir > 0 ? bars[j].low <= stop : bars[j].high >= stop) return stop
    }
  }
  if (rule.hold === 'nextOpen') {
    const nx = days[di + 1]
    return nx && dayGap(days[di].key, nx.key) <= 4 ? nx.bars[0].open : null
  }
  return bars[last].close
}

/** Play one signal (bar t of day di) forward. Null = no fill or no exit. */
export function simulate(sd: SymDays, di: number, t: number, dir: 1 | -1, rule: Rule): ITrade | null {
  const bars = sd.days[di].bars
  const f = rule.moc ? { i: t, price: bars[t].close } : fillEntry(bars, t, dir, !!rule.limit)
  if (!f) return null
  const exit = exitPrice(sd.days, di, f.i, f.price, dir, rule)
  if (exit == null) return null
  return { symbol: sd.symbol, openedAt: bars[f.i].time * 1000, dir, entry: f.price, exit, limitEntry: !!rule.limit && !rule.moc, rule }
}

// ---- I1 opening-range breakout ----

export interface Cand {
  sd: SymDays
  di: number
  rel: number
  dir: 1 | -1
  atr: number
}

/** Stocks-in-play candidates: first 5-minute volume vs the mean of the 14 days before, first 5-minute move non-zero,
 *  and the 14-day daily ATR (previous days only). */
export function orbCandidates(syms: SymDays[]): Cand[] {
  const out: Cand[] = []
  for (const sd of syms) {
    for (let di = 15; di < sd.days.length; di++) {
      const b = sd.days[di].bars[0]
      let v = 0
      let tr = 0
      for (let k = di - 14; k < di; k++) {
        const p = sd.days[k]
        const pc = sd.days[k - 1].bars[sd.days[k - 1].bars.length - 1].close
        const hi = Math.max(...p.bars.map((x) => x.high))
        const lo = Math.min(...p.bars.map((x) => x.low))
        v += sd.days[k].bars[0].volume
        tr += Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc))
      }
      if (v <= 0 || b.close === b.open) continue
      out.push({ sd, di, rel: b.volume / (v / 14), dir: b.close > b.open ? 1 : -1, atr: tr / 14 })
    }
  }
  return out
}

/** Variant A: relative volume >= 2. Variant B: the 20 highest relative volumes of each day. */
export function pickInPlay(c: Cand[], mode: 'A' | 'B'): Cand[] {
  if (mode === 'A') return c.filter((x) => x.rel >= 2)
  const by = new Map<string, Cand[]>()
  for (const x of c) by.set(x.sd.days[x.di].key, [...(by.get(x.sd.days[x.di].key) ?? []), x])
  return [...by.values()].flatMap((r) => r.sort((a, b) => b.rel - a.rel).slice(0, 20))
}

/** Enter on the break of the first bar's high (long) or low (short); stop at the other side of that bar (`bar`) or
 *  10% of the 14-day ATR from the entry (`atr`); out at the close. The break fills at the level, or the open on a gap. */
export function orbTrade(x: Cand, stop: 'bar' | 'atr'): ITrade | null {
  const { sd, di, dir } = x
  const bars = sd.days[di].bars
  const f = bars[0]
  const level = dir > 0 ? f.high : f.low
  for (let j = 1; j < bars.length; j++) {
    if (dir > 0 ? bars[j].high <= level : bars[j].low >= level) continue
    const entry = dir > 0 ? Math.max(level, bars[j].open) : Math.min(level, bars[j].open)
    const dist = stop === 'bar' ? Math.abs(entry - (dir > 0 ? f.low : f.high)) : 0.1 * x.atr
    if (!(dist > 0)) return null
    const rule: Rule = { hold: 'close', stopPct: dist / entry }
    const exit = exitPrice(sd.days, di, j, entry, dir, rule)
    return exit == null ? null : { symbol: sd.symbol, openedAt: bars[j].time * 1000, dir, entry, exit, limitEntry: false, rule }
  }
  return null
}

// ---- I2 intraday momentum ----

export interface Sig {
  sd: SymDays
  di: number
  t: number
  dir: 1 | -1
  rule: Rule
}

/** First period (prior close to the last bar starting before `sigCut` minutes) predicts the trade from the first
 *  bar starting at or after `tradeFrom` to the close. 5-minute: 10:00 -> 15:30. 60-minute: first hour -> last bar. */
export function i2Signals(syms: SymDays[], sigCut: number, tradeFrom: number, limit: boolean): Sig[] {
  const out: Sig[] = []
  for (const sd of syms) {
    for (let di = 1; di < sd.days.length; di++) {
      const { bars, min } = sd.days[di]
      const prev = sd.days[di - 1]
      const s = min.findLastIndex((m) => m < sigCut)
      const e = min.findIndex((m) => m >= tradeFrom)
      if (s < 0 || e < 1 || dayGap(prev.key, sd.days[di].key) > 4) continue
      const r = bars[s].close / prev.bars[prev.bars.length - 1].close - 1
      if (r === 0) continue
      out.push({ sd, di, t: e - 1, dir: r > 0 ? 1 : -1, rule: { hold: bars.length - e, limit } })
    }
  }
  return out
}

// ---- I3 overnight vs intraday ----

/** Every symbol-day: buy the open, sell the close (`intraday`) or buy the close, sell the next open (`overnight`). */
export function i3AllDays(syms: SymDays[], kind: 'intraday' | 'overnight'): Sig[] {
  return syms.flatMap((sd) =>
    sd.days.map((d, di) => ({ sd, di, t: kind === 'intraday' ? -1 : d.bars.length - 1, dir: 1 as const, rule: (kind === 'intraday' ? { hold: 'close' } : { hold: 'nextOpen', moc: true }) as Rule })),
  )
}

/** Winners proxy: up >= 3% on the day with >= 2x the usual volume so far, at the close of the last bar starting before
 *  15:00-ish (`sigCut`). Entry the next bar; held to the close or to the next open. */
export function i3Winners(syms: SymDays[], sigCut: number, hold: 'close' | 'nextOpen', limit: boolean): Sig[] {
  const out: Sig[] = []
  for (const sd of syms) {
    for (let di = 15; di < sd.days.length; di++) {
      const d = sd.days[di]
      const s = d.min.findLastIndex((m) => m < sigCut)
      const pc = sd.days[di - 1].bars[sd.days[di - 1].bars.length - 1].close
      if (s < 0 || s + 1 >= d.bars.length || d.bars[s].close < pc * 1.03) continue
      const cum = (x: Day) => x.bars.slice(0, s + 1).reduce((a, b) => a + b.volume, 0)
      let v = 0
      for (let k = di - 14; k < di; k++) v += cum(sd.days[k])
      if (v > 0 && cum(d) >= 2 * (v / 14)) out.push({ sd, di, t: s, dir: 1, rule: { hold, limit } })
    }
  }
  return out
}

// ---- random-entry control and judging ----

export const run = (sigs: Sig[]): ITrade[] => sigs.flatMap((s) => simulate(s.sd, s.di, s.t, s.dir, s.rule) ?? [])

export interface Control {
  /** Each draw's exam average return per trade, at the new costs and at 2x. */
  mNew: number[]
  m2x: number[]
}

/** Same symbols, same trade count per symbol, same direction and hold/stop rules (the stop % is kept), but entered at a
 *  random bar of a random exam day of that symbol. Limit rules keep their limit fill rule, so unfilled draws are skipped. */
export function control(syms: SymDays[], actual: ITrade[], examFrom: string, model: CostModel, draws = 200, seed = 1, allow?: (sd: SymDays, di: number) => boolean): Control {
  const out: Control = { mNew: [], m2x: [] }
  const by = new Map(syms.map((s) => [s.symbol, s]))
  const pool = new Map(syms.map((s) => [s.symbol, s.days.map((d, i) => (d.key >= examFrom && (!allow || allow(s, i)) ? i : -1)).filter((i) => i >= 0)]))
  const exam = actual.filter((t) => dayKey(t.openedAt) >= examFrom)
  for (let d = 0; d < draws; d++) {
    const rnd = seededRng(seed * 100_003 + d)
    let a = 0
    let b = 0
    let n = 0
    for (const t of exam) {
      const sd = by.get(t.symbol)!
      const days = pool.get(t.symbol)!
      if (!days.length) continue
      const di = days[Math.floor(rnd() * days.length)]
      const h = typeof t.rule.hold === 'number' ? t.rule.hold : 1
      const lo = t.rule.limit || t.rule.stopPct ? 0 : -1 // a limit needs its signal bar t; breakouts enter after bar 0
      const hi = sd.days[di].bars.length - 1 - h
      if (hi < lo) continue
      const k = simulate(sd, di, lo + Math.floor(rnd() * (hi - lo + 1)), t.dir, { ...t.rule, moc: false })
      if (!k) continue
      a += retPct(k, costOf(model, 'new', k.symbol))
      b += retPct(k, costOf(model, 'x2', k.symbol))
      n++
    }
    out.mNew.push(n ? a / n : 0)
    out.m2x.push(n ? b / n : 0)
  }
  return out
}

export interface Result {
  id: string
  en: string
  vi: string
  signalsExam: number
  book: { n: number; avg: number }
  exam: { n: number; avgNew: number; avgOld: number; avg2x: number; winRate: number }
  fillRate: number | null
  control: { meanNew: number; excessNew: number; pNew: number; excess2x: number; p2x: number }
  dsr: number
  pass: boolean
}

export const PASS_RULE_EN = 'PASS = exam n >= 100, average per trade > 0 at the new costs AND at 2x, excess over the random-entry control > 0 with p <= 0.05 at both cost levels, and a Deflated Sharpe >= 0.95 counting every variant tried in rounds 1-3 (28). Fixed in advance; nothing is tuned on the exam.'
export const PASS_RULE_VI = 'ĐẠT = n kỳ thi >= 100, lãi trung bình mỗi lệnh > 0 ở chi phí mới VÀ gấp đôi, vượt nhóm đối chứng vào lệnh ngẫu nhiên > 0 với p <= 0.05 ở cả hai mức chi phí, và Deflated Sharpe >= 0.95 tính mọi biến thể đã thử ở vòng 1-3 (28). Cố định trước; không chỉnh theo kỳ thi.'

/** Judge variants on the exam (each item carries its dataset's `examFrom`, the first day of the newest third). `sigs` are the signals behind
 *  `trades` (for the limit fill rate); leave it empty when every signal is a trade. */
export function judge(
  items: { id: string; en: string; vi: string; examFrom: string; syms: SymDays[]; sigs: Sig[]; trades: ITrade[]; allow?: (sd: SymDays, di: number) => boolean }[],
  model: CostModel,
  trials = ALL_TRIALS,
): Result[] {
  const rows = items.map((it) => {
    const { examFrom } = it
    const isExam = (ms: number) => dayKey(ms) >= examFrom
    const book = it.trades.filter((t) => !isExam(t.openedAt))
    const exam = it.trades.filter((t) => isExam(t.openedAt))
    const at = (m: CostMode) => exam.map((t) => retPct(t, costOf(model, m, t.symbol)))
    return { it, book, exam, rNew: at('new'), rOld: at('old'), r2x: at('x2'), c: control(it.syms, it.trades, examFrom, model, 200, 1, it.allow) }
  })
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
  const pv = (draws: number[], actual: number) => (1 + draws.filter((x) => x >= actual).length) / (draws.length + 1)
  return rows.map((r) => {
    const avgNew = mean(r.rNew)
    const avg2x = mean(r.r2x)
    const cn = mean(r.c.mNew)
    const c2 = mean(r.c.m2x)
    const sigsExam = r.it.sigs.filter((s) => s.sd.days[s.di].key >= r.it.examFrom).length
    const dsr = deflatedSharpe(r.rNew, trials)
    const control = { meanNew: cn, excessNew: avgNew - cn, pNew: pv(r.c.mNew, avgNew), excess2x: avg2x - c2, p2x: pv(r.c.m2x, avg2x) }
    return {
      id: r.it.id,
      en: r.it.en,
      vi: r.it.vi,
      signalsExam: sigsExam || r.exam.length,
      book: { n: r.book.length, avg: mean(r.book.map((t) => retPct(t, costOf(model, 'new', t.symbol)))) },
      exam: { n: r.exam.length, avgNew, avgOld: mean(r.rOld), avg2x, winRate: r.rNew.filter((x) => x > 0).length / Math.max(1, r.rNew.length) },
      fillRate: r.it.sigs.length && r.it.sigs[0].rule.limit ? r.exam.length / Math.max(1, sigsExam) : null,
      control,
      dsr,
      pass: r.exam.length >= 100 && avgNew > 0 && avg2x > 0 && control.excessNew > 0 && control.pNew <= 0.05 && control.excess2x > 0 && control.p2x <= 0.05 && dsr >= 0.95,
    }
  })
}

// ---- Alpaca Market Data v2 (optional, used when both key env vars are set) ----

/** Historical stock bars, one page. Docs: https://docs.alpaca.markets/reference/stockbars (GET /v2/stocks/bars:
 *  symbols, timeframe, start, end, limit <= 10000, adjustment, feed, page_token; response { bars: { SYM: [{t,o,h,l,c,v}] },
 *  next_page_token }; headers APCA-API-KEY-ID / APCA-API-SECRET-KEY). The free plan is limited to feed=iex (IEX-only volume);
 *  the docs page does not state free-plan history or rate limits, so those are not assumed here. */
export function alpacaUrl(symbol: string, start: string, pageToken?: string | null): string {
  const q = new URLSearchParams({ symbols: symbol, timeframe: '5Min', start, limit: '10000', adjustment: 'split', feed: 'iex', sort: 'asc' })
  if (pageToken) q.set('page_token', pageToken)
  return `https://data.alpaca.markets/v2/stocks/bars?${q}`
}

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

/** All 5-minute bars of one symbol since `start`, following next_page_token. Keys go only in headers, never in logs. */
export async function alpacaBars(symbol: string, start: string, keyId: string, secret: string, fetchFn: FetchLike): Promise<Candle[]> {
  const out: Candle[] = []
  let token: string | null = null
  do {
    const res = await fetchFn(alpacaUrl(symbol, start, token), { headers: { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secret } })
    if (!res.ok) throw new Error(`Alpaca ${res.status} for ${symbol}`)
    const j = (await res.json()) as { bars?: Record<string, { t: string; o: number; h: number; l: number; c: number; v: number }[] | null>; next_page_token?: string | null }
    for (const b of j.bars?.[symbol] ?? []) out.push({ time: Math.floor(Date.parse(b.t) / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v })
    token = j.next_page_token ?? null
  } while (token)
  return out
}
