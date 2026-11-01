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
