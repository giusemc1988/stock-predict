/**
 * Cloudflare Worker practice cycle: runs on Cron every 5 minutes during market hours.
 * Reads state from KV, runs one scan cycle, writes state back.
 * Paper only: nothing here places an order.
 */
/// <reference types="@cloudflare/workers-types" />
import type { Candle } from '../types'
import { INSTRUMENTS } from '../data/instruments'
import { DEFAULT_AI_RULES } from '../lib/aiRules'
import { SKILLS, skillTag } from '../lib/skills'
import { parseState } from '../lib/autoLearn'
import type { JournalEntry } from '../lib/journal'
import { emptyPractice, parsePractice, PENNY_MIN_PRICE, PENNY_PRICE, sessionEnd, type PracticeState } from '../lib/practice'
import { cryptoMovers, scanCycle, scanMarkets, withOpenMarkets, type Mover, type ScanMarket } from '../lib/practiceScan'

const UA = { 'User-Agent': 'Mozilla/5.0 (arc-analyst practice)' }

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

async function yahooMovers(top = 10, minPrice = 5): Promise<ScanMarket[]> {
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

async function coingeckoMovers(top = 8): Promise<Mover[]> {
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

export interface WorkerEnv {
  PRACTICE: KVNamespace
}

export async function practiceCycle(env: WorkerEnv): Promise<{ state: PracticeState; message: string }> {
  const QUIET_WRITE_MS = 60 * 60_000

  let prev: PracticeState = emptyPractice()
  try {
    const stored = await env.PRACTICE.get('state')
    if (stored) prev = parsePractice(JSON.parse(stored)) ?? prev
  } catch {
    /* first run: start fresh */
  }

  let journal: JournalEntry[] = []
  try {
    const stored = await env.PRACTICE.get('journal')
    if (stored) journal = parseState(JSON.parse(stored))?.journal ?? []
  } catch {
    /* no learner yet */
  }

  const rules = DEFAULT_AI_RULES
  const now = Date.now()
  const markets: ScanMarket[] = scanMarkets(
    INSTRUMENTS,
    rules.practiceMovers ? (await yahooMovers(10, rules.practicePenny ? PENNY_MIN_PRICE : PENNY_PRICE)).map((m) => ({ symbol: m.symbol, source: m.source as Mover['source'] })) : [],
    rules.practiceCryptoMovers ? await coingeckoMovers().catch(() => []) : [],
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
    dayEnd: sessionEnd('stock', now),
    sourceFor: () => 'Yahoo Finance',
    skills: SKILLS.map(skillTag),
  })

  if (Object.keys(r.prices).length === 0) {
    return { state: prev, message: `No market data (${r.failed.join(', ')})` }
  }

  const next = r.apply(prev)
  next.server = { lastRun: now, lastBars: r.lastBars, picks: r.picks, failed: r.failed }

  const traded = JSON.stringify([next.open, next.trades.length, next.events[0]?.id]) !== JSON.stringify([prev.open, prev.trades.length, prev.events[0]?.id])
  const quietFor = now - (prev.server?.lastRun ?? 0)
  const top = r.candidates.filter((c) => c.place != null).slice(0, 3).map((c) => `${c.place}. ${c.symbol}`)

  if (traded || quietFor >= QUIET_WRITE_MS) {
    await env.PRACTICE.put('state', JSON.stringify(next))
  }

  const msg = `scanned ${r.candidates.length} markets (${r.failed.length} failed); best: ${top.join(', ') || 'none'}; open ${next.open.length}, closed ${next.trades.length}, realized ${next.realized.toFixed(2)}`
  return { state: next, message: msg }
}
