import assert from 'node:assert/strict'
import { gainToday, pickWhy, rankCandidates, rankScore, volumeVsAvg } from '../src/lib/practicePicks'
import type { Analysis, Candle } from '../src/types'

const bar = (t: number, close: number, volume = 100): Candle => ({ time: t, open: close, high: close, low: close, close, volume })
// yesterday's last bar closes at 100 (Oct 8, 3:45 pm ET); today rises to 103
const yday = Date.UTC(2026, 9, 8, 19, 45) / 1000
const today = Date.UTC(2026, 9, 9, 14) / 1000
assert.ok(Math.abs(gainToday([bar(yday - 900, 99), bar(yday, 100), bar(today, 101), bar(today + 900, 103)])! - 3) < 1e-9)
assert.equal(gainToday([bar(today, 101), bar(today + 900, 103)]), null)

const flat = Array.from({ length: 20 }, (_, i) => bar(i, 1, 100))
const busy = [...flat, ...Array.from({ length: 4 }, (_, i) => bar(20 + i, 1, 300))]
assert.equal(volumeVsAvg(busy), 3)
assert.equal(volumeVsAvg(flat), null)

assert.ok(rankScore({ tradeScore: 90, volVsAvg: 3, gainPct: 5 }) > rankScore({ tradeScore: 60, volVsAvg: 1, gainPct: 0 }))

const a = (verdict: string, score: number) => ({ verdict, tradeScore: { score } }) as unknown as Analysis
const base = { asset: 'stock' as const, source: 'watchlist' as const, probUp: null, price: 10, barTime: 1 }
const ranked = rankCandidates([
  { ...base, symbol: 'HOLDME', analysis: a('HOLD', 99), gainPct: 9, volVsAvg: 3, tradeScore: 99 },
  { ...base, symbol: 'OK', analysis: a('BUY', 60), gainPct: 0, volVsAvg: 1, tradeScore: 60 },
  { ...base, symbol: 'BEST', analysis: a('BUY', 85), gainPct: 4, volVsAvg: 2.5, tradeScore: 85, source: 'gainer' },
])
assert.deepEqual(ranked.map((c) => c.symbol), ['BEST', 'OK', 'HOLDME'])
assert.deepEqual(ranked.map((c) => c.place), [1, 2, null])
assert.match(pickWhy(ranked[0], 2).en, /#1 of 2 BUY calls, \+4\.0% today, volume 2\.5x normal, Trade Score 85, from top gainers today/)
console.log('practice picker tests passed')
