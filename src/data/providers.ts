/**
 * Market data providers.
 *  - Binance public market data (keyless, REST + WebSocket) for crypto pairs.
 *  - Alpha Vantage (free API key) for US stock candles, polled.
 *  - Finnhub (free API key) for real-time US stock trades + quotes.
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

export async function alphaVantageCandles(symbol: string, tf: Timeframe, key: string): Promise<Candle[]> {
  const interval = AV_INTERVAL[tf]
  const url = interval
    ? `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=full&apikey=${key}`
    : `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`
  const json = await fetchJson(url, 15000)
  const seriesKey = Object.keys(json).find((k) => k.startsWith('Time Series'))
  if (!seriesKey) throw new Error(json.Note || json.Information || json['Error Message'] || 'Alpha Vantage: no data')
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

/** Real-time trade stream; calls onTrade(price, volume, unixMs). */
export function finnhubTrades(symbol: string, key: string, onTrade: (p: number, v: number, t: number) => void, onState: (live: boolean) => void) {
  let disposed = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let ws: WebSocket | null = null
  const open = () => {
    ws = new WebSocket(`wss://ws.finnhub.io?token=${key}`)
    ws.onopen = () => {
      onState(true)
      ws?.send(JSON.stringify({ type: 'subscribe', symbol }))
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'trade') for (const t of msg.data) onTrade(t.p, t.v, t.t)
    }
    ws.onclose = () => {
      onState(false)
      if (!disposed) retry = setTimeout(open, 5000)
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

export const supportsLive = (inst: Instrument, keys: ApiKeys) => inst.assetClass === 'crypto' || !!keys.alphaVantage || !!keys.finnhub
