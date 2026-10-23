import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COUNCIL_IDS, dailyVol, forecastPath } from '../src/lib/kronosView'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'

// the saved path wins; without it, a straight line from +1 to +5
assert.deepEqual(forecastPath({ symbol: 'X', lastClose: 100, pred: { '1': 101, '5': 105 }, path: [101, 99, 102, 104, 106] }), [101, 99, 102, 104, 106])
assert.deepEqual(forecastPath({ symbol: 'X', lastClose: 100, pred: { '1': 101, '5': 105 } }), [101, 102, 103, 104, 105])
assert.deepEqual(forecastPath({ symbol: 'X', lastClose: 100, pred: {} }), [100, 100, 100, 100, 100])

// volatility: flat prices have none, short history falls back to 1.5%
assert.equal(dailyVol([10, 10, 10, 10, 10, 10, 10]), 0)
assert.equal(dailyVol([10, 11]), 0.015)
const v = dailyVol([100, 102, 100, 102, 100, 102, 100])
assert.ok(v > 0.015 && v < 0.025)

// 7 voices, Kronos last; on by default
assert.equal(COUNCIL_IDS.length, 7)
assert.equal(COUNCIL_IDS[6], 'kronos')
assert.equal(DEFAULT_AI_RULES.atlasCouncil, true)

// the saved file carries 30 closes per symbol ending at each latest forecast's close
const k = JSON.parse(readFileSync('public/kronos-shadow.json', 'utf8'))
const last = new Map<string, { lastClose: number }>(k.forecasts.map((f: { symbol: string; lastClose: number }) => [f.symbol, f]))
for (const [sym, closes] of Object.entries(k.recent ?? {}) as [string, number[]][]) {
  assert.ok(closes.length >= 20 && closes.length <= 30, sym)
  assert.ok(Math.abs(closes[closes.length - 1] / last.get(sym)!.lastClose - 1) < 1e-4, sym)
}
console.log('kronos view tests passed')
