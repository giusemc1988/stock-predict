import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { buyHold, d1Reversal, d2High52, d3Rsi2, d4GapDrift, evalDaily, runDaily, scaleCosts, simulateDaily, type DailyTrade, type Series } from '../src/lib/replayDaily'

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

// evaluation: a strategy needs >= 100 exam trades, and buy-and-hold reports the exam window
{
  const trade = (k: number, r: number): DailyTrade => ({ symbol: 'X', openedAt: t0 + k * 86_400_000, retPct: r, exitReason: 'time', freeFrom: 0 })
  const few = Array.from({ length: 40 }, (_, k) => trade(k, 1 + (k % 2) * 0.1))
  const [res] = evalDaily('2020-01-20', [{ id: 'T', en: 't', vi: 't' }], [{ 0: few, 1: few, 2: few }])
  assert.equal(res.passed, false, 'too few trades')
  assert.ok(res.examAvgByCost.x1 > 0 && res.exam.n > 0 && Object.keys(res.byYear).length === 1)
  const bh = buyHold([bar(0, 100, 100, 100, 100), bar(1, 100, 100, 100, 100), bar(2, 100, 120, 100, 110)], '2020-01-03', null)!
  assert.equal(bh.retPct, 10)
}
console.log('replaydaily ok')
