import { useEffect, useRef, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { appendSpeech, buildPrompt, CLAUDE_PROJECT_URL, type VoiceLang } from '../lib/voiceRequest'

const T = {
  title: { en: 'Tell Claude by voice', vi: 'Nói cho Claude' },
  hint: { en: 'Press the mic and talk, or type. Press Done and I write the prompt for you to check.', vi: 'Bấm mic rồi nói, hoặc gõ. Nói xong bấm Xong, em viết prompt cho anh xem lại.' },
  mic: { en: 'Talk', vi: 'Bấm để nói' },
  micOn: { en: 'Listening… press to pause', vi: 'Đang nghe… bấm để tạm dừng' },
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
    en: 'A web page cannot post into a Claude chat by itself, so Send does two things: copies the prompt and opens the Neo Hub project. You paste once. On a phone, Share… sends it through the share sheet (pick Claude). Voice uses the browser\'s own free speech recognition; Vietnamese mode also catches English words, switch to English for long English sentences. Nothing leaves this device until you paste it.',
    vi: 'Trang web không tự gõ vào khung chat Claude được, nên nút Gửi làm hai việc: copy prompt và mở dự án Neo Hub. Anh dán một lần là xong. Trên điện thoại, nút Chia sẻ… gửi qua bảng chia sẻ (chọn Claude). Giọng nói dùng nhận dạng miễn phí của chính trình duyệt; chế độ Tiếng Việt vẫn bắt được từ tiếng Anh, câu tiếng Anh dài thì chuyển sang English. Chưa dán thì chưa có gì rời khỏi máy này.',
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
  const [vlang, setVlang] = useState<VoiceLang>('vi-VN')
  const [text, setText] = useState('')
  const [live, setLive] = useState('')
  const [on, setOn] = useState(false)
  const [err, setErr] = useState<'' | 'noMic' | 'micErr'>(ctor() ? '' : 'noMic')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [muse, setMuse] = useState(() => store.get('neo.muse.prompt'))
  const [copied, setCopied] = useState(false)
  const rec = useRef<Rec | null>(null)
  const want = useRef(false)

  const stop = () => {
    want.current = false
    setOn(false)
    rec.current?.stop()
  }
  useEffect(() => () => { want.current = false; rec.current?.stop() }, [])
  useEffect(() => store.set('neo.muse.prompt', muse), [muse])

  const start = () => {
    const C = ctor()
    if (!C) return setErr('noMic')
    setErr('')
    want.current = true
    setOn(true)
    const run = () => {
      const r = new C()
      rec.current = r
      r.lang = vlang
      r.continuous = true
      r.interimResults = true
      r.maxAlternatives = 1
      r.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0]?.transcript ?? ''
          if (e.results[i].isFinal) { setText((p) => appendSpeech(p, t)); interim = '' } else interim += t
        }
        setLive(interim)
      }
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
          want.current = false
          setOn(false)
          setErr('micErr')
        }
      }
      // the browser stops after a pause: keep listening until the user presses stop
      r.onend = () => {
        setLive('')
        if (want.current) { try { run() } catch { setOn(false) } } else setOn(false)
      }
      r.start()
    }
    try { run() } catch { setOn(false); setErr('micErr') }
  }

  const finish = () => {
    stop()
    const all = appendSpeech(text, live)
    setLive('')
    setText(all)
    const p = buildPrompt(all)
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
          <button type="button" className={`vr-mic${on ? ' on' : ''}`} onClick={on ? stop : start} disabled={err === 'noMic'} aria-pressed={on}>
            <span className="vr-dot" aria-hidden="true" />
            {on ? L('micOn') : L('mic')}
          </button>
          <div className="vr-lang" role="group" aria-label="Language">
            {(['vi-VN', 'en-US'] as const).map((l) => (
              <button key={l} type="button" className={`btn${vlang === l ? ' primary' : ''}`} disabled={on} onClick={() => setVlang(l)}>{l === 'vi-VN' ? 'Tiếng Việt' : 'English'}</button>
            ))}
          </div>
          {err && <p className="small vr-err" role="alert">{L(err)}</p>}
          <textarea rows={4} value={on && live ? appendSpeech(text, live) : text} onChange={(e) => setText(e.target.value)} placeholder={L('ph')} readOnly={on && !!live} maxLength={2000} />
          <div className="ag-acts">
            <button className="btn primary vr-big" disabled={appendSpeech(text, live).trim().length < 4} onClick={finish}>{L('done')}</button>
            {text && <button className="btn" onClick={() => { stop(); setText(''); setLive('') }}>{L('clear')}</button>}
          </div>
        </>
      ) : (
        <>
          <p className="muted small">{L('review')}</p>
          <textarea className="vr-prompt" rows={10} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={4000} />
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
