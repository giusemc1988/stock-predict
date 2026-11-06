import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { addSetups, advance, adrPct, dayOf, ema, emptyState, findSetup, paperScore, type ClosedTrade } from '../src/lib/leadersPaper'

const DAY = 86_400
const T0 = Date.UTC(2026, 0, 5) / 1000
const bar = (i: number, o: number, h: number, l: number, c: number, v = 1000): Candle => ({ time: T0 + i * DAY, open: o, high: h, low: l, close: c, volume: v })

// ema and ADR basics
assert.deepEqual(ema([10, 10, 10], 5), [10, 10, 10])
assert.equal(Math.round(adrPct([bar(0, 100, 105, 100, 102)])), 5)

// a stock that trended up, then a quiet tight base with drying volume: 70 bars up, then 10 tight bars
function base(): Candle[] {
  const b: Candle[] = []
  for (let i = 0; i < 70; i++) {
    const c = 50 + i * 0.6
    b.push(bar(i, c - 0.3, c + 2.5, c - 2.5, c, 2000))
  }
  // tight base around 92-95: each bar ~4.5% range (ADR above 4%), higher lows, volume low
  const lows = [91, 91.2, 91.4, 91.6, 91.8, 92.5, 92.6, 92.7, 92.8, 92.9]
  lows.forEach((l, k) => b.push(bar(70 + k, l + 2, l + 4.8, l, l + 4, 800)))
  return b
}
const bars = base()
const su = findSetup(bars)
assert.ok(su, 'tight base is a setup')
assert.equal(su!.entry, Math.round(Math.max(...bars.slice(-10).map((b) => b.high)) * 100) / 100, 'entry is the highest high of the base')
const hi = Math.max(...bars.slice(-10).map((b) => b.high))
assert.equal(su!.stop, Math.round(Math.max(Math.min(...bars.slice(-5).map((b) => b.low)), hi * (1 - su!.adr / 100)) * 100) / 100, 'stop is the tighter of the 5-day low and 1 ADR')
assert.ok(((su!.entry - su!.stop) / su!.entry) * 100 <= su!.adr + 0.5, 'planned loss is about one ADR at most')
// each rule can reject it
assert.equal(findSetup(bars.slice(0, 40)), null, 'too little history')
const loud = bars.map((b, i) => (i >= 75 ? { ...b, volume: 9000 } : b))
assert.equal(findSetup(loud), null, 'volume not drying up')
const lowerLows = bars.map((b, i) => (i >= 75 ? { ...b, low: 90 } : b))
assert.equal(findSetup(lowerLows), null, 'lows are not rising')
const quiet = bars.map((b) => ({ ...b, high: b.close * 1.01, low: b.close * 0.995 }))
assert.equal(findSetup(quiet), null, 'ADR under 4%')

// state: first run starts at the newest bar and never replays history
const sym = { AAA: bars }
let st = advance(emptyState(), sym)
assert.equal(st.asOf, dayOf(bars[bars.length - 1].time))
assert.equal(st.open.length + st.closed.length + st.watching.length, 0)
st = addSetups(st, ['AAA'], sym)
assert.equal(st.watching.length, 1)
const w = st.watching[0]

// next day breaks out on big volume with a gap above the pivot: filled at the open
const d1 = bar(80, w.entry + 1, w.entry + 3, w.entry + 0.5, w.entry + 2.5, 5000)
let s2 = advance(st, { AAA: [...bars, d1] })
assert.equal(s2.open.length, 1)
assert.equal(s2.open[0].entry, Math.round((w.entry + 1) * 100) / 100, 'a gap fills at the open')
// then the stock falls through the stop with a gap: filled at the open, a loss
const d2 = bar(81, w.stop - 2, w.stop - 1, w.stop - 3, w.stop - 2, 4000)
s2 = advance(s2, { AAA: [...bars, d1, d2] })
assert.equal(s2.open.length, 0)
assert.equal(s2.closed.length, 1)
assert.equal(s2.closed[0].reason, 'stop')
assert.ok(s2.closed[0].retPct < -5 && s2.closed[0].r < -1, 'a gap through the stop loses more than planned')
assert.equal(s2.closed[0].exit, Math.round((w.stop - 2) * 100) / 100)

// a breakout on weak volume does not enter; five idle days expire the watch
let s3 = advance(st, { AAA: [...bars, bar(80, w.entry, w.entry + 2, w.entry - 0.1, w.entry + 1, 900)] })
assert.equal(s3.open.length, 0)
assert.equal(s3.watching.length, 1)
let more = [...bars, bar(80, w.entry, w.entry + 2, w.entry - 0.1, w.entry + 1, 900)]
for (let i = 81; i < 85; i++) {
  more = [...more, bar(i, w.entry, w.entry + 0.2, w.entry - 0.2, w.entry, 900)]
  s3 = advance(s3, { AAA: more })
}
assert.equal(s3.watching.length, 0, 'the watch expires after 5 days')

// a trade that trails out: enters, drifts up, then closes under the 20-day average
let s4 = advance(st, { AAA: [...bars, d1] })
let path = [...bars, d1]
for (let i = 81; i < 88; i++) {
  const c = w.entry + 2 + (i - 80) * 1.5
  path = [...path, bar(i, c - 0.5, c + 1, c - 1, c, 1500)]
  s4 = advance(s4, { AAA: path })
}
assert.equal(s4.open.length, 1, 'still holding while above the average')
path = [...path, bar(88, w.entry, w.entry + 1, w.entry - 1.5, w.entry - 0.5, 3000)]
s4 = advance(s4, { AAA: path })
if (s4.closed.length) assert.ok(['trail', 'stop'].includes(s4.closed[0].reason))

// no lookahead: running the same night twice changes nothing
assert.deepEqual(advance(s4, { AAA: path }), s4)

// scoreboard: testing under 20, working at 55%+ with a positive average, failing otherwise
const trade = (ret: number): ClosedTrade => ({ symbol: 'X', entryDay: '2026-01-01', exitDay: '2026-01-05', entry: 10, exit: 11, retPct: ret, r: ret / 5, days: 4, reason: 'trail' })
assert.equal(paperScore([trade(5)]).status, 'testing')
const good = [...Array(12).fill(0).map(() => trade(6)), ...Array(8).fill(0).map(() => trade(-3))]
assert.equal(paperScore(good).status, 'working')
assert.equal(paperScore(good).winRate, 60)
const bad = [...Array(7).fill(0).map(() => trade(2)), ...Array(13).fill(0).map(() => trade(-2))]
assert.equal(paperScore(bad).status, 'failing')
console.log('leaderspaper: ok')
