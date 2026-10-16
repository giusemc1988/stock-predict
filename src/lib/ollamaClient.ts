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

export async function askOllama(req: OllamaRequest, model = 'llama2'): Promise<{ text: string; by: string } | null> {
  const baseUrl = 'http://localhost:11434'
  const user = `Facts from the app:\n${req.facts.map((x) => `- ${x}`).join('\n') || '- (none)'}\n\nQuestion: ${req.question}`

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    return text ? { text, by: 'Local AI' } : null
  } catch (e) {
    console.warn('Ollama unreachable:', e instanceof Error ? e.message : String(e))
    return null
  }
}
