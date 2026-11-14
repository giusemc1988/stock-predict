import assert from 'node:assert/strict'
import type { Candle } from '../src/types'
import { DEFAULT_AI_RULES, RULE_FIELDS } from '../src/lib/aiRules'
import { costsFrom, type Costs } from '../src/lib/costs'
import { dayKey, emptyPractice, onPrice, type PracticePosition, type PracticeState } from '../src/lib/practice'
import { ETF_UNIVERSE, sideCost, vixDays, vixGate } from '../src/lib/replayRound2'
import { netRetPct } from '../src/lib/replayStrategies'
import { STOCKS } from '../src/lib/replayUniverse'
import { summaryText } from '../src/lib/telegramText'
import { L4_NOTIONAL, emptyL4, l4Signals, l4Step, type DayBar } from '../src/lib/shadowLeads'
import { HIGH_VOL } from '../src/lib/replayUniverse'
import { addMonths, emptyL1, emptyLeads, etfCompact, l1Rank, l1Step, l2Candidates, l2Shadow, l2Step, l3Step, l3Weights, leadsReport, parseLeads, vixGateOpen, type EtfData, type Px } from '../src/lib/shadowLeads'
import { BATCHES, FETCH_BUDGET, runAlpacaBars, shadowGuarded, shadowStep } from '../src/worker/shadowLeads'

const costs = costsFrom(DEFAULT_AI_RULES)
assert.ok(costs, 'default rules have costs on')

// ---- switch: on by default, EN + VI label ----
assert.equal(DEFAULT_AI_RULES.shadowLeads, true)
const field = RULE_FIELDS.find((f) => f.key === 'shadowLeads')!
assert.ok(field.en.length > 10 && field.vi.length > 10 && field.en !== field.vi)

// ---- dates ----
const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10)
const isWeekday = (d: string) => ![0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay())
/** n weekdays ending on `end` (inclusive), oldest first. */
function weekdays(end: string, n: number): string[] {
  const out: string[] = []
  for (let d = end; out.length < n; d = new Date(Date.parse(d) - 86_400_000).toISOString().slice(0, 10)) if (isWeekday(d)) out.unshift(d)
  return out
}
const px = (days: string[], f: (i: number) => number): Px => days.map((d, i) => [d, f(i)])

// ---- L1: VIX gate equals the lab's E1-A gate ----
{
  const closes = Array.from({ length: 300 }, (_, i) => 15 + 8 * Math.sin(i / 7) + (i % 5))
  const bars: Candle[] = closes.map((c, i) => ({ time: Date.UTC(2025, 0, 2 + i, 15) / 1000, open: c, high: c, low: c, close: c, volume: 0 }))
  const lab = vixDays(bars)
  const gate = vixGate(lab, 'A')
  for (let i = 251; i < 300; i += 7) assert.equal(vixGateOpen(closes.slice(0, i + 1)), gate(dayKey(bars[i].time * 1000)), `gate day ${i}`)
  assert.equal(vixGateOpen(closes.slice(0, 251)), false, 'fewer than 252 closes: closed')
  const flat = Array(252).fill(20)
  assert.equal(vixGateOpen(flat), true, 'equal to the median counts (>=)')
  assert.equal(vixGateOpen([...Array(251).fill(20), 19.9]), false)
}

// ---- L1: rank has no look-ahead, bottom decile only ----
const D = '2026-11-03'
const days10 = weekdays(D, 10)
const syms = Array.from({ length: 20 }, (_, i) => `S${String(i).padStart(2, '0')}`)
// S00 fell the most over 5 days, S19 rose the most
const rankSeries = Object.fromEntries(syms.map((s, k) => [s, px(days10, (i) => 100 * (1 + (i >= 4 ? (k - 10) * 0.01 * (i - 4) : 0)))])) as Record<string, Px>
{
  const r = l1Rank(rankSeries, D)
  assert.deepEqual(r.map((x) => x.sym), ['S00', 'S01'], 'floor(20 * 10%) = 2 worst names')
  assert.ok(Math.abs(r[0].ret5 - (rankSeries.S00[9][1] / rankSeries.S00[4][1] - 1)) < 1e-12, '5-day return = close[t] / close[t-5] - 1')
  // a later bar (tomorrow) that flips every ranking must not change today's signal
  const withFuture = Object.fromEntries(syms.map((s, k) => [s, [...rankSeries[s], [nextDay(D), 100 * (1 + (k - 10) * 0.5)] as [string, number]]])) as Record<string, Px>
  assert.deepEqual(l1Rank(withFuture, D), r, 'data after the signal day is ignored')
  assert.deepEqual(l1Rank(Object.fromEntries(Object.entries(rankSeries).slice(0, 9)), D), [], 'under 10 names: no signals')
  const stale = { ...rankSeries, S00: rankSeries.S00.slice(0, 8) }
  assert.ok(!l1Rank(stale, D).some((x) => x.sym === 'S00'), 'a name without today\'s bar is not ranked')
}

// ---- L1: gate, entry at the NEXT open, exit at the close of day 5 ----
{
  const vixOpen = Array(252).fill(20).concat([25])
  const vixShut = Array(252).fill(20).concat([15])
  const a = { day: D, series: rankSeries, opens: {}, rankOk: true, costs }
  const shut = l1Step(emptyL1(), { ...a, vix: vixShut })
  assert.equal(shut.pending.length, 0, 'VIX below its median: no signals')
  assert.equal(shut.signalDays, 1)
  assert.equal(l1Step(emptyL1(), { ...a, vix: null }).signalDays, 0, 'no VIX data: no signals, not counted')
  assert.equal(l1Step(emptyL1(), { ...a, vix: vixOpen, rankOk: false }).pending.length, 0, 'partial universe: no signals')
  const s1 = l1Step(emptyL1(), { ...a, vix: vixOpen })
  assert.deepEqual(s1.pending.map((p) => p.sym), ['S00', 'S01'])
  assert.equal(s1.open.length, 0, 'never entered on the signal day itself')
  // next day: entry at that day's OPEN (not the signal close), days 1..5 of the hold
  const dEntry = nextDay(D) // 2026-11-04
  const hold = weekdays('2026-11-10', 5) // 11-04 .. 11-10
  assert.equal(hold[0], dEntry)
  const series: Record<string, Px> = { S00: [...rankSeries.S00, ...hold.map((d, i) => [d, 90 + i] as [string, number])], S01: [...rankSeries.S01, ...hold.map((d, i) => [d, 80 + i] as [string, number])] }
  const opens = { S00: [[dEntry, 88]] as Px, S01: [[dEntry, 79]] as Px }
  // the day after the signal: entered, nothing closes yet
  const s2 = l1Step(s1, { day: dEntry, series: { S00: series.S00.slice(0, 11), S01: series.S01.slice(0, 11) }, opens, vix: vixShut, rankOk: true, costs })
  assert.deepEqual(s2.open.map((p) => [p.sym, p.entry, p.entryDay]), [['S00', 88, dEntry], ['S01', 79, dEntry]])
  assert.equal(s2.pending.length, 0)
  // day 4 of the hold: still open; day 5: out at that day's close
  const day4 = hold[3]
  const upTo4 = Object.fromEntries(Object.entries(series).map(([k, v]) => [k, v.filter(([d]) => d <= day4)]))
  const s4 = l1Step(s2, { day: day4, series: upTo4, opens, vix: vixShut, rankOk: true, costs })
  assert.equal(s4.open.length, 2)
  assert.equal(s4.agg.n, 0)
  const s5 = l1Step(s4, { day: hold[4], series, opens, vix: vixShut, rankOk: true, costs })
  assert.equal(s5.open.length, 0)
  assert.equal(s5.agg.n, 2)
  const t0 = s5.trades.find((t) => t.sym === 'S00')!
  assert.equal(t0.exitDay, hold[4])
  assert.equal(t0.exit, 94, 'close of the 5th trading day (entry day is day 1)')
  const expected = netRetPct(88, 94, costs, false)
  assert.ok(Math.abs(t0.retPct - +expected.toFixed(3)) < 1e-9)
  assert.ok(Math.abs(t0.pnl - +((1000 * expected) / 100).toFixed(2)) < 1e-9, '$1,000 notional per trade')
  assert.ok(Math.abs(s5.agg.total - s5.trades.reduce((x, t) => x + t.pnl, 0)) < 1e-6)
  // re-running the same day does not trade twice
  assert.equal(l1Step(s5, { day: hold[4], series, opens, vix: vixShut, rankOk: true, costs }).agg.n, 2)
}

// ---- L2: only before-close exits up >= 1% ----
const mkTrade = (id: string, over: Record<string, unknown>) =>
  ({ id, symbol: 'AAA', qty: 10, entry: 100, entryFee: 0.1, closedAt: Date.UTC(2026, 10, 3, 20, 50), exitReason: 'close', pnl: 15, retPct: 1.5, kind: 'day', asset: 'stock', info: { pick: { gainPct: 4, volVsAvg: 2.5 } }, ...over }) as never
{
  const rows = [
    mkTrade('ok', {}),
    mkTrade('small', { retPct: 0.99 }),
    mkTrade('stop', { exitReason: 'stop' }),
    mkTrade('target', { exitReason: 'target' }),
    mkTrade('signal', { exitReason: 'signal' }),
    mkTrade('long', { kind: 'long', exitReason: 'hold' }),
    mkTrade('crypto', { asset: 'crypto', symbol: 'BTC/USDT' }),
    mkTrade('exact', { retPct: 1 }),
    mkTrade('weak', { info: { pick: { gainPct: 1, volVsAvg: 1 } } }),
    mkTrade('nopick', { info: {} }),
    mkTrade('old', { closedAt: Date.UTC(2026, 9, 1, 20, 50) }),
  ]
  assert.deepEqual(l2Candidates(rows, [], '2026-11-03').map((c) => c.id), ['ok', 'exact', 'weak', 'nopick'], 'old trades (before the lead started) are history')
  assert.deepEqual(l2Candidates(rows, ['ok'], '').map((c) => c.id).slice(0, 2), ['exact', 'weak'], 'seen trades are skipped')
  const proxy = Object.fromEntries(l2Candidates(rows, [], '2026-11-03').map((c) => [c.id, c.proxy]))
  assert.deepEqual(proxy, { ok: true, exact: true, weak: false, nopick: null }, 'lab proxy: pick up 3%+ on 2x volume')
}

// ---- L2: next-open math equals the live close() math ----
{
  const c: Costs = { feeBps: 1, spreadBps: 4, slippageBps: 2 }
  const pos: PracticePosition = { id: 'p1', symbol: 'AAA', tf: '15m', qty: 10, entry: 100.06, stop: 95, target: 110, openedAt: 1, barTime: 1, bars: 0, kind: 'day', asset: 'stock', closeBy: 100, key: 'k', signal: 100, cost: c, entryFee: 0.1, info: { verdict: 'BUY', score: 0, grade: null, tradeScore: null, regime: null, learner: 'n/a', reason: '' } }
  const st: PracticeState = { ...emptyPractice(), open: [pos] }
  const closed = onPrice(st, 'AAA', 102.3, 5, 1000)! // before-close exit at 102.3
  const t = closed.trades[0]
  assert.equal(t.exitReason, 'close')
  // had it been sold at that same price, the shadow math gives the real trade's pnl and return
  const same = l2Shadow({ qty: 10, entry: 100.06, entryFee: 0.1, cost: c }, 102.3)
  assert.equal(same.pnl, t.pnl)
  assert.ok(Math.abs(same.ret - t.retPct) < 1e-9)
  // sold at a higher next open: better by exactly the price move (plus the proportional sell fee)
  const next = l2Shadow({ qty: 10, entry: 100.06, entryFee: 0.1, cost: c }, 104)
  assert.ok(next.pnl > t.pnl)
  assert.equal(next.pnl, +(((104 * (1 - 0.0004)) - 100.06) * 10 - (0.1 + 104 * (1 - 0.0004) * 10 * 0.0001)).toFixed(2))
  assert.equal(l2Shadow({ qty: 10, entry: 100, entryFee: 0, cost: undefined }, 102).pnl, 20, 'no costs: plain price move')
}

// ---- L2: pending until the next session's bar exists; compares with what Atlas actually got ----
{
  const trade = mkTrade('t1', { pnl: 15, retPct: 1.5 })
  const s1 = l2Step(emptyLeads().l2, { day: '2026-11-03', trades: [trade], opens: {} })
  assert.equal(s1.pending.length, 1, 'closed today: its next open is tomorrow')
  assert.equal(s1.agg.n, 0)
  const s2 = l2Step(s1, { day: '2026-11-04', trades: [trade], opens: { AAA: [['2026-11-03', 101], ['2026-11-04', 103]] } })
  assert.equal(s2.pending.length, 0)
  assert.equal(s2.agg.n, 1)
  assert.equal(s2.trades[0].nextDay, '2026-11-04', 'filled at the first bar AFTER the exit day, not the exit day\'s own open')
  const want = l2Shadow({ qty: 10, entry: 100, entryFee: 0.1, cost: undefined }, 103)
  assert.equal(s2.trades[0].shadowPnl, want.pnl)
  assert.equal(s2.agg.actualTotal, 15)
  assert.equal(leadsReport({ ...emptyLeads(), l2: s2 }).l2.delta, +(want.pnl - 15).toFixed(2))
  assert.equal(l2Step(s2, { day: '2026-11-04', trades: [trade], opens: {} }).agg.n, 1, 'a trade is counted once')
  assert.equal(l2Step(s1, { day: '2026-11-12', trades: [trade], opens: {} }).pending.length, 0, 'no open after 6 days: given up, not stuck')
}

// ---- L3: skip-month signal, month-start rebalance, costs ----
{
  const m = '2026-11'
  assert.equal(addMonths(m, -2), '2026-09')
  assert.equal(addMonths(m, -13), '2025-10')
  assert.equal(addMonths('2026-01', -2), '2025-11')
  const mk = (me: Record<string, number>, last = 100): EtfData => ({ lastDay: '2026-11-03', last, me })
  // UP: month-end 2025-10 = 100, 2026-09 = 120 (12-1 return +20%) even though October crashed; DOWN is the reverse
  const etf: Record<string, EtfData> = {
    SPY: mk({ '2025-10': 100, '2026-09': 120, '2026-10': 50 }),
    QQQ: mk({ '2025-10': 100, '2026-09': 90, '2026-10': 200 }),
    IWM: mk({ '2025-10': 100, '2026-09': 100, '2026-10': 150 }),
    GLD: mk({ '2025-10': 100 }), // no 2026-09 close: no signal data, not counted in N
  }
  const w = l3Weights(etf, m)
  assert.deepEqual(w, { SPY: 1 / 3 }, 'last month is skipped; exactly flat (IWM) is not > 0; missing data is out of N')
  // the same ETFs with a different last month give the same weights
  assert.deepEqual(l3Weights({ ...etf, SPY: mk({ '2025-10': 100, '2026-09': 120, '2026-10': 1 }) }, m), w)

  // curve: first run buys, a second run in the same month does not rebalance, the next month does
  const side = sideCost(costs)
  const day1 = '2026-11-03'
  const e1 = { SPY: { ...etf.SPY, lastDay: day1, last: 100 } }
  const full: Record<string, EtfData> = { ...etf, ...e1 }
  const s1 = l3Step(null, { day: day1, etf: full, costs })!
  assert.equal(s1.rebalances, 1)
  assert.equal(s1.lastRebal, m)
  assert.deepEqual(Object.keys(s1.units), ['SPY'])
  const turn = 1 / 3 // from cash to a 1/3 SPY weight
  assert.ok(Math.abs(s1.equity - 10_000 * (1 - turn * side)) < 0.01, 'rebalance pays costs on the turnover')
  assert.ok(Math.abs(s1.spyEquity - 10_000) < 0.01 || s1.spyEquity > 9_990, 'SPY baseline starts at $10,000 less one buy')
  const day2 = '2026-11-04'
  const s2 = l3Step(s1, { day: day2, etf: { ...full, SPY: { ...full.SPY, lastDay: day2, last: 110 } }, costs })!
  assert.equal(s2.rebalances, 1, 'same month: no rebalance')
  assert.ok(s2.equity > s1.equity && s2.spyEquity > s2.equity, 'SPY up 10%: shadow holds 1/3 of it, SPY buy-and-hold holds all of it')
  assert.equal(s2.curve.length, 2)
  assert.equal(l3Step(s2, { day: day2, etf: { ...full, SPY: { ...full.SPY, lastDay: day2, last: 110 } }, costs })!.curve.length, 2, 'rerun of a day: one curve point')
  const dec = '2026-12-01'
  const s3 = l3Step(s2, { day: dec, etf: { ...full, SPY: { lastDay: dec, last: 110, me: { '2025-11': 100, '2026-10': 90 } } }, costs })!
  assert.equal(s3.rebalances, 2, 'first run of a new month rebalances')
  assert.equal(Object.keys(s3.units).length, 0, 'signal off (12-1 return negative, nothing else with data): all cash')
  assert.equal(l3Step(null, { day: day1, etf: { QQQ: etf.QQQ }, costs }), null, 'no SPY today: nothing starts')
  // etfCompact keeps complete months only
  const c = etfCompact([['2026-09-29', 1], ['2026-09-30', 2], ['2026-10-01', 3], ['2026-10-30', 4], ['2026-11-02', 5]])!
  assert.deepEqual(c.me, { '2026-09': 2, '2026-10': 4 })
  assert.equal(c.last, 5)
}

// ---- end to end through the worker step with a fake KV and fake Yahoo ----
const pxOf = (sym: string, d: string) => {
  const h = [...sym].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7)
  const idx = Math.round((Date.parse(d) - Date.parse('2024-01-01')) / 86_400_000)
  if (sym === '^VIX') return d >= '2026-11-02' ? 30 : 15
  return 40 + (h % 60) + 8 * Math.sin(idx / 9 + h)
}
const ts = (d: string) => Date.parse(`${d}T15:00:00Z`) / 1000
let fetches: string[] = []
let failAll = false
const yahoo = (today: string) => async (input: unknown): Promise<Response> => {
  const url = String(input)
  fetches.push(url)
  if (failAll) return new Response('boom', { status: 500 })
  const u = new URL(url)
  if (u.pathname.endsWith('/spark')) {
    const symbols = decodeURIComponent(u.searchParams.get('symbols')!).split(',')
    assert.ok(symbols.length <= 20, 'spark takes at most 20 symbols')
    const n = u.searchParams.get('range') === '2y' ? 520 : 22
    const ds = weekdays(today, n)
    return Response.json({ spark: { result: symbols.map((symbol) => ({ symbol, response: [{ timestamp: ds.map(ts), indicators: { quote: [{ close: ds.map((d) => pxOf(symbol, d)) }] } }] })) } })
  }
  const sym = decodeURIComponent(u.pathname.split('/').pop()!)
  const ds = weekdays(today, 5)
  return Response.json({ chart: { result: [{ timestamp: ds.map(ts), indicators: { quote: [{ open: ds.map((d) => pxOf(sym, d) * 1.01) }] } }] } })
}
class FakeKv {
  m = new Map<string, string>()
  writes: string[] = []
  async get(k: string) { return this.m.get(k) ?? null }
  async put(k: string, v: string) { this.writes.push(k); this.m.set(k, v) }
  async delete(k: string) { this.writes.push(`del:${k}`); this.m.delete(k) }
}
{
  const kv = new FakeKv()
  const closedAAA = mkTrade('live1', { symbol: 'AAA', closedAt: Date.UTC(2026, 10, 3, 20, 50), id: 'live1' })
  const live: PracticeState = { ...emptyPractice(), curve: [{ t: 1, equity: 10_000 }], trades: [closedAAA as never], realized: 15 }
  const liveJson = JSON.stringify(live)
  kv.m.set('state', liveJson)
  kv.m.set('cronLast', '{"ok":true}')
  const env = { PRACTICE: kv } as never
  const tick1 = Date.UTC(2026, 10, 3, 22, 0) // Tue 3 Nov, 17:00 ET (after DST ended)
  const tick = (ms: number) => ms + 5 * 60_000

  // before the close and with the switch off: nothing happens at all
  assert.equal(await shadowStep(env, Date.UTC(2026, 10, 3, 19, 0), DEFAULT_AI_RULES, yahoo(D)), null)
  assert.equal(await shadowStep(env, tick1, { ...DEFAULT_AI_RULES, shadowLeads: false }, yahoo(D)), null)
  assert.equal(fetches.length, 0)
  assert.equal(kv.writes.length, 0)

  // day 1: spread over ticks, never more than FETCH_BUDGET requests per tick
  let now = tick1
  let ticks = 0
  for (; ticks < 20; ticks++) {
    fetches = []
    const r = await shadowStep(env, now, DEFAULT_AI_RULES, yahoo(D))
    assert.ok(r, 'a tick has work until the day is finished')
    assert.ok(fetches.length <= FETCH_BUDGET, `tick fetched ${fetches.length}`)
    now = tick(now)
    if (r.finished) break
  }
  assert.ok(ticks >= 1 && ticks < 20, `day 1 finished in ${ticks + 1} ticks`)
  assert.equal(BATCHES.length, 7, '2 ETF/VIX batches + 5 stock batches: 7 spark requests for the whole universe')
  let leads = parseLeads(JSON.parse(kv.m.get('shadow:leads')!))!
  assert.equal(leads.doneDay, D)
  assert.ok(leads.l1.pending.length > 0, 'VIX gate open (30 vs a median of 15): shadow signals recorded')
  assert.ok(leads.l1.pending.every((p) => p.signalDay === D))
  assert.ok(leads.l3 && leads.l3.rebalances === 1, 'ETF trend core started')
  assert.equal(leads.l2.pending.length, 1, 'the live day trade closed up >= 1% is waiting for tomorrow\'s open')
  assert.equal(kv.m.has('shadow:work'), false, 'progress is cleared once the day is done')
  assert.equal(kv.m.get('state'), liveJson, 'live state untouched')

  // idempotent: another tick the same day does no fetch and no write
  fetches = []
  kv.writes = []
  assert.equal(await shadowStep(env, now, DEFAULT_AI_RULES, yahoo(D)), null)
  assert.deepEqual([fetches.length, kv.writes.length], [0, 0], 'doneDay marker: nothing more today')
  const leads1 = kv.m.get('shadow:leads')

  // day 2: entries at the next open, L2 filled at the next open
  const D2 = '2026-11-04'
  now = Date.UTC(2026, 10, 4, 22, 0)
  for (let i = 0; i < 20; i++) {
    fetches = []
    const r = await shadowStep(env, now, DEFAULT_AI_RULES, yahoo(D2))
    assert.ok(fetches.length <= FETCH_BUDGET)
    now = tick(now)
    if (r?.finished) break
  }
  leads = parseLeads(JSON.parse(kv.m.get('shadow:leads')!))!
  assert.equal(leads.doneDay, D2)
  assert.notEqual(kv.m.get('shadow:leads'), leads1)
  assert.ok(leads.l1.open.length > 0, 'yesterday\'s signals entered')
  for (const p of leads.l1.open) assert.ok(Math.abs(p.entry - pxOf(p.sym, D2) * 1.01) < 1e-9, 'entry is the next day open, not the signal close')
  assert.ok(leads.l1.open.every((p) => p.entryDay === D2 && p.signalDay === D))
  assert.equal(leads.l2.agg.n, 1)
  assert.equal(leads.l2.trades[0].nextDay, D2)
  assert.equal(leads.l3!.rebalances, 1, 'no second rebalance in the same month')

  // the live state and every non-shadow key are exactly as before: only shadow keys were ever written
  assert.equal(kv.m.get('state'), liveJson, 'live practice state deep-equal before and after')
  assert.deepEqual(JSON.parse(kv.m.get('state')!), JSON.parse(liveJson))
  assert.equal(kv.m.get('cronLast'), '{"ok":true}')
  assert.deepEqual([...new Set(kv.writes)].sort(), ['del:shadow:work', 'shadow:leads', 'shadow:work'])

  // the report
  const rep = leadsReport(leads)
  assert.equal(rep.asOf, D2)
  assert.equal(rep.vi.length, 6)
  assert.ok(rep.vi.every((l) => l.length < 120))
  assert.ok(rep.l3 && rep.l3.equity > 0 && rep.l3.spy > 0)
  const msg = summaryText({ day: D2, report: { trades: 0, opened: 0, wins: 0, net: 0, lessons: [] } as never, trades: [], equity: 1, totalRetPct: 0, learning: '', brakes: '', shadow: 'x', shadowLeads: rep.vi })
  assert.ok(msg.includes('🧪 Chạy bóng') && msg.includes('L1') && msg.includes('L2') && msg.includes('L3') && msg.includes('L4'))
  assert.ok(!summaryText({ day: D2, report: { trades: 0, opened: 0, wins: 0, net: 0, lessons: [] } as never, trades: [], equity: 1, totalRetPct: 0, learning: '', brakes: '' }).includes('L1'))
}

// ---- holiday: SPY has no bar for today -> the day is marked done, nothing recorded ----
{
  const kv = new FakeKv()
  kv.m.set('state', JSON.stringify(emptyPractice()))
  const env = { PRACTICE: kv } as never
  const r = await shadowStep(env, Date.UTC(2026, 10, 3, 22, 0), DEFAULT_AI_RULES, yahoo('2026-11-02')) // Yahoo's newest bar is yesterday
  assert.ok(r)
  let fin = r
  for (let i = 0; i < 5 && !fin.finished; i++) fin = (await shadowStep(env, Date.UTC(2026, 10, 3, 22, 5 + i), DEFAULT_AI_RULES, yahoo('2026-11-02')))!
  assert.ok(fin.finished && fin.note.includes('no session'))
  const l = parseLeads(JSON.parse(kv.m.get('shadow:leads')!))!
  assert.equal(l.doneDay, '2026-11-03')
  assert.deepEqual([l.l1.agg.n, l.l1.pending.length, l.l3], [0, 0, null])
}

// ---- errors never escape and never touch the live state ----
{
  const kv = new FakeKv()
  const liveJson = JSON.stringify(emptyPractice())
  kv.m.set('state', liveJson)
  const env = { PRACTICE: kv } as never
  const t = Date.UTC(2026, 10, 3, 22, 0)
  failAll = true
  for (let i = 0; i < 6; i++) await shadowGuarded(env, t + i * 300_000, DEFAULT_AI_RULES, yahoo(D)) // never throws
  failAll = false
  assert.equal(kv.m.get('state'), liveJson)
  // a KV that throws on the shadow key: caught, recorded, live untouched
  const bad = { PRACTICE: { get: async (k: string) => { if (k.startsWith('shadow:')) throw new Error('kv down'); return liveJson }, put: async () => {}, delete: async () => {} } } as never
  await shadowGuarded(bad, t, DEFAULT_AI_RULES, yahoo(D))
  const kv2 = new FakeKv()
  const bad2 = { PRACTICE: { get: async (k: string) => { if (k === 'shadow:leads') throw new Error('kv down'); return null }, put: (k: string, v: string) => kv2.put(k, v), delete: async () => {} } } as never
  await shadowGuarded(bad2, t, DEFAULT_AI_RULES, yahoo(D))
  const last = JSON.parse(kv2.m.get('shadowLast')!)
  assert.equal(last.ok, false)
  assert.match(last.error, /kv down/)
  // a day whose requests all fail still finishes (3 tries each) instead of looping forever
  const kv3 = new FakeKv()
  kv3.m.set('state', liveJson)
  failAll = true
  let done = false
  for (let i = 0; i < 30 && !done; i++) done = !!(await shadowStep({ PRACTICE: kv3 } as never, t + i * 300_000, DEFAULT_AI_RULES, yahoo(D)))?.finished
  failAll = false
  assert.ok(done, 'gives up after MAX_TRIES per request')
  assert.equal(kv3.m.get('state'), liveJson)
}

// ---- universe sanity: the batches cover everything exactly once ----
{
  const all = BATCHES.flatMap((b) => b.symbols)
  assert.equal(new Set(all).size, all.length)
  for (const s of [...STOCKS, ...ETF_UNIVERSE, '^VIX']) assert.ok(all.includes(s), s)
}

// ---- L4 overnight winners ----
{
  const days = Array.from({ length: 23 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
  const flatBars = (last: { c: number; v: number }): DayBar[] => days.map((d, i) => (i < days.length - 1 ? [d, 100, 100, 1000] : [d, 100, last.c, last.v]))
  const D = days[days.length - 1]
  const bars: Record<string, DayBar[]> = {
    WIN: flatBars({ c: 103, v: 2000 }), // +3% on 2x volume: signal
    LOWVOL: flatBars({ c: 104, v: 1500 }), // up, but volume only 1.5x
    SMALL: flatBars({ c: 102.9, v: 5000 }), // volume, but +2.9%
    TSLA: flatBars({ c: 110, v: 9000 }), // a high-vol name: signal, counted apart
  }
  assert.deepEqual(l4Signals(bars, D).map((x) => x.sym), ['TSLA', 'WIN'])
  assert.deepEqual(l4Signals(bars, '2026-10-22'), [], 'only the bar of the day itself')

  let s = l4Step(undefined, { day: D, bars, costs, rankOk: true })
  assert.deepEqual(s.pending.map((p) => [p.sym, p.entry, p.hv]), [['TSLA', 110, true], ['WIN', 103, false]])
  assert.equal(HIGH_VOL.has('TSLA'), true)
  assert.equal(s.signalDays, 1)
  assert.deepEqual(l4Step(s, { day: D, bars, costs, rankOk: true }).pending.length, 2, 'the same day twice adds nothing')
  assert.equal(l4Step(undefined, { day: D, bars, costs, rankOk: false }).pending.length, 0, 'thin data: no new signals')

  // next day: sold at that day's OPEN, with costs
  const D2 = '2026-10-24'
  const next = Object.fromEntries(Object.entries(bars).map(([k, b]) => [k, [...b, [D2, k === 'WIN' ? 104 : 108, 100, 1000] as DayBar]]))
  s = l4Step(s, { day: D2, bars: next, costs, rankOk: true })
  assert.equal(s.pending.length, 0)
  const win = s.trades.find((t) => t.sym === 'WIN')!
  assert.ok(Math.abs(win.retPct - +netRetPct(103, 104, costs, false).toFixed(3)) < 1e-9)
  assert.ok(Math.abs(win.pnl - (L4_NOTIONAL * win.retPct) / 100) < 0.01)
  assert.deepEqual([s.agg.n, s.core.n], [2, 1], 'the core count leaves out the high-vol name')

  // a pending buy with no next bar is kept up to 6 days, then dropped
  const stuck = { ...emptyL4(), pending: [{ sym: 'GONE', day: '2026-10-01', entry: 10, hv: false }] }
  assert.equal(l4Step(stuck, { day: '2026-10-05', bars: {}, costs, rankOk: false }).pending.length, 1)
  assert.equal(l4Step(stuck, { day: '2026-10-09', bars: {}, costs, rankOk: false }).pending.length, 0)
  assert.equal(l4Step(stuck, { day: '2026-10-09', bars: null, costs, rankOk: false }).pending.length, 1, 'no data fetched: nothing changes')

  // report line + old stored leads without l4 still parse
  const rep = leadsReport({ ...emptyLeads(), l4: s })
  assert.equal(rep.l4.n, 2)
  assert.ok(rep.vi[3].startsWith('L4 qua đêm: 2 lệnh'))
  const old = parseLeads({ v: 1, doneDay: 'x', l1: emptyL1(), l2: { since: '' }, l3: null })!
  assert.deepEqual(old.l4, emptyL4())

  // Alpaca request: one multi-symbol call, keys only in headers, bars by Eastern day, newest 30 kept
  const calls: { url: string; headers: Record<string, string> }[] = []
  const fake = (async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers })
    return Response.json({ bars: { AAA: [{ t: '2026-10-23T04:00:00Z', o: 10, c: 11, v: 5 }, { t: '2026-10-22T04:00:00Z', o: 9, c: 10, v: 4 }] }, next_page_token: null })
  }) as never
  const w = { l4bars: null } as never as { l4bars: Record<string, DayBar[]> }
  await runAlpacaBars(fake, { keyId: 'PKTEST', secret: 'SECRET' }, '2026-10-23', w as never)
  assert.equal(calls.length, 1)
  assert.ok(!calls[0].url.includes('PKTEST') && !calls[0].url.includes('SECRET'))
  assert.equal(calls[0].headers['APCA-API-KEY-ID'], 'PKTEST')
  assert.ok(calls[0].url.includes('feed=iex') && calls[0].url.includes('timeframe=1Day'))
  assert.deepEqual(w.l4bars.AAA, [['2026-10-22', 9, 10, 4], ['2026-10-23', 10, 11, 5]])
}

console.log('shadowleads ok')
