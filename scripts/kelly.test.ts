import assert from 'node:assert/strict'
import { KELLY_MIN_TRADES, KELLY_WINDOW, NEGATIVE_EDGE_MULT, kellyMultiplier } from '../src/lib/kelly'

const mk = (n: number, winEvery: number, win: number, loss: number) => Array.from({ length: n }, (_, i) => ({ pnl: i % winEvery === 0 ? win : -loss }))

assert.equal(kellyMultiplier([]), 1)
assert.equal(kellyMultiplier(mk(KELLY_MIN_TRADES - 1, 3, 1, 5)), 1, 'too few trades: normal size')
assert.equal(kellyMultiplier(Array.from({ length: 40 }, () => ({ pnl: 1 }))), 1, 'only wins: nothing to judge')
assert.equal(kellyMultiplier(Array.from({ length: 40 }, () => ({ pnl: -1 }))), 1, 'only losses: nothing to judge')
// WR 33%, win 1, loss 1: f = (0.33*1 - 0.67)/1 < 0 -> half size
assert.equal(kellyMultiplier(mk(60, 3, 1, 1)), NEGATIVE_EDGE_MULT)
// WR 41%, payoff 1.4: f = (0.41*1.4 - 0.59)/1.4 ~ -0.01 -> still half
assert.equal(kellyMultiplier([...mk(59, 1, 0, 0).map(() => ({ pnl: 0 }))].length ? Array.from({ length: 100 }, (_, i) => ({ pnl: i < 41 ? 1.4 : -1 })) : []), NEGATIVE_EDGE_MULT)
// positive edge, WR 60%, win = loss: f = 0.2 -> 0.25 x 0.2 = 0.05
const pos = Array.from({ length: 50 }, (_, i) => ({ pnl: i < 30 ? 1 : -1 }))
assert.ok(Math.abs(kellyMultiplier(pos) - 0.05) < 1e-9)
// positive edge with WR under 50% (big winners): unchanged, full size
assert.equal(kellyMultiplier(Array.from({ length: 50 }, (_, i) => ({ pnl: i < 20 ? 3 : -1 }))), 1)
// only the last KELLY_WINDOW trades count: 200 old losers then 100 profitable ones -> recovers
const old = Array.from({ length: 200 }, () => ({ pnl: -1 }))
const fresh = Array.from({ length: KELLY_WINDOW }, (_, i) => ({ pnl: i < 60 ? 1 : -1 }))
assert.ok(kellyMultiplier([...old, ...fresh]) < 0.5)
assert.equal(kellyMultiplier([...old, ...fresh.map(() => ({ pnl: -1 }))]), 1, 'all losses in the window: nothing to judge, normal size')
console.log('kelly tests passed')
