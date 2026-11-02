import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COUNCIL_IDS, baseSymbol, currentForecasts, dailyVol, forecastPath, kronosPct5 } from '../src/lib/kronosView'
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
// the card keeps the newest forecast per symbol and drops symbols that left the list
const fc = (symbol: string, asOf: string, p5: number) => ({ symbol, asOf, lastClose: 100, pred: { '1': 100, '5': p5 } })
const cur = currentForecasts([fc('AAA', '2026-10-20', 90), fc('AAA', '2026-10-30', 110), fc('OLD', '2026-10-20', 95), fc('BTC-USD', '2026-10-31', 103), fc('NEW', '2026-10-30', 99)])
assert.deepEqual(cur.map((f) => f.symbol).sort(), ['AAA', 'BTC-USD', 'NEW'])
assert.equal(cur.find((f) => f.symbol === 'AAA')!.pred['5'], 110)
assert.equal(currentForecasts([]).length, 0)
assert.deepEqual([baseSymbol('ETH/USDT'), baseSymbol('eth-usd'), baseSymbol('AAPL')], ['ETH', 'ETH', 'AAPL'])
const pct = kronosPct5([fc('AAA', '2026-10-30', 110), fc('BTC-USD', '2026-10-31', 97), fc('OLD', '2026-10-01', 50)])
assert.equal(Math.round(pct.AAA), 10)
assert.equal(Math.round(pct.BTC), -3)
assert.equal(pct.OLD, undefined)

console.log('kronos view tests passed')
