import assert from 'node:assert/strict'
import { batchPrompt, MAX_BATCH, headline, kpis, learners, marketOpen, repoUpgrade, stepFor, steps, systemCheck, taskGoal, taskPrompt, todos, UPGRADES } from '../src/lib/atlasControl'
import { emptyPractice, type PracticeTrade } from '../src/lib/practice'

let id = 0
const trade = (pnl: number, closedAt: number): PracticeTrade =>
  ({ id: `t${++id}`, symbol: 'AAA', tf: '15m', qty: 1, entry: 100, stop: 95, target: 110, openedAt: closedAt - 3_600_000, barTime: 0, bars: 0, info: { verdict: 'BUY', score: 0, grade: null, tradeScore: null, regime: null, learner: 'n/a', reason: '' }, kind: 'day', exit: 100 + pnl, closedAt, exitBarTime: 0, exitReason: pnl > 0 ? 'target' : 'stop', pnl, retPct: pnl }) as unknown as PracticeTrade

// Thursday 6 Nov 2026, 15:00 UTC: market open
const now = Date.parse('2026-11-05T15:00:00Z')
assert.equal(marketOpen(now), true)
assert.equal(marketOpen(Date.parse('2026-11-07T15:00:00Z')), false) // Saturday

// a losing book: 30 trades, 10 wins of +2, 20 losses of -3
const s = emptyPractice()
for (let i = 0; i < 30; i++) s.trades.push(trade(i % 3 === 0 ? 2 : -3, now - (30 - i) * 3_600_000))
s.realized = s.trades.reduce((a, t) => a + t.pnl, 0)
s.server = { lastRun: now - 5 * 60_000, lastBars: {}, picks: [], failed: [] }
const k = kpis(s, now)
assert.equal(k.winRate, 33)
assert.equal(k.pf, 0.33)

const leaders = { generated: new Date(now - 10 * 3_600_000).toISOString(), universe: 1771, leaders: [] }
const checks = systemCheck({ s, now, factory: null, leaders, leads: null, fixAt: 0 })
const by = (x: string) => checks.find((c) => c.id === x)!
assert.equal(by('cycle').level, 'ok')
assert.equal(by('leaders').level, 'ok')
assert.equal(by('pf').level, 'bad')
assert.equal(by('learn').level, 'bad')
assert.equal(by('promote').level, 'off')
assert.ok(by('pf').prompt?.includes('PUBLIC'), 'every prompt carries the standing rules')
// red first, and the verdict says the machine runs but results lag
const t = todos(checks)
assert.equal(t[0].level, 'bad')
assert.equal(headline(checks).level, 'warn')

// a stalled cycle in market hours is red and makes the verdict "broken"
const stalled = { ...s, server: { ...s.server, lastRun: now - 2 * 3_600_000 } }
const c2 = systemCheck({ s: stalled, now, factory: null, leaders, leads: null })
assert.equal(c2.find((c) => c.id === 'cycle')!.level, 'bad')
assert.equal(headline(c2).level, 'bad')

// a trusted factory slot asks to be promoted
const factory = { generated: leaders.generated, slots: [{ key: 'a', graded: 25, wins: 15, winRate: 60, avgPct: 0.4, waiting: 2, status: 'working' }, { key: 'b', graded: 5, wins: 2, winRate: 40, avgPct: -0.1, waiting: 3, status: 'testing' }] } as never
const c3 = systemCheck({ s, now, factory, leaders, leads: null })
assert.equal(c3.find((c) => c.id === 'grade')!.level, 'warn')
const lb = learners({ s, now, factory, leaders, leads: null })
assert.equal(lb[0].verdict, 'pass')
assert.equal(lb.at(-1)!.verdict, 'advisor')
assert.equal(steps({ s, now, factory, leaders, leads: null }, c3).length, 6)

// prompts and repo ideas
assert.match(taskPrompt({ goal: 'G', evidence: ['e'], scope: ['s'], done: 'd' }), /1\. Goal[\s\S]*5\. Done when/)
assert.ok(UPGRADES.every((u) => u.prompt.length < 4000 && u.benefit >= 1 && u.benefit <= 3))
assert.equal(stepFor('a fast stock screener'), 1)
assert.equal(stepFor('event-driven backtesting library'), 5)
assert.equal(repoUpgrade({ name: 'x/y', url: 'https://github.com/x/y', stars: 9000, desc: 'screener', pushed: '2026-11-01T00:00:00Z' }).step, 1)
console.log('atlascontrol: ok')

// the Leaders tight-base paper slot joins the leaderboard and the grading light
const paper = { score: { graded: 22, winRate: 59, avgPct: 0.8, status: 'working' }, watching: [1, 2] }
const c4 = systemCheck({ s, now, factory: null, leaders, leads: null, paper })
assert.equal(c4.find((c) => c.id === 'grade')!.level, 'warn')
assert.equal(learners({ s, now, factory: null, leaders, leads: null, paper })[0].id, 'leaders-paper')
console.log('atlascontrol paper: ok')

// after a shipped fix the learning and PF lights wait for 30 new trades (grey, no "Do this"), then judge only those
{
  const fixAt = now - 5 * 3_600_000 // 5 of the 30 losing-book trades closed after the fix
  const w = systemCheck({ s, now, factory: null, leaders, leads: null, fixAt })
  for (const id of ['learn', 'pf']) {
    const c = w.find((x) => x.id === id)!
    assert.equal(c.level, 'off')
    assert.equal(c.prompt, null)
    assert.match(c.status.vi, /chờ 5\/30 lệnh mới/)
  }
  assert.ok(!todos(w).some((c) => c.id === 'learn' || c.id === 'pf'), 'waiting lights are not on the to-do list')
  // 30 new trades: judged again, on the new trades only
  const after = systemCheck({ s, now, factory: null, leaders, leads: null, fixAt: 0 })
  assert.equal(after.find((x) => x.id === 'pf')!.level, 'bad')
  assert.match(after.find((x) => x.id === 'pf')!.prompt!, /already live/)
  // a queued task is matched by its cut title
  assert.ok(after.find((x) => x.id === 'pf')!.prompt!.includes(taskGoal('Atlas task: Find why Atlas losing trades are bigger than winners (PF under 1)…')))
}
console.log('atlascontrol fix-wait ok')

// several picked upgrades go as ONE task, with the rules once and under the 4,000-character issue limit
{
  const many = [...UPGRADES, ...UPGRADES].map((u, i) => ({ ...u, id: `${u.id}-${i}` }))
  const b = batchPrompt(many)
  assert.ok(b.length <= 4000)
  assert.ok(b.startsWith(`Atlas task: Do ${MAX_BATCH} upgrades together`))
  assert.equal(b.split('PUBLIC').length - 1, 1, 'rules appear once')
  assert.ok(UPGRADES.slice(0, 2).every((u) => b.includes(u.goal)))
}
console.log('atlascontrol batch ok')
