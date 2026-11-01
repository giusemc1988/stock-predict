import { useCallback, useEffect, useRef, useState } from 'react'
import { draftWorthIt, speechTagFor, vadReset, vadStart, vadStep, type Gist, type VadState } from '../lib/lumiLive'
import { audioFileName, type LumiConversation, type LumiLine, type LumiMode } from '../lib/lumiTranslate'

/**
 * Lumi Listen engine, two layers running together:
 * 1. Instant: the browser's own speech recognizer (free) streams words as they are spoken; each
 *    finished phrase is translated by the fast path (/api/lumi/fast: Workers AI m2m100 draft, Groq 8B
 *    final with context). Typical speech-end -> Vietnamese is about 1 s.
 * 2. Whisper: complete recordings cut at the speaker's pause (VAD, max 8 s). While the instant layer
 *    works these only detect the language (no translation, saves quota); when it does not (no browser
 *    recognizer, unsupported language, mic busy) Whisper chunks are translated and shown instead.
 * Plus a "gist" every ~15 s: what the talk is about, and reply suggestions in Talk mode.
 */

export interface LiveLine extends LumiLine {
  id: string
  /** where the text came from */
  src: 'instant' | 'whisper'
  /** ms from the end of speech to the Vietnamese being on screen */
  ms?: number
  pending?: boolean
}

type Recog = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
function Recognizer(): (new () => Recog) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function recorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) if (MediaRecorder.isTypeSupported(t)) return t
  return null
}

const TICK_MS = 100
const GROUP_EVERY_MS = 45_000
const GIST_EVERY_MS = 15_000
const MAX_LIVE = 40
/** instant layer counts as "working" if it produced a phrase this recently */
const INSTANT_FRESH_MS = 20_000
/**
 * If the recognizer's words have not changed for this long, translate them as a sentence right away
 * instead of waiting for its own "final" (Chrome on Android waits ~1 s of silence for that).
 */
const STALL_MS = 650
const norm = (t: string) => t.trim().toLowerCase().replace(/[\s.,!?。、！？]+/g, ' ').trim()

export type SpeakLang = 'auto' | string

export interface ListenText {
  needMic: string
  hearFail: string
  netFail: string
  noInstant: string
}

export function useLumiListen(mode: LumiMode, speakLang: SpeakLang, text: ListenText) {
  const [running, setRunning] = useState(false)
  const [level, setLevel] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hearing, setHearing] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [live, setLive] = useState<LiveLine[]>([])
  const [draft, setDraft] = useState<{ text: string; vi: string } | null>(null)
  const [gist, setGist] = useState<Gist | null>(null)
  const [conversations, setConversations] = useState<LumiConversation[]>([])
  const [heardLang, setHeardLang] = useState<string>('en')
  const [instantOn, setInstantOn] = useState(false)

  const r = useRef({
    running: false,
    stream: null as MediaStream | null,
    rec: null as MediaRecorder | null,
    ctx: null as AudioContext | null,
    recog: null as Recog | null,
    recogTag: '',
    instantDead: false,
    lastInstant: 0,
    lines: [] as LumiLine[],
    mode: 'talk' as LumiMode,
    busy: false,
    gistBusy: false,
    gistAt: 0,
    gistCount: 0,
    vad: vadStart(),
    dropChunk: false,
    timers: [] as number[],
    draftSent: '',
    draftBusy: false,
    lang: 'en',
    speakLang: 'auto' as SpeakLang,
    speechEndAt: 0,
    /** line already shown for the phrase still being spoken (committed when the words stalled) */
    earlyId: '',
    earlyText: '',
    stallTimer: 0,
  })
  r.current.speakLang = speakLang
  const T = useRef(text)
  T.current = text

  const instantWorking = () => !r.current.instantDead && Date.now() - r.current.lastInstant < INSTANT_FRESH_MS

  const pushLine = useCallback((line: LiveLine) => {
    r.current.lines = [...r.current.lines, line].slice(-60)
    setLive((l) => [line, ...l].slice(0, MAX_LIVE))
  }, [])
  const patchLine = useCallback((id: string, patch: Partial<LiveLine>) => {
    setLive((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    r.current.lines = r.current.lines.map((x) => ((x as LiveLine).id === id ? { ...x, ...patch } : x))
  }, [])
  const context = () => r.current.lines.slice(-3).map((l) => l.text)

  /** The language the instant recognizer should listen for. */
  const wantTag = () => speechTagFor(r.current.speakLang !== 'auto' ? r.current.speakLang : r.current.lang) ?? 'en-US'

  // ---------- instant layer ----------
  const fastTranslate = useCallback(async (body: { text: string; lang: string; context: string[]; draft: boolean }) => {
    const res = await fetch('/api/lumi/fast', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = (await res.json().catch(() => ({}))) as { vi?: string; error?: string }
    if (!res.ok || !j.vi) throw new Error(j.error || `${res.status}`)
    return j.vi
  }, [])

  /** Show + translate a phrase. Reuses the early line for the same utterance instead of adding a new one. */
  const commit = useCallback(async (phrase: string, final: boolean) => {
    const s = r.current
    const clean = phrase.trim()
    if (!clean) return
    s.lastInstant = Date.now()
    setInstantOn(true)
    const lang = s.speakLang !== 'auto' ? s.speakLang : s.lang
    // speech ended when the words stopped changing, not when the stall timer fired
    const end = Date.now() - (final ? 0 : STALL_MS)
    let id = s.earlyId
    // a different utterance (the recognizer never confirmed the last one): start a new line
    if (id && !norm(clean).startsWith(norm(s.earlyText).slice(0, 12))) { id = ''; s.earlyId = ''; s.earlyText = '' }
    if (id && norm(clean) === norm(s.earlyText)) {
      // the recognizer confirmed what we already translated
      if (final) { s.earlyId = ''; s.earlyText = '' }
      return
    }
    if (id) {
      patchLine(id, { text: clean, pending: true })
    } else {
      id = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      pushLine({ id, src: 'instant', text: clean, lang, at: end, vi: '', pending: true })
    }
    if (final) { s.earlyId = ''; s.earlyText = '' } else { s.earlyId = id; s.earlyText = clean }
    setDraft(null)
    s.draftSent = ''
    try {
      const ctx = s.lines.filter((l) => (l as LiveLine).id !== id).slice(-3).map((l) => l.text)
      const vi = await fastTranslate({ text: clean, lang, context: ctx, draft: false })
      // a newer, longer version of this line may have been sent meanwhile: keep the latest text's translation
      const cur = s.lines.find((l) => (l as LiveLine).id === id)
      if (cur && cur.text !== clean) return
      patchLine(id, { vi, pending: false, ms: Date.now() - end })
      setErr(null)
    } catch (e) {
      patchLine(id, { pending: false })
      setWarn((e as Error).message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fastTranslate, pushLine, patchLine])

  const onFinal = useCallback((phrase: string) => {
    window.clearTimeout(r.current.stallTimer)
    void commit(phrase, true)
  }, [commit])

  const onInterim = useCallback(async (partial: string) => {
    const s = r.current
    // words stalled -> treat as a sentence now
    window.clearTimeout(s.stallTimer)
    s.stallTimer = window.setTimeout(() => { if (s.running) void commit(partial, false) }, STALL_MS)
    const shown = s.earlyId && partial.toLowerCase().startsWith(s.earlyText.toLowerCase()) ? partial.slice(s.earlyText.length).trim() : partial
    if (!shown) return
    setDraft((d) => ({ text: shown, vi: d?.vi ?? '' }))
    if (s.draftBusy || !draftWorthIt(s.draftSent, partial, 2)) return
    s.draftBusy = true
    s.draftSent = partial
    try {
      const lang = s.speakLang !== 'auto' ? s.speakLang : s.lang
      const vi = await fastTranslate({ text: shown, lang, context: [], draft: true })
      setDraft((d) => (d ? { ...d, vi } : d))
    } catch {
      // drafts are best effort
    } finally {
      s.draftBusy = false
    }
  }, [fastTranslate, commit])

  const startInstant = useCallback(() => {
    const s = r.current
    const R = Recognizer()
    if (!R || s.instantDead || !s.running) return
    const rec = new R()
    rec.lang = wantTag()
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    s.recogTag = rec.lang
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const t = res[0]?.transcript ?? ''
        if (res.isFinal) onFinal(t)
        else interim += t
      }
      if (interim.trim()) void onInterim(interim.trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'audio-capture' && s.stream) {
        // phones that allow only one mic user: give the mic to the instant layer, Whisper pauses
        stopWhisper()
        return
      }
      // not-allowed / service-not-allowed / network / language-not-supported: Whisper carries on alone
      s.instantDead = true
      setInstantOn(false)
      setWarn(T.current.noInstant)
    }
    rec.onend = () => {
      // Chrome ends recognition after silence or ~1 min; keep it going while listening
      if (s.running && !s.instantDead && s.recog === rec) window.setTimeout(() => { if (s.recog === rec) startInstant() }, 150)
    }
    s.recog = rec
    try { rec.start() } catch { /* already started */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFinal, onInterim])

  /** Switch the instant recognizer when the detected/selected language changes. */
  const retuneInstant = useCallback(() => {
    const s = r.current
    if (!s.recog || !s.running) return
    if (wantTag() === s.recogTag) return
    const old = s.recog
    s.recog = null
    try { old.abort() } catch { /* ignore */ }
    startInstant()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startInstant])

  useEffect(() => { retuneInstant() }, [speakLang, heardLang, retuneInstant])

  // ---------- Whisper layer ----------
  const transcribe = useCallback(async (blob: Blob, mime: string, speechEnd: number) => {
    const s = r.current
    const form = new FormData()
    form.append('audio', blob, audioFileName(mime))
    const translate = !instantWorking()
    if (!translate) form.append('translate', '0')
    form.append('context', JSON.stringify(context()))
    setHearing((n) => n + 1)
    try {
      const res = await fetch('/api/lumi/hear', { method: 'POST', body: form })
      const j = (await res.json().catch(() => ({}))) as { text?: string; lang?: string; vi?: string; viError?: string; error?: string }
      if (!res.ok) {
        // with the instant layer working, a Whisper problem only costs language detection
        if (instantWorking()) return
        setErr(j.error || `${T.current.hearFail} (${res.status})`)
        if (res.status === 409 || res.status === 401 || res.status === 403) stopWhisper()
        return
      }
      setErr(null)
      if (j.lang && j.lang !== 'und' && j.text) {
        s.lang = j.lang
        setHeardLang(j.lang)
      }
      if (!translate || !j.text) return
      setWarn(j.viError ?? null)
      pushLine({ id: `w${Date.now().toString(36)}`, src: 'whisper', text: j.text, lang: j.lang ?? 'und', at: Date.now(), vi: j.vi ?? '', ms: Date.now() - speechEnd })
    } catch {
      if (!instantWorking()) setErr(T.current.netFail)
    } finally {
      setHearing((n) => n - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushLine])

  const recordChunk = useCallback((stream: MediaStream, mime: string) => {
    const s = r.current
    if (!s.running || s.stream !== stream) return
    const rec = new MediaRecorder(stream, { mimeType: mime })
    const parts: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data) }
    rec.onstop = () => {
      const drop = s.dropChunk
      s.dropChunk = false
      if (parts.length && !drop) void transcribe(new Blob(parts, { type: mime }), mime, s.speechEndAt || Date.now())
      recordChunk(stream, mime)
    }
    rec.start()
    s.rec = rec
    s.vad = vadReset(s.vad)
  }, [transcribe])

  function stopWhisper() {
    const s = r.current
    if (s.rec?.state === 'recording') { s.dropChunk = true; s.rec.stop() }
    s.rec = null
    s.stream?.getTracks().forEach((t) => t.stop())
    s.stream = null
    void s.ctx?.close().catch(() => {})
    s.ctx = null
  }

  const stop = useCallback(() => {
    const s = r.current
    s.running = false
    window.clearTimeout(s.stallTimer)
    s.earlyId = ''
    s.earlyText = ''
    s.timers.forEach((t) => window.clearInterval(t))
    s.timers = []
    const recog = s.recog
    s.recog = null
    try { recog?.abort() } catch { /* ignore */ }
    stopWhisper()
    setRunning(false)
    setLevel(0)
    setSpeaking(false)
    setDraft(null)
    setInstantOn(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runGrouping = useCallback(async () => {
    const s = r.current
    if (!s.lines.length || s.busy) return
    s.busy = true
    setBusy(true)
    try {
      const res = await fetch('/api/lumi/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: s.lines, mode: s.mode }) })
      const j = (await res.json()) as { conversations?: LumiConversation[] }
      if (j.conversations) setConversations(j.conversations)
    } catch {
      // keep the last grouping
    } finally {
      s.busy = false
      setBusy(false)
    }
  }, [])

  const runGist = useCallback(async () => {
    const s = r.current
    if (s.gistBusy || s.lines.length === s.gistCount || !s.lines.length) return
    s.gistBusy = true
    s.gistCount = s.lines.length
    try {
      const res = await fetch('/api/lumi/gist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: s.lines.slice(-12).map((l) => ({ text: l.text, lang: l.lang })), talk: s.mode === 'talk' }) })
      const j = (await res.json().catch(() => ({}))) as Gist & { error?: string }
      if (res.ok && j.topicVi) setGist({ topicVi: j.topicVi, replies: j.replies ?? [] })
    } catch {
      // gist is a bonus
    } finally {
      s.gistBusy = false
    }
  }, [])

  const start = useCallback(async () => {
    const s = r.current
    setErr(null)
    setWarn(null)
    setGist(null)
    s.mode = mode
    // wake the worker + its connections while the mic is being opened
    void fetch('/api/lumi/warm').catch(() => {})
    s.instantDead = !Recognizer()
    s.lastInstant = 0
    const mime = recorderMime()
    let stream: MediaStream | null = null
    try {
      // no echo cancellation / noise suppression: those cut out a nearby speaker or a video playing
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } })
    } catch {
      if (s.instantDead) { setErr(T.current.needMic); return }
    }
    s.running = true
    setRunning(true)
    if (s.instantDead) setWarn(T.current.noInstant)
    startInstant()

    if (stream && mime) {
      s.stream = stream
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      s.ctx = ctx
      // opened without a fresh tap (auto-start): make sure the analyser actually runs
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      s.vad = vadStart()
      s.timers.push(window.setInterval(() => {
        if (!s.rec) return
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / data.length)
        setLevel(Math.min(1, rms * 4))
        const step = vadStep(s.vad, rms, TICK_MS)
        s.vad = step.state
        setSpeaking(step.speaking)
        if (step.speaking) s.speechEndAt = 0
        else if (!s.speechEndAt && s.vad.speechMs > 0) s.speechEndAt = Date.now() - s.vad.quietMs
        if (step.cut && s.rec.state === 'recording') {
          s.dropChunk = step.drop
          s.rec.stop()
        }
      }, TICK_MS))
      recordChunk(stream, mime)
    }
    s.timers.push(window.setInterval(() => void runGrouping(), GROUP_EVERY_MS))
    s.timers.push(window.setInterval(() => void runGist(), GIST_EVERY_MS))
  }, [mode, startInstant, recordChunk, runGrouping, runGist])

  useEffect(() => () => stop(), [stop])

  return { running, level, speaking, busy, hearing, err, warn, live, setLive, draft, gist, conversations, heardLang, instantOn, start, stop }
}

export type { VadState }
