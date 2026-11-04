import assert from 'node:assert/strict'
import { dayKey, emptyPractice, kindOf, lessons, onBarClose, onBars, onPrice, practiceEquity, practiceReport, sessionEnd, type EntryContext, nextBaseline, scoreboardNumbers, parsePractice } from '../src/lib/practice'
import { atrPercent, qualityBlock } from '../src/lib/practiceQuality'
import { practiceRows } from '../src/lib/practiceRows'
import type { Analysis } from '../src/types'

const buy = { verdict: 'BUY', score: 0.6, headline: 'Trend up', tradeScore: { score: 70, grade: 'B', regime: 'normal' }, exitPlan: { entry: 100, stop: 95, target: 110 }, plan: null } as unknown as Analysis
const sell = { ...buy, verdict: 'SELL' } as Analysis
const ctx = (over: Partial<EntryContext> = {}): EntryContext => ({
  symbol: 'AAPL', tf: '1h', price: 100, barTime: 1000, analysis: buy, learner: 'HOLD', asset: 'stock', dayOn: true, dayTrades: 4, longOn: false, longTrades: 1, holdDays: 5, sizePct: 2, gatesOn: true, maxDrawdownPct: 10, maxTradesPerDay: 5, killSwitch: false, now: Date.UTC(2026, 9, 9, 15), ...over,
})

// enters small on an AI BUY with the plan's stop and target
let s = onBarClose(emptyPractice(), ctx())
assert.equal(s.open.length, 1)
// sized by risk: a 5% stop risks 0.05% of $100,000 = $50, so the position is $1,000 (1% of the account)
assert.ok(Math.abs(s.open[0].qty * 100 - 1000) < 1e-9, 'risk $50 at a 5% stop')
assert.ok(Math.abs(s.open[0].qty * (100 - s.open[0].stop) - 50) < 1e-9)
assert.equal(s.events[0].kind, 'buy')
// no second entry on the same market while one is open
assert.equal(onBarClose(s, ctx({ barTime: 2000 })).open.length, 1)
// target hit on a live price
assert.equal(onPrice(s, 'AAPL', 105, 1000, 0), null)
const won = onPrice(s, 'AAPL', 110, 1100, 1)!
assert.equal(won.trades[0].exitReason, 'target')
assert.ok(won.trades[0].pnl > 0 && practiceEquity(won) > 100_000)
// stop hit
const lost = onPrice(s, 'AAPL', 94, 1100, 1)!
assert.equal(lost.trades[0].exitReason, 'stop')
assert.ok(lost.trades[0].pnl < 0)
// SELL call closes it
assert.equal(onBarClose(s, ctx({ analysis: sell, barTime: 2000 })).trades[0].exitReason, 'signal')
// the kill switch skips instead of buying
const k = onBarClose(emptyPractice(), ctx({ killSwitch: true }))
assert.equal(k.open.length, 0)
assert.equal(k.events[0].kind, 'skip')
// no valid stop: skip
assert.equal(onBarClose(emptyPractice(), ctx({ analysis: { ...buy, exitPlan: { entry: 100, stop: 101, target: 110 } } as Analysis })).open.length, 0)
// report and honest lesson
const r = practiceReport(won)
assert.equal(r.n, 1)
assert.equal(r.winRate, 1)
assert.match(lessons(won)[0].en, /mostly luck/)

// market clock: 4:00 pm ET less 5 minutes (EDT in October = 20:00 UTC)
const t0 = Date.UTC(2026, 9, 9, 15)
assert.equal(sessionEnd('stock', t0), Date.UTC(2026, 9, 9, 19, 55))
assert.equal(sessionEnd('crypto', t0), Date.UTC(2026, 9, 10, 3, 55))
assert.equal(dayKey(Date.UTC(2026, 9, 10, 2)), '2026-10-09', '10 pm ET is still the 9th')
// a day trade is closed before market close even with no stop or target hit
const closed = onPrice(s, 'AAPL', 101, 1500, Date.UTC(2026, 9, 9, 19, 56))!
assert.equal(closed.trades[0].exitReason, 'close')
// no new day trade in the last 15 minutes
assert.equal(onBarClose(emptyPractice(), ctx({ now: Date.UTC(2026, 9, 9, 19, 45) })).open.length, 0)

// daily quotas: first BUY is the long-term trade, then up to N day trades, then nothing
const both = (over: Partial<EntryContext>) => ctx({ longOn: true, dayTrades: 3, ...over })
let q = emptyPractice()
const syms = ['AAPL', 'SPY', 'AMZN', 'NVDA', 'MSFT', 'TSLA']
syms.forEach((symbol, i) => (q = onBarClose(q, both({ symbol, barTime: 1000 + i, now: t0 + i * 60_000 }))))
assert.deepEqual(q.open.map((p) => kindOf(p)), ['long', 'day', 'day', 'day'])
const long = q.open[0]
assert.ok(Math.abs(long.stop - 90) < 1e-9 && Math.abs(long.target - 120) < 1e-9, 'long-term stop/target 2x wider')
assert.equal(long.closeBy, t0 + 5 * 86_400_000)
// long-term ignores SELL calls and bar limits, and is closed when the holding period ends
assert.equal(onBarClose(q, both({ analysis: sell, barTime: 3000 })).open.filter((p) => kindOf(p) === 'long').length, 1)
const held = onPrice(q, 'AAPL', 105, 9000, t0 + 5 * 86_400_000 + 1)!
assert.equal(held.trades.find((t) => kindOf(t) === 'long')!.exitReason, 'hold')
// the next day the quotas reset
const next = onBarClose(q, both({ symbol: 'META', now: t0 + 86_400_000 }))
assert.equal(kindOf(next.open[next.open.length - 1]), 'long')
// reports per kind
assert.equal(practiceReport(held, 'long').n, 1)
assert.equal(practiceReport(held, 'day').n, 0)
// server exits between runs: a bar's low reaching the stop closes at the stop price, not the bar close
const ob = onBars(s, 'AAPL', [{ time: 1000, open: 100, high: 100, low: 90, close: 90, volume: 1 }, { time: 1900, open: 100, high: 103, low: 99, close: 101, volume: 1 }], 5)
assert.equal(ob, null, 'the entry bar and bars that miss both levels change nothing')
const hit = onBars(s, 'AAPL', [{ time: 1900, open: 100, high: 111, low: 94, close: 105, volume: 1 }], 5)!
assert.equal(hit.trades[0].exitReason, 'stop', 'stop first when one bar reaches both')
assert.equal(hit.trades[0].exit, 95)
assert.equal(onBars(s, 'AAPL', [{ time: 1900, open: 100, high: 111, low: 99, close: 105, volume: 1 }], 5)!.trades[0].exit, 110)
assert.equal(onBars(s, 'AAPL', [{ time: 1900, open: 92, high: 93, low: 90, close: 91, volume: 1 }], 5)!.trades[0].exit, 92, 'a gap below the stop fills at the open')
// a server dayEnd closes crypto day trades with the stock market
assert.equal(onBarClose(emptyPractice(), ctx({ asset: 'crypto', dayEnd: Date.UTC(2026, 9, 9, 19, 55) })).open[0].closeBy, Date.UTC(2026, 9, 9, 19, 55))
// practice trades show up in the bottom panel's Positions, Open orders and History rows
const fresh = onBarClose(emptyPractice(), ctx())
const rows = practiceRows({ ...won, open: fresh.open }, () => 104)
assert.equal(rows.positions.length, 1)
assert.equal(rows.positions[0].last, 104)
assert.ok(rows.positions[0].unrealized > 0 && rows.positions[0].tag.startsWith('Practice'))
assert.deepEqual(rows.working.map((o) => o.legLabel), ['Take profit', 'Stop loss'])
assert.equal(rows.history.filter((o) => o.side === 'sell').length, 1, 'the closed trade is a sell fill')
assert.equal(rows.history.filter((o) => o.side === 'buy').length, 2, 'a buy fill for the closed and the open trade')
assert.equal(practiceRows(fresh, () => 0).positions[0].last, fresh.open[0].entry, 'no price yet: last falls back to the entry')
// each row tells the trade's story: status, buy, why, exit plan, and the result once closed
const keys = (d: { k: string }[]) => d.map((l) => l.k)
assert.ok(['Status', 'Bought', 'Why', 'Sell if', 'Now'].every((k) => keys(rows.positions[0].detail).includes(k)))
const closedRow = rows.history.find((o) => o.side === 'sell')!
assert.equal(closedRow.practiceStatus, 'closed')
assert.ok(['Sold', 'Why sold', 'Result', 'How it decided', 'Skills used'].every((k) => keys(closedRow.detail).includes(k)))
// an old trade saved without the newer fields says so instead of guessing
const old = { ...won.trades[0], info: { ...won.trades[0].info, data: undefined, skills: undefined }, review: undefined }
const oldRow = practiceRows({ ...won, trades: [old], audit: [] }, () => 0).history[0]
for (const k of ['Data', 'Skills used', 'Checks passed', 'Review']) assert.match(oldRow.detail.find((l) => l.k === k)!.v, /not recorded/)
assert.ok(rows.positions[0].detail.find((l) => l.k === 'Checks passed'), 'checks passed come from the decision log')
// today's blocked buys show in History as Blocked; "slots used" notes don't
const blockedState = onBarClose(emptyPractice(), ctx({ killSwitch: true }))
const blockedRows = practiceRows(blockedState, () => 0, Date.UTC(2026, 9, 9, 15)).history
assert.equal(blockedRows.length, 1)
assert.equal(blockedRows[0].practiceStatus, 'blocked')
assert.equal(practiceRows(blockedState, () => 0, Date.UTC(2026, 9, 12, 15)).history.length, 0, 'only today')
// unlimited: day trades aren't capped per day (the 4-trade setting and the orders-per-day gate are lifted)
let u = emptyPractice()
for (const sym of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']) u = onBarClose(u, ctx({ symbol: sym, unlimited: true }))
assert.equal(u.open.length, 7)
let capped = emptyPractice()
for (const sym of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']) capped = onBarClose(capped, ctx({ symbol: sym }))
assert.equal(capped.open.length, 4, 'off: the daily cap still applies')
// daily loss limit: once today's closed trades lost 2% of the account, no new buys today
const lossDay = { ...emptyPractice(), realized: -2500, trades: [{ ...won.trades[0], pnl: -2500, closedAt: Date.UTC(2026, 9, 9, 14) }] }
const stopped = onBarClose(lossDay, ctx({ symbol: 'ZZ', unlimited: true, dayLossLimitPct: 2 }))
assert.equal(stopped.open.length, 0)
assert.equal(stopped.audit?.[0].blockedBy, 'Daily loss limit')
assert.equal(onBarClose(lossDay, ctx({ symbol: 'ZZ', unlimited: true, dayLossLimitPct: 2, now: Date.UTC(2026, 9, 12, 15) })).open.length, 1, 'a new day trades again')
assert.equal(onBarClose(lossDay, ctx({ symbol: 'ZZ', unlimited: true, dayLossLimitPct: 5 })).open.length, 1, 'under the limit')
// penny stocks: off skips; on needs $1+, enough dollar volume, then half size and 5x spread/slippage
const pennyBuy = { ...buy, exitPlan: { entry: 3, stop: 2.85, target: 3.3 } } as unknown as Analysis
const pctx = (over: Partial<EntryContext> = {}) => ctx({ symbol: 'PNY', price: 3, analysis: pennyBuy, costs: { feeBps: 1, spreadBps: 4, slippageBps: 2 }, ...over })
assert.equal(onBarClose(emptyPractice(), pctx()).audit?.[0].blockedBy, 'Penny stock', 'off by default in the context')
assert.equal(onBarClose(emptyPractice(), pctx({ pennyOn: true, dollarVol: 50_000 })).open.length, 0, 'too thin')
assert.equal(onBarClose(emptyPractice(), pctx({ pennyOn: true, dollarVol: 500_000, price: 0.8, analysis: { ...buy, exitPlan: { entry: 0.8, stop: 0.75, target: 0.9 } } as unknown as Analysis })).open.length, 0, 'under $1')
const pen = onBarClose(emptyPractice(), pctx({ pennyOn: true, dollarVol: 500_000 })).open[0]
assert.ok(pen.info.penny)
assert.ok(Math.abs(pen.qty * 3 - 500) < 20, 'penny: half of the risk-sized $1,000')
assert.equal(pen.cost?.spreadBps, 20)
assert.equal(pen.cost?.slippageBps, 10)
const reg = onBarClose(emptyPractice(), ctx({ costs: { feeBps: 1, spreadBps: 4, slippageBps: 2 } })).open[0]
assert.ok(!reg.info.penny && reg.cost?.spreadBps === 4, 'regular stocks keep normal costs')
// scoreboard: open P&L from live or server prices, and the account against buy-and-hold SPY
const bar = (t: number, close: number) => ({ time: t, open: close, high: close, low: close, close, volume: 1 })
const tb = Date.UTC(2026, 9, 16, 14) / 1000
const base = nextBaseline(undefined, 'SPY', [bar(tb - 900, 500), bar(tb, 502), bar(tb + 900, 505)], tb * 1000 + 60_000)!
assert.equal(base.start, 502, 'starts at the bar the account started in')
assert.equal(base.last, 505)
assert.equal(nextBaseline(base, 'SPY', [bar(tb + 1800, 510)], 0)!.start, 502, 'the start price never moves')
assert.equal(nextBaseline(base, 'SPY', [], 0), base, 'no bars keeps it as it was')
const openSt = { ...emptyPractice(), realized: 50, open: [{ ...reg, symbol: 'AAA', entry: 10, qty: 10 }, { ...reg, symbol: 'BBB', entry: 20, qty: 5 }], baseline: { ...base, start: 500, last: 505 }, server: { lastRun: 0, lastBars: {}, picks: [], failed: [], prices: { AAA: 12 } } }
const sbn = scoreboardNumbers(openSt, (s) => (s === 'BBB' ? 18 : 0))
assert.equal(sbn.unrealized, 20 - 10, 'AAA +$20 from the server price, BBB -$10 from the live price')
assert.equal(sbn.priced, 2)
assert.ok(Math.abs(sbn.jarvisPct - 0.06) < 1e-9, '$60 on $100,000')
assert.ok(Math.abs(sbn.basePct! - 1) < 1e-9, 'SPY +1%')
assert.ok(Math.abs(sbn.edgePct! + 0.94) < 1e-9, 'Jarvis 0.94 points behind')
const noBase = scoreboardNumbers({ ...openSt, baseline: undefined, server: undefined })
assert.equal(noBase.priced, 0, 'no prices: open P&L left out, not guessed')
assert.equal(noBase.edgePct, null)
// ---- v2.0.8: size by risk, entry quality gate ----
// a tight stop and a wide stop lose about the same dollars: a $760 fund (0.5% stop) and a $10 stock (2% stop)
const planAt = (price: number, stopPct: number) => ({ ...buy, exitPlan: { entry: price, stop: price * (1 - stopPct / 100), target: price * (1 + (stopPct * 2) / 100) } }) as unknown as Analysis
const tight = onBarClose(emptyPractice(), ctx({ price: 760, analysis: planAt(760, 0.5) })).open[0]
const wide = onBarClose(emptyPractice(), ctx({ price: 10, analysis: planAt(10, 2) })).open[0]
assert.ok(Math.abs(tight.qty * (760 - tight.stop) - 50) < 1e-6 || tight.qty * 760 <= 5000 + 1e-6, 'tight stop: risk $50 or capped at 5% of the account')
assert.ok(Math.abs(wide.qty * (10 - wide.stop) - 50) < 1e-6, 'wide stop: risk $50')
assert.ok(tight.qty * 760 <= 5000 + 1e-6, 'never more than 2.5x the flat 2% size')
const mid = onBarClose(emptyPractice(), ctx({ price: 50, analysis: planAt(50, 1) })).open[0]
assert.ok(Math.abs(mid.qty * (50 - mid.stop) - 50) < 1e-6 && Math.abs(mid.qty * 50 - 5000) < 1e-6, '1% stop: $5,000 position risks $50')
// a stop closer than 0.4% is noise: no entry, and the log says why
const noisy = onBarClose(emptyPractice(), ctx({ price: 100, analysis: planAt(100, 0.3) }))
assert.equal(noisy.open.length, 0)
assert.equal(noisy.audit?.[0].blockedBy, 'Stop too tight')
// the quality gate blocks the entry and names the check
const gated = onBarClose(emptyPractice(), ctx({ qualityBlock: { check: 'Volume', en: 'x', vi: 'y' } }))
assert.equal(gated.open.length, 0)
assert.equal(gated.audit?.[0].blockedBy, 'Volume')
// Kelly/brake multipliers still scale the risk-sized position
const half = onBarClose(emptyPractice(), ctx({ price: 50, analysis: planAt(50, 1), kellyMultiplier: 0.5 })).open[0]
assert.ok(Math.abs(half.qty * 50 - 2500) < 1e-6)

const good = { asset: 'stock' as const, price: 50, dollarVol: 2_000_000, volVsAvg: 1.5, atrPct: 0.6 }
assert.equal(qualityBlock(good), null)
assert.equal(qualityBlock({ ...good, price: 3 })?.check, 'Penny stock')
assert.equal(qualityBlock({ ...good, marketCap: 80_000_000 })?.check, 'Company size')
assert.equal(qualityBlock({ ...good, marketCap: null }), null, 'unknown market cap passes')
assert.equal(qualityBlock({ ...good, dollarVol: 200_000 })?.check, 'Liquidity')
assert.equal(qualityBlock({ ...good, volVsAvg: 0.5 })?.check, 'Volume', 'MHK was bought at 0.5x volume')
assert.equal(qualityBlock({ ...good, volVsAvg: null })?.check, 'Volume')
assert.equal(qualityBlock({ ...good, atrPct: 0.1 })?.check, 'Flat chart')
assert.equal(qualityBlock({ asset: 'crypto', price: 0.5, dollarVol: null, volVsAvg: 1.2, atrPct: 0.8 }), null, 'crypto skips the stock-only checks')
const flatBars = Array.from({ length: 30 }, (_, i) => ({ time: i * 900, open: 100, high: 100.1, low: 99.9, close: 100, volume: 1000 }))
assert.ok(Math.abs(atrPercent(flatBars)! - 0.2) < 1e-9)
assert.equal(atrPercent(flatBars.slice(0, 10)), null)

console.log('practice tests passed')

// v2.0.11: an old $10k-scale state is lifted once to the $100k scale
{
  const old = { ...emptyPractice(), peak: 10_100, curve: [{ t: 1, equity: 10_000 }, { t: 2, equity: 9_921 }] }
  const lifted = parsePractice(old)!
  assert.equal(lifted.peak, 100_100)
  assert.deepEqual(lifted.curve.map((c) => c.equity), [100_000, 99_921])
  assert.deepEqual(parsePractice(lifted)!.curve.map((c) => c.equity), [100_000, 99_921], 'idempotent')
}
