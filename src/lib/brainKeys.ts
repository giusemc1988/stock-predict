/**
 * All API keys typed into Settings. They are stored in the Worker's KV (never in the browser or
 * the repo), and are never sent back: the app only learns whether a key is set and whether it works.
 */
import { callHelper, PROVIDERS, systemPrompt, type BrainEnv } from './brainServer'

/** Plain next step for the usual refusals. */
function hint(why: string): string {
  if (/HTTP 40[13]/.test(why)) return 'The key is wrong, expired or not allowed: make a new one.'
  if (/HTTP 429/.test(why)) return 'Free limit used up for now: try again later.'
  if (/HTTP 404/.test(why)) return 'The service does not recognize this key or model.'
  if (/HTTP 400/.test(why)) return 'The service rejected the request.'
  return ''
}

export interface KeyStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

export const KEY_SLOTS = [
  // AI providers
  { id: 'gemini', env: 'GEMINI_API_KEY', category: 'ai' as const },
  { id: 'groq', env: 'GROQ_API_KEY', category: 'ai' as const },
  { id: 'nvidia', env: 'NVIDIA_API_KEY', category: 'ai' as const },
  { id: 'xai', env: 'XAI_API_KEY', category: 'ai' as const },
  // Trading data providers
  { id: 'alpaca_paper', env: 'ALPACA_PAPER_KEY', category: 'data' as const },
  { id: 'alpha_vantage', env: 'ALPHA_VANTAGE_KEY', category: 'data' as const },
  { id: 'finnhub', env: 'FINNHUB_KEY', category: 'data' as const },
] as const

export type KeySlotId = (typeof KEY_SLOTS)[number]['id']

export const isSlot = (id: unknown): id is KeySlotId => KEY_SLOTS.some((s) => s.id === id)
export const storeKey = (id: KeySlotId) => `brainkey:${id}`

/** A pasted key, trimmed; null when it can't be an API key (spaces, markup, too short or long). */
export function cleanKey(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const k = v.trim()
  if (k.length < 10 || k.length > 1000) return null
  if (/[\s<>"{}|\\^`]/.test(k)) return null
  return k
}

/** Saved keys win over server secrets, so a key typed in Settings takes effect right away. */
export async function withSavedKeys(env: BrainEnv, store?: KeyStore): Promise<BrainEnv> {
  if (!store) return env
  const out: BrainEnv = { ...env }
  for (const s of KEY_SLOTS) {
    const saved = await store.get(storeKey(s.id)).catch(() => null)
    if (saved) out[s.env] = saved
  }
  return out
}

export interface KeyStatus {
  id: string
  name: string
  on: boolean
  source: 'saved' | 'server' | 'none'
}

const NAMES: Record<string, string> = {
  gemini: 'Gemini', groq: 'Groq', nvidia: 'NVIDIA NIM', xai: 'Grok',
  alpaca_paper: 'Alpaca (paper)', alpha_vantage: 'Alpha Vantage', finnhub: 'Finnhub',
}

export async function keySources(env: BrainEnv & any, store?: KeyStore): Promise<KeyStatus[]> {
  const out: KeyStatus[] = []
  for (const s of KEY_SLOTS) {
    const name = NAMES[s.id]
    const saved = store ? await store.get(storeKey(s.id as any)).catch(() => null) : null
    const server = !!env[s.env]
    out.push({ id: s.id, name, on: !!saved || server, source: saved ? 'saved' : server ? 'server' : 'none' })
  }
  return out
}

/** Writes must come from this site's own pages: a browser always sends Origin on PUT, DELETE and POST. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  return !!origin && origin === new URL(req.url).origin
}

/** Test an AI provider with a tiny call. Never returns the key or the answer. */
export async function testAiProvider(id: string, env: BrainEnv, f: typeof fetch = fetch): Promise<{ ok: boolean; model?: string; error?: string }> {
  const p = PROVIDERS.find((x) => x.id === id)
  const key = p?.key(env)
  if (!p || !isSlot(id) || KEY_SLOTS.find(s => s.id === id)?.category !== 'ai') return { ok: false, error: 'Unknown helper' }
  if (!key) return { ok: false, error: 'No key saved' }

  let why = ''
  try {
    const text = await callHelper(p, key, env, systemPrompt('en'), 'Reply with the single word: pong', f, (status, reason) => {
      why = `${status ? `HTTP ${status}` : ''}${reason ? `${status ? ': ' : ''}${reason}` : ''}`
    })
    if (text?.trim()) {
      const modelMap: Record<string, string | undefined> = {
        gemini: env.GEMINI_MODEL,
        groq: env.GROQ_MODEL,
        xai: env.XAI_MODEL,
        nvidia: env.NVIDIA_MODEL
      }
      const modelFor = modelMap[id]
      const model = modelFor || p.models[0]
      return { ok: true, model }
    }
    return { ok: false, error: `${p.name} refused${why ? ` (${why})` : ''}. ${hint(why)}`.trim() }
  } catch (e) {
    return { ok: false, error: `Could not reach ${p.name} (${String((e as Error)?.message ?? e).slice(0, 120)})` }
  }
}

/** Test a data provider's key by making a real API call. Never returns the key. */
export async function testDataProvider(id: string, env: any, f: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  const slot = KEY_SLOTS.find(s => s.id === id)
  if (!slot || slot.category !== 'data') return { ok: false, error: 'Unknown data provider' }

  const key = env[slot.env]
  if (!key) return { ok: false, error: 'No key saved' }

  try {
    switch (id) {
      case 'alpaca_paper': {
        // Parse JSON {keyId, secret} format
        let keyId = '', secret = ''
        try {
          const parsed = typeof key === 'string' ? JSON.parse(key) : key
          if (typeof parsed === 'object' && parsed.keyId && parsed.secret) {
            keyId = parsed.keyId
            secret = parsed.secret
          }
        } catch {
          return { ok: false, error: 'Alpaca key format error (expected JSON with keyId and secret)' }
        }
        if (!keyId || !secret) return { ok: false, error: 'Alpaca key incomplete' }

        const r = await f('https://paper-api.alpaca.markets/v2/account', {
          headers: { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secret },
          signal: AbortSignal.timeout(5000),
        })
        if (r.ok) return { ok: true }
        const status = r.status
        const text = await r.text().catch(() => '')
        return { ok: false, error: `HTTP ${status}${text ? ': ' + text.slice(0, 100) : ''}` }
      }
      case 'alpha_vantage': {
        const r = await f(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=AAPL&apikey=${encodeURIComponent(key)}`, {
          signal: AbortSignal.timeout(5000),
        })
        if (r.ok) {
          const j = (await r.json()) as { Note?: string; Information?: string }
          if (j.Note || j.Information) return { ok: false, error: j.Note || j.Information }
          return { ok: true }
        }
        return { ok: false, error: `HTTP ${r.status}` }
      }
      case 'finnhub': {
        const r = await f(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key)}`, {
          signal: AbortSignal.timeout(5000),
        })
        if (r.ok) {
          const j = (await r.json()) as { error?: string }
          if (j.error) return { ok: false, error: j.error }
          return { ok: true }
        }
        return { ok: false, error: `HTTP ${r.status}` }
      }
      default:
        return { ok: false, error: 'Unsupported data provider' }
    }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 120)
    return { ok: false, error: `Connection error: ${msg}` }
  }
}

/** Test any provider. */
export async function testProvider(id: string, env: BrainEnv & any, f: typeof fetch = fetch): Promise<{ ok: boolean; model?: string; error?: string }> {
  const slot = KEY_SLOTS.find(s => s.id === id)
  if (!slot) return { ok: false, error: 'Unknown provider' }
  if (slot.category === 'ai') return testAiProvider(id, env, f)
  if (slot.category === 'data') return testDataProvider(id, env, f) as Promise<{ ok: boolean; model?: string; error?: string }>
  return { ok: false, error: 'Unknown provider type' }
}
