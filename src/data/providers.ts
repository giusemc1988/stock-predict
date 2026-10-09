/**
 * Market data providers.
 *  - Binance public market data (keyless, REST + WebSocket) for crypto pairs.
 *  - Alpha Vantage (free API key) for US stock candles, polled.
 *  - Finnhub (free API key) for real-time US stock trades + quotes.
 *  - Alpaca market data (the paper brokerage keys) for US stock candles + quotes.
 *  - Demo feed fallback so the app always runs.
 */
import type { Candle, Instrument, Timeframe } from '../types'
import { tfSeconds } from '../types'

export interface ApiKeys {
  alphaVantage: string
  finnhub: string
}

const BINANCE_REST = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api.binance.us']
const BINANCE_WS = ['wss://data-stream.binance.vision', 'wss://stream.binance.com:9443']

async function fetchJson(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

let workingBinanceRest: string | null = null

async function binanceGet(path: string) {
  const bases = workingBinanceRest ? [workingBinanceRest, ...BINANCE_REST.filter((b) => b !== workingBinanceRest)] : BINANCE_REST
  let lastErr: unknown
  for (const base of bases) {
    try {
      const json = await fetchJson(base + path)
      workingBinanceRest = base
      return json
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

type BinanceKline = [number, string, string, string, string, string, ...unknown[]]

const parseKline = (k: BinanceKline): Candle => ({
  time: Math.floor(k[0] / 1000),
  open: +k[1],
  high: +k[2],
  low: +k[3],
  close: +k[4],
  volume: +k[5],
  buyVolume: +(k[9] as string),
})

export async function binanceKlines(pair: string, tf: Timeframe, limit = 1000): Promise<Candle[]> {
  const rows: BinanceKline[] = await binanceGet(`/api/v3/klines?symbol=${pair}&interval=${tf}&limit=${limit}`)
  return rows.map(parseKline)
}

export interface Ticker24 {
  symbol: string
  last: number
  open: number
  high: number
  low: number
  volume: number
}

export async function binanceDepth(pair: string, limit = 20) {
  const d: { bids: [string, string][]; asks: [string, string][] } = await binanceGet(`/api/v3/depth?symbol=${pair}&limit=${limit}`)
  return { bids: d.bids.map(([p, q]) => ({ price: +p, size: +q })), asks: d.asks.map(([p, q]) => ({ price: +p, size: +q })) }
}

export async function binanceRecentTrades(pair: string, limit = 500) {
  const rows: { a: number; p: string; q: string; m: boolean; T: number }[] = await binanceGet(`/api/v3/aggTrades?symbol=${pair}&limit=${limit}`)
  // m = buyer is the maker, i.e. the aggressive side was a SELL
  return rows.map((r) => ({ id: String(r.a), price: +r.p, size: +r.q, side: (r.m ? 'sell' : 'buy') as 'buy' | 'sell', time: r.T }))
}

export async function binanceTickers(pairs: string[]): Promise<Ticker24[]> {
  const q = encodeURIComponent(JSON.stringify(pairs))
  const rows: Record<string, string>[] = await binanceGet(`/api/v3/ticker/24hr?symbols=${q}`)
  return rows.map((r) => ({
    symbol: r.symbol,
    last: +r.lastPrice,
    open: +r.openPrice,
    high: +r.highPrice,
    low: +r.lowPrice,
    volume: +r.quoteVolume,
  }))
}

/** Opens a Binance stream, trying each host in turn. Returns a disposer. */
export function binanceStream(streams: string[], onMessage: (data: any) => void, onState: (live: boolean) => void): () => void {
  let disposed = false
  let ws: WebSocket | null = null
  let hostIdx = 0
  let retry: ReturnType<typeof setTimeout> | undefined
  const open = () => {
    if (disposed) return
    const host = BINANCE_WS[hostIdx % BINANCE_WS.length]
    const url = streams.length === 1 ? `${host}/ws/${streams[0]}` : `${host}/stream?streams=${streams.join('/')}`
    ws = new WebSocket(url)
    ws.onopen = () => onState(true)
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      onMessage(msg.data ?? msg)
    }
    ws.onclose = () => {
      onState(false)
      if (disposed) return
      hostIdx++
      retry = setTimeout(open, 2000)
    }
    ws.onerror = () => ws?.close()
  }
  open()
  return () => {
    disposed = true
    clearTimeout(retry)
    ws?.close()
  }
}

// ---------- Alpha Vantage ----------

const AV_INTERVAL: Record<Timeframe, string | null> = { '1m': '1min', '5m': '5min', '15m': '15min', '1h': '60min', '4h': '60min', '1d': null }

/** Alpha Vantage timestamps are US/Eastern wall-clock; convert to UTC seconds. */
function easternToUnix(s: string) {
  const [d, t = '00:00:00'] = s.split(' ')
  const asUtc = Date.parse(`${d}T${t}Z`)
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const parts = Object.fromEntries(fmt.formatToParts(new Date(asUtc)).map((p) => [p.type, p.value]))
  const etOfUtc = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}Z`)
  return Math.floor((asUtc + (asUtc - etOfUtc)) / 1000)
}

function avError(json: Record<string, string>, symbol: string) {
  const msg = json.Note || json.Information || ''
  if (/rate limit|requests per day|25 requests|spreading out/i.test(msg))
    return 'Alpha Vantage free limit reached (25 requests a day). Add an Alpaca paper key on the Portfolio page for unlimited prices'
  if (/premium/i.test(msg)) return 'This Alpha Vantage request needs a premium plan'
  if (/apikey|api key/i.test(msg) || /apikey/i.test(json['Error Message'] ?? '')) return 'Alpha Vantage rejected the key. Check it in settings'
  if (json['Error Message']) return `Alpha Vantage has no data for ${symbol}`
  return msg || 'Alpha Vantage: no data'
}

export async function alphaVantageCandles(symbol: string, tf: Timeframe, key: string): Promise<Candle[]> {
  const interval = AV_INTERVAL[tf]
  const get = (size: 'full' | 'compact') =>
    fetchJson(
      interval
        ? `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=${size}&apikey=${key}`
        : `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`,
      15000,
    )
  let json = await get('full')
  // free keys may not get full intraday history; the latest 100 bars still work
  if (interval && !Object.keys(json).some((k) => k.startsWith('Time Series')) && /premium/i.test(json.Information ?? '')) json = await get('compact')
  const seriesKey = Object.keys(json).find((k) => k.startsWith('Time Series'))
  if (!seriesKey) throw new Error(avError(json, symbol))
  const rows = Object.entries(json[seriesKey] as Record<string, Record<string, string>>)
    .map(([ts, v]) => ({
      time: interval ? easternToUnix(ts) : Math.floor(Date.parse(ts + 'T00:00:00Z') / 1000),
      open: +v['1. open'],
      high: +v['2. high'],
      low: +v['3. low'],
      close: +v['4. close'],
      volume: +v['5. volume'],
    }))
    .sort((a, b) => a.time - b.time)
  return tf === '4h' ? aggregate(rows, tfSeconds('4h')) : rows
}

/** How long Alpha Vantage candles are reused; the free plan only allows 25 requests a day. */
export const AV_CACHE_MS = 15 * 60_000

/**
 * Alpha Vantage candles cached in localStorage per symbol and timeframe, so reloads and
 * timeframe switches don't burn the daily quota. When a request fails (usually the daily
 * limit) the last saved candles are returned with the error in `stale`.
 */
export async function alphaVantageCandlesCached(symbol: string, tf: Timeframe, key: string): Promise<{ candles: Candle[]; stale: string | null }> {
  const id = `bluechip.av.${symbol}|${tf}`
  let saved: { t: number; key: string; candles: Candle[] } | null = null
  try {
    saved = JSON.parse(localStorage.getItem(id) ?? 'null')
  } catch {
    /* storage blocked or corrupt */
  }
  if (saved && saved.key !== key) saved = null
  if (saved && Date.now() - saved.t < AV_CACHE_MS) return { candles: saved.candles, stale: null }
  try {
    const candles = await alphaVantageCandles(symbol, tf, key)
    try {
      localStorage.setItem(id, JSON.stringify({ t: Date.now(), key, candles: candles.slice(-1000) }))
    } catch {
      /* storage full: still show the data */
    }
    return { candles, stale: null }
  } catch (e) {
    if (saved?.candles.length) return { candles: saved.candles, stale: e instanceof Error ? e.message : String(e) }
    throw e
  }
}

export function aggregate(rows: Candle[], step: number): Candle[] {
  const out: Candle[] = []
  for (const r of rows) {
    const bucket = r.time - (r.time % step)
    const last = out[out.length - 1]
    if (last && last.time === bucket) {
      last.high = Math.max(last.high, r.high)
      last.low = Math.min(last.low, r.low)
      last.close = r.close
      last.volume += r.volume
    } else out.push({ ...r, time: bucket })
  }
  return out
}

// ---------- Finnhub ----------

export async function finnhubQuote(symbol: string, key: string) {
  const q = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`)
  if (!q || !q.c) throw new Error('Finnhub: no quote')
  return { last: q.c as number, open: q.pc as number, high: q.h as number, low: q.l as number }
}

type TradeListener = (p: number, v: number, t: number) => void
type StateListener = (live: boolean) => void

/**
 * One shared Finnhub socket per key (the free plan allows a single connection),
 * multiplexed across every symbol and listener in the app.
 */
const fh = {
  key: '',
  ws: null as WebSocket | null,
  live: false,
  retry: undefined as ReturnType<typeof setTimeout> | undefined,
  subs: new Map<string, Set<{ onTrade: TradeListener; onState: StateListener }>>(),
}

function fhConnect() {
  clearTimeout(fh.retry)
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${fh.key}`)
  fh.ws = ws
  ws.onopen = () => {
    fh.live = true
    for (const [sym, set] of fh.subs) {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }))
      set.forEach((l) => l.onState(true))
    }
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.type !== 'trade') return
    for (const t of msg.data) fh.subs.get(t.s)?.forEach((l) => l.onTrade(t.p, t.v, t.t))
  }
  ws.onclose = () => {
    fh.live = false
    fh.subs.forEach((set) => set.forEach((l) => l.onState(false)))
    if (fh.ws === ws && fh.subs.size) fh.retry = setTimeout(fhConnect, 5000)
  }
  ws.onerror = () => ws.close()
}

/** Real-time trade stream; calls onTrade(price, volume, unixMs). Returns a disposer. */
export function finnhubTrades(symbol: string, key: string, onTrade: TradeListener, onState: StateListener) {
  if (fh.key !== key) {
    fh.key = key
    const old = fh.ws
    fh.ws = null
    old?.close()
  }
  const l = { onTrade, onState }
  const set = fh.subs.get(symbol) ?? new Set()
  const isNewSymbol = !set.size
  set.add(l)
  fh.subs.set(symbol, set)
  if (!fh.ws) fhConnect()
  else if (fh.live) {
    if (isNewSymbol) fh.ws.send(JSON.stringify({ type: 'subscribe', symbol }))
    onState(true)
  }
  return () => {
    set.delete(l)
    if (!set.size) {
      fh.subs.delete(symbol)
      if (fh.live) fh.ws?.send(JSON.stringify({ type: 'unsubscribe', symbol }))
    }
    if (!fh.subs.size) {
      const ws = fh.ws
      fh.ws = null
      ws?.close()
    }
  }
}

export const supportsLive = (inst: Instrument, keys: ApiKeys) => inst.assetClass === 'crypto' || !!keys.alphaVantage || !!keys.finnhub

// ---------- Alpaca market data (free IEX feed, same paper keys as the brokerage) ----------

export interface AlpacaDataKeys {
  keyId: string
  secret: string
}

/** Paper keys start with PK; anything else (empty, live AK keys) is not used for data. */
export const hasAlpacaData = (k: AlpacaDataKeys) => /^PK/i.test(k.keyId) && !!k.secret

const ALPACA_DATA = 'https://data.alpaca.markets'
const ALPACA_TF: Record<Timeframe, string> = { '1m': '1Min', '5m': '5Min', '15m': '15Min', '1h': '1Hour', '4h': '4Hour', '1d': '1Day' }
// how far back to ask for so ~1000 bars come back once nights and weekends are skipped
const ALPACA_LOOKBACK_DAYS: Record<Timeframe, number> = { '1m': 7, '5m': 30, '15m': 60, '1h': 200, '4h': 600, '1d': 1500 }

async function alpacaData<T>(k: AlpacaDataKeys, path: string): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    let res: Response
    try {
      res = await fetch(ALPACA_DATA + path, { signal: ctrl.signal, headers: { 'APCA-API-KEY-ID': k.keyId, 'APCA-API-SECRET-KEY': k.secret } })
    } catch {
      throw new Error('Could not reach Alpaca market data')
    }
    const body = await res.json().catch(() => ({}))
    if (res.status === 401 || res.status === 403) throw new Error('Alpaca rejected the paper key (check key ID and secret)')
    if (!res.ok) throw new Error(body.message || `Alpaca data error ${res.status}`)
    return body as T
  } finally {
    clearTimeout(t)
  }
}

interface AlpacaBar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export async function alpacaStockCandles(symbol: string, tf: Timeframe, k: AlpacaDataKeys): Promise<Candle[]> {
  const start = new Date(Date.now() - ALPACA_LOOKBACK_DAYS[tf] * 86400_000).toISOString()
  const q = `timeframe=${ALPACA_TF[tf]}&start=${start}&limit=1000&sort=desc&feed=iex&adjustment=split`
  const json = await alpacaData<{ bars: AlpacaBar[] | null }>(k, `/v2/stocks/${encodeURIComponent(symbol)}/bars?${q}`)
  const rows = (json.bars ?? []).map((b) => ({ time: Math.floor(Date.parse(b.t) / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v })).reverse()
  if (!rows.length) throw new Error(`Alpaca: no bars for ${symbol}`)
  return rows
}

interface AlpacaSnap {
  latestTrade?: { p: number }
  dailyBar?: AlpacaBar
  prevDailyBar?: AlpacaBar
}

/** Latest price and today's range for many symbols in one request. */
export async function alpacaSnapshots(symbols: string[], k: AlpacaDataKeys) {
  const json = await alpacaData<Record<string, AlpacaSnap>>(k, `/v2/stocks/snapshots?symbols=${symbols.map(encodeURIComponent).join(',')}&feed=iex`)
  const out: Record<string, { last: number; open: number; high: number; low: number; volume: number }> = {}
  for (const [sym, s] of Object.entries(json)) {
    const last = s.latestTrade?.p ?? s.dailyBar?.c
    if (!last) continue
    // change is measured from yesterday's close, like the Finnhub quote
    out[sym] = { last, open: s.prevDailyBar?.c ?? s.dailyBar?.o ?? last, high: s.dailyBar?.h ?? last, low: s.dailyBar?.l ?? last, volume: s.dailyBar?.v ?? 0 }
  }
  return out
}

export interface MarketMover {
  symbol: string
  source: 'gainer' | 'active'
  percentChange?: number
  volume?: number
  price?: number
}

/** Today's top gainers and most-active US stocks from Alpaca's screener (paper data key).
 *  Skips warrants, units and other odd tickers, and gainers under $5. */
export async function alpacaMovers(k: AlpacaDataKeys, top = 10): Promise<MarketMover[]> {
  const plain = (s: string) => /^[A-Z]{1,5}$/.test(s)
  const [mv, act] = await Promise.all([
    alpacaData<{ gainers?: { symbol: string; percent_change: number; price: number }[] }>(k, `/v1beta1/screener/stocks/movers?top=${top * 3}`).catch(() => ({ gainers: [] })),
    alpacaData<{ most_actives?: { symbol: string; volume: number }[] }>(k, `/v1beta1/screener/stocks/most-actives?by=volume&top=${top * 2}`).catch(() => ({ most_actives: [] })),
  ])
  const gainers: MarketMover[] = (mv.gainers ?? [])
    .filter((g) => plain(g.symbol) && g.price >= 5)
    .slice(0, top)
    .map((g) => ({ symbol: g.symbol, source: 'gainer', percentChange: g.percent_change, price: g.price }))
  const actives: MarketMover[] = (act.most_actives ?? [])
    .filter((a) => plain(a.symbol))
    .slice(0, top)
    .map((a) => ({ symbol: a.symbol, source: 'active', volume: a.volume }))
  const seen = new Set<string>()
  return [...gainers, ...actives].filter((m) => !seen.has(m.symbol) && !!seen.add(m.symbol))
}
