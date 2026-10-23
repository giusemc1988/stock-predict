/**
 * Video Studio's script writer on the Worker. Gemini first, Groq as backup, using the free keys saved
 * in Settings (never in the browser). English and Vietnamese are written as two separate originals:
 * two calls, each told to write natively in its own language, never to translate the other.
 */
import { PROVIDERS, callHelper, type BrainEnv } from './brainServer'
import { parseScenes, studioPrompt, type StudioMode } from './studio/script'
import { fallbackTerms, parseTerms } from './studioJobs'

export interface WriteAsk {
  topic: string
  /** the Vietnamese topic, when typed; the Vietnamese script is written from it */
  topicVi: string
  mode: StudioMode
  scenes: number
}

const MODES: StudioMode[] = ['faceless', 'philosophy', 'trip']

export function cleanWriteAsk(body: unknown): WriteAsk | null {
  const b = body as Partial<WriteAsk> | null
  const topic = typeof b?.topic === 'string' ? b.topic.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
  if (!topic) return null
  const mode = MODES.includes(b?.mode as StudioMode) ? (b!.mode as StudioMode) : 'faceless'
  const scenes = Math.max(3, Math.min(8, Math.round(Number(b?.scenes) || 5)))
  const topicVi = typeof b?.topicVi === 'string' ? b.topicVi.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
  return { topic, topicVi: topicVi || topic, mode, scenes }
}

/** Gemini, then Groq. Returns null when neither has a key or both fail. */
async function ask(e: BrainEnv, system: string, user: string): Promise<{ text: string; by: string } | null> {
  for (const p of PROVIDERS.filter((x) => x.id === 'gemini' || x.id === 'groq')) {
    const key = p.key(e)
    if (!key) continue
    try {
      const text = (await callHelper(p, key, e, system, user, fetch))?.trim()
      if (text) return { text, by: p.name }
    } catch {
      // down or over its free limit: try the next one
    }
  }
  return null
}

export async function writeScript(a: WriteAsk, e: BrainEnv): Promise<{ en: string[]; vi: string[]; by: string } | null> {
  const [en, vi] = await Promise.all((['en', 'vi'] as const).map((lang) => ask(e, ...studioPrompt(lang, a.mode, lang === 'vi' ? a.topicVi : a.topic, a.scenes))))
  const enLines = en ? parseScenes(en.text, a.scenes) : []
  const viLines = vi ? parseScenes(vi.text, a.scenes) : []
  if (!enLines.length || !viLines.length) return null
  // both sides get the same scene count so each frame shows a pair
  const n = Math.min(enLines.length, viLines.length)
  return { en: enLines.slice(0, n), vi: viLines.slice(0, n), by: [...new Set([en!.by, vi!.by])].join(' + ') }
}

/** English stock-footage search terms for the server render; the topic's own words when no AI answers. */
export async function writeTerms(topic: string, lines: string[], e: BrainEnv): Promise<string[]> {
  const system = 'You pick stock-footage search terms. Reply with 5 to 8 short English search terms (1 to 3 words each), one per line, nothing else. Choose concrete, filmable things: places, objects, nature, people from behind. No text, logos or brand names.'
  const r = await ask(e, system, `Topic: ${topic}\nScript:\n${lines.join('\n')}`)
  const terms = r ? parseTerms(r.text) : []
  return terms.length >= 3 ? terms : fallbackTerms(topic)
}
