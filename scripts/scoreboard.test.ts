import assert from 'node:assert/strict'
import { emptyPractice, type PracticePosition } from '../src/lib/practice'
import { makeBaseline, scoreboardFigures } from '../src/lib/scoreboard'
import type { Candle } from '../src/types'

const pos = (symbol: string, qty: number, entry: number): PracticePosition => ({ id: symbol, symbol, tf: '15m', qty, entry, stop: entry * 0.95, target: entry * 1.1, openedAt: 0, barTime: 0, bars: 0, info: {} as PracticePosition['info'] })
const bar = (time: number, close: number): Candle => ({ time, open: close, high: close, low: close, close, volume: 1 })

// a fresh account with open positions: P&L counts what is open, not only closed trades
const s = { ...emptyPractice(), realized: 50, open: [pos('AAA', 2, 100), pos('BBB', 10, 20), pos('CCC', 1, 50)], marks: { AAA: 110, BBB: 19 } }
const f = scoreboardFigures(s, (sym) => (sym === 'CCC' ? 55 : 0))
assert.equal(f.realized, 50)
assert.equal(f.unrealized, 2 * 10 + 10 * -1 + 1 * 5) // marks first, priceOf as fallback
assert.equal(f.total, 50 + 15)
assert.equal(f.openCount, 3)
assert.equal(f.unpriced, 0)
assert.ok(Math.abs(f.totalPct - 0.65) < 1e-9)
assert.equal(f.spyPct, null, 'no baseline, no comparison')
assert.equal(f.vsSpyPct, null)

// a position with no price anywhere is counted as unpriced, not as a $0 move
const g = scoreboardFigures({ ...emptyPractice(), open: [pos('ZZZ', 5, 10)] }, () => 0)
assert.equal(g.unrealized, 0)
assert.equal(g.unpriced, 1)

// SPY comparison since the account started
const h = scoreboardFigures({ ...s, baseline: { symbol: 'SPY', startPrice: 500, startAt: 1000, lastPrice: 502.5, lastAt: 2000 } }, () => 0)
assert.ok(Math.abs(h.spyPct! - 0.5) < 1e-9)
assert.equal(h.unpriced, 1, 'CCC has no price here')
assert.ok(Math.abs(h.vsSpyPct! - (0.6 - 0.5)) < 1e-9)
assert.equal(h.spyAt, 2000)

// the baseline starts at the first SPY bar at or after the account start, and keeps its start price afterwards
const bars = [bar(100, 500), bar(200, 505), bar(300, 510)]
const first = makeBaseline(undefined, bars, 150_000, 999)!
assert.deepEqual(first, { symbol: 'SPY', startPrice: 505, startAt: 200_000, lastPrice: 510, lastAt: 999 })
const later = makeBaseline(first, [...bars, bar(400, 520)], 150_000, 1500)!
assert.equal(later.startPrice, 505)
assert.equal(later.lastPrice, 520)
// account older than the bars we have: no honest start price, so no baseline
assert.equal(makeBaseline(undefined, bars, 50_000_000, 999), undefined)
assert.equal(makeBaseline(undefined, [], 150_000, 999), undefined)
// a failed fetch keeps the old baseline unchanged
assert.deepEqual(makeBaseline(first, [], 150_000, 2000), first)

console.log('scoreboard tests passed')
