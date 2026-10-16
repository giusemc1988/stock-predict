/** Client-side Ollama integration: call local AI running at localhost:11434 from the browser.
 * Requires Ollama to be configured with OLLAMA_ORIGINS to allow the app's origin.
 */

export interface OllamaRequest {
  question: string
  facts: string[]
  lang: 'en' | 'vi'
}

function systemPrompt(lang: 'en' | 'vi') {
  return [
    "You are Jarvis, the Arc Brain: a calm, honest trading mentor inside a PAPER trading practice app. No real money is involved.",
    'Answer the question in 2 to 4 short, plain sentences, like a person talking. No markdown, lists or headings.',
    'Use the facts given about the app first. If the facts do not cover the question, you may explain general trading ideas, and say so.',
    'Never invent numbers, prices or trades that are not in the facts. Never promise or predict profits. Never tell the user to buy or sell real stocks; this is practice only.',
    'Do not claim you can change settings or place trades; the app does that only after the user taps to confirm.',
    lang === 'vi' ? 'Reply in Vietnamese.' : 'Reply in English.',
  ].join(' ')
}

const LIMIT = { question: 500, fact: 400, facts: 12, answer: 450 }

const BASE = 'http://localhost:11434'
/** Small chat models first; coder models answer prose badly. */
const PREFER = ['llama3.2', 'llama3.1', 'llama3', 'gemma', 'qwen', 'mistral', 'phi']
let picked: Promise<string | null> | null = null

/** Pick an installed model by name preference, so no model name is hard-coded to one machine. */
export function pickModel(names: string[]): string | null {
  const chat = names.filter((n) => !/coder|embed/i.test(n))
  for (const p of PREFER) {
    const hit = chat.find((n) => n.startsWith(p))
    if (hit) return hit
  }
  return chat[0] ?? names[0] ?? null
}

function installedModel(): Promise<string | null> {
  picked ??= fetch(`${BASE}/api/tags`)
    .then((r) => (r.ok ? (r.json() as Promise<{ models?: { name: string }[] }>) : null))
    .then((j) => pickModel((j?.models ?? []).map((m) => m.name)))
    .catch(() => null)
    .then((m) => {
      if (!m) picked = null
      return m
    })
  return picked
}

// a local model can take a while to load into memory on the first call
export async function askOllama(req: OllamaRequest, timeoutMs = 90_000): Promise<{ text: string; by: string } | null> {
  const model = await installedModel()
  if (!model) {
    console.warn('Ollama: not reachable or no model installed')
    return null
  }
  const user = `Facts from the app:\n${req.facts.map((x) => `- ${x}`).join('\n') || '- (none)'}\n\nQuestion: ${req.question}`
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctl.signal,
      body: JSON.stringify({
        model,
        max_tokens: LIMIT.answer,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt(req.lang) },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!response.ok) {
      console.warn(`Ollama error: ${response.status}`)
      return null
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content?.trim()
    return text ? { text, by: `Local AI (${model})` } : null
  } catch (e) {
    console.warn('Ollama unreachable:', e instanceof Error ? e.message : String(e))
    return null
  } finally {
    clearTimeout(t)
  }
}
