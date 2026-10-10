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

/** English and Vietnamese voices first, the rest after. */
export function sortVoices(voices: SpeechSynthesisVoice[]) {
  const rank = (v: SpeechSynthesisVoice) => (v.lang.startsWith('en') ? 0 : v.lang.startsWith('vi') ? 1 : 2)
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
}

export function speak(text: string, prefs: VoicePrefs, lang: 'en' | 'vi', voices: SpeechSynthesisVoice[]) {
  if (!canSpeak()) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const chosen = voices.find((v) => v.voiceURI === prefs.voice) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang))
  if (chosen) u.voice = chosen
  u.lang = chosen?.lang ?? (lang === 'vi' ? 'vi-VN' : 'en-US')
  u.rate = Math.min(2, Math.max(0.5, prefs.rate))
  u.pitch = Math.min(2, Math.max(0, prefs.pitch))
  speechSynthesis.speak(u)
}

export const stopSpeaking = () => canSpeak() && speechSynthesis.cancel()
