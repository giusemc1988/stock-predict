import { useEffect, useMemo, useRef, useState } from 'react'
import { canListen, listenOnce, understand } from '../lib/listen'
import { explain } from '../lib/brainRouter'
import { listenProblem } from '../lib/jarvisChat'
import { askCloud, factsForAi, useCloudStatus } from '../lib/cloudBrain'
import { alreadySo, describeAction, loadActionLog, logAction, parseCommand, type ActionLogEntry, type JarvisAction } from '../lib/jarvisActions'
import { SKILLS, statusOf, useSkillStatuses } from '../lib/skills'
import type { AiRules } from '../lib/aiRules'
import { useLang } from '../lib/i18n'
import type { JournalEntry } from '../lib/journal'
import type { PracticeState } from '../lib/practice'
import { minBrokeFor, PLAYBOOK, ruleEvidence, STATUS_LABEL } from '../lib/playbook'
import { ask, ASK_QUESTIONS, briefing, evidenceLine, evidenceOpts, experience, greeting, QUICK_ASK, stockMemory, tradeLessons, type AskId, type Bi } from '../lib/jarvis'
import { JarvisAvatar } from './JarvisAvatar'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { canSpeak, DEFAULT_VOICE, isNatural, pickVoice, sortVoices, speak, speakProblem, stopSpeaking, useVoices, voiceGender, type VoicePrefs } from '../lib/speech'
import { getAiRules, setAiRules } from '../lib/aiRules'

interface Props {
  state: PracticeState
  rules: AiRules
  journal: JournalEntry[]
  learn: { oldTests: number; newBars: number; journal: JournalEntry[]; cycles?: number; latest?: Bi | null } | null
  killSwitch: boolean
  priceOf: (symbol: string) => number
  onEditRules: () => void
  /** Show me: walk through a practice trade on the chart. */
  onShowTrade?: (id: string) => void
  /** Replay the day's practice trades on the chart. */
  onReplay?: () => void
  /** Markets Jarvis can recognise by ticker or name in a question. */
  known?: { symbol: string; name: string }[]
  /** "Why AAPL?": open that stock and explain it on the chart. */
  onAskStock?: (symbol: string) => void
  /** Carry out an action you confirmed. */
  onAction?: (a: JarvisAction) => void
  /** Your watchlist symbols, so Jarvis doesn't propose adding one twice. */
  watchlist?: string[]
  /** The stock on the chart, for "it" and "this stock". */
  symbol?: string
}

type Tab = 'today' | 'lessons' | 'playbook'

/** Jarvis, the Arc Brain: briefing, Ask Jarvis, lessons and the playbook with its evidence. */
export function BrainPanel({ state, rules, journal, learn, killSwitch, priceOf, onEditRules, onShowTrade, onReplay, known = [], onAskStock, onAction, watchlist = [], symbol }: Props) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const pick = (b: { en: string; vi: string }) => (lang === 'vi' ? b.vi : b.en)
  const [tab, setTab] = useState<Tab>('today')
  const [q, setQ] = useState<AskId | null>(null)
  const ev = useMemo(() => ruleEvidence(state.trades, evidenceOpts(rules)), [state.trades, rules])
  const xp = experience(state, ev, learn)
  const brief = rules.jarvisBriefing ? briefing(state, rules, journal, killSwitch) : []
  const lessons = rules.jarvisLessons ? tradeLessons(state) : []
  const statuses = useSkillStatuses()
  const skills = SKILLS.map((k) => ({ en: k.en.name, vi: k.vi.name, on: statusOf(k.id, statuses) === 'approved' }))
  const learnInfo = learn ? { cycles: learn.cycles ?? 0, oldTests: learn.oldTests, newBars: learn.newBars, latest: learn.latest ?? null } : null
  const ctx = { state, rules, journal, killSwitch, priceOf, skills, learn: learnInfo, symbol }
  const answer = q && rules.jarvisAsk ? ask(q, ctx) : null
  const mood = killSwitch ? 'warning' : q ? 'speaking' : 'idle'
  const [voice, setVoice] = useLocalStorage<VoicePrefs>('arc.jarvisVoice.v1', DEFAULT_VOICE)
  const voices = sortVoices(useVoices())
  const speech = rules.jarvisSpeech && canSpeak()
  const cloud = useCloudStatus(rules.jarvisCloudAi)
  // when speaking fails, say why in the voice card instead of staying silent
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null)
  const say = (lines: { en: string; vi: string }[]) => {
    setVoiceMsg(null)
    void speak(lines.map(pick).join(' '), voice, lang, voices, 'brain').then((r) => setVoiceMsg(speakProblem(r, lang)))
  }
  const testLine = { en: "Hello, I'm Jarvis. This is how I sound.", vi: 'Xin chào, tôi là Jarvis. Đây là giọng của tôi.' }
  // the Brain tab owns what it starts reading: stop when it closes or the voice is switched off
  useEffect(() => {
    if (!speech) stopSpeaking('brain')
  }, [speech])
  useEffect(() => () => stopSpeaking('brain'), [])
  const lastTrade = [...state.open, ...state.trades].sort((a, b) => b.openedAt - a.openedAt)[0]
  // a chip toggles its answer; a typed question always shows it
  const askAndSay = (id: AskId, typed = false) => {
    const next = q === id && !typed ? null : id
    setQ(next)
    setFree(null)
    // "why did you buy" opens the stock and walks through the trade on the chart (the tour speaks each step)
    if (next === 'whyBuy' && onShowTrade && lastTrade) return onShowTrade(lastTrade.id)
    if (!speech) return
    if (next) say(ask(next, ctx))
    else stopSpeaking()
  }
  // greeting: your name, the time of day and a one-line summary; read aloud once a day when Jarvis speaks
  const [name, setName] = useLocalStorage('arc.jarvisName.v1', 'Chanh')
  const [editName, setEditName] = useState(false)
  const hello = rules.jarvisGreeting ? greeting(name, state, killSwitch) : null
  useEffect(() => {
    if (!hello || !speech) return
    const today = new Date().toDateString()
    try {
      if (localStorage.getItem('arc.jarvisGreeted.v1') === today) return
      localStorage.setItem('arc.jarvisGreeted.v1', today)
    } catch {
      return
    }
    say([hello])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!hello, speech])
  // ask anything: typed or spoken, understood as a stock, one of Jarvis's questions, or "replay"
  const [typed, setTyped] = useState('')
  const [free, setFree] = useState<{ text: string; symbol?: string } | null>(null)
  const linked: AskId[] = ['who', 'skills', 'log', 'reviews', 'learning']
  // actions: Jarvis proposes, you confirm; both outcomes are logged
  const [pending, setPending] = useState<JarvisAction | null>(null)
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>(loadActionLog)
  const settle = (done: boolean) => {
    if (!pending) return
    if (done) onAction?.(pending)
    setActionLog(logAction({ time: Date.now(), label: describeAction(pending), result: done ? 'done' : 'cancelled' }))
    setFree({ text: done ? L('Done. It’s in my action log below.', 'Xong. Đã ghi vào nhật ký hành động bên dưới.') : L('Okay, I left it as it is.', 'Được, tôi giữ nguyên.') })
    setPending(null)
  }
  const handle = (text: string) => {
    setFree(null)
    setPending(null)
    const cmd = rules.jarvisActions && onAction ? parseCommand(text, known) : null
    if (cmd) {
      setQ(null)
      const d = describeAction(cmd)
      if (alreadySo(cmd, rules, killSwitch, watchlist)) {
        setFree({ text: L(`No need: "${d.en}" is already the case.`, `Không cần: "${d.vi}" đã như vậy rồi.`) })
        return true
      }
      setPending(cmd)
      if (speech) say([{ en: `I can ${d.en.charAt(0).toLowerCase()}${d.en.slice(1)}. Tap Do it to confirm.`, vi: `Tôi có thể: ${d.vi}. Bấm Làm đi để xác nhận.` }])
      return true
    }
    const u = understand(text, known)
    if (u?.kind === 'stock' && rules.jarvisAnyStock) {
      setQ(null)
      const facts = [...stockMemory(u.symbol, state), onAskStock ? { en: `Opening ${u.symbol} now; I'll walk you through it on the chart.`, vi: `Đang mở ${u.symbol}; tôi sẽ giải thích trên biểu đồ.` } : { en: 'Turn on Show me in AI rules and I can walk you through the chart.', vi: 'Bật Chỉ cho tôi trong Quy tắc AI để tôi giải thích trên biểu đồ.' }]
      void explain({ text, lang, facts }).then((r) => {
        setFree({ text: r.text, symbol: u.symbol })
        if (speech && !onAskStock) say(facts)
      })
      onAskStock?.(u.symbol)
      return true
    }
    if (u?.kind === 'replay' && onReplay) return onReplay(), true
    if (u?.kind === 'ask' && (rules.jarvisLinks || !linked.includes(u.id))) return askAndSay(u.id, true), true
    // not understood: our own data came first; the free-AI helper answers with those facts
    if (rules.jarvisCloudAi) {
      setQ(null)
      setFree({ text: L('Thinking…', 'Đang nghĩ…') })
      void askCloud(text, lang, factsForAi(ctx)).then((ai) => {
        if (!ai) return fallback()
        setFree({ text: `${ai.text} (${L('answered with', 'trả lời bằng')} ${ai.by})` })
        if (speech) say([{ en: ai.text, vi: ai.text }])
      })
      return true
    }
    return fallback()
  }
  const fallback = () => {
    if (symbol) {
      const lines = [{ en: `I'm not sure I understood, so here's what I know about ${symbol}, the stock on screen.`, vi: `Tôi chưa chắc đã hiểu, nên đây là điều tôi biết về ${symbol}, mã đang xem.` }, ...ask('thisStock', ctx)]
      setQ(null)
      setFree({ text: lines.map(pick).join(' ') })
      if (speech) say(lines)
      return true
    }
    setFree({ text: L("I didn't catch that. Try a stock (\"why AAPL?\"), \"what's my risk\", \"what skills do you use\" or \"replay today\".", 'Tôi chưa hiểu. Thử hỏi một mã ("vì sao AAPL?"), "rủi ro", "kỹ năng" hoặc "xem lại hôm nay".') })
    return false
  }
  // ask by voice: one sentence, understood the same way as typing
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const stopListen = useRef<(() => void) | null>(null)
  useEffect(() => () => stopListen.current?.(), [])
  const mic = () => {
    if (listening) return stopListen.current?.()
    setHeard('')
    setListening(true)
    stopListen.current = listenOnce(
      lang,
      (text) => {
        setHeard(text)
        handle(text)
      },
      (err) => {
        setListening(false)
        const problem = err ? listenProblem(err) : null
        if (problem) setHeard(pick(problem))
      },
      setHeard,
    )
  }
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const tabs: [Tab, string, string][] = [
    ['today', 'Today', 'Hôm nay'],
    ...(rules.jarvisLessons ? ([['lessons', 'Lessons', 'Bài học']] as [Tab, string, string][]) : []),
    ['playbook', 'Playbook', 'Sổ tay'],
  ]
  const shown: Tab = tabs.some(([id]) => id === tab) ? tab : 'today'

  return (
    <div className="autolearn brain">
      <div className="brain-head">
        <JarvisAvatar size={48} mood={mood} motion={rules.jarvisMotion} />
        <div>
          <h3>Jarvis</h3>
          <p className="muted al-note">{L("The Arc Brain · your practice trading mentor", 'Bộ não Arc · người hướng dẫn luyện tập giao dịch')}</p>
        </div>
      </div>
      <p className="al-brain muted">
        {L(
          'I learn from every paper trade and check each one against rules experienced traders use. I count experience in practice trades, not years, and I call a rule proven only when our own paper trades back it up. Nothing here has beaten buying and holding yet. Paper only, not financial advice.',
          'Tôi học từ mỗi lệnh thử và kiểm tra từng lệnh theo các quy tắc của trader kinh nghiệm. Tôi tính kinh nghiệm bằng số lệnh luyện tập, không phải số năm, và chỉ gọi một quy tắc là đã chứng minh khi chính lệnh thử của chúng ta xác nhận. Chưa có gì ở đây thắng được mua và giữ. Chỉ thử nghiệm, không phải lời khuyên đầu tư.',
        )}
      </p>

      {hello && (
        <div className={`brain-hello${rules.jarvisMotion ? ' anim' : ''}`}>
          <JarvisAvatar size={56} mood={killSwitch ? 'warning' : 'speaking'} motion={rules.jarvisMotion} />
          <div>
            <p className="brain-hello-text">
              {pick(hello)
                .split(' ')
                .map((w, i) => (
                  <span key={i} style={{ animationDelay: `${Math.min(1400, 250 + i * 40)}ms` }}>
                    {w}{' '}
                  </span>
                ))}
            </p>
            {editName ? (
              <input className="brain-name" autoFocus value={name} maxLength={30} placeholder={L('Your name', 'Tên bạn')} onChange={(e) => setName(e.target.value)} onBlur={() => setEditName(false)} onKeyDown={(e) => e.key === 'Enter' && setEditName(false)} />
            ) : (
              <button className="tour-link" onClick={() => setEditName(true)}>
                {L('Change what I call you', 'Đổi tên tôi gọi bạn')} ›
              </button>
            )}
          </div>
        </div>
      )}

      <div className="al-tiles brain-tiles">
        <div>
          <span>{L('Practice trades', 'Lệnh luyện tập')}</span>
          <b>{xp.practiceTrades}</b>
        </div>
        <div>
          <span>{L('Bars replayed', 'Nến đã chạy lại')}</span>
          <b>{xp.replayed.toLocaleString('en-US')}</b>
        </div>
        <div>
          <span>{L('Rules proven', 'Quy tắc đã chứng minh')}</span>
          <b className={xp.proven ? 'up' : ''}>
            {xp.proven} / {xp.rules}
          </b>
        </div>
        <div>
          <span>{L('Trades reviewed', 'Lệnh đã đánh giá')}</span>
          <b>{xp.reviewed}</b>
        </div>
      </div>

      <div className="al-note muted" style={{ fontSize: '0.9em', padding: '8px 0' }}>
        <strong>Jarvis Phase 1 Status:</strong> Walk-forward validator ready. Router + Learner integration disabled until Phase 2.
      </div>

      <div className="al-tabs" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(([id, en, vi]) => (
          <button key={id} className={shown === id ? 'on' : ''} onClick={() => setTab(id)}>
            {L(en, vi)}
          </button>
        ))}
      </div>

      {shown === 'today' && (
        <>
          {onReplay && (
            <button className="al-save brain-replay" onClick={onReplay}>
              ▶ {L("Replay today's trades with Jarvis", 'Xem lại các lệnh hôm nay cùng Jarvis')}
            </button>
          )}
          {rules.jarvisBriefing && (
            <div className="al-card">
              <div className="al-report-head">
                <div className="al-kicker">{L('MORNING BRIEFING', 'BẢN TIN BUỔI SÁNG')}</div>
                {speech && (
                  <span className="brain-confirm-btns">
                    <button className="pr-rescan" onClick={() => say(brief)}>
                      🔊 {L('Read aloud', 'Đọc to')}
                    </button>
                    <button className="pr-rescan" onClick={() => stopSpeaking()} aria-label={L('Stop reading', 'Dừng đọc')}>
                      ■
                    </button>
                  </span>
                )}
              </div>
              <ul className="brain-list">
                {brief.map((b, i) => (
                  <li key={i}>{pick(b)}</li>
                ))}
              </ul>
            </div>
          )}
          {rules.jarvisAsk && (
            <div className="al-card">
              <div className="al-report-head">
                <div className="al-kicker">{L('ASK JARVIS', 'HỎI JARVIS')}</div>
                {rules.jarvisListen && canListen() && (
                  <button className={`brain-mic${listening ? ' on' : ''}`} onClick={mic} aria-label={L('Ask by voice', 'Hỏi bằng giọng nói')}>
                    🎙 {listening ? L('Listening…', 'Đang nghe…') : L('Ask by voice', 'Hỏi bằng giọng nói')}
                  </button>
                )}
              </div>
              {heard && <p className="muted al-note">“{heard}”</p>}
              <form
                className="brain-type"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (typed.trim() && handle(typed.trim())) setTyped('')
                }}
              >
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={rules.jarvisAnyStock ? L('Ask me anything, like "why AAPL?"', 'Hỏi gì cũng được, ví dụ "vì sao AAPL?"') : L('Ask me a question', 'Hỏi tôi một câu')} aria-label={L('Ask Jarvis', 'Hỏi Jarvis')} />
                <button type="submit" className="pr-rescan">
                  {L('Ask', 'Hỏi')}
                </button>
              </form>
              {pending && (
                <div className="brain-confirm" role="alertdialog" aria-label={L('Confirm Jarvis action', 'Xác nhận hành động của Jarvis')}>
                  <JarvisAvatar size={24} mood="thinking" motion={rules.jarvisMotion} />
                  <div>
                    <p>
                      {L("Here's what I'd do:", 'Tôi sẽ làm:')} <b>{pick(describeAction(pending))}</b>. {L('Want me to go ahead?', 'Bạn muốn tôi làm không?')}
                    </p>
                    <div className="brain-confirm-btns">
                      <button className="al-save" onClick={() => settle(true)}>
                        {L('Do it', 'Làm đi')}
                      </button>
                      <button className="pr-rescan" onClick={() => settle(false)}>
                        {L('Cancel', 'Hủy')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {free && (
                <div className="brain-answer">
                  <JarvisAvatar size={24} mood="speaking" motion={false} />
                  <p>{free.text}</p>
                </div>
              )}
              <div className="brain-ask">
                {QUICK_ASK.map((id) => (
                  <button key={id} className={q === id ? 'on' : ''} onClick={() => askAndSay(id)}>
                    {pick(ASK_QUESTIONS[id])}
                  </button>
                ))}
              </div>
              {answer && q && QUICK_ASK.includes(q) && (
                <div className="brain-answer">
                  <JarvisAvatar size={24} mood="speaking" motion={false} />
                  <div>
                    <p>{answer.map(pick).join(' ')}</p>
                    {q === 'whyBuy' && onShowTrade && lastTrade && (
                      <button className="pr-rescan" onClick={() => onShowTrade(lastTrade.id)}>
                        {L('Show me on the chart', 'Chỉ trên biểu đồ')}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <p className="muted al-note">{L('Answers come from the app’s own records. No AI service or API key is used.', 'Câu trả lời lấy từ dữ liệu của chính ứng dụng. Không dùng dịch vụ AI hay khóa API.')}</p>
            </div>
          )}
          {rules.jarvisAsk && rules.jarvisLinks && (
            <div className="al-card">
              <div className="al-kicker">{L("WHAT I'M LINKED TO", 'TÔI KẾT NỐI VỚI')}</div>
              <p className="muted al-note">{L('Everything I know lives in the app. Tap one and I’ll explain it.', 'Mọi điều tôi biết đều nằm trong ứng dụng. Chạm vào một mục để tôi giải thích.')}</p>
              <div className="brain-links">
                {(
                  [
                    ['who', '◎', L('Who I am', 'Tôi là ai'), L('traits', 'tính cách')],
                    ['learned', '✦', L('Memory', 'Bộ nhớ'), `${state.trades.filter((t) => t.review).length} ${L('lessons', 'bài học')}`],
                    ['skills', '⚙', L('Skills', 'Kỹ năng'), `${skills.filter((k) => k.on).length}/${skills.length} ${L('on', 'bật')}`],
                    ['rules', '☰', L('Playbook', 'Sổ tay'), `${xp.proven}/${xp.rules} ${L('proven', 'đã chứng minh')}`],
                    ['log', '⧗', L('Decision log', 'Nhật ký quyết định'), `${(state.audit ?? []).length} ${L('entries', 'mục')}`],
                    ['reviews', '✓', L('Trade reviews', 'Đánh giá lệnh'), `${xp.reviewed} ${L('graded', 'đã chấm')}`],
                    ['learning', '∞', L('Learner', 'Bộ học'), `${learnInfo?.cycles ?? 0} ${L('cycles', 'vòng')}`],
                  ] as [AskId, string, string, string][]
                ).map(([id, icon, label, count]) => (
                  <button key={id} className={q === id ? 'on' : ''} onClick={() => askAndSay(id)}>
                    <i>{icon}</i>
                    <b>{label}</b>
                    <span>{count}</span>
                  </button>
                ))}
              </div>
              {answer && q && !QUICK_ASK.includes(q) && (
                <div className="brain-answer">
                  <JarvisAvatar size={24} mood="speaking" motion={false} />
                  <p>{answer.map(pick).join(' ')}</p>
                </div>
              )}
            </div>
          )}
          {rules.jarvisActions && onAction && (
            <div className="al-card">
              <div className="al-kicker">{L('MY ACTIONS · YOU CONFIRM EACH ONE', 'HÀNH ĐỘNG CỦA TÔI · BẠN XÁC NHẬN TỪNG VIỆC')}</div>
              <p className="muted al-note">{L('I can read everything in the app. I can only change a few settings, like pausing practice, the kill switch, your watchlist or these AI rules, and only after you tap Do it. I never place trades for you or touch real money. Try: "pause practice", "add PLTR to my watchlist", "turn off trade alerts".', 'Tôi đọc được mọi thứ trong ứng dụng. Tôi chỉ có thể đổi vài cài đặt như tạm dừng luyện tập, dừng khẩn cấp, danh sách theo dõi hay các quy tắc AI này, và chỉ sau khi bạn bấm Làm đi. Tôi không bao giờ đặt lệnh thay bạn hay đụng tới tiền thật. Thử: "tạm dừng luyện tập", "thêm PLTR vào danh sách", "tắt thông báo lệnh".')}</p>
              {actionLog.length ? (
                <ul className="brain-list brain-actlog">
                  {[...actionLog].reverse().slice(0, 8).map((e, i) => (
                    <li key={i} className={e.result}>
                      <em>{when(e.time)}</em> {pick(e.label)} · {e.result === 'done' ? L('done', 'đã làm') : L('cancelled', 'đã hủy')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted al-note">{L('No actions yet.', 'Chưa có hành động nào.')}</p>
              )}
            </div>
          )}
          {!rules.jarvisSpeech && (
            <div className="al-card">
              <div className="al-kicker">{L("JARVIS'S VOICE", 'GIỌNG JARVIS')}</div>
              <p className="muted al-note">{L("My voice is off, so I won't read anything aloud.", 'Giọng của tôi đang tắt nên tôi sẽ không đọc to.')}</p>
              <button
                className="pr-rescan"
                onClick={() => {
                  setAiRules({ ...getAiRules(), jarvisSpeech: true })
                  say([testLine])
                }}
              >
                🔊 {L("Turn on Jarvis's voice", 'Bật giọng Jarvis')}
              </button>
              {voiceMsg && <p className="brain-voice-msg">{voiceMsg}</p>}
            </div>
          )}
          {rules.jarvisCloudAi && (
            <div className="al-card">
              <div className="al-kicker">{L('FREE AI HELPER', 'TRỢ LÝ AI MIỄN PHÍ')}</div>
              <p className="muted al-note">
                {L("I always answer from my own records first. Only when I don't understand you do I ask a free AI, and I give it those records so it answers about your trades, not guesses. It explains; it never trades.", 'Tôi luôn trả lời từ dữ liệu của mình trước. Chỉ khi không hiểu bạn, tôi mới hỏi một AI miễn phí, kèm dữ liệu đó để nó trả lời đúng về lệnh của bạn. Nó chỉ giải thích, không bao giờ giao dịch.')}
              </p>
              {cloud == null ? (
                <p className="muted al-note">{L('Checking the server…', 'Đang kiểm tra máy chủ…')}</p>
              ) : cloud.some((p) => p.on) ? (
                <p className="al-note">✓ {L('Connected', 'Đã kết nối')}: {cloud.filter((p) => p.on).map((p) => p.name).join(', ')}</p>
              ) : (
                <p className="brain-voice-msg">
                  {L('No AI key on the server yet, so I use my own answers only. To add one: get a free Gemini key at aistudio.google.com, then in Cloudflare open Workers & Pages > stock-predict > Settings > Variables and Secrets, and add a Secret named GEMINI_API_KEY. Groq (GROQ_API_KEY), Grok (XAI_API_KEY) and NVIDIA (NVIDIA_API_KEY) work too.', 'Máy chủ chưa có khóa AI nên tôi chỉ dùng câu trả lời của mình. Để thêm: lấy khóa Gemini miễn phí tại aistudio.google.com, rồi trong Cloudflare mở Workers & Pages > stock-predict > Settings > Variables and Secrets, thêm Secret tên GEMINI_API_KEY. Groq (GROQ_API_KEY), Grok (XAI_API_KEY) và NVIDIA (NVIDIA_API_KEY) cũng dùng được.')}
                </p>
              )}
            </div>
          )}
          {rules.jarvisSpeech && (
            <div className="al-card">
              <div className="al-kicker">{L("JARVIS'S VOICE", 'GIỌNG JARVIS')}</div>
              {!canSpeak() ? (
                <p className="muted al-note">{L("This browser can't speak. Try Chrome, Edge or Safari.", 'Trình duyệt này không đọc được. Hãy thử Chrome, Edge hoặc Safari.')}</p>
              ) : (
                <div className="brain-voice">
                  <label>
                    <span>{L('Sound', 'Kiểu giọng')}</span>
                    <select value={voice.gender} onChange={(e) => setVoice({ ...voice, gender: e.target.value as VoicePrefs['gender'], voice: '' })}>
                      <option value="male">{L('Male (Jarvis)', 'Nam (Jarvis)')}</option>
                      <option value="female">{L('Female', 'Nữ')}</option>
                      <option value="any">{L('Any', 'Bất kỳ')}</option>
                    </select>
                  </label>
                  <label>
                    <span>{L('Voice', 'Giọng')}</span>
                    <select value={voice.voice} onChange={(e) => setVoice({ ...voice, voice: e.target.value })}>
                      <option value="">{L('Best match for the sound above', 'Giọng hợp nhất với kiểu trên')}</option>
                      {voices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {isNatural(v) ? '★ ' : ''}
                          {v.name} ({v.lang}
                          {voiceGender(v) ? `, ${voiceGender(v) === 'male' ? L('male', 'nam') : L('female', 'nữ')}` : ''})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>
                      {L('Speed', 'Tốc độ')} {voice.rate.toFixed(1)}x
                    </span>
                    <input type="range" min={0.5} max={2} step={0.1} value={voice.rate} onChange={(e) => setVoice({ ...voice, rate: +e.target.value })} />
                  </label>
                  <label>
                    <span>
                      {L('Pitch', 'Cao độ')} {voice.pitch.toFixed(1)}
                    </span>
                    <input type="range" min={0} max={2} step={0.1} value={voice.pitch} onChange={(e) => setVoice({ ...voice, pitch: +e.target.value })} />
                  </label>
                  <div className="brain-confirm-btns">
                    <button className="pr-rescan" onClick={() => say([testLine])}>
                      ▶ {L('Test voice', 'Nghe thử')}
                    </button>
                    <button className="pr-rescan" onClick={() => stopSpeaking()}>
                      ■ {L('Stop', 'Dừng')}
                    </button>
                  </div>
                  {voiceMsg && <p className="brain-voice-msg">{voiceMsg}</p>}
                  {voices.length > 0 && <p className="muted al-note">{L('Speaking as', 'Đang dùng giọng')}: {pickVoice(voice, lang, voices)?.name ?? '—'}</p>}
                  {!voices.length && <p className="brain-voice-msg">{L("I can't find any voices on this device yet. Wait a few seconds and try again; on Android, install a voice under Settings > Text-to-speech.", 'Chưa tìm thấy giọng nào trên thiết bị. Đợi vài giây rồi thử lại; trên Android, cài giọng trong Cài đặt > Chuyển văn bản thành giọng nói.')}</p>}
                  <p className="muted al-note">{L("Uses your device's built-in voices, free and with no key. ★ marks the natural-sounding ones; male, female and Vietnamese voices depend on what your device has installed. If the voice never changes on an Android phone, Chrome is using the phone's own voice: change it in Settings > Text-to-speech.", 'Dùng giọng có sẵn trên thiết bị, miễn phí và không cần khóa. ★ là giọng tự nhiên; giọng nam, nữ và tiếng Việt tùy vào thiết bị đã cài. Nếu giọng không đổi trên điện thoại Android, Chrome đang dùng giọng của máy: đổi trong Cài đặt > Chuyển văn bản thành giọng nói.')}</p>
                </div>
              )}
            </div>
          )}
          {!rules.jarvisBriefing && !rules.jarvisAsk && <p className="muted">{L('Briefing and Ask Jarvis are off in AI rules.', 'Bản tin và Hỏi Jarvis đang tắt trong Quy tắc AI.')}</p>}
        </>
      )}

      {shown === 'lessons' && (
        <div className="al-card">
          <div className="al-kicker">{L('LESSONS FROM REVIEWED TRADES', 'BÀI HỌC TỪ LỆNH ĐÃ ĐÁNH GIÁ')}</div>
          {lessons.length ? (
            lessons.map((l, i) => (
              <div key={i} className={`brain-lesson ${l.tone}`}>
                <em>{when(l.time)}</em>
                {pick(l)}
                {onShowTrade && (
                  <button className="tour-link" onClick={() => onShowTrade(l.tradeId)}>
                    {L('Show me', 'Chỉ cho tôi')} ›
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="muted">{L('No reviewed trades yet. Lessons appear after practice trades close.', 'Chưa có lệnh nào được đánh giá. Bài học sẽ xuất hiện sau khi lệnh luyện tập đóng.')}</p>
          )}
        </div>
      )}

      {shown === 'playbook' && (
        <div className="al-card">
          <div className="al-kicker">{L('PLAYBOOK · RULES FROM EXPERIENCED TRADERS', 'SỔ TAY · QUY TẮC CỦA TRADER KINH NGHIỆM')}</div>
          <p className="muted al-note">
            {L(
              `A rule is judged after ${rules.minSample} trades that follow it and ${minBrokeFor(rules.minSample)} that break it. Proven means following it won at least ${rules.learnEdgeMarginPct} points more often and made money on average.${rules.jarvisGate ? ' The gate is on: practice skips buys that break a proven rule.' : ''}`,
              `Một quy tắc được đánh giá sau ${rules.minSample} lệnh tuân theo và ${minBrokeFor(rules.minSample)} lệnh vi phạm. Đã chứng minh nghĩa là tuân theo thắng nhiều hơn ít nhất ${rules.learnEdgeMarginPct} điểm và có lãi trung bình.${rules.jarvisGate ? ' Cổng đang bật: luyện tập bỏ qua lệnh mua vi phạm quy tắc đã chứng minh.' : ''}`,
            )}
          </p>
          {PLAYBOOK.map((r) => {
            const e = ev.find((x) => x.id === r.id)!
            return (
              <div key={r.id} className="brain-rule">
                <b>{lang === 'vi' ? r.vi.name : r.en.name}</b>
                <span className={`st ${e.status}`}>{pick(STATUS_LABEL[e.status])}</span>
                <span className="muted">
                  {lang === 'vi' ? r.vi.why : r.en.why} {pick(evidenceLine(e))}
                </span>
              </div>
            )
          })}
          <button className="al-save" onClick={onEditRules}>
            {L('Jarvis settings (AI rules)', 'Cài đặt Jarvis (Quy tắc AI)')}
          </button>
        </div>
      )}
    </div>
  )
}
