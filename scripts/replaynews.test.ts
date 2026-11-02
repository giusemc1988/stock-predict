import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { controlDaily, seededRng, type Series } from '../src/lib/replayDaily'
import { i3Winners, symbolCosts, type CostModel, type Day, type SymDays } from '../src/lib/replayIntraday'
import {
  NEWS_ALL_TRIALS, NO_KEYS_MSG, NewsIncomplete, afternoonWindow, alpacaNewsUrl, bucketOf, etEpoch, hasAlpacaKeys, hasNews, judgeDailyLeads, judgeIntradayLeads, loadSymbolNews, monthStart, monthsFrom,
  moverSignals, newsCoverageMonth, newsTimes, permutationDiff, prepDailyLead, sessionClose, trailingWindow, type LeadInfo, type NewsDeps, type NewsFetch,
} from '../src/lib/replayNews'

const bar = (time: number, o: number, h: number, l: number, c: number, v = 100): Candle => ({ time, open: o, high: h, low: l, close: c, volume: v })

// ---- time zones: 16:00 ET is 20:00Z in summer (EDT) and 21:00Z in winter (EST); 15:30 ET likewise ----
assert.equal(sessionClose('2026-07-06'), Date.UTC(2026, 6, 6, 20, 0) / 1000)
assert.equal(sessionClose('2026-01-06'), Date.UTC(2026, 0, 6, 21, 0) / 1000)
assert.equal(etEpoch('2026-07-06', 930), Date.UTC(2026, 6, 6, 19, 30) / 1000)
assert.equal(etEpoch('2026-03-09', 960), Date.UTC(2026, 2, 9, 20, 0) / 1000, 'the day after the spring-forward change is already EDT')
assert.equal(etEpoch('2026-03-06', 960), Date.UTC(2026, 2, 6, 21, 0) / 1000, 'the day before is still EST')

// ---- window boundaries ----
{
  const t = [100, 200, 300]
  assert.equal(hasNews(t, 100, 199), false, 'the start is exclusive')
  assert.equal(hasNews(t, 99, 100), true, 'the end is inclusive')
  assert.equal(hasNews(t, 200, 300), true)
  assert.equal(hasNews(t, 300, 400), false)
  assert.equal(hasNews(undefined, 0, 1e9), false)
  assert.equal(hasNews(t, 200, 150), false, 'an empty window')
}

// daily bars on consecutive weekdays (the ET date is what matters)
const mkDaily = (n: number, price = (k: number) => 100 + k * 0, start = Date.UTC(2020, 0, 6, 14, 30) / 1000): Candle[] =>
  Array.from({ length: n }, (_, k) => bar(start + k * 86_400, price(k), price(k) + 1, price(k) - 1, price(k)))
{
  const bars = mkDaily(10)
  const w = trailingWindow(bars, 7, 5)!
  assert.equal(w[0], sessionClose('2020-01-08'), 'starts at the close 5 trading days before the signal day (bar 2)')
  assert.equal(w[1], sessionClose('2020-01-13'), 'ends at the signal day close (bar 7)')
  assert.equal(trailingWindow(bars, 4, 5), null, 'not enough history')
  const cov = 0
  // news one second after the signal close is the future: ignored (no look-ahead)
  assert.equal(bucketOf([w[1] + 1], w, cov), 'none')
  assert.equal(bucketOf([w[1]], w, cov), 'news')
  assert.equal(bucketOf([w[0]], w, cov), 'none', 'news exactly at the starting close belongs to the earlier window')
  assert.equal(bucketOf([w[0] + 1], w, cov), 'news')
  // before the trusted archive start: no verdict
  assert.equal(bucketOf([], w, w[0] + 1), null)
  assert.equal(bucketOf([], null, cov), null)
}

// N2 window: after the previous close, up to the bar that starts at 15:30 ET (summer and winter)
{
  const mk = (key: string, startUtc: number): Day => ({ key, bars: Array.from({ length: 7 }, (_, k) => bar(startUtc + k * 3600, 1, 1, 1, 1)), min: Array.from({ length: 7 }, (_, k) => 570 + k * 60) })
  for (const [d0, d1, h] of [['2026-07-06', '2026-07-07', 13], ['2026-01-06', '2026-01-07', 14]] as const) {
    const sd: SymDays = { symbol: 'X', days: [mk(d0, Date.UTC(+d0.slice(0, 4), +d0.slice(5, 7) - 1, +d0.slice(8), h, 30) / 1000), mk(d1, Date.UTC(+d1.slice(0, 4), +d1.slice(5, 7) - 1, +d1.slice(8), h, 30) / 1000)] }
    const w = afternoonWindow(sd, 1)!
    assert.equal(w[0], sessionClose(d0))
    assert.equal(w[1], etEpoch(d1, 930), 'the decision time is 15:30 ET')
    assert.equal(bucketOf([w[1] + 1], w, 0), 'none', 'a headline after 15:30 is not seen')
    assert.equal(bucketOf([w[1]], w, 0), 'news')
    assert.equal(afternoonWindow(sd, 0), null)
  }
}

// ---- coverage ----
{
  const at = (m: string, d = 10) => Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, d) / 1000
  const idx = new Map([['A', [at('2017-03'), at('2018-01'), at('2018-02')]], ['B', [at('2018-01'), at('2018-02')]], ['C', [at('2018-02')]], ['D', [at('2018-02')]], ['E', [at('2018-02')]]])
  assert.equal(newsCoverageMonth(idx, ['A', 'B', 'C', 'D', 'E']), '2018-02', 'one early stray item is not an archive')
  assert.equal(newsCoverageMonth(new Map(), ['A']), null)
  assert.equal(monthStart('2018-02'), Date.UTC(2018, 1, 1) / 1000)
  assert.deepEqual(monthsFrom('2025-11', Date.UTC(2026, 1, 15)), ['2025-11', '2025-12', '2026-01', '2026-02'])
}

// ---- Alpaca news: URL, pagination, retry, errors, cache (fake fetch, no network, no real keys) ----
{
  const u = new URL(alpacaNewsUrl('AAPL', '2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.000Z'))
  assert.equal(u.origin + u.pathname, 'https://data.alpaca.markets/v1beta1/news')
  assert.equal(u.searchParams.get('symbols'), 'AAPL')
  assert.equal(u.searchParams.get('limit'), '50')
  assert.equal(u.searchParams.get('sort'), 'asc')
  assert.equal(u.searchParams.get('include_content'), 'false')
  assert.equal(u.searchParams.get('page_token'), null)
  assert.equal(new URL(alpacaNewsUrl('AAPL', 'a', 'b', 'tok')).searchParams.get('page_token'), 'tok')

  const seen: { url: string; headers: Record<string, string> }[] = []
  const pages: Record<string, unknown> = {
    none: { news: [{ created_at: '2024-01-05T15:00:00Z', headline: 'ignored' }, { created_at: '2024-01-02T15:00:00Z' }], next_page_token: 'p2' },
    p2: { news: [{ created_at: '2024-01-09T15:00:00Z' }, { created_at: 'garbage' }], next_page_token: null },
  }
  let fail429 = 1
  const fake: NewsFetch = async (url, init) => {
    seen.push({ url, headers: init.headers })
    if (fail429-- > 0) return { ok: false, status: 429, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => pages[new URL(url).searchParams.get('page_token') ?? 'none'] }
  }
  const waits: number[] = []
  const deps: NewsDeps = { keyId: 'ID', secret: 'SECRET', fetchFn: fake, pause: async (ms) => void waits.push(ms) }
  const t = await newsTimes('AAPL', 's', 'e', deps)
  assert.deepEqual(t, [Date.UTC(2024, 0, 2, 15) / 1000, Date.UTC(2024, 0, 5, 15) / 1000, Date.UTC(2024, 0, 9, 15) / 1000], 'sorted, bad stamps dropped, both pages read')
  assert.equal(seen.length, 3, 'one 429 retried, then two pages')
  assert.deepEqual(waits, [2000], 'backoff after the 429')
  assert.equal(seen[0].headers['APCA-API-KEY-ID'], 'ID')
  assert.equal(seen[0].headers['APCA-API-SECRET-KEY'], 'SECRET')
  assert.ok(!seen.some((s) => s.url.includes('SECRET') || s.url.includes('ID=')), 'keys travel only in headers')
  await assert.rejects(newsTimes('AAPL', 's', 'e', { ...deps, fetchFn: async () => ({ ok: false, status: 403, json: async () => ({}) }) }), /Alpaca news 403 for AAPL/)
  await assert.rejects(newsTimes('AAPL', 's', 'e', { ...deps, stop: () => true }), NewsIncomplete)

  // cache: completed months are stored and reused, the current month is not stored
  const store = new Map<string, number[]>()
  let calls = 0
  const counting: NewsFetch = async (url) => {
    calls++
    const start = new URL(url).searchParams.get('start')!
    return { ok: true, status: 200, json: async () => ({ news: [{ created_at: start }], next_page_token: null }) }
  }
  const cdeps: NewsDeps = { ...deps, fetchFn: counting, now: () => Date.UTC(2026, 2, 15), cache: { get: (s, m) => store.get(`${s}|${m}`) ?? null, set: (s, m, x) => void store.set(`${s}|${m}`, x) } }
  const a = await loadSymbolNews('AAPL', '2026-01', cdeps)
  assert.equal(calls, 3)
  assert.deepEqual([...store.keys()].sort(), ['AAPL|2026-01', 'AAPL|2026-02'], 'March is still running: not cached')
  assert.equal(a.length, 3)
  const b = await loadSymbolNews('AAPL', '2026-01', cdeps)
  assert.equal(calls, 4, 'second load re-fetches only the running month')
  assert.deepEqual(b, a)
}

// ---- permutation test ----
{
  const hi = Array.from({ length: 60 }, (_, k) => 1 + (k % 5) * 0.1)
  const lo = Array.from({ length: 60 }, (_, k) => 0 + (k % 5) * 0.1)
  const sep = permutationDiff(hi, lo, 'a', 1000)
  assert.ok(Math.abs(sep.diff - 1) < 1e-9 && sep.p < 0.01 && sep.pTwo < 0.01)
  assert.ok(permutationDiff(hi, lo, 'b', 1000).p > 0.99, 'the opposite prediction is rejected')
  assert.ok(permutationDiff(lo, lo.slice().reverse(), 'a', 1000).p > 0.3, 'identical groups: no difference')
  assert.deepEqual(permutationDiff([], [1], 'a'), { diff: 0, p: 1, pTwo: 1 })
}

// ---- keys ----
assert.equal(hasAlpacaKeys({}), false)
assert.equal(hasAlpacaKeys({ ALPACA_API_KEY_ID: 'x' }), false)
assert.equal(hasAlpacaKeys({ ALPACA_API_KEY_ID: 'x', ALPACA_API_SECRET_KEY: '' }), false)
assert.equal(hasAlpacaKeys({ ALPACA_API_KEY_ID: 'x', ALPACA_API_SECRET_KEY: 'y' }), true)
assert.match(NO_KEYS_MSG, /No Alpaca keys/)
assert.ok(!NO_KEYS_MSG.includes('undefined'))

// ---- movers: no look-ahead, direction ----
function lead(id: string, expect: LeadInfo['expect']): LeadInfo {
  return { id, en: id, vi: id, expect }
}
{
  const rnd = seededRng(5)
  let p = 100
  const series = (n: number): Candle[] => {
    const out: Candle[] = []
    for (let k = 0; k < n; k++) {
      const o = p
      p *= 1 + (rnd() - 0.48) * 0.1 // some 4%+ days both ways
      out.push(bar(Date.UTC(2020, 0, 6, 14, 30) / 1000 + k * 86_400, o, Math.max(o, p) * 1.005, Math.min(o, p) * 0.995, p))
    }
    return out
  }
  const u: Series[] = ['A', 'B', 'C'].map((symbol) => ({ symbol, bars: series(500) }))
  const up = moverSignals(u, 'up')
  const down = moverSignals(u, 'down')
  assert.ok(up.length > 20 && down.length > 20)
  assert.ok(up.every((s) => u[s.sym].bars[s.i].close / u[s.sym].bars[s.i - 1].close >= 1.04))
  assert.ok(down.every((s) => u[s.sym].bars[s.i].close / u[s.sym].bars[s.i - 1].close <= 0.96))
  // changing a FUTURE bar never changes the signal on an earlier day
  const alt = u.map((s) => ({ ...s, bars: s.bars.map((b, k) => (k > 300 ? { ...b, close: b.close * 1.5 } : b)) }))
  assert.deepEqual(moverSignals(alt, 'up').filter((s) => s.i < 300), up.filter((s) => s.i < 300))

  // bucket split: odd bars have "news". Each cell holds only its own bucket, entry and control both.
  const bucketAt = (_s: number, i: number) => (i % 2 ? ('news' as const) : ('none' as const))
  const examFrom = '2020-12-01'
  const ctx = { u, examFrom, costs: () => symbolCosts(1e9), bucketAt, draws: 20 }
  const prep = prepDailyLead(ctx, lead('T-up', 'newsHigher'), up, 5)
  for (const t of prep.news.runs[1]) assert.equal(bucketAt(0, t.entryBar! - 1), 'news')
  for (const t of prep.none.runs[1]) assert.equal(bucketAt(0, t.entryBar! - 1), 'none')
  assert.equal(prep.none.runs[0].length, prep.none.runs[2].length, 'the cost levels trade the same signals')
  assert.ok(prep.none.runs[2][0].retPct < prep.none.runs[1][0].retPct && prep.none.runs[1][0].retPct < prep.none.runs[0][0].retPct, '2x costs < 1x < 0x on the same trade')
  assert.equal(prep.none.ex.e1.length, prep.none.ex.e2.length, "one excess per exam trade at each cost level")
  assert.ok(prep.none.ex.e1.length > 0 && prep.news.ex.e1.length > 0)
  // the matched control only draws days of the bucket
  const c = controlDaily(u, up.filter((s) => s.i % 2), prep.news.runs[1], examFrom, ctx.costs, 5, 1, { allowAt: (_s, i) => bucketAt(0, i) === 'news' })
  assert.equal(c.exam1.length, 5)
  const [r] = judgeDailyLeads(examFrom, [prep])
  assert.equal(r.id, 'T-up')
  assert.equal(r.news.nExam + r.none.nExam, prep.news.runs[1].length + prep.none.runs[1].length - r.news.nBook - r.none.nBook)
  assert.ok([r.none.excess.x1, r.news.excess.x1, r.diff.x1, r.diff.p.x1].every(Number.isFinite))
  assert.equal(r.passed, false, 'tiny synthetic sample can never pass')
  assert.match(r.summary.en, /T-up/)
  assert.match(r.summary.vi, /T-up/)
  assert.ok(NEWS_ALL_TRIALS > 28)
  // a signal whose window is unknown (null bucket) is dropped
  const none = prepDailyLead({ ...ctx, bucketAt: () => null }, lead('T0', 'newsHigher'), up, 5)
  assert.equal(none.news.runs[1].length + none.none.runs[1].length, 0)
}

// ---- N2 pipeline on a synthetic overnight winner ----
{
  const mkDay = (key: string, rows: [number, number, number, number, number][]): Day => ({
    key,
    bars: rows.map((b, k) => bar(Date.parse(`${key}T14:30:00Z`) / 1000 + k * 3600, b[0], b[1], b[2], b[3], b[4])),
    min: rows.map((_, k) => 570 + k * 60),
  })
  const flat = (n: number, v: number): [number, number, number, number, number][] => Array.from({ length: n }, () => [100, 100, 100, 100, v])
  const hot: [number, number, number, number, number][] = [[100, 101, 100, 101, 30], [101, 102, 101, 102, 30], [102, 103, 102, 103, 30], [103, 104, 103, 104, 30], [104, 105, 104, 104, 30], [104, 104.5, 103.9, 104, 30], [104, 105, 103.5, 105, 10]]
  const days: Day[] = []
  for (let k = 1; k <= 15; k++) days.push(mkDay(`2026-07-${String(k).padStart(2, '0')}`, flat(7, 10)))
  days.push(mkDay('2026-07-16', hot), mkDay('2026-07-17', [[106, 107, 106, 107, 10], ...flat(6, 10)]))
  const sd: SymDays = { symbol: 'W', days }
  const model: CostModel = { sym: new Map([['W', symbolCosts(1e9)]]), old: null }
  const sigs = i3Winners([sd], 930, 'nextOpen', false)
  assert.equal(sigs.length, 1)
  const run = (bucket: 'news' | 'none') =>
    judgeIntradayLeads({ syms: [sd], examFrom: '2026-07-01', model, bucketAt: (_sd, di) => (di === 15 ? bucket : 'none') }, [{ lead: lead('T-n2', 'newsHigher'), sigs }])[0]
  assert.equal(run('news').news.nExam, 1)
  assert.equal(run('news').none.nExam, 0, 'the winner day is in the news bucket only')
  assert.equal(run('none').none.nExam, 1)
  assert.equal(run('none').news.nExam, 0)
  assert.equal(run('none').passed, false)
  assert.ok(Number.isFinite(run('news').diff.x1))
}

console.log('replaynews ok')
