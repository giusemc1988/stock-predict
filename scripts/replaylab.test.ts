import assert from 'node:assert/strict'
import { deflatedSharpe, mineRules, normCdf, normInv, stats, type ReplayTrade } from '../src/lib/replayLab'

assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-6 && Math.abs(normCdf(1.96) - 0.975) < 1e-3)
assert.ok(Math.abs(normInv(0.975) - 1.96) < 1e-3 && Math.abs(normInv(0.5)) < 1e-9)

let x = 42
const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647)
// pure noise with many rules tried is not "real"; a strong steady edge is
const noise = Array.from({ length: 200 }, () => (rnd() - 0.5) * 2)
assert.ok(deflatedSharpe(noise, 300, 0.01) < 0.95)
const edge = Array.from({ length: 200 }, () => 0.5 + (rnd() - 0.5))
assert.ok(deflatedSharpe(edge, 300, 0.01) > 0.95)

// plant a real rule (high volume wins) in otherwise losing trades, over 60 days
const day0 = Date.UTC(2026, 7, 3, 15, 0)
const trades: ReplayTrade[] = Array.from({ length: 3000 }, (_, i) => {
  const vol = rnd() * 3
  return {
    symbol: 'T', asset: 'stock', openedAt: day0 + (i % 60) * 86_400_000, exitReason: 'close',
    retPct: vol >= 2 ? 0.4 + (rnd() - 0.5) * 0.6 : -0.2 + (rnd() - 0.5) * 0.6,
    volVsAvg: vol, gainPct: rnd() * 5, grade: 'B', tradeScore: 60, regime: 'normal', score: 0.5, stopPct: 1.5, spyDay: 0,
  }
})
const lab = mineRules(trades)
assert.equal(lab.split.bookDays + lab.split.examDays, 60)
assert.ok(lab.rules.some((r) => r.passed && r.name.startsWith('volume >= 2x')), 'planted volume rule passes')
assert.ok(!lab.rules.some((r) => r.passed && r.name === 'volume < 1x'), 'a losing rule never passes')
assert.ok(stats([]).n === 0)
console.log('replaylab ok')

// strategy simulator: costs, gap-through stop, target as limit, out by the close
{
  const { netRetPct, simulateExit, s3LastHalfHour } = await import('../src/lib/replayStrategies')
  assert.equal(netRetPct(100, 101, null, false), 1)
  const c = { feeBps: 1, spreadBps: 4, slippageBps: 2 }
  assert.ok(netRetPct(100, 100, c, false) < -0.09 && netRetPct(100, 100, c, false) > -0.11, 'round trip costs about 0.1%')
  const t0 = Date.UTC(2026, 9, 28, 14, 0) / 1000
  const bar = (k: number, o: number, h: number, l: number, cl: number) => ({ time: t0 + k * 900, open: o, high: h, low: l, close: cl, volume: 1 })
  const bars = [bar(0, 100, 100, 100, 100), bar(1, 97, 98, 96, 97), bar(2, 100, 103, 99, 102)]
  const gap = simulateExit(bars, { i: 0, price: 100, stop: 98, target: 105 }, Infinity, null)
  assert.deepEqual([gap.exitReason, gap.retPct], ['stop', -3], 'a gap below the stop fills at the open')
  const hit = simulateExit([bars[0], bars[2]], { i: 0, price: 100, stop: 95, target: 102 }, Infinity, null)
  assert.deepEqual([hit.exitReason, hit.retPct], ['target', 2])
  const closed = simulateExit(bars, { i: 0, price: 100, stop: 90, target: 110 }, (t0 + 900) * 1000, null)
  assert.equal(closed.exitReason, 'close')
  // last half hour: up at 10:00 vs yesterday's close -> one trade 15:30 -> 16:00
  const day = (d: number, base: number, up: boolean) => {
    const start = Date.UTC(2026, 9, d, 13, 30) / 1000 // 09:30 EDT
    return Array.from({ length: 26 }, (_, k) => {
      const p = base + (up ? k * 0.1 : -k * 0.1)
      return { time: start + k * 900, open: p, high: p + 0.05, low: p - 0.05, close: p, volume: 1 }
    })
  }
  const s3 = s3LastHalfHour({ bars: [...day(26, 100, true), ...day(27, 103, true), ...day(28, 100, false)], asset: 'stock', atlas: [], costs: null, dayEnd: () => Infinity })
  assert.equal(s3.length, 1, 'only the day that was up at 10:00 (and has a previous close) trades')
  assert.ok(Math.abs(s3[0].retPct - (105.5 / 105.3 - 1) * 100) < 1e-9)
}
console.log('replaylab strategies ok')
