import assert from 'node:assert/strict'
import { atlasSignals, atlasVerdict, learnProgress, signalStats, TRUST_MIN, whyToday, LEARN_GOAL } from '../src/lib/atlasSignals'
import { emptyPractice, type PracticeTrade } from '../src/lib/practice'

const info = (source: string, shadow?: object) => ({ verdict: 'BUY', score: 0, grade: null, tradeScore: null, regime: null, learner: 'n/a', reason: '', pick: { place: 1, of: 1, source, gainPct: 0, volVsAvg: 1, en: '', vi: '' }, ...(shadow ? { shadow } : {}) }) as never
let id = 0
const trade = (pnl: number, source = 'gainer', kind: 'day' | 'long' = 'day', exitReason: PracticeTrade['exitReason'] = pnl > 0 ? 'target' : 'stop', closedAt = Date.parse('2026-10-30T18:00:00Z'), shadow?: object): PracticeTrade =>
  ({ id: `t${++id}`, symbol: 'AAA', tf: '15m', qty: 1, entry: 100, stop: 95, target: 110, openedAt: closedAt - 3_600_000, barTime: 0, bars: 0, info: info(source, shadow), kind, exit: 100 + pnl, closedAt, exitBarTime: 0, exitReason, pnl, retPct: pnl }) as PracticeTrade

// win rate of past trades of the same kind and source; thin under TRUST_MIN
const trades = [trade(2), trade(-1), trade(-1, 'gainer', 'day', 'close'), trade(5, 'active', 'long')]
const st = signalStats(trades, 'day', 'gainer')
assert.equal(st.n, 3)
assert.equal(st.winRate, 33)
assert.equal(st.tpRate, 33)
assert.equal(st.thin, true)
assert.equal(signalStats(trades, 'long', 'watchlist').winRate, null)
assert.ok(TRUST_MIN >= 30)

// verdict: never claims an edge on a losing or thin record
assert.equal(atlasVerdict([]).level, 'none')
assert.equal(atlasVerdict(trades).level, 'learning')
const many = Array.from({ length: 120 }, (_, i) => trade(i % 2 ? 3 : -1))
assert.equal(atlasVerdict(many).level, 'hint')
assert.equal(atlasVerdict(many.slice(0, 50)).level, 'learning')

// signals: open first with TP/SL %, then today's closed ones; a closed one is not counted in its own stats
const s = emptyPractice()
s.trades = trades
s.open = [{ id: 'o1', symbol: 'CVNA', tf: '15m', qty: 1, entry: 100, stop: 95, target: 110, openedAt: Date.parse('2026-10-30T15:00:00Z'), barTime: 0, bars: 0, info: info('gainer'), kind: 'day' }]
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const sig = atlasSignals(s, '2026-10-30', dayOf)
assert.equal(sig[0].status, 'open')
assert.equal(sig[0].tpPct, 10)
assert.equal(sig[0].slPct, -5)
assert.equal(sig[0].stats.n, 3)
assert.equal(sig.length, 5)
assert.equal(sig.find((x) => x.status === 'win' && x.source === 'gainer')!.stats.n, 2)

// learning progress: 0 with no data, counts live-tagged trades and the shadow leads, capped at 100
const now = Date.parse('2026-11-03T12:00:00Z')
const p0 = learnProgress([], null, now)
assert.equal(p0.pct, 0)
assert.equal(p0.lead, null)
assert.equal(p0.daysLeft, 13)
const tagged = Array.from({ length: 60 }, () => trade(1, 'gainer', 'day', 'target', now, { volOk: true, srcOk: true, learner: 'n/a', kronos: 'ok', pass: true }))
const p1 = learnProgress(tagged, { asOf: null, l1: { n: 25 }, l2: { n: 0 }, l3: null, l4: { n: 5 } } as never, now)
assert.equal(p1.tests.find((t) => t.id === 'vol')!.pct, 100)
assert.equal(p1.tests.find((t) => t.id === 'l1')!.n, 25)
assert.equal(p1.tests.find((t) => t.id === 'l1')!.goal, LEARN_GOAL)
assert.equal(p1.lead!.id, 'vol')
assert.ok(p1.pct > 0 && p1.pct <= 100)

// why today: decisions on the last scan day, blocked counts by gate
s.server = { lastRun: Date.parse('2026-10-30T20:00:00Z'), lastBars: {}, picks: [], failed: [] }
s.audit = [
  { id: 'a', time: Date.parse('2026-10-30T15:00:00Z'), symbol: 'A', side: 'buy', account: 'practice', accepted: true, en: '', vi: '', price: 1 },
  { id: 'b', time: Date.parse('2026-10-30T16:00:00Z'), symbol: 'B', side: 'buy', account: 'practice', accepted: false, en: '', vi: '', price: 1, blockedBy: 'Slots' },
  { id: 'c', time: Date.parse('2026-10-30T16:05:00Z'), symbol: 'C', side: 'buy', account: 'practice', accepted: false, en: '', vi: '', price: 1, blockedBy: 'Slots' },
  { id: 'd', time: Date.parse('2026-10-29T16:05:00Z'), symbol: 'D', side: 'buy', account: 'practice', accepted: false, en: '', vi: '', price: 1, blockedBy: 'Slots' },
]
const w = whyToday(s, dayOf)
assert.deepEqual(w, { day: '2026-10-30', decisions: 3, accepted: 1, blocked: [{ by: 'Slots', n: 2 }] })

console.log('atlas signals ok')
