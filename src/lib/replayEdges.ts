/**
 * Atlas edge sweep (round 4): nine cheap, published ideas on free data, then an "edge portfolio" that combines
 * the daily return streams of everything tried. Pure functions; scripts/replay-edges.ts fetches the data.
 * Same rules as rounds 1-3: a signal uses data up to a close, fills are the next open (or a stated close for
 * calendar events known in advance), costs on every fill, judged on the newest 1/3 (the exam), nothing tuned.
 *
 *  E-FOMC     long SPY from the close before a scheduled FOMC announcement to the announcement-day close (Lucca & Moench 2015).
 *  E-TOM      turn of the month: close of the 2nd-to-last trading day to the close of the 3rd trading day of the next month (McConnell & Xu 2008).
 *  E-OPEX     SPY in options-expiration week (Monday to the third Friday) vs other weeks; traded only if the book is positive.
 *  E-VIXTS    hold SPY when ^VIX < ^VIX3M at the prior close (contango), else cash.
 *  E-HYG      hold SPY when HYG's 20-day return is above 0 at the prior close, else cash.
 *  E-PAIRS    eight fixed linked pairs, book-period hedge ratio, 60-day z-score of the log spread, in at |z| > 2, out at |z| < 0.5 or 20 days.
 *  E-INSIDER  SEC Form 4 open-market purchases (code P): 2+ distinct officers/directors within 30 days, buy the next open, hold 60 days.
 *  E-PUTWRITE Cboe PUT and BXM index histories against SPY.
 *  E-OVERNIGHT  buy the close of a 3%+ / 2x-volume up day, sell the next open (the daily-bar version of round 3's overnight idea).
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { dayKey } from './practice'
import type { ControlDraws } from './replayDaily'
import { seededRng } from './replayDaily'
import { ALL_TRIALS } from './replayIntraday'
import { deflatedSharpe, stats } from './replayLab'
import { perf, type Perf } from './replayRound2'
import { netRetPct } from './replayStrategies'

/** New ideas tried in this round: E-FOMC, E-TOM, E-OPEX, E-VIXTS, E-HYG, E-PAIRS, E-INSIDER, PUT, BXM, E-OVERNIGHT. */
export const EDGES_TRIALS = 10
/** Trials counted by the Deflated Sharpe of a single idea (rounds 1-3 plus this round). */
export const SINGLE_TRIALS = ALL_TRIALS + EDGES_TRIALS
/** The ensemble counts as one more trial. */
export const ENSEMBLE_TRIALS = SINGLE_TRIALS + 1
/** An idea needs this many exam trades to be judged (calendar events give only 50-80 in the exam). */
export const MIN_EXAM_TRADES = 30

// ---- FOMC calendar ----

/** Announcement day (the last day of each SCHEDULED meeting) from the Fed's public calendar pages:
 *  https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm (2021-2026) and
 *  https://www.federalreserve.gov/monetarypolicy/fomchistorical{2007..2020}.htm (read 2026-11-01).
 *  Left out on purpose: unscheduled meetings and conference calls (e.g. 2008-01-21, 2008-10-08, 2020-03-03,
 *  2020-03-15), the cancelled 2020-03-17/18 meeting and the 2025-08-22 notation vote. The Fed's page prints the
 *  meetings that span two months in a garbled way ("May 30-1" for April 30-May 1), those are written out here. */
export const FOMC_ANNOUNCEMENTS = `
2007-01-31 2007-03-21 2007-05-09 2007-06-28 2007-08-07 2007-09-18 2007-10-31 2007-12-11
2008-01-30 2008-03-18 2008-04-30 2008-06-25 2008-08-05 2008-09-16 2008-10-29 2008-12-16
2009-01-28 2009-03-18 2009-04-29 2009-06-24 2009-08-12 2009-09-23 2009-11-04 2009-12-16
2010-01-27 2010-03-16 2010-04-28 2010-06-23 2010-08-10 2010-09-21 2010-11-03 2010-12-14
2011-01-26 2011-03-15 2011-04-27 2011-06-22 2011-08-09 2011-09-21 2011-11-02 2011-12-13
2012-01-25 2012-03-13 2012-04-25 2012-06-20 2012-08-01 2012-09-13 2012-10-24 2012-12-12
2013-01-30 2013-03-20 2013-05-01 2013-06-19 2013-07-31 2013-09-18 2013-10-30 2013-12-18
2014-01-29 2014-03-19 2014-04-30 2014-06-18 2014-07-30 2014-09-17 2014-10-29 2014-12-17
2015-01-28 2015-03-18 2015-04-29 2015-06-17 2015-07-29 2015-09-17 2015-10-28 2015-12-16
2016-01-27 2016-03-16 2016-04-27 2016-06-15 2016-07-27 2016-09-21 2016-11-02 2016-12-14
2017-02-01 2017-03-15 2017-05-03 2017-06-14 2017-07-26 2017-09-20 2017-11-01 2017-12-13
2018-01-31 2018-03-21 2018-05-02 2018-06-13 2018-08-01 2018-09-26 2018-11-08 2018-12-19
2019-01-30 2019-03-20 2019-05-01 2019-06-19 2019-07-31 2019-09-18 2019-10-30 2019-12-11
2020-01-29 2020-04-29 2020-06-10 2020-07-29 2020-09-16 2020-11-05 2020-12-16
2021-01-27 2021-03-17 2021-04-28 2021-06-16 2021-07-28 2021-09-22 2021-11-03 2021-12-15
2022-01-26 2022-03-16 2022-05-04 2022-06-15 2022-07-27 2022-09-21 2022-11-02 2022-12-14
2023-02-01 2023-03-22 2023-05-03 2023-06-14 2023-07-26 2023-09-20 2023-11-01 2023-12-13
2024-01-31 2024-03-20 2024-05-01 2024-06-12 2024-07-31 2024-09-18 2024-11-07 2024-12-18
2025-01-29 2025-03-19 2025-05-07 2025-06-18 2025-07-30 2025-09-17 2025-10-29 2025-12-10
2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16 2026-10-28 2026-12-09
`.split(/\s+/).filter(Boolean)

// ---- calendar events: buy at the close of day b, sell at the close of day s ----

export interface Ev {
  b: number
  s: number
}

/** `days` are trading days, YYYY-MM-DD, ascending. An announcement that is not a trading day in `days` (a date
 *  after the data, or one that fell on a holiday) is returned in `skipped`, never moved. */
export function fomcEvents(days: string[], dates: string[]): { events: Ev[]; skipped: string[] } {
  const at = new Map(days.map((d, i) => [d, i]))
  const events: Ev[] = []
  const skipped: string[] = []
  for (const d of dates) {
    const i = at.get(d)
    if (i == null || i < 1) skipped.push(d)
    else events.push({ b: i - 1, s: i })
  }
  return { events, skipped }
}

/** One event per month end: buy the close of the 2nd-to-last trading day, sell the close of the 3rd trading day of the next month. */
export function turnOfMonthEvents(days: string[]): Ev[] {
  const out: Ev[] = []
  for (let k = 1; k + 3 < days.length; k++) {
    if (days[k].slice(0, 7) === days[k + 1].slice(0, 7)) continue // k is the last trading day of its month
    if (days[k - 1].slice(0, 7) !== days[k].slice(0, 7)) continue // a month with one trading day has no 2nd-to-last
    if (days[k + 3].slice(0, 7) !== days[k + 1].slice(0, 7)) continue // the next month has no 3rd trading day
    out.push({ b: k - 1, s: k + 3 })
  }
  return out
}

const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The Monday (YYYY-MM-DD) of the Mon-Sun week a day is in. */
export function mondayOf(day: string): string {
  const dow = new Date(utc(day)).getUTCDay()
  return ymd(utc(day) - ((dow + 6) % 7) * 86_400_000)
}

/** Index of the monthly options expiration in `days`: the third Friday, or the last trading day before it when
 *  that Friday is a market holiday (Good Friday, Juneteenth). -1 when the month has no such day in `days`. */
export function opexIndex(days: string[], year: number, month: number): number {
  let fridays = 0
  let third = ''
  for (let d = 1; d <= 31; d++) {
    const t = Date.UTC(year, month - 1, d)
    const dt = new Date(t)
    if (dt.getUTCMonth() !== month - 1) break
    if (dt.getUTCDay() === 5 && ++fridays === 3) third = ymd(t)
  }
  let at = -1
  for (let i = 0; i < days.length; i++) {
    if (days[i] > third) break
    if (days[i].slice(0, 7) === third.slice(0, 7)) at = i
  }
  return at
}

/** Weeks as buy-the-close-before, sell-the-last-close events. Opex weeks run Monday to the expiration day;
 *  every other full Mon-Fri week (holiday weeks included) runs to its last trading day. The last, possibly
 *  unfinished week of the data is dropped. */
export function opexWeeks(days: string[]): { opex: Ev[]; other: Ev[] } {
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  days.forEach((d, i) => {
    const w = mondayOf(d)
    if (!first.has(w)) first.set(w, i)
    last.set(w, i)
  })
  const lastWeek = mondayOf(days[days.length - 1])
  const expiry = new Map<string, number>()
  const months = new Set(days.map((d) => d.slice(0, 7)))
  for (const m of months) {
    const x = opexIndex(days, Number(m.slice(0, 4)), Number(m.slice(5, 7)))
    if (x >= 0) expiry.set(mondayOf(days[x]), x)
  }
  const opex: Ev[] = []
  const other: Ev[] = []
  for (const [w, f] of first) {
    if (f < 1 || w === lastWeek) continue
    const x = expiry.get(w)
    if (x != null) opex.push({ b: f - 1, s: x })
    else other.push({ b: f - 1, s: last.get(w)! })
  }
  return { opex, other }
}

/** Net percent return of each event at the given costs (a buy and a sell at the stated closes, one fill each). */
export const eventReturns = (close: number[], evs: Ev[], c: Costs | null): number[] => evs.map((e) => netRetPct(close[e.b], close[e.s], c, false))

// ---- random-date control from pools of candidate trades ----

export interface Pool {
  /** Net percent returns of every candidate trade at 1x and 2x costs. */
  r1: number[]
  r2: number[]
}
export interface Group {
  /** How many trades the strategy took in this group in the book and the exam. */
  want: { book: number; exam: number }
  pool: { book: Pool; exam: Pool }
}

/** Random-entry control: for every group and half, draw as many candidates as the strategy took (without
 *  replacement while the pool is big enough) and average them. Returns each draw's average per trade. */
export function poolControl(groups: Group[], draws = 200, seed = 1): ControlDraws {
  const out: ControlDraws = { book1: [], exam1: [], exam2: [], count: [] }
  for (let d = 0; d < draws; d++) {
    const rnd = seededRng(seed * 100_003 + d)
    const s = { b: 0, bn: 0, e1: 0, e2: 0, en: 0 }
    for (const g of groups) {
      for (const half of ['book', 'exam'] as const) {
        const pool = g.pool[half]
        const n = pool.r1.length
        if (!n) continue
        const want = g.want[half]
        const taken = new Set<number>()
        for (let k = 0; k < want; k++) {
          let i = Math.floor(rnd() * n)
          if (want <= n) while (taken.has(i)) i = Math.floor(rnd() * n)
          taken.add(i)
          if (half === 'book') {
            s.b += pool.r1[i]
            s.bn++
          } else {
            s.e1 += pool.r1[i]
            s.e2 += pool.r2[i]
            s.en++
          }
        }
      }
    }
    out.count.push(s.bn + s.en)
    out.book1.push(s.bn ? s.b / s.bn : 0)
    out.exam1.push(s.en ? s.e1 / s.en : 0)
    out.exam2.push(s.en ? s.e2 / s.en : 0)
  }
  return out
}

/** Candidates for a calendar event of `len` trading days: every start day in `days`, split by `examFrom`. */
export function eventPool(close: number[], days: string[], len: number, examFrom: string, c1: Costs | null, c2: Costs | null): Record<'book' | 'exam', Pool> {
  const out = { book: { r1: [] as number[], r2: [] as number[] }, exam: { r1: [] as number[], r2: [] as number[] } }
  for (let b = 0; b + len < close.length; b++) {
    if (!(close[b] > 0) || !(close[b + len] > 0)) continue
    const h = out[days[b] >= examFrom ? 'exam' : 'book']
    h.r1.push(netRetPct(close[b], close[b + len], c1, false))
    h.r2.push(netRetPct(close[b], close[b + len], c2, false))
  }
  return out
}

/** Groups for a set of events: candidates share the event's length, and it is drawn in the same half. */
export function eventGroups(close: number[], days: string[], evs: Ev[], examFrom: string, c1: Costs | null, c2: Costs | null): Group[] {
  const byLen = new Map<number, Ev[]>()
  for (const e of evs) byLen.set(e.s - e.b, [...(byLen.get(e.s - e.b) ?? []), e])
  return [...byLen].map(([len, list]) => ({
    want: { book: list.filter((e) => days[e.b] < examFrom).length, exam: list.filter((e) => days[e.b] >= examFrom).length },
    pool: eventPool(close, days, len, examFrom, c1, c2),
  }))
}

// ---- judging trades ----

export interface TradeSet {
  /** Net percent per trade: book and exam at 1x costs, exam at 2x. */
  book1: number[]
  exam1: number[]
  exam2: number[]
}

export interface EdgeEval {
  id: string
  en: string
  vi: string
  book: { n: number; avg: number; ctrl: number; excess: number }
  exam: { n: number; winRate: number; tstat: number; avg1x: number; avg2x: number; ctrl1x: number; ctrl2x: number; excess1x: number; excess2x: number; p1x: number; p2x: number }
  dsr: number
  passed: boolean
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
const sd = (a: number[]) => {
  const m = mean(a)
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1))
}
export const sharpeOf = (a: number[]) => (sd(a) > 0 ? mean(a) / sd(a) : 0)
/** Variance of a list of per-observation Sharpe ratios (the spread of luck among the ideas tried). */
export const sharpeVar = (srs: number[]) => {
  const m = mean(srs)
  return srs.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, srs.length - 1)
}

export const PASS_TRADES_EN = `PASS (trade-based ideas) = at least ${MIN_EXAM_TRADES} exam trades, exam average per trade above 0 at 1x AND 2x costs, exam excess over the 200-draw seeded random-date control above 0 at 1x and 2x with p <= 0.05 at both, the BOOK excess also above 0, and a Deflated Sharpe >= 0.95 counting ${SINGLE_TRIALS} trials (28 from rounds 1-3 plus ${EDGES_TRIALS} here). Fixed in advance; nothing is tuned on the exam.`
export const PASS_TRADES_VI = `QUA (ý tưởng theo lệnh) = từ ${MIN_EXAM_TRADES} lệnh thi, trung bình mỗi lệnh bài thi > 0 ở phí 1x VÀ 2x, phần vượt trội bài thi so với 200 lần chọn ngày ngẫu nhiên (có seed) > 0 ở 1x và 2x với p <= 0,05 ở cả hai, phần vượt trội của BOOK cũng > 0, và Deflated Sharpe >= 0,95 tính ${SINGLE_TRIALS} lần thử (28 của vòng 1-3 cộng ${EDGES_TRIALS} ở đây). Cố định từ trước; không chỉnh gì trên bài thi.`

export function evalTrades(id: string, en: string, vi: string, t: TradeSet, c: ControlDraws, trials: number, trialVar: number): EdgeEval {
  const ex = stats(t.exam1.map((retPct) => ({ retPct })))
  const ctrl = { book: mean(c.book1), x1: mean(c.exam1), x2: mean(c.exam2) }
  const avg2x = mean(t.exam2)
  const p1x = c.exam1.filter((x) => x >= ex.avgRet).length / Math.max(1, c.exam1.length)
  const p2x = c.exam2.filter((x) => x >= avg2x).length / Math.max(1, c.exam2.length)
  const book = { n: t.book1.length, avg: mean(t.book1), ctrl: ctrl.book, excess: mean(t.book1) - ctrl.book }
  const exam = { n: ex.n, winRate: ex.winRate, tstat: ex.sharpe * Math.sqrt(ex.n), avg1x: ex.avgRet, avg2x, ctrl1x: ctrl.x1, ctrl2x: ctrl.x2, excess1x: ex.avgRet - ctrl.x1, excess2x: avg2x - ctrl.x2, p1x, p2x }
  const dsr = deflatedSharpe(t.exam1, trials, trialVar)
  const passed = exam.n >= MIN_EXAM_TRADES && exam.avg1x > 0 && exam.avg2x > 0 && exam.excess1x > 0 && exam.excess2x > 0 && p1x <= 0.05 && p2x <= 0.05 && book.excess > 0 && dsr >= 0.95
  return { id, en, vi, book, exam, dsr, passed }
}

// ---- switches and return streams ----

/** Daily returns (fractions) of holding an asset on days after a signal. `sig[i]` (1 or 0) is known at the
 *  CLOSE of day i and decides the position held from day i+1's open. The overnight gap before an exit and the
 *  gap after an entry follow the old position: day t earns sig[t-2] x (open_t / close_{t-1} - 1) +
 *  sig[t-1] x (close_t / open_t - 1) and pays `side` for each fill (a change between sig[t-2] and sig[t-1]). */
export function switchStream(open: number[], close: number[], sig: number[], side: number): number[] {
  const out = new Array<number>(close.length).fill(0)
  for (let t = 1; t < close.length; t++) {
    const now = sig[t - 1] ? 1 : 0
    const was = t >= 2 && sig[t - 2] ? 1 : 0
    const o = open[t] > 0 ? open[t] : close[t]
    out[t] = was * (o / close[t - 1] - 1) + now * (close[t] / o - 1) - side * Math.abs(now - was)
  }
  return out
}

/** VIX term structure: 1 when the 30-day VIX is below the 3-month VIX at day i's close (contango); a missing value gives 0 (cash). */
export const vixTsSignal = (vix: number[], vix3m: number[]): number[] => vix.map((v, i) => (Number.isFinite(v) && Number.isFinite(vix3m[i]) && v < vix3m[i] ? 1 : 0))

/** HYG trend: 1 when HYG's n-day return at day i's close is above 0. */
export const hygSignal = (hyg: number[], n = 20): number[] => hyg.map((h, i) => (i >= n && Number.isFinite(h) && Number.isFinite(hyg[i - n]) && h / hyg[i - n] - 1 > 0 ? 1 : 0))

/** First index where a signal is usable: the first i with data, plus one for the lag. */
export const firstFinite = (a: number[]) => Math.max(0, a.findIndex(Number.isFinite))

/** Daily return stream of the signal column of an event list: the days between b and s earn the asset's
 *  daily close-to-close return, the buy side is paid on the first day and the sell side on the last. */
export function eventStream(close: number[], evs: Ev[], side: number): number[] {
  const out = new Array<number>(close.length).fill(0)
  for (const e of evs) {
    for (let j = e.b + 1; j <= e.s; j++) out[j] += close[j] / close[j - 1] - 1
    out[e.b + 1] -= side
    out[e.s] -= side
  }
  return out
}

export interface HalfPerf {
  book: Perf
  exam: Perf
}

/** Book and exam performance of a daily stream from index `start` on; the cut is the first index of the exam. */
export function halfPerf(rets: number[], years: number[], start: number, examIdx: number): HalfPerf {
  const cut = (a: number, z: number) => perf(rets.slice(a, z), years.slice(a, z), 252)
  return { book: cut(Math.min(start, examIdx), examIdx), exam: cut(Math.max(start, examIdx), rets.length) }
}

export interface SwitchEval {
  id: string
  en: string
  vi: string
  start: string
  /** Share of days in the market after the start. */
  invested: number
  spy: HalfPerf
  x1: HalfPerf
  x2: HalfPerf
  dsr: number
  passed: boolean
}

export const PASS_SWITCH_EN = `PASS (switches and portfolios, judged against SPY buy-and-hold over the same days) = exam Sharpe above SPY's at 1x AND 2x costs, exam max drawdown shallower than SPY's at both, the BOOK agrees (Sharpe above SPY's and max drawdown shallower at 1x), and a Deflated Sharpe >= 0.95 on the exam daily returns counting ${SINGLE_TRIALS} trials (the ensemble ${ENSEMBLE_TRIALS}). Fixed in advance.`
export const PASS_SWITCH_VI = `QUA (chuyển trạng thái và danh mục, so với SPY mua-giữ cùng khoảng ngày) = Sharpe bài thi cao hơn SPY ở phí 1x VÀ 2x, sụt giảm tối đa bài thi nông hơn SPY ở cả hai, BOOK đồng ý (Sharpe cao hơn SPY và sụt giảm nông hơn ở 1x), và Deflated Sharpe >= 0,95 trên lợi nhuận ngày của bài thi tính ${SINGLE_TRIALS} lần thử (danh mục kết hợp ${ENSEMBLE_TRIALS}). Cố định từ trước.`

export function switchPass(spy: HalfPerf, x1: HalfPerf, x2: HalfPerf, dsr: number): boolean {
  const beats = (x: HalfPerf, half: 'book' | 'exam') => x[half].sharpe > spy[half].sharpe && Math.abs(x[half].maxDD) < Math.abs(spy[half].maxDD)
  return beats(x1, 'exam') && beats(x2, 'exam') && beats(x1, 'book') && dsr >= 0.95
}

export function evalSwitch(id: string, en: string, vi: string, o: { days: string[]; years: number[]; start: number; examIdx: number; spy: number[]; x1: number[]; x2: number[]; invested: number; trials: number; trialVar: number }): SwitchEval {
  const h = (r: number[]) => halfPerf(r, o.years, o.start, o.examIdx)
  const [spy, x1, x2] = [h(o.spy), h(o.x1), h(o.x2)]
  const dsr = deflatedSharpe(o.x1.slice(Math.max(o.start, o.examIdx)), o.trials, o.trialVar)
  return { id, en, vi, start: o.days[o.start], invested: o.invested, spy, x1, x2, dsr, passed: switchPass(spy, x1, x2, dsr) }
}

// ---- pairs ----

/** Slope of y on x by least squares (with an intercept). */
export function olsBeta(x: number[], y: number[]): number {
  const [mx, my] = [mean(x), mean(y)]
  let cov = 0
  let vr = 0
  for (let i = 0; i < x.length; i++) {
    cov += (x[i] - mx) * (y[i] - my)
    vr += (x[i] - mx) ** 2
  }
  return vr > 0 ? cov / vr : NaN
}

/** z-score of the log spread ln A - beta ln B against its own trailing `win` days (including today); NaN until `win` days exist. */
export function spreadZ(la: number[], lb: number[], beta: number, win = 60): number[] {
  const s = la.map((v, i) => v - beta * lb[i])
  return s.map((v, i) => {
    if (i < win - 1) return NaN
    const w = s.slice(i - win + 1, i + 1)
    const m = mean(w)
    const d = sd(w)
    return d > 0 ? (v - m) / d : NaN
  })
}

export interface PairTrade {
  /** Entry bar (fills at its open), exit bar, and whether the exit fills at that bar's close (time exit) or open (rule exit). */
  e: number
  x: number
  exitClose: boolean
  /** +1 = long A, short B (the spread is cheap); -1 = short A, long B. */
  dir: 1 | -1
}

export interface PairOpts {
  enter: number
  exit: number
  maxHold: number
}
export const PAIR_RULE: PairOpts = { enter: 2, exit: 0.5, maxHold: 20 }

/** Trades from a z-score series. A signal at day t's close enters at day t+1's open; after the entry bar the
 *  position leaves at the NEXT open once |z| < exit, or at the close of its `maxHold`-th day. A trade that cannot
 *  finish inside the data is dropped. One position per pair. */
export function pairTrades(z: number[], o: PairOpts = PAIR_RULE): PairTrade[] {
  const out: PairTrade[] = []
  const n = z.length
  let t = 0
  while (t < n - 1) {
    if (!(Math.abs(z[t]) > o.enter)) {
      t++
      continue
    }
    const e = t + 1
    const dir: 1 | -1 = z[t] > 0 ? -1 : 1
    let x = -1
    let exitClose = false
    for (let j = e; j < n; j++) {
      if (j === e + o.maxHold - 1) {
        x = j
        exitClose = true
        break
      }
      if (Math.abs(z[j]) < o.exit) {
        x = j + 1
        break
      }
    }
    if (x < 0 || x >= n) break
    out.push({ e, x, exitClose, dir })
    t = x
  }
  return out
}

/** Percent return of a short position (sold at `entry`, bought back at `exit`) after costs, on the entry notional. */
export function shortRetPct(entry: number, exit: number, c: Costs | null): number {
  const slip = c ? (c.spreadBps / 2 + c.slippageBps) / 1e4 : 0
  const fee = c ? c.feeBps / 1e4 : 0
  return ((entry * (1 - slip) * (1 - fee) - exit * (1 + slip) * (1 + fee)) / entry) * 100
}

export interface PairBars {
  days: string[]
  oA: number[]
  cA: number[]
  oB: number[]
  cB: number[]
}

/** Net percent return of a pair trade on its gross notional: leg A weighs 1/(1+beta) and leg B beta/(1+beta);
 *  each leg pays the costs of its own symbol on both fills. Exact hedge: no borrow fee is charged. */
export function pairTradeRet(p: PairBars, t: PairTrade, beta: number, cA: Costs | null, cB: Costs | null): number {
  const [wA, wB] = [1 / (1 + beta), beta / (1 + beta)]
  const [inA, inB] = [p.oA[t.e], p.oB[t.e]]
  const [outA, outB] = t.exitClose ? [p.cA[t.x], p.cB[t.x]] : [p.oA[t.x], p.oB[t.x]]
  const legA = t.dir === 1 ? netRetPct(inA, outA, cA, false) : shortRetPct(inA, outA, cA)
  const legB = t.dir === 1 ? shortRetPct(inB, outB, cB) : netRetPct(inB, outB, cB, false)
  return wA * legA + wB * legB
}

/** Daily P&L of one pair trade as a fraction of its gross notional, with fixed share counts; the exit day
 *  carries the costs so the days add up to `net` (a percent). Returns [day, pnl] pairs. */
export function pairPath(p: PairBars, t: PairTrade, beta: number, net: number): [string, number][] {
  const [wA, wB] = [1 / (1 + beta), beta / (1 + beta)]
  const [inA, inB] = [p.oA[t.e], p.oB[t.e]]
  const [outA, outB] = t.exitClose ? [p.cA[t.x], p.cB[t.x]] : [p.oA[t.x], p.oB[t.x]]
  const out: [string, number][] = []
  let sum = 0
  for (let j = t.e; j <= t.x; j++) {
    const [mA, mB] = j === t.x ? [outA, outB] : [p.cA[j], p.cB[j]]
    const [pA, pB] = j === t.e ? [inA, inB] : [p.cA[j - 1], p.cB[j - 1]]
    const r = t.dir * (wA * ((mA - pA) / inA) - wB * ((mB - pB) / inB))
    sum += r
    out.push([p.days[j], r])
  }
  out[out.length - 1][1] += net / 100 - sum
  return out
}

/** Candidates for the pair control: every entry bar with both a start and a `h`-day exit inside the data, in
 *  both directions (so a draw picks a random day AND a random side), at 1x / 2x costs. */
export function pairPool(p: PairBars, h: number, exitClose: boolean, examFrom: string, beta: number, c1: [Costs | null, Costs | null], c2: [Costs | null, Costs | null]): Record<'book' | 'exam', Pool> {
  const out = { book: { r1: [] as number[], r2: [] as number[] }, exam: { r1: [] as number[], r2: [] as number[] } }
  for (let e = 1; e + h < p.days.length; e++) {
    const half = out[p.days[e] >= examFrom ? 'exam' : 'book']
    for (const dir of [1, -1] as const) {
      const t: PairTrade = { e, x: e + h, exitClose, dir }
      half.r1.push(pairTradeRet(p, t, beta, c1[0], c1[1]))
      half.r2.push(pairTradeRet(p, t, beta, c2[0], c2[1]))
    }
  }
  return out
}

// ---- insider purchases (SEC Form 3/4/5 bulk data) ----

export interface InsiderRow {
  /** Issuer CIK without leading zeros. */
  cik: string
  /** Filing date, YYYY-MM-DD: the day the purchase became public. */
  day: string
  /** Reporting owner CIK. */
  owner: string
}

const MONTHS: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' }
/** '31-MAR-2020' -> '2020-03-31'; '' when it does not parse. */
export function dmyToIso(s: string): string {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim())
  return m && MONTHS[m[2].toUpperCase()] ? `${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}` : ''
}

/** Tab-separated table with a header row to an array of column->value maps. */
export function parseTsv(text: string): Record<string, string>[] {
  const lines = text.split('\n')
  const head = lines[0].replace(/\r$/, '').split('\t')
  const out: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue
    const cells = lines[i].replace(/\r$/, '').split('\t')
    const row: Record<string, string> = {}
    head.forEach((h, k) => (row[h] = cells[k] ?? ''))
    out.push(row)
  }
  return out
}

/** Open-market purchases (code P, acquired, a price) in Form 4 filings of the given issuers, one row per
 *  qualifying owner. Only officers and directors count as insiders (10% holders and others do not); amended
 *  forms (4/A) are skipped so a purchase is not counted twice. Inputs are the raw SUBMISSION, REPORTINGOWNER
 *  and NONDERIV_TRANS tables of one quarterly SEC "insider transactions" data set. */
export function insiderRows(submission: string, owners: string, trans: string, issuers: Set<string>): InsiderRow[] {
  const sub = new Map<string, { cik: string; day: string }>()
  for (const r of parseTsv(submission)) {
    const cik = r.ISSUERCIK.replace(/^0+/, '')
    if (r.DOCUMENT_TYPE === '4' && issuers.has(cik)) sub.set(r.ACCESSION_NUMBER, { cik, day: dmyToIso(r.FILING_DATE) })
  }
  const bought = new Set<string>()
  for (const r of parseTsv(trans)) {
    if (r.TRANS_CODE === 'P' && r.TRANS_ACQUIRED_DISP_CD === 'A' && Number(r.TRANS_PRICEPERSHARE) > 0 && sub.has(r.ACCESSION_NUMBER)) bought.add(r.ACCESSION_NUMBER)
  }
  const out: InsiderRow[] = []
  for (const r of parseTsv(owners)) {
    const s = sub.get(r.ACCESSION_NUMBER)
    const rel = (r.RPTOWNER_RELATIONSHIP ?? '').toLowerCase()
    if (s && s.day && bought.has(r.ACCESSION_NUMBER) && (rel.includes('director') || rel.includes('officer'))) out.push({ cik: s.cik, day: s.day, owner: r.RPTOWNERCIK.replace(/^0+/, '') })
  }
  return out
}

/** Days (filing dates) on which at least `minOwners` DISTINCT insiders of one issuer have filed a purchase in
 *  the last `windowDays` calendar days, today included. Uses filing dates only, so it is known on that day. */
export function clusterDays(rows: { day: string; owner: string }[], minOwners = 2, windowDays = 30): string[] {
  const days = [...new Set(rows.map((r) => r.day))].sort()
  return days.filter((d) => {
    const lo = utc(d) - (windowDays - 1) * 86_400_000
    return new Set(rows.filter((r) => r.day <= d && utc(r.day) >= lo).map((r) => r.owner)).size >= minOwners
  })
}

/** Index of the last bar whose day is on or before `day` (a filing on a holiday maps to the day before); -1 if none. */
export function barOnOrBefore(barDays: string[], day: string): number {
  let lo = 0
  let hi = barDays.length - 1
  let at = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (barDays[mid] <= day) {
      at = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return at
}

// ---- overnight winners (daily-bar version) ----

/** Bars i where the close is up 3%+ on the previous close and the day's volume is at least 2x its 20-day average
 *  (the 20 days before). The trade is bought at that close and sold at the next open. */
export function overnightSignals(bars: Candle[]): number[] {
  const out: number[] = []
  let v = 0
  for (let i = 0; i < bars.length; i++) {
    if (i >= 21) {
      v = 0
      for (let k = i - 20; k < i; k++) v += bars[k].volume
      if (v > 0 && bars[i].close >= bars[i - 1].close * 1.03 && bars[i].volume >= 2 * (v / 20) && i + 1 < bars.length) out.push(i)
    }
  }
  return out
}

/** Net percent return of buying a close and selling the next open. */
export const overnightRet = (bars: Candle[], i: number, c: Costs | null) => netRetPct(bars[i].close, bars[i + 1].open, c, false)

// ---- the edge portfolio ----

export interface Sleeve {
  id: string
  /** Daily net returns (fractions) over the whole calendar; days before `start` are 0 and unused. */
  rets: number[]
  start: number
}

/** 1 / daily volatility of each sleeve over the book days it was alive (0 when it has fewer than 60 or no variance). */
export function bookInvVol(sleeves: Sleeve[], examIdx: number): number[] {
  return sleeves.map((s) => {
    const r = s.rets.slice(s.start, examIdx)
    const d = r.length >= 60 ? sd(r) : 0
    return d > 0 ? 1 / d : 0
  })
}

/** Daily returns of a portfolio of sleeves with fixed raw weights `w` (0 = left out). On the first trading day of
 *  every month it resets to w / sum(w) over the sleeves that exist by then; in between each sleeve's share drifts
 *  with its own return. Sleeve returns already include their own costs. */
export function ensembleStream(sleeves: Sleeve[], w: number[], days: string[]): { rets: number[]; start: number } {
  const n = days.length
  const rets = new Array<number>(n).fill(0)
  const live = sleeves.map((s, k) => (w[k] > 0 ? s.start : Infinity))
  const start = Math.min(...live)
  let v = sleeves.map(() => 0)
  for (let t = Number.isFinite(start) ? start : n; t < n; t++) {
    if (t === start || days[t].slice(0, 7) !== days[t - 1].slice(0, 7)) {
      const raw = sleeves.map((_, k) => (w[k] > 0 && live[k] <= t ? w[k] : 0))
      const tot = raw.reduce((a, b) => a + b, 0)
      v = raw.map((x) => (tot > 0 ? x / tot : 0))
    }
    const r = v.reduce((a, x, k) => a + x * sleeves[k].rets[t], 0)
    rets[t] = r
    v = v.map((x, k) => (x * (1 + sleeves[k].rets[t])) / (1 + r))
  }
  return { rets, start: Number.isFinite(start) ? start : n }
}

/** Pearson correlation of two sleeves over the days both are alive; NaN with fewer than 30 shared days. */
export function sleeveCorr(a: Sleeve, b: Sleeve): number {
  const from = Math.max(a.start, b.start)
  const x = a.rets.slice(from)
  const y = b.rets.slice(from)
  if (x.length < 30) return NaN
  const [mx, my] = [mean(x), mean(y)]
  let c = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < x.length; i++) {
    c += (x[i] - mx) * (y[i] - my)
    vx += (x[i] - mx) ** 2
    vy += (y[i] - my) ** 2
  }
  return vx > 0 && vy > 0 ? c / Math.sqrt(vx * vy) : NaN
}
