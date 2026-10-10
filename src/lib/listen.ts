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
  continuous?: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null
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
  if (/who are you|what are you|bạn là ai/.test(t)) return 'who'
  if (/skill|kỹ năng/.test(t)) return 'skills'
  if (/decision|decide|\blog\b|nhật ký|quyết định/.test(t)) return 'log'
  if (/review|grade|graded|chấm|đánh giá/.test(t)) return 'reviews'
  if (/learner|bộ học/.test(t)) return 'learning'
  if (/too high|(buy|bought) (it )?(at the )?(high|top)|chas(e|ed|ing)|giá cao|mua cao|đu đỉnh|đuổi giá|mua đắt|expensive/.test(t)) return 'boughtHigh'
  if (/why.*(buy|bought|purchase)|vì sao.*mua|tại sao.*mua|sao.*mua/.test(t)) return 'whyBuy'
  if (/this (stock|one|trade)|\b(it|this)\b.*(doing|now|going)|mã này|cổ phiếu này|lệnh này|(^|\s)nó(\s|$|[?.!,])/.test(t)) return 'thisStock'
  if (/risk|rủi ro/.test(t)) return 'risk'
  if (/rule|playbook|quy tắc|sổ tay/.test(t)) return 'rules'
  if (/learn|lesson|học|bài học/.test(t)) return 'learned'
  if (/not trading|aren'?t you trading|why.*(wait|idle)|không giao dịch|sao.*không.*(mua|giao dịch)/.test(t)) return 'idle'
  return null
}

export type Understood = { kind: 'ask'; id: AskId } | { kind: 'replay' } | { kind: 'stock'; symbol: string } | null

/** Words that look like tickers in a typed question but aren't. */
const NOT_TICKERS = new Set(['I', 'A', 'AI', 'OK', 'US', 'ET', 'AM', 'PM', 'VS', 'MY', 'ME', 'IT', 'IS', 'DO', 'SO', 'TO', 'ON', 'IN', 'AT', 'OR', 'AN', 'BE', 'BY', 'IF', 'OF', 'UP', 'NO', 'GO', 'WE', 'HE', 'ETF', 'USD', 'BUY', 'SELL', 'HOLD', 'WHY', 'HOW', 'WHAT'])

/**
 * Understand a typed or spoken question: a stock ("why AAPL?", "what about Tesla?"), one of
 * Jarvis's questions, or "replay today". A stock wins when one is named.
 */
export function understand(text: string, known: { symbol: string; name: string }[]): Understood {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9/.\u00c0-\u1ef9 ]/g, ' ')} `
  const word = (w: string) => w.length >= 2 && t.includes(` ${w.toLowerCase()} `)
  for (const k of known) {
    const base = k.symbol.split('/')[0]
    const nameWord = k.name.split(/[ .,]/)[0]
    if ((k.symbol.length >= 3 ? word(k.symbol) : new RegExp(`\\b${k.symbol}\\b`).test(text)) || (base.length >= 3 && word(base)) || (nameWord.length >= 4 && word(nameWord))) return { kind: 'stock', symbol: k.symbol }
  }
  // an unknown ticker typed in capitals, e.g. "why PLTR?"
  const caps = text.match(/\b[A-Z]{2,5}\b/g)?.find((w) => !NOT_TICKERS.has(w))
  const id = matchQuestion(text)
  if (id === 'replay') return { kind: 'replay' }
  if (id) return { kind: 'ask', id }
  if (caps) return { kind: 'stock', symbol: caps }
  return null
}

/**
 * Listen for one sentence; calls back with what was heard. `onWords` gets the words live while
 * you speak, so the screen can show them. Returns a stop function.
 */
export function listenOnce(lang: 'en' | 'vi', onText: (text: string) => void, onDone: (error?: string) => void, onWords?: (text: string) => void): () => void {
  const C = ctor()
  if (!C) {
    onDone('unsupported')
    return () => {}
  }
  const r = new C()
  r.lang = lang === 'vi' ? 'vi-VN' : 'en-US'
  r.interimResults = !!onWords
  r.maxAlternatives = 1
  // send the sentence when listening ends: some phones mark half a sentence as final
  let latest = ''
  let ended = false
  const end = (error?: string) => {
    if (ended) return
    ended = true
    if (latest && !error) {
      onText(latest)
      onDone()
    } else onDone(error ?? 'no-speech')
  }
  r.onresult = (e) => {
    latest = Array.from(e.results)
      .map((x) => x[0]?.transcript ?? '')
      .join(' ')
      .trim()
    onWords?.(latest)
  }
  r.onerror = (e) => end(e.error)
  r.onend = () => end()
  try {
    r.start()
  } catch {
    end('busy')
  }
  return () => r.stop()
}
