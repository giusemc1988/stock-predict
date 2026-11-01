/**
 * Lumi: the ambient travel translator. Pure parts only — grouping transcript lines into
 * conversations, building the AI prompt, parsing its answer, and the trip-summary shape saved
 * to KV. The browser (LumiPage.tsx) records audio in chunks and calls the Worker (worker/lumi.ts)
 * for transcription (Groq Whisper) and for this grouping step; no audio ever reaches this file.
 */

export type LumiMode = 'talk' | 'ambient'

export interface LumiLine {
  text: string
  lang: string
  at: number
}

export interface LumiConversation {
  id: string
  /** detected language of this group, e.g. "en", "es" */
  lang: string
  /** 1-3 short Vietnamese sentences, rolling as more lines arrive */
  summaryVi: string
  lines: LumiLine[]
}

const LIMIT = { lines: 40, lineChars: 300, groups: 6 }

/** Caps what a batch sends to the AI, so a long silence-free recording can't blow the token budget. */
export function cleanLines(lines: LumiLine[]): LumiLine[] {
  return lines
    .filter((l) => typeof l.text === 'string' && l.text.trim())
    .slice(-LIMIT.lines)
    .map((l) => ({ ...l, text: l.text.trim().slice(0, LIMIT.lineChars) }))
}

/** The prompt asking the free AI to group lines into conversations and summarize each in Vietnamese. */
export function buildGroupPrompt(lines: LumiLine[], mode: LumiMode): string {
  const body = cleanLines(lines).map((l, i) => `${i + 1}. [${l.lang}] ${l.text}`).join('\n')
  const scope = mode === 'talk' ? 'This is one person talking directly to the user.' : 'These lines come from several nearby conversations in a public place (e.g. a cafe).'
  return [
    'You help a Vietnamese traveler understand conversations happening around them.',
    scope,
    'Group the numbered lines below into separate conversations by topic and language (a language switch usually means a new conversation).',
    'For each conversation, write 1 to 3 short Vietnamese sentences summarizing what is being said - plain, factual, no invented details.',
    'Answer ONLY as JSON: {"conversations":[{"lang":"en","lineNumbers":[1,2],"summaryVi":"..."}]}. No other text.',
    '',
    body,
  ].join('\n')
}

interface RawGroup { lang?: unknown; lineNumbers?: unknown; summaryVi?: unknown }

/** Parses the AI's JSON answer into conversations, matching line numbers back to the original lines. */
export function parseGroupResponse(text: string, lines: LumiLine[]): LumiConversation[] {
  const cleaned = text.replace(/```[a-z]*/gi, '').trim()
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (!m) return []
  let parsed: { conversations?: RawGroup[] }
  try {
    parsed = JSON.parse(m[0]) as { conversations?: RawGroup[] }
  } catch {
    return []
  }
  const groups = Array.isArray(parsed.conversations) ? parsed.conversations : []
  return groups
    .slice(0, LIMIT.groups)
    .map((g, i): LumiConversation | null => {
      const nums = Array.isArray(g.lineNumbers) ? g.lineNumbers.filter((n): n is number => typeof n === 'number') : []
      const picked = nums.map((n) => lines[n - 1]).filter((l): l is LumiLine => !!l)
      const summaryVi = typeof g.summaryVi === 'string' ? g.summaryVi.trim().slice(0, 400) : ''
      if (!picked.length || !summaryVi) return null
      return { id: `g${i}`, lang: typeof g.lang === 'string' ? g.lang : picked[0].lang, summaryVi, lines: picked }
    })
    .filter((g): g is LumiConversation => g !== null)
}

/** When every AI helper is out of quota: one conversation per language, no summary (caller shows the raw lines instead). */
export function fallbackGroup(lines: LumiLine[]): LumiConversation[] {
  const byLang = new Map<string, LumiLine[]>()
  for (const l of cleanLines(lines)) byLang.set(l.lang, [...(byLang.get(l.lang) ?? []), l])
  return [...byLang.entries()].map(([lang, ls], i) => ({ id: `f${i}`, lang, summaryVi: '', lines: ls }))
}

export interface LumiTrip {
  id: string
  at: number
  mode: LumiMode
  conversations: { lang: string; summaryVi: string }[]
}

const TRIP_LIMIT = { summary: 400, conversations: 12 }

/** What gets saved when the user taps "Lưu chuyến này" — summaries only, never the original lines/audio. */
export function cleanTripSave(body: unknown): Omit<LumiTrip, 'id' | 'at'> | null {
  const b = body as { mode?: unknown; conversations?: unknown } | null
  if (!b || (b.mode !== 'talk' && b.mode !== 'ambient') || !Array.isArray(b.conversations)) return null
  const conversations = b.conversations
    .filter((c): c is { lang: unknown; summaryVi: unknown } => !!c && typeof c === 'object')
    .map((c) => ({ lang: typeof c.lang === 'string' ? c.lang.slice(0, 16) : '?', summaryVi: typeof c.summaryVi === 'string' ? c.summaryVi.slice(0, TRIP_LIMIT.summary) : '' }))
    .filter((c) => c.summaryVi)
    .slice(0, TRIP_LIMIT.conversations)
  if (!conversations.length) return null
  return { mode: b.mode, conversations }
}

/** All of Chanh's saved trips live in one KV key (list, bounded), so saving never adds a new KV key. */
export const TRIPS_KEY = 'lumi:trips'
const MAX_TRIPS = 20

/** Adds a freshly-saved trip to the front of the kept list, capped so the key never grows without bound. */
export function mergeTrips(existing: LumiTrip[], add: Omit<LumiTrip, 'id' | 'at'>, id: string, at: number): LumiTrip[] {
  return [{ ...add, id, at }, ...existing].slice(0, MAX_TRIPS)
}

export function parseTrips(raw: string | null): LumiTrip[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw) as unknown
    return Array.isArray(j) ? (j as LumiTrip[]) : []
  } catch {
    return []
  }
}
