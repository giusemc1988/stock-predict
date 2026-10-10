import assert from 'node:assert/strict'
import { emptyPractice, onBarClose, type EntryContext, type PracticeTrade } from '../src/lib/practice'
import { brokenRules, checkTrade, provenRuleBroken, ruleEvidence } from '../src/lib/playbook'
import { ask, briefing, tradeLessons } from '../src/lib/brain'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import type { Analysis } from '../src/types'

const T0 = Date.UTC(2026, 9, 9, 15) // 11:00 am New York
const trade = (i: number, over: Partial<PracticeTrade> = {}): PracticeTrade => ({
  id: `t${i}`, symbol: `S${i}`, tf: '15m', qty: 1, entry: 100, stop: 98, target: 104, openedAt: T0 + i * 3_600_000, barTime: 0, bars: 0,
  info: { verdict: 'BUY', score: 0.5, grade: 'B', tradeScore: 60, regime: 'normal', learner: 'BUY', reason: '' },
  kind: 'day', asset: 'stock', exit: 101, closedAt: T0 + i * 3_600_000 + 60_000, exitBarTime: 0, exitReason: 'target', pnl: 1, retPct: 1, ...over,
})

// a clean 2:1 trade with a 2% stop passes rr and tightStop; 1:1 breaks rr
const ok = checkTrade(trade(1), [])
assert.equal(ok.rr, true)
assert.equal(ok.tightStop, true)
assert.equal(checkTrade(trade(1, { target: 102 }), []).rr, false)
// rules without data say null, not false
assert.equal(checkTrade(trade(1), []).noChase, null)
assert.equal(checkTrade(trade(1, { asset: 'crypto', symbol: 'BTC/USD' }), []).openRush, null)
// first 15 minutes of the session break openRush
assert.equal(checkTrade(trade(0, { openedAt: Date.UTC(2026, 9, 9, 13, 35) }), []).openRush, false)
// three losses in a row before it break the streak rule; a stop-out on the same symbol today breaks revenge
const losers = [1, 2, 3].map((i) => trade(i, { pnl: -1, retPct: -1 }))
assert.equal(checkTrade(trade(9), losers).streak, false)
assert.equal(checkTrade(trade(9, { symbol: 'S1' }), [trade(1, { exitReason: 'stop', pnl: -1 })]).revenge, false)

const opts = { minFollowed: 30, margin: 0.03 }
// no trades: everything unproven
assert.ok(ruleEvidence([], opts).every((e) => e.status === 'unproven'))
// a few trades are not enough to prove anything
assert.equal(ruleEvidence([trade(1), trade(2)], opts).find((e) => e.id === 'rr')!.status, 'unproven')
// rr followed (2:1) wins, rr broken (1:1) loses, on enough trades: proven
const good = Array.from({ length: 40 }, (_, i) => trade(i, { pnl: i % 4 ? 2 : -1, retPct: i % 4 ? 2 : -1 }))
const bad = Array.from({ length: 20 }, (_, i) => trade(100 + i, { target: 101, pnl: i % 4 ? -1 : 1, retPct: i % 4 ? -1 : 1 }))
const ev = ruleEvidence([...good, ...bad], opts)
assert.equal(ev.find((e) => e.id === 'rr')!.status, 'proven')
// the gate then names rr for a new 1:1 trade, and nothing for a 2:1 trade
assert.equal(provenRuleBroken(trade(500, { target: 101 }), [...good, ...bad], opts)?.id, 'rr')
assert.equal(provenRuleBroken(trade(500), [...good, ...bad], opts), null)
assert.equal(brokenRules(trade(500, { target: 101 }), []).broken[0].id, 'rr')

// practice gate: off by default changes nothing; on with a proven rule it skips the buy
const buy = { verdict: 'BUY', score: 0.6, headline: 'Trend up', tradeScore: { score: 70, grade: 'B', regime: 'normal' }, exitPlan: { entry: 100, stop: 95, target: 101 }, plan: null } as unknown as Analysis
const ctx = (over: Partial<EntryContext> = {}): EntryContext => ({
  symbol: 'AAPL', tf: '15m', price: 100, barTime: 1, analysis: buy, learner: 'BUY', asset: 'stock', dayOn: true, dayTrades: 4, longOn: false, longTrades: 1, holdDays: 5, sizePct: 2, gatesOn: false, maxDrawdownPct: 50, maxTradesPerDay: 50, killSwitch: false, now: T0 + 999 * 3_600_000, hardLimitsOn: false, ...over,
})
const hist = { ...emptyPractice(), trades: [...good, ...bad] }
assert.equal(onBarClose(hist, ctx()).open.length, 1, 'gate off: buys')
const gated = onBarClose(hist, ctx({ playbookGate: true, playbookMin: 30, playbookMargin: 0.03 }))
assert.equal(gated.open.length, 0, 'gate on: a 1:5 trade breaks proven rr')
assert.equal(gated.audit?.[0].blockedBy, 'Playbook')

// Trader Brain text is built from the data, in both languages, and never promises profits
const st = { ...emptyPractice(), trades: [trade(1, { review: { good: false, bucket: 'lucky', fails: ['rr'] }, target: 101 })] }
const lines = [...briefing(st, DEFAULT_AI_RULES, [], false, T0), ...tradeLessons(st), ...(['whyBuy', 'learned', 'rules', 'risk', 'idle'] as const).flatMap((q) => ask(q, { state: st, rules: DEFAULT_AI_RULES, journal: [], killSwitch: false, priceOf: () => 100, now: T0 }))]
assert.ok(lines.length > 5)
for (const l of lines) {
  assert.ok(l.en && l.vi, 'every line has English and Vietnamese')
  assert.doesNotMatch(l.en, /guarantee|sure win|can't lose/i)
}
assert.match(tradeLessons(st)[0].en, /Lucky win/)
console.log('playbook ok')
