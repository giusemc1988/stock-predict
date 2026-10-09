import assert from 'node:assert/strict'
import { baseRate, closeTrade, decide, recordSignal, scorecard, type JournalEntry } from '../src/lib/journal.ts'

const mk = (i: number, score: number, win: boolean): JournalEntry => ({
  id: `t${i}`, symbol: 'AAPL', signal: 'BUY', score, openedAt: i, entryPrice: 100, exitAt: i + 1, exitPrice: win ? 110 : 90,
})

const few = Array.from({ length: 10 }, (_, i) => mk(i, 0.9, true))
assert.equal(decide(few, 0.9).signal, 'HOLD', 'no decision below the minimum sample')

const many = [...Array.from({ length: 40 }, (_, i) => mk(i, 0.9, i % 4 !== 0)), ...Array.from({ length: 10 }, (_, i) => mk(100 + i, 0.1, false))]
const sc = scorecard(many)
assert.equal(sc.closed, 50)
assert.equal(sc.enoughData, true)
assert.ok(Math.abs(sc.hitRate! - 30 / 50) < 1e-9)
assert.equal(decide(many, 0.92).signal, 'BUY')

// base-rate check: when every bucket wins about as often as always buying, the learner holds
const flat = Array.from({ length: 60 }, (_, i) => mk(i, i % 2 ? 0.9 : 0.1, i % 10 < 7))
assert.equal(decide(flat, 0.92).signal, 'HOLD', 'no BUY when a bucket only matches the base rate')
assert.match(decide(flat, 0.92).reason, /always buying/)
assert.equal(decide(many, 0.12).signal, 'HOLD')

let j: JournalEntry[] = recordSignal([], { id: 'x', symbol: 'MSFT', signal: 'SELL', score: 0.2, openedAt: 1, entryPrice: 100 })
j = closeTrade(j, 'x', 90, 2)
assert.equal(scorecard(j).bySignal.SELL.hitRate, 1)
assert.equal(closeTrade(j, 'x', 1, 3)[0].exitPrice, 90, 'a closed trade is not overwritten')
assert.equal(baseRate(few), null)
console.log('journal tests passed')
