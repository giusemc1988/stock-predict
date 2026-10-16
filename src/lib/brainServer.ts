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
  OLLAMA_URL?: string
}

export interface BrainAsk {
  question: string
  lang: 'en' | 'vi'
  /** What Jarvis already knows from the app's own records, in plain sentences. */
  facts: string[]
}

type Fetch = typeof fetch

interface Provider {
  id: string
  name: string
  key: (e: BrainEnv) => string | undefined
  call: (key: string, model: string | undefined, system: string, user: string, f: Fetch) => Promise<string | null>
}

const LIMIT = { question: 500, fact: 400, facts: 12, answer: 450 }

/** A Groq key starts gsk_, an xAI key xai-: either slot accepts either, so a pasted key just works. */
const keyFor = (e: BrainEnv, prefix: string) => [e.GROQ_API_KEY, e.XAI_API_KEY].find((k) => k?.startsWith(prefix))

const openAiStyle = (url: string, fallbackModel: string) => async (key: string, model: string | undefined, system: string, user: string, f: Fetch) => {
  const r = await f(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || fallbackModel, max_tokens: LIMIT.answer, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!r.ok) return null
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
  return j.choices?.[0]?.message?.content ?? null
}

export const PROVIDERS: Provider[] = [
  {
    id: 'ollama',
    name: 'Local AI',
    key: (e) => e.OLLAMA_URL ? 'local' : undefined,
    call: async (key, model, system, user, f) => {
      const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
      const r = await f(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: model || 'llama2', max_tokens: LIMIT.answer, temperature: 0.4, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      })
      if (!r.ok) return null
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
      return j.choices?.[0]?.message?.content ?? null
    },
  },
  {
    id: 'gemini',
    name: 'Gemini',
    key: (e) => e.GEMINI_API_KEY,
    call: async (key, model, system, user, f) => {
      const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { maxOutputTokens: LIMIT.answer, temperature: 0.4 } }),
      })
      if (!r.ok) return null
      const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') || null
    },
  },
  { id: 'groq', name: 'Groq', key: (e) => keyFor(e, 'gsk_'), call: openAiStyle('https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile') },
  { id: 'xai', name: 'Grok', key: (e) => keyFor(e, 'xai-'), call: openAiStyle('https://api.x.ai/v1/chat/completions', 'grok-3-mini') },
  { id: 'nvidia', name: 'NVIDIA NIM', key: (e) => e.NVIDIA_API_KEY, call: openAiStyle('https://integrate.api.nvidia.com/v1/chat/completions', 'meta/llama-3.3-70b-instruct') },
]

const modelFor = (id: string, e: BrainEnv) => ({ gemini: e.GEMINI_MODEL, groq: e.GROQ_MODEL, xai: e.XAI_MODEL, nvidia: e.NVIDIA_MODEL })[id]

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
      const text = (await p.call(key, modelFor(p.id, e), systemPrompt(ask.lang), user, f))?.trim()
      if (text) return { text, by: p.name }
    } catch {
      // a helper that is down or over its free limit: try the next one
    }
  }
  return null
}
