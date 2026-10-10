/**
 * Jarvis's spoken voice: the browser's free built-in speech (Web Speech API). No key and no
 * network service of ours; which voices exist depends on the device and browser.
 */
import { useEffect, useState } from 'react'

export interface VoicePrefs {
  /** voiceURI of the chosen voice, or '' for the device default in the app's language. */
  voice: string
  rate: number
  pitch: number
}

export const DEFAULT_VOICE: VoicePrefs = { voice: '', rate: 1, pitch: 1 }

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

/** The most human-sounding voice the device has for a language. */
export function bestVoice(voices: SpeechSynthesisVoice[], lang: 'en' | 'vi') {
  const mine = voices.filter((v) => v.lang.toLowerCase().startsWith(lang))
  return mine.find(isNatural) ?? mine.find((v) => v.localService === false) ?? mine[0]
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

export function speak(text: string, prefs: VoicePrefs, lang: 'en' | 'vi', voices: SpeechSynthesisVoice[]) {
  if (!canSpeak()) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(speakable(text, lang))
  const chosen = voices.find((v) => v.voiceURI === prefs.voice) ?? bestVoice(voices, lang)
  if (chosen) u.voice = chosen
  u.lang = chosen?.lang ?? (lang === 'vi' ? 'vi-VN' : 'en-US')
  u.rate = Math.min(2, Math.max(0.5, prefs.rate))
  u.pitch = Math.min(2, Math.max(0, prefs.pitch))
  speechSynthesis.speak(u)
}

/** Saved voice settings (set in the Brain tab), for speaking outside it. */
export function loadVoicePrefs(): VoicePrefs {
  try {
    return { ...DEFAULT_VOICE, ...JSON.parse(localStorage.getItem('arc.jarvisVoice.v1') ?? '{}') }
  } catch {
    return DEFAULT_VOICE
  }
}

export const stopSpeaking = () => canSpeak() && speechSynthesis.cancel()
