/**
 * One server practice cycle: fetch public market data, run the stock picker, apply its exits
 * and entries. Shared by the Cloudflare Worker (every 5 minutes in US market hours) and the
 * GitHub fallback script. Uses only fetch, so it runs in Node and in a Worker. Paper only.
 */
import type { Candle } from '../types'
import { INSTRUMENTS } from '../data/instruments'
import { DEFAULT_AI_RULES } from './aiRules'
import { SKILLS, skillTag } from './skills'
import type { JournalEntry } from './journal'
import { PENNY_MIN_PRICE, PENNY_PRICE, sessionEnd, type PracticeState } from './practice'
import { cryptoMovers, scanCycle, scanMarkets, withOpenMarkets, type Mover, type ScanMarket } from './practiceScan'

const UA = { 'User-Agent': 'Mozilla/5.0 (arc-analyst practice)' }

/** App symbol to Yahoo ticker: BTC/USDT -> BTC-USD, stocks unchanged. */
const yahooTicker = (symbol: string) => (symbol.includes('/') ? `${symbol.split('/')[0]}-USD` : symbol)

async function yahoo15m(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker(symbol))}?interval=15m&range=10d`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)
  const json = (await res.json()) as {
    chart: { result?: { timestamp?: number[]; indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] } }[] }
  }
  const r = json.chart.result?.[0]
  const q = r?.indicators.quote[0]
  if (!r?.timestamp || !q) throw new Error('Yahoo: no bars')
  const out: Candle[] = []
  r.timestamp.forEach((t, i) => {
    const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]]
    if (o == null || h == null || l == null || c == null) return
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: q.volume[i] ?? 0 })
  })
  return out
}

/** Today's top gainers (over $5, or $1 with penny stocks on) and most-traded US stocks from Yahoo's public screeners. */
async function yahooMovers(top: number, minPrice: number): Promise<ScanMarket[]> {
  const plain = (s: string) => /^[A-Z]{1,5}$/.test(s)
  const screen = async (id: string) => {
    const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${id}&count=${top * 3}`, { headers: UA })
    if (!res.ok) throw new Error(`Yahoo screener ${res.status}`)
    const json = (await res.json()) as { finance: { result?: { quotes?: { symbol: string; regularMarketPrice?: number; quoteType?: string }[] }[] } }
    return (json.finance.result?.[0]?.quotes ?? []).filter((q) => q.quoteType === 'EQUITY' && plain(q.symbol))
  }
  const [gainers, actives] = await Promise.all([screen('day_gainers').catch(() => []), screen('most_actives').catch(() => [])])
  const out: ScanMarket[] = []
  for (const q of gainers.filter((g) => (g.regularMarketPrice ?? 0) >= minPrice).slice(0, top)) out.push({ symbol: q.symbol, asset: 'stock', source: 'gainer' })
  for (const q of actives.slice(0, top)) if (!out.some((m) => m.symbol === q.symbol)) out.push({ symbol: q.symbol, asset: 'stock', source: 'active' })
  return out
}

/** Today's top crypto gainers and most-traded coins from CoinGecko's public market list (keyless; Binance blocks US servers). */
async function coingeckoMovers(top: number): Promise<Mover[]> {
  const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=1', { headers: UA })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const rows = (await res.json()) as { symbol: string; name: string; total_volume: number | null; price_change_percentage_24h: number | null }[]
  const STABLE = /^(usdt|usdc|dai|fdusd|tusd|usde|usdp|pyusd|busd|usds|usd1|eurc|xaut|paxg)$/
  const all = rows
    .filter((r) => !STABLE.test(r.symbol) && !/wrapped|staked|bridged/i.test(r.name) && (r.total_volume ?? 0) >= 2_000_000 && r.price_change_percentage_24h != null)
    .map((r) => ({ symbol: `${r.symbol.toUpperCase()}/USDT`, change: r.price_change_percentage_24h ?? 0, volume: r.total_volume ?? 0 }))
  const by = (f: (r: (typeof all)[number]) => number) => [...all].sort((a, b) => f(b) - f(a))
  return cryptoMovers({ gainers: by((r) => r.change), volume: by((r) => r.volume) }, top)
}

export interface CycleOptions {
  /** How many stock gainers and most-traded stocks to add (each list). */
  stockMovers?: number
  /** How many crypto gainers and most-traded coins to add (each list). */
  cryptoMovers?: number
}

export interface CycleResult {
  next: PracticeState
  /** A trade opened or closed this cycle. */
  traded: boolean
  log: string[]
}

/** Runs one cycle on `prev`. Throws when no market data came back at all, so the saved state is left alone. */
export async function runPracticeCycle(prev: PracticeState, journal: JournalEntry[], now: number, opt: CycleOptions = {}): Promise<CycleResult> {
  const rules = DEFAULT_AI_RULES
  const markets: ScanMarket[] = scanMarkets(
    INSTRUMENTS,
    rules.practiceMovers ? (await yahooMovers(opt.stockMovers ?? 10, rules.practicePenny ? PENNY_MIN_PRICE : PENNY_PRICE)).map((m) => ({ symbol: m.symbol, source: m.source as Mover['source'] })) : [],
    rules.practiceCryptoMovers ? await coingeckoMovers(opt.cryptoMovers ?? 8).catch(() => []) : [],
  )
  const r = await scanCycle({
    markets: withOpenMarkets(markets, prev),
    fetchBars: (m) => yahoo15m(m.symbol),
    rules,
    journal,
    killSwitch: false,
    maxTradesPerDay: rules.maxTradesPerDay,
    lastBars: prev.server?.lastBars ?? {},
    now,
    // the server is not running overnight, so crypto day trades also close with the stock market
    dayEnd: sessionEnd('stock', now),
    // Yahoo's public chart data is treated as delayed
    sourceFor: () => 'Yahoo Finance',
    skills: SKILLS.map(skillTag),
  })
  if (Object.keys(r.prices).length === 0) throw new Error(`No market data at all (${r.failed.join(', ')})`)
  const next = r.apply(prev)
  next.server = { lastRun: now, lastBars: r.lastBars, picks: r.picks, failed: r.failed }

  const traded = JSON.stringify([next.open, next.trades.length, next.events[0]?.id]) !== JSON.stringify([prev.open, prev.trades.length, prev.events[0]?.id])
  const top = r.candidates.filter((c) => c.place != null).slice(0, 3).map((c) => `${c.place}. ${c.symbol}`)
  const log = [`scanned ${r.candidates.length} markets (${r.failed.length} failed); best BUY calls: ${top.join(', ') || 'none'}; open ${next.open.length}, closed ${next.trades.length}, realized ${next.realized.toFixed(2)}`]
  for (const e of next.events) {
    if (e.id === prev.events[0]?.id) break
    log.push(`  ${e.en}`)
  }
  return { next, traded, log }
}
