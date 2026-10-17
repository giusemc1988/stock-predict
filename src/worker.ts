/**
 * Cloudflare Worker: serves the app's built files and one small API, /api/brain, for Jarvis's
 * free-AI helper. Keys are Worker secrets (wrangler secret put GEMINI_API_KEY, etc.).
 * Also serves /api/practice for live paper trading via Cron every 5 minutes.
 * Also serves /api/news for Alpaca news feed.
 */
import { askBrain, brainStatus, cleanAsk, type BrainEnv } from './lib/brainServer'
import { practiceCycle, type WorkerEnv as PracticeEnv } from './worker/practiceCycle'
import { cleanKey, isSlot, keySources, sameOrigin, storeKey, testProvider, withSavedKeys, type KeyStore } from './lib/brainKeys'
import type { PracticeState } from './lib/practice'

interface Env extends BrainEnv, PracticeEnv {
  ASSETS: { fetch: (r: Request) => Promise<Response> }
  /** KV that holds the keys typed into Settings. */
  SETTINGS?: KeyStore
  /** Alpaca API key ID for news endpoint (Worker secret via wrangler secret put) */
  ALPACA_API_KEY_ID?: string
  /** Alpaca API secret key for news endpoint (Worker secret via wrangler secret put) */
  ALPACA_API_SECRET_KEY?: string
  /** Trading data keys can also be Worker secrets or stored in KV SETTINGS. */
  ALPACA_PAPER_KEY?: string
  ALPHA_VANTAGE_KEY?: string
  FINNHUB_KEY?: string
  TELEGRAM_BOT_TOKEN?: string
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

interface AlpacaDataKeys {
  keyId: string
  secret: string
}

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface MarketListRow {
  symbol: string
  assetClass: 'stock' | 'crypto'
  price: number
  changePct: number
  dollarVolume?: number
}

interface MarketLists {
  gainers: MarketListRow[]
  losers: MarketListRow[]
  volume: MarketListRow[]
  most_active: MarketListRow[]
  new_highs: MarketListRow[]
}

async function fetchJson(url: string, opts: { headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: opts.headers })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

async function alpacaData<T>(k: AlpacaDataKeys, path: string): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch('https://data.alpaca.markets' + path, {
      signal: ctrl.signal,
      headers: { 'APCA-API-KEY-ID': k.keyId, 'APCA-API-SECRET-KEY': k.secret },
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 401 || res.status === 403) throw new Error('Alpaca rejected the paper key (check key ID and secret)')
    if (!res.ok) throw new Error((body.message as string) || `Alpaca data error ${res.status}`)
    return body as T
  } finally {
    clearTimeout(t)
  }
}

async function alpacaStockCandles(symbol: string, tf: string, k: AlpacaDataKeys): Promise<Candle[]> {
  const TF: Record<string, string> = { '1m': '1Min', '5m': '5Min', '15m': '15Min', '1h': '1Hour', '4h': '4Hour', '1d': '1Day' }
  const LOOKBACK_DAYS: Record<string, number> = { '1m': 7, '5m': 30, '15m': 60, '1h': 200, '4h': 600, '1d': 1500 }
  const start = new Date(Date.now() - (LOOKBACK_DAYS[tf] ?? 7) * 86400_000).toISOString()
  const q = `timeframe=${TF[tf] ?? tf}&start=${start}&limit=1000&sort=desc&feed=iex&adjustment=split`
  const json = (await alpacaData<{ bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> }>(k, `/v2/stocks/${encodeURIComponent(symbol)}/bars?${q}`)) as {
    bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>
  }
  const rows = (json.bars ?? [])
    .map((b) => ({ time: Math.floor(Date.parse(b.t) / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }))
    .reverse()
  if (!rows.length) throw new Error(`Alpaca: no bars for ${symbol}`)
  return rows
}

async function alpacaSnapshots(symbols: string[], k: AlpacaDataKeys) {
  const json = (await alpacaData<Record<string, { latestTrade?: { p: number }; dailyBar?: { o: number; h: number; l: number; c: number; v: number }; prevDailyBar?: { c: number } }>>(
    k,
    `/v2/stocks/snapshots?symbols=${symbols.map(encodeURIComponent).join(',')}&feed=iex`,
  )) as Record<string, { latestTrade?: { p: number }; dailyBar?: { o: number; h: number; l: number; c: number; v: number }; prevDailyBar?: { c: number } }>
  const out: Record<string, { last: number; open: number; high: number; low: number; volume: number }> = {}
  for (const [sym, s] of Object.entries(json)) {
    const last = s.latestTrade?.p ?? s.dailyBar?.c
    if (!last) continue
    out[sym] = { last, open: s.prevDailyBar?.c ?? s.dailyBar?.o ?? last, high: s.dailyBar?.h ?? last, low: s.dailyBar?.l ?? last, volume: s.dailyBar?.v ?? 0 }
  }
  return out
}

function checkPaperKey(keyId: string): string | null {
  if (!keyId) return 'Alpaca paper key not configured'
  if (/^AK/i.test(keyId)) return 'That looks like a LIVE key (starts with AK). Only paper keys (start with PK) are allowed here.'
  if (!/^PK/i.test(keyId)) return 'Alpaca paper key IDs start with PK. Check that you copied the Key ID from the Paper account on app.alpaca.markets.'
  return null
}

async function getAlpacaKeys(env: Env): Promise<AlpacaDataKeys> {
  let alpacaKeys: AlpacaDataKeys = { keyId: '', secret: '' }
  if (env.SETTINGS) {
    try {
      const alpacaKeyStr = await env.SETTINGS.get(storeKey('alpaca_paper' as any))
      if (alpacaKeyStr) {
        const parsed = JSON.parse(alpacaKeyStr)
        alpacaKeys = typeof parsed === 'object' ? parsed : { keyId: alpacaKeyStr, secret: '' }
      }
    } catch {
      /* fallthrough to Worker secrets */
    }
  }
  if (!alpacaKeys.keyId && env.ALPACA_PAPER_KEY) {
    const parsed = env.ALPACA_PAPER_KEY.includes(':') ? env.ALPACA_PAPER_KEY.split(':') : []
    if (parsed.length === 2) alpacaKeys = { keyId: parsed[0], secret: parsed[1] }
  }
  return alpacaKeys
}

async function getAlphaVantageKey(env: Env): Promise<string> {
  if (env.SETTINGS) {
    try {
      const avKeyStr = await env.SETTINGS.get(storeKey('alpha_vantage' as any))
      if (avKeyStr) return String(avKeyStr)
    } catch {
      /* fallthrough */
    }
  }
  return env.ALPHA_VANTAGE_KEY ?? ''
}

async function getFinnhubKey(env: Env): Promise<string> {
  if (env.SETTINGS) {
    try {
      const fhKeyStr = await env.SETTINGS.get(storeKey('finnhub' as any))
      if (fhKeyStr) return String(fhKeyStr)
    } catch {
      /* fallthrough */
    }
  }
  return env.FINNHUB_KEY ?? ''
}

async function alpacaTradingCall<T = unknown>(path: string, k: AlpacaDataKeys, opts: { method?: string; body?: string; timeoutMs?: number } = {}): Promise<T> {
  const keyError = checkPaperKey(k.keyId)
  if (keyError) throw new Error(keyError)
  if (!k.secret) throw new Error('Alpaca secret key not configured')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000)
  try {
    const res = await fetch('https://paper-api.alpaca.markets' + path, {
      signal: ctrl.signal,
      method: opts.method || 'GET',
      headers: { 'APCA-API-KEY-ID': k.keyId, 'APCA-API-SECRET-KEY': k.secret },
      body: opts.body,
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 401 || res.status === 403) throw new Error('Alpaca rejected the paper key (check key ID and secret)')
    if (!res.ok) throw new Error((body.message as string) || `Alpaca error ${res.status}`)
    return body as T
  } finally {
    clearTimeout(t)
  }
}

async function alpacaMovers(k: AlpacaDataKeys, limit: number, minPrice: number): Promise<Array<{ symbol: string; source: string }>> {
  const plain = (s: string) => /^[A-Z]{1,5}$/.test(s)
  type Move = { symbol: string; percent_change: number; price: number }
  const mv = (await alpacaData<{ gainers?: Move[]; losers?: Move[] }>(k, `/v1beta1/screener/stocks/movers?top=50`)) as any
  const gainers = (mv.gainers ?? []).filter((g: Move) => plain(g.symbol) && g.price >= minPrice).slice(0, limit).map((g: Move) => ({ symbol: g.symbol, source: `+${g.percent_change.toFixed(1)}%` }))
  const losers = (mv.losers ?? []).filter((l: Move) => plain(l.symbol) && l.price >= minPrice).slice(0, limit).map((l: Move) => ({ symbol: l.symbol, source: `${l.percent_change.toFixed(1)}%` }))
  return [...gainers, ...losers].slice(0, limit * 2)
}

async function alpacaMarketLists(k: AlpacaDataKeys, top = 15): Promise<MarketLists> {
  const plain = (s: string) => /^[A-Z]{1,5}$/.test(s)
  type Move = { symbol: string; percent_change: number; price: number }
  const [mv, act] = await Promise.all([
    alpacaData<{ gainers?: Move[]; losers?: Move[] }>(k, `/v1beta1/screener/stocks/movers?top=50`),
    alpacaData<{ most_actives?: { symbol: string; volume: number }[] }>(k, `/v1beta1/screener/stocks/most-actives?by=volume&top=${top * 2}`),
  ])
  const moves = (list: Move[] = []) =>
    list
      .filter((g) => plain(g.symbol) && g.price >= 1)
      .slice(0, top)
      .map((g) => ({ symbol: g.symbol, assetClass: 'stock' as const, price: g.price, changePct: g.percent_change }))
  const activeSyms = (act.most_actives ?? []).map((a) => a.symbol).filter(plain).slice(0, top)
  const snaps = activeSyms.length ? await alpacaSnapshots(activeSyms, k) : {}
  const volume = activeSyms
    .filter((s) => snaps[s])
    .map((s) => {
      const q = snaps[s]
      return { symbol: s, assetClass: 'stock' as const, price: q.last, changePct: ((q.last - q.open) / q.open) * 100, dollarVolume: q.volume * q.last }
    })
  const most_active = [...volume].sort((a, b) => (b.dollarVolume ?? 0) - (a.dollarVolume ?? 0)).slice(0, top)
  const new_highs = [...volume].sort((a, b) => b.price - a.price).slice(0, top)
  return { gainers: moves(mv.gainers), losers: moves(mv.losers), volume, most_active, new_highs }
}

async function alphaVantageCandles(symbol: string, tf: string, key: string): Promise<Candle[]> {
  const avError = (json: any, symbol: string) => {
    if (json.Note) return `Alpha Vantage daily limit reached`
    if (json.Information) return `Alpha Vantage: ${json.Information}`
    return `Alpha Vantage: no data for ${symbol}`
  }
  const easternToUnix = (ts: string) => {
    const [date, time] = ts.split(' ')
    const [y, m, d] = date.split('-')
    const [h, min] = time.split(':')
    return Math.floor(new Date(`${y}-${m}-${d}T${h}:${String(+min).padStart(2, '0')}:00Z`).getTime() / 1000)
  }
  const interval = { '1m': '1min', '5m': '5min', '15m': '15min', '1h': '60min' }[tf] || null
  const get = (size: 'full' | 'compact') =>
    fetchJson(
      interval
        ? `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=${size}&apikey=${key}`
        : `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`,
      { timeoutMs: 15000 },
    )
  let json = (await get('full')) as Record<string, unknown>
  if (interval && !Object.keys(json).some((k) => k.startsWith('Time Series')) && /premium/i.test(json.Information as string)) json = (await get('compact')) as Record<string, unknown>
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
  return rows
}

async function finnhubQuote(symbol: string, key: string) {
  const q = (await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`)) as { c?: number; pc?: number; h?: number; l?: number }
  if (!q || !q.c) throw new Error('Finnhub: no quote')
  return { last: q.c, open: q.pc ?? q.c, high: q.h ?? q.c, low: q.l ?? q.c }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url)
    if (pathname === '/api/brain/status') {
      const e = await withSavedKeys(env, env.SETTINGS)
      return json({ providers: brainStatus(e), keys: await keySources(env, env.SETTINGS), canSave: !!env.SETTINGS })
    }
    if (pathname === '/api/brain/key') {
      if (req.method !== 'PUT' && req.method !== 'DELETE') return json({ error: 'PUT or DELETE only' }, 405)
      if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
      if (!env.SETTINGS) return json({ error: 'Key storage is not set up on this server yet' }, 501)
      if (req.method === 'DELETE') {
        const id = new URL(req.url).searchParams.get('id')
        if (!isSlot(id)) return json({ error: 'Unknown helper' }, 400)
        await env.SETTINGS.delete(storeKey(id))
        return json({ keys: await keySources(env, env.SETTINGS) })
      }
      const body = (await req.json().catch(() => null)) as { id?: unknown; key?: unknown } | null
      const key = cleanKey(body?.key)
      if (!isSlot(body?.id)) return json({ error: 'Unknown helper' }, 400)
      if (!key) return json({ error: 'That does not look like an API key' }, 400)
      await env.SETTINGS.put(storeKey(body.id), key)
      return json({ keys: await keySources(env, env.SETTINGS) })
    }
    if (pathname === '/api/data/key') {
      if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') return json({ error: 'GET, PUT or DELETE only' }, 405)
      if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
      if (!env.SETTINGS) return json({ error: 'Key storage is not set up on this server yet' }, 501)

      // GET: Check which data keys are set (never return values)
      if (req.method === 'GET') {
        const ids = ['alpaca_paper', 'alpha_vantage', 'finnhub'] as const
        const status: Record<string, boolean> = {}
        for (const id of ids) {
          const val = await env.SETTINGS.get(storeKey(id as any)).catch(() => null)
          status[id] = !!val
        }
        return json(status)
      }

      if (req.method === 'DELETE') {
        const id = new URL(req.url).searchParams.get('id')
        const validIds = ['alpaca_paper', 'alpha_vantage', 'finnhub']
        if (!validIds.includes(id ?? '')) return json({ error: 'Unknown provider' }, 400)
        await env.SETTINGS.delete(storeKey(id as any))
        return json({ ok: true })
      }
      const body = (await req.json().catch(() => null)) as { id?: unknown; key?: unknown; keyId?: unknown; secret?: unknown } | null
      const id = body?.id as string | undefined
      const validIds = ['alpaca_paper', 'alpha_vantage', 'finnhub']
      if (!validIds.includes(id ?? '')) return json({ error: 'Unknown provider' }, 400)

      // Handle Alpaca paper keys (two-part: keyId + secret)
      if (id === 'alpaca_paper') {
        const keyId = String(body?.keyId ?? '').trim()
        const secret = String(body?.secret ?? '').trim()
        if (!keyId || !secret) return json({ error: 'Alpaca requires key ID and secret' }, 400)
        await env.SETTINGS.put(storeKey('alpaca_paper' as any), JSON.stringify({ keyId, secret }))
        return json({ ok: true })
      }

      // Handle single-string keys (Alpha Vantage, Finnhub)
      const key = cleanKey(body?.key)
      if (!key) return json({ error: 'That does not look like an API key' }, 400)
      await env.SETTINGS.put(storeKey(id as any), key)
      return json({ ok: true })
    }
    if (pathname === '/api/brain/test') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
      const body = (await req.json().catch(() => null)) as { id?: unknown } | null
      return json(await testProvider(String(body?.id ?? ''), await withSavedKeys(env, env.SETTINGS)))
    }
    if (pathname === '/api/keys/status') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
      const e = await withSavedKeys(env, env.SETTINGS)
      const keys = await keySources(e, env.SETTINGS)
      // Run all checks in parallel with 8s timeout per check
      const promises = keys.map((k) =>
        Promise.race([
          testProvider(k.id, e),
          new Promise<{ ok: boolean; error: string }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000),
          ),
        ])
          .then((test) => ({ id: k.id, name: k.name, ok: test.ok, status: test.ok ? 'OK' : undefined, error: test.error }))
          .catch((e) => ({ id: k.id, name: k.name, ok: false, error: String(e?.message ?? e) === 'timeout' ? 'Timeout (took too long)' : String(e?.message ?? e) })),
      )
      const results = await Promise.all(promises)
      return json({ keys: results })
    }
    if (pathname === '/api/ai-rules') {
      if (req.method === 'GET') {
        if (!env.SETTINGS) return json({ error: 'Settings storage not available' }, 501)
        try {
          const stored = await env.SETTINGS.get('aiRules')
          const rules = stored ? JSON.parse(stored) : null
          return json(rules || {})
        } catch (e) {
          console.error('AI rules fetch error:', e)
          return json({})
        }
      }
      if (req.method === 'PUT') {
        if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
        if (!env.SETTINGS) return json({ error: 'Settings storage not available' }, 501)
        try {
          const body = await req.json().catch(() => null)
          if (!body || typeof body !== 'object') return json({ error: 'Invalid rules object' }, 400)
          await env.SETTINGS.put('aiRules', JSON.stringify(body))
          return json({ ok: true })
        } catch (e) {
          console.error('AI rules save error:', e)
          return json({ error: String(e) }, 500)
        }
      }
      return json({ error: 'GET or PUT only' }, 405)
    }
    if (pathname === '/api/brain') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      const ask = cleanAsk(await req.json().catch(() => null))
      if (!ask) return json({ error: 'No question' }, 400)
      const r = await askBrain(ask, await withSavedKeys(env, env.SETTINGS))
      return r ? json(r) : json({ error: 'No AI helper answered' }, 503)
    }
    if (pathname === '/api/practice/cycle') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      try {
        const result = await practiceCycle(env)
        return json(result)
      } catch (e) {
        console.error('Practice cycle error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/practice/state') {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      try {
        const stored = await env.PRACTICE.get('state')
        const state: PracticeState = stored ? JSON.parse(stored) : null
        return json({ state })
      } catch (e) {
        console.error('Practice state error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname.startsWith('/api/news/')) {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      if (!env.ALPACA_API_KEY_ID || !env.ALPACA_API_SECRET_KEY) return json({ error: 'News service not configured' }, 503)
      const symbol = pathname.slice('/api/news/'.length)
      if (!symbol) return json({ error: 'Symbol required' }, 400)
      try {
        const url = `https://data.alpaca.markets/v1beta1/news?symbols=${encodeURIComponent(symbol)}&limit=10&sort=desc`
        const response = await fetch(url, {
          headers: {
            'APCA-API-KEY-ID': env.ALPACA_API_KEY_ID,
            'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET_KEY,
          },
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) {
          const upstreamError = await response.text().catch(() => '')
          return json({ news: [], upstreamStatus: response.status, upstreamError }, 200)
        }
        const data = (await response.json()) as { news?: Array<{ id: string; headline: string; created_at: string; url: string }> }
        const news = (data.news || []).slice(0, 5)
        return json({ news })
      } catch (e) {
        console.error(`News fetch error for ${symbol}:`, e)
        return json({ news: [], error: String(e) })
      }
    }
    if (pathname === '/api/practice/alerts') {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      try {
        const stored = await env.PRACTICE.get('alerts')
        const alerts = stored ? JSON.parse(stored) : []
        return json({ alerts })
      } catch (e) {
        console.error('Practice alerts error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/practice/alerts/clear') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      try {
        await env.PRACTICE.delete('alerts')
        return json({ ok: true })
      } catch (e) {
        console.error('Practice alerts clear error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/practice/telegram/config') {
      if (req.method === 'GET') {
        try {
          const stored = await env.PRACTICE.get('telegramConfig')
          const config = stored ? JSON.parse(stored) : { token: '', chatId: '' }
          return json({ config })
        } catch (e) {
          console.error('Telegram config error:', e)
          return json({ error: String(e) }, 500)
        }
      }
      if (req.method === 'PUT') {
        if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
        try {
          const body = (await req.json().catch(() => null)) as { token?: string; chatId?: string } | null
          const token = String(body?.token ?? '').replace(/\s/g, '')
          const chatId = String(body?.chatId ?? '').replace(/\s/g, '')
          if (!token || !chatId) return json({ error: 'Token and chatId required' }, 400)
          if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token)) return json({ error: 'Token format looks wrong. It should look like 123456789:AAH... with no spaces.' }, 400)
          const me = await fetch(`https://api.telegram.org/bot${token}/getMe`)
          const meData = (await me.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { username?: string } }
          if (!me.ok || !meData.ok) return json({ error: `Telegram rejected this token (${meData.description ?? me.status}). Token starts with ${token.slice(0, 10)}. Copy it again from BotFather.` }, 400)
          const configJson = JSON.stringify({ token, chatId })
          await env.PRACTICE.put('telegramConfig', configJson)
          return json({ ok: true, bot: meData.result?.username ?? '', config: { token, chatId } })
        } catch (e) {
          console.error('Telegram config put error:', e)
          return json({ error: String(e) }, 500)
        }
      }
      return json({ error: 'GET or PUT only' }, 405)
    }
    if (pathname === '/api/practice/telegram/test') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
      try {
        const stored = await env.PRACTICE.get('telegramConfig')
        const config = stored ? JSON.parse(stored) : null
        if (!config || !config.token || !config.chatId) {
          return json({ error: 'Telegram config not found. Save your token and Chat ID first.' }, 400)
        }
        const { token, chatId } = config
        const testMessage = '✅ Jarvis test message\n\nYour Telegram bot is working! You will now receive trade alerts here.'
        const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`
        const tgRes = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: testMessage,
            parse_mode: 'HTML',
          }),
        })
        const tgData = (await tgRes.json().catch(() => ({}))) as Record<string, unknown>
        if (!tgRes.ok) {
          const description = tgData.description ? String(tgData.description) : 'Error'
          const errorMsg = `Telegram: ${description} (HTTP ${tgRes.status})`
          return json({ error: errorMsg }, 400)
        }
        return json({ ok: true, message: 'Test message sent successfully' })
      } catch (e) {
        console.error('Telegram test error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/market/stocks') {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      try {
        const alpacaKeys = await getAlpacaKeys(env)
        if (!alpacaKeys.keyId) return json({ error: 'Alpaca paper key not configured' }, 400)
        const result = await alpacaMarketLists(alpacaKeys)
        return json(result)
      } catch (e) {
        console.error('Market stocks error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/market/stock/candles') {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      try {
        const url = new URL(req.url)
        const symbol = url.searchParams.get('symbol')
        const tf = url.searchParams.get('tf') as any
        if (!symbol || !tf) return json({ error: 'symbol and tf required' }, 400)
        const alpacaKeys = await getAlpacaKeys(env)
        const avKey = await getAlphaVantageKey(env)
        let candles = null
        if (alpacaKeys.keyId && alpacaKeys.secret) {
          try {
            candles = await alpacaStockCandles(symbol, tf, alpacaKeys)
          } catch (e) {
            if (!avKey) throw e
          }
        }
        if (!candles && avKey) {
          const avCandles = await alphaVantageCandles(symbol, tf, avKey)
          candles = avCandles
        }
        if (!candles) return json({ error: 'No data source available for candles' }, 400)
        return json({ candles })
      } catch (e) {
        console.error('Candles error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/market/stock/snapshot') {
      if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'GET or POST only' }, 405)
      try {
        const url = new URL(req.url)
        let symbols: string[] = []
        if (req.method === 'GET') {
          const s = url.searchParams.get('symbols')
          try {
            symbols = s ? JSON.parse(s) : []
          } catch {
            return json({ error: 'Invalid symbols JSON' }, 400)
          }
        } else {
          const body = (await req.json().catch(() => null)) as { symbols?: unknown } | null
          symbols = Array.isArray(body?.symbols) ? body.symbols.map(String) : []
        }
        if (!symbols.length) return json({ error: 'symbols required' }, 400)
        const alpacaKeys = await getAlpacaKeys(env)
        const fhKey = await getFinnhubKey(env)
        let snapshots: Record<string, { last: number; open: number; high: number; low: number; volume: number }> = {}
        if (alpacaKeys.keyId && alpacaKeys.secret) {
          try {
            snapshots = await alpacaSnapshots(symbols, alpacaKeys)
          } catch (e) {
            if (!fhKey) throw e
          }
        }
        if (!Object.keys(snapshots).length && fhKey) {
          for (const symbol of symbols) {
            try {
              const q = await finnhubQuote(symbol, fhKey)
              snapshots[symbol] = { last: q.last, open: q.open, high: q.high, low: q.low, volume: 0 }
            } catch {
              /* skip this symbol */
            }
          }
        }
        return json({ snapshots })
      } catch (e) {
        console.error('Snapshot error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/broker/snapshot') {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      try {
        const alpacaKeys = await getAlpacaKeys(env)
        if (!alpacaKeys.keyId) return json({ error: 'Alpaca paper key not configured' }, 400)

        const [acct, pos, orders] = await Promise.all([
          alpacaTradingCall<Record<string, string>>('/v2/account', alpacaKeys),
          alpacaTradingCall<Record<string, string>[]>('/v2/positions', alpacaKeys),
          alpacaTradingCall<any[]>('/v2/orders?status=all&limit=100&nested=true&direction=desc', alpacaKeys),
        ])
        const account = {
          equity: +acct.equity,
          cash: +acct.cash,
          buyingPower: +acct.buying_power,
          dayPL: +acct.equity - +acct.last_equity,
          dayPLPct: +acct.last_equity ? ((+acct.equity - +acct.last_equity) / +acct.last_equity) * 100 : 0,
          totalPL: null,
        }
        const positions = pos.map((p: any) => ({
          symbol: p.symbol,
          qty: +p.qty,
          avgCost: +p.avg_entry_price,
          last: +p.current_price,
          marketValue: +p.market_value,
          unrealized: +p.unrealized_pl,
          unrealizedPct: +p.unrealized_plpc * 100,
        }))
        return json({ account, positions, orders, status: acct.status })
      } catch (e) {
        console.error('Broker snapshot error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/broker/history') {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      try {
        const alpacaKeys = await getAlpacaKeys(env)
        if (!alpacaKeys.keyId) return json({ error: 'Alpaca paper key not configured' }, 400)
        const url = new URL(req.url)
        const period = (url.searchParams.get('period') ?? '1D') as '1D' | '1M' | '3M'
        const tf = period === '1D' ? '5Min' : '1D'
        const h = await alpacaTradingCall<{ timestamp: number[]; equity: (number | null)[] }>(`/v2/account/portfolio/history?period=${period}&timeframe=${tf}&extended_hours=true`, alpacaKeys)
        const history = h.timestamp.flatMap((t, i) => (h.equity[i] != null && h.equity[i]! > 0 ? [{ time: t, equity: h.equity[i]! }] : []))
        return json({ history })
      } catch (e) {
        console.error('Broker history error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/broker/place') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      try {
        const alpacaKeys = await getAlpacaKeys(env)
        if (!alpacaKeys.keyId) return json({ error: 'Alpaca paper key not configured' }, 400)
        const body = (await req.json().catch(() => null)) as any
        if (!body) return json({ error: 'Invalid request body' }, 400)
        const result = await alpacaTradingCall('/v2/orders', alpacaKeys, { method: 'POST', body: JSON.stringify(body) })
        return json(result)
      } catch (e) {
        console.error('Broker place error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/broker/cancel') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      try {
        const alpacaKeys = await getAlpacaKeys(env)
        if (!alpacaKeys.keyId) return json({ error: 'Alpaca paper key not configured' }, 400)
        const body = (await req.json().catch(() => null)) as { id?: string } | null
        if (!body?.id) return json({ error: 'id required' }, 400)
        await alpacaTradingCall(`/v2/orders/${encodeURIComponent(body.id)}`, alpacaKeys, { method: 'DELETE' })
        return json({ ok: true })
      } catch (e) {
        console.error('Broker cancel error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/broker/close') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      try {
        const alpacaKeys = await getAlpacaKeys(env)
        if (!alpacaKeys.keyId) return json({ error: 'Alpaca paper key not configured' }, 400)
        const body = (await req.json().catch(() => null)) as { symbol?: string } | null
        if (!body?.symbol) return json({ error: 'symbol required' }, 400)
        const result = await alpacaTradingCall(`/v2/positions/${encodeURIComponent(body.symbol.replace('/', ''))}`, alpacaKeys, { method: 'DELETE' })
        return json(result)
      } catch (e) {
        console.error('Broker close error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    if (pathname === '/api/practice/movers') {
      if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
      try {
        const alpacaKeys = await getAlpacaKeys(env)
        if (!alpacaKeys.keyId) return json({ error: 'Alpaca paper key not configured' }, 400)
        const url = new URL(req.url)
        const limit = parseInt(url.searchParams.get('limit') ?? '10', 10)
        const threshold = parseFloat(url.searchParams.get('threshold') ?? '2')
        const movers = await alpacaMovers(alpacaKeys, limit, threshold)
        return json({ movers })
      } catch (e) {
        console.error('Practice movers error:', e)
        return json({ error: String(e) }, 500)
      }
    }
    return env.ASSETS.fetch(req)
  },
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const now = new Date()
    const utcHour = now.getUTCHours()
    const utcDay = now.getUTCDay()
    // Market hours: 13:00-21:55 UTC (9am-4:55pm ET), Mon-Fri
    if (utcDay >= 1 && utcDay <= 5 && utcHour >= 13 && utcHour <= 21) {
      console.log('Practice cycle triggered by Cron')
      try {
        const result = await practiceCycle(env)
        console.log('Practice cycle result:', result.message)
      } catch (e) {
        console.error('Practice cycle error:', e)
      }
    }
  },
}
