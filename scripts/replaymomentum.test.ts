import assert from 'node:assert/strict'
import { ALL_ROUNDS_TRIALS, TRIAL_LEDGER } from '../src/lib/replayEdges'
import { MOMENTUM_TRIALS, eligibleAt, fillPx, mom121, momentumPlan, monthEndIdx, monthlyNet, randomControl, smaAt, topN, trendOn, weightRow } from '../src/lib/replayMomentum'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)

// the round's trials are in the ledger that every Deflated Sharpe counts
assert.equal(TRIAL_LEDGER.momentumRound5, MOMENTUM_TRIALS)
assert.equal(ALL_ROUNDS_TRIALS, Object.values(TRIAL_LEDGER).reduce((a, b) => a + b, 0))
assert.ok(ALL_ROUNDS_TRIALS >= 402)

// calendar: 30 months of weekdays from 2020-01
const days: string[] = []
for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2022, 6, 1); t += 86_400_000) {
  const d = new Date(t)
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10))
}
const ends = monthEndIdx(days)
assert.equal(ends.length, 29) // the last month has no next bar
assert.ok(ends.every((e) => days[e].slice(0, 7) !== days[e + 1].slice(0, 7)))

// three names: A rises 3%/month, B flat, C falls 1%/month; price grows geometrically per month-end bar
const mk = (g: number) => {
  const c = new Array<number>(days.length)
  let m = 0
  let px = 100
  days.forEach((d, i) => {
    if (i > 0 && d.slice(0, 7) !== days[i - 1].slice(0, 7)) px *= 1 + g
    c[i] = px
    m++
  })
  return c
}
const close = [mk(0.03), mk(0), mk(-0.01)]
const open = close.map((c) => [...c])

// 12-1 return skips the last month: month-end k-1 over month-end k-12
near(mom121(close[0], ends, 20), close[0][ends[19]] / close[0][ends[8]] - 1)
assert.ok(Number.isNaN(mom121(close[0], ends, 11)), 'needs 12 month-ends of history')
assert.deepEqual(topN(close, ends, 20, [0, 1, 2], 1), [0])
assert.deepEqual(topN(close, ends, 20, [0, 1, 2], 2), [0, 1])
assert.deepEqual(eligibleAt(close, open, ends, 20), [0, 1, 2])
const gap = close.map((c) => [...c])
gap[1][ends[8]] = NaN
assert.deepEqual(eligibleAt(gap, open, ends, 20), [0, 2], 'a name with a missing price is not tradable')

// weights and trend
assert.deepEqual(weightRow(3, [0, 2]), [0.5, 0, 0.5])
assert.deepEqual(weightRow(3, []), [0, 0, 0])
assert.ok(Number.isNaN(smaAt([1, 2, 3], 1, 3)))
assert.equal(trendOn([1, 1, 1, 1, 5], 4, 5), true)
assert.equal(trendOn([5, 5, 5, 5, 1], 4, 5), false)

// plan: top-1 of 3 names holds the riser; with trend off-state the row is cash
const spyUp = close[0]
const plan = momentumPlan(close, open, spyUp, ends, 1, false)
assert.equal(plan.w.length, ends.length - 12)
assert.ok(plan.w.every((r) => r[0] === 1))
const spyDown = close[0].map((_, i) => 1000 - i)
const planT = momentumPlan(close, open, spyDown, ends, 1, true)
assert.ok(planT.w.every((r) => r.every((x) => x === 0)) && planT.pool.every((p) => p === null), 'below the average: cash and no control draw')

// monthly returns: holding the riser earns ~3%/month; costs charge turnover only when the weights change
const px = fillPx(open, close, ends)
const free = monthlyNet(px, plan.w, [0, 0, 0])
assert.ok(free.slice(1, -1).every((r) => Math.abs(r - 0.03) < 1e-9), 'first full months earn the 3% of name A')
const paid = monthlyNet(px, plan.w, [0.001, 0.001, 0.001])
near(free[0] - paid[0], 0.001) // the first month pays one side on the full position
near(free[1] - paid[1], 0, 1e-9) // the next month keeps the same weights, so no turnover
// a name without a next price earns 0, not a made-up return
const hole = px.map((r) => [...r])
hole[0][3] = NaN
assert.equal(monthlyNet(hole, plan.w, [0, 0, 0])[2], 0)

// control: random picks from {A,B,C} average the three names' growth, so the riser beats it and p is small
const real = free.slice(8).reduce((a, b) => a + b, 0) / free.slice(8).length
const ctl = randomControl(px, plan, [0, 0, 0], real, 8, 50)
assert.ok(ctl.examMean < real, 'random picks are worse than always holding the riser')
assert.ok(ctl.p < 0.1)
console.log('replaymomentum tests passed')
