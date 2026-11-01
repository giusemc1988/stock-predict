/**
 * Lumi live speed layer, pure parts:
 * - a tiny energy VAD that cuts audio at the speaker's pause (instead of a fixed 6 s), so each
 *   Whisper chunk is a whole phrase and arrives sooner;
 * - prompts for the fast draft translation (with the last few lines as context) and for the
 *   "what is this conversation about / what could I answer" gist.
 * No browser APIs here, so it is unit-tested in scripts/lumilive.test.ts.
 */

export interface VadState {
  /** running estimate of the room's quiet level (0-1) */
  floor: number
  /** ms of speech in the current chunk */
  speechMs: number
  /** ms of continuous quiet since the last speech */
  quietMs: number
  /** ms since this chunk started */
  chunkMs: number
}

export const VAD = { minSpeechMs: 800, pauseMs: 400, maxChunkMs: 6000, minFloor: 0.015, ratio: 1.8 }

export function vadStart(floor = 0.03): VadState {
  return { floor, speechMs: 0, quietMs: 0, chunkMs: 0 }
}

/**
 * One analyser tick. Returns the next state and whether to cut the chunk now:
 * after at least minSpeechMs of speech the speaker paused for pauseMs, or the chunk hit maxChunkMs.
 * `drop` marks a chunk with no speech at all (do not send it, saves Whisper quota).
 */
export function vadStep(s: VadState, level: number, dtMs: number): { state: VadState; cut: boolean; drop: boolean; speaking: boolean } {
  const threshold = Math.max(VAD.minFloor, s.floor * VAD.ratio)
  const speaking = level > threshold
  // the floor follows quiet moments quickly and loud moments very slowly
  const floor = speaking ? s.floor * 0.999 + level * 0.001 : s.floor * 0.9 + level * 0.1
  const next: VadState = {
    floor: Math.max(0.005, Math.min(0.3, floor)),
    speechMs: s.speechMs + (speaking ? dtMs : 0),
    quietMs: speaking ? 0 : s.quietMs + dtMs,
    chunkMs: s.chunkMs + dtMs,
  }
  const pauseCut = next.speechMs >= VAD.minSpeechMs && next.quietMs >= VAD.pauseMs
  const longCut = next.chunkMs >= VAD.maxChunkMs
  const cut = pauseCut || longCut
  return { state: next, cut, drop: cut && next.speechMs < 300, speaking }
}

/** After a cut: same room floor, fresh counters. */
export function vadReset(s: VadState): VadState {
  return { ...s, speechMs: 0, quietMs: 0, chunkMs: 0 }
}

const CTX_LINES = 3

/** Fast draft translation prompt; the previous lines keep pronouns, names and jokes consistent. */
export function buildFastPrompt(text: string, lang: string, context: string[]): string {
  const ctx = context.filter((c) => typeof c === 'string' && c.trim()).slice(-CTX_LINES).map((c) => c.trim().slice(0, 300))
  return [
    `Translate the LAST line of this live speech${lang && lang !== 'und' ? ` (language: ${lang})` : ''} into natural spoken Vietnamese.`,
    ctx.length ? `Earlier lines, for context only (do not translate them):\n${ctx.map((c) => `- ${c}`).join('\n')}` : '',
    'Keep tone and jokes. Do not add anything. Output ONLY the Vietnamese translation of the last line.',
    '',
    `LAST LINE: ${text.trim().slice(0, 600)}`,
  ].filter(Boolean).join('\n')
}

export interface Gist {
  /** one short Vietnamese line: what is being talked about, and the mood */
  topicVi: string
  /** up to 3 short answers the traveler could say back, in the speaker's language + Vietnamese meaning */
  replies: { text: string; vi: string }[]
}

/** Gist prompt: topic + mood always; reply suggestions only when someone is talking to the traveler. */
export function buildGistPrompt(lines: { text: string; vi?: string; lang: string }[], talk: boolean): string {
  const body = lines.slice(-12).map((l, i) => `${i + 1}. [${l.lang}] ${l.text.trim().slice(0, 300)}`).join('\n')
  return [
    'You help a Vietnamese traveler follow live speech around them. Lines are in time order, newest last.',
    'Write "topicVi": ONE short Vietnamese line (max 20 words) saying what is being talked about right now and the mood (e.g. joking, arguing, asking directions, bargaining).',
    talk
      ? 'Someone is speaking TO the traveler. Also write "replies": 3 short, polite, natural answers the traveler could say back, in the SAME language as the newest line ("text"), each with its Vietnamese meaning ("vi").'
      : 'Write "replies": [] (the traveler is only listening).',
    'Never invent facts that are not in the lines. Answer ONLY as JSON: {"topicVi":"...","replies":[{"text":"...","vi":"..."}]}',
    '',
    body,
  ].join('\n')
}

export function parseGist(raw: string | null | undefined): Gist | null {
  if (!raw) return null
  const m = raw.replace(/```[a-z]*/gi, '').match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as { topicVi?: unknown; replies?: unknown }
    const topicVi = typeof j.topicVi === 'string' ? j.topicVi.trim().slice(0, 200) : ''
    if (!topicVi) return null
    const replies = Array.isArray(j.replies)
      ? j.replies
          .map((r) => r as { text?: unknown; vi?: unknown })
          .filter((r) => typeof r?.text === 'string' && r.text.trim() && typeof r.vi === 'string' && r.vi.trim())
          .slice(0, 3)
          .map((r) => ({ text: (r.text as string).trim().slice(0, 200), vi: (r.vi as string).trim().slice(0, 200) }))
      : []
    return { topicVi, replies }
  } catch {
    return null
  }
}

/** BCP-47 tag for the browser recognizer from a short language code (Whisper's detection). */
const SPEECH_TAG: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', th: 'th-TH', de: 'de-DE', it: 'it-IT', pt: 'pt-BR', ru: 'ru-RU', id: 'id-ID', ms: 'ms-MY', hi: 'hi-IN', ar: 'ar-SA', tr: 'tr-TR', nl: 'nl-NL', vi: 'vi-VN', yue: 'yue-Hant-HK', tl: 'fil-PH' }
export function speechTagFor(code: string): string | null {
  return SPEECH_TAG[code] ?? null
}

/** Draft translation is worth refreshing when the interim text grew by a few words since last time. */
export function draftWorthIt(prev: string, next: string, minNewWords = 3): boolean {
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
  const cjk = /[぀-ヿ㐀-鿿가-힯฀-๿]/.test(next)
  if (cjk) return next.length - prev.length >= 6
  return words(next) - words(prev) >= minNewWords
}
