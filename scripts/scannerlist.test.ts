import assert from 'node:assert/strict'
import { parseLiveScan, parseScannerFile, SCANNER_MAX_AGE_MS } from '../src/lib/scannerList'

const now = Date.UTC(2026, 10, 3, 15)
const row = (symbol: string, marketCap: unknown = 5e9) => ({ symbol, marketCap, rvol: 2, changePct: 3 })
const ok = parseScannerFile({ generatedAt: now - 60_000, rows: [row('ZG'), row('IDXX', 5e10), row('ZG'), row('bad!'), row('TEM', 'x')] }, now)!
assert.deepEqual(ok.map((m) => m.symbol), ['ZG', 'IDXX', 'TEM'], 'duplicates and odd symbols dropped')
assert.equal(ok[0].marketCap, 5e9)
assert.equal(ok[2].marketCap, null, 'a bad cap is unknown, not a guess')
assert.equal(ok[0].source, 'gainer')
assert.equal(parseScannerFile({ generatedAt: now - SCANNER_MAX_AGE_MS - 1, rows: [row('ZG')] }, now), null, 'stale file falls back')
assert.equal(parseScannerFile({ generatedAt: now, rows: [] }, now), null, 'empty list falls back')
assert.equal(parseScannerFile(null, now), null)
assert.equal(parseScannerFile({ rows: [row('ZG')] }, now), null)
assert.equal(parseScannerFile({ generatedAt: now + 3_600_000, rows: [row('ZG')] }, now), null, 'a clock in the future is not fresh')
assert.equal(parseScannerFile({ generatedAt: now, rows: Array.from({ length: 40 }, (_, i) => row(`A${String.fromCharCode(65 + (i % 26))}${i < 26 ? '' : 'B'}`)) }, now)!.length <= 15, true)
const live = parseLiveScan({ totalCount: 3, data: [{ s: 'NASDAQ:ZG', d: ['ZG', 32.9, 7.2e9, 4, 3.1, 'NASDAQ'] }, { s: 'NYSE:CWEN', d: ['CWEN', 33.9, 'x', 3.8, 5.8, 'NYSE'] }, { s: 'X', d: ['bad!'] }] }, now)!
assert.deepEqual(live.map((m) => m.symbol), ['ZG', 'CWEN'], 'live scan rows parsed, odd symbols dropped')
assert.equal(live[1].marketCap, null)
assert.equal(parseLiveScan({ data: [] }, now), null, 'empty live scan falls back')
assert.equal(parseLiveScan({ error: 'x' }, now), null)
console.log('scanner list tests passed')
