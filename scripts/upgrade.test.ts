/**
 * Tests for the v1.5 safety upgrade: data freshness, hard limits, idempotent orders,
 * trading costs, decision log, trade review, daily report and skill registry.
 */
import assert from 'node:assert/strict'
import { emptyPractice, onBarClose, onPrice, type EntryContext } from '../src/lib/practice'
import { labelForSource, stampData, staleReason } from '../src/lib/dataGuard'
import { fillPrice, feeFor } from '../src/lib/costs'
import { reviewTrade } from '../src/lib/review'
import { buildDailyReport } from '../src/lib/dailyReport'
import { freshSim, simReducer } from '../src/broker/sim'
import { riskGates, blocking } from '../src/lib/riskGates'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { effectiveRules, SKILLS } from '../src/lib/skills'
import { runSkillTests } from '../src/lib/skillTests'
import type { BrokerState, OrderRequest } from '../src/broker/types'
import type { Analysis } from '../src/types'

const buy = { verdict: 'BUY', score: 0.6, headline: 'Trend up', tradeScore: { score: 70, grade: 'B', regime: 'normal' }, exitPlan: { entry: 100, stop: 95, target: 110 }, plan: null } as unknown as Analysis
const now = Date.UTC(2026, 9, 9, 15)
const barTime = now / 1000 - 1800 // a 15-minute bar that closed 15 minutes ago
const ctx = (over: Partial<EntryContext> = {}): EntryContext => ({
  symbol: 'AAPL', tf: '15m', price: 100, barTime, analysis: buy, learner: 'BUY', asset: 'stock', dayOn: true, dayTrades: 4, longOn: false, longTrades: 1, holdDays: 5, sizePct: 2, gatesOn: true, maxDrawdownPct: 10, maxTradesPerDay: 50, killSwitch: false, now,
  tfSec: 900, dataGuardOn: true, maxDataAgeMin: 30, data: stampData('Binance', barTime, 900, now), ...over,
})

// ---------- data freshness ----------
assert.equal(labelForSource('Binance'), 'real')
assert.equal(labelForSource('Alpaca (IEX)'), 'real')
assert.equal(labelForSource('Yahoo Finance'), 'delayed')
assert.equal(labelForSource('Simulated feed'), 'mock')
assert.equal(stampData('Binance', barTime, 900, now).ageSec, 900)
assert.equal(staleReason(stampData('Binance', barTime, 900, now), 900, 30), null)
assert.ok(staleReason(stampData('Simulated feed', barTime, 900, now), 900, 30))
assert.ok(staleReason(stampData('Binance', barTime - 3600, 900, now), 900, 30), 'an hour-old bar is stale')
// mock and stale data block the entry, and the rejection is logged
let s = onBarClose(emptyPractice(), ctx({ data: stampData('Simulated feed', barTime, 900, now) }))
assert.equal(s.open.length, 0)
assert.equal(s.audit![0].accepted, false)
assert.equal(s.audit![0].blockedBy, 'Data')
assert.equal(onBarClose(emptyPractice(), ctx({ data: stampData('Binance', barTime - 7200, 900, now) })).open.length, 0)
// the guard can be turned off
assert.equal(onBarClose(emptyPractice(), ctx({ dataGuardOn: false, data: stampData('Simulated feed', barTime, 900, now) })).open.length, 1)

// ---------- idempotent entries ----------
s = onBarClose(emptyPractice(), ctx())
assert.equal(s.open.length, 1)
assert.equal(s.audit![0].accepted, true)
assert.ok(s.audit![0].passed!.includes('Data'))
const again = onBarClose(s, ctx({ symbol: 'AAPL' }))
assert.equal(again.open.length, 1, 'a retried bar does not buy twice')
assert.equal(again.audit!.length, s.audit!.length, 'and logs nothing new')

// ---------- hard limits (hold even with the other gates off) ----------
let many = emptyPractice()
for (const sym of ['A', 'B', 'C']) many = onBarClose(many, ctx({ symbol: sym, gatesOn: false, maxOpenPositions: 2, hardLimitsOn: true }))
assert.equal(many.open.length, 2)
assert.equal(many.audit![0].blockedBy, 'Open positions')
let exp = emptyPractice()
for (const sym of ['A', 'B', 'C']) exp = onBarClose(exp, ctx({ symbol: sym, gatesOn: false, maxExposurePct: 5, hardLimitsOn: true }))
assert.equal(exp.open.length, 2, '2% each: the third would make 6% > 5%')
assert.equal(exp.audit![0].blockedBy, 'Exposure')
const down = { ...emptyPractice(), realized: -2000, peak: 10_000 }
assert.equal(onBarClose(down, ctx({ gatesOn: false })).open.length, 0, 'drawdown halt ignores the gates switch')

// ---------- costs ----------
const c = { feeBps: 1, spreadBps: 4, slippageBps: 2 }
assert.ok(Math.abs(fillPrice(100, 'buy', c) - 100.04) < 1e-9)
assert.ok(Math.abs(fillPrice(100, 'sell', c) - 99.96) < 1e-9)
assert.equal(fillPrice(100, 'sell', c, true), 100)
assert.ok(Math.abs(feeFor(10_000, c) - 1) < 1e-9)
const withCost = onBarClose(emptyPractice(), ctx({ costs: c }))
const free = onBarClose(emptyPractice(), ctx())
const wonCost = onPrice(withCost, 'AAPL', 110, barTime, now + 1)!
const wonFree = onPrice(free, 'AAPL', 110, barTime, now + 1)!
const t = wonCost.trades[0]
assert.ok(t.pnl < wonFree.trades[0].pnl, 'costs reduce P&L')
assert.ok(t.costPaid! > 0 && Math.abs(t.gross! - t.costPaid! - t.pnl) < 0.02)
assert.equal(t.exit, 110, 'a target fills at its price')
const stopped = onPrice(withCost, 'AAPL', 94, barTime, now + 1)!.trades[0]
assert.ok(stopped.exit < 94, 'a stop pays spread and slippage')

// ---------- review ----------
assert.equal(t.review!.bucket, 'skill')
assert.equal(reviewTrade({ signal: 100, stop: 95, target: 103, tradeScore: 70, learner: 'BUY', pnl: 5 }).bucket, 'lucky')
assert.equal(reviewTrade({ signal: 100, stop: 95, target: 110, tradeScore: 70, learner: 'BUY', pnl: -5 }).bucket, 'unlucky')
assert.deepEqual(reviewTrade({ signal: 100, stop: 95, target: 110, tradeScore: 20, learner: 'HOLD', pnl: -5 }).fails, ['score', 'learner'])

// ---------- daily report ----------
const day = Object.keys(wonCost.reports!)[0]
const r = wonCost.reports![day]
assert.equal(r.trades, 1)
assert.equal(r.wins, 1)
assert.equal(r.review.skill, 1)
assert.ok(r.costs > 0 && r.lessons.length > 0)
assert.equal(buildDailyReport(wonCost, '2000-01-01').trades, 0)

// ---------- sim broker: idempotent orders and fees ----------
const req: OrderRequest = { symbol: 'AAPL', side: 'buy', type: 'market', qty: 10, tif: 'day', source: 'robot', clientOrderId: 'robot-AAPL-buy-1' }
let sim = simReducer(freshSim(), { type: 'place', req, last: 100 })
sim = simReducer(sim, { type: 'place', req, last: 100 })
assert.equal(sim.orders.length, 1, 'same client id = one order')
assert.ok(sim.orders[0].filledPrice! > 100 && sim.orders[0].fee! > 0, 'default costs apply')

// ---------- risk gates: robot hard limits ----------
const broker = (positions: number, equity = 10_000): BrokerState =>
  ({
    mode: 'sim', label: '', connected: true, error: null, orders: [], history: [{ time: 0, equity }],
    account: { equity, cash: equity, buyingPower: equity, dayPL: 0, dayPLPct: 0, totalPL: 0 },
    positions: Array.from({ length: positions }, (_, i) => ({ symbol: `S${i}`, qty: 1, avgCost: 100, last: 100, marketValue: 100, unrealized: 0, unrealizedPct: 0 })),
  }) as BrokerState
const limits = { killSwitch: false, lossLimitOn: false, lossLimit: 0 }
const rb: OrderRequest = { symbol: 'NEW', side: 'buy', type: 'market', qty: 1, tif: 'day', source: 'robot' }
const off = { ...DEFAULT_AI_RULES, gatesOn: false, maxOpenPositions: 3 }
assert.equal(blocking(riskGates(rb, 100, broker(3), null, limits, off))[0]?.name, 'Hard: open positions')
assert.equal(blocking(riskGates(rb, 100, broker(2), null, limits, off)).length, 0)
assert.equal(blocking(riskGates({ ...rb, qty: 70 }, 100, broker(0), null, limits, off))[0]?.name, 'Hard: exposure')
assert.equal(blocking(riskGates({ ...rb, source: 'manual' }, 100, broker(3), null, limits, off)).length, 0, 'your own orders are not capped')

// ---------- skill registry ----------
assert.ok(runSkillTests().every((x) => x.ok), JSON.stringify(runSkillTests().filter((x) => !x.ok)))
assert.equal(effectiveRules(DEFAULT_AI_RULES, { volatility: 'revoked' }).volatilityOn, false)
assert.equal(effectiveRules(DEFAULT_AI_RULES, { analyst: 'quarantine' }).practiceMode, false)
assert.equal(effectiveRules(DEFAULT_AI_RULES, {}, new Set(['trade-score'])).tradeScoreOn, false, 'a failed self-test quarantines')
assert.equal(effectiveRules({ ...DEFAULT_AI_RULES, skillRegistryOn: false }, { analyst: 'revoked' }).practiceMode, true)
assert.equal(new Set(SKILLS.map((k) => k.id)).size, SKILLS.length)

console.log('upgrade tests passed')
