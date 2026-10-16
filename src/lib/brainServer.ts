/**
 * The free-AI helper, run on our Cloudflare Worker so keys never reach the browser or the repo.
 * Jarvis only calls it when his own rules don't understand a question. Providers are tried in
 * order (Gemini, Groq, xAI Grok, NVIDIA NIM) and only those with a key set as a Worker secret
 * are used. The AI rewords and explains; it never decides or places a trade.
 */

export interface BrainEnv {
  GEMINI_API_KEY?: string
  GROQ_API_KEY?: string
  XAI_API_KEY?: string
  NVIDIA_API_KEY?: string
  GEMINI_MODEL?: string
  GROQ_MODEL?: string
  XAI_MODEL?: string
  NVIDIA_MODEL?: string
}

export interface BrainAsk {
  question: string
  lang: 'en' | 'vi'
  /** What Jarvis already knows from the app's own records, in plain sentences. */
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
  call: (key: string, model: string | undefined, system: string, user: string, f: Fetch, onFail?: OnFail) => Promise<string | null>
}

const LIMIT = { question: 500, fact: 400, facts: 12, answer: 450 }

/** A Groq key starts gsk_, an xAI key xai-: either slot accepts either, so a pasted key just works. */
const keyFor = (e: BrainEnv, prefix: string) => [e.GROQ_API_KEY, e.XAI_API_KEY].find((k) => k?.startsWith(prefix))

const openAiStyle = (url: string) => async (key: string, model: string | undefined, system: string, user: string, f: Fetch, onFail?: OnFail) => {
  const r = await f(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: LIMIT.answer, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!r.ok) {
    onFail?.(r.status, await failReason(r))
    return null
  }
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
  const text = j.choices?.[0]?.message?.content ?? null
  if (!text?.trim()) onFail?.(r.status, 'answered with no text')
  return text
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    key: (e) => e.GEMINI_API_KEY,
    models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'],
    call: async (key, model, system, user, f, onFail) => {
      const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        // thinking off: on 2.5 Flash it can spend the whole token budget and return no text
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: LIMIT.answer, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } } }),
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
  { id: 'groq', name: 'Groq', key: (e) => keyFor(e, 'gsk_'), models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'], call: openAiStyle('https://api.groq.com/openai/v1/chat/completions') },
  { id: 'xai', name: 'Grok', key: (e) => keyFor(e, 'xai-'), models: ['grok-3-mini'], call: openAiStyle('https://api.x.ai/v1/chat/completions') },
  // meta/llama-3.3-70b-instruct was retired on 2026-08-26
  { id: 'nvidia', name: 'NVIDIA NIM', key: (e) => e.NVIDIA_API_KEY, models: ['nvidia/llama-3.1-nemotron-70b-instruct', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'openai/gpt-oss-20b'], call: openAiStyle('https://integrate.api.nvidia.com/v1/chat/completions') },
]

export const modelFor = (id: string, e: BrainEnv) => ({ gemini: e.GEMINI_MODEL, groq: e.GROQ_MODEL, xai: e.XAI_MODEL, nvidia: e.NVIDIA_MODEL })[id]

/** A refusal that means "this model is gone or unknown", not "bad key" or "over the limit". */
const modelGone = (status: number, reason: string) => status === 404 || status === 410 || (status === 400 && /model|decommission/i.test(reason))

/** Calls one helper, moving to its next model when the provider says a model no longer exists. */
export async function callHelper(p: Provider, key: string, e: BrainEnv, system: string, user: string, f: Fetch, onFail?: OnFail): Promise<string | null> {
  const pinned = modelFor(p.id, e)
  const list = pinned ? [pinned, ...p.models.filter((m) => m !== pinned)] : p.models
  for (const model of list) {
    let gone = false
    const text = await p.call(key, model, system, user, f, (status, reason) => {
      gone = modelGone(status, reason)
      onFail?.(status, reason)
    })
    if (text?.trim() || !gone) return text
  }
  return null
}

/** Which helpers have a key. Never returns the keys themselves. */
export const brainStatus = (e: BrainEnv) => PROVIDERS.map((p) => ({ id: p.id, name: p.name, on: !!p.key(e) }))

export function systemPrompt(lang: 'en' | 'vi') {
  return [
    "You are Jarvis, the Arc Brain: a calm, honest trading mentor inside a PAPER trading practice app. No real money is involved.",
    'Answer the question in 2 to 4 short, plain sentences, like a person talking. No markdown, lists or headings.',
    'Use the facts given about the app first. If the facts do not cover the question, you may explain general trading ideas, and say so.',
    'Never invent numbers, prices or trades that are not in the facts. Never promise or predict profits. Never tell the user to buy or sell real stocks; this is practice only.',
    'Do not claim you can change settings or place trades; the app does that only after the user taps to confirm.',
    lang === 'vi' ? 'Reply in Vietnamese.' : 'Reply in English.',
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
export async function askBrain(ask: BrainAsk, e: BrainEnv, f: Fetch = fetch): Promise<{ text: string; by: string } | null> {
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
