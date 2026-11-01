/**
 * Atlas replay lab: learn on old data, test on data the learning never saw.
 *
 * 1. Fetch Yahoo 15-minute bars (free, the last 60 days) for a fixed list of liquid US stocks and crypto.
 * 2. Replay Atlas bar by bar through the SAME code the live server runs (analyze + onBarClose / onBars /
 *    onPrice from src/lib/practice.ts, same costs, stops, targets, 12-bar time exit, close before the bell).
 *    Each market is replayed on its own (no daily slot limit), so every BUY Atlas would take is a trade.
 * 3. Split by date: the first 2/3 of days are the "book" (rules are searched there), the last 1/3 the
 *    "exam" (never looked at while searching).
 * 4. Search simple filter rules (one or two conditions) on the book; keep those that also beat
 *    "no filter" on the exam AND pass a Deflated Sharpe check for the number of rules tried.
 *
 *   npm run replay                          full run, writes public/replay-lab.json
 *   npm run replay -- --symbols 8 --out x   quick run on the first 8 markets
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { writeFileSync } from 'node:fs'
import type { Candle, OrderFlow } from '../src/types'
import { DEFAULT_AI_RULES, practiceLimits } from '../src/lib/aiRules'
import { analyze } from '../src/lib/analyst'
import { costsFrom } from '../src/lib/costs'
import { emptyPractice, onBarClose, onBars, onPrice, sessionEnd, type PracticeState, type PracticeTrade } from '../src/lib/practice'
import { dollarVolume, gainToday, volumeVsAvg } from '../src/lib/practicePicks'
import { runStrategy } from '../src/lib/strategy'
import { evalStrategies, mineRules, type ReplayTrade } from '../src/lib/replayLab'
import { STRATEGIES, type Fill, type SimTrade } from '../src/lib/replayStrategies'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-lab.json'
const LIMIT = Number(arg('--symbols') ?? 0)

/** Liquid, widely traded names across sectors, plus the crypto Atlas trades. Fixed on purpose: Yahoo keeps
 *  no history of each day's top-gainer list, so the replay cannot copy the live picker's universe. */
const STOCKS = `AAPL MSFT NVDA AMZN GOOGL META TSLA AVGO AMD NFLX ADBE CRM ORCL INTC QCOM MU TXN AMAT LRCX KLAC
PLTR SNOW SHOP UBER ABNB COIN HOOD SOFI RIVN LCID NIO PLUG MARA RIOT SMCI ARM PANW CRWD NET DDOG
JPM BAC WFC C GS MS SCHW V MA PYPL AXP
XOM CVX OXY SLB COP HAL DVN
UNH LLY JNJ PFE MRK ABBV MRNA BMY GILD AMGN
WMT COST TGT HD LOW NKE SBUX MCD DIS KO PEP
BA CAT DE GE HON LMT RTX UPS FDX F GM
T VZ TMUS CMCSA
SPY QQQ IWM`.split(/\s+/).filter(Boolean)
const CRYPTO = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'ZEC']
const MARKETS = [...STOCKS.map((s) => ({ symbol: s, asset: 'stock' as const })), ...CRYPTO.map((c) => ({ symbol: `${c}/USDT`, asset: 'crypto' as const }))]

const UA = { 'User-Agent': 'Mozilla/5.0 (atlas replay lab)' }
const yahooTicker = (symbol: string) => (symbol.includes('/') ? `${symbol.split('/')[0]}-USD` : symbol)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function yahoo15m60d(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker(symbol))}?interval=15m&range=60d`
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
  throw new Error(`Yahoo failed for ${symbol}`)
}

const NO_FLOW: OrderFlow = { bids: [], asks: [], trades: [], buyVolume: 0, sellVolume: 0, windowSec: 0, hasBook: false, estimated: true, source: 'none', live: false }
/** Live fetches range=10d of 15m bars (~260 for stocks); the replay looks back the same distance. */
const WINDOW = 260
const BAR_SEC = 15 * 60
const rules = { ...DEFAULT_AI_RULES }

/** SPY's move today up to time t, as a market-mood feature. */
function spyDayAt(spy: Candle[], t: number): number | null {
  let lo = 0
  let hi = spy.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (spy[mid].time <= t) (idx = mid), (lo = mid + 1)
    else hi = mid - 1
  }
  return idx < 1 ? null : gainToday(spy.slice(Math.max(0, idx - 40), idx + 1))
}

function replayMarket(symbol: string, asset: 'stock' | 'crypto', bars: Candle[], spy: Candle[]): { trades: ReplayTrade[]; fills: Fill[] } {
  let s: PracticeState = emptyPractice()
  const fills: Fill[] = []
  const extra = new Map<string, { spyDay: number | null }>()
  for (let i = 80; i < bars.length; i++) {
    const b = bars[i]
    const now = (b.time + BAR_SEC) * 1000 + 5_000 // the bar has just closed
    s = onBars(s, symbol, [b], now) ?? s
    s = onPrice(s, symbol, b.close, b.time, now) ?? s
    const win = bars.slice(Math.max(0, i + 1 - WINDOW), i + 1)
    const strat = runStrategy(win)
    const a = analyze(win, strat, strat.prediction, NO_FLOW, rules)
    const before = new Set(s.open.map((p) => p.id))
    s = onBarClose(s, {
      symbol,
      tf: '15m',
      price: b.close,
      barTime: b.time,
      analysis: a,
      learner: 'n/a',
      asset,
      dayOn: true,
      dayTrades: 99,
      longOn: false,
      longTrades: 0,
      holdDays: rules.practiceHoldDays,
      pick: { place: 1, of: 1, source: 'active', gainPct: gainToday(win), volVsAvg: volumeVsAvg(win), en: '', vi: '' },
      dayEnd: sessionEnd(asset, now),
      sizePct: rules.practiceSizePct,
      gatesOn: rules.gatesOn,
      maxDrawdownPct: 100,
      maxTradesPerDay: 999,
      killSwitch: false,
      now,
      hardLimitsOn: false,
      ...practiceLimits(rules),
      unlimited: true,
      dayLossLimitPct: 0,
      pennyOn: rules.practicePenny,
      dollarVol: dollarVolume(win),
      maxExposurePct: 1000,
      tfSec: BAR_SEC,
      dataGuardOn: false,
      costs: costsFrom(rules),
      audit: false,
    })
    const opened = s.open.find((p) => !before.has(p.id))
    if (opened) {
      extra.set(opened.id, { spyDay: asset === 'stock' ? spyDayAt(spy, b.time) : null })
      fills.push({ i, price: b.close, stop: opened.stop, target: opened.target })
    }
    // keep the state small: the account is per market and only the trade list matters
    if (s.events.length > 50) s.events.length = 50
  }
  return { trades: s.trades.map((t: PracticeTrade) => toReplay(t, extra.get(t.id))), fills }
}

function toReplay(t: PracticeTrade, x?: { spyDay: number | null }): ReplayTrade {
  const notional = t.qty * (t.signal ?? t.entry)
  return {
    symbol: t.symbol,
    asset: t.asset ?? 'stock',
    openedAt: t.openedAt,
    retPct: notional > 0 ? (t.pnl / notional) * 100 : 0,
    exitReason: t.exitReason,
    volVsAvg: t.info.pick?.volVsAvg ?? null,
    gainPct: t.info.pick?.gainPct ?? null,
    grade: t.info.grade,
    tradeScore: t.info.tradeScore,
    regime: t.info.regime,
    score: t.info.score,
    stopPct: ((t.entry - t.stop) / t.entry) * 100,
    spyDay: x?.spyDay ?? null,
  }
}

async function main() {
  const t0 = Date.now()
  const markets = LIMIT ? MARKETS.slice(0, LIMIT) : MARKETS
  const spy = await yahoo15m60d('SPY')
  const trades: ReplayTrade[] = []
  const runs: Record<string, SimTrade[]> = Object.fromEntries(STRATEGIES.map((x) => [x.id, [] as SimTrade[]]))
  const failed: string[] = []
  let bars = 0
  for (const m of markets) {
    try {
      const b = m.symbol === 'SPY' ? spy : await yahoo15m60d(m.symbol)
      bars += b.length
      const got = replayMarket(m.symbol, m.asset, b, spy)
      trades.push(...got.trades)
      for (const x of STRATEGIES) runs[x.id].push(...x.run({ bars: b, asset: m.asset, atlas: got.fills, costs: costsFrom(rules), dayEnd: (ms) => sessionEnd(m.asset, ms) }))
      console.log(`${m.symbol}: ${b.length} bars, ${got.trades.length} trades`)
      await sleep(250)
    } catch (e) {
      failed.push(m.symbol)
      console.log(`${m.symbol}: failed (${e instanceof Error ? e.message : e})`)
    }
  }
  const lab = mineRules(trades)
  const strategies = evalStrategies(lab.split.examFrom, trades, STRATEGIES.map((x) => ({ id: x.id, vi: x.vi, trades: runs[x.id] })))
  const won = strategies.filter((x) => x.passed)
  const strategiesVi = won.length ? `Chiến lược qua bài thi: ${won.map((x) => `${x.id} (${x.vi})`).join('; ')}.` : 'Chưa chiến lược nào qua bài thi.'
  const out = { updated: new Date().toISOString(), markets: markets.length, failed, bars, seconds: Math.round((Date.now() - t0) / 1000), ...lab, strategies, strategiesVi }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`\n${trades.length} trades from ${markets.length - failed.length} markets in ${out.seconds}s`)
  console.log(lab.vi)
  console.log(strategiesVi)
  for (const x of strategies) console.log(`${x.passed ? 'PASS' : '    '} ${x.id} ${x.vi.padEnd(52)} book n=${x.book.n} WR=${(x.book.winRate * 100).toFixed(0)}% ${x.book.avgRet.toFixed(3)}% | exam n=${x.exam.n} WR=${(x.exam.winRate * 100).toFixed(0)}% ${x.exam.avgRet.toFixed(3)}% DSR=${x.dsr.toFixed(2)}`)
  for (const r of lab.rules.slice(0, 12)) console.log(`${r.passed ? 'PASS' : '    '} ${r.name.padEnd(42)} book n=${r.book.n} ${r.book.avgRet.toFixed(3)}% | exam n=${r.exam.n} ${r.exam.avgRet.toFixed(3)}% (base ${lab.base.exam.avgRet.toFixed(3)}%) DSR=${r.dsr.toFixed(2)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
