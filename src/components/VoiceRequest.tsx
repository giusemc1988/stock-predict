import { useEffect, useRef, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { appendSpeech, buildPrompt, captionLang, CLAUDE_PROJECT_URL, MAX_RECORD_MS, WHISPER_HINT, type VoiceMode } from '../lib/voiceRequest'

const T = {
  title: { en: 'Tell Claude by voice', vi: 'Nói cho Claude' },
  hint: { en: 'Press the mic and talk, or type. Press Done and I write the prompt for you to check.', vi: 'Bấm mic rồi nói, hoặc gõ. Nói xong bấm Xong, em viết prompt cho anh xem lại.' },
  mic: { en: 'Talk', vi: 'Bấm để nói' },
  micOn: { en: 'Listening… press when you finish', vi: 'Đang nghe… nói xong anh bấm lại' },
  chep: { en: 'Writing down what you said…', vi: 'Đang chép lời anh nói…' },
  live: { en: 'Hearing:', vi: 'Đang nghe:' },
  fallback: { en: 'The smart listener is not available now, so this is the browser\'s rougher version. Please check it.', vi: 'Bộ nghe thông minh đang không dùng được nên đây là bản thô của trình duyệt. Anh đọc lại giúp.' },
  auto: { en: 'Auto (mixed)', vi: 'Tự nhận (trộn Việt-Anh)' },
  noMic: { en: "This browser can't listen. Type instead (Chrome or Safari can listen).", vi: 'Trình duyệt này chưa nghe được. Anh gõ chữ nhé (Chrome hoặc Safari nghe được).' },
  micErr: { en: "Couldn't use the microphone. Allow it in the browser, or type.", vi: 'Chưa dùng được micro. Anh cho phép micro trong trình duyệt, hoặc gõ chữ.' },
  ph: { en: 'What you said appears here. You can fix it by hand.', vi: 'Lời anh nói hiện ở đây, anh sửa tay được.' },
  done: { en: 'Done', vi: 'Xong' },
  clear: { en: 'Clear', vi: 'Xoá' },
  review: { en: 'Check the prompt, edit if needed', vi: 'Xem lại prompt, sửa nếu cần' },
  back: { en: '← Back to my words', vi: '← Quay lại lời nói' },
  send: { en: 'Send to Claude', vi: 'Gửi cho Claude' },
  share: { en: 'Share…', vi: 'Chia sẻ…' },
  sent: { en: 'Prompt copied. The Claude project opened: tap the message box, hold, and Paste, then Send.', vi: 'Đã copy prompt. Dự án Claude vừa mở: anh chạm ô nhắn tin, giữ rồi Dán, rồi Gửi.' },
  copyFail: { en: "Couldn't copy by itself. Select the prompt and copy it by hand.", vi: 'Chưa copy tự động được. Anh bôi đen prompt rồi copy tay.' },
  details: { en: 'Details', vi: 'Chi tiết' },
  detailsText: {
    en: 'A web page cannot post into a Claude chat by itself, so Send does two things: copies the prompt and opens the Neo Hub project. You paste once. On a phone, Share… sends it through the share sheet (pick Claude). Voice is recorded and written down by Whisper (the free Groq key the Lumi translator already uses), which copes with Vietnamese mixed with English; the browser\'s own recognizer only shows live words and is the backup. The recording goes to Whisper only to be written down; the prompt leaves this device only when you paste it.',
    vi: 'Trang web không tự gõ vào khung chat Claude được, nên nút Gửi làm hai việc: copy prompt và mở dự án Neo Hub. Anh dán một lần là xong. Trên điện thoại, nút Chia sẻ… gửi qua bảng chia sẻ (chọn Claude). Giọng nói được ghi âm rồi Whisper chép lại (dùng key Groq miễn phí mà Lumi đã có), nghe được tiếng Việt xen tiếng Anh; nhận dạng của trình duyệt chỉ hiện chữ tạm khi nói và làm dự phòng. Đoạn ghi âm chỉ gửi cho Whisper để chép chữ; prompt chỉ rời khỏi máy khi anh dán.',
  },
  museTitle: { en: 'Prompt for Muse', vi: 'Prompt cho Muse' },
  museHint: { en: 'Claude answers with a plan and a ready prompt. Paste it here to keep it, then copy to Muse.', vi: 'Claude trả lời phương án và prompt sẵn. Dán vào đây để giữ, rồi copy cho Muse.' },
  copy: { en: 'Copy', vi: 'Copy' },
  copied: { en: 'Copied ✓', vi: 'Đã copy ✓' },
  paste: { en: 'Paste', vi: 'Dán' },
} satisfies Record<string, Bi>

interface Rec {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
const ctor = (): (new () => Rec) | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* ignore */ }
    ta.remove()
    return ok
  }
}

/** Max: speak or type a request, press Done, review the prompt, send it to Claude, keep the Muse prompt Claude returns. */
export function VoiceRequest() {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  const [mode, setMode] = useState<VoiceMode>('auto')
  const [text, setText] = useState('')
  const [live, setLive] = useState('')
  const [phase, setPhase] = useState<'idle' | 'rec' | 'wait'>('idle')
  const [err, setErr] = useState<'' | 'noMic' | 'micErr'>(typeof MediaRecorder === 'undefined' && !ctor() ? 'noMic' : '')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [muse, setMuse] = useState(() => store.get('neo.muse.prompt'))
  const [copied, setCopied] = useState(false)
  const rec = useRef<Rec | null>(null)
  const want = useRef(false)
  const mr = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const caps = useRef('')
  const timer = useRef(0)
  const on = phase === 'rec'

  useEffect(() => () => {
    want.current = false
    rec.current?.stop()
    window.clearTimeout(timer.current)
    mr.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])
  useEffect(() => store.set('neo.muse.prompt', muse), [muse])

  /** Browser captions: only shown live and kept as a backup, never typed into the box while you talk. */
  const startCaptions = () => {
    const C = ctor()
    if (!C) return
    want.current = true
    caps.current = ''
    const run = () => {
      const r = new C()
      rec.current = r
      r.lang = captionLang(mode)
      r.continuous = true
      r.interimResults = true
      r.maxAlternatives = 1
      r.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0]?.transcript ?? ''
          if (e.results[i].isFinal) caps.current = appendSpeech(caps.current, t)
          else interim += t
        }
        setLive(appendSpeech(caps.current, interim).slice(-160))
      }
      r.onerror = () => {}
      r.onend = () => { if (want.current) { try { run() } catch { /* captions are optional */ } } }
      r.start()
    }
    try { run() } catch { /* captions are optional */ }
  }
  const stopCaptions = () => {
    want.current = false
    rec.current?.stop()
  }

  const transcribe = async (blob: Blob) => {
    setPhase('wait')
    try {
      const form = new FormData()
      form.append('audio', blob, blob.type.includes('mp4') ? 'v.mp4' : blob.type.includes('ogg') ? 'v.ogg' : 'v.webm')
      form.append('translate', '0')
      form.append('long', '1')
      form.append('prompt', WHISPER_HINT)
      if (mode !== 'auto') form.append('language', mode)
      const res = await fetch('/api/lumi/hear', { method: 'POST', body: form })
      const j = (await res.json().catch(() => ({}))) as { text?: string }
      if (res.ok && j.text) { setText((p) => appendSpeech(p, j.text ?? '')); setNote(''); return }
      if (res.ok) { setNote(''); return } // silence
      throw new Error(String(res.status))
    } catch {
      if (caps.current.trim()) { setText((p) => appendSpeech(p, caps.current)); setNote(L('fallback')) }
    } finally {
      setPhase('idle')
      setLive('')
    }
  }

  const stop = () => {
    window.clearTimeout(timer.current)
    stopCaptions()
    if (mr.current && mr.current.state !== 'inactive') mr.current.stop()
    else {
      if (caps.current.trim()) setText((p) => appendSpeech(p, caps.current))
      caps.current = ''
      setPhase('idle')
      setLive('')
    }
  }

  const start = async () => {
    setErr('')
    setNote('')
    setLive('')
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // no recorder here: browser captions are all we have
      if (!ctor()) return setErr('noMic')
      startCaptions()
      setPhase('rec')
      mr.current = null
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const m = new MediaRecorder(stream)
      chunks.current = []
      m.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      m.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        void transcribe(new Blob(chunks.current, { type: m.mimeType || 'audio/webm' }))
      }
      mr.current = m
      m.start()
      setPhase('rec')
      startCaptions()
      timer.current = window.setTimeout(stop, MAX_RECORD_MS)
    } catch {
      setErr('micErr')
    }
  }

  const finish = () => {
    const p = buildPrompt(text)
    if (p) { setPrompt(p); setNote('') }
  }

  const send = async () => {
    if (!prompt) return
    const ok = await copyText(prompt)
    window.open(CLAUDE_PROJECT_URL, '_blank', 'noopener,noreferrer')
    setNote(ok ? L('sent') : L('copyFail'))
  }
  const share = () => { void navigator.share({ title: 'Neo Hub', text: prompt ?? '' }).catch(() => {}) }
  const copyMuse = async () => {
    if (await copyText(muse)) { setCopied(true); setTimeout(() => setCopied(false), 1800) }
  }
  const pasteMuse = () => { void navigator.clipboard.readText().then((t) => t && setMuse(t)).catch(() => {}) }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <section className="bf-card vr">
      <header><h3>{L('title')}</h3></header>
      {prompt == null ? (
        <>
          <p className="muted small">{L('hint')}</p>
          <button type="button" className={`vr-mic${on ? ' on' : ''}`} onClick={on ? stop : () => void start()} disabled={err === 'noMic' || phase === 'wait'} aria-pressed={on}>
            <span className="vr-dot" aria-hidden="true" />
            {phase === 'wait' ? L('chep') : on ? L('micOn') : L('mic')}
          </button>
          {on && live && <p className="small muted vr-live" aria-live="polite">{L('live')} {live}</p>}
          <div className="vr-lang" role="group" aria-label="Language">
            {(['auto', 'vi', 'en'] as const).map((l) => (
              <button key={l} type="button" className={`btn${mode === l ? ' primary' : ''}`} disabled={phase !== 'idle'} onClick={() => setMode(l)}>{l === 'auto' ? L('auto') : l === 'vi' ? 'Tiếng Việt' : 'English'}</button>
            ))}
          </div>
          {err && <p className="small vr-err" role="alert">{L(err)}</p>}
          {note && <p className="small" role="status">{note}</p>}
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoCorrect="off" autoCapitalize="off" placeholder={L('ph')} maxLength={3000} />
          <div className="ag-acts">
            <button className="btn primary vr-big" disabled={phase !== 'idle' || text.trim().length < 4} onClick={finish}>{L('done')}</button>
            {text && <button className="btn" onClick={() => { setText(''); setNote('') }}>{L('clear')}</button>}
          </div>
        </>
      ) : (
        <>
          <p className="muted small">{L('review')}</p>
          <textarea className="vr-prompt" rows={10} value={prompt} onChange={(e) => setPrompt(e.target.value)} spellCheck={false} maxLength={4000} />
          <div className="ag-acts">
            <button className="btn primary vr-big" disabled={!prompt.trim()} onClick={() => void send()}>{L('send')}</button>
            {canShare && <button className="btn" onClick={share}>{L('share')}</button>}
            <button className="btn" onClick={() => { setPrompt(null); setNote('') }}>{L('back')}</button>
          </div>
          {note && <p className="small" role="status">{note}</p>}
        </>
      )}
      <details className="vr-det">
        <summary>{L('details')}</summary>
        <p className="muted small">{L('detailsText')}</p>
      </details>

      <div className="vr-muse">
        <h4>{L('museTitle')}</h4>
        <p className="muted small">{L('museHint')}</p>
        <textarea rows={5} value={muse} onChange={(e) => setMuse(e.target.value)} maxLength={20000} />
        <div className="ag-acts">
          <button className="btn primary" disabled={!muse.trim()} onClick={() => void copyMuse()}>{copied ? L('copied') : L('copy')}</button>
          <button className="btn" onClick={pasteMuse}>{L('paste')}</button>
        </div>
      </div>
    </section>
  )
}
