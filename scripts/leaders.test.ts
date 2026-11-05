import assert from 'node:assert/strict'
import { inUniverse, median, percentiles, rankLeaders, rsScore, sectorStrength, trendTemplate, type TvRow } from '../src/lib/leaders'

const base: TvRow = {
  symbol: 'AAA', close: 100, marketCap: 5e9, avgVol30: 1e6, sector: 'Tech', p1m: 5, p3m: 20, p6m: 30, py: 40,
  sma50: 95, sma150: 90, sma200: 85, high52: 105, low52: 60, rvol: 1.2,
}
const row = (o: Partial<TvRow>): TvRow => ({ ...base, ...o })

// universe: Atlas's own entry filters
assert.equal(inUniverse(base), true)
assert.equal(inUniverse(row({ close: 4.9 })), false, 'price below $5')
assert.equal(inUniverse(row({ marketCap: 2e8 })), false, 'cap below $300M')
assert.equal(inUniverse(row({ avgVol30: 100_000 })), false, 'under $26M a day')
assert.equal(inUniverse(row({ symbol: 'ABC.WS' })), false, 'warrants and odd tickers out')
assert.equal(inUniverse(row({ p3m: null })), false, 'missing performance')

// RS weights and percentiles
assert.equal(rsScore({ p1m: 10, p3m: 10, p6m: 10, py: 10 }), 10)
assert.equal(rsScore({ p1m: 0, p3m: 0, p6m: 50, py: null }), 20, 'no 1-year number: 6-month stands in')
assert.deepEqual(percentiles([1, 2, 3]), [0, 50, 100])
assert.equal(median([3, 1, 2]), 2)
assert.equal(median([1, 2, 3, 4]), 2.5)

// trend template: each rule can fail on its own
assert.equal(trendTemplate(base), true)
assert.equal(trendTemplate(row({ close: 90 })), false, 'below SMA50')
assert.equal(trendTemplate(row({ sma150: 80 })), false, 'SMA150 under SMA200')
assert.equal(trendTemplate(row({ low52: 80 })), false, 'less than 30% above the low')
assert.equal(trendTemplate(row({ high52: 140 })), false, 'more than 25% below the high')
assert.equal(trendTemplate(row({ sma200: null })), false, 'new listing, no SMA200')

// sectors: need 10 names; strongest median first
const many = (sector: string, p3m: number, n = 12) => Array.from({ length: n }, (_, i) => row({ symbol: `S${sector[0]}${String.fromCharCode(65 + i)}`, sector, p3m }))
const sec = sectorStrength([...many('Energy', 30), ...many('Health', 10), ...many('Tiny', 99, 3)])
assert.deepEqual(sec.map((s) => s.sector), ['Energy', 'Health'], 'a sector with 3 names is ignored')

// ranking: 200 names with rising performance; the best 10% that also pass the template are list A
const universe: TvRow[] = Array.from({ length: 200 }, (_, i) =>
  row({ symbol: `T${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, p1m: i / 10, p3m: i / 4, p6m: i / 2, py: i }),
)
universe.push(row({ symbol: 'MOVR', p1m: 40, p3m: 0, p6m: 0, py: 0, sma50: 90, sma150: 95, sma200: 99 })) // big 1-month mover, broken trend
universe.push(row({ symbol: 'PENNY', close: 2, p1m: 500, p3m: 900, p6m: 900, py: 900 }))
const rep = rankLeaders(universe, '2026-11-05T22:00:00Z', 50)
assert.equal(rep.universe, 201, 'the penny stock never enters')
assert.ok(rep.listA >= 10 && rep.listA <= 25, `list A is about the top 10% (${rep.listA})`)
assert.ok(rep.leaders.every((l) => l.symbol !== 'PENNY'))
const movr = rep.leaders.find((l) => l.symbol === 'MOVR')
assert.ok(movr && movr.tags.join() === 'B', 'a big mover with a broken trend is list B only')
assert.ok(rep.leaders.length <= 50)
for (let i = 1; i < rep.leaders.length; i++) assert.ok(rep.leaders[i - 1].rs >= rep.leaders[i].rs, 'sorted by RS')
console.log('leaders: ok')
