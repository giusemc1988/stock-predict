import assert from 'node:assert/strict'
import { briefFacts, briefKey, briefNodes, plainBrief, type BriefInputs } from '../src/lib/brief'
import { cryptoMovers, scanMarkets } from '../src/lib/practiceScan'

// the scan universe comes from live movers, not from a built-in list
const watch = [{ symbol: 'AAPL', assetClass: 'stock' as const }]
const m = scanMarkets(watch, [{ symbol: 'XYZ', source: 'gainer' }, { symbol: 'AAPL', source: 'active' }], [{ symbol: 'PEPE/USDT', source: 'gainer' }])
assert.deepEqual(m.map((x) => `${x.symbol}:${x.asset}:${x.source}`), ['AAPL:stock:watchlist', 'XYZ:stock:gainer', 'PEPE/USDT:crypto:gainer'])
assert.deepEqual(scanMarkets([], [], []), [])
const row = (symbol: string) => ({ symbol, assetClass: 'crypto' as const, price: 1, changePct: 1 })
assert.deepEqual(cryptoMovers({ gainers: [row('A/USDT'), row('B/USDT')], volume: [row('B/USDT'), row('C/USDT')] }, 2).map((x) => `${x.symbol}:${x.source}`), ['A/USDT:gainer', 'B/USDT:gainer', 'C/USDT:active'])
assert.deepEqual(cryptoMovers(null), [])

// with no data, every node says what is missing and shows no numbers
const empty: BriefInputs = {
  now: Date.UTC(2026, 9, 16, 15),
  lists: { crypto: null, stocks: null, stocksNeedKey: true, updatedAt: null, cryptoError: null, stockError: null },
  flow: { symbol: 'BTC/USDT', buyShare: null, live: false, source: 'none' },
  scan: { on: true, at: null, busy: false, candidates: [], noStockData: true, server: false },
  learn: { cycles: 0, lastCycle: null, lessonsToday: 0, right: 0, wrong: 0 },
  risk: { dayPL: 0, lossLimit: 1000, lossLimitOn: true, killSwitch: false },
}
const n0 = briefNodes(empty)
assert.deepEqual(n0.map((n) => n.id), ['scanner', 'flow', 'news', 'signals', 'learner', 'risk'])
assert.deepEqual(n0.map((n) => n.status), ['missing', 'missing', 'off', 'missing', 'off', 'live'])
assert.ok(n0.filter((n) => n.status !== 'live').every((n) => !/\d/.test(n.note.en.replace('BTC/USDT', ''))))
assert.ok(briefFacts(empty).some((f) => f.en.includes('Alpaca paper key')))

// with data, the nodes and the brief name what the lists and scan really hold
const lists = { gainers: [{ symbol: 'NVDA', assetClass: 'stock' as const, price: 190, changePct: 6.2, dollarVolume: 9e9 }], losers: [], volume: [{ symbol: 'TSLA', assetClass: 'stock' as const, price: 250, changePct: 1, dollarVolume: 2e10 }] }
const full: BriefInputs = {
  ...empty,
  lists: { ...empty.lists, stocks: lists, stocksNeedKey: false, updatedAt: empty.now },
  flow: { symbol: 'BTC/USDT', buyShare: 0.61, live: true, source: 'Binance' },
  scan: { ...empty.scan, at: empty.now, candidates: [{ symbol: 'NVDA', source: 'gainer', verdict: 'BUY', gainPct: 6.2, volVsAvg: 2, tradeScore: 81, place: 1 }], noStockData: false },
  learn: { cycles: 3, lastCycle: empty.now, lessonsToday: 1, right: 6, wrong: 4 },
  risk: { dayPL: -250, lossLimit: 1000, lossLimitOn: true, killSwitch: false },
}
const n1 = briefNodes(full)
assert.deepEqual(n1.map((n) => n.status), ['live', 'live', 'off', 'live', 'live', 'live'])
assert.equal(n1[1].note.en, 'buyers 61% on BTC/USDT')
assert.equal(n1[5].note.en, '25% of daily loss limit')
const facts = briefFacts(full).map((f) => f.en).join(' ')
assert.ok(facts.includes('NVDA') && facts.includes('TSLA') && facts.includes('Trade Score 81'))
assert.ok(plainBrief(briefFacts(full), 'vi').length > 0)
// the AI is asked again only when the data behind the brief changes
assert.equal(briefKey(full, 'en'), briefKey({ ...full, flow: { ...full.flow, buyShare: 0.4 } }, 'en'))
assert.notEqual(briefKey(full, 'en'), briefKey({ ...full, scan: { ...full.scan, at: full.now + 300_000 } }, 'en'))
console.log('brief tests passed')
