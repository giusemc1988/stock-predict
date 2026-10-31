/**
 * The free-AI helper, run on our Cloudflare Worker so keys never reach the browser or the repo.
 * Neo only calls it when his own rules don't understand a question. Providers are tried in
 * order (Gemini, Groq, xAI Grok, NVIDIA NIM) and only those with a key set as a Worker secret
 * are used. The AI rewords and explains; it never decides or places a trade.
 */

export interface BrainEnv {
  GEMINI_API_KEY?: string
  GROQ_API_KEY?: string
  XAI_API_KEY?: string
  NVIDIA_API_KEY?: string
  TELEGRAM_BOT_TOKEN?: string
  ALPACA_PAPER_KEY?: string
  ALPHA_VANTAGE_KEY?: string
  FINNHUB_KEY?: string
  GEMINI_MODEL?: string
  GROQ_MODEL?: string
  XAI_MODEL?: string
  NVIDIA_MODEL?: string
}

export interface BrainAsk {
  question: string
  lang: 'en' | 'vi'
  /** What Neo already knows from the app's own records, in plain sentences. */
  facts: string[]
}

type Fetch = typeof fetch
/** Receives a helper's refusal (HTTP status and a short reason) when it does not answer. */
export type OnFail = (status: number, reason: string) => void

/** The provider's own error message, shortened, with anything key-like masked. */
async function failReason(r: Response): Promise<string> {
  const raw = await r.text().catch(() => '')
  let msg = raw
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } | string; message?: string; detail?: string }
    msg = (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? j.detail ?? raw
  } catch {
    /* not JSON */
  }
  return msg.replace(/[A-Za-z0-9_\-]{24,}/g, '…').replace(/\s+/g, ' ').trim().slice(0, 160)
}

interface Provider {
  id: string
  name: string
  /** Models to try in order; providers retire models, so a gone model falls through to the next. */
  models: string[]
  key: (e: BrainEnv) => string | undefined
  /** Asks the provider which models it serves right now, best first (undefined = use `models` only). */
  list?: (key: string, f: Fetch) => Promise<string[]>
  call: (key: string, model: string | undefined, system: string, user: string, f: Fetch, onFail?: OnFail, maxTokens?: number) => Promise<string | null>
}

const LIMIT = { question: 500, fact: 400, facts: 12, answer: 450 }

/** A Groq key starts gsk_, an xAI key xai-: either slot accepts either, so a pasted key just works. */
const keyFor = (e: BrainEnv, prefix: string) => [e.GROQ_API_KEY, e.XAI_API_KEY].find((k) => k?.startsWith(prefix))

const openAiStyle = (url: string) => async (key: string, model: string | undefined, system: string, user: string, f: Fetch, onFail?: OnFail, maxTokens = LIMIT.answer) => {
  const r = await f(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!r.ok) {
    onFail?.(r.status, await failReason(r))
    return null
  }
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
  const text = j.choices?.[0]?.message?.content ?? null
  if (!text?.trim()) onFail?.(429, 'quota or rate limit exceeded (empty response)')
  return text
}


/** Newest first: "gemini-3.1-flash" before "gemini-2.5-flash". Pure, tested. */
export function rankGemini(models: { name?: string; supportedGenerationMethods?: string[] }[]): string[] {
  const BAD = /preview|exp|thinking|image|tts|live|audio|embed|vision|robotics|computer|learnlm|gemma|nano|banana|customtools|deep-research|aqa/i
  const ids = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((id) => /^gemini-\d/.test(id) && /flash/.test(id) && !BAD.test(id))
  const ver = (id: string) => Number(id.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  const rank = (id: string) => (/lite/.test(id) ? 1 : 0)
  // plain flash of the newest version first, then its lite sibling, then older versions
  return [...new Set(ids)].sort((a, b) => ver(b) - ver(a) || rank(a) - rank(b) || a.localeCompare(b))
}

/** Groq: active chat models, llama first (reasoning models can spend the whole token budget thinking). */
export function rankGroq(models: { id?: string; active?: boolean }[]): string[] {
  const BAD = /whisper|guard|tts|playai|orpheus|safeguard|compound|distil|embed|vision-preview/i
  const ids = models.filter((m) => m.active !== false).map((m) => m.id ?? '').filter((id) => id && !BAD.test(id))
  const pref = [/llama-3\.3-70b/, /llama-?4/, /llama.*70b/, /qwen/, /gpt-oss-120b/, /gpt-oss-20b/, /llama.*(8b|instant)/]
  const score = (id: string) => { const i = pref.findIndex((r) => r.test(id)); return i < 0 ? pref.length : i }
  return [...new Set(ids)].sort((a, b) => score(a) - score(b) || b.localeCompare(a))
}

async function listGemini(key: string, f: Fetch): Promise<string[]> {
  const r = await f('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } })
  if (!r.ok) return []
  return rankGemini(((await r.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] }).models ?? [])
}

/** xAI and NVIDIA speak the OpenAI dialect: GET /models lists what they serve. */
const OPENAI_LIST = (url: string, rank: (ids: string[]) => string[]) => async (key: string, f: Fetch): Promise<string[]> => {
  const r = await f(url, { headers: { authorization: `Bearer ${key}` } })
  if (!r.ok) return []
  return rank((((await r.json()) as { data?: { id?: string }[] }).data ?? []).map((m) => m.id ?? '').filter(Boolean))
}
const BAD_CHAT = /vision|embed|reward|guard|safety|parse|retriever|image|video|audio|tts|asr|rerank|code|translate|clip|ocr|fuyu|neva|vila/i
export const rankXai = (ids: string[]) => ids.filter((id) => /^grok-/.test(id) && !BAD_CHAT.test(id)).sort((a, b) => Number(b.match(/grok-(\d+(?:\.\d+)?)/)?.[1] ?? 0) - Number(a.match(/grok-(\d+(?:\.\d+)?)/)?.[1] ?? 0) || Number(/mini/.test(b)) - Number(/mini/.test(a)))
export const rankNvidia = (ids: string[]) => {
  const pref = [/nemotron.*(super|ultra|70b)/, /nemotron/, /llama-3\.3.*instruct/, /llama-?4/, /llama-3\.1.*70b.*instruct/, /gpt-oss/]
  const score = (id: string) => { const i = pref.findIndex((r) => r.test(id)); return i < 0 ? 99 : i }
  return ids.filter((id) => score(id) < 99 && !BAD_CHAT.test(id)).sort((a, b) => score(a) - score(b) || b.localeCompare(a))
}

async function listGroq(key: string, f: Fetch): Promise<string[]> {
  const r = await f('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${key}` } })
  if (!r.ok) return []
  return rankGroq(((await r.json()) as { data?: { id?: string; active?: boolean }[] }).data ?? [])
}

/** What each provider served last, for the Settings test. */
export const usedModel = new Map<string, string>()

// the live model list changes rarely: remember it for 6 hours (a failed lookup for 10 minutes)
const LIVE_TTL = 6 * 3600_000
const FAIL_TTL = 10 * 60_000
const live = new Map<string, { at: number; ids: string[]; ttl: number }>()

/** Models to try, in order: the one pinned in Settings, the provider's own live list (newest first), then the built-in list. */
export async function modelsToTry(p: Provider, key: string, e: BrainEnv, f: Fetch): Promise<string[]> {
  let ids: string[] = []
  if (p.list) {
    const hit = live.get(p.id)
    if (hit && Date.now() - hit.at < hit.ttl) ids = hit.ids
    else {
      try {
        ids = await p.list(key, f)
      } catch {
        ids = []
      }
      live.set(p.id, { at: Date.now(), ids, ttl: ids.length ? LIVE_TTL : FAIL_TTL })
    }
  }
  const pinned = modelFor(p.id, e)
  return [...new Set([...(pinned ? [pinned] : []), ...ids.slice(0, 3), ...p.models])].slice(0, 6)
}

/** Forget the live lists (tests, and the Settings "test" button). */
export const forgetLiveModels = () => live.clear()

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    key: (e) => e.GEMINI_API_KEY,
    models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'],
    list: listGemini,
    call: async (key, model, system, user, f, onFail, maxTokens = LIMIT.answer) => {
      const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        // thinking off: on 2.5 Flash it can spend the whole token budget and return no text
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } } }),
      })
      if (!r.ok) {
        onFail?.(r.status, await failReason(r))
        return null
      }
      const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] }
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') || null
      if (!text) onFail?.(r.status, `answered with no text${j.candidates?.[0]?.finishReason ? ` (${j.candidates[0].finishReason})` : ''}`)
      return text
    },
  },
  { id: 'groq', name: 'Groq', key: (e) => keyFor(e, 'gsk_'), models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'], list: listGroq, call: openAiStyle('https://api.groq.com/openai/v1/chat/completions') },
  { id: 'xai', name: 'Grok', key: (e) => keyFor(e, 'xai-'), models: ['grok-3-mini'], list: OPENAI_LIST('https://api.x.ai/v1/models', rankXai), call: openAiStyle('https://api.x.ai/v1/chat/completions') },
  // meta/llama-3.3-70b-instruct was retired on 2026-08-26
  { id: 'nvidia', name: 'NVIDIA NIM', key: (e) => e.NVIDIA_API_KEY, models: ['nvidia/llama-3.1-nemotron-70b-instruct', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'openai/gpt-oss-20b'], list: OPENAI_LIST('https://integrate.api.nvidia.com/v1/models', rankNvidia), call: openAiStyle('https://integrate.api.nvidia.com/v1/chat/completions') },
]

export const modelFor = (id: string, e: BrainEnv) => ({ gemini: e.GEMINI_MODEL, groq: e.GROQ_MODEL, xai: e.XAI_MODEL, nvidia: e.NVIDIA_MODEL })[id]

/** A refusal that means "this model is gone or unknown", not "bad key". */
const modelGone = (status: number, reason: string) => status === 404 || status === 410 || (status === 400 && /model|decommission/i.test(reason))
/** Worth trying the next model: gone, or this model's own free quota / capacity is used up (limits are per model). */
const tryNext = (status: number, reason: string) => modelGone(status, reason) || status === 429 || status === 503 || status === 500

/** Calls one helper, moving to its next model when a model is gone, retired, rate-limited or busy. */
export async function callHelper(p: Provider, key: string, e: BrainEnv, system: string, user: string, f: Fetch, onFail?: OnFail, maxTokens?: number): Promise<string | null> {
  const list = await modelsToTry(p, key, e, f)
  let last: string | null = null
  for (const model of list) {
    let next = false
    const text = await p.call(key, model, system, user, f, (status, reason) => {
      next = tryNext(status, reason)
      onFail?.(status, reason)
    }, maxTokens)
    if (text?.trim()) {
      usedModel.set(p.id, model)
      return text
    }
    last = text
    if (!next) return last
  }
  return null
}

/** Which helpers have a key. Never returns the keys themselves. */
export const brainStatus = (e: BrainEnv) => PROVIDERS.map((p) => ({ id: p.id, name: p.name, on: !!p.key(e) }))

export function systemPrompt(lang: 'en' | 'vi') {
  const langInstruction = lang === 'vi'
    ? 'ALWAYS respond entirely in Vietnamese. Every word, every sentence must be Vietnamese.'
    : 'ALWAYS respond entirely in English. Every word, every sentence must be English.'
  return [
    langInstruction,
    "You are Neo, the calm, honest assistant that runs Chanh's personal hub of projects (Atlas stock practice, Iris globe, Echo sensing, Volt ESP32 lab, Nexus Wi-Fi tools, Nova video studio, Viraltech social channels, Lumi media lab, Max app builder). On a project's page you speak as that project's agent; the facts say which. Trading in the hub is PAPER practice only. No real money is involved.",
    'Answer the question in 2 to 4 short, plain sentences, like a person talking. No markdown, lists or headings.',
    'Use the facts given about the app first. If the facts do not cover the question, you may explain general trading ideas, and say so.',
    'Never invent numbers, prices or trades that are not in the facts. Never promise or predict profits. Never tell the user to buy or sell real stocks; this is practice only.',
    'Do not claim you can change settings or place trades; the app does that only after the user taps to confirm.',
  ].join(' ')
}

/** Clean and cap what the browser sent, so a request can't be used as a free general-purpose AI. */
export function cleanAsk(body: unknown): BrainAsk | null {
  const b = body as Partial<BrainAsk> | null
  if (!b || typeof b.question !== 'string' || !b.question.trim()) return null
  const facts = Array.isArray(b.facts) ? b.facts.filter((x): x is string => typeof x === 'string').slice(0, LIMIT.facts).map((x) => x.slice(0, LIMIT.fact)) : []
  return { question: b.question.trim().slice(0, LIMIT.question), lang: b.lang === 'vi' ? 'vi' : 'en', facts }
}

/** Ask each helper with a key, in order, until one answers. */
const timedFetch: Fetch = (i, init) => fetch(i, { ...init, signal: AbortSignal.timeout(12_000) })
export async function askBrain(ask: BrainAsk, e: BrainEnv, f: Fetch = timedFetch): Promise<{ text: string; by: string } | null> {
  const user = `Facts from the app:\n${ask.facts.map((x) => `- ${x}`).join('\n') || '- (none)'}\n\nQuestion: ${ask.question}`
  for (const p of PROVIDERS) {
    const key = p.key(e)
    if (!key) continue
    try {
      const text = (await callHelper(p, key, e, systemPrompt(ask.lang), user, f))?.trim()
      if (text) return { text, by: p.name }
    } catch {
      // a helper that is down or over its free limit: try the next one
    }
  }
  return null
}
