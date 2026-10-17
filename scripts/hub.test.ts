import assert from 'node:assert/strict'
import { agentVotes, agreeCount } from '../src/lib/hub'

const pick = { symbol: 'NOK', source: 'gainer' as const, verdict: 'BUY' as const, gainPct: 3, volVsAvg: 2, tradeScore: 70, place: 1 }
const base = { flow: { symbol: 'BTC/USDT', buyShare: null }, headlines: [], learner: { right: 0, wrong: 0 }, risk: { killSwitch: false, dayPL: 0, lossLimit: 1000, lossLimitOn: true } }

// with little data, agents say "no data" instead of guessing
const v0 = agentVotes(pick, base)
assert.deepEqual(v0.map((x) => x.id), ['scanner', 'flow', 'news', 'signals', 'learner', 'risk'])
assert.deepEqual(v0.map((x) => x.vote), ['yes', 'none', 'none', 'yes', 'none', 'yes'])
assert.equal(agreeCount(v0), 3)

// order flow counts only for the chart market; headlines must name the symbol
const v1 = agentVotes(pick, { ...base, flow: { symbol: 'NOK', buyShare: 0.3 }, headlines: ['Nokia NOK shares surge on strong record profit beat', 'NOKIAN tyres fall'], learner: { right: 7, wrong: 3 } })
assert.equal(v1[1].vote, 'no')
assert.equal(v1[2].vote, 'yes')
assert.ok(v1[2].why.en.startsWith('1 headline'))
assert.equal(v1[4].vote, 'yes')

// the risk guard says no when the kill switch is on or the loss limit is used up
assert.equal(agentVotes(pick, { ...base, risk: { ...base.risk, killSwitch: true } })[5].vote, 'no')
assert.equal(agentVotes(pick, { ...base, risk: { ...base.risk, dayPL: -1000 } })[5].vote, 'no')
assert.equal(agentVotes({ ...pick, verdict: 'SELL', place: null }, base)[3].vote, 'no')

console.log('hub tests passed')
