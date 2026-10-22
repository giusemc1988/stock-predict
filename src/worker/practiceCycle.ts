/**
 * Cloudflare Worker practice cycle: runs on Cron every 5 minutes during market hours.
 * Reads state from KV, runs one scan cycle, writes state back.
 * Paper only: nothing here places an order.
 */
import { buyText, sellText } from '../lib/telegramText'
import type { Candle } from '../types'
import { INSTRUMENTS } from '../data/instruments'
import { DEFAULT_AI_RULES } from '../lib/aiRules'
import { SKILLS, skillTag } from '../lib/skills'
import { parseState } from '../lib/autoLearn'
import type { JournalEntry } from '../lib/journal'
import { emptyPractice, nextBaseline, parsePractice, PENNY_MIN_PRICE, PENNY_PRICE, sessionEnd, type PracticeState } from '../lib/practice'
import { cryptoMovers, scanCycle, scanMarkets, withOpenMarkets, type Mover, type ScanMarket } from '../lib/practiceScan'

/** Buy-and-hold yardstick for the scoreboard. */
const BASELINE = 'SPY'
const UA = { 'User-Agent': 'Mozilla/5.0 (arc-analyst practice)' }

const yahooTicker = (symbol: string) => (symbol.includes('/') ? `${symbol.split('/')[0]}-USD` : symbol)

async function yahoo15m(symbol: string, retries = 3, backoffMs = 500): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker(symbol))}?interval=15m&range=10d`
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers: UA })
      if (!res.ok) {
        if (res.status === 429 && attempt < retries - 1) {
          // Rate limited: wait and retry
          await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)))
          continue
        }
        throw new Error(`Yahoo ${res.status}`)
      }
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
    } catch (e) {
      if (attempt === retries - 1) throw e
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)))
    }
  }
  throw new Error('Yahoo: retries exhausted')
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

async function sendTelegram(text: string, token: string, chatId: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!res.ok) console.log(`Telegram send failed: ${res.status}`)
  } catch (e) {
    console.log('Telegram error:', e)
  }
}

export interface WorkerEnv {
  PRACTICE: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void>; delete(key: string): Promise<void> }
}

async function getCachedBars(env: WorkerEnv, key: string): Promise<Candle[] | null> {
  try {
    const cached = await env.PRACTICE.get(key)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

async function setCachedBars(env: WorkerEnv, key: string, bars: Candle[]): Promise<void> {
  try {
    await env.PRACTICE.put(key, JSON.stringify(bars))
  } catch {
    // KV write failed, continue without cache
  }
}

export interface TradeAlert {
  id: string
  symbol: string
  side: 'BUY'
  entry: number
  stop: number
  target: number
  qty: number
  reason: string
  openedAt: number
  ruleName?: string
}

/**
 * Calculate rolling win rate from the most recent closed trades.
 * Returns null if insufficient data, otherwise 0-1 (e.g., 0.4 = 40%).
 */
function rollingWinRate(trades: { pnl: number }[], sampleSize = 20): number | null {
  if (trades.length < sampleSize) return null
  const recent = trades.slice(-sampleSize)
  const wins = recent.filter((t) => t.pnl > 0).length
  return wins / recent.length
}

/**
 * Calculate drawdown brake multiplier based on today's total P&L.
 * Returns: 1.0 (normal), 0.5 (-3% to -6%), 0.25 (-6% to -15%), 0 (-15%+).
 */
function drawdownBrakeMultiplier(state: PracticeState, now: number): number {
  const equity = PRACTICE_START + state.realized

  // Calculate today's P&L: realized from closed trades + unrealized from open positions
  const today = new Date(now).toLocaleDateString('en-CA') // YYYY-MM-DD format
  const todayRealized = state.trades.filter((t) => {
    const tradeDay = new Date(t.closedAt).toLocaleDateString('en-CA')
    return tradeDay === today
  }).reduce((sum, t) => sum + t.pnl, 0)

  // Unrealized P&L on open positions (use server prices if available)
  let unrealized = 0
  for (const p of state.open) {
    const price = state.server?.prices?.[p.symbol] ?? p.entry
    unrealized += (price - p.entry) * p.qty
  }

  const todayPnl = todayRealized + unrealized
  const todayReturnPct = (todayPnl / equity) * 100

  // Apply drawdown brakes
  if (todayReturnPct <= -15) return 0     // Stop trading
  if (todayReturnPct <= -6) return 0.25   // Quarter size
  if (todayReturnPct <= -3) return 0.5    // Half size
  return 1                                 // Normal size
}

/**
 * Calculate Kelly sizing multiplier from closed trades.
 * Kelly formula: f* = (p*b - q) / b where p=winrate, q=lossrate, b=avg_win/avg_loss
 * Returns conservative 0.25x Kelly multiplier (1.0 if insufficient data or edge < 0)
 */
function kellyMultiplier(trades: { pnl: number; entry: number; exit: number }[]): number {
  if (trades.length < 10) return 1 // Need minimum sample size

  const wins = trades.filter((t) => t.pnl > 0)
  const losses = trades.filter((t) => t.pnl <= 0)

  if (wins.length === 0 || losses.length === 0) return 1 // No edge if all wins or all losses

  const p = wins.length / trades.length // Win rate
  const q = 1 - p // Loss rate

  const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length
  const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length)

  if (avgLoss === 0) return 1 // No losses recorded

  const b = avgWin / avgLoss // Payoff ratio
  const f = (p * b - q) / b // Kelly fraction

  // Return 1.0 if edge is negative or Kelly is negative; otherwise use 0.25x Kelly
  if (f <= 0 || p < 0.5) return 1
  return Math.min(0.25 * f, 0.25) // Conservative: cap at 0.25x and never exceed 0.25x Kelly
}

const PRACTICE_START = 10_000

export async function practiceCycle(env: WorkerEnv): Promise<{ state: PracticeState; message: string; alerts?: TradeAlert[] }> {

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
    rules.practiceMovers ? (await yahooMovers(10, rules.practicePenny ? PENNY_MIN_PRICE : PENNY_PRICE).catch(() => [])).map((m) => ({ symbol: m.symbol, source: m.source as Mover['source'] })) : [],
    rules.practiceCryptoMovers ? await coingeckoMovers().catch(() => []) : [],
  )

  // the buy-and-hold yardstick for the scoreboard: fetch with retry + caching
  let spy: Candle[] = []
  try {
    spy = await yahoo15m(BASELINE)
    // Cache successful fetch for fallback
    await setCachedBars(env, `spy_bars_${BASELINE}`, spy)
  } catch (e) {
    console.log(`Yahoo SPY fetch failed, trying cache: ${e}`)
    // Use cached bars if fresh fetch failed
    const cached = await getCachedBars(env, `spy_bars_${BASELINE}`)
    spy = cached ?? []
  }

  // Pause learning if rolling win rate falls below 40% (unproven edge)
  const wr = rollingWinRate(prev.trades)
  const pauseLearning = wr != null && wr < 0.4

  // Drawdown brakes: reduce position size based on daily loss
  const brakeMult = drawdownBrakeMultiplier(prev, now)

  // Kelly sizing: conservative 0.25x Kelly multiplier from closed trades
  const kellyMult = kellyMultiplier(prev.trades)

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
    pauseLearning,
    drawdownBrakeMultiplier: brakeMult,
    kellyMultiplier: kellyMult,
  })

  if (Object.keys(r.prices).length === 0) {
    return { state: prev, message: `No market data (${r.failed.join(', ')})` }
  }

  const next = r.apply(prev)
  const prices: Record<string, number> = {}
  for (const p of next.open) if (r.prices[p.symbol] > 0) prices[p.symbol] = r.prices[p.symbol]
  next.server = { lastRun: now, lastBars: r.lastBars, picks: r.picks, failed: r.failed, prices }
  next.baseline = nextBaseline(prev.baseline, BASELINE, spy, prev.curve[0]?.t ?? now)

  const top = r.candidates.filter((c) => c.place != null).slice(0, 3).map((c) => `${c.place}. ${c.symbol}`)

  // Find new trades by comparing open positions before and after
  const prevSymbols = new Set(prev.open.map((p) => p.id))
  const newTrades = next.open.filter((p) => !prevSymbols.has(p.id))
  const alerts: TradeAlert[] = newTrades.map((trade) => ({
    id: trade.id,
    symbol: trade.symbol,
    qty: trade.qty,
    side: 'BUY' as const,
    entry: trade.entry,
    stop: trade.stop,
    target: trade.target,
    reason: trade.info?.reason ?? 'AI signal',
    openedAt: trade.openedAt,
    ruleName: trade.info?.pick?.en ?? undefined,
  }))

  // Send Telegram alerts if configured
  let telegramConfig: { token: string; chatId: string } | null = null
  try {
    const stored = await env.PRACTICE.get('telegramConfig')
    if (stored) telegramConfig = JSON.parse(stored)
  } catch {
    /* no telegram config */
  }
  if (telegramConfig?.token && telegramConfig?.chatId) {
    for (const alert of alerts) await sendTelegram(buyText({ ...alert, at: alert.openedAt }), telegramConfig.token, telegramConfig.chatId)
    const seenClosed = new Set(prev.trades.map((t) => t.id))
    for (const t of next.trades.filter((x) => !seenClosed.has(x.id))) await sendTelegram(sellText({ symbol: t.symbol, qty: t.qty, entry: t.entry, exit: t.exit, pnl: t.pnl, retPct: t.retPct, reason: t.exitReason, at: t.closedAt }), telegramConfig.token, telegramConfig.chatId)
  }

  // written every run (about 108 KV writes a day; the free tier allows 1,000) so the last scan time, open P&L and the yardstick stay fresh
  await env.PRACTICE.put('state', JSON.stringify(next))

  // Save alerts to KV if there are any
  if (alerts.length > 0) {
    try {
      const existing = await env.PRACTICE.get('alerts')
      const allAlerts = existing ? JSON.parse(existing) : []
      const merged = [...allAlerts, ...alerts]
      // Keep only recent alerts (last 50)
      await env.PRACTICE.put('alerts', JSON.stringify(merged.slice(-50)))
    } catch {
      // If alerts storage fails, still continue
      console.log('Alert storage failed, continuing anyway')
    }
  }

  const learningStatus = pauseLearning ? `PAUSED (WR ${(wr! * 100).toFixed(0)}% < 40%)` : wr != null ? `active (WR ${(wr * 100).toFixed(0)}%)` : 'n/a'
  const brakeStatus = brakeMult === 1 ? 'normal' : brakeMult === 0.5 ? 'HALF (-3%)' : brakeMult === 0.25 ? 'QUARTER (-6%)' : 'STOPPED (-15%)'
  const kellyStatus = kellyMult < 1 ? `${(kellyMult * 100).toFixed(1)}% Kelly` : 'Kelly n/a'
  const msg = `scanned ${r.candidates.length} markets (${r.failed.length} failed); best: ${top.join(', ') || 'none'}; open ${next.open.length}, closed ${next.trades.length}, realized ${next.realized.toFixed(2)}; learning ${learningStatus}; brakes ${brakeStatus}; sizing ${kellyStatus}`
  return { state: next, message: msg, alerts }
}
