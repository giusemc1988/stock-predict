import assert from 'node:assert/strict'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { costsFrom } from '../src/lib/costs'
import { addSetupDay, bySession, emptySetup, gapNames, openingDrive, redToGreen, type Bar15, type DailyBar } from '../src/lib/shadowSetups'
import { emptyLeads, leadsReport, parseLeads } from '../src/lib/shadowLeads'

const costs = costsFrom(DEFAULT_AI_RULES)
const TODAY = '2026-11-27'
// EST (UTC-5): 9:30 ET = 14:30 UTC; 26 bars of 15 minutes
const sec = (day: string, k: number) => Date.parse(`${day}T14:30:00Z`) / 1000 + k * 900
const prevDays = Array.from({ length: 25 }, (_, i) => new Date(Date.UTC(2026, 10, 2 + i)).toISOString().slice(0, 10)).filter((d) => d < TODAY)
type Spec = { o: number; h: number; l: number; c: number; v?: number }
const flat = (day: string, p: number): Bar15[] => Array.from({ length: 26 }, (_, k) => [sec(day, k), p, p * 1.001, p * 0.999, p, 1000] as Bar15)
const hist = prevDays.flatMap((d) => flat(d, 100))
const today = (spec: Spec[]): Bar15[] => spec.map((s, k) => [sec(TODAY, k), s.o, s.h, s.l, s.c, s.v ?? 3000] as Bar15)
const fill = (n: number, p: number, v = 3000): Spec[] => Array.from({ length: n }, () => ({ o: p, h: p * 1.001, l: p * 0.999, c: p, v }))

// sessions: regular hours only, grouped by New York day
{
  const pre: Bar15 = [Date.parse(`${TODAY}T13:00:00Z`) / 1000, 1, 1, 1, 1, 1] // 8:00 ET
  const ss = bySession([pre, ...today(fill(26, 100))])
  assert.equal(ss.length, 1)
  assert.equal(ss[0].bars.length, 26, 'pre-market bar dropped')
  assert.equal(ss[0].mins[0], 570)
}

// gap names: >= 3% over the previous close and price >= $3
{
  const bars: Record<string, DailyBar[]> = {
    UP: [['2026-11-26', 100, 100, 1], [TODAY, 104, 105, 1]],
    SMALL: [['2026-11-26', 100, 100, 1], [TODAY, 102, 105, 1]],
    PENNY: [['2026-11-26', 2, 2, 1], [TODAY, 3, 3, 1]],
    STALE: [['2026-11-25', 100, 100, 1], ['2026-11-26', 105, 105, 1]],
  }
  assert.deepEqual(gapNames(bars, TODAY).map((x) => x.sym), ['UP'])
}

// L5 red to green: gap 5%, dips 1.5% under the open, then a bar closes back over it
const open = 105
const rtg: Spec[] = [
  { o: open, h: open * 1.002, l: open * 0.995, c: open * 0.997, v: 5000 }, // 9:30
  { o: open * 0.997, h: open * 0.998, l: open * 0.985, c: open * 0.99, v: 4000 }, // 9:45 dips 1.5%
  { o: open * 0.99, h: open * 0.995, l: open * 0.988, c: open * 0.992, v: 3000 }, // 10:00 still under
  { o: open * 0.992, h: open * 1.01, l: open * 0.99, c: open * 1.006, v: 3000 }, // 10:15 closes back above the open: signal
  { o: open * 1.006, h: open * 1.03, l: open * 1.004, c: open * 1.025, v: 3000 }, // 10:30 entry bar
  ...fill(21, open * 1.03),
]
{
  const t = redToGreen('TEST', TODAY, [...hist, ...today(rtg)], 100, costs)
  assert.ok(t, 'signal found')
  assert.equal(t!.entry, +(open * 1.006).toFixed(4), 'buys at the open of the bar after the signal')
  assert.equal(t!.stop, +(open * 0.985 * 0.998).toFixed(4), 'stop under the low of the day x 0.998')
  assert.equal(t!.why, 'close')
  assert.ok(t!.retPct > 2, 'rides to the close')
  assert.ok(t!.gap > 4.9 && t!.rvol >= 1.5)
  // no dip: no signal
  const noDip = rtg.map((s) => ({ ...s, l: Math.max(s.l, open * 0.992) }))
  assert.equal(redToGreen('TEST', TODAY, [...hist, ...today(noDip)], 100, costs), null, 'never 1% under the open')
  // gap under 3%: no signal
  assert.equal(redToGreen('TEST', TODAY, [...hist, ...today(rtg)], 104, costs), null, 'gap only 1%')
  // low volume: no signal
  assert.equal(redToGreen('TEST', TODAY, [...hist, ...today(rtg.map((s) => ({ ...s, v: 300 })))], 100, costs), null, 'RVOL under 1.5')
  // a stop-out: price falls through the stop after entry
  const stopped = [...rtg.slice(0, 4), { o: open * 1.006, h: open * 1.007, l: open * 0.95, c: open * 0.96, v: 3000 }, ...fill(21, open * 0.96)]
  const s = redToGreen('TEST', TODAY, [...hist, ...today(stopped)], 100, costs)
  assert.ok(s && s.why === 'stop' && s.exit === s.stop && s.retPct < 0)
}

// L6 opening drive: green first bar closing in its top 25% with RVOL >= 2, buy 9:45, out at 11:00
{
  const drive: Spec[] = [
    { o: open, h: open * 1.02, l: open * 0.998, c: open * 1.019, v: 6000 }, // RVOL 6
    { o: open * 1.019, h: open * 1.03, l: open * 1.015, c: open * 1.025 }, // 9:45 entry
    ...fill(4, open * 1.025), // 10:00 .. 10:45
    { o: open * 1.04, h: open * 1.05, l: open * 1.035, c: open * 1.045 }, // 11:00: time exit at this open
    ...fill(19, open * 1.045),
  ]
  const t = openingDrive('TEST', TODAY, [...hist, ...today(drive)], 100, costs)
  assert.ok(t, 'signal found')
  assert.equal(t!.entry, +(open * 1.019).toFixed(4))
  assert.equal(t!.exit, +(open * 1.04).toFixed(4))
  assert.equal(t!.why, 'time')
  assert.equal(t!.stop, +(open * 0.998 * 0.998).toFixed(4))
  // red first bar / weak close / thin volume: no signal
  assert.equal(openingDrive('T', TODAY, [...hist, ...today([{ ...drive[0], c: open * 0.999 }, ...drive.slice(1)])], 100, costs), null, 'red first bar')
  assert.equal(openingDrive('T', TODAY, [...hist, ...today([{ ...drive[0], c: open * 1.01 }, ...drive.slice(1)])], 100, costs), null, 'closes mid-range')
  assert.equal(openingDrive('T', TODAY, [...hist, ...today([{ ...drive[0], v: 1500 }, ...drive.slice(1)])], 100, costs), null, 'first-bar RVOL 1.5')
  // stop over 6% away: skipped
  assert.equal(openingDrive('T', TODAY, [...hist, ...today([{ o: open, h: open * 1.1, l: open * 0.9, c: open * 1.095, v: 6000 }, ...drive.slice(1)])], 100, costs), null, 'stop too far')
  // too little history: no grade
  assert.equal(openingDrive('T', TODAY, today(drive), 100, costs), null)
}

// state: a day is recorded once; report line says "chưa có tín hiệu" until a trade exists
{
  let s = addSetupDay(emptySetup(), TODAY, 3, [])
  assert.equal(s.days, 1)
  assert.equal(s.names, 3)
  const L = { ...emptyLeads(), doneDay: TODAY, l5: s }
  assert.match(leadsReport(L).vi.join('\n'), /L5 đỏ sang xanh: chưa có tín hiệu/)
  s = addSetupDay(s, '2026-11-30', 2, [{ sym: 'T', day: '2026-11-30', entry: 1, stop: 0.9, exit: 1.1, why: 'close', gap: 4, rvol: 2, retPct: 10, pnl: 100 }])
  const r = leadsReport({ ...L, l5: s })
  assert.equal(r.l5.n, 1)
  assert.equal(r.l5.winRate, 100)
  assert.match(r.vi.join('\n'), /L5 đỏ sang xanh: 1 lệnh bóng/)
  // old stored state without l5/l6 still parses
  const old = JSON.parse(JSON.stringify(emptyLeads()))
  delete old.l5
  delete old.l6
  const p = parseLeads(old)!
  assert.equal(p.l5.agg.n, 0)
}
// worker: gap targets come only from today's daily bars of a (nearly) complete universe
{
  const { gapTargets } = await import('../src/worker/shadowLeads')
  const { STOCKS } = await import('../src/lib/replayUniverse')
  const full: Record<string, DailyBar[]> = Object.fromEntries(STOCKS.map((x) => [x, [['2026-11-26', 100, 100, 1], [TODAY, 101, 101, 1]] as DailyBar[]]))
  full[STOCKS[0]] = [['2026-11-26', 100, 100, 1], [TODAY, 110, 110, 1]]
  full[STOCKS[1]] = [['2026-11-26', 100, 100, 1], [TODAY, 104, 104, 1]]
  const w = { day: TODAY, l4bars: full } as never
  assert.deepEqual(gapTargets(w).map((x) => x.sym), [STOCKS[0], STOCKS[1]], 'biggest gap first')
  assert.deepEqual(gapTargets({ day: TODAY, l4bars: null } as never), [], 'no daily bars: nothing')
  assert.deepEqual(gapTargets({ day: TODAY, l4bars: { [STOCKS[0]]: full[STOCKS[0]] } } as never), [], 'most of the universe missing: nothing')
}
console.log('shadowsetups ok')
