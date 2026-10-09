/**
 * Server side of 24/7 auto learning: one cycle, run hourly by
 * .github/workflows/auto-learn.yml so learning continues while the app is closed.
 * Reads and writes public/auto-learning.json, which the app loads.
 *
 *   npm run learn                       live Yahoo Finance hourly bars
 *   npm run learn -- --demo --out x.json  seeded demo bars (for testing, no network)
 *
 * The server can't see the rules saved in a browser, so it uses the default AI rules.
 * Paper only: nothing here places an order.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import { INSTRUMENTS, findInstrument } from '../src/data/instruments'
import { demoHistory } from '../src/data/demo'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { emptyState, parseState, runCycle } from '../src/lib/autoLearn'

const args = process.argv.slice(2)
const demo = args.includes('--demo')
const outIdx = args.indexOf('--out')
const file = outIdx >= 0 ? args[outIdx + 1] : 'public/auto-learning.json'
const cycles = Number(args[args.indexOf('--cycles') + 1]) || 1

/** App symbol to Yahoo ticker: BTC/USDT -> BTC-USD, stocks unchanged. */
const yahooTicker = (symbol: string) => (symbol.includes('/') ? `${symbol.split('/')[0]}-USD` : symbol)

async function yahooHourly(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker(symbol))}?interval=1h&range=730d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (arc-analyst auto-learning)' } })
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

let state = emptyState('server')
try {
  state = parseState(JSON.parse(readFileSync(file, 'utf8'))) ?? state
} catch {
  /* first run: start fresh */
}
state.source = 'server'

const symbols = INSTRUMENTS.map((i) => i.symbol)
// the server has time to spare: 4 markets x 500 old bars per hourly cycle
const SERVER_PACE = { oldChunk: 500, oldMarkets: 4 }
// demo: each cycle reveals 8 more bars, so new-bar scoring and grading get exercised too
let k = 0
const fetchCandles = demo ? async (s: string) => demoHistory(findInstrument(s), '1h', 900).slice(0, 900 - (cycles - 1 - k) * 8) : yahooHourly

for (; k < cycles; k++) {
  const { state: next, report } = await runCycle(state, symbols, fetchCandles, DEFAULT_AI_RULES, Date.now(), SERVER_PACE)
  state = next
  console.log(`cycle ${state.cycles}: old ${report.oldTested}, new ${report.newTested}, graded ${report.graded}, failed ${report.failed.map((f) => `${f.symbol} (${f.error})`).join(', ') || 'none'}`)
  if (report.markets.length === 0) {
    console.error('No market data at all; leaving the saved state unchanged.')
    process.exit(1)
  }
}
writeFileSync(file, JSON.stringify(state))
console.log(state.latest?.en)
