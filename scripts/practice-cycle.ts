/**
 * Server side of practice mode: one stock-picker cycle, run every 15 minutes in US market
 * hours by .github/workflows/practice.yml, so practice keeps trading while the app is closed.
 * Reads and writes public/practice.json, which the app shows on the chart, in the feed and in the report.
 *
 *   npm run practice                        live Yahoo Finance 15-minute bars and movers
 *   npm run practice -- --out x.json        write somewhere else (for testing)
 *
 * The server can't see the rules saved in a browser, so it uses the default AI rules
 * (4 day trades and 1 long-term trade a day, 2% per trade, all risk gates on).
 * Paper only: nothing here places an order.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import { INSTRUMENTS } from '../src/data/instruments'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { SKILLS, skillTag } from '../src/lib/skills'
import { parseState } from '../src/lib/autoLearn'
import type { JournalEntry } from '../src/lib/journal'
import { emptyPractice, parsePractice, sessionEnd, type PracticeState } from '../src/lib/practice'
import { scanCycle, withOpenMarkets, type ScanMarket } from '../src/lib/practiceScan'

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const file = outIdx >= 0 ? args[outIdx + 1] : 'public/practice.json'
/** Without a new trade, rewrite the file (one commit, one redeploy) at most this often. */
const QUIET_WRITE_MS = 60 * 60_000
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

/** Today's top gainers (over $5) and most-traded US stocks from Yahoo's public screeners. */
async function yahooMovers(top = 10): Promise<ScanMarket[]> {
  const plain = (s: string) => /^[A-Z]{1,5}$/.test(s)
  const screen = async (id: string) => {
    const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${id}&count=${top * 3}`, { headers: UA })
    if (!res.ok) throw new Error(`Yahoo screener ${res.status}`)
    const json = (await res.json()) as { finance: { result?: { quotes?: { symbol: string; regularMarketPrice?: number; quoteType?: string }[] }[] } }
    return (json.finance.result?.[0]?.quotes ?? []).filter((q) => q.quoteType === 'EQUITY' && plain(q.symbol))
  }
  const [gainers, actives] = await Promise.all([screen('day_gainers').catch(() => []), screen('most_actives').catch(() => [])])
  const out: ScanMarket[] = []
  for (const q of gainers.filter((g) => (g.regularMarketPrice ?? 0) >= 5).slice(0, top)) out.push({ symbol: q.symbol, asset: 'stock', source: 'gainer' })
  for (const q of actives.slice(0, top)) if (!out.some((m) => m.symbol === q.symbol)) out.push({ symbol: q.symbol, asset: 'stock', source: 'active' })
  return out
}

let prev: PracticeState = emptyPractice()
try {
  prev = parsePractice(JSON.parse(readFileSync(file, 'utf8'))) ?? prev
} catch {
  /* first run: start fresh */
}
let journal: JournalEntry[] = []
try {
  journal = parseState(JSON.parse(readFileSync('public/auto-learning.json', 'utf8')))?.journal ?? []
} catch {
  /* no learner yet: its opinion is n/a */
}

const rules = DEFAULT_AI_RULES
const now = Date.now()
const markets: ScanMarket[] = INSTRUMENTS.map((i) => ({ symbol: i.symbol, asset: i.assetClass, source: 'watchlist' as const }))
if (rules.practiceMovers) for (const m of await yahooMovers()) if (!markets.some((x) => x.symbol === m.symbol)) markets.push(m)

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
if (Object.keys(r.prices).length === 0) {
  console.error(`No market data at all (${r.failed.join(', ')}); leaving the saved state unchanged.`)
  process.exit(1)
}
const next = r.apply(prev)
next.server = { lastRun: now, lastBars: r.lastBars, picks: r.picks, failed: r.failed }

const traded = JSON.stringify([next.open, next.trades.length, next.events[0]?.id]) !== JSON.stringify([prev.open, prev.trades.length, prev.events[0]?.id])
const quietFor = now - (prev.server?.lastRun ?? 0)
const top = r.candidates.filter((c) => c.place != null).slice(0, 3).map((c) => `${c.place}. ${c.symbol}`)
console.log(`scanned ${r.candidates.length} markets (${r.failed.length} failed); best BUY calls: ${top.join(', ') || 'none'}; open ${next.open.length}, closed ${next.trades.length}, realized ${next.realized.toFixed(2)}`)
for (const e of next.events) {
  if (e.id === prev.events[0]?.id) break
  console.log(`  ${e.en}`)
}
if (traded || quietFor >= QUIET_WRITE_MS) writeFileSync(file, JSON.stringify(next))
else console.log('No new trades; not rewriting the file this run.')
