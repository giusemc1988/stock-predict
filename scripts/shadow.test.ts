import assert from 'node:assert/strict'
import { SHADOW_KRONOS_PCT, shadowReport, shadowTag, tagOf } from '../src/lib/shadowFilters'
import { summaryText } from '../src/lib/telegramText'
import { scanCycle } from '../src/lib/practiceScan'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { emptyPractice } from '../src/lib/practice'

// rule 1: volume below 1x normal is skipped; unknown volume is not
assert.equal(shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 0.4 }).pass, false)
assert.equal(shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 1 }).pass, true)
assert.equal(shadowTag({ kind: 'day', source: 'gainer', volVsAvg: null }).pass, true)
// rule 2: watchlist day trades are skipped, watchlist long trades are not
assert.equal(shadowTag({ kind: 'day', source: 'watchlist', volVsAvg: 3 }).srcOk, false)
assert.equal(shadowTag({ kind: 'long', source: 'watchlist', volVsAvg: 3 }).pass, true)

// rule 4: Kronos objects to a 5-day forecast drop of 1% or more; no forecast is n/a; it never changes `pass`
assert.equal(SHADOW_KRONOS_PCT, -1)
assert.equal(shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 2, kronosPct: -3 }).kronos, 'against')
assert.equal(shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 2, kronosPct: -3 }).pass, true)
assert.equal(shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 2, kronosPct: -0.4 }).kronos, 'ok')
assert.equal(shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 2 }).kronos, 'n/a')

const info = (pick: { source: string; volVsAvg: number | null }, shadow?: ReturnType<typeof shadowTag>) =>
  ({ verdict: 'BUY', score: 0, grade: null, tradeScore: null, regime: null, learner: 'n/a', reason: '', pick: { place: 1, of: 1, gainPct: 0, en: '', vi: '', ...pick }, ...(shadow ? { shadow } : {}) }) as never
const trades = [
  { pnl: 5, kind: 'day' as const, info: info({ source: 'gainer', volVsAvg: 2.5 }) },
  { pnl: -3, kind: 'day' as const, info: info({ source: 'gainer', volVsAvg: 0.3 }) },
  { pnl: -2, kind: 'day' as const, info: info({ source: 'watchlist', volVsAvg: 1.5 }) },
  // a live-tagged trade: its own tag wins over the pick info
  { pnl: 1, kind: 'day' as const, info: info({ source: 'gainer', volVsAvg: 0.1 }, shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 1.2 }, 'HOLD')) },
]
assert.equal(tagOf(trades[3]).pass, true)
const r = shadowReport(trades)
assert.deepEqual([r.keep.n, r.keep.net, r.skip.n, r.skip.net], [2, 6, 2, -5])
assert.deepEqual([r.lowVolume.n, r.watchlistDay.n, r.live, r.learnerHold.n], [1, 1, 1, 1])
// one live-tagged trade: the verdict uses only it (kept, nothing skipped yet)
assert.match(r.vi, /^Lệnh mới \(1\): giữ 1 lệnh .*chưa có lệnh nào bị lọc/)
assert.match(shadowReport(trades.slice(0, 3)).vi, /^Lệnh cũ, chưa kiểm chứng: .*bỏ 2 lệnh .*có ích/)
assert.match(shadowReport([]).vi, /chưa có lệnh nào bị lọc/)

// the Kronos line counts live-tagged trades by objection; older trades without the field count as no forecast
const kt = (pnl: number, kronosPct: number | null) => ({ pnl, kind: 'day' as const, info: info({ source: 'gainer', volVsAvg: 2 }, shadowTag({ kind: 'day', source: 'gainer', volVsAvg: 2, kronosPct })) })
const kr = shadowReport([kt(-4, -5), kt(-2, -2), kt(3, 1), kt(1, null), trades[0]])
assert.deepEqual([kr.kronosAgainst.n, kr.kronosAgainst.net, kr.kronosOk.n, kr.kronosNone], [2, -6, 1, 1])
assert.match(kr.kronosVi, /^Kronos phản đối 2 lệnh \(thắng 0%, −\$6\.00\) · không phản đối 1 lệnh \(thắng 100%, \+\$3\.00\) · 1 lệnh chưa có dự báo$/)
assert.match(shadowReport([trades[0]]).kronosVi, /chưa có dự báo cho lệnh nào/)

// the daily Telegram summary carries the line only when given
const report = { trades: 0, opened: 0, wins: 0, net: 0, lessons: [] } as never
assert.ok(summaryText({ day: '2026-11-02', report, trades: [], equity: 1, totalRetPct: 0, learning: '', brakes: '', shadow: r.vi }).includes('🧪 Chạy bóng'))
assert.ok(summaryText({ day: '2026-11-02', report, trades: [], equity: 1, totalRetPct: 0, learning: '', brakes: '', shadowKronos: kr.kronosVi }).includes('🔮 Kronos phản đối'))
assert.ok(!summaryText({ day: '2026-11-02', report, trades: [], equity: 1, totalRetPct: 0, learning: '', brakes: '' }).includes('🧪'))
// a real scan tags the positions it opens (synthetic 15m bars; trading itself is unchanged)
const now = Date.UTC(2026, 9, 28, 15, 0)
let opened = 0, tagged = 0, against = 0
for (let seed = 1; seed < 40 && !opened; seed++) {
  let x = seed * 7919, p = 100
  const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647)
  const bars = Array.from({ length: 200 }, (_, i) => { const o = p; p = p * (1 + (rnd() - 0.47) * 0.01); return { time: Math.floor(now / 1000) - (199 - i) * 900, open: o, high: Math.max(o, p) * 1.002, low: Math.min(o, p) * 0.998, close: p, volume: 1e6 * (0.5 + rnd() * 2) } })
  const r = await scanCycle({ markets: [{ symbol: 'TEST', asset: 'stock', source: 'gainer' } as never], fetchBars: async () => bars, rules: { ...DEFAULT_AI_RULES, dataGuardOn: false }, journal: [], killSwitch: false, maxTradesPerDay: 50, lastBars: {}, now, dayEnd: now + 3 * 3600_000, sourceFor: () => 'Yahoo Finance', skills: [], kronosPct: { TEST: -3 } } as never)
  const s = r.apply(emptyPractice())
  opened += s.open.length; tagged += s.open.filter((q) => q.info.shadow).length
  against += s.open.filter((q) => q.info.shadow?.kronos === 'against').length
}
assert.ok(opened > 0, 'synthetic scan should open a position')
assert.equal(tagged, opened, 'every position a scan opens carries a shadow tag')

assert.equal(against, opened, 'a Kronos forecast of -3% marks the buy as objected')

console.log('shadow ok')
