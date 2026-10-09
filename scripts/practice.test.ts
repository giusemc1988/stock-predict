import assert from 'node:assert/strict'
import { emptyPractice, lessons, onBarClose, onPrice, practiceEquity, practiceReport, type EntryContext } from '../src/lib/practice.ts'
import type { Analysis } from '../src/types.ts'

const buy = { verdict: 'BUY', score: 0.6, headline: 'Trend up', tradeScore: { score: 70, grade: 'B', regime: 'normal' }, exitPlan: { entry: 100, stop: 95, target: 110 }, plan: null } as unknown as Analysis
const sell = { ...buy, verdict: 'SELL' } as Analysis
const ctx = (over: Partial<EntryContext> = {}): EntryContext => ({
  symbol: 'AAPL', tf: '1h', price: 100, barTime: 1000, analysis: buy, learner: 'HOLD', sizePct: 2, gatesOn: true, maxDrawdownPct: 10, maxTradesPerDay: 5, killSwitch: false, now: Date.UTC(2026, 9, 9, 15), ...over,
})

// enters small on an AI BUY with the plan's stop and target
let s = onBarClose(emptyPractice(), ctx())
assert.equal(s.open.length, 1)
assert.ok(Math.abs(s.open[0].qty * 100 - 200) < 1e-9, '2% of $10,000')
assert.equal(s.events[0].kind, 'buy')
// no second entry on the same market while one is open
assert.equal(onBarClose(s, ctx({ barTime: 2000 })).open.length, 1)
// target hit on a live price
assert.equal(onPrice(s, 'AAPL', 105, 1000, 0), null)
const won = onPrice(s, 'AAPL', 110, 1100, 1)!
assert.equal(won.trades[0].exitReason, 'target')
assert.ok(won.trades[0].pnl > 0 && practiceEquity(won) > 10_000)
// stop hit
const lost = onPrice(s, 'AAPL', 94, 1100, 1)!
assert.equal(lost.trades[0].exitReason, 'stop')
assert.ok(lost.trades[0].pnl < 0)
// SELL call closes it
assert.equal(onBarClose(s, ctx({ analysis: sell, barTime: 2000 })).trades[0].exitReason, 'signal')
// the kill switch skips instead of buying
const k = onBarClose(emptyPractice(), ctx({ killSwitch: true }))
assert.equal(k.open.length, 0)
assert.equal(k.events[0].kind, 'skip')
// no valid stop: skip
assert.equal(onBarClose(emptyPractice(), ctx({ analysis: { ...buy, exitPlan: { entry: 100, stop: 101, target: 110 } } as Analysis })).open.length, 0)
// report and honest lesson
const r = practiceReport(won)
assert.equal(r.n, 1)
assert.equal(r.winRate, 1)
assert.match(lessons(won)[0].en, /mostly luck/)
console.log('practice tests passed')
