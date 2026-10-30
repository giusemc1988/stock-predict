import { useEffect, useRef, useState } from 'react'
import type { AiRules } from '../lib/aiRules'
import { useLang } from '../lib/i18n'
import type { JournalEntry } from '../lib/journal'
import type { PracticeState } from '../lib/practice'
import { SKILLS, statusOf, useSkillStatuses } from '../lib/skills'
import { canListen, listenOnce } from '../lib/listen'
import { chatReply, listenProblem, loadChat, saveChat, MAX_CHAT, type ChatTurn } from '../lib/jarvisChat'
import { describeAction, logAction, type JarvisAction } from '../lib/jarvisActions'
import { canSpeak, loadVoicePrefs, primeSpeech, speak, speakProblem, stopSpeaking } from '../lib/speech'
import type { Bi } from '../lib/jarvis'
import { JarvisAvatar } from './JarvisAvatar'
import { askCloud, cloudHasKey, factsForAi } from '../lib/cloudBrain'
import { asksLive, irisLiveFacts } from '../lib/irisLive'
import { detectLanguage } from '../lib/jarvisChat'
import { HUB_AGENT, agentName, agentProject, hubFactsForAi, introduce, type AppPage, type HubFacts } from '../lib/agents'
import type { HubPage } from '../lib/toolHub'
import { fetchRuns, requestRun } from '../lib/hubRuns'
import { fetchTasks, requestTask } from '../lib/hubTasks'

interface Props {
  state: PracticeState
  rules: AiRules
  journal: JournalEntry[]
  learn: { oldTests: number; newBars: number; cycles?: number; latest?: Bi | null } | null
  killSwitch: boolean
  priceOf: (symbol: string) => number
  known: { symbol: string; name: string }[]
  watchlist: string[]
  onAskStock?: (symbol: string) => void
  onShowTrade?: (id: string) => void
  onReplay?: () => void
  onAction?: (a: JarvisAction) => void
  /** The stock on the chart, for "it" and "this stock". */
  symbol?: string
  /** The page on screen: its project's agent answers there (Neo on the Hub). */
  page?: AppPage
  /** The hub's state, so any agent can say how a project is doing. */
  hub?: HubFacts
  /** Open a project's page, or 'home' for the Hub. */
  onOpen?: (to: HubPage | 'brief' | 'home') => void
}

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'

const stamp = () => Date.now()

/** The floating brain: talk or type to Neo from any screen, with the conversation written out. */
export function JarvisFab({ state, rules, journal, learn, killSwitch, priceOf, known, watchlist, onAskStock, onShowTrade, onReplay, onAction, symbol, page, hub, onOpen }: Props) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const pick = (b: Bi) => (lang === 'vi' ? b.vi : b.en)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [words, setWords] = useState('')
  const [typed, setTyped] = useState('')
  const [chat, setChat] = useState<ChatTurn[]>(loadChat)
  const statuses = useSkillStatuses()
  const stopListen = useRef<(() => void) | null>(null)
  // only the newest answer may update the speaking state
  const speechRun = useRef(0)
  const speechPoll = useRef<ReturnType<typeof setInterval> | null>(null)
  const clearPoll = () => {
    if (speechPoll.current) clearInterval(speechPoll.current)
    speechPoll.current = null
  }
  const listRef = useRef<HTMLDivElement>(null)
  const talk = rules.jarvisFabTalk && canSpeak()
  // the project agents: this page's agent answers, and it knows the whole hub
  const agents = rules.hubAgents && !!page && !!hub
  const who = agents && page ? agentName(page) : HUB_AGENT
  const here = agents && page ? agentProject(page) : null
  // Atlas pages keep the trading hints; the Hub and the other projects introduce their agent
  const hello = agents && page && here?.id !== 'atlas' ? introduce(page) : null
  // say why the voice failed once, not after every answer
  const soundWarned = useRef(false)

  useEffect(() => saveChat(chat), [chat])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat, words, open])
  useEffect(
    () => () => {
      speechRun.current++
      clearPoll()
      stopListen.current?.()
      stopSpeaking('fab')
    },
    [],
  )

  const add = (...turns: ChatTurn[]) => setChat((c) => [...c, ...turns].slice(-MAX_CHAT))
  const say = (lines: Bi[]) => {
    if (!talk) return setPhase('idle')
    const run = ++speechRun.current
    clearPoll()
    setPhase('speaking')
    void speak(lines.map(pick).join(' '), loadVoicePrefs(), lang, [], 'fab').then((r) => {
      if (run !== speechRun.current) return
      const problem = speakProblem(r, lang)
      if (!problem) soundWarned.current = false
      else if (!soundWarned.current) {
        soundWarned.current = true
        add({ who: 'jarvis', text: { en: problem, vi: problem }, time: stamp() })
      }
      // the result only says sound started; check back until it stops
      speechPoll.current = setInterval(() => {
        if (!speechSynthesis.speaking) {
          clearPoll()
          setPhase((p) => (p === 'speaking' ? 'idle' : p))
        }
      }, 400)
    })
  }

  const respond = (text: string) => {
    const t = text.trim()
    if (!t) return
    setPhase('thinking')
    const skills = SKILLS.map((k) => ({ en: k.en.name, vi: k.vi.name, on: statusOf(k.id, statuses) === 'approved' }))
    const learnInfo = learn ? { cycles: learn.cycles ?? 0, oldTests: learn.oldTests, newBars: learn.newBars, latest: learn.latest ?? null } : null
    let name = 'Chanh'
    try {
      name = JSON.parse(localStorage.getItem('arc.jarvisName.v1') ?? '"Chanh"') || 'Chanh'
    } catch {
      /* keep the default */
    }
    // Detect the language user typed (override browser language)
    const userLang = detectLanguage(t)
    const ctx = { state, rules, journal, killSwitch, priceOf, skills, learn: learnInfo, symbol }
    const r = chatReply(t, {
      ctx,
      name,
      known,
      watchlist,
      canAct: rules.jarvisActions && !!onAction,
      canStock: rules.jarvisAnyStock && !!onAskStock,
      canReplay: rules.jarvisReplay && !!onReplay,
      canShow: rules.jarvisShowMe && !!onShowTrade,
      hub: agents && page && hub ? { page, facts: hub } : undefined,
      canRun: rules.hubRuns && rules.jarvisActions && !!onAction,
      canTask: rules.hubTasks && rules.jarvisActions && !!onAction,
    })
    const now = stamp()
    const answer: Bi = { en: r.text.map((x) => x.en).join(' '), vi: r.text.map((x) => x.vi).join(' ') }
    // not understood: our own data came first; now ask the free-AI helper, with those facts
    // on the Iris page, flights and earthquakes are answered from the live feeds
    const live = page === 'godseye' && asksLive(t)
    if ((r.unsure || live) && rules.jarvisCloudAi) {
      add({ who: 'me', text: { en: t, vi: t }, time: now })
      void (live ? irisLiveFacts(t) : Promise.resolve([] as string[]))
        .then((liveFacts) => askCloud(t, userLang, [...(agents && page && hub ? hubFactsForAi(page, hub) : []), ...liveFacts, ...factsForAi(ctx)], live ? 25000 : 15000))
        .then((ai) => {
        if (ai) {
          const said: Bi = { en: ai.text, vi: ai.text }
          add({ who: 'jarvis', text: said, time: stamp(), by: ai?.by })
          say([said])
        } else {
          // no answer: only say "add a key" when the server really has none
          void cloudHasKey().then((has) => {
            const vi = 'Để em hiểu được toàn bộ câu hỏi của bạn, cần thêm API key. Vào Settings > Free AI keys và chọn một (Gemini, Groq hoặc Grok - đều miễn phí).'
            const en = 'To fully understand your question, I need an API key. Go to Settings > Free AI keys and pick one (Gemini, Groq, or Grok - all free).'
            const busyVi = 'Key AI đã được lưu nhưng các AI miễn phí chưa trả lời (có thể đang bận hoặc hết hạn mức). Anh thử lại sau ít phút, hoặc bấm Test ở Settings > Free AI keys để xem lỗi.'
            const busyEn = 'Your AI keys are saved, but the free AI helpers did not answer (busy or over their limit). Try again in a few minutes, or press Test in Settings > Free AI keys to see the error.'
            const msg: Bi = has ? { en: busyEn, vi: busyVi } : { en, vi }
            const said: Bi = userLang === 'vi' ? { en: msg.vi, vi: msg.vi } : msg
            add({ who: 'jarvis', text: said, time: stamp() })
            say([said])
          })
        }
      })
      return
    }
    add({ who: 'me', text: { en: t, vi: t }, time: now }, { who: 'jarvis', text: answer, time: now + 1, action: r.action })
    if (r.open) onOpen?.(r.open)
    if (r.runs || r.tasks) {
      void (r.tasks ? fetchTasks() : fetchRuns()).then((lines) => {
        const said: Bi = { en: lines.map((x) => x.en).join(' '), vi: lines.map((x) => x.vi).join(' ') }
        add({ who: 'jarvis', text: said, time: stamp() })
        say([said])
      })
      return setPhase('idle')
    }
    // the chart tours read their own steps aloud, so only speak the plain answers
    if (r.stock || r.trade || r.replay) {
      setPhase('idle')
      setOpen(false)
      if (r.stock) onAskStock?.(r.stock)
      else if (r.trade) onShowTrade?.(r.trade)
      else onReplay?.()
      return
    }
    say(r.text)
  }

  // a proposal from before actions were switched off can be cancelled, not done
  const canAct = rules.jarvisActions && !!onAction
  const settle = (i: number, done: boolean) => {
    const turn = chat[i]
    if (!turn?.action || turn.settled || (done && !canAct)) return
    const a = turn.action
    // runs and code tasks go to the server; the answer comes back into the chat
    const remote = a.kind === 'run' || a.kind === 'task'
    if (done && !remote) onAction?.(a)
    logAction({ time: stamp(), label: describeAction(a), result: done ? 'done' : 'cancelled' })
    if (done && (a.kind === 'run' || a.kind === 'task')) {
      setChat((c) => c.map((x, j) => (j === i ? { ...x, settled: 'done' as const } : x)))
      void (a.kind === 'run' ? requestRun(a.id) : requestTask(a.text, `${who} (${page ?? 'home'} page)`)).then((said) => {
        add({ who: 'jarvis', text: said, time: stamp() })
        say([said])
      })
      return
    }
    const reply: Bi = done ? { en: 'Done. It’s in my action log in the Brain tab.', vi: 'Xong. Đã ghi vào nhật ký hành động trong tab Bộ não.' } : { en: 'Okay, I left it as it is.', vi: 'Được, tôi giữ nguyên.' }
    setChat((c) => [...c.map((x, j) => (j === i ? { ...x, settled: done ? ('done' as const) : ('cancelled' as const) } : x)), { who: 'jarvis' as const, text: reply, time: stamp() }].slice(-MAX_CHAT))
    say([reply])
  }

  const mic = () => {
    if (phase === 'listening') return stopListen.current?.()
    stopSpeaking()
    // this tap lets the phone speak the answer later
    if (talk) primeSpeech()
    setWords('')
    setPhase('listening')
    stopListen.current = listenOnce(
      lang,
      (text) => {
        setWords('')
        respond(text)
      },
      (err) => {
        setWords('')
        setPhase((p) => (p === 'listening' ? 'idle' : p))
        const problem = err ? listenProblem(err) : null
        if (problem) add({ who: 'jarvis', text: problem, time: stamp() })
      },
      setWords,
    )
  }

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (talk) primeSpeech()
    respond(typed)
    setTyped('')
  }

  const status =
    phase === 'listening'
      ? L('Listening… speak now', 'Đang nghe… hãy nói')
      : phase === 'thinking'
        ? L('Thinking…', 'Đang nghĩ…')
        : phase === 'speaking'
          ? L('Speaking…', 'Đang nói…')
          : canListen()
            ? L('Tap the mic and ask me anything', 'Bấm micro và hỏi tôi bất cứ điều gì')
            : L('Type a question below', 'Gõ câu hỏi bên dưới')
  const mood = killSwitch ? 'warning' : phase === 'thinking' || phase === 'listening' ? 'thinking' : phase === 'speaking' ? 'speaking' : 'idle'
  const when = (ms: number) => new Date(ms).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      {open && (
        <div className={`jfab-panel${rules.jarvisMotion ? ' anim' : ''}`} role="dialog" aria-label={L(`Talk to ${who}`, `Nói chuyện với ${who}`)}>
          <div className="jfab-head">
            <JarvisAvatar size={36} mood={mood} motion={rules.jarvisMotion} />
            <div className="jfab-title">
              <b>
                {who}
                {here && <small className="jfab-agent"> · {pick(here.what)}</small>}
              </b>
              <span className={`jfab-status ${phase}`}>{status}</span>
            </div>
            {chat.length > 0 && (
              <button className="jfab-x" onClick={() => setChat([])} title={L('Clear the conversation', 'Xóa cuộc trò chuyện')}>
                {L('Clear', 'Xóa')}
              </button>
            )}
            <button className="jfab-x" onClick={() => (setOpen(false), stopListen.current?.(), stopSpeaking('fab'))} aria-label={L('Close', 'Đóng')}>
              ✕
            </button>
          </div>
          <div className="jfab-list" ref={listRef}>
            {!chat.length && !words && hello && <p className="jfab-empty">{pick(hello)}</p>}
            {!chat.length && !words && page === 'godseye' && (
              <div className="jfab-ideas">
                {[L('Weather here now?', 'Thời tiết chỗ anh bây giờ?'), L('Any storms or floods?', 'Có bão hay lũ nào không?'), L('Any earthquakes today?', 'Hôm nay có động đất nào không?'), L('How many flights are in the air?', 'Bây giờ có bao nhiêu máy bay đang bay?')].map((q) => (
                  <button key={q} type="button" className="pr-rescan" disabled={phase === 'thinking'} onClick={() => respond(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {!chat.length && !words && !hello && (
              <p className="jfab-empty">
                {L('Ask me about a stock ("why TSLA?"), your risk, what I learned, or say "pause practice". I answer from the app\'s own records; nothing here is real money.', 'Hỏi tôi về một mã ("vì sao TSLA?"), rủi ro, điều tôi học được, hoặc nói "tạm dừng luyện tập". Tôi trả lời từ dữ liệu của ứng dụng; không có tiền thật ở đây.')}
              </p>
            )}
            {chat.map((m, i) => (
              <div key={m.time + '-' + i} className={`jfab-msg ${m.who}`}>
                <p>{pick(m.text)}</p>
                {m.action && !m.settled && (
                  <div className="brain-confirm-btns">
                    {canAct && (
                      <button className="al-save" onClick={() => settle(i, true)}>
                        {L('Do it', 'Làm đi')}
                      </button>
                    )}
                    <button className="pr-rescan" onClick={() => settle(i, false)}>
                      {L('Cancel', 'Hủy')}
                    </button>
                  </div>
                )}
                {m.settled && <em>{m.settled === 'done' ? L('Done', 'Đã làm') : L('Cancelled', 'Đã hủy')}</em>}
                <time>
                  {when(m.time)}
                  {m.by ? ` · ${L('answered with', 'trả lời bằng')} ${m.by}` : ''}
                </time>
              </div>
            ))}
            {words && (
              <div className="jfab-msg me live">
                <p>{words}</p>
              </div>
            )}
          </div>
          {phase === 'thinking' && (
            <div className="jfab-bar" role="progressbar" aria-label={L('Thinking', 'Đang nghĩ')}>
              <i />
            </div>
          )}
          <form className="jfab-input" onSubmit={send}>
            {canListen() && (
              <button type="button" className={`jfab-mic${phase === 'listening' ? ' on' : ''}`} onClick={mic} aria-label={phase === 'listening' ? L('Stop listening', 'Dừng nghe') : L(`Talk to ${who}`, `Nói với ${who}`)}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                  <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={L(`Type to ${who}…`, `Gõ cho ${who}…`)} />
            <button type="submit" className="al-save" disabled={!typed.trim()}>
              {L('Send', 'Gửi')}
            </button>
            {phase === 'speaking' && (
              <button type="button" className="pr-rescan" onClick={() => (stopSpeaking(), setPhase('idle'))}>
                ■
              </button>
            )}
          </form>
        </div>
      )}
      <button className={`jfab${open ? ' open' : ''}${phase !== 'idle' ? ' busy' : ''}${rules.jarvisMotion ? '' : ' still'}`} onClick={() => setOpen((o) => !o)} aria-label={open ? L(`Hide ${who}`, `Ẩn ${who}`) : L(`Talk to ${who}`, `Nói chuyện với ${who}`)}>
        <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
          <path className="jfab-brain" d="M18 9a6 6 0 0 0-6 6 6 6 0 0 0-4 10 6 6 0 0 0 4 9 6 6 0 0 0 10 4V12a5 5 0 0 0-4-3M30 9a6 6 0 0 1 6 6 6 6 0 0 1 4 10 6 6 0 0 1-4 9 6 6 0 0 1-10 4V12a5 5 0 0 1 4-3" />
          <path className="jfab-synapse" d="M14 20h5M29 20h5M15 29h4M29 29h4M24 16v22" />
        </svg>
      </button>
    </>
  )
}
