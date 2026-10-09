import assert from 'node:assert/strict'
import { dayKey, emptyPractice, kindOf, lessons, onBarClose, onBars, onPrice, practiceEquity, practiceReport, sessionEnd, type EntryContext } from '../src/lib/practice.ts'
import type { Analysis } from '../src/types.ts'

const buy = { verdict: 'BUY', score: 0.6, headline: 'Trend up', tradeScore: { score: 70, grade: 'B', regime: 'normal' }, exitPlan: { entry: 100, stop: 95, target: 110 }, plan: null } as unknown as Analysis
const sell = { ...buy, verdict: 'SELL' } as Analysis
const ctx = (over: Partial<EntryContext> = {}): EntryContext => ({
  symbol: 'AAPL', tf: '1h', price: 100, barTime: 1000, analysis: buy, learner: 'HOLD', asset: 'stock', dayOn: true, dayTrades: 4, longOn: false, longTrades: 1, holdDays: 5, sizePct: 2, gatesOn: true, maxDrawdownPct: 10, maxTradesPerDay: 5, killSwitch: false, now: Date.UTC(2026, 9, 9, 15), ...over,
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

// market clock: 4:00 pm ET less 5 minutes (EDT in October = 20:00 UTC)
const t0 = Date.UTC(2026, 9, 9, 15)
assert.equal(sessionEnd('stock', t0), Date.UTC(2026, 9, 9, 19, 55))
assert.equal(sessionEnd('crypto', t0), Date.UTC(2026, 9, 10, 3, 55))
assert.equal(dayKey(Date.UTC(2026, 9, 10, 2)), '2026-10-09', '10 pm ET is still the 9th')
// a day trade is closed before market close even with no stop or target hit
const closed = onPrice(s, 'AAPL', 101, 1500, Date.UTC(2026, 9, 9, 19, 56))!
assert.equal(closed.trades[0].exitReason, 'close')
// no new day trade in the last 15 minutes
assert.equal(onBarClose(emptyPractice(), ctx({ now: Date.UTC(2026, 9, 9, 19, 45) })).open.length, 0)

// daily quotas: first BUY is the long-term trade, then up to N day trades, then nothing
const both = (over: Partial<EntryContext>) => ctx({ longOn: true, dayTrades: 3, ...over })
let q = emptyPractice()
const syms = ['AAPL', 'SPY', 'AMZN', 'NVDA', 'MSFT', 'TSLA']
syms.forEach((symbol, i) => (q = onBarClose(q, both({ symbol, barTime: 1000 + i, now: t0 + i * 60_000 }))))
assert.deepEqual(q.open.map((p) => kindOf(p)), ['long', 'day', 'day', 'day'])
const long = q.open[0]
assert.ok(Math.abs(long.stop - 90) < 1e-9 && Math.abs(long.target - 120) < 1e-9, 'long-term stop/target 2x wider')
assert.equal(long.closeBy, t0 + 5 * 86_400_000)
// long-term ignores SELL calls and bar limits, and is closed when the holding period ends
assert.equal(onBarClose(q, both({ analysis: sell, barTime: 3000 })).open.filter((p) => kindOf(p) === 'long').length, 1)
const held = onPrice(q, 'AAPL', 105, 9000, t0 + 5 * 86_400_000 + 1)!
assert.equal(held.trades.find((t) => kindOf(t) === 'long')!.exitReason, 'hold')
// the next day the quotas reset
const next = onBarClose(q, both({ symbol: 'META', now: t0 + 86_400_000 }))
assert.equal(kindOf(next.open[next.open.length - 1]), 'long')
// reports per kind
assert.equal(practiceReport(held, 'long').n, 1)
assert.equal(practiceReport(held, 'day').n, 0)
// server exits between runs: a bar's low reaching the stop closes at the stop price, not the bar close
const ob = onBars(s, 'AAPL', [{ time: 1000, open: 100, high: 100, low: 90, close: 90, volume: 1 }, { time: 1900, open: 100, high: 103, low: 99, close: 101, volume: 1 }], 5)
assert.equal(ob, null, 'the entry bar and bars that miss both levels change nothing')
const hit = onBars(s, 'AAPL', [{ time: 1900, open: 100, high: 111, low: 94, close: 105, volume: 1 }], 5)!
assert.equal(hit.trades[0].exitReason, 'stop', 'stop first when one bar reaches both')
assert.equal(hit.trades[0].exit, 95)
assert.equal(onBars(s, 'AAPL', [{ time: 1900, open: 100, high: 111, low: 99, close: 105, volume: 1 }], 5)!.trades[0].exit, 110)
// a server dayEnd closes crypto day trades with the stock market
assert.equal(onBarClose(emptyPractice(), ctx({ asset: 'crypto', dayEnd: Date.UTC(2026, 9, 9, 19, 55) })).open[0].closeBy, Date.UTC(2026, 9, 9, 19, 55))
console.log('practice tests passed')
