/**
 * Ask Jarvis by voice: the browser's built-in speech recognition (Chrome, Edge, Safari).
 * The spoken question is matched to one of Jarvis's questions; nothing else is done with it.
 */
import type { AskId } from './jarvis'

export type Heard = AskId | 'replay' | null

interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

const ctor = () => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canListen = () => ctor() != null

/** Which question a spoken sentence asks (English or Vietnamese). */
export function matchQuestion(text: string): Heard {
  const t = text.toLowerCase()
  if (/replay|today'?s trades|walk me through|xem lại|tua lại/.test(t)) return 'replay'
  if (/why.*(buy|bought|purchase)|vì sao.*mua|tại sao.*mua/.test(t)) return 'whyBuy'
  if (/risk|rủi ro/.test(t)) return 'risk'
  if (/rule|playbook|quy tắc|sổ tay/.test(t)) return 'rules'
  if (/learn|lesson|học|bài học/.test(t)) return 'learned'
  if (/not trading|aren'?t you trading|why.*(wait|idle)|không giao dịch|sao.*không.*(mua|giao dịch)/.test(t)) return 'idle'
  return null
}

/** Listen for one sentence; calls back with what was heard. Returns a stop function. */
export function listenOnce(lang: 'en' | 'vi', onText: (text: string) => void, onDone: (error?: string) => void): () => void {
  const C = ctor()
  if (!C) {
    onDone('unsupported')
    return () => {}
  }
  const r = new C()
  r.lang = lang === 'vi' ? 'vi-VN' : 'en-US'
  r.interimResults = false
  r.maxAlternatives = 1
  r.onresult = (e) => onText(e.results[0]?.[0]?.transcript ?? '')
  r.onerror = (e) => onDone(e.error)
  r.onend = () => onDone()
  r.start()
  return () => r.stop()
}
