/**
 * Neo's spoken voice: the browser's free built-in speech (Web Speech API). No key and no
 * network service of ours; which voices exist depends on the device and browser.
 */
import { useEffect, useState } from 'react'

export interface VoicePrefs {
  /** voiceURI of the chosen voice, or '' for the device default in the app's language. */
  voice: string
  rate: number
  pitch: number
  /** Used when no exact voice is picked: Neo is a man's voice unless you choose otherwise. */
  gender: 'male' | 'female' | 'any'
}

export const DEFAULT_VOICE: VoicePrefs = { voice: '', rate: 1, pitch: 1, gender: 'male' }

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** The device's voices, refreshed when the browser finishes loading them. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (canSpeak() ? speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!canSpeak()) return
    const load = () => setVoices(speechSynthesis.getVoices())
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])
  return voices
}

/** Voices that sound human (neural / natural / premium) rather than robotic. */
export const isNatural = (v: SpeechSynthesisVoice) => /natural|neural|online|premium|enhanced|siri|google/i.test(v.name)

/** English and Vietnamese voices first, natural-sounding voices first within each. */
export function sortVoices(voices: SpeechSynthesisVoice[]) {
  const rank = (v: SpeechSynthesisVoice) => (v.lang.startsWith('en') ? 0 : v.lang.startsWith('vi') ? 2 : 4) + (isNatural(v) ? 0 : 1)
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
}

// Browsers don't say a voice's gender, so go by the names devices ship with.
const MALE = /\b(male|man|daniel|alex|fred|aaron|arthur|gordon|oliver|rishi|tom|thomas|james|george|ryan|guy|andrew|brian|christopher|eric|roger|steffan|davis|tony|jason|william|liam|reed|ralph|evan|nathan|lee|mark|david|nam ?minh)\b/i
const FEMALE = /\b(female|woman|samantha|victoria|karen|moira|tessa|fiona|serena|kate|susan|zira|aria|jenny|michelle|emma|ava|allison|libby|sonia|natasha|nicky|zoe|siri female|hoaimy|hoài ?my|linh)\b/i
export const voiceGender = (v: SpeechSynthesisVoice): 'male' | 'female' | null => (MALE.test(v.name) ? 'male' : FEMALE.test(v.name) ? 'female' : null)

/** The most human-sounding voice the device has for a language, a man's voice first when asked. */
export function bestVoice(voices: SpeechSynthesisVoice[], lang: 'en' | 'vi', gender: VoicePrefs['gender'] = 'any') {
  const mine = voices.filter((v) => v.lang.toLowerCase().startsWith(lang))
  const pool = gender === 'any' ? mine : mine.filter((v) => voiceGender(v) === gender)
  const from = pool.length ? pool : mine
  return from.find(isNatural) ?? from.find((v) => v.localService === false) ?? from[0]
}

/**
 * The voice Neo will use. The list is read fresh each time: some browsers ignore a voice
 * object from an older list, which is why a picked voice could sound unchanged.
 */
export function pickVoice(prefs: VoicePrefs, lang: 'en' | 'vi', voices: SpeechSynthesisVoice[] = []) {
  const fresh = canSpeak() ? speechSynthesis.getVoices() : []
  const list = fresh.length ? fresh : voices
  const exact = prefs.voice ? list.find((v) => v.voiceURI === prefs.voice) ?? list.find((v) => v.name === prefs.voice) : undefined
  return exact ?? bestVoice(list, lang, prefs.gender ?? 'male')
}

/** No man's voice installed: lower the pitch a little so Neo still sounds deeper. */
const pitchFor = (prefs: VoicePrefs, v: SpeechSynthesisVoice | undefined) => (!prefs.voice && prefs.gender === 'male' && v && voiceGender(v) !== 'male' ? prefs.pitch * 0.8 : prefs.pitch)

/** Call inside a tap: iPhone only lets a page speak later if it first spoke during a tap. */
export function primeSpeech() {
  if (!canSpeak() || speechSynthesis.speaking) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  speechSynthesis.speak(u)
}

/** Spoken text: only the answer, with symbols turned into words so it reads like speech. */
export function speakable(text: string, lang: 'en' | 'vi' = 'en') {
  return text
    .replace(/\([^)]*\)/g, '')
    .replace(/[−-]\$(\d)/g, lang === 'vi' ? 'âm $$$1' : 'minus $$$1')
    .replace(/\s*·\s*/g, '. ')
    .replace(/["“”]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export type SpeakResult = 'ok' | 'unsupported' | 'silent' | `error:${string}`

// Chrome drops an utterance that is garbage-collected mid-sentence, so keep the live ones here.
let live: SpeechSynthesisUtterance[] = []
// who started the current speech, so a panel only stops what it started
let owner = ''

/** Long text split into sentences: Chrome stops speaking a single utterance after about 15 seconds. */
function chunks(text: string) {
  const parts = text.match(/[^.!?。]+[.!?。]*/g) ?? [text]
  const out: string[] = []
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1] + ' ' + p).length < 180) out[out.length - 1] += ' ' + p
    else out.push(p)
  }
  return out
}

/**
 * Speak an answer. Resolves 'ok' once sound starts, 'silent' if the browser accepted it but never
 * started (muted tab, no voice installed, blocked autoplay), or the browser's error code.
 */
export function speak(text: string, prefs: VoicePrefs, lang: 'en' | 'vi', voices: SpeechSynthesisVoice[], by = ''): Promise<SpeakResult> {
  if (!canSpeak()) return Promise.resolve('unsupported')
  owner = by
  const chosen = pickVoice(prefs, lang, voices)
  const utterances = chunks(speakable(text, lang)).map((t) => {
    const u = new SpeechSynthesisUtterance(t)
    if (chosen) u.voice = chosen
    u.lang = chosen?.lang ?? (lang === 'vi' ? 'vi-VN' : 'en-US')
    u.rate = Math.min(2, Math.max(0.5, prefs.rate))
    u.pitch = Math.min(2, Math.max(0, pitchFor(prefs, chosen)))
    u.volume = 1
    return u
  })
  if (!utterances.length) return Promise.resolve('ok')
  return new Promise((resolve) => {
    let settled = false
    const done = (r: SpeakResult) => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }
    const first = utterances[0]
    first.onstart = () => done('ok')
    for (const u of utterances) {
      u.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') done(`error:${e.error}`)
      }
      u.onend = () => {
        live = live.filter((x) => x !== u)
      }
    }
    const go = () => {
      live = utterances
      speechSynthesis.resume() // Chrome can be stuck paused
      for (const u of utterances) speechSynthesis.speak(u)
      setTimeout(() => done(speechSynthesis.speaking ? 'ok' : 'silent'), 3000)
    }
    // Chrome may swallow a speak() that comes right after cancel(), so wait a moment when something
    // is playing; otherwise speak at once, inside the tap (iPhone needs that).
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel()
      setTimeout(go, 120)
    } else go()
  })
}

/** Plain-words help when speaking fails. */
export function speakProblem(r: SpeakResult, lang: 'en' | 'vi'): string | null {
  if (r === 'ok') return null
  const vi = lang === 'vi'
  if (r === 'unsupported') return vi ? 'Trình duyệt này không đọc được. Hãy thử Chrome, Edge hoặc Safari.' : "This browser can't speak. Try Chrome, Edge or Safari."
  if (r === 'error:not-allowed') return vi ? 'Trình duyệt chặn âm thanh. Chạm vào trang một lần rồi bấm Nghe thử lại.' : 'The browser blocked the sound. Tap the page once, then press Test voice again.'
  if (r === 'error:voice-unavailable' || r === 'error:language-unavailable') return vi ? 'Giọng này chưa được cài trên thiết bị. Chọn "Giọng tự nhiên nhất" hoặc giọng khác.' : 'That voice isn’t installed on this device. Pick "Most natural voice" or another voice.'
  return vi
    ? 'Tôi không phát ra tiếng được. Kiểm tra: âm lượng đã bật, iPhone không ở chế độ im lặng, tab trình duyệt không bị tắt tiếng, rồi thử giọng khác.'
    : "I couldn't make a sound. Check that the volume is up, your iPhone isn't on silent, and the browser tab isn't muted, then try another voice."
}

/** Saved voice settings (set in the Brain tab), for speaking outside it. */
export function loadVoicePrefs(): VoicePrefs {
  try {
    return { ...DEFAULT_VOICE, ...JSON.parse(localStorage.getItem('arc.jarvisVoice.v1') ?? '{}') }
  } catch {
    return DEFAULT_VOICE
  }
}

/** Stop speaking; with `by`, only when that caller started the current speech. */
export const stopSpeaking = (by?: string) => {
  if (canSpeak() && (by == null || by === owner)) speechSynthesis.cancel()
}
