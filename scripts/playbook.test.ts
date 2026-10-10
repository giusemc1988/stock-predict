import assert from 'node:assert/strict'
import { emptyPractice, onBarClose, type EntryContext, type PracticeTrade } from '../src/lib/practice'
import { brokenRules, checkTrade, provenRuleBroken, ruleEvidence } from '../src/lib/playbook'
import { ask, briefing, tradeLessons } from '../src/lib/jarvis'
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

// Jarvis text is built from the data, in both languages, and never promises profits
const st = { ...emptyPractice(), trades: [trade(1, { review: { good: false, bucket: 'lucky', fails: ['rr'] }, target: 101 })] }
const lines = [...briefing(st, DEFAULT_AI_RULES, [], false, T0), ...tradeLessons(st), ...(['whyBuy', 'learned', 'rules', 'risk', 'idle'] as const).flatMap((q) => ask(q, { state: st, rules: DEFAULT_AI_RULES, journal: [], killSwitch: false, priceOf: () => 100, now: T0 }))]
assert.ok(lines.length > 5)
for (const l of lines) {
  assert.ok(l.en && l.vi, 'every line has English and Vietnamese')
  assert.doesNotMatch(l.en, /guarantee|sure win|can't lose/i)
}
assert.match(tradeLessons(st)[0].en, /Lucky win/)
console.log('playbook ok')

// spoken text reads like speech: no parentheses, symbols as words
import { speakable } from '../src/lib/speech'
assert.equal(speakable('Lost −$4.61 (fees) · done'), 'Lost minus $4.61. done')
assert.equal(speakable('Lỗ −$2', 'vi'), 'Lỗ âm $2')
console.log('speech ok')

// Show me: a closed trade's tour points at the buy, stop, target and the sell, then gives the lesson
import { tradeTour } from '../src/lib/jarvis'
const tour = tradeTour(trade(7, { exit: 104, exitReason: 'target', exitBarTime: 99 }), [])
assert.equal(tour.symbol, 'S7')
assert.equal(tour.steps.length, 5)
assert.equal(tour.steps[0].marker?.side, 'buy')
assert.equal(tour.steps[3].marker?.side, 'sell')
assert.deepEqual(tour.steps[2].lines.map((l) => l.title), ['Buy', 'Stop', 'Target'])
assert.ok(tour.steps.every((s) => s.en && s.vi))
console.log('tour ok')

// day replay walks every trade of the day in order, switching stocks per step
import { dayReplayTour, tourSymbols } from '../src/lib/jarvis'
import { matchQuestion } from '../src/lib/listen'
const dayState = { ...emptyPractice(), trades: [trade(1, { exitBarTime: 5 }), trade(2, { exitBarTime: 6, pnl: -1, retPct: -1 })] }
const replay = dayReplayTour(dayState, T0 + 5 * 3_600_000)!
assert.equal(replay.steps.length, 1 + 2 * 2 + 1, 'intro, buy+sell per trade, wrap-up')
assert.deepEqual(tourSymbols(replay), ['S1', 'S2'])
assert.equal(replay.steps[3].symbol, 'S2')
assert.equal(dayReplayTour(emptyPractice()), null)
// voice questions map to Jarvis's questions in English and Vietnamese
assert.equal(matchQuestion('Why did you buy that?'), 'whyBuy')
assert.equal(matchQuestion("what's my risk right now"), 'risk')
assert.equal(matchQuestion('replay today'), 'replay')
assert.equal(matchQuestion('vì sao bạn mua'), 'whyBuy')
assert.equal(matchQuestion('hôm nay học được gì'), 'learned')
assert.equal(matchQuestion('hello there'), null)
console.log('replay + voice ok')

// greeting, linked questions, "ask about any stock"
import { greeting, stockMemory, stockTour } from '../src/lib/jarvis'
import { understand } from '../src/lib/listen'
const hello = greeting('Chanh', st, false, T0)
assert.match(hello.en, /^Good (morning|afternoon|evening), Chanh\.|^Working late, Chanh\./)
assert.ok(hello.vi.includes('Chanh'))
const jctx = { state: st, rules: DEFAULT_AI_RULES, journal: [], killSwitch: false, priceOf: () => 100, now: T0, skills: [{ en: 'Analyst', vi: 'Phân tích', on: true }], learn: { cycles: 3, oldTests: 10, newBars: 5, latest: { en: 'x', vi: 'y' } } }
for (const q of ['who', 'skills', 'log', 'reviews', 'learning'] as const) for (const l of ask(q, jctx)) assert.ok(l.en && l.vi, q)
assert.match(ask('reviews', jctx)[0].en, /1 lucky/)
const known = [{ symbol: 'AAPL', name: 'Apple Inc.' }, { symbol: 'TSLA', name: 'Tesla Inc.' }, { symbol: 'BTC/USDT', name: 'Bitcoin' }]
assert.deepEqual(understand('why AAPL?', known), { kind: 'stock', symbol: 'AAPL' })
assert.deepEqual(understand('what about tesla', known), { kind: 'stock', symbol: 'TSLA' })
assert.deepEqual(understand('how is btc doing', known), { kind: 'stock', symbol: 'BTC/USDT' })
assert.deepEqual(understand('vì sao mua AAPL', known), { kind: 'stock', symbol: 'AAPL' })
assert.deepEqual(understand('why PLTR?', known), { kind: 'stock', symbol: 'PLTR' })
assert.deepEqual(understand('what skills do you use', known), { kind: 'ask', id: 'skills' })
assert.deepEqual(understand('Why did you buy?', known), { kind: 'ask', id: 'whyBuy' })
assert.deepEqual(understand('replay today', known), { kind: 'replay' })
assert.equal(understand('hello there', known), null)
assert.match(stockMemory('S1', st)[0].en, /traded S1 1 time/)
assert.match(stockMemory('ZZZ', st)[0].en, /haven't traded ZZZ/)
const a = { verdict: 'BUY', score: 0.6, confidence: 0.6, confidenceLabel: 'High', headline: '', checks: [{ label: 'Uptrend', detail: '', stance: 'bull' }, { label: 'Overbought', detail: '', stance: 'bear' }], plan: { entry: 100, stop: 98, target: 104, riskReward: 2 }, sizing: null, tradeScore: null, exitPlan: null, trackRecord: '' } as unknown as Analysis
const why = stockTour(a, 'AAPL', 1000, st)!
assert.equal(why.symbol, 'AAPL')
assert.equal(why.steps.length, 6)
assert.match(why.steps[1].en, /For it: uptrend\. Against it: overbought\./)
console.log('greeting + any stock ok')
