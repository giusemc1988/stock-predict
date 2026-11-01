import { useCallback, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import type { LumiMode } from '../lib/lumiTranslate'
import { speechTagFor } from '../lib/lumiLive'
import { useLumiListen, type SpeakLang } from './useLumiListen'
import { useHubTheme } from '../lib/themes'
import { AgentShell } from './AgentShell'
import { useAiRules } from '../lib/aiRules'
import { findMoney } from '../lib/lumiMoney'
import { isLumiLang, LUMI_LANGS, type LumiLang } from '../lib/lumiPhrases'
import { LangPicker, LumiCulture, LumiMenu, LumiMoney, LumiNotebook, LumiPhrasebook, LumiTalk, LumiVocab, MoneyChips, ScamList, speak, useRates, useVocab } from './LumiTools'

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
  liveWait: { en: 'Speak or play something: words appear as they are said, Vietnamese about 1 second after each sentence.', vi: 'Cứ nói hoặc mở video: chữ hiện ngay khi đang nói, tiếng Việt hiện khoảng 1 giây sau mỗi câu.' },
  noInstant: { en: 'Instant captions are not available in this browser, using the slower mode (a few seconds per sentence).', vi: 'Trình duyệt này không có chữ tức thì, Lumi dùng chế độ chậm hơn (vài giây mỗi câu).' },
  hearLang: { en: 'Language they speak', vi: 'Tiếng họ nói' },
  auto: { en: 'Auto', vi: 'Tự nhận' },
  hearHelp: { en: 'Pick the language if you know it: captions start faster. "Auto" works it out after the first sentence.', vi: 'Biết tiếng gì thì chọn luôn để chữ hiện nhanh hơn. "Tự nhận" sẽ tự đoán sau câu đầu tiên.' },
  instant: { en: '⚡ Instant', vi: '⚡ Tức thì' },
  slow: { en: 'Standard', vi: 'Thường' },
  draftLbl: { en: 'hearing…', vi: 'đang nghe…' },
  topic: { en: '💡 They are talking about', vi: '💡 Đang nói về' },
  replies: { en: 'You could answer (tap to say it)', vi: 'Anh có thể trả lời (chạm để máy đọc)' },
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
  const [speakLang, setSpeakLangRaw] = useState<SpeakLang>(() => {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem('lumi:hear')
    return v && (v === 'auto' || isLumiLang(v)) ? v : 'auto'
  })
  const setSpeakLang = (l: SpeakLang) => { setSpeakLangRaw(l); try { localStorage.setItem('lumi:hear', l) } catch { /* ignore */ } }
  const [openId, setOpenId] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const listen = useLumiListen(mode, speakLang, { needMic: L('needMic'), hearFail: L('hearFail'), netFail: L('netFail'), noInstant: L('noInstant') })
  const { running, level, speaking, busy, hearing, err, warn, live, setLive, draft, gist, conversations, heardLang, instantOn, stop } = listen
  const start = () => { setSaveMsg(null); void listen.start() }

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

        <div className="lumi-hear">
          <span className="small muted">{L('hearLang')}</span>
          <div className="lumi-tabs" role="radiogroup" aria-label={L('hearLang')}>
            <button className={speakLang === 'auto' ? 'on' : ''} onClick={() => setSpeakLang('auto')}>{L('auto')}</button>
            {LUMI_LANGS.map((l) => (
              <button key={l.code} className={speakLang === l.code ? 'on' : ''} onClick={() => setSpeakLang(l.code)}>{l.name}</button>
            ))}
          </div>
          <span className="small muted">{L('hearHelp')}</span>
        </div>

        {!running ? (
          <button className="btn primary volt-flash-btn" onClick={start}>{L('start')}</button>
        ) : (
          <button className="btn volt-flash-btn" onClick={stop}>{L('stop')}</button>
        )}
        {err && <p className="small lumi-err" role="alert">⚠ {err}</p>}
        {warn && <p className="small muted">{warn}</p>}

        {running && (
          <div className="lumi-listen">
            <span className={`lumi-dot${speaking ? ' talk' : ''}`} />
            <span className="small">{L('listening')} · {speakLang === 'auto' ? heardLang : speakLang}</span>
            <span className="lumi-meter"><i style={{ width: `${Math.round(level * 100)}%` }} /></span>
            <span className={`lumi-chip lumi-speed${instantOn ? ' on' : ''}`}>{instantOn ? L('instant') : L('slow')}</span>
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
          {gist && (
            <div className="lumi-gist">
              <p><b>{L('topic')}:</b> {gist.topicVi}</p>
              {mode === 'talk' && gist.replies.length > 0 && (<>
                <p className="small muted">{L('replies')}</p>
                <div className="lumi-replies">
                  {gist.replies.map((rp, i) => (
                    <button key={i} className="lumi-chip" onClick={() => speak(rp.text, speechTagFor(heardLang) ?? 'en-US')}>
                      🔊 {rp.text}<small>{rp.vi}</small>
                    </button>
                  ))}
                </div>
              </>)}
            </div>
          )}
          {!live.length && !draft && <p className="small muted">{L('liveWait')}</p>}
          {draft && (
            <div className="lumi-cap lumi-draft">
              <p className="lumi-cap-vi">{draft.vi || <span className="muted">{L('draftLbl')}</span>}</p>
              <p className="small muted">{draft.text}</p>
            </div>
          )}
          {live.map((l) => (
            <div key={l.id} className="lumi-cap">
              <p className="lumi-cap-vi">
                {l.vi || <span className="muted">{l.pending ? L('hearingNow') : L('noVi')}</span>}
                {l.ms != null && l.vi && <span className={`lumi-ms${l.ms < 2500 ? ' fast' : ''}`}>{l.src === 'instant' ? '⚡' : ''}{(l.ms / 1000).toFixed(1)}s</span>}
              </p>
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
