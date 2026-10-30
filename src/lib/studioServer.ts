/**
 * Video Studio's script writer on the Worker. Gemini first, Groq as backup, using the free keys saved
 * in Settings (never in the browser). English and Vietnamese are written as two separate originals:
 * two calls, each told to write natively in its own language, never to translate the other.
 */
import { PROVIDERS, callHelper, type BrainEnv } from './brainServer'
import { CHANNEL, parseScenes, studioPrompt, type Script, type StudioMode } from './studio/script'
import { HOOK_THEMES } from './studio/hookThemes'
import { cleanKitSettings, fallbackKit, fillKit, itemPrompt, kitPrompt, parseItem, parseKit, PLATFORMS, type KitKind, type KitSettings, type Platform, type PostKit } from './studio/postkit'
import { fallbackTerms, parseTerms } from './studioJobs'

export interface WriteAsk {
  topic: string
  /** the Vietnamese topic, when typed; the Vietnamese script is written from it */
  topicVi: string
  mode: StudioMode
  scenes: number
  /** channel script rules: 3 to 5 slides and the channel's tone */
  channel: boolean
}

const MODES: StudioMode[] = ['faceless', 'philosophy', 'trip']

export function cleanWriteAsk(body: unknown): WriteAsk | null {
  const b = body as Partial<WriteAsk> | null
  const topic = typeof b?.topic === 'string' ? b.topic.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
  if (!topic) return null
  const mode = MODES.includes(b?.mode as StudioMode) ? (b!.mode as StudioMode) : 'faceless'
  const channel = b?.channel === true
  const scenes = channel ? Math.max(CHANNEL.min, Math.min(CHANNEL.max, Math.round(Number(b?.scenes) || CHANNEL.def))) : Math.max(3, Math.min(12, Math.round(Number(b?.scenes) || 5)))
  const topicVi = typeof b?.topicVi === 'string' ? b.topicVi.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
  return { topic, topicVi: topicVi || topic, mode, scenes, channel }
}

/** Gemini, then Groq. Returns null when neither has a key or both fail. */
async function ask(e: BrainEnv, system: string, user: string, maxTokens = 1200): Promise<{ text: string; by: string } | null> {
  for (const p of PROVIDERS.filter((x) => x.id === 'gemini' || x.id === 'groq')) {
    const key = p.key(e)
    if (!key) continue
    try {
      const text = (await callHelper(p, key, e, system, user, fetch, undefined, maxTokens))?.trim()
      if (text) return { text, by: p.name }
    } catch {
      // down or over its free limit: try the next one
    }
  }
  return null
}

export async function writeScript(a: WriteAsk, e: BrainEnv): Promise<{ en: string[]; vi: string[]; by: string } | null> {
  const [en, vi] = await Promise.all((['en', 'vi'] as const).map((lang) => ask(e, ...studioPrompt(lang, a.mode, lang === 'vi' ? a.topicVi : a.topic, a.scenes, a.channel))))
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

export interface KitAsk {
  script: Script
  settings: KitSettings
  /** one item only: a new hook, title or caption for one language */
  only?: { lang: 'en' | 'vi'; kind: KitKind; platform?: Platform; avoid: string[] }
}

const line = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const lines = (v: unknown) => (Array.isArray(v) ? v.map((l) => line(l, 300)).filter(Boolean).slice(0, 12) : [])

export function cleanKitAsk(body: unknown): KitAsk | null {
  const b = body as { script?: Record<string, unknown>; settings?: unknown; only?: Record<string, unknown> } | null
  const sc = b?.script
  const topic = line(sc?.topic, 200)
  if (!topic) return null
  const script: Script = { topic: { en: topic, vi: line(sc?.topicVi, 200) || topic }, mode: MODES.includes(sc?.mode as StudioMode) ? (sc!.mode as StudioMode) : 'faceless', en: lines(sc?.en), vi: lines(sc?.vi) }
  const settings = cleanKitSettings(b?.settings)
  const o = b?.only
  const kind = (['hook', 'title', 'caption'] as const).find((k) => k === o?.kind)
  const only = o && kind && (o.lang === 'en' || o.lang === 'vi')
    ? { lang: o.lang as 'en' | 'vi', kind, platform: PLATFORMS.find((p) => p.id === o.platform)?.id, avoid: (Array.isArray(o.avoid) ? o.avoid : []).map((a) => line(a, 300)).filter(Boolean).slice(0, 10) }
    : undefined
  return { script, settings, only }
}

/** The whole kit: one AI call per language, padded from the no-AI kit. by = null when no AI answered. */
export async function writePostKit(a: KitAsk, e: BrainEnv): Promise<{ kit: PostKit; by: string | null }> {
  const base = fallbackKit(a.script, a.settings)
  const answers = await Promise.all(a.settings.langs.map((lang) => ask(e, ...kitPrompt(lang, a.settings, a.script))))
  const kit: PostKit = {}
  const by = new Set<string>()
  a.settings.langs.forEach((lang, i) => {
    const parsed = answers[i] ? parseKit(answers[i]!.text, a.settings) : null
    if (parsed) by.add(answers[i]!.by)
    kit[lang] = fillKit(parsed, base[lang]!, a.settings)
  })
  return { kit, by: by.size ? [...by].join(' + ') : null }
}

/** One new item, or null when no AI answered. */
export async function writeKitItem(a: KitAsk, e: BrainEnv): Promise<{ text: string; by: string } | null> {
  if (!a.only) return null
  const r = await ask(e, ...itemPrompt(a.only.lang, a.settings, a.script, a.only.kind, a.only.avoid, a.only.platform))
  const text = r ? parseItem(r.text, a.only.kind) : ''
  return text ? { text, by: r!.by } : null
}

/** Topic ideas for one hook theme, as the AI sees them. [] when no AI answered. Pure parser below. */
export function parseIdeas(text: string): { en: string; vi: string }[] {
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return []
  try {
    const arr = JSON.parse(m[0]) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => ({ en: line((x as { en?: unknown })?.en, 120), vi: line((x as { vi?: unknown })?.vi, 120) }))
      .filter((x) => x.en && x.vi)
      .slice(0, 8)
  } catch {
    return []
  }
}

export async function writeHookIdeas(themeId: string, e: BrainEnv, avoid: string[] = []): Promise<{ ideas: { en: string; vi: string }[]; by: string | null }> {
  const t = HOOK_THEMES.find((x) => x.id === themeId)
  if (!t) return { ideas: [], by: null }
  const system = [
    'You suggest video topics for a faceless short-video channel whose videos show a cloaked traveler seen from behind, flying or walking through big scenery, with short text on top.',
    `Theme: ${t.rule.en}.`,
    'Suggest 6 different topics that people are searching for, sharing and recognising themselves in right now. Each is one short sentence under 12 words, concrete, with an image, never teaching manipulation, never diagnosing, no invented statistics.',
    'Write the Vietnamese natively, not as a translation.',
    'Reply with only JSON: [{"en":"...","vi":"..."}]',
  ].join(' ')
  const r = await ask(e, system, avoid.length ? `Already used, give different ones:\n${avoid.slice(0, 10).join('\n')}` : 'Give 6 topics.')
  const ideas = r ? parseIdeas(r.text) : []
  return { ideas, by: ideas.length ? r!.by : null }
}
