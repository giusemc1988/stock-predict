import { useEffect, useMemo, useRef, useState } from 'react'
import { canListen, listenOnce, understand } from '../lib/listen'
import { explain } from '../lib/brainRouter'
import { SKILLS, statusOf, useSkillStatuses } from '../lib/skills'
import type { AiRules } from '../lib/aiRules'
import { useLang } from '../lib/i18n'
import type { JournalEntry } from '../lib/journal'
import type { PracticeState } from '../lib/practice'
import { PLAYBOOK, ruleEvidence, STATUS_LABEL } from '../lib/playbook'
import { ask, ASK_QUESTIONS, briefing, evidenceLine, evidenceOpts, experience, greeting, QUICK_ASK, stockMemory, tradeLessons, type AskId, type Bi } from '../lib/jarvis'
import { JarvisAvatar } from './JarvisAvatar'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { canSpeak, DEFAULT_VOICE, isNatural, sortVoices, speak, stopSpeaking, useVoices, type VoicePrefs } from '../lib/speech'

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
}

type Tab = 'today' | 'lessons' | 'playbook'

/** Jarvis, the Arc Brain: briefing, Ask Jarvis, lessons and the playbook with its evidence. */
export function BrainPanel({ state, rules, journal, learn, killSwitch, priceOf, onEditRules, onShowTrade, onReplay, known = [], onAskStock }: Props) {
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
  const ctx = { state, rules, journal, killSwitch, priceOf, skills, learn: learnInfo }
  const answer = q && rules.jarvisAsk ? ask(q, ctx) : null
  const mood = killSwitch ? 'warning' : q ? 'speaking' : 'idle'
  const [voice, setVoice] = useLocalStorage<VoicePrefs>('arc.jarvisVoice.v1', DEFAULT_VOICE)
  const voices = sortVoices(useVoices())
  const speech = rules.jarvisSpeech && canSpeak()
  const say = (lines: { en: string; vi: string }[]) => speak(lines.map(pick).join(' '), voice, lang, voices)
  const lastTrade = [...state.open, ...state.trades].sort((a, b) => b.openedAt - a.openedAt)[0]
  const askAndSay = (id: AskId) => {
    const next = q === id ? null : id
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
  const handle = (text: string) => {
    const u = understand(text, known)
    setFree(null)
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
    if (u?.kind === 'ask' && (rules.jarvisLinks || !linked.includes(u.id))) return askAndSay(u.id), true
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
        if (err && err !== 'no-speech' && err !== 'aborted') setHeard(L(`Couldn't hear you (${err}).`, `Không nghe được (${err}).`))
      },
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
                  <button className="pr-rescan" onClick={() => say(brief)}>
                    🔊 {L('Read aloud', 'Đọc to')}
                  </button>
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
          {rules.jarvisSpeech && (
            <div className="al-card">
              <div className="al-kicker">{L("JARVIS'S VOICE", 'GIỌNG JARVIS')}</div>
              {!canSpeak() ? (
                <p className="muted al-note">{L("This browser can't speak. Try Chrome, Edge or Safari.", 'Trình duyệt này không đọc được. Hãy thử Chrome, Edge hoặc Safari.')}</p>
              ) : (
                <div className="brain-voice">
                  <label>
                    <span>{L('Voice', 'Giọng')}</span>
                    <select value={voice.voice} onChange={(e) => setVoice({ ...voice, voice: e.target.value })}>
                      <option value="">{L('Most natural voice for the app language', 'Giọng tự nhiên nhất theo ngôn ngữ ứng dụng')}</option>
                      {voices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {isNatural(v) ? '★ ' : ''}
                          {v.name} ({v.lang})
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
                  <button className="pr-rescan" onClick={() => say([{ en: "Hello, I'm Jarvis. This is how I sound.", vi: 'Xin chào, tôi là Jarvis. Đây là giọng của tôi.' }])}>
                    ▶ {L('Test voice', 'Nghe thử')}
                  </button>
                  <p className="muted al-note">{L("Uses your device's built-in voices, free and with no key. ★ marks the natural-sounding ones; male, female and Vietnamese voices depend on what your device has installed.", 'Dùng giọng có sẵn trên thiết bị, miễn phí và không cần khóa. ★ là giọng tự nhiên; giọng nam, nữ và tiếng Việt tùy vào thiết bị đã cài.')}</p>
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
              `A rule is judged after ${rules.minSample} trades that follow it and ${Math.max(5, Math.round(rules.minSample / 3))} that break it. Proven means following it won at least ${rules.learnEdgeMarginPct} points more often and made money on average.${rules.jarvisGate ? ' The gate is on: practice skips buys that break a proven rule.' : ''}`,
              `Một quy tắc được đánh giá sau ${rules.minSample} lệnh tuân theo và ${Math.max(5, Math.round(rules.minSample / 3))} lệnh vi phạm. Đã chứng minh nghĩa là tuân theo thắng nhiều hơn ít nhất ${rules.learnEdgeMarginPct} điểm và có lãi trung bình.${rules.jarvisGate ? ' Cổng đang bật: luyện tập bỏ qua lệnh mua vi phạm quy tắc đã chứng minh.' : ''}`,
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
