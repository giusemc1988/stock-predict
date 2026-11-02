/**
 * Atlas news lab (round 4): does Chan (2003, JFE, "Stock price reaction to news and no-news") hold for our leads?
 * Big price moves WITHOUT news tend to reverse; moves WITH news tend to continue. Pure functions;
 * scripts/replay-news.ts fetches prices and news and writes public/replay-news.json.
 *
 *  N1 D1 short-term reversal (bottom 10% by 5-day return, hold 5 days), plain and with the two VIX gates of round 2.
 *     News window: after the close 5 trading days before the signal day, up to the signal day's close.
 *     Expect: the no-news losers bounce more.
 *  N2 Intraday winners held overnight (I3 winners proxy, 60m bars). News window: after the prior close, up to the
 *     15:30 ET decision. Expect: the news-driven winners drift more overnight.
 *  N3 Big daily movers (|1-day return| >= 4%), next-5-day return, up and down separately. News window: after the
 *     prior close, up to the mover's close.
 *
 * NEWS DATA: only the TIMESTAMPS and symbols of Alpaca (Benzinga) news items are used, never the headline text,
 * so there is no look-ahead through content and no language model that could have memorised the outcome.
 * Endpoint docs (fetched 2026-11-01): https://docs.alpaca.markets/reference/news-3
 *   GET https://data.alpaca.markets/v1beta1/news, params symbols (comma list), start / end (RFC-3339 or YYYY-MM-DD,
 *   inclusive), sort asc|desc (by updated date), limit 1..50, include_content, exclude_contentless, page_token;
 *   response { news: [{ id, headline, author, created_at, updated_at, summary, content, images, symbols, source, url }],
 *   next_page_token }. The page does NOT state the earliest date, the free-plan limits or the rate limit (only a 429
 *   response and rate-limit headers), so none of those is assumed: the first month with news for most names is
 *   measured from the data (newsCoverageMonth) and signals before it are dropped, and a 429 is retried with backoff.
 *
 * A trade is in the "news" bucket when at least one item tagged with its symbol has created_at inside the window
 * (after the start, up to and including the end); otherwise "no news". created_at is the publication time.
 *
 * Judging is the labs' rule: book / exam split by date, a random-entry control with the SAME symbols, trade counts,
 * holds, costs AND the same news bucket (random days must also be news days, or no-news days, of that symbol),
 * excess over the control, Deflated Sharpe counting every trial so far plus this round's, costs 1x and 2x.
 * The key comparison is excess(no news) minus excess(news) and its permutation-test p-value.
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { dayKey } from './practice'
import { COST_MULTS, controlDaily, costsOf, evalDaily, runDaily, scaleCosts, seededRng, simulateDaily, type ControlDraws, type CostsFor, type DailyResult, type DailySignal, type DailyTrade, type Series } from './replayDaily'
import { ALL_TRIALS, costOf, etMinutes, judge, retPct, run, simulate, type CostModel, type ITrade, type Result, type Sig, type SymDays } from './replayIntraday'
import { netRetPct } from './replayStrategies'

/** Variants (bucket cells) tried in this round: N1 3 leads x 2 buckets, N2 2 x 2, N3 2 x 2. */
export const NEWS_TRIALS = 14
export const NEWS_ALL_TRIALS = ALL_TRIALS + NEWS_TRIALS

// ---- Alpaca news ----

export const ALPACA_NEWS_URL = 'https://data.alpaca.markets/v1beta1/news'

export function alpacaNewsUrl(symbol: string, start: string, end: string, pageToken?: string | null): string {
  const q = new URLSearchParams({ symbols: symbol, start, end, limit: '50', sort: 'asc', include_content: 'false' })
  if (pageToken) q.set('page_token', pageToken)
  return `${ALPACA_NEWS_URL}?${q}`
}

export type NewsFetch = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export interface NewsDeps {
  keyId: string
  secret: string
  fetchFn: NewsFetch
  /** Wait between requests / before a retry. */
  pause: (ms: number) => Promise<void>
  /** Ms between two requests. */
  gapMs?: number
  /** Per symbol per month cache (completed months only). */
  cache?: { get: (symbol: string, month: string) => number[] | null; set: (symbol: string, month: string, times: number[]) => void }
  /** True when the time budget is spent: loading stops with NewsIncomplete (finished months stay cached). */
  stop?: () => boolean
  /** Epoch ms "now" (a month is cached only when it ended more than a day ago). */
  now?: () => number
}

export class NewsIncomplete extends Error {}
interface NewsPage { news?: { created_at?: string }[]; next_page_token?: string | null }

/** created_at of every item of one symbol in [start, end], as sorted epoch seconds. Keys go only in headers. */
export async function newsTimes(symbol: string, start: string, end: string, d: NewsDeps): Promise<number[]> {
  const out: number[] = []
  let token: string | null = null
  do {
    let j = null as NewsPage | null
    for (let attempt = 0; attempt < 6 && !j; attempt++) {
      if (d.stop?.()) throw new NewsIncomplete('time budget spent')
      const res = await d.fetchFn(alpacaNewsUrl(symbol, start, end, token), { headers: { 'APCA-API-KEY-ID': d.keyId, 'APCA-API-SECRET-KEY': d.secret } })
      if (res.ok) j = (await res.json()) as NewsPage
      else if (res.status === 429 || res.status >= 500) await d.pause(2000 * 2 ** attempt)
      else throw new Error(`Alpaca news ${res.status} for ${symbol}`)
      if (d.gapMs) await d.pause(d.gapMs)
    }
    if (!j) throw new Error(`Alpaca news kept failing for ${symbol}`)
    for (const n of j.news ?? []) {
      const t = Date.parse(n.created_at ?? '')
      if (Number.isFinite(t)) out.push(Math.floor(t / 1000))
    }
    token = j.next_page_token ?? null
  } while (token)
  return out.sort((a, b) => a - b)
}

/** 'YYYY-MM' list from `from` to the month of `nowMs`, inclusive. */
export function monthsFrom(from: string, nowMs: number): string[] {
  const out: string[] = []
  const end = new Date(nowMs).toISOString().slice(0, 7)
  let [y, m] = from.split('-').map(Number)
  for (;;) {
    const k = `${y}-${String(m).padStart(2, '0')}`
    if (k > end) return out
    out.push(k)
    if (++m > 12) { m = 1; y++ }
  }
}

/** Every item time of one symbol from month `from` to now, month by month (cached when the month is complete). */
export async function loadSymbolNews(symbol: string, from: string, d: NewsDeps): Promise<number[]> {
  const now = (d.now ?? Date.now)()
  const all: number[] = []
  for (const month of monthsFrom(from, now)) {
    const start = Date.UTC(+month.slice(0, 4), +month.slice(5) - 1, 1)
    const next = Date.UTC(+month.slice(0, 4), +month.slice(5), 1)
    let times = d.cache?.get(symbol, month) ?? null
    if (!times) {
      times = await newsTimes(symbol, new Date(start).toISOString(), new Date(next - 1000).toISOString(), d)
      if (next + 86_400_000 < now) d.cache?.set(symbol, month, times)
    }
    for (const t of times) all.push(t)
  }
  return all.sort((a, b) => a - b)
}

// ---- windows and buckets ----

export type NewsIndex = Map<string, number[]>

/** Any item time t with after < t <= upTo? `times` sorted ascending. */
export function hasNews(times: number[] | undefined, after: number, upTo: number): boolean {
  if (!times?.length || upTo <= after) return false
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= after) lo = mid + 1
    else hi = mid
  }
  return lo < times.length && times[lo] <= upTo
}

/** Epoch seconds of `minutes` after midnight ET on `day` (YYYY-MM-DD); daylight saving handled by Intl. */
export function etEpoch(day: string, minutes: number): number {
  const [y, m, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d) / 1000 + minutes * 60 + 5 * 3600 // exact in winter, an hour late in summer
  return guess + (minutes - etMinutes(guess)) * 60
}
export const sessionClose = (day: string) => etEpoch(day, 960)

export type Window = [after: number, upTo: number]
const dayOf = (b: Candle) => dayKey(b.time * 1000)

/** N1: after the close `n` trading days before the signal day, up to the signal day's close. */
export const trailingWindow = (bars: Candle[], i: number, n: number): Window | null =>
  i >= n ? [sessionClose(dayOf(bars[i - n])), sessionClose(dayOf(bars[i]))] : null

/** N2: after the previous session's close, up to the first bar at or after 15:30 ET (the decision time). */
export function afternoonWindow(sd: SymDays, di: number): Window | null {
  if (di < 1) return null
  const d = sd.days[di]
  const k = d.min.findIndex((m) => m >= 930)
  return k < 0 ? null : [sessionClose(sd.days[di - 1].key), d.bars[k].time]
}

/** First 'YYYY-MM' in which at least `share` of `symbols` have an item (the news archive is thin before that). */
export function newsCoverageMonth(news: NewsIndex, symbols: string[], share = 0.8): string | null {
  const per = new Map<string, Set<string>>()
  for (const s of symbols) for (const t of news.get(s) ?? []) {
    const m = new Date(t * 1000).toISOString().slice(0, 7)
    if (!per.has(m)) per.set(m, new Set())
    per.get(m)!.add(s)
  }
  return [...per.keys()].sort().find((m) => per.get(m)!.size >= share * symbols.length) ?? null
}
export const monthStart = (m: string) => Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 1) / 1000

export type Bucket = 'none' | 'news'

/** Bucket of a window, or null when the window starts before the news archive is trusted (coverageFrom, epoch s). */
export function bucketOf(times: number[] | undefined, w: Window | null, coverageFrom: number): Bucket | null {
  if (!w || w[0] < coverageFrom) return null
  return hasNews(times, w[0], w[1]) ? 'news' : 'none'
}

// ---- signals for N3 ----

/** Big movers: |close / previous close - 1| >= minMove on bar i, up or down; hold `hold` days from the next open. */
export function moverSignals(u: Series[], dir: 'up' | 'down', minMove = 0.04, hold = 5): DailySignal[] {
  const out: DailySignal[] = []
  u.forEach((s, sym) => {
    for (let i = 1; i < s.bars.length; i++) {
      const r = s.bars[i].close / s.bars[i - 1].close - 1
      if (dir === 'up' ? r >= minMove : r <= -minMove) out.push({ sym, i, hold, stopDist: null, targetDist: null })
    }
  })
  return out
}

// ---- statistics ----

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)

/** Permutation test of mean(a) - mean(b): labels are shuffled over the pooled values. `higher` is the side the
 *  hypothesis says is larger; p is one-sided in that direction, pTwo two-sided. (1 + hits) / (perms + 1). */
export function permutationDiff(a: number[], b: number[], higher: 'a' | 'b', perms = 5000, seed = 7): { diff: number; p: number; pTwo: number } {
  if (!a.length || !b.length) return { diff: 0, p: 1, pTwo: 1 }
  const diff = mean(a) - mean(b)
  const pool = [...a, ...b]
  const rnd = seededRng(seed)
  let one = 0
  let two = 0
  for (let k = 0; k < perms; k++) {
    for (let x = pool.length - 1; x > 0; x--) {
      const y = Math.floor(rnd() * (x + 1))
      ;[pool[x], pool[y]] = [pool[y], pool[x]]
    }
    let s = 0
    for (let x = 0; x < a.length; x++) s += pool[x]
    let t = 0
    for (let x = a.length; x < pool.length; x++) t += pool[x]
    const d = s / a.length - t / b.length
    if (higher === 'a' ? d >= diff : d <= diff) one++
    if (Math.abs(d) >= Math.abs(diff) - 1e-12) two++
  }
  return { diff, p: (1 + one) / (perms + 1), pTwo: (1 + two) / (perms + 1) }
}

// ---- per-trade expected control (for the difference test) ----

/** Mean return of the control population by `symbolIndex|year` for EXAM candidates only: every bar the control may
 *  draw (same bucket, same hold, no stop), priced at 1x and 2x costs. A trade's excess = its return minus this. */
export function expectedDaily(u: Series[], hold: number, ok: (sym: number, i: number) => boolean, examFrom: string, costs: CostsFor, dayOk?: (day: string) => boolean): Map<string, { m1: number; m2: number }> {
  const out = new Map<string, { m1: number; m2: number }>()
  u.forEach((s, sym) => {
    const cs = costsOf(costs, s.symbol)
    const [c1, c2] = [scaleCosts(cs, 1), scaleCosts(cs, 2)]
    const acc = new Map<number, { a: number; b: number; n: number }>()
    for (let i = 14; i + hold < s.bars.length; i++) {
      if (!ok(sym, i) || (dayOk && !dayOk(dayKey(s.bars[i].time * 1000)))) continue
      const ms = s.bars[i + 1].time * 1000
      if (dayKey(ms) < examFrom) continue
      const t = simulateDaily(s.bars, { i, hold, stopDist: null, targetDist: null }, null)
      if (!t) continue
      const y = new Date(ms).getUTCFullYear()
      const q = acc.get(y) ?? { a: 0, b: 0, n: 0 }
      q.a += netRetPct(t.entry!, t.exit!, c1, false)
      q.b += netRetPct(t.entry!, t.exit!, c2, false)
      q.n++
      acc.set(y, q)
    }
    for (const [y, q] of acc) out.set(`${sym}|${y}`, { m1: q.a / q.n, m2: q.b / q.n })
  })
  return out
}

/** Per exam trade: its net return minus the expected control return of its symbol and year (1x and 2x costs). */
export function dailyExcesses(u: Series[], examFrom: string, x1: DailyTrade[], x2: DailyTrade[], exp: Map<string, { m1: number; m2: number }>): { e1: number[]; e2: number[] } {
  const idx = new Map(u.map((s, k) => [s.symbol, k]))
  const e1: number[] = []
  const e2: number[] = []
  x1.forEach((t, k) => {
    if (dayKey(t.openedAt) < examFrom) return
    const m = exp.get(`${idx.get(t.symbol)}|${new Date(t.openedAt).getUTCFullYear()}`)
    if (!m || !x2[k]) return
    e1.push(t.retPct - m.m1)
    e2.push(x2[k].retPct - m.m2)
  })
  return { e1, e2 }
}

/** Intraday control expectation per symbol: the mean over the symbol's allowed exam days and every start bar the
 *  control (`control()` in replayIntraday) may use, for the rule's exit, at the new costs and at 2x. */
export function expectedIntraday(syms: SymDays[], sample: Pick<ITrade, 'rule' | 'dir'>, examFrom: string, model: CostModel, allow: (sd: SymDays, di: number) => boolean): Map<string, { m1: number; m2: number }> {
  const out = new Map<string, { m1: number; m2: number }>()
  const h = typeof sample.rule.hold === 'number' ? sample.rule.hold : 1
  const lo = sample.rule.limit || sample.rule.stopPct ? 0 : -1
  for (const sd of syms) {
    let a = 0
    let b = 0
    let n = 0
    sd.days.forEach((d, di) => {
      if (d.key < examFrom || !allow(sd, di)) return
      for (let t = lo; t <= d.bars.length - 1 - h; t++) {
        const k = simulate(sd, di, t, sample.dir, { ...sample.rule, moc: false })
        if (!k) continue
        a += retPct(k, costOf(model, 'new', k.symbol))
        b += retPct(k, costOf(model, 'x2', k.symbol))
        n++
      }
    })
    if (n) out.set(sd.symbol, { m1: a / n, m2: b / n })
  }
  return out
}

export function intradayExcesses(trades: ITrade[], examFrom: string, model: CostModel, exp: Map<string, { m1: number; m2: number }>): { e1: number[]; e2: number[] } {
  const e1: number[] = []
  const e2: number[] = []
  for (const t of trades) {
    const m = exp.get(t.symbol)
    if (dayKey(t.openedAt) < examFrom || !m) continue
    e1.push(retPct(t, costOf(model, 'new', t.symbol)) - m.m1)
    e2.push(retPct(t, costOf(model, 'x2', t.symbol)) - m.m2)
  }
  return { e1, e2 }
}

// ---- results ----

export interface LeadInfo {
  id: string
  en: string
  vi: string
  /** Chan's prediction for the long trade: which bucket has the larger excess. */
  expect: 'noNewsHigher' | 'newsHigher'
}

export interface BucketOut {
  nBook: number
  nExam: number
  winRate: number
  /** Exam average return per trade after costs, percent. */
  avg: { x1: number; x2: number }
  control: { x1: number; x2: number }
  excess: { x1: number; x2: number }
  /** Share of control draws at least as good as the actual average (the labs' p). */
  p: { x1: number; x2: number }
  dsr: number
  /** The labs' rule alone (n, excess, p, DSR), without the news comparison. */
  passed: boolean
}

export interface LeadResult {
  id: string
  en: string
  vi: string
  expect: LeadInfo['expect']
  none: BucketOut
  news: BucketOut
  /** excess(no news) minus excess(news), percent per trade, with the permutation-test p (one-sided in the expected direction, two-sided). */
  diff: { x1: number; x2: number; p: { x1: number; x2: number }; pTwo: { x1: number; x2: number }; nNone: number; nNews: number }
  /** The bucket the hypothesis favours passes the labs' rule AND the difference is significant in the expected direction at 1x and 2x. */
  passed: boolean
  summary: { en: string; vi: string }
}

export const PASS_RULE_EN = `PASS (per lead) = the bucket Chan's hypothesis favours (no news for N1 and for down movers, news for N2 and for up movers) passes the labs' rule on the exam (100+ trades, excess over the same-bucket random-entry control > 0 at 1x and 2x costs, p <= 0.05 at both, Deflated Sharpe >= 0.95 counting all ${NEWS_ALL_TRIALS} variants tried in rounds 1-4) AND excess(no news) minus excess(news) is in the predicted direction with a one-sided permutation p <= 0.05 at both 1x and 2x costs. Fixed in advance; nothing is tuned on the exam.`
export const PASS_RULE_VI = `ĐẠT (mỗi hướng) = nhóm mà giả thuyết của Chan ưu tiên (không có tin cho N1 và cổ phiếu giảm mạnh, có tin cho N2 và cổ phiếu tăng mạnh) qua luật của các lab trên kỳ thi (từ 100 lệnh, vượt nhóm đối chứng vào lệnh ngẫu nhiên cùng nhóm tin > 0 ở phí 1x và 2x, p <= 0,05 ở cả hai, Deflated Sharpe >= 0,95 tính cả ${NEWS_ALL_TRIALS} biến thể đã thử ở vòng 1-4) VÀ chênh lệch phần vượt trội (không tin trừ có tin) đúng chiều dự đoán với p hoán vị một phía <= 0,05 ở cả phí 1x và 2x. Cố định trước; không chỉnh theo kỳ thi.`

const f = (x: number, d = 3) => x.toFixed(d)
const sg = (x: number) => `${x >= 0 ? '+' : ''}${f(x)}%`

export function assembleLead(lead: LeadInfo, none: BucketOut, news: BucketOut, e: { none: { e1: number[]; e2: number[] }; news: { e1: number[]; e2: number[] } }): LeadResult {
  const higher = lead.expect === 'noNewsHigher' ? 'a' : 'b'
  const t1 = permutationDiff(e.none.e1, e.news.e1, higher, 5000, 7)
  const t2 = permutationDiff(e.none.e2, e.news.e2, higher, 5000, 8)
  const favoured = lead.expect === 'noNewsHigher' ? none : news
  const passed = favoured.passed && t1.p <= 0.05 && t2.p <= 0.05
  const dirOk = lead.expect === 'noNewsHigher' ? t1.diff > 0 : t1.diff < 0
  const en = `${lead.id}: no news n=${none.nExam} excess ${sg(none.excess.x1)} (p=${f(none.p.x1)}), news n=${news.nExam} excess ${sg(news.excess.x1)} (p=${f(news.p.x1)}); no-news minus news ${sg(t1.diff)} at 1x, ${sg(t2.diff)} at 2x, one-sided permutation p=${f(t1.p)}/${f(t2.p)} (${dirOk ? 'predicted direction' : 'opposite to the prediction'}). ${passed ? 'PASS.' : 'No pass.'}`
  const vi = `${lead.id}: không tin n=${none.nExam} vượt trội ${sg(none.excess.x1)} (p=${f(none.p.x1)}), có tin n=${news.nExam} vượt trội ${sg(news.excess.x1)} (p=${f(news.p.x1)}); không tin trừ có tin ${sg(t1.diff)} ở 1x, ${sg(t2.diff)} ở 2x, p hoán vị một phía=${f(t1.p)}/${f(t2.p)} (${dirOk ? 'đúng chiều dự đoán' : 'ngược dự đoán'}). ${passed ? 'ĐẠT.' : 'Chưa đạt.'}`
  return { ...lead, none, news, diff: { x1: t1.diff, x2: t2.diff, p: { x1: t1.p, x2: t2.p }, pTwo: { x1: t1.pTwo, x2: t2.pTwo }, nNone: e.none.e1.length, nNews: e.news.e1.length }, passed, summary: { en, vi } }
}

/** Bucket output from a judge() result of replayIntraday. */
export function bucketFromJudge(r: Result): BucketOut {
  return {
    nBook: r.book.n,
    nExam: r.exam.n,
    winRate: r.exam.winRate,
    avg: { x1: r.exam.avgNew, x2: r.exam.avg2x },
    control: { x1: r.exam.avgNew - r.control.excessNew, x2: r.exam.avg2x - r.control.excess2x },
    excess: { x1: r.control.excessNew, x2: r.control.excess2x },
    p: { x1: r.control.pNew, x2: r.control.p2x },
    dsr: r.dsr,
    passed: r.pass,
  }
}

// ---- daily leads (N1, N3) ----

export interface DailyCtx {
  u: Series[]
  examFrom: string
  /** Per-symbol costs at 1x. */
  costs: (symbol: string) => Costs | null
  bucketAt: (sym: number, i: number) => Bucket | null
  draws?: number
}
export interface DailyCell {
  runs: Record<number, DailyTrade[]>
  control: ControlDraws
  ex: { e1: number[]; e2: number[] }
}
export interface DailyLeadPrep {
  lead: LeadInfo
  none: DailyCell
  news: DailyCell
}

/** Split a lead's signals by news bucket and run each side with its own matched random-entry control. `gateDay`
 *  (the VIX gate) restricts the control's random days the same way it restricted the signals. Signals the
 *  bucket function cannot classify (window before the news archive) are dropped. Hold has no stop or SMA exit. */
export function prepDailyLead(ctx: DailyCtx, lead: LeadInfo, sigs: DailySignal[], hold: number, gateDay?: (day: string) => boolean): DailyLeadPrep {
  const cell = (b: Bucket): DailyCell => {
    const sb = sigs.filter((s) => ctx.bucketAt(s.sym, s.i) === b)
    const runs: Record<number, DailyTrade[]> = {}
    for (const m of COST_MULTS) runs[m] = runDaily(ctx.u, sb, (sym) => scaleCosts(ctx.costs(sym), m))
    const ok = (sym: number, i: number) => ctx.bucketAt(sym, i) === b
    const control = controlDaily(ctx.u, sb, runs[1], ctx.examFrom, ctx.costs, ctx.draws ?? 200, 1, { allow: gateDay, allowAt: ok })
    const exp = expectedDaily(ctx.u, hold, ok, ctx.examFrom, ctx.costs, gateDay)
    return { runs, control, ex: dailyExcesses(ctx.u, ctx.examFrom, runs[1], runs[2], exp) }
  }
  return { lead, none: cell('none'), news: cell('news') }
}

const bucketFromDaily = (r: DailyResult): BucketOut => ({
  nBook: r.book.n,
  nExam: r.exam.n,
  winRate: r.exam.winRate,
  avg: { x1: r.examAvgByCost.x1, x2: r.examAvgByCost.x2 },
  control: { x1: r.control.examX1, x2: r.control.examX2 },
  excess: { x1: r.excess.examX1, x2: r.excess.examX2 },
  p: r.p,
  dsr: r.dsr,
  passed: r.passed,
})

/** Judge all daily cells together (one Deflated Sharpe variance over them) and compare the buckets of each lead. */
export function judgeDailyLeads(examFrom: string, preps: DailyLeadPrep[], trials = NEWS_ALL_TRIALS): LeadResult[] {
  const cells = preps.flatMap((p) => [{ id: `${p.lead.id}-none`, en: '', vi: '', c: p.none }, { id: `${p.lead.id}-news`, en: '', vi: '', c: p.news }])
  const ev = evalDaily(examFrom, cells, cells.map((x) => x.c.runs), cells.map((x) => x.c.control), trials)
  return preps.map((p, k) => assembleLead(p.lead, bucketFromDaily(ev[2 * k]), bucketFromDaily(ev[2 * k + 1]), { none: p.none.ex, news: p.news.ex }))
}

// ---- intraday lead (N2) ----

export interface IntradayCtx {
  syms: SymDays[]
  examFrom: string
  model: CostModel
  bucketAt: (sd: SymDays, di: number) => Bucket | null
}

export function judgeIntradayLeads(ctx: IntradayCtx, leads: { lead: LeadInfo; sigs: Sig[] }[], trials = NEWS_ALL_TRIALS): LeadResult[] {
  const parts = leads.flatMap(({ lead, sigs }) =>
    (['none', 'news'] as const).map((b) => {
      const sb = sigs.filter((s) => ctx.bucketAt(s.sd, s.di) === b)
      const allow = (sd: SymDays, di: number) => ctx.bucketAt(sd, di) === b
      return { lead, b, sb, allow, trades: run(sb) }
    }),
  )
  const res = judge(parts.map((p) => ({ id: `${p.lead.id}-${p.b}`, en: '', vi: '', examFrom: ctx.examFrom, syms: ctx.syms, sigs: p.sb, trades: p.trades, allow: p.allow })), ctx.model, trials)
  const ex = parts.map((p) => {
    const sample = p.sb[0]
    return sample ? intradayExcesses(p.trades, ctx.examFrom, ctx.model, expectedIntraday(ctx.syms, { rule: sample.rule, dir: sample.dir }, ctx.examFrom, ctx.model, p.allow)) : { e1: [], e2: [] }
  })
  return leads.map(({ lead }, k) => assembleLead(lead, bucketFromJudge(res[2 * k]), bucketFromJudge(res[2 * k + 1]), { none: ex[2 * k], news: ex[2 * k + 1] }))
}

// ---- keys ----

export const NO_KEYS_MSG = 'No Alpaca keys (ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY are not set): the news lab needs them to read historical news, so nothing was run and no result file was written. Add both as GitHub repo secrets and run the "Atlas news lab" workflow.'
export const hasAlpacaKeys = (env: Record<string, string | undefined>) => !!(env.ALPACA_API_KEY_ID && env.ALPACA_API_SECRET_KEY)
