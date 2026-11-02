import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { alpacaBars, alpacaUrl, control, etMinutes, fillEntry, halfSpreadBps, i2Signals, i3Winners, judge, medianDollarVolume, orbCandidates, orbTrade, pickInPlay, retPct, run, sessionDays, simulate, symbolCosts, type CostModel, type Day, type SymDays } from '../src/lib/replayIntraday'

const bar = (time: number, o: number, h: number, l: number, c: number, v = 100): Candle => ({ time, open: o, high: h, low: l, close: c, volume: v })
// ET -> epoch seconds for a summer (EDT, UTC-4) and a winter (EST, UTC-5) date
const edt = (d: number, hh: number, mm: number) => Date.UTC(2026, 6, d, hh + 4, mm) / 1000
const est = (d: number, hh: number, mm: number) => Date.UTC(2026, 0, d, hh + 5, mm) / 1000

// session filtering handles DST: 09:30 ET is 13:30Z in summer and 14:30Z in winter
assert.equal(etMinutes(edt(6, 9, 30)), 570)
assert.equal(etMinutes(est(6, 9, 30)), 570)
{
  const mk = (t: (h: number, m: number) => number) => {
    const out: Candle[] = [bar(t(8, 0), 1, 1, 1, 1), bar(t(9, 25), 1, 1, 1, 1)] // pre-market
    for (let m = 570; m < 960; m += 5) out.push(bar(t(Math.floor(m / 60), m % 60), 1, 1, 1, 1))
    out.push(bar(t(16, 0), 1, 1, 1, 1), bar(t(17, 0), 1, 1, 1, 1)) // after hours
    return out
  }
  for (const t of [(h: number, m: number) => edt(6, h, m), (h: number, m: number) => est(6, h, m)]) {
    const d = sessionDays(mk(t), 955)
    assert.equal(d.length, 1)
    assert.equal(d[0].bars.length, 78)
    assert.equal(d[0].min[0], 570)
  }
  // a half day (closes 13:00) and a day missing its open are dropped
  const half = Array.from({ length: 42 }, (_, k) => bar(edt(7, 9, 30) + k * 300, 1, 1, 1, 1))
  assert.equal(sessionDays(half, 955).length, 0)
}

// per-symbol cost tiers and the return formula
assert.deepEqual([6e9, 3e9, 5e8, 1e7].map(halfSpreadBps), [0.5, 1.5, 4, 10])
{
  const c = symbolCosts(3e9)
  assert.equal(c.spreadBps, 3)
  assert.equal(c.feeBps, 0)
  const flat = retPct({ dir: 1, entry: 100, exit: 100, limitEntry: false }, c)
  assert.ok(Math.abs(flat + ((1.5 + 1) * 2) / 100) < 1e-3, 'round trip = 2 x (half-spread + slippage)')
  const lim = retPct({ dir: 1, entry: 100, exit: 100, limitEntry: true }, c)
  assert.ok(lim > flat && Math.abs(lim + 0.025) < 1e-6, 'a limit entry skips the entry spread and slippage')
  assert.ok(retPct({ dir: -1, entry: 100, exit: 99, limitEntry: false }, null) > 0.99, 'a short profits when price falls')
  assert.ok(retPct({ dir: -1, entry: 100, exit: 99, limitEntry: false }, c) < retPct({ dir: -1, entry: 100, exit: 99, limitEntry: false }, null))
  assert.equal(medianDollarVolume([{ key: 'a', bars: [bar(1, 1, 1, 1, 10, 5)], min: [570] }, { key: 'b', bars: [bar(1, 1, 1, 1, 10, 9)], min: [570] }]), 90)
}

// limit fill rule: needs a LATER bar to trade strictly through the limit
{
  const bars = [bar(0, 100, 100, 100, 100), bar(1, 101, 102, 100, 101), bar(2, 101, 101, 99.5, 100), bar(3, 100, 100, 100, 100)]
  assert.deepEqual(fillEntry(bars, 0, 1, false), { i: 1, price: 101 })
  assert.equal(fillEntry(bars, 0, 1, true)?.i, 2, 'bar 1 low equals the limit: not through it')
  assert.equal(fillEntry(bars, 0, 1, true)?.price, 100)
  assert.equal(fillEntry(bars, 2, 1, true), null, 'never comes back: missed')
  assert.equal(fillEntry(bars, 0, -1, true)?.i, 1, 'a limit sell fills when the high trades above it')
  const gap = [bar(0, 100, 100, 100, 100), bar(1, 98, 99, 97, 98)]
  assert.equal(fillEntry(gap, 0, 1, true)?.price, 98, 'a gap below the limit fills at the open')
}

// session builders
const mkDay = (key: string, start: number, bars: [number, number, number, number, number?][], step = 5): Day => ({
  key,
  bars: bars.map((b, k) => bar(Date.parse(`${key}T13:30:00Z`) / 1000 + start + k * step * 60, b[0], b[1], b[2], b[3], b[4] ?? 100)),
  min: bars.map((_, k) => 570 + k * step),
})
const flat = (n: number, p = 100): [number, number, number, number][] => Array.from({ length: n }, () => [p, p, p, p])
const dkey = (k: number) => `2026-07-${String(k).padStart(2, '0')}`
const mkSym = (symbol: string, days: Day[]): SymDays => ({ symbol, days })

// I1: opening-range breakout, no look-ahead, stop and gap rules
{
  const days: Day[] = []
  for (let k = 1; k <= 16; k++) days.push(mkDay(dkey(k), 0, [[100, 100.5, 99.5, 100, 100], ...flat(77)]))
  const first: [number, number, number, number, number][] = [[100, 101, 99.9, 100.8, 300]] // up bar, 3x volume, range 99.9-101
  const body: [number, number, number, number][] = [...flat(3, 100.5), [100.6, 101.5, 100.6, 101.2], [101.2, 103, 101.1, 102.5], ...flat(72, 103)]
  days.push(mkDay(dkey(17), 0, [...first, ...body]))
  const sd = mkSym('X', days)
  const cands = orbCandidates([sd])
  const today = cands.find((c) => c.di === 16)!
  assert.ok(today.rel >= 2.9 && today.dir === 1)
  assert.equal(pickInPlay(cands, 'A').filter((c) => c.di === 16).length, 1)
  assert.equal(pickInPlay(cands, 'A').filter((c) => c.di < 16).length, 0, 'ordinary days (1x volume, flat bar) are not in play')
  const t = orbTrade(today, 'bar')!
  assert.equal(t.entry, 101, 'enters at the first bar high on the break')
  assert.equal(t.exit, 103, 'out at the close')
  assert.equal(t.openedAt, days[16].bars[4].time * 1000, 'entry is stamped on the breaking bar, never on the opening bar')
  // gap above the level fills at the open; a stop on the entry bar is assumed hit
  const gapDay = mkDay(dkey(17), 0, [...first, [102, 103, 99.5, 100, 100], ...flat(76, 100)])
  const g = orbTrade({ ...today, sd: mkSym('X', [...days.slice(0, 16), gapDay]) }, 'bar')!
  assert.equal(g.entry, 102)
  assert.equal(g.exit, 99.9, 'stop at the other side of the first bar')
  // shorts mirror it
  const down = mkDay(dkey(17), 0, [[100, 100.1, 99, 99.2, 300], [99.2, 99.3, 98.5, 98.6, 100], ...flat(76, 98.6)])
  const s = orbTrade({ ...today, dir: -1, sd: mkSym('X', [...days.slice(0, 16), down]) }, 'bar')!
  assert.equal(s.dir, -1)
  assert.equal(s.entry, 99)
  assert.equal(s.exit, 98.6)
  assert.ok(retPct(s, null) > 0)
  // a day that never breaks the first bar gives no trade
  assert.equal(orbTrade({ ...today, sd: mkSym('X', [...days.slice(0, 16), mkDay(dkey(17), 0, [...first, ...flat(77, 100.5)])]) }, 'bar'), null)
  // the signal day's own volume never enters its baseline (no look-ahead): shrinking today's volume lowers rel only
  const calm = [...days.slice(0, 16), mkDay(dkey(17), 0, [[100, 101, 99.9, 100.8, 100], ...flat(77)])]
  assert.ok(orbCandidates([mkSym('X', calm)]).find((c) => c.di === 16)!.rel < 1.01)
}

// I2: sign logic, trade window, no look-ahead
{
  const days: Day[] = []
  const mk = (k: number, prevClose: number, tenOclock: number, lastHalfHour: number) => {
    const bars: [number, number, number, number][] = flat(78, tenOclock)
    for (let i = 72; i < 78; i++) bars[i] = [tenOclock, tenOclock + 1, tenOclock - 1, lastHalfHour] // 15:30-16:00
    bars[0] = [prevClose, prevClose, prevClose, prevClose]
    return mkDay(dkey(k), 0, bars)
  }
  days.push(mk(1, 100, 100, 100))
  days.push(mk(2, 100, 101, 102)) // up from yesterday's close at 10:00 -> long the last half hour
  days.push(mk(3, 102, 101, 100)) // down -> short
  const sd = mkSym('SPY', days)
  const sigs = i2Signals([sd], 600, 930, false)
  assert.deepEqual(sigs.map((s) => s.dir), [1, -1])
  assert.deepEqual(sigs.map((s) => s.t), [71, 71], 'signal bar is the one before 15:30')
  assert.equal(sigs[0].rule.hold, 6)
  const tr = run(sigs)
  assert.equal(tr[0].entry, 101, 'fills at the 15:30 open')
  assert.equal(tr[0].exit, 102)
  assert.ok(retPct(tr[0], null) > 0 && retPct(tr[1], null) > 0, 'long on an up morning and short on a down one both gain here')
  // changing the afternoon never changes the signal (it only uses data before the cut)
  const alt = mkSym('SPY', [days[0], mk(2, 100, 101, 90), days[2]])
  assert.equal(i2Signals([alt], 600, 930, false)[0].dir, 1)
  assert.equal(i2Signals([sd], 600, 930, true)[0].rule.limit, true)
}

// I3 winners proxy: signal at 15:30 on up 3%+ with 2x volume so far; control keeps the exit rule
{
  const days: Day[] = []
  for (let k = 1; k <= 16; k++) days.push(mkDay(dkey(k), 0, [...flat(7)].map((b) => [...b, 10] as [number, number, number, number, number]), 60))
  const hot: [number, number, number, number, number][] = [[100, 101, 100, 101, 30], [101, 102, 101, 102, 30], [102, 103, 102, 103, 30], [103, 104, 103, 104, 30], [104, 105, 104, 104, 30], [104, 104.5, 103.9, 104, 30], [104, 105, 103.5, 105, 10]]
  days.push(mkDay(dkey(17), 0, hot, 60), mkDay(dkey(18), 0, [[106, 107, 106, 107, 10], ...flat(6, 107)], 60))
  const sd = mkSym('W', days)
  const night = i3Winners([sd], 930, 'nextOpen', false)
  assert.equal(night.length, 1)
  assert.equal(night[0].t, 5)
  const tn = run(night)[0]
  assert.equal(tn.entry, 104, '15:30 open after the 14:30 bar closes')
  assert.equal(tn.exit, 106, 'held to the next open')
  assert.equal(run(i3Winners([sd], 930, 'close', false))[0].exit, 105)
  const lim = i3Winners([sd], 930, 'close', true)
  assert.equal(run(lim).length, 1, 'the last bar low (103.5) trades through the 104 limit')
  assert.equal(run(lim)[0].entry, 104)
  assert.equal(simulate(sd, 17, 6, 1, { hold: 'nextOpen' }), null, 'no next session in the data: no exit, no trade')
  // control: same count, same rules, finite result; and the whole judge pipeline runs
  const model: CostModel = { sym: new Map([['W', symbolCosts(1e9)]]), old: { feeBps: 1, spreadBps: 4, slippageBps: 2 } }
  const trades = run(night)
  const c = control([sd], trades, dkey(1), model, 20)
  assert.equal(c.mNew.length, 20)
  assert.ok(c.mNew.every(Number.isFinite))
  const [r] = judge([{ id: 'T', en: '', vi: '', examFrom: dkey(1), syms: [sd], sigs: night, trades }], model)
  assert.equal(r.exam.n, 1)
  assert.equal(r.pass, false, 'a single trade can never pass (n >= 100)')
  assert.equal(r.fillRate, null)
}

// Alpaca: URL building and pagination with a fake fetch (no network, no real keys)
{
  const u = new URL(alpacaUrl('AAPL', '2018-01-01'))
  assert.equal(u.origin + u.pathname, 'https://data.alpaca.markets/v2/stocks/bars')
  assert.equal(u.searchParams.get('symbols'), 'AAPL')
  assert.equal(u.searchParams.get('timeframe'), '5Min')
  assert.equal(u.searchParams.get('feed'), 'iex')
  assert.equal(u.searchParams.get('limit'), '10000')
  assert.equal(u.searchParams.get('page_token'), null)
  assert.equal(new URL(alpacaUrl('AAPL', '2018-01-01', 'tok')).searchParams.get('page_token'), 'tok')
  const seen: { url: string; headers: Record<string, string> }[] = []
  const pages: Record<string, unknown> = {
    none: { bars: { AAPL: [{ t: '2026-07-06T13:30:00Z', o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }] }, next_page_token: 'p2' },
    p2: { bars: { AAPL: [{ t: '2026-07-06T13:35:00Z', o: 1.5, h: 2, l: 1, c: 1.8, v: 20 }] }, next_page_token: null },
  }
  const fake = async (url: string, init: { headers: Record<string, string> }) => {
    seen.push({ url, headers: init.headers })
    return { ok: true, status: 200, json: async () => pages[new URL(url).searchParams.get('page_token') ?? 'none'] }
  }
  const bars = await alpacaBars('AAPL', '2018-01-01', 'ID', 'SECRET', fake)
  assert.equal(seen.length, 2)
  assert.equal(bars.length, 2)
  assert.equal(bars[0].time, Date.UTC(2026, 6, 6, 13, 30) / 1000)
  assert.equal(seen[0].headers['APCA-API-KEY-ID'], 'ID')
  assert.ok(!seen.some((s) => s.url.includes('SECRET') || s.url.includes('ID=')), 'keys travel only in headers')
  await assert.rejects(alpacaBars('AAPL', '2018-01-01', 'ID', 'SECRET', async () => ({ ok: false, status: 403, json: async () => ({}) })), /Alpaca 403/)
}
console.log('replayintraday ok')
