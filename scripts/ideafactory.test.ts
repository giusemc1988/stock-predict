import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { SEEDS } from '../src/data/ideaSeeds'
import {
  FEATURES, LEVELS, MIN_VAULT_DAYS, PASS_VI, baselines, crossover, describeRule, familyOf, features, fitOf, mutate, quantileCuts, randomRule,
  ruleKey, ruleSignals, search, vaultExam, gradeSignal, latestSignals, signalScore, type Rule, type Universe,
} from '../src/lib/ideaFactory'
import { runDaily, seededRng } from '../src/lib/replayDaily'
import { duel } from '../src/lib/ideaFactoryView'
import { atr } from '../src/lib/replayStrategies'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)

// a random walk of weekday bars from 2007
const walk = (seed: number, n = 4500): Candle[] => {
  const rnd = seededRng(seed)
  const out: Candle[] = []
  let px = 50
  let t = Date.UTC(2007, 0, 2) / 1000
  while (out.length < n) {
    const d = new Date(t * 1000).getUTCDay()
    if (d !== 0 && d !== 6) {
      const o = px * (1 + (rnd() - 0.5) * 0.01)
      const c = o * (1 + (rnd() - 0.5) * 0.04)
      out.push({ time: t, open: o, high: Math.max(o, c) * (1 + rnd() * 0.01), low: Math.min(o, c) * (1 - rnd() * 0.01), close: c, volume: 1e6 * (0.5 + rnd()) })
      px = c
    }
    t += 86_400
  }
  return out
}
const dayOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)

// features use only data up to the bar's close: changing the future leaves today's features unchanged
const a = walk(1)
const spy = walk(2).map((b) => b.close)
const f1 = features(a, spy)
const cut = [...a.slice(0, 3000), ...walk(9).slice(3000)]
const f2 = features(cut, spy)
for (const k of FEATURES) for (const i of [300, 1500, 2999]) assert.ok(Object.is(f1[k][i], f2[k][i]), `${k}@${i} must not look ahead`)
assert.ok(f1.d52[2999] <= 0, 'never above the 52-week high')
assert.ok(f1.clv[2000] >= 0 && f1.clv[2000] <= 1)

// the universe
const syms = ['AAA', 'BBB', 'CCC', 'MARA']
const series = syms.map((s, k) => ({ symbol: s, bars: walk(10 + k) }))
const u: Universe = {
  series,
  mats: series.map((s) => features(s.bars, spy)),
  days: series.map((s) => s.bars.map((b) => dayOf(b.time))),
  atr: series.map((s) => atr(s.bars, 14)),
  costs: series.map(() => ({ feeBps: 0, spreadBps: 4, slippageBps: 2 })),
}
const cuts = quantileCuts(u.mats, u.days.map((d) => d.map((x) => x < '2018-01-01')))
for (const k of FEATURES) {
  assert.equal(cuts[k].length, LEVELS.length)
  for (let q = 1; q < LEVELS.length; q++) assert.ok(cuts[k][q] >= cuts[k][q - 1], `${k} cuts rise`)
}

// rule keys ignore condition order; descriptions carry real numbers in both languages
const r: Rule = { conds: [{ f: 'r5', op: '<', q: 1 }, { f: 'vol', op: '>', q: 7 }], hold: 5, stop: 2, origin: 'O29' }
assert.equal(ruleKey(r), ruleKey({ ...r, conds: [...r.conds].reverse() }))
assert.notEqual(ruleKey(r), ruleKey({ ...r, hold: 3 }))
const d = describeRule(r, cuts)
assert.match(d.vi, /^Mua ở giá mở cửa hôm sau khi giá 5 ngày dưới -?\d/)
assert.match(d.vi, /giữ 5 ngày, cắt lỗ 2 ATR\.$/)
assert.match(d.en, /hold 5 days, stop 2 ATR\.$/)
assert.equal(familyOf(r), familyOf({ ...r, hold: 20, conds: [{ f: 'vol', op: '>', q: 8 }, { f: 'r5', op: '<', q: 0 }] }))

// signals respect the window and the conditions; the entry is the next bar
const sigs = ruleSignals(u, r, cuts, '2010-01-01', '2012-01-01')
assert.ok(sigs.length > 0)
for (const s of sigs) {
  assert.ok(u.days[s.sym][s.i] >= '2010-01-01' && u.days[s.sym][s.i] < '2012-01-01')
  assert.ok(u.mats[s.sym].r5[s.i] < cuts.r5[1] && u.mats[s.sym].vol[s.i] > cuts.vol[7])
}
const tr = runDaily(series, sigs, (s) => u.costs[syms.indexOf(s)])
assert.ok(tr.every((t) => t.openedAt === series[syms.indexOf(t.symbol)].bars[sigs.find((g) => series[g.sym].symbol === t.symbol && series[g.sym].bars[g.i + 1].time * 1000 === t.openedAt)!.i + 1].time * 1000))

// mutation and crossover keep valid rules: 1-3 conditions, known features, levels in range
const rnd = seededRng(5)
for (let k = 0; k < 500; k++) {
  const x = k % 2 ? mutate(randomRule(rnd), rnd) : crossover(randomRule(rnd), randomRule(rnd), rnd)
  assert.ok(x.conds.length >= 1 && x.conds.length <= 3)
  for (const c of x.conds) assert.ok(FEATURES.includes(c.f) && c.q >= 0 && c.q < LEVELS.length)
}
assert.equal(mutate({ ...r }, seededRng(1)).origin, 'O29', 'children keep their family')

// every seed is valid and has its "why" in both languages
assert.equal(new Set(SEEDS.map((s) => s.id)).size, SEEDS.length)
for (const s of SEEDS) {
  assert.ok(s.why.vi.length > 10 && s.why.en.length > 10, s.id)
  for (const c of s.rule.conds) assert.ok(FEATURES.includes(c.f) && c.q >= 0 && c.q < LEVELS.length, s.id)
}

// the search counts each distinct rule once, and a fitness function is called once per distinct rule
let calls = 0
const base = baselines(u, '2008-01-01', '2018-01-01')
const out = search(SEEDS.slice(0, 10).map((s) => ({ ...s.rule, origin: s.id })), (x) => {
  calls++
  return fitOf(u, runDaily(series, ruleSignals(u, x, cuts, '2008-01-01', '2018-01-01'), (s) => u.costs[syms.indexOf(s)]), base, x.hold, ['2011-01-01', '2014-07-01'])
}, 3, 2, 20, 5)
assert.equal(calls, out.all.size)
assert.ok(out.all.size >= 20)
assert.ok(out.best[0].fit.fitness >= out.best[out.best.length - 1].fit.fitness)

// on a random walk nothing should pass the vault
const v = vaultExam(u, r, cuts, '2020-01-01', 1000, new Set(['MARA']), 40)
assert.equal(v.passed, false)
assert.ok(v.days <= v.n)
assert.ok(MIN_VAULT_DAYS >= 30)
assert.match(PASS_VI(999), /999 lần thử/)

// grading: a logged signal waits until its hold has passed, then gets a net return; the duel compares win rates
const bars0 = series[0].bars
const day0 = u.days[0][3000]
const sg = { day: day0, symbol: 'AAA', key: 'k', close: bars0[3000].close, sl: null, hold: 5, vi: 'x', en: 'x' }
const g = gradeSignal(sg, bars0, u.days[0], u.costs[0])
assert.ok(g.retPct != null && g.exitDay! > day0)
near(g.retPct!, Math.round(((bars0[3005].close * (1 - 0.0004)) / (bars0[3001].open * 1.0004) - 1) * 100000) / 1000, 0.002)
assert.equal(gradeSignal({ ...sg, day: u.days[0][bars0.length - 2] }, bars0, u.days[0], u.costs[0]).retPct, undefined, 'not enough bars yet')
const sc = signalScore([g, { ...sg, retPct: -1 }, { ...sg, retPct: 2 }, sg])
assert.deepEqual([sc.graded, sc.wins, sc.waiting], [3, g.retPct! > 0 ? 2 : 1, 1])
const lat = latestSignals(u, [{ conds: [{ f: 'clv', op: '>', q: 0 }], hold: 3, stop: 2, origin: 'O1' }], cuts)
for (const x of lat) assert.ok(x.day === u.days[syms.indexOf(x.symbol)].at(-1) && x.sl! < x.close)
const trades = [1, -1, 2, 3].map((pnl) => ({ pnl })) as never
const dd = duel(trades, { score: { graded: 10, wins: 8, winRate: 80, avgPct: 1, waiting: 0 }, rules: [{ vault: { n: 100, winRate: 60 } }, { vault: { n: 300, winRate: 40 } }] } as never)
assert.equal(dd.book.winRate, 75)
assert.equal(dd.winner, 'opus')
assert.equal(dd.trusted, false, 'needs DUEL_MIN graded signals')
assert.deepEqual(dd.vault, { n: 400, winRate: 45 })
assert.equal(duel(trades, null).winner, null)

console.log('ideafactory: ok')

// strategy slots (v2.0.11)
{
  const { pickSlotRules, SIGNAL_SLOTS, slotBoard } = await import('../src/lib/ideaFactory')
  const mk = (origin: string, hold: number, n: number) => ({ conds: [{ f: 'r5', op: '<' as const, q: n }], hold, stop: null, origin })
  const pool = [mk('A', 3, 1), mk('A', 3, 1), mk('A', 3, 2), mk('A', 3, 3), mk('B', 20, 1), mk('B', 2, 4), ...Array.from({ length: 20 }, (_, i) => mk(`F${i}`, 1, 10 + i))]
  const out = pickSlotRules(pool as never[], 5)
  assert.equal(out.length, SIGNAL_SLOTS)
  assert.equal(out.filter((r) => r.origin === 'A').length, 2)
  assert.equal(out.some((r) => r.hold > 5), false)
  const sg = (key: string, retPct: number | undefined) => ({ day: 'd', symbol: 'X', key, close: 1, sl: null, hold: 1, vi: '', en: '', retPct })
  const good = Array.from({ length: 20 }, (_, i) => sg('g', i < 13 ? 1 : -0.5))
  const bad = Array.from({ length: 20 }, (_, i) => sg('b', i < 5 ? 1 : -1))
  const b = Object.fromEntries(slotBoard([...good, ...bad, sg('f', 1), sg('f', undefined)]).map((r) => [r.key, r.status]))
  assert.deepEqual(b, { g: 'working', b: 'failing', f: 'testing' })
  console.log('slots ok')
}
