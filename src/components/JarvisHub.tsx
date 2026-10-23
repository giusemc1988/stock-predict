import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { agentVotes, type Vote } from '../lib/hub'
import { fmtPct, tone } from '../lib/format'
import { toolsOf, type ProjectId, type ProjectState } from '../lib/projects'
import { useHubTheme } from '../lib/themes'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { ActivityFeed } from './ActivityFeed'
import { AgentFace } from './AgentFace'
import { NeoFace } from './NeoFace'
import { useAiRules } from '../lib/aiRules'
import { AtlasCouncil, type CouncilVote } from './AtlasCouncil'
import { CountUp } from './CountUp'
import { LangSwitch } from './HubPanels'
import { KronosChart } from './KronosChart'
import type { CouncilId, KronosForecast } from '../lib/kronosView'
import { ProjectLogo } from './ProjectLogo'
import { useHubModel, type CardModel, type HubProps } from './useHubModel'
import './JarvisHub.css'

/** Labels only this look uses; the shared ones live in useHubModel (TX). */
const GX = {
  tagline: { en: 'Control centre for all your projects', vi: 'Trung tâm điều khiển mọi dự án của anh' },
  projectsReady: { en: '{n} of {t} projects ready', vi: '{n}/{t} dự án sẵn sàng' },
  buyCallsNow: { en: '{n} BUY calls passed the rules', vi: '{n} lệnh MUA qua được quy tắc' },
  noBuyNow: { en: 'No BUY call passes the rules yet', vi: 'Chưa có lệnh MUA nào qua quy tắc' },
  pcOn: { en: 'Home PC is online', vi: 'Máy nhà đang bật' },
  pcOff: { en: 'Home PC is offline', vi: 'Máy nhà đang tắt' },
  pcConnected: { en: 'Home PC connected', vi: 'Máy nhà đang kết nối' },
  pcNot: { en: 'Home PC offline', vi: 'Máy nhà đang tắt' },
  hubCentre: { en: 'Project centre', vi: 'Trung tâm dự án' },
  crew: { en: 'Projects', vi: 'Dự án' },
  peek: { en: 'See what {p} is doing', vi: 'Xem {p} đang làm gì' },
  back: { en: 'Back', vi: 'Quay lại' },
  working: { en: 'Working now', vi: 'Đang làm' },
  autoFlip: { en: 'Flip cards', vi: 'Tự lật thẻ' },
  hubTop: { en: 'Back to top', vi: 'Lên đầu trang' },
  openAtlas: { en: 'Open Atlas', vi: 'Mở Atlas' },
  openPortfolio: { en: 'Open portfolio', vi: 'Mở danh mục' },
  rhythm: { en: 'Work rhythm', vi: 'Nhịp làm việc' },
  today: { en: 'Now', vi: 'Hiện tại' },
  busy: { en: 'projects ready', vi: 'dự án sẵn sàng' },
  kronos: { en: 'Kronos 5-day forecast', vi: 'Kronos dự báo 5 phiên' },
  watchOnly: { en: 'Watch only, never traded', vi: 'Chỉ theo dõi, không vào lệnh' },
  kronosGraded: { en: '{n} graded, a verdict needs 20', vi: 'Đã chấm {n}, cần 20 để kết luận' },
  kronosNone: { en: 'No Kronos forecast yet. It runs after each US close.', vi: 'Chưa có dự báo Kronos. Nó chạy sau mỗi phiên Mỹ đóng cửa.' },
  council: { en: 'Agents on {s}', vi: 'Các agent xét {s}' },
  scanner: { en: 'Scanner', vi: 'Máy quét' },
  flow: { en: 'Order flow', vi: 'Dòng lệnh' },
  news: { en: 'News', vi: 'Tin tức' },
  signals: { en: 'Analyst', vi: 'Phân tích' },
  learner: { en: 'Learner', vi: 'Bộ học' },
  risk: { en: 'Risk gate', vi: 'Cổng rủi ro' },
  councilTitle: { en: 'Atlas council', vi: 'Hội đồng Atlas' },
  councilOn: { en: '7 agents on {s}', vi: '7 agent đang xét {s}' },
  councilNone: { en: 'No BUY call to judge yet', vi: 'Chưa có lệnh MUA để xét' },
  peekCouncil: { en: 'See the 7-agent council', vi: 'Xem hội đồng 7 agent' },
  verdict: { en: 'Council verdict', vi: 'Kết luận của hội đồng' },
  verdictBuy: { en: 'BUY, {n}/7 agree', vi: 'Mua, {n}/7 đồng ý' },
  verdictWait: { en: '{n}/7 say buy, waiting', vi: '{n}/7 nói mua, chờ thêm' },
  verdictVeto: { en: 'Risk gate says no', vi: 'Cổng rủi ro chặn' },
  voteYes: { en: 'Buy', vi: 'Mua' },
  voteNo: { en: 'No', vi: 'Không' },
  voteNone: { en: 'Wait', vi: 'Chờ' },
  kronosYes: { en: 'Kronos sees {p} in 5 days', vi: 'Kronos thấy {p} sau 5 phiên' },
  kronosNo: { en: 'Kronos sees {p} in 5 days', vi: 'Kronos thấy {p} sau 5 phiên' },
  kronosFlat: { en: 'Kronos sees {p}, about flat', vi: 'Kronos thấy {p}, gần như đi ngang' },
  kronosOff: { en: 'Kronos has no forecast for this symbol', vi: 'Kronos chưa dự báo mã này' },
  tapSymbol: { en: 'Tap a symbol to draw its forecast', vi: 'Bấm một mã để vẽ đường dự báo' },
} as const
type GxKey = keyof typeof GX

/** The hub's own agent (Chanh renamed Jarvis to Neo, 2026-10-23); its character id stays 'jarvis'. */
const HUB_NAME = 'Neo'

/** Each project's colour in this look: mid-tone, so it reads on every theme. */
const HUE: Record<ProjectId | 'jarvis', string> = {
  jarvis: '#f0c36a',
  atlas: '#e7ad63',
  argus: '#a9bce0',
  echo: '#7fc9b8',
  volt: '#bcd57e',
  nexus: '#97aee6',
  nova: '#d6a4ea',
  viraltech: '#ef93b2',
  lumi: '#f1b688',
  forge: '#dcc47e',
}

/** What the back of each card animates. */
const DEMO: Record<ProjectId, 'chart' | 'globe' | 'wave' | 'radar' | 'log'> = {
  atlas: 'chart',
  argus: 'globe',
  echo: 'wave',
  volt: 'log',
  nexus: 'radar',
  nova: 'wave',
  viraltech: 'chart',
  lumi: 'log',
  forge: 'log',
}
const CMD: Partial<Record<ProjectId, string>> = { volt: 'esptool write_flash', lumi: 'media-lab --plan', forge: 'npm test && npm run build' }

interface Kronos {
  forecasts: (KronosForecast & { run?: string })[]
  /** the last 30 closes per symbol, saved by each run */
  recent?: Record<string, number[]>
  updated: string
  score: Record<string, { graded: number }>
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Ring({ v, label }: { v: number | null; label: string }) {
  const r = 17
  const c = 2 * Math.PI * r
  return (
    <svg className="hg-ring" width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r={r} className="hg-ring-bg" />
      {v != null && <circle cx="21" cy="21" r={r} className="hg-ring-fg" strokeDasharray={`${Math.max(0.03, Math.min(1, v)) * c} ${c}`} transform="rotate(-90 21 21)" />}
      <text x="21" y="21" dy="0.36em" textAnchor="middle">
        {label}
      </text>
    </svg>
  )
}

function Demo({ id }: { id: ProjectId }) {
  const kind = DEMO[id]
  if (kind === 'chart')
    return (
      <svg className="hg-spark" viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden="true">
        <path className="hg-spark-area" d="M0 70 L20 64 L40 68 L60 50 L80 56 L100 40 L120 44 L140 30 L160 34 L180 18 L200 22 L200 90 L0 90 Z" />
        <path className="hg-spark-line" d="M0 70 L20 64 L40 68 L60 50 L80 56 L100 40 L120 44 L140 30 L160 34 L180 18 L200 22" />
      </svg>
    )
  if (kind === 'globe')
    return (
      <div className="hg-globe" aria-hidden="true">
        <i />
        <i />
        <i />
        <em />
      </div>
    )
  if (kind === 'wave')
    return (
      <div className="hg-wave" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
    )
  if (kind === 'radar')
    return (
      <div className="hg-radar" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    )
  return (
    <div className="hg-term" aria-hidden="true">
      <p>
        <b>$</b> {CMD[id]} <span className="hg-caret" />
      </p>
      <div className="hg-prog">
        <i />
      </div>
    </div>
  )
}

/** Marks cards and the tag rail with data-off while they are off screen, so their CSS loops pause (JarvisHub.css). */
function useOffscreenPause(root: RefObject<HTMLElement | null>, count: number) {
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.removeAttribute('data-off')
          else e.target.setAttribute('data-off', '')
        }
      },
      { rootMargin: '120px 0px' },
    )
    el.querySelectorAll('.hg-card, .hg-tags, .hg-hero').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [root, count])
}

/**
 * The main page in the liquid glass look: a macOS-style menu bar, Neo (the hub agent) with a speech bubble, the
 * projects hanging on a rail, one glass card per project (its agent, what it is thinking, its numbers
 * and tools; the back shows it at work), Atlas with real Kronos forecasts and agent votes, live
 * activity and a dock. Three themes (Settings or the menu bar). Every number comes from the app's data.
 */
export function JarvisHub(p: HubProps & { flipAuto: boolean; council: boolean }) {
  const m = useHubModel(p)
  const { vi, L, cards, stats, activity, q, setQ, inputRef, hits, canOpen, openTool, toolOk, openHit, hitOk, hello, homeUp, working } = m
  const G = (k: GxKey, vars?: Record<string, string | number>): string => Object.entries(vars ?? {}).reduce<string>((s, [a, b]) => s.replace(`{${a}}`, String(b)), GX[k][m.lang])
  const theme = useHubTheme()
  const rules = useAiRules()
  const [flipPref, setFlipPref] = useLocalStorage('arc.hubFlip.v1', true)
  const flipping = p.flipAuto && flipPref
  const rootRef = useRef<HTMLElement>(null)
  useOffscreenPause(rootRef, cards.length)

  // one shared beat: thoughts, Jarvis's bubble and the agent votes move on together
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reduceMotion()) return
    const id = setInterval(() => setTick((t) => t + 1), 3200)
    return () => clearInterval(id)
  }, [])

  // a random card turns over now and then to show its agent at work; never the one under the pointer
  const [flipped, setFlipped] = useState<ProjectId | null>(null)
  const [hover, setHover] = useState<ProjectId | null>(null)
  useEffect(() => {
    if (!flipping || reduceMotion()) return
    let back: ReturnType<typeof setTimeout> | undefined
    const id = setInterval(() => {
      const pool = cards.map((c) => c.p.id).filter((x) => x !== 'atlas' && x !== hover)
      const pick = pool[Math.floor(Math.random() * pool.length)]
      // a card anh turned over himself (Atlas) stays turned until he turns it back
      setFlipped((f) => (f === 'atlas' ? f : pick))
      clearTimeout(back)
      back = setTimeout(() => setFlipped((f) => (f === pick ? null : f)), 4200)
    }, 6000)
    return () => {
      clearInterval(id)
      clearTimeout(back)
    }
    // cards changes every render; the pool only needs the ids, which never change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipping, hover])

  // the menu bar clock
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Kronos shadow test: logged and graded by GitHub Actions, never traded
  const [kronos, setKronos] = useState<Kronos | null>(null)
  useEffect(() => {
    const ac = new AbortController()
    fetch('/kronos-shadow.json', { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Kronos | null) => setKronos(j?.forecasts ? j : null))
      .catch(() => {})
    return () => ac.abort()
  }, [])
  const kBars = useMemo(
    () =>
      (kronos?.forecasts ?? [])
        .filter((f) => f.pred['5'] && f.lastClose)
        .reduce<KronosForecast[]>((acc, f) => [...acc.filter((x) => x.symbol !== f.symbol), f], [])
        .map((f) => ({ symbol: f.symbol.replace('-USD', ''), pct: (f.pred['5'] / f.lastClose - 1) * 100, f }))
        .slice(0, 8),
    [kronos],
  )
  const kMax = Math.max(2, ...kBars.map((b) => Math.abs(b.pct)))
  const [kSel, setKSel] = useState<string | null>(null)
  const kPick = kBars.find((b) => b.symbol === kSel)
  const cLabel = (id: CouncilId) => (id === 'kronos' ? 'Kronos' : G(id))
  const graded = kronos?.score['5']?.graded ?? 0

  // the agents' votes on Atlas's top BUY call
  const top = p.picks[0]
  const votes = top
    ? agentVotes(top, {
        flow: { symbol: '', buyShare: null },
        headlines: [],
        learner: p.learn.score,
        risk: { killSwitch: p.killSwitch, dayPL: 0, lossLimit: 0, lossLimitOn: false },
      })
    : []
  const voteAt = votes.length ? tick % votes.length : -1

  // the council on the back of the Atlas card: the six agents' real votes plus Kronos on the same symbol
  const kTop = top ? kBars.find((b) => b.symbol === top.symbol.split('/')[0].toUpperCase()) : undefined
  const councilVotes: CouncilVote[] = [
    ...votes.map((v) => ({ id: v.id as CouncilId, vote: v.vote as Vote, why: vi ? v.why.vi : v.why.en })),
    kTop
      ? { id: 'kronos', vote: kTop.pct > 0.5 ? 'yes' : kTop.pct < -0.5 ? 'no' : 'none', why: G(kTop.pct > 0.5 ? 'kronosYes' : kTop.pct < -0.5 ? 'kronosNo' : 'kronosFlat', { p: fmtPct(kTop.pct) }) }
      : { id: 'kronos', vote: 'none', why: G('kronosOff') },
  ]
  const yes = councilVotes.filter((v) => v.vote === 'yes').length
  const veto = councilVotes.find((v) => v.id === 'risk')?.vote === 'no'
  const verdict = !top ? G('councilNone') : veto ? G('verdictVeto') : yes >= 5 ? G('verdictBuy', { n: yes }) : G('verdictWait', { n: yes })
  const voteText = (v: Vote) => G(v === 'yes' ? 'voteYes' : v === 'no' ? 'voteNo' : 'voteNone')

  const think = (c: CardModel, i: number) => {
    const lines = [vi ? c.p.what.vi : c.p.what.en, ...c.facts.map((f) => `${L(f.label)}: ${f.value}`), `${L(c.ring.cap)}: ${c.ring.label}`]
    return lines[(tick + i) % lines.length]
  }
  const say = [`${hello}.`, G('projectsReady', { n: working, t: cards.length }), p.picks.length ? G('buyCallsNow', { n: p.picks.length }) : G('noBuyNow'), homeUp == null ? '' : homeUp ? G('pcOn') : G('pcOff')].filter(Boolean)
  const beat = `a${tick % 2}`

  const stateLabel = (s: ProjectState) => L(s)
  const clock = now.toLocaleTimeString(vi ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  const day = now.toLocaleDateString(vi ? 'vi-VN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'numeric' })

  return (
    <main ref={rootRef} className="jh hg" id="hub-top" data-theme={theme}>
      <div className="hg-wall" aria-hidden="true">
        <i className="hg-b1" />
        <i className="hg-b2" />
        <i className="hg-b3" />
      </div>
      <div className="hg-wrap">
        <header className="hg-menubar hg-glass">
          <div className="hg-mb-l">
            <span className="hg-lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <b>{HUB_NAME}</b>
            <span className="hg-hide-s">{G('hubCentre')}</span>
          </div>
          <div className="hg-mb-r">
            <span className={`hg-pc ${homeUp ? 'on' : ''}`}>
              <i />
              {homeUp ? G('pcConnected') : G('pcNot')}
            </span>
            <span className="hg-hide-s">{day}</span>
            <span>{clock}</span>
            <LangSwitch />
            <button className="hg-icon" onClick={p.onSettings} aria-label={L('settings')} title={L('settings')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              </svg>
            </button>
          </div>
        </header>

        <section className="hg-hero">
          <div className="hg-hero-l">
            <div className="hg-jbot" style={{ '--k': HUE.jarvis } as CSSProperties}>
              {rules.neoFace ? <NeoFace motion={rules.jarvisMotion} className="hg-neo" /> : <AgentFace id="jarvis" hue={HUE.jarvis} />}
            </div>
            <div className="hg-hero-t">
              <h1 className="hg-brand">{HUB_NAME}</h1>
              <p className="hg-tag">{G('tagline')}</p>
              <p className="hg-say hg-glass" aria-live="polite" style={{ '--k': HUE.jarvis } as CSSProperties}>
                <span className="hg-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className={`hg-tt ${beat}`}>{say[tick % say.length]}</span>
              </p>
            </div>
          </div>
          <div className="hg-search">
            <label className="hg-bar hg-glass">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={q}
                placeholder={L('search')}
                aria-label={L('searchLabel')}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hits[0]) openHit(hits[0])
                  if (e.key === 'Escape') setQ('')
                }}
              />
              <kbd>/</kbd>
            </label>
            {q.trim() && (
              <ul className="hg-hits hg-glass" role="listbox" aria-label={L('searchLabel')}>
                {hits.length === 0 && <li className="hg-nohit">{L('noHit')}</li>}
                {hits.map((h) => (
                  <li key={`${h.project.id}-${h.tool?.id ?? ''}`}>
                    <button className="hg-hit" style={{ '--k': HUE[h.project.id] } as CSSProperties} disabled={!hitOk(h)} onClick={() => openHit(h)}>
                      <i />
                      <span>
                        <b>{h.tool ? (vi ? h.tool.label.vi : h.tool.label.en) : h.project.name}</b>
                        <em>{h.tool ? `${vi ? h.tool.note.vi : h.tool.note.en}, ${L('inProject', { p: h.project.name })}` : vi ? h.project.what.vi : h.project.what.en}</em>
                      </span>
                      <small>{hitOk(h) ? L('open') : L('soon')}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="hg-stats" aria-label={L('running')}>
          {stats.map((s) => {
            const body = (
              <>
                <b className={s.tone ?? ''}>{s.key === 'acct' && typeof s.value === 'string' ? <CountUp text={s.value} /> : s.value}</b>
                <span>
                  {s.label}
                  {s.chip && <em className={s.chip.tone}>{s.chip.text}</em>}
                </span>
              </>
            )
            return s.onClick ? (
              <button key={s.key} className="hg-stat hg-glass" onClick={s.onClick}>
                {body}
              </button>
            ) : (
              <div key={s.key} className="hg-stat hg-glass">
                {body}
              </div>
            )
          })}
        </section>

        <section className="hg-crew" aria-label={G('crew')}>
          <div className="hg-rail" aria-hidden="true" />
          <div className="hg-tags">
            {cards.map((c) => (
              <button key={c.p.id} className="hg-hang" style={{ '--k': HUE[c.p.id] } as CSSProperties} disabled={!canOpen(c.p)} onClick={() => canOpen(c.p) && p.onOpen(c.p.opens!)} aria-label={`${L('open')} ${vi ? c.p.what.vi : c.p.what.en}`}>
                <span className="hg-rope" aria-hidden="true" />
                <span className="hg-tagc hg-glass">
                  <span className="hg-hole" aria-hidden="true" />
                  <ProjectLogo id={c.p.id} hue={HUE[c.p.id]} className="hg-tlogo" />
                  <b>{vi ? c.p.what.vi : c.p.what.en}</b>
                  <span className={`hg-st s-${c.state}`}>
                    <i />
                    {stateLabel(c.state)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="hg-grid" aria-label={vi ? 'Agent' : 'Agents'}>
          {cards.map((c, i) => {
            const id = c.p.id
            const feat = id === 'atlas'
            const on = flipped === id
            const openable = canOpen(c.p)
            const tools = toolsOf(c.p).filter(toolOk).slice(0, feat ? 4 : 3)
            const what = vi ? c.p.what.vi : c.p.what.en
            return (
              <article
                key={id}
                className={`hg-card s-${c.state}${feat ? ' hg-feat' : ''}${on ? ' on' : ''}`}
                style={{ '--k': HUE[id] } as CSSProperties}
                onMouseEnter={() => setHover(id)}
                onMouseLeave={() => setHover((h) => (h === id ? null : h))}
              >
                <div className="hg-flip">
                  <div className="hg-face hg-front hg-glass" aria-hidden={on}>
                    <button className="hg-hit-area" disabled={!openable || on} tabIndex={on ? -1 : 0} onClick={() => openable && p.onOpen(c.p.opens!)} aria-label={`${L('open')} ${c.p.name}`} />
                    <i className="hg-orb" aria-hidden="true" />
                    {(!feat || p.council) && (
                      <button className="hg-peek" tabIndex={on ? -1 : 0} onClick={() => setFlipped(id)} aria-label={feat ? G('peekCouncil') : G('peek', { p: c.p.name })} title={feat ? G('peekCouncil') : G('peek', { p: c.p.name })}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
                          <path d="M18 3v4h-4M6 21v-4h4" />
                        </svg>
                      </button>
                    )}
                    <div className="hg-top">
                      <AgentFace id={id} hue={HUE[id]} className="hg-face-av" />
                      <div className="hg-id">
                        <span className={`hg-pill s-${c.state}`}>
                          <i />
                          {stateLabel(c.state)}
                        </span>
                        <h2>{c.p.name}</h2>
                        <p>{what}</p>
                      </div>
                      {feat && (
                        <p className="hg-think hg-inset">
                          <span className="hg-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                          <span className={`hg-tt ${beat}`}>{think(c, i)}</span>
                        </p>
                      )}
                    </div>
                    {!feat && (
                      <p className="hg-think hg-inset">
                        <span className="hg-dots" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className={`hg-tt ${beat}`}>{think(c, i)}</span>
                      </p>
                    )}
                    {feat && (
                      <>
                        <div className={`hg-kron hg-inset${p.council ? ' live' : ''}`}>
                          <div className="hg-khead">
                            <b>{G('kronos')}</b>
                            <span>{p.council && kBars.length && !kPick ? G('tapSymbol') : G('watchOnly')}</span>
                          </div>
                          {kPick && p.council ? (
                            <KronosChart key={kPick.symbol} f={kPick.f} recent={kronos?.recent?.[kPick.f.symbol]} vi={vi} label={cLabel} onAll={() => setKSel(null)} />
                          ) : kBars.length ? (
                            <>
                              <div className="hg-kbars" role={p.council ? 'group' : 'img'} aria-label={kBars.map((b) => `${b.symbol} ${fmtPct(b.pct)}`).join(', ')}>
                                {kBars.map((b, j) => {
                                  const inner = (
                                    <>
                                      <span className="hg-kv">
                                        <i className={b.pct >= 0 ? 'up' : 'down'} style={{ '--h': `${(Math.abs(b.pct) / kMax) * 100}%` } as CSSProperties} />
                                      </span>
                                      <b>{b.symbol}</b>
                                      <em className={tone(b.pct)}>{fmtPct(b.pct)}</em>
                                    </>
                                  )
                                  const st = { '--d': `${j * 80}ms` } as CSSProperties
                                  return p.council ? (
                                    <button key={b.symbol} className="hg-kb" style={st} tabIndex={on ? -1 : 0} onClick={() => setKSel(b.symbol)} aria-label={`${b.symbol} ${fmtPct(b.pct)}`}>
                                      {inner}
                                    </button>
                                  ) : (
                                    <div key={b.symbol} className="hg-kb" style={st}>
                                      {inner}
                                    </div>
                                  )
                                })}
                              </div>
                              <p className="hg-kfoot">{G('kronosGraded', { n: graded })}</p>
                            </>
                          ) : (
                            <p className="hg-kfoot">{G('kronosNone')}</p>
                          )}
                        </div>
                        {top ? (
                          <div className="hg-council" aria-label={G('council', { s: top.symbol })}>
                            <span className="hg-council-h">{G('council', { s: top.symbol })}</span>
                            {votes.map((v, j) => (
                              <span key={v.id} className={`hg-vote v-${v.vote as Vote}${j === voteAt ? ' act' : ''}`} title={vi ? v.why.vi : v.why.en}>
                                <i />
                                {G(v.id as GxKey)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="hg-note">{L('noPicks')}</p>
                        )}
                        {p.picks.length > 0 && (
                          <div className="hg-picks">
                            {p.picks.slice(0, 3).map((b) => (
                              <div key={b.symbol} className="hg-pick hg-inset">
                                <b>{b.symbol}</b>
                                <span className={tone(b.gainPct ?? 0)}>{b.gainPct != null ? fmtPct(b.gainPct) : ''}</span>
                                <span>{b.tradeScore != null ? `TS ${Math.round(b.tradeScore)}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div className="hg-foot">
                      <Ring v={c.ring.v} label={c.ring.label} />
                      {c.facts.slice(0, feat ? 3 : 2).map((f) => (
                        <div key={f.label} className="hg-mini">
                          <b className={f.tone ?? ''}>{f.label === 'accountShort' ? <CountUp text={f.value} /> : f.value}</b>
                          {L(f.label)}
                        </div>
                      ))}
                      {feat && <small className="hg-paper">{L('paperOnly')}</small>}
                    </div>
                    {tools.length > 0 && (
                      <div className="hg-chips">
                        {tools.map((t) => (
                          <button key={t.id} tabIndex={on ? -1 : 0} onClick={() => openTool(t)}>
                            {vi ? t.label.vi : t.label.en}
                            {t.action.kind === 'url' && <span aria-hidden="true"> ↗</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {feat && p.council && (
                    <div className="hg-face hg-back hg-glass hg-cback" aria-hidden={!on}>
                      <div className="hg-bhead">
                        <b>{G('councilTitle')}</b>
                        <span>{top ? G('councilOn', { s: top.symbol }) : G('councilNone')}</span>
                      </div>
                      <AtlasCouncil votes={councilVotes} active={on} label={cLabel} voteText={voteText} />
                      <div className="hg-verdict hg-inset">
                        <span>{G('verdict')}</span>
                        <b>{verdict}</b>
                        <button className="hg-backbtn" tabIndex={on ? 0 : -1} onClick={() => setFlipped(null)}>
                          {G('back')}
                        </button>
                      </div>
                    </div>
                  )}
                  {!feat && (
                    <div className="hg-face hg-back hg-glass" aria-hidden={!on}>
                      <div className="hg-bhead">
                        <b>{c.p.name}</b>
                        <span>{G('working')}</span>
                      </div>
                      <div className="hg-demo">
                        <Demo id={id} />
                      </div>
                      <ul className="hg-feed">
                        {c.facts.map((f) => (
                          <li key={f.label}>
                            <b>{f.value}</b>
                            {L(f.label)}
                          </li>
                        ))}
                      </ul>
                      <button className="hg-backbtn" tabIndex={on ? 0 : -1} onClick={() => setFlipped(null)}>
                        {G('back')}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>

        <section className="hg-lower">
          <div className="hg-panel hg-glass">
            <div className="hg-phead">
              <b>{L('activity')}</b>
              <span>{L('activitySrc')}</span>
            </div>
            <ActivityFeed items={activity} empty={L('activityEmpty')} />
          </div>
          <div className="hg-panel hg-glass">
            <div className="hg-phead">
              <b>{G('rhythm')}</b>
              <span>{G('today')}</span>
            </div>
            <svg className="hg-gauge" viewBox="0 0 180 150" role="img" aria-label={G('projectsReady', { n: working, t: cards.length })}>
              <defs>
                <linearGradient id="hg-gg" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#7fc9b8" />
                  <stop offset=".5" stopColor="#e7ad63" />
                  <stop offset="1" stopColor="#ef93b2" />
                </linearGradient>
              </defs>
              <circle className="hg-g-trk" cx="90" cy="90" r="70" strokeDasharray="329.9 439.8" transform="rotate(135 90 90)" />
              <circle className="hg-g-val" cx="90" cy="90" r="70" strokeDasharray={`${(329.9 * working) / Math.max(1, cards.length)} 439.8`} transform="rotate(135 90 90)" />
              <text className="hg-g-num" x="90" y="98" textAnchor="middle">
                {working}/{cards.length}
              </text>
              <text className="hg-g-lb" x="90" y="118" textAnchor="middle">
                {G('busy')}
              </text>
            </svg>
            <div className="hg-glegend">
              {(['live', 'ready', 'home', 'soon'] as ProjectState[]).map((s) => {
                const n = cards.filter((c) => c.state === s).length
                return n ? (
                  <span key={s}>
                    <b>{n}</b>
                    {stateLabel(s)}
                  </span>
                ) : null
              })}
            </div>
          </div>
        </section>

        <nav className="hg-dock hg-glass" aria-label="Dock">
          <button className="hg-dk" onClick={() => document.getElementById('hub-top')?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={G('hubTop')} title={G('hubTop')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
            </svg>
          </button>
          <button className="hg-dk" onClick={() => p.onOpen('brief')} aria-label={G('openAtlas')} title={G('openAtlas')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 18 9 12l4 3 7-9" />
              <path d="M15 6h5v5" />
            </svg>
          </button>
          <button className="hg-dk" onClick={() => p.onOpen('portfolio')} aria-label={G('openPortfolio')} title={G('openPortfolio')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M16 12h2M3 10h18" />
            </svg>
          </button>
          <button className="hg-dk" onClick={p.onSettings} aria-label={L('settings')} title={L('settings')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            </svg>
          </button>
          {p.flipAuto && (
            <>
              <span className="hg-sep" aria-hidden="true" />
              <button className={`hg-auto${flipPref ? ' yes' : ''}`} onClick={() => setFlipPref(!flipPref)} aria-pressed={flipPref}>
                <span className="hg-sw" aria-hidden="true" />
                {G('autoFlip')}
              </button>
            </>
          )}
        </nav>
      </div>
    </main>
  )
}
