import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { dayKey } from '../src/lib/practice'
import { addBar, boundaryPx, gateSignals, legStream, monthEnds, perf, portfolioMonthly, realizedVol, spyLeg, tsmomOn, tsmomWeights, unitTrade, vixDays, vixGate, volScale } from '../src/lib/replayRound2'
import { buyHold, controlDaily, d1Reversal, d2High52, d3Rsi2, d4GapDrift, evalDaily, runDaily, scaleCosts, simulateDaily, type DailyTrade, type Series } from '../src/lib/replayDaily'

const t0 = Date.UTC(2020, 0, 2, 15)
const bar = (k: number, o: number, h: number, l: number, c: number, v = 100): Candle => ({ time: t0 / 1000 + k * 86_400, open: o, high: h, low: l, close: c, volume: v })
const flat = (k: number, p = 100) => bar(k, p, p + 0.5, p - 0.5, p)
const costs = { feeBps: 1, spreadBps: 4, slippageBps: 2 }
const plan = { i: 0, hold: 3, stopDist: null, targetDist: null }

// entry is the NEXT day's open, never the signal day's close; a time exit fills at the close
{
  const bars = [bar(0, 100, 101, 99, 100), bar(1, 110, 112, 109, 111), bar(2, 111, 113, 110, 112)]
  const t = simulateDaily(bars, { ...plan, hold: 2 }, null)!
  assert.equal(t.exitReason, 'time')
  assert.ok(Math.abs(t.retPct - (112 / 110 - 1) * 100) < 1e-9, 'bought at day 1 open (110), sold at day 2 close')
  assert.equal(t.openedAt, bars[1].time * 1000)
  assert.equal(simulateDaily(bars, { ...plan, i: 2 }, null), null, 'no next bar, no trade')
}

// stop and target touched on the same day: the stop hits first
{
  const bars = [flat(0), bar(1, 100, 100, 100, 100), bar(2, 100, 106, 94, 100)]
  const t = simulateDaily(bars, { ...plan, stopDist: 5, targetDist: 5 }, null)!
  assert.deepEqual([t.exitReason, t.retPct], ['stop', -5])
  const hit = simulateDaily([flat(0), bar(1, 100, 100, 100, 100), bar(2, 100, 106, 98, 100)], { ...plan, stopDist: 5, targetDist: 5 }, null)!
  assert.deepEqual([hit.exitReason, hit.retPct], ['target', 5])
}

// a gap through the stop fills at the open, not at the stop
{
  const bars = [flat(0), bar(1, 100, 100, 100, 100), bar(2, 90, 92, 88, 91)]
  const t = simulateDaily(bars, { ...plan, stopDist: 5 }, null)!
  assert.deepEqual([t.exitReason, t.retPct], ['stop', -10])
}

// costs: a flat round trip loses about 0.1%, twice that at 2x, nothing at 0x
{
  const bars = [flat(0), bar(1, 100, 100, 100, 100), bar(2, 100, 100, 100, 100)]
  const p = { ...plan, hold: 2 }
  const r1 = simulateDaily(bars, p, costs)!.retPct
  assert.ok(r1 < -0.09 && r1 > -0.11, 'round trip costs about 0.1%')
  assert.ok(Math.abs(simulateDaily(bars, p, scaleCosts(costs, 2))!.retPct / r1 - 2) < 0.01)
  assert.equal(simulateDaily(bars, p, scaleCosts(costs, 0))!.retPct, 0)
}

// rule exit: close above the 5-day SMA leaves at the NEXT open; no overlapping trades per symbol
{
  const bars = [bar(0, 100, 100, 100, 100), bar(1, 100, 100, 100, 100), bar(2, 100, 100, 100, 100), bar(3, 100, 100, 100, 100), bar(4, 100, 100, 100, 100), bar(5, 100, 106, 100, 105), bar(6, 107, 108, 106, 107), flat(7)]
  const t = simulateDaily(bars, { i: 3, hold: 10, stopDist: null, targetDist: null, sma5Exit: true }, null)!
  assert.equal(t.exitReason, 'rule')
  assert.ok(Math.abs(t.retPct - 7) < 1e-9, 'entry 100 at day 4 open, close 105 > SMA5 at day 5, out at day 6 open 107')
  const u: Series[] = [{ symbol: 'X', bars }]
  const sig = (i: number) => ({ sym: 0, i, hold: 10, stopDist: null, targetDist: null, sma5Exit: true })
  assert.equal(runDaily(u, [sig(3), sig(4), sig(5)], null).length, 2, 'the signal on day 4 is skipped while the first trade is open')
}

// D1: the worst 5-day return in the universe is bought, once
{
  const u: Series[] = Array.from({ length: 10 }, (_, s) => ({ symbol: `S${s}`, bars: Array.from({ length: 6 }, (_, k) => flat(k, s === 3 && k === 5 ? 90 : 100)) }))
  const sigs = d1Reversal(u)
  assert.deepEqual(sigs.map((s) => [s.sym, s.i, s.hold]), [[3, 5, 5]])
}

// D2: near the 252-day high above the 200-day average; nothing before 252 bars exist
{
  const up = Array.from({ length: 300 }, (_, k) => bar(k, 100 + k * 0.1, 100 + k * 0.1 + 0.3, 100 + k * 0.1 - 0.3, 100 + k * 0.1))
  const sigs = d2High52([{ symbol: 'U', bars: up }])
  assert.equal(sigs.length, 48)
  assert.equal(sigs[0].i, 252)
  assert.ok(sigs[0].stopDist! > 0 && sigs[0].hold === 10)
  const down = Array.from({ length: 300 }, (_, k) => flat(k, 200 - k * 0.3))
  assert.equal(d2High52([{ symbol: 'D', bars: down }]).length, 0)
}

// D3: a sharp two-day dip inside a long uptrend
{
  const closes = [...Array.from({ length: 210 }, (_, k) => 100 + k), 300, 290]
  const bars = closes.map((c, k) => bar(k, c, c + 0.5, c - 0.5, c))
  const sigs = d3Rsi2([{ symbol: 'P', bars }])
  assert.ok(sigs.some((s) => s.i === 211 && s.sma5Exit && s.hold === 10))
  assert.ok(sigs.every((s) => s.i >= 210), 'no signal while the trend only rises')
}

// D4: gap up 4%+ on 2x volume; the same gap on normal volume is ignored
{
  const mk = (vol: number) => Array.from({ length: 30 }, (_, k) => (k === 25 ? bar(k, 105, 107, 104, 106, vol) : k > 25 ? flat(k, 106) : flat(k)))
  const sigs = d4GapDrift([{ symbol: 'G', bars: mk(300) }])
  assert.deepEqual(sigs.map((s) => [s.i, s.hold]), [[25, 20]])
  assert.equal(d4GapDrift([{ symbol: 'G', bars: mk(150) }]).length, 0)
}

// random-entry control: same trade count and exit rule, reproducible with the seed
{
  const bars = Array.from({ length: 300 }, (_, k) => {
    const p = 100 * 1.01 ** k
    return bar(k, p, p, p, p)
  })
  const u: Series[] = [{ symbol: 'C', bars }]
  const sigs = Array.from({ length: 10 }, (_, k) => ({ sym: 0, i: 50 + k * 10, hold: 3, stopDist: null, targetDist: null }))
  const actual = runDaily(u, sigs, null)
  assert.equal(actual.length, 10)
  const a = controlDaily(u, sigs, actual, '2020-04-01', null, 5, 7)
  assert.deepEqual(a.count, [10, 10, 10, 10, 10], 'same number of trades in every draw')
  for (const x of [...a.book1, ...a.exam1]) assert.ok(x === 0 || Math.abs(x - (1.01 ** 2 - 1) * 100) < 1e-9, 'same exit rule: bought at the open, sold at the close 2 days later')
  assert.ok(a.exam1.some((x) => x > 0) && a.book1.some((x) => x > 0))
  assert.deepEqual(controlDaily(u, sigs, actual, '2020-04-01', null, 5, 7), a, 'seeded: same draws every time')
}

// evaluation:a strategy needs >= 100 exam trades, and buy-and-hold reports the exam window
{
  const trade = (k: number, r: number): DailyTrade => ({ symbol: 'X', openedAt: t0 + k * 86_400_000, retPct: r, exitReason: 'time', freeFrom: 0 })
  const few = Array.from({ length: 40 }, (_, k) => trade(k, 1 + (k % 2) * 0.1))
  const zero = { book1: [0, 0], exam1: [0, 0], exam2: [0, 0], count: [0, 0] }
  const [res] = evalDaily('2020-01-20', [{ id: 'T', en: 't', vi: 't' }], [{ 0: few, 1: few, 2: few }], [zero])
  assert.equal(res.passed, false, 'too few trades')
  assert.equal(res.p.x1, 0, 'no control draw reaches the strategy')
  assert.ok(res.excess.examX1 === res.examAvgByCost.x1, 'excess = strategy - control')
  // a strategy that only matches its control has no edge, whatever its raw return
  const many = Array.from({ length: 300 }, (_, k) => trade(k, 1 + (k % 2) * 0.1))
  const raw = evalDaily('2020-01-20', [{ id: 'T', en: 't', vi: 't' }], [{ 0: many, 1: many, 2: many }], [zero])[0]
  assert.ok(raw.exam.n >= 100 && raw.excess.examX1 > 0)
  const same = { book1: [1, 1], exam1: [raw.examAvgByCost.x1, 0], exam2: [raw.examAvgByCost.x2, 0], count: [1, 1] }
  assert.equal(evalDaily('2020-01-20', [{ id: 'T', en: 't', vi: 't' }], [{ 0: many, 1: many, 2: many }], [same])[0].p.x1, 0.5, 'half the draws match the strategy')
  assert.equal(evalDaily('2020-01-20', [{ id: 'T', en: 't', vi: 't' }], [{ 0: many, 1: many, 2: many }], [same])[0].passed, false, 'p = 0.5 is not an edge')
  assert.ok(res.examAvgByCost.x1 > 0 && res.exam.n > 0 && Object.keys(res.byYear).length === 1)
  const bh = buyHold([bar(0, 100, 100, 100, 100), bar(1, 100, 100, 100, 100), bar(2, 100, 120, 100, 110)], '2020-01-03', null)!
  assert.equal(bh.retPct, 10)
}
// ---- round 2 ----

// E1 VIX gate: a day's flag uses that day and earlier only (changing a later close changes nothing before it)
{
  const mk = (last: number) => Array.from({ length: 300 }, (_, k) => bar(k, 20, 20, 20, k === 299 ? last : 10 + (k % 30)))
  const a = vixDays(mk(15))
  const b = vixDays(mk(90))
  const days = [...a.keys()].sort()
  for (let k = 0; k < 299; k++) assert.deepEqual(a.get(days[k]), b.get(days[k]), 'a future close never moves an earlier day')
  assert.equal(Number.isNaN(a.get(days[250])!.med), true, 'no median before 252 closes')
  assert.equal(a.get(days[299])!.med, 25, 'median of the last 252 closes, today included')
  assert.equal(vixGate(a, 'A')(days[299]), false, 'close 15 is under the median 25')
  assert.equal(vixGate(b, 'A')(days[299]), true, 'close 90 is over it')
  assert.equal(vixGate(b, 'B')(days[299]), true, 'close 90 >= 25')
  assert.equal(vixGate(a, 'B')(days[299]), false, 'close 15 < 25')
  assert.equal(vixGate(a, 'A')('1999-01-01'), false, 'a missing day is closed')
  const u: Series[] = [{ symbol: 'G', bars: Array.from({ length: 4 }, (_, k) => flat(k)) }]
  const sig = (i: number) => ({ sym: 0, i, hold: 1, stopDist: null, targetDist: null })
  const keep = dayKey(u[0].bars[1].time * 1000)
  assert.deepEqual(gateSignals(u, [sig(0), sig(1), sig(2)], (d) => d === keep).map((x) => x.i), [1])
}

// E2 neutral math: trade minus a short SPY hedge from the same entry open to the same exit close, the hedge paying costs too
{
  const spy = [bar(0, 100, 100, 100, 100), bar(1, 100, 101, 99, 100), bar(2, 100, 101, 99, 105), bar(3, 105, 111, 105, 110)]
  const stock = [flat(0), bar(1, 50, 50, 50, 50), bar(2, 50, 50, 50, 50), bar(3, 50, 60, 50, 60)]
  const t = simulateDaily(stock, { ...plan, hold: 3 }, null)!
  assert.equal(t.exitAt, stock[3].time * 1000)
  assert.equal(t.exitBar, 3)
  const leg = spyLeg(spy)
  assert.ok(Math.abs(leg(t, null) - 10) < 1e-9, 'SPY open day 1 (100) to close day 3 (110) = 10%')
  assert.ok(Math.abs(t.retPct - leg(t, null) - 10) < 1e-9, 'stock +20% minus SPY +10% = +10% excess')
  const c = leg(t, costs)
  assert.ok(c > 10.05 && c < 10.2, 'the hedge pays the round trip costs too, so the leg is bigger')
  assert.equal(leg({ ...t, exitAt: 0 }, null), 0, 'a date SPY lacks gives no leg')
  const u: Series[] = [{ symbol: 'C', bars: Array.from({ length: 300 }, (_, k) => bar(k, 100 * 1.01 ** k, 100 * 1.01 ** k, 100 * 1.01 ** k, 100 * 1.01 ** k)) }]
  const sigs = Array.from({ length: 10 }, (_, k) => ({ sym: 0, i: 50 + k * 10, hold: 3, stopDist: null, targetDist: null }))
  const actual = runDaily(u, sigs, null)
  const none = controlDaily(u, sigs, actual, '2020-04-01', null, 3, 7, { allow: () => false })
  assert.deepEqual(none.count, [0, 0, 0], 'a gate that is always closed leaves no days to draw')
  const raw = controlDaily(u, sigs, actual, '2020-04-01', null, 3, 7)
  const adj = controlDaily(u, sigs, actual, '2020-04-01', null, 3, 7, { adj: () => 1 })
  assert.ok(Math.abs(raw.exam1[0] - adj.exam1[0] - 1) < 1e-9 && Math.abs(raw.book1[0] - adj.book1[0] - 1) < 1e-9, 'the control subtracts the same leg')
}

// E3 TSMOM signal: 12-1 month, the last month is skipped; weights and rebalance costs
{
  const ends = Array.from({ length: 20 }, (_, k) => k)
  const rising = Array.from({ length: 20 }, (_, k) => 100 + k)
  assert.equal(tsmomOn(rising, ends, 13), true)
  assert.equal(tsmomOn(rising.map((x, k) => (k === 13 ? 1 : x)), ends, 13), true, 'a crash in the skipped month does not turn the signal off')
  assert.equal(tsmomOn(rising.map((x, k) => (k === 12 ? 90 : x)), ends, 13), false, 'month-end k-1 below month-end k-12 turns it off')
  assert.equal(tsmomOn(rising, ends, 11), false, 'needs 12 months of history')
  assert.deepEqual(monthEnds(['2020-01-30', '2020-01-31', '2020-02-03', '2020-02-28', '2020-03-02']), [1, 3])
  const up = Array.from({ length: 20 }, (_, k) => 100 + k)
  const dn = Array.from({ length: 20 }, (_, k) => 200 - k)
  const gone = Array.from({ length: 20 }, (_, k) => (k < 10 ? NaN : 100 + k))
  assert.deepEqual(tsmomWeights([up, dn, gone], ends, 'eq')[0], [0.5, 0, 0], 'equal weight over the 2 ETFs that existed; the falling one is cash')
  const jitter = Array.from({ length: 20 }, (_, k) => 100 + k + (k % 2) * 3)
  const iv = tsmomWeights([up, jitter, dn], ends, 'ivol', 5)[0]
  assert.ok(iv[0] > iv[1] && iv[1] > 0 && iv[2] === 0 && iv[0] + iv[1] < 1, 'inverse vol: calmer ETF weighs more, the falling one is cash')
  const r = portfolioMonthly([[100, 110, 121]], [[1], [1]], 0.001)
  assert.ok(Math.abs(r[0] - 0.099) < 1e-12 && Math.abs(r[1] - 0.1) < 1e-12, 'costs only on the first buy; no turnover after')
  const px = boundaryPx([Array.from({ length: 16 }, (_, k) => k)], [Array.from({ length: 16 }, (_, k) => 100 + k)], Array.from({ length: 14 }, (_, k) => k))
  assert.deepEqual(px[0], [13, 14, 115], 'fills at the open after each month-end signal, last column the final close')
  const pf = perf([0.1, -0.5, 0.1], [2020, 2020, 2021], 12)
  assert.ok(Math.abs(pf.maxDD + 50) < 1e-9 && Math.abs(pf.worstYear + 45) < 1e-9)
}

// E4 sizing: trailing vol uses closes up to today only; the multiplier is capped at 2x
{
  const c = Array.from({ length: 40 }, (_, k) => 100 + Math.sin(k) * 3)
  const a = realizedVol(c)
  const b = realizedVol(c.map((x, k) => (k === 39 ? 500 : x)))
  for (let k = 0; k < 39; k++) assert.equal(Number.isNaN(a[k]) ? -1 : a[k], Number.isNaN(b[k]) ? -1 : b[k])
  assert.ok(Number.isNaN(a[19]) && Number.isFinite(a[20]))
  assert.equal(volScale(0.05, 0.2), 2, 'cap 2x')
  assert.equal(volScale(0.4, 0.2), 0.5)
  assert.equal(volScale(NaN, 0.2), 1)
  const bars = [bar(0, 100, 100, 100, 100), bar(1, 100, 102, 100, 102), bar(2, 102, 104, 102, 104.04)]
  const path = legStream(bars, 1, 100, 2, 104.04, 0.0404 - 0.0002)
  assert.equal(path.length, 2)
  assert.ok(Math.abs((1 + path[0][1]) * (1 + path[1][1]) - 1 - 0.0402) < 1e-12, 'daily returns compound to the net trade return')
}

// E5 unit accounting: pyramid adds one unit at the next open after a close 1 ATR up, down after 1 ATR down
{
  const bars = [flat(0), bar(1, 100, 104, 100, 103), bar(2, 104, 106, 104, 105), bar(3, 105, 107, 105, 106)]
  const t = simulateDaily(bars, { ...plan, hold: 3 }, null)!
  assert.equal(addBar(bars, t, 2, 'pyramid'), 2, 'close 103 is 3 above the 100 entry: buy at the day-2 open')
  assert.equal(addBar(bars, t, 2, 'down'), -1, 'never 1 ATR down')
  const u = unitTrade(bars, t, 2, null)
  assert.ok(Math.abs(u.r1 - 6) < 1e-9 && Math.abs(u.r2 - (106 / 104 - 1) * 100) < 1e-9 && u.cap === 2 && Math.abs(u.pnl - u.r1 - u.r2) < 1e-12)
  assert.deepEqual([unitTrade(bars, t, -1, null).cap, unitTrade(bars, t, -1, null).r2], [1, 0])
  const dip = [flat(0), bar(1, 100, 100, 96, 97), bar(2, 97, 98, 96, 97), bar(3, 97, 99, 97, 98)]
  const d = simulateDaily(dip, { ...plan, hold: 3 }, null)!
  assert.equal(addBar(dip, d, 2, 'down'), 2, 'average down after a close 3 under the entry')
  assert.equal(addBar(dip, d, 2, 'pyramid'), -1)
  const rb = [bar(0, 100, 100, 100, 100), bar(1, 100, 100, 100, 100), bar(2, 100, 100, 100, 100), bar(3, 100, 100, 100, 100), bar(4, 100, 100, 100, 100), bar(5, 100, 106, 100, 105), bar(6, 107, 108, 106, 107), flat(7)]
  const rule = simulateDaily(rb, { i: 3, hold: 10, stopDist: null, targetDist: null, sma5Exit: true }, null)!
  assert.equal(rule.exitBar, 6)
  assert.equal(addBar(rb, rule, 0, 'pyramid'), 5, 'the add comes at least one bar before a rule exit that fills at an open')
  assert.equal(addBar(rb, rule, 5, 'pyramid'), -1, 'the +5 close on day 5 is too late: the add would land on the exit open')
}
console.log('replaydaily ok')
