import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { audioFileName, type LumiConversation, type LumiLine, type LumiMode } from '../lib/lumiTranslate'
import { useHubTheme } from '../lib/themes'
import { AgentShell } from './AgentShell'
import { useAiRules } from '../lib/aiRules'
import { findMoney } from '../lib/lumiMoney'
import { isLumiLang, type LumiLang } from '../lib/lumiPhrases'
import { LangPicker, LumiCulture, LumiMenu, LumiMoney, LumiNotebook, LumiPhrasebook, LumiTalk, LumiVocab, MoneyChips, ScamList, useRates, useVocab } from './LumiTools'

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
  liveTitle: { en: 'Live translation', vi: 'Dịch trực tiếp' },
  liveWait: { en: 'First caption appears about 6-8 seconds after someone speaks.', vi: 'Câu dịch đầu tiên hiện sau khoảng 6-8 giây khi có người nói.' },
  hearingNow: { en: 'Translating…', vi: 'Đang dịch…' },
  hearFail: { en: 'Could not recognise speech', vi: 'Không nhận được giọng nói' },
  netFail: { en: 'Network problem, retrying with the next chunk…', vi: 'Lỗi mạng, sẽ thử lại ở đoạn sau…' },
  noVi: { en: '(not translated yet)', vi: '(chưa dịch được)' },
  clear: { en: 'Clear', vi: 'Xóa' },
  tabListen: { en: '👂 Listen', vi: '👂 Nghe' },
  tabTalk: { en: '💬 Two-way', vi: '💬 Hai chiều' },
  tabPhrases: { en: '📖 Phrases', vi: '📖 Câu nói sẵn' },
  tabMoney: { en: '💱 Money', vi: '💱 Đổi tiền' },
  tabWords: { en: '⭐ Words', vi: '⭐ Từ vựng' },
  tabTips: { en: '🧭 Etiquette', vi: '🧭 Văn hóa' },
  tabMenu: { en: '📷 Menu', vi: '📷 Chụp menu' },
  tabNotes: { en: '📓 Trip notes', vi: '📓 Sổ tay' },
  langOf: { en: 'Their language', vi: 'Tiếng của họ' },
} satisfies Record<string, Bi>

/** Browsers that support MediaRecorder + audio/webm; Safari/iOS need a different mime and are out of scope for v1. */
function recorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) if (MediaRecorder.isTypeSupported(t)) return t
  return null
}

/**
 * Each chunk is a separate, complete recording (stop + restart), because MediaRecorder's timeslice
 * chunks after the first have no container header and Whisper rejects them. 6 s keeps captions live.
 */
const CHUNK_MS = 6_000
const GROUP_EVERY_MS = 45_000
const MAX_LIVE = 40

export function LumiPage({ onBack, glass = true }: { onBack: () => void; glass?: boolean }) {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  useHubTheme()
  const rules = useAiRules()
  const tools = rules.lumiTools !== false
  type Tab = 'listen' | 'talk' | 'menu' | 'phrases' | 'money' | 'words' | 'tips' | 'notes'
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
  const [hearing, setHearing] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [live, setLive] = useState<LumiLine[]>([])
  const [conversations, setConversations] = useState<LumiConversation[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const runningRef = useRef(false)
  const linesRef = useRef<LumiLine[]>([])
  const modeRef = useRef<LumiMode>('talk')
  const busyRef = useRef(false)
  const groupTimer = useRef<number | null>(null)
  const levelTimer = useRef<number | null>(null)
  const chunkTimer = useRef<number | null>(null)

  const stop = useCallback(() => {
    runningRef.current = false
    if (chunkTimer.current) window.clearTimeout(chunkTimer.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    if (groupTimer.current) window.clearInterval(groupTimer.current)
    if (levelTimer.current) window.clearInterval(levelTimer.current)
    setRunning(false)
    setLevel(0)
  }, [])

  const transcribeChunk = useCallback(async (blob: Blob, mime: string) => {
    const form = new FormData()
    form.append('audio', blob, audioFileName(mime))
    setHearing((n) => n + 1)
    try {
      const r = await fetch('/api/lumi/hear', { method: 'POST', body: form })
      const j = (await r.json().catch(() => ({}))) as { text?: string; lang?: string; vi?: string; viError?: string; error?: string }
      if (!r.ok) {
        setErr(j.error || `${L('hearFail')} (${r.status})`)
        // a missing/wrong key will not fix itself: stop instead of failing every 6 s
        if (r.status === 409 || r.status === 401 || r.status === 403) stop()
        return
      }
      setErr(null)
      setWarn(j.viError ?? null)
      if (!j.text) return
      const line: LumiLine = { text: j.text, lang: j.lang ?? 'und', at: Date.now(), vi: j.vi ?? '' }
      linesRef.current = [...linesRef.current, line].slice(-60)
      setLive((l) => [line, ...l].slice(0, MAX_LIVE))
    } catch {
      setErr(L('netFail'))
    } finally {
      setHearing((n) => n - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, lang])

  const runGrouping = useCallback(async () => {
    if (!linesRef.current.length || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const r = await fetch('/api/lumi/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: linesRef.current, mode: modeRef.current }) })
      const j = (await r.json()) as { conversations?: LumiConversation[] }
      if (j.conversations) setConversations(j.conversations)
    } catch {
      // keep showing the last grouping; try again next tick
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [])

  /** Records one complete chunk, sends it, and starts the next one while this one is translated. */
  const recordChunk = useCallback((stream: MediaStream, mime: string) => {
    if (!runningRef.current) return
    const rec = new MediaRecorder(stream, { mimeType: mime })
    const parts: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data) }
    rec.onstop = () => {
      if (parts.length) void transcribeChunk(new Blob(parts, { type: mime }), mime)
      recordChunk(stream, mime)
    }
    rec.start()
    recorderRef.current = rec
    chunkTimer.current = window.setTimeout(() => { if (rec.state === 'recording') rec.stop() }, CHUNK_MS)
  }, [transcribeChunk])

  const start = useCallback(async () => {
    setErr(null)
    setWarn(null)
    setSaveMsg(null)
    const mime = recorderMime()
    if (!mime) {
      setErr(L('needMic'))
      return
    }
    let stream: MediaStream
    try {
      // no echo cancellation / noise suppression: those cut out speakers playing a video or a nearby voice
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } })
    } catch {
      setErr(L('needMic'))
      return
    }
    streamRef.current = stream
    modeRef.current = mode

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    ctxRef.current = ctx
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    levelTimer.current = window.setInterval(() => {
      analyser.getByteFrequencyData(data)
      setLevel(data.reduce((a, b) => a + b, 0) / data.length / 255)
    }, 150)

    runningRef.current = true
    recordChunk(stream, mime)
    groupTimer.current = window.setInterval(() => void runGrouping(), GROUP_EVERY_MS)
    setRunning(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordChunk, runGrouping, lang, mode])

  useEffect(() => () => stop(), [stop])

  const save = useCallback(async () => {
    if (!conversations.length) return
    try {
      const r = await fetch('/api/lumi/trips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, conversations: conversations.map((c) => ({ lang: c.lang, summaryVi: c.summaryVi, alertVi: c.alertVi })) }),
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
          {(['listen', 'talk', 'menu', 'phrases', 'money', 'words', 'tips', 'notes'] as const).map((k) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {L(`tab${k[0].toUpperCase()}${k.slice(1)}` as keyof typeof T)}
            </button>
          ))}
        </nav>
      )}
      {tools && (tab === 'talk' || tab === 'menu' || tab === 'phrases' || tab === 'tips') && (
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
      {tools && tab === 'tips' && <ScamList lang={lang} target={target} />}
      {tools && tab === 'menu' && <LumiMenu lang={lang} target={target} vocab={vocab} rates={rates} />}
      {tools && tab === 'notes' && <LumiNotebook lang={lang} />}
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
        {err && <p className="small lumi-err" role="alert">⚠ {err}</p>}
        {warn && <p className="small muted">{warn}</p>}

        {running && (
          <div className="lumi-listen">
            <span className="lumi-dot" />
            <span className="small">{L('listening')}</span>
            <span className="lumi-meter"><i style={{ width: `${Math.round(level * 100)}%` }} /></span>
          </div>
        )}
        {busy && <p className="small muted">{L('translating')}</p>}
      </section>

      {(running || live.length > 0) && (
        <section className="bf-card lumi-live" aria-live="polite">
          <header>
            <h3>{L('liveTitle')}</h3>
            {hearing > 0 && <span className="small muted">{L('hearingNow')}</span>}
            {!running && live.length > 0 && <button className="btn" onClick={() => setLive([])}>{L('clear')}</button>}
          </header>
          {!live.length && <p className="small muted">{L('liveWait')}</p>}
          {live.map((l) => (
            <div key={l.at} className="lumi-cap">
              <p className="lumi-cap-vi">{l.vi || <span className="muted">{L('noVi')}</span>}</p>
              <p className="small muted"><b>[{l.lang}]</b> {l.text}</p>
              {tools && <MoneyChips found={findMoney(l.text)} rates={rates} />}
            </div>
          ))}
        </section>
      )}

      {conversations.length > 0 && (
        <section className="bf-card">
          <header><h3>{L('conversations')}</h3></header>
          <div className="rv-kv lumi-conv-grid">
            {conversations.map((c) => (
              <button key={c.id} className="lumi-conv" onClick={() => setOpenId(c.id)}>
                <b>[{c.lang}]</b>
                <p>{c.summaryVi || c.lines.map((l) => l.text).join(' / ')}</p>
                {c.alertVi && <span className="lumi-alert">⚠ {c.alertVi}</span>}
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
