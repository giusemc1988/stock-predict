/**
 * Atlas lab, round 3: day-trading experiments (opening-range breakout, intraday momentum, overnight vs intraday).
 * Signals and costs are in src/lib/replayIntraday.ts; this script fetches the bars and writes the JSON.
 *
 * Data: Yahoo 5m/60d and 60m/730d (free, regular session only). If ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY are
 * both set, the 5-minute bars come from Alpaca Market Data v2 (feed=iex, from 2018) instead. Keys are never printed.
 * The date split is the same as the other labs: first 2/3 of days = book, last 1/3 = exam (never tuned on).
 *
 *   npm run replay:intraday                          full run, writes public/replay-intraday.json
 *   npm run replay:intraday -- --symbols 8 --out x   quick run on the first 8 markets
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { costsFrom } from '../src/lib/costs'
import { ALL_TRIALS, PASS_RULE_EN, PASS_RULE_VI, ROUND3_TRIALS, alpacaBars, i2Signals, i3AllDays, i3Winners, judge, medianDollarVolume, orbCandidates, orbTrade, pickInPlay, run, sessionDays, symbolCosts, type CostModel, type ITrade, type Sig, type SymDays } from '../src/lib/replayIntraday'
import { STOCKS } from '../src/lib/replayUniverse'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-intraday.json'
const LIMIT = Number(arg('--symbols') ?? 0)
const UA = { 'User-Agent': 'Mozilla/5.0 (atlas replay lab)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const KEY = process.env.ALPACA_API_KEY_ID
const SECRET = process.env.ALPACA_API_SECRET_KEY
const ALPACA = !!(KEY && SECRET)

async function yahoo(symbol: string, interval: string, range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const json = (await res.json()) as { chart: { result?: { timestamp?: number[]; indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] } }[] } }
      const r = json.chart.result?.[0]
      const q = r?.indicators.quote[0]
      if (!r?.timestamp || !q) return []
      const out: Candle[] = []
      r.timestamp.forEach((t, k) => {
        const [o, h, l, c, v] = [q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k]]
        if (o != null && h != null && l != null && c != null) out.push({ time: t, open: o, high: h, low: l, close: c, volume: v ?? 0 })
      })
      return out
    }
    await sleep(1000 * (i + 1))
  }
  throw new Error(`Yahoo failed for ${symbol} ${interval}`)
}

const dayCount = (syms: SymDays[]) => [...new Set(syms.flatMap((s) => s.days.map((d) => d.key)))].sort()
const examFromOf = (syms: SymDays[]) => {
  const days = dayCount(syms)
  return days[Math.floor(days.length * (2 / 3))] ?? days[days.length - 1]
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)

async function main() {
  const t0 = Date.now()
  const list = [...new Set(['SPY', 'QQQ', ...STOCKS])]
  const markets = LIMIT ? list.slice(0, LIMIT) : list
  const five: SymDays[] = []
  const sixty: SymDays[] = []
  const failed: string[] = []
  const model: CostModel = { sym: new Map(), old: costsFrom(DEFAULT_AI_RULES) }
  for (const m of markets) {
    try {
      const d60 = sessionDays(await yahoo(m, '60m', '730d'), 930)
      const b5 = ALPACA ? await alpacaBars(m, '2018-01-01', KEY!, SECRET!, (u, init) => fetch(u, init)) : await yahoo(m, '5m', '60d')
      const d5 = sessionDays(b5, 955)
      sixty.push({ symbol: m, days: d60 })
      five.push({ symbol: m, days: d5 })
      model.sym.set(m, symbolCosts(medianDollarVolume(d60))) // liquidity always from consolidated Yahoo volume
      console.log(`${m}: ${d60.length} days of 60m, ${d5.length} days of 5m`)
      await sleep(ALPACA ? 400 : 250)
    } catch (e) {
      failed.push(m)
      console.log(`${m}: failed (${e instanceof Error ? e.message : 'error'})`) // messages never contain the keys
    }
  }
  const ex5 = examFromOf(five)
  const ex60 = examFromOf(sixty)
  const pick = (s: SymDays[]) => s.filter((x) => x.symbol === 'SPY' || x.symbol === 'QQQ')

  type Item = { id: string; en: string; vi: string; examFrom: string; syms: SymDays[]; sigs: Sig[]; trades: ITrade[] }
  const items: Item[] = []
  const add = (id: string, en: string, vi: string, examFrom: string, syms: SymDays[], sigs: Sig[], trades = run(sigs)) => items.push({ id, en, vi, examFrom, syms, sigs, trades })

  const cands = orbCandidates(five)
  for (const mode of ['A', 'B'] as const) {
    for (const stop of ['bar', 'atr'] as const) {
      const tr = pickInPlay(cands, mode).flatMap((c) => orbTrade(c, stop) ?? [])
      add(`I1${mode}-${stop}`, `Opening-range breakout, stocks in play (${mode === 'A' ? 'first 5-min volume >= 2x' : 'top 20 by relative volume'}), stop ${stop === 'bar' ? 'other side of the first bar' : '10% of 14-day ATR'}, long and short, out at the close`, `Phá vỡ vùng mở cửa, cổ phiếu nóng (${mode === 'A' ? 'khối lượng 5 phút đầu >= 2x' : 'top 20 khối lượng tương đối'}), stop ${stop === 'bar' ? 'đầu bên kia của nến đầu' : '10% ATR 14 ngày'}, mua và bán khống, thoát lúc đóng cửa`, ex5, five, [], tr)
    }
  }
  for (const limit of [false, true]) {
    const lt = limit ? 'limit entry' : 'market entry'
    const ltVi = limit ? 'lệnh giới hạn' : 'lệnh thị trường'
    const k = limit ? 'lim' : 'mkt'
    add(`I2-5m-${k}`, `SPY/QQQ first half-hour -> last half-hour (5m bars, ${lt})`, `SPY/QQQ nửa giờ đầu -> nửa giờ cuối (nến 5 phút, ${ltVi})`, ex5, pick(five), i2Signals(pick(five), 600, 930, limit))
    add(`I2-60m-${k}`, `SPY/QQQ first hour -> last bar 15:30-16:00 (60m bars, 730d, ${lt})`, `SPY/QQQ giờ đầu -> nến cuối 15:30-16:00 (nến 60 phút, 730 ngày, ${ltVi})`, ex60, pick(sixty), i2Signals(pick(sixty), 630, 930, limit))
  }
  add('I3-intraday', 'Every stock, every day: buy the open, sell the close', 'Mọi cổ phiếu, mọi ngày: mua lúc mở, bán lúc đóng', ex60, sixty, i3AllDays(sixty, 'intraday'))
  add('I3-overnight', 'Every stock, every day: buy the close, sell the next open', 'Mọi cổ phiếu, mọi ngày: mua lúc đóng, bán lúc mở hôm sau', ex60, sixty, i3AllDays(sixty, 'overnight'))
  for (const hold of ['close', 'nextOpen'] as const) {
    for (const limit of [false, true]) {
      add(`I3-win-${hold === 'close' ? 'same' : 'night'}-${limit ? 'lim' : 'mkt'}`, `Winners proxy (up 3%+ on 2x volume by 15:30, 60m bars), ${limit ? 'limit' : 'market'} entry, ${hold === 'close' ? 'sold at the close' : 'held to the next open'}`, `Ước lượng cổ phiếu thắng (tăng 3%+ với khối lượng 2x lúc 15:30, nến 60 phút), ${limit ? 'lệnh giới hạn' : 'lệnh thị trường'}, ${hold === 'close' ? 'bán lúc đóng' : 'giữ đến lúc mở hôm sau'}`, ex60, sixty, i3Winners(sixty, 930, hold, limit))
    }
  }
  if (items.length !== ROUND3_TRIALS) throw new Error(`expected ${ROUND3_TRIALS} variants, got ${items.length}`)

  const results = judge(items, model)
  const won = results.filter((r) => r.pass)
  const summaryEn = won.length ? `Passed: ${won.map((r) => r.id).join(', ')}.` : 'No round-3 day-trading variant passed the exam.'
  const summaryVi = won.length ? `Qua bài thi: ${won.map((r) => r.id).join(', ')}.` : 'Không biến thể day trading nào của vòng 3 qua bài thi.'
  const out = {
    updated: new Date().toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
    markets: markets.length,
    failed,
    source: { fiveMinute: ALPACA ? 'alpaca-iex' : 'yahoo-60d', sixtyMinute: 'yahoo-730d' },
    split: { five: { examFrom: ex5, days: dayCount(five).length }, sixty: { examFrom: ex60, days: dayCount(sixty).length } },
    trials: { round12: ALL_TRIALS - ROUND3_TRIALS, round3: ROUND3_TRIALS, total: ALL_TRIALS },
    costs: {
      assumption: 'Half-spread by median daily dollar volume: >$5B 0.5 bps, $1-5B 1.5, $0.2-1B 4, below 10; slippage 1 bp per market fill; fee 0. Limit entries pay no spread or slippage. Exits are market.',
      old: model.old,
      avgNewRoundTripBps: Math.round(mean([...model.sym.values()].map((c) => c.spreadBps + 2 * c.slippageBps)) * 10) / 10,
      perSymbol: Object.fromEntries([...model.sym].map(([k, c]) => [k, { halfSpreadBps: c.spreadBps / 2, slippageBps: c.slippageBps }])),
    },
    passRule: { en: PASS_RULE_EN, vi: PASS_RULE_VI },
    results,
    summary: { en: summaryEn, vi: summaryVi },
    caveats: [
      'Yahoo 5m covers only the last 60 days (about 60 sessions, about 20 in the exam): the 5m variants are underpowered.',
      'Shorts ignore borrow fees and availability. Alpaca IEX volume is a subset of consolidated volume (ratios are scale-free; dollar-volume tiers always use Yahoo).',
      'The 60m winners proxy decides at 15:30 (the 14:30 bar closes), not 15:00. A stop in the entry bar is assumed hit when the bar range reaches it.',
    ],
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`\n${markets.length - failed.length} markets in ${out.seconds}s; 5m exam from ${ex5}, 60m exam from ${ex60}`)
  console.log(summaryEn)
  const f = (x: number) => x.toFixed(3)
  for (const r of results) console.log(`${r.pass ? 'PASS' : '    '} ${r.id.padEnd(18)} exam n=${String(r.exam.n).padStart(6)} new ${f(r.exam.avgNew)}% old ${f(r.exam.avgOld)}% 2x ${f(r.exam.avg2x)}% | excess ${f(r.control.excessNew)}% p=${r.control.pNew.toFixed(3)} DSR=${r.dsr.toFixed(2)}${r.fillRate != null ? ` fill=${(r.fillRate * 100).toFixed(0)}%` : ''}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'failed')
  process.exit(1)
})
