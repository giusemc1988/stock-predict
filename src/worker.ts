/**
 * Cloudflare Worker: serves the app's built files and one small API, /api/brain, for Jarvis's
 * free-AI helper. Keys are Worker secrets (wrangler secret put GEMINI_API_KEY, etc.).
 * Also serves /api/practice for live paper trading via Cron every 5 minutes.
 */
import { askBrain, brainStatus, cleanAsk, type BrainEnv } from './lib/brainServer'
import { practiceCycle, type WorkerEnv as PracticeEnv } from './worker/practiceCycle'
import { cleanKey, isSlot, keySources, sameOrigin, storeKey, testProvider, withSavedKeys, type KeyStore } from './lib/brainKeys'
import type { PracticeState } from './lib/practice'

interface Env extends BrainEnv, PracticeEnv {
  ASSETS: { fetch: (r: Request) => Promise<Response> }
  /** KV that holds the AI keys typed into Settings. */
  SETTINGS?: KeyStore
  /** Alpaca API key for news endpoint (Worker secret via wrangler secret put) */
  ALPACA_API_KEY?: string
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

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
    if (pathname === '/api/brain/test') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
      const body = (await req.json().catch(() => null)) as { id?: unknown } | null
      return json(await testProvider(String(body?.id ?? ''), await withSavedKeys(env, env.SETTINGS)))
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
      if (!env.ALPACA_API_KEY) return json({ error: 'News service not configured' }, 503)
      const symbol = pathname.slice('/api/news/'.length)
      if (!symbol) return json({ error: 'Symbol required' }, 400)
      try {
        const url = `https://data.alpaca.markets/v1beta3/news?symbols=${encodeURIComponent(symbol)}&limit=10&sort=desc`
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${env.ALPACA_API_KEY}` },
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) {
          // 404, 429, or other errors — return empty news
          return json({ news: [] })
        }
        const data = (await response.json()) as { news?: Array<{ id: string; headline: string; created_at: string; url: string }> }
        const news = (data.news || []).slice(0, 5)
        return json({ news })
      } catch (e) {
        console.error(`News fetch error for ${symbol}:`, e)
        return json({ news: [] })
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
          console.log('[telegram/config PUT] Received token:', token ? `${token.substring(0, 30)}... (len: ${token.length})` : 'empty')
          console.log('[telegram/config PUT] Received chatId:', chatId)
          if (!token || !chatId) return json({ error: 'Token and chatId required' }, 400)
          const configJson = JSON.stringify({ token, chatId })
          console.log('[telegram/config PUT] Storing to KV:', configJson.substring(0, 100) + '...')
          await env.PRACTICE.put('telegramConfig', configJson)
          console.log('[telegram/config PUT] Stored successfully')
          return json({ ok: true, config: { token, chatId } })
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
        console.log('[telegram/test] Stored KV value:', stored ? `${stored.substring(0, 100)}...` : 'null/undefined')
        const config = stored ? JSON.parse(stored) : null
        console.log('[telegram/test] Parsed config:', config ? { token: config.token ? config.token.substring(0, 30) : null, chatId: config.chatId } : null)
        if (!config || !config.token || !config.chatId) {
          return json({ error: 'Telegram config not found. Save your token and Chat ID first.' }, 400)
        }
        const { token, chatId } = config
        const testMessage = '✅ Jarvis test message\n\nYour Telegram bot is working! You will now receive trade alerts here.'
        const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`
        console.log('[telegram/test] Built URL:', telegramUrl.substring(0, 60) + '...')
        console.log('[telegram/test] Token length:', token.length)
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
        console.log('[telegram/test] Telegram response status:', tgRes.status, 'data:', JSON.stringify(tgData).substring(0, 200))
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
