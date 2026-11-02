import assert from 'node:assert/strict'
import {
  ALL_ROUNDS_TRIALS, TRIAL_LEDGER, barOnOrBefore, clusterDays, dmyToIso, ensembleStream, eventReturns, eventStream, fomcEvents, hygSignal, insiderRows, mondayOf, olsBeta,
  opexIndex, opexWeeks, pairTrades, poolControl, shiftControl, shortRetPct, switchPass, switchStream, turnOfMonthEvents, vixTsSignal, type HalfPerf,
} from '../src/lib/replayEdges'
import type { Perf } from '../src/lib/replayRound2'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)

// trial ledger: the Deflated Sharpe counts every round, not only this one
assert.equal(ALL_ROUNDS_TRIALS, Object.values(TRIAL_LEDGER).reduce((a, b) => a + b, 0))
assert.ok(ALL_ROUNDS_TRIALS >= 398, 'counts the 340 filter rules of the 15m lab too')

// trading-day calendar for the tests: weekdays of Jan-Mar 2024
const days: string[] = []
for (let t = Date.UTC(2024, 0, 2); t < Date.UTC(2024, 3, 1); t += 86_400_000) {
  const d = new Date(t)
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10))
}

// FOMC: buy the close before, sell the announcement close; a date that is not a trading day is skipped, never moved
{
  const { events, skipped } = fomcEvents(days, ['2024-01-31', '2024-03-20', '2024-03-23'])
  assert.deepEqual(events.map((e) => [days[e.b], days[e.s]]), [['2024-01-30', '2024-01-31'], ['2024-03-19', '2024-03-20']])
  assert.deepEqual(skipped, ['2024-03-23'])
}

// turn of the month: 2nd-to-last trading day close to the 3rd trading day close of the next month
{
  const ev = turnOfMonthEvents(days)
  assert.deepEqual(ev.map((e) => [days[e.b], days[e.s]]), [['2024-01-30', '2024-02-05'], ['2024-02-28', '2024-03-05']])
}

// OPEX: third Friday; the week runs from the close of the Friday before to the expiration close
{
  assert.equal(days[opexIndex(days, 2024, 1)], '2024-01-19')
  assert.equal(mondayOf('2024-01-19'), '2024-01-15')
  const { opex, other } = opexWeeks(days)
  assert.deepEqual(opex.map((e) => [days[e.b], days[e.s]]), [['2024-01-12', '2024-01-19'], ['2024-02-09', '2024-02-16'], ['2024-03-08', '2024-03-15']])
  assert.ok(other.every((e) => !opex.some((o) => o.s === e.s)))
}

// event returns and streams agree (costs paid on the first and last day)
{
  const close = [100, 101, 103, 102]
  const ev = [{ b: 0, s: 2 }]
  near(eventReturns(close, ev, null)[0], 3)
  const st = eventStream(close, ev, 0)
  near((1 + st[1]) * (1 + st[2]) - 1, 0.03, 1e-3) // daily close-to-close sums, not compounding, so allow rounding
  assert.equal(st[3], 0)
}

// switch: a signal at close i is held from open i+1; the overnight gap before an exit belongs to the old position
{
  const open = [100, 100, 110, 121]
  const close = [100, 105, 115, 120]
  const sig = [1, 0, 0, 0]
  const r = switchStream(open, close, sig, 0)
  near(r[1], 105 / 100 - 1) // held from open 1 to close 1
  near(r[2], 110 / 105 - 1) // the gap to open 2, then out
  assert.equal(r[3], 0)
  assert.deepEqual(vixTsSignal([15, 30, NaN], [20, 25, 20]), [1, 0, 0])
  assert.deepEqual(hygSignal([1, 1.1, 1.0, 1.2], 1), [0, 1, 0, 1])
}

// random-timing control: a signal that is right every day beats its shifted copies
{
  const n = 1200
  const open: number[] = []
  const close: number[] = []
  const sig: number[] = []
  let p = 100
  for (let i = 0; i < n; i++) {
    const up = Math.sin(i / 7) > 0
    open.push(p)
    p *= up ? 1.01 : 0.99
    close.push(p)
    sig.push(Math.sin((i + 1) / 7) > 0 ? 1 : 0) // tomorrow's direction, so the switch has perfect timing
  }
  const years = close.map((_, i) => 2000 + Math.floor(i / 252))
  const c = shiftControl(open, close, sig, 0, 1, 800, years, 50, 3, 100)
  assert.ok(c.p < 0.1, `p ${c.p}`)
}

// switchPass needs a better Sharpe AND a shallower drawdown in exam (1x, 2x) and book, plus the timing control
{
  const pf = (sharpe: number, maxDD: number): Perf => ({ n: 1, cagr: 0, vol: 0, sharpe, maxDD, worstYear: 0 })
  const hp = (s: number, d: number): HalfPerf => ({ book: pf(s, d), exam: pf(s, d) })
  assert.equal(switchPass(hp(1, -20), hp(1.2, -10), hp(1.1, -10), 0.99, 0.01), true)
  assert.equal(switchPass(hp(1, -20), hp(1.2, -10), hp(1.1, -10), 0.99, 0.2), false, 'timing control')
  assert.equal(switchPass(hp(1, -20), hp(1.2, -25), hp(1.1, -10), 0.99, 0.01), false, 'drawdown')
}

// pairs: enter at the next open when |z| > 2, leave at the next open once |z| < 0.5
{
  const z = [0, 2.5, 1.5, 0.3, 0, -2.1, -1, -0.2, 0, 0]
  const t = pairTrades(z, { enter: 2, exit: 0.5, maxHold: 20 })
  assert.deepEqual(t.map((x) => [x.e, x.x, x.dir, x.exitClose]), [[2, 4, -1, false], [6, 8, 1, false]])
  near(olsBeta([1, 2, 3], [2, 4, 6]), 2)
  near(shortRetPct(100, 90, null), 10)
}

// random-entry pool control: draws the same count per half
{
  const c = poolControl([{ want: { book: 1, exam: 2 }, pool: { book: { r1: [1], r2: [1] }, exam: { r1: [2, 4], r2: [1, 3] } } }], 5)
  assert.deepEqual(c.exam1, [3, 3, 3, 3, 3])
  assert.deepEqual(c.book1, [1, 1, 1, 1, 1])
}

// insider data: Form 4 code P by officers/directors only, 2+ distinct owners within 30 days
{
  assert.equal(dmyToIso('05-MAR-2020'), '2020-03-05')
  const sub = 'ACCESSION_NUMBER\tFILING_DATE\tDOCUMENT_TYPE\tISSUERCIK\na\t05-MAR-2020\t4\t0000320193\nb\t20-MAR-2020\t4\t0000320193\nc\t21-MAR-2020\t4/A\t0000320193'
  const own = 'ACCESSION_NUMBER\tRPTOWNERCIK\tRPTOWNER_RELATIONSHIP\na\t001\tDirector\nb\t002\tOfficer\nc\t003\tDirector'
  const tr = 'ACCESSION_NUMBER\tTRANS_CODE\tTRANS_ACQUIRED_DISP_CD\tTRANS_PRICEPERSHARE\na\tP\tA\t10\nb\tP\tA\t11\nc\tP\tA\t12'
  const rows = insiderRows(sub, own, tr, new Set(['320193']))
  assert.deepEqual(rows.map((r) => [r.day, r.owner]), [['2020-03-05', '1'], ['2020-03-20', '2']])
  assert.deepEqual(clusterDays(rows, 2, 30), ['2020-03-20'])
  assert.equal(barOnOrBefore(['2020-03-19', '2020-03-23'], '2020-03-21'), 0)
}

// ensemble: weights reset each month to w / sum(w)
{
  const d = ['2024-01-30', '2024-01-31', '2024-02-01']
  const e = ensembleStream([{ id: 'a', rets: [0.01, 0.01, 0.01], start: 0 }, { id: 'b', rets: [0, 0, 0], start: 0 }], [1, 1], d)
  near(e.rets[0], 0.005)
  near(e.rets[2], 0.005)
}

console.log('replayedges ok')
