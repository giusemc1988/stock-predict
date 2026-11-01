import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import type { LumiConversation, LumiLine, LumiMode } from '../lib/lumiTranslate'
import { useHubTheme } from '../lib/themes'
import { AgentShell } from './AgentShell'
import { useAiRules } from '../lib/aiRules'
import { findMoney } from '../lib/lumiMoney'
import { isLumiLang, type LumiLang } from '../lib/lumiPhrases'
import { LangPicker, LumiCulture, LumiMoney, LumiPhrasebook, LumiTalk, LumiVocab, MoneyChips, useRates, useVocab } from './LumiTools'

const T = {
  back: { en: '← Hub', vi: '← Hub' },
  title: { en: 'Lumi · Travel translator', vi: 'Lumi · Tai phiên dịch du lịch' },
  sub: { en: 'Turn it on and Lumi listens, detects the language, groups what it hears into conversations, and gives a rolling Vietnamese summary. Audio is never kept.', vi: 'Bật lên là Lumi nghe, tự nhận ra thứ tiếng, gom lại theo từng cuộc trò chuyện, và tóm tắt tiếng Việt liên tục. Không lưu âm thanh.' },
  modeTalk: { en: 'Talk to me', vi: 'Nói với em' },
  modeAmbient: { en: 'Listen around', vi: 'Nghe xung quanh' },
  start: { en: '● Start listening', vi: '● Bắt đầu nghe' },
  stop: { en: '■ Stop listening', vi: '■ Dừng nghe' },
  listening: { en: 'Listening', vi: 'Đang nghe' },
  translating: { en: 'Translating the last bit…', vi: 'Đang dịch đoạn vừa nghe…' },
  needMic: { en: 'Microphone access is needed.', vi: 'Cần quyền dùng micro.' },
  noGroq: { en: 'Save a free Groq key in Settings first (used for speech recognition).', vi: 'Lưu key Groq miễn phí trong Cài đặt trước (dùng để nhận giọng nói).' },
  conversations: { en: 'Conversations around you', vi: 'Các cuộc trò chuyện quanh anh' },
  tapForDetail: { en: 'tap to see the original', vi: 'chạm để xem bản gốc' },
  lines: { en: 'lines', vi: 'câu' },
  save: { en: '☆ Save this trip', vi: '☆ Lưu chuyến này' },
  saved: { en: 'Saved.', vi: 'Đã lưu.' },
  savedTrips: { en: 'Saved trips', vi: 'Chuyến đã lưu' },
  privacy: { en: 'Audio is never stored. No one is identified. Recording strangers can be illegal in some places — "Talk to me" is the safe mode.', vi: 'Không lưu âm thanh. Không nhận diện ai. Ở một số nơi, ghi âm người lạ có thể phạm luật — "Nói với em" là chế độ an toàn.' },
  close: { en: 'Close', vi: 'Đóng' },
  tabListen: { en: '👂 Listen', vi: '👂 Nghe' },
  tabTalk: { en: '💬 Two-way', vi: '💬 Hai chiều' },
  tabPhrases: { en: '📖 Phrases', vi: '📖 Câu nói sẵn' },
  tabMoney: { en: '💱 Money', vi: '💱 Đổi tiền' },
  tabWords: { en: '⭐ Words', vi: '⭐ Từ vựng' },
  tabTips: { en: '🧭 Etiquette', vi: '🧭 Văn hóa' },
  langOf: { en: 'Their language', vi: 'Tiếng của họ' },
} satisfies Record<string, Bi>

/** Browsers that support MediaRecorder + audio/webm; Safari/iOS need a different mime and are out of scope for v1. */
function recorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) if (MediaRecorder.isTypeSupported(t)) return t
  return null
}

const CHUNK_MS = 20_000
const GROUP_EVERY_MS = 45_000

export function LumiPage({ onBack, glass = true }: { onBack: () => void; glass?: boolean }) {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  useHubTheme()
  const rules = useAiRules()
  const tools = rules.lumiTools !== false
  type Tab = 'listen' | 'talk' | 'phrases' | 'money' | 'words' | 'tips'
  const [tab, setTab] = useState<Tab>('listen')
  const [target, setTargetRaw] = useState<LumiLang>(() => {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem('lumi:lang')
    return isLumiLang(v) ? v : 'en'
  })
  const setTarget = (l: LumiLang) => { setTargetRaw(l); try { localStorage.setItem('lumi:lang', l) } catch { /* ignore */ } }
  const vocab = useVocab()
  const rates = useRates()

  const [mode, setMode] = useState<LumiMode>('talk')
  const [running, setRunning] = useState(false)
  const [level, setLevel] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [conversations, setConversations] = useState<LumiConversation[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const linesRef = useRef<LumiLine[]>([])
  const groupTimer = useRef<number | null>(null)
  const levelTimer = useRef<number | null>(null)

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (groupTimer.current) window.clearInterval(groupTimer.current)
    if (levelTimer.current) window.clearInterval(levelTimer.current)
    setRunning(false)
    setLevel(0)
  }, [])

  const transcribeChunk = useCallback(async (blob: Blob) => {
    const form = new FormData()
    form.append('audio', blob, 'chunk.webm')
    try {
      const r = await fetch('/api/lumi/hear', { method: 'POST', body: form })
      const j = (await r.json()) as { text?: string; lang?: string; error?: string }
      if (!r.ok || !j.text) return
      linesRef.current = [...linesRef.current, { text: j.text, lang: j.lang ?? 'und', at: Date.now() }].slice(-60)
    } catch {
      // one chunk lost to a network blip is fine, the next one carries on
    }
  }, [])

  const runGrouping = useCallback(async () => {
    if (!linesRef.current.length || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/lumi/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: linesRef.current, mode }) })
      const j = (await r.json()) as { conversations?: LumiConversation[] }
      if (j.conversations) setConversations(j.conversations)
    } catch {
      // keep showing the last grouping; try again next tick
    } finally {
      setBusy(false)
    }
  }, [mode, busy])

  const start = useCallback(async () => {
    setErr(null)
    setSaveMsg(null)
    const mime = recorderMime()
    if (!mime) {
      setErr(L('needMic'))
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setErr(L('needMic'))
      return
    }
    streamRef.current = stream

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    levelTimer.current = window.setInterval(() => {
      analyser.getByteFrequencyData(data)
      setLevel(data.reduce((a, b) => a + b, 0) / data.length / 255)
    }, 150)

    const rec = new MediaRecorder(stream, { mimeType: mime })
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) void transcribeChunk(e.data)
    }
    rec.start(CHUNK_MS)
    recorderRef.current = rec
    groupTimer.current = window.setInterval(() => void runGrouping(), GROUP_EVERY_MS)
    setRunning(true)
  }, [transcribeChunk, runGrouping, lang])

  useEffect(() => () => stop(), [stop])

  const save = useCallback(async () => {
    if (!conversations.length) return
    try {
      const r = await fetch('/api/lumi/trips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, conversations: conversations.map((c) => ({ lang: c.lang, summaryVi: c.summaryVi })) }),
      })
      setSaveMsg(r.ok ? L('saved') : null)
    } catch {
      setSaveMsg(null)
    }
  }, [conversations, mode, lang])

  const open = conversations.find((c) => c.id === openId) ?? null

  return (
    <AgentShell id="lumi" glass={glass} onBack={onBack} backLabel={L('back')} title={L('title')} sub={L('sub')}>
      {tools && (
        <nav className="lumi-tabs lumi-main-tabs" aria-label="Lumi">
          {(['listen', 'talk', 'phrases', 'money', 'words', 'tips'] as const).map((k) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {L(`tab${k[0].toUpperCase()}${k.slice(1)}` as keyof typeof T)}
            </button>
          ))}
        </nav>
      )}
      {tools && (tab === 'talk' || tab === 'phrases' || tab === 'tips') && (
        <section className="bf-card lumi-lang">
          <span className="small muted">{L('langOf')}</span>
          <LangPicker value={target} onChange={setTarget} />
        </section>
      )}
      {tools && tab === 'talk' && <LumiTalk lang={lang} target={target} vocab={vocab} />}
      {tools && tab === 'phrases' && <LumiPhrasebook lang={lang} target={target} vocab={vocab} />}
      {tools && tab === 'money' && <LumiMoney lang={lang} rates={rates} />}
      {tools && tab === 'words' && <LumiVocab lang={lang} vocab={vocab} />}
      {tools && tab === 'tips' && <LumiCulture lang={lang} target={target} />}
      {(!tools || tab === 'listen') && (<>
      <section className="bf-card">
        <div className="seg">
          <button className={mode === 'talk' ? 'on' : ''} onClick={() => setMode('talk')} disabled={running}>{L('modeTalk')}</button>
          <button className={mode === 'ambient' ? 'on' : ''} onClick={() => setMode('ambient')} disabled={running}>{L('modeAmbient')}</button>
        </div>

        {!running ? (
          <button className="btn primary volt-flash-btn" onClick={() => void start()}>{L('start')}</button>
        ) : (
          <button className="btn volt-flash-btn" onClick={stop}>{L('stop')}</button>
        )}
        {err && <p className="small" role="alert">{err}</p>}

        {running && (
          <div className="lumi-listen">
            <span className="lumi-dot" />
            <span className="small">{L('listening')}</span>
            <span className="lumi-meter"><i style={{ width: `${Math.round(level * 100)}%` }} /></span>
          </div>
        )}
        {busy && <p className="small muted">{L('translating')}</p>}
      </section>

      {conversations.length > 0 && (
        <section className="bf-card">
          <header><h3>{L('conversations')}</h3></header>
          <div className="rv-kv lumi-conv-grid">
            {conversations.map((c) => (
              <button key={c.id} className="lumi-conv" onClick={() => setOpenId(c.id)}>
                <b>[{c.lang}]</b>
                <p>{c.summaryVi || c.lines.map((l) => l.text).join(' / ')}</p>
                {tools && <MoneyChips found={c.lines.flatMap((l) => findMoney(l.text))} rates={rates} />}
                <small>{c.lines.length} {L('lines')} · {L('tapForDetail')}</small>
              </button>
            ))}
          </div>
          <div className="ag-acts">
            <button className="btn" onClick={() => void save()}>{L('save')}</button>
            {saveMsg && <span className="small ok">{saveMsg}</span>}
          </div>
        </section>
      )}

      {open && (
        <div className="lumi-modal" role="dialog" onClick={() => setOpenId(null)}>
          <div className="bf-card" onClick={(e) => e.stopPropagation()}>
            <header><h3>[{open.lang}]</h3><button className="btn" onClick={() => setOpenId(null)}>{L('close')}</button></header>
            {open.lines.map((l, i) => <p key={i} className="small">{l.text}</p>)}
          </div>
        </div>
      )}
      </>)}

      <p className="small muted lumi-privacy">🔒 {L('privacy')}</p>
    </AgentShell>
  )
}
