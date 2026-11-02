import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { ALL_ROUNDS_TRIALS, TRIAL_LEDGER } from '../src/lib/replayEdges'
import {
  BORROW_EASY, BORROW_HARD, SHORT_TRIALS, dropBars, newLowBars, shortFill, shortNet, spikeUpBars, tradeStream, weakMarketDays, worstN,
} from '../src/lib/replayShort'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)
const bar = (o: number, h: number, l: number, c: number, v = 100): Candle => ({ time: 0, open: o, high: h, low: l, close: c, volume: v })

// the round's trials are in the ledger that every Deflated Sharpe counts
assert.equal(TRIAL_LEDGER.shortRound6, SHORT_TRIALS)
assert.equal(ALL_ROUNDS_TRIALS, Object.values(TRIAL_LEDGER).reduce((a, b) => a + b, 0))
assert.ok(ALL_ROUNDS_TRIALS >= 406)

// short fills: entry at the open, stop above it, exit at the close of the last bar
const calm = [bar(100, 101, 99, 100), bar(100, 102, 98, 99), bar(99, 100, 97, 96)]
const a = shortFill(calm, 0, 'o', 2, 'c', 0.08)!
assert.equal(a.entry, 100)
assert.equal(a.exit, 96)
assert.equal(a.days, 3)
assert.equal(a.stopped, false)
// the stop is hit intraday: covered AT the stop, a loss of 8%
const spike = [bar(100, 101, 99, 100), bar(100, 112, 99, 111), bar(111, 112, 100, 101)]
const b = shortFill(spike, 0, 'o', 2, 'c', 0.08)!
assert.equal(b.exit, 108)
assert.equal(b.stopped, true)
assert.equal(b.xBar, 1)
// a gap through the stop is covered at the open, WORSE than the stop (the unlimited-loss risk)
const gap = [bar(100, 101, 99, 100), bar(120, 125, 119, 121)]
const g = shortFill(gap, 0, 'o', 1, 'c', 0.08)!
assert.equal(g.exit, 120)
assert.ok(g.exit > 108)
// the stop on the entry day itself counts
const day0 = [bar(100, 109, 99, 105), bar(105, 106, 100, 101)]
assert.equal(shortFill(day0, 0, 'o', 1, 'c', 0.08)!.exit, 108)
// overnight: short a close, cover the next open, no stop
const night = [bar(100, 101, 99, 100), bar(130, 131, 129, 130)]
const n = shortFill(night, 0, 'c', 1, 'o', null)!
assert.equal(n.entry, 100)
assert.equal(n.exit, 130)
assert.equal(n.days, 1)
// not enough bars: no trade
assert.equal(shortFill(calm, 0, 'o', 5, 'c', 0.08), null)

// returns: a short that falls 4% earns +4% before costs; borrow is paid for each day, doubled at 2x
near(shortNet({ entry: 100, exit: 96, days: 0 }, null, false, 1), 4)
near(shortNet({ entry: 100, exit: 96, days: 252 }, null, false, 1), 4 - BORROW_EASY * 100)
near(shortNet({ entry: 100, exit: 96, days: 252 }, null, true, 1), 4 - BORROW_HARD * 100)
near(shortNet({ entry: 100, exit: 96, days: 252 }, null, true, 2), 4 - 2 * BORROW_HARD * 100)
assert.ok(shortNet({ entry: 100, exit: 100, days: 5 }, { feeBps: 0, spreadBps: 2, slippageBps: 1 }, false, 1) < 0, 'costs make a flat trade a loss')
assert.ok(shortNet({ entry: 100, exit: 100, days: 5 }, { feeBps: 0, spreadBps: 2, slippageBps: 1 }, false, 2) < shortNet({ entry: 100, exit: 100, days: 5 }, { feeBps: 0, spreadBps: 2, slippageBps: 1 }, false, 1))

// signals
const base: Candle[] = Array.from({ length: 25 }, () => bar(100, 101, 99, 100, 100))
const up = [...base, bar(100, 110, 100, 108, 300)]
assert.deepEqual(spikeUpBars(up), [25], '+8% on 3x volume')
assert.deepEqual(spikeUpBars([...base, bar(100, 110, 100, 108, 150)]), [], 'volume too low')
assert.deepEqual(spikeUpBars([...base, bar(100, 105, 100, 105, 300)]), [], 'move too small')
const down = [...base, bar(100, 100, 94, 95, 300)]
assert.deepEqual(dropBars(down), [25])
assert.deepEqual(newLowBars([...base, bar(100, 100, 98, 99)]), [25], 'a close under the prior 20 closes')
assert.deepEqual(newLowBars([...base, bar(100, 101, 99, 100)]), [], 'equal is not a new low')

// weak-market days: SPY under its n-day average
const days = Array.from({ length: 8 }, (_, i) => `2020-01-0${i + 1}`)
const weak = weakMarketDays(days, [10, 10, 10, 10, 10, 9, 9, 12], 5)
assert.deepEqual([...weak], ['2020-01-06', '2020-01-07'])

// the worst 12-1 names
assert.deepEqual(worstN([0.3, -0.5, 0.1, -0.2], [0, 1, 2, 3], 2), [1, 3])

// stream: a 2-day trade spreads half its return on each day; a close entry starts the day after
const d5 = ['a', 'b', 'c', 'd', 'e']
const st = tradeStream(d5, 0, [{ entryDay: 'a', exitDay: 'b', eKind: 'o', retPct: 4 }])
near(st[0], 0.02)
near(st[1], 0.02)
assert.equal(st[2], 0)
const st2 = tradeStream(d5, 0, [{ entryDay: 'a', exitDay: 'b', eKind: 'c', retPct: 4 }])
assert.equal(st2[0], 0)
near(st2[1], 0.04)
// two trades open on the same day are averaged, not summed
const st3 = tradeStream(d5, 0, [{ entryDay: 'a', exitDay: 'a', eKind: 'o', retPct: 2 }, { entryDay: 'a', exitDay: 'a', eKind: 'o', retPct: 4 }])
near(st3[0], 0.03)
console.log('replayshort tests passed')
