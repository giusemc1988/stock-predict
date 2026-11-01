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
  /** set only when the talk shows signs of a common tourist scam or overcharge aimed at the listener */
  alertVi?: string
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
    'Also, ONLY if a conversation clearly shows signs of a common tourist scam or overcharging aimed at the traveler (fake "closed" attraction, taxi without meter, inflated price, pushy "free" gift, fake police, gem/tailor shop detour), add "alertVi": one short Vietnamese warning. Otherwise omit "alertVi". Do not guess.',
    'Answer ONLY as JSON: {"conversations":[{"lang":"en","lineNumbers":[1,2],"summaryVi":"...","alertVi":"..."}]}. No other text.',
    '',
    body,
  ].join('\n')
}

interface RawGroup { lang?: unknown; lineNumbers?: unknown; summaryVi?: unknown; alertVi?: unknown }

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
      const alertVi = typeof g.alertVi === 'string' ? g.alertVi.trim().slice(0, 200) : ''
      const out: LumiConversation = { id: `g${i}`, lang: typeof g.lang === 'string' ? g.lang : picked[0].lang, summaryVi, lines: picked }
      if (alertVi) out.alertVi = alertVi
      return out
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
  conversations: { lang: string; summaryVi: string; alertVi?: string }[]
}

const TRIP_LIMIT = { summary: 400, conversations: 12 }

/** What gets saved when the user taps "Lưu chuyến này" — summaries only, never the original lines/audio. */
export function cleanTripSave(body: unknown): Omit<LumiTrip, 'id' | 'at'> | null {
  const b = body as { mode?: unknown; conversations?: unknown } | null
  if (!b || (b.mode !== 'talk' && b.mode !== 'ambient') || !Array.isArray(b.conversations)) return null
  const conversations = b.conversations
    .filter((c): c is { lang: unknown; summaryVi: unknown; alertVi?: unknown } => !!c && typeof c === 'object')
    .map((c) => {
      const row: { lang: string; summaryVi: string; alertVi?: string } = { lang: typeof c.lang === 'string' ? c.lang.slice(0, 16) : '?', summaryVi: typeof c.summaryVi === 'string' ? c.summaryVi.slice(0, TRIP_LIMIT.summary) : '' }
      if (typeof c.alertVi === 'string' && c.alertVi.trim()) row.alertVi = c.alertVi.slice(0, 200)
      return row
    })
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

/** ---- Two-way talk: translate one short sentence between Vietnamese and a travel language ---- */

export type SayDir = 'vi2x' | 'x2vi'

const SAY_LIMIT = 300

export function cleanSayText(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, SAY_LIMIT) : ''
}

/** Prompt for one sentence. `langName` is the English name of the foreign language (e.g. "Japanese"). */
export function buildSayPrompt(text: string, dir: SayDir, langName: string): string {
  const [from, to] = dir === 'vi2x' ? ['Vietnamese', langName] : [langName, 'Vietnamese']
  return [
    `Translate this ${from} sentence into natural, polite ${to} that a native speaker would say in daily life.`,
    'Answer ONLY as JSON: {"text":"<translation>"}. No explanation, no romanization unless the target is not written in Latin letters and a short romanization helps; then add it as "roman".',
    '',
    text,
  ].join('\n')
}

/** Parses the AI's {"text","roman"} answer; null when there is no usable translation. */
export function parseSayResponse(raw: string): { text: string; roman?: string } | null {
  const m = raw.replace(/```[a-z]*/gi, '').match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as { text?: unknown; roman?: unknown }
    const text = typeof j.text === 'string' ? j.text.trim().slice(0, 600) : ''
    if (!text) return null
    const roman = typeof j.roman === 'string' && j.roman.trim() ? j.roman.trim().slice(0, 600) : undefined
    return roman ? { text, roman } : { text }
  } catch {
    return null
  }
}

/** ---- Trip vocabulary: sentence pairs kept on the phone (localStorage), never sent anywhere ---- */

export interface LumiWord {
  id: string
  lang: string
  text: string
  vi: string
  at: number
}

export const VOCAB_KEY = 'lumi:vocab'
const VOCAB_MAX = 200

export function addWord(list: LumiWord[], w: Omit<LumiWord, 'id' | 'at'>, now = Date.now()): LumiWord[] {
  const text = w.text.trim().slice(0, 300)
  const vi = w.vi.trim().slice(0, 300)
  if (!text || !vi) return list
  if (list.some((x) => x.text === text && x.lang === w.lang)) return list
  return [{ id: `${now.toString(36)}${list.length}`, lang: w.lang, text, vi, at: now }, ...list].slice(0, VOCAB_MAX)
}

export function removeWord(list: LumiWord[], id: string): LumiWord[] {
  return list.filter((x) => x.id !== id)
}

export function parseVocab(raw: string | null): LumiWord[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw) as unknown
    return Array.isArray(j) ? (j as LumiWord[]).filter((x) => x && typeof x.text === 'string' && typeof x.vi === 'string') : []
  } catch {
    return []
  }
}

/** ---- Menu / sign photo: the free vision AI reads it and explains in Vietnamese ---- */

export interface MenuItem {
  orig: string
  vi: string
  note?: string
  price?: string
}

export const MENU_PROMPT = [
  'This photo is a restaurant menu, a sign, or a label that a Vietnamese traveler is looking at.',
  'Read the visible text. For each dish or line (at most 25), give the original text, a natural Vietnamese translation, and for dishes a very short Vietnamese note on what it is (main ingredients, spicy, contains pork/beef/seafood/nuts when obvious). Copy the price exactly as written if there is one.',
  'Never invent items that are not in the photo. If the photo has no readable text, answer {"items":[]}.',
  'Answer ONLY as JSON: {"items":[{"orig":"...","vi":"...","note":"...","price":"..."}]}.',
].join('\n')

export function parseMenuResponse(raw: string): MenuItem[] {
  const m = raw.replace(/```[a-z]*/gi, '').match(/\{[\s\S]*\}/)
  if (!m) return []
  try {
    const j = JSON.parse(m[0]) as { items?: unknown }
    if (!Array.isArray(j.items)) return []
    const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
    return j.items
      .slice(0, 25)
      .map((it): MenuItem | null => {
        const o = it as Record<string, unknown>
        const orig = str(o?.orig, 200)
        const vi = str(o?.vi, 200)
        if (!orig || !vi) return null
        const item: MenuItem = { orig, vi }
        const note = str(o.note, 200)
        const price = str(o.price, 40)
        if (note) item.note = note
        if (price) item.price = price
        return item
      })
      .filter((x): x is MenuItem => x !== null)
  } catch {
    return []
  }
}

/** Accepts only a JPEG/PNG/WebP data URL under the size cap; returns its mime + base64 body. */
export function parseImageDataUrl(v: unknown, maxBytes = 1_500_000): { mime: string; b64: string } | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  if (m[2].length * 0.75 > maxBytes) return null
  return { mime: m[1], b64: m[2] }
}

/** ---- Trip notebook: saved trips as plain text, for Copy / Share ---- */

export function tripsToText(trips: LumiTrip[], locale = 'vi-VN'): string {
  const byDay = new Map<string, LumiTrip[]>()
  for (const t of trips) {
    const d = new Date(t.at).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    byDay.set(d, [...(byDay.get(d) ?? []), t])
  }
  const out: string[] = ['Sổ tay chuyến đi (Lumi)']
  for (const [day, ts] of byDay) {
    out.push('', `# ${day}`)
    for (const t of ts) {
      const time = new Date(t.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      for (const c of t.conversations) out.push(`- ${time} [${c.lang}] ${c.summaryVi}${c.alertVi ? ` (⚠ ${c.alertVi})` : ''}`)
    }
  }
  return out.join('\n')
}
