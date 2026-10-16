/**
 * Free-AI keys typed into Settings. They are stored in the Worker's KV (never in the browser or
 * the repo), merged over any server secrets, and are never sent back: the app only learns
 * whether a helper is on and where its key came from.
 */
import { callHelper, PROVIDERS, systemPrompt, type BrainEnv } from './brainServer'

/** Plain next step for the usual refusals. */
function hint(why: string): string {
  if (/HTTP 40[13]/.test(why)) return 'The key is wrong, expired or not allowed for this model: make a new one.'
  if (/HTTP 429/.test(why)) return 'Free limit used up for now: try again later.'
  if (/HTTP 404/.test(why)) return 'The AI model name is not available for this key.'
  if (/HTTP 400/.test(why)) return 'The helper rejected the request.'
  return ''
}

export interface KeyStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

export const KEY_SLOTS = [
  { id: 'gemini', env: 'GEMINI_API_KEY' },
  { id: 'groq', env: 'GROQ_API_KEY' },
  { id: 'nvidia', env: 'NVIDIA_API_KEY' },
  { id: 'alpaca', env: 'ALPACA_API_KEY' },
] as const

export type KeySlotId = (typeof KEY_SLOTS)[number]['id']

export const isSlot = (id: unknown): id is KeySlotId => KEY_SLOTS.some((s) => s.id === id)
export const storeKey = (id: KeySlotId) => `brainkey:${id}`

/** A pasted key, trimmed; null when it can't be an API key (spaces, markup, too short or long). */
export function cleanKey(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const k = v.trim()
  return /^[A-Za-z0-9_\-.:]{20,200}$/.test(k) ? k : null
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

export async function keySources(env: BrainEnv, store?: KeyStore): Promise<KeyStatus[]> {
  const out: KeyStatus[] = []
  for (const s of KEY_SLOTS) {
    const name = PROVIDERS.find((p) => p.id === s.id)?.name ?? s.id
    const saved = store ? await store.get(storeKey(s.id)).catch(() => null) : null
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

/** One tiny call to one helper. Never returns the key or the answer. */
export async function testProvider(id: string, env: BrainEnv, f: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  const p = PROVIDERS.find((x) => x.id === id)
  const key = p?.key(env)
  if (!p || !isSlot(id)) return { ok: false, error: 'Unknown helper' }
  if (!key) return { ok: false, error: 'No key saved for this helper' }
  let why = ''
  try {
    const text = await callHelper(p, key, env, systemPrompt('en'), 'Reply with the single word: pong', f, (status, reason) => {
      why = `${status ? `HTTP ${status}` : ''}${reason ? `${status ? ': ' : ''}${reason}` : ''}`
    })
    if (text?.trim()) return { ok: true }
    return { ok: false, error: `${p.name} refused${why ? ` (${why})` : ''}. ${hint(why)}`.trim() }
  } catch (e) {
    return { ok: false, error: `Could not reach ${p.name} (${String((e as Error)?.message ?? e).slice(0, 120)})` }
  }
}
