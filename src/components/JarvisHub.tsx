import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { LearnState } from '../lib/autoLearn'
import { RELEASES, APP_VERSION } from '../data/releases'
import { fmtPct, fmtUsd, tone } from '../lib/format'
import { useLang } from '../lib/i18n'
import { greeting } from '../lib/jarvis'
import { practiceEquity, PRACTICE_START, type PickRow, type PracticeState } from '../lib/practice'
import { PROJECTS, pageOn, readyCount, searchHub, toolsOf, type Hit, type HubOn, type Project, type ProjectId, type ProjectState } from '../lib/projects'
import { RUVIEW, BOARDS } from '../lib/ruview'
import { postCounts, VIRALTECH } from '../data/viraltech'
import type { HubPage, ToolNode } from '../lib/toolHub'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { ArcLogo } from './ArcLogo'
import { ActivityFeed, type FeedItem } from './ActivityFeed'
import { LangSwitch } from './HubPanels'
import { Sparkline } from './Sparkline'
import { Icon, StatRow, type Stat } from './StatCard'
import { CountUp } from './CountUp'

type Target = HubPage | 'brief'

interface Props {
  practice: PracticeState
  /** BUY calls in the last practice scan, best first */
  picks: PickRow[]
  /** the practice scan is running (in this browser or on the server) */
  scanning: boolean
  learn: LearnState
  killSwitch: boolean
  on: HubOn
  /** Volt flashes boards from Chrome over USB (Settings > AI rules) */
  webFlash: boolean
  onOpen: (t: Target) => void
  /** open Atlas's home page and scroll to a block on it */
  onAtlasBlock: (id: string) => void
  onSettings: () => void
}

const TX = {
  sub: { en: '{n} projects. Tap one to open it.', vi: '{n} dự án. Bấm vào để mở.' },
  search: { en: 'Open a project or tool: wifi, flash, Atlas…', vi: 'Mở dự án hoặc công cụ: wifi, nạp firmware, Atlas…' },
  searchLabel: { en: 'Search projects and tools', vi: 'Tìm dự án và công cụ' },
  noHit: { en: 'Nothing matches. Try a project name like Atlas or Nova.', vi: 'Không có kết quả. Thử tên dự án như Atlas hay Nova.' },
  inProject: { en: 'in {p}', vi: 'trong {p}' },
  project: { en: 'Project', vi: 'Dự án' },
  running: { en: 'Projects ready', vi: 'Dự án sẵn sàng' },
  runningSub: { en: 'open and working now', vi: 'mở được và đang chạy' },
  account: { en: 'Atlas practice account', vi: 'Tài khoản luyện tập Atlas' },
  vsStart: { en: 'vs $10,000 start', vi: 'so với $10,000' },
  buys: { en: 'BUY calls now', vi: 'Lệnh MUA hiện tại' },
  buysSub: { en: 'last Atlas scan', vi: 'lần quét Atlas gần nhất' },
  homePc: { en: 'Home PC', vi: 'Máy nhà' },
  homeSub: { en: 'Echo and Nexus scans need it', vi: 'Echo và Nexus cần để quét' },
  online: { en: 'Online', vi: 'Đang bật' },
  offline: { en: 'Offline', vi: 'Đang tắt' },
  checking: { en: 'Checking', vi: 'Đang kiểm tra' },
  live: { en: 'Live', vi: 'Đang chạy' },
  ready: { en: 'Ready', vi: 'Sẵn sàng' },
  home: { en: 'Needs home PC', vi: 'Cần máy nhà' },
  off: { en: 'Off in Settings', vi: 'Đang tắt' },
  soon: { en: 'Coming soon', vi: 'Sắp có' },
  open: { en: 'Open', vi: 'Mở' },
  activity: { en: 'Across your projects', vi: 'Hoạt động các dự án' },
  activitySrc: { en: 'Atlas trades and every app update', vi: 'Lệnh Atlas và mỗi lần cập nhật app' },
  activityEmpty: { en: 'Nothing yet. Trades and updates show up here as they happen.', vi: 'Chưa có gì. Lệnh và bản cập nhật sẽ hiện ở đây.' },
  settings: { en: 'Settings', vi: 'Cài đặt' },
  topPicks: { en: 'Top BUY calls now', vi: 'Lệnh MUA tốt nhất lúc này' },
  noPicks: { en: 'No BUY call passes the rules yet. Atlas lists them here after the next scan.', vi: 'Chưa có lệnh MUA nào đạt quy tắc. Atlas sẽ hiện ở đây sau lần quét tới.' },
  paperOnly: { en: 'Paper trading only', vi: 'Chỉ giao dịch tiền ảo' },
  // per-project facts
  learnerRight: { en: 'learner right', vi: 'bộ học đúng' },
  partsOk: { en: 'working', vi: 'đang chạy' },
  layersLive: { en: 'layers live', vi: 'lớp dữ liệu' },
  channels: { en: 'channels', vi: 'kênh' },
  openTrades: { en: 'Open trades', vi: 'Lệnh đang giữ' },
  buyCalls: { en: 'BUY calls', vi: 'Lệnh MUA' },
  accountShort: { en: 'Account', vi: 'Tài khoản' },
  layers: { en: 'Layers', vi: 'Lớp' },
  flights: { en: 'Aircraft', vi: 'Máy bay' },
  quakes: { en: 'Quakes', vi: 'Động đất' },
  version: { en: 'Version', vi: 'Phiên bản' },
  homePcShort: { en: 'Home PC', vi: 'Máy nhà' },
  stage: { en: 'Stage', vi: 'Giai đoạn' },
  beta: { en: 'Beta', vi: 'Beta' },
  firmware: { en: 'Firmware', vi: 'Firmware' },
  boards: { en: 'Boards', vi: 'Board' },
  flash: { en: 'USB flash', vi: 'Nạp USB' },
  phoneApp: { en: 'Phone scan', vi: 'Quét bằng ĐT' },
  tools: { en: 'Tools', vi: 'Công cụ' },
  modes: { en: 'Modes', vi: 'Chế độ' },
  langs: { en: 'Languages', vi: 'Ngôn ngữ' },
  export: { en: 'Export', vi: 'Xuất' },
  app: { en: 'App', vi: 'App' },
  updates: { en: 'Updates', vi: 'Bản cập nhật' },
  lastUpdate: { en: 'Last', vi: 'Gần nhất' },
  status: { en: 'Status', vi: 'Trạng thái' },
  ok: { en: 'OK', vi: 'Tốt' },
  down: { en: 'Down', vi: 'Lỗi' },
  on: { en: 'On', vi: 'Bật' },
  offShort: { en: 'Off', vi: 'Tắt' },
  android: { en: 'Android', vi: 'Android' },
  plannedVt: { en: 'Instagram, TikTok, YouTube, Facebook', vi: 'Instagram, TikTok, YouTube, Facebook' },
  channelsConnected: { en: 'channels connected', vi: 'kênh đã kết nối' },
  scheduled: { en: 'Scheduled', vi: 'Lên lịch' },
  published: { en: 'Posted', vi: 'Đã đăng' },
  drafts: { en: 'Drafts', vi: 'Nháp' },
  outside: { en: 'Outside tools', vi: 'Tool ngoài' },
  mediaLab: { en: 'Media Lab', vi: 'Media Lab' },
} as const
type TxKey = keyof typeof TX

/** One line drawing per project for the top of its card (120 x 72, stroke = the project's colour). */
const ART: Record<ProjectId, ReactNode> = {
  atlas: (
    <>
      <path d="M14 58V40M14 36V30M30 58V46M30 42V22M46 58V34M46 30V18M62 58V44M62 40V30" />
      <rect x="10" y="30" width="8" height="10" rx="1.5" />
      <rect x="26" y="22" width="8" height="20" rx="1.5" />
      <rect x="42" y="18" width="8" height="16" rx="1.5" />
      <rect x="58" y="30" width="8" height="14" rx="1.5" />
      <path d="M8 50 30 38l16-10 16 8 22-20 22-6" className="art-accent" />
    </>
  ),
  argus: (
    <>
      <circle cx="40" cy="38" r="24" />
      <path d="M16 38h48M40 14c8 7 11 15 11 24s-3 17-11 24c-8-7-11-15-11-24s3-17 11-24z" />
      <ellipse cx="40" cy="38" rx="44" ry="12" transform="rotate(-18 40 38)" className="art-accent" />
      <circle cx="80" cy="25" r="3" className="art-fill" />
    </>
  ),
  echo: (
    <>
      <path d="M14 60V34l22-16 22 16v26z" />
      <circle cx="36" cy="44" r="3" className="art-fill" />
      <path d="M48 32a16 16 0 0 1 0 24M56 26a26 26 0 0 1 0 36M64 20a36 36 0 0 1 0 48" className="art-accent" />
    </>
  ),
  volt: (
    <>
      <rect x="22" y="20" width="36" height="36" rx="4" />
      <rect x="31" y="29" width="18" height="18" rx="2" className="art-accent" />
      <path d="M30 12v8M40 12v8M50 12v8M30 56v8M40 56v8M50 56v8M14 28h8M14 38h8M14 48h8M58 28h8M58 38h8M58 48h8" />
      <path d="M76 22 70 38h10l-6 16" className="art-accent" />
    </>
  ),
  nexus: (
    <>
      <path d="M10 34a40 40 0 0 1 56 0M20 44a26 26 0 0 1 36 0M30 54a12 12 0 0 1 16 0" />
      <circle cx="38" cy="62" r="2.5" className="art-fill" />
      <path d="M78 26l14 12-8 7V19l8 7-14 12" className="art-accent" />
    </>
  ),
  nova: (
    <>
      <rect x="10" y="18" width="52" height="38" rx="5" />
      <path d="M31 29v16l13-8z" className="art-accent" />
      <path d="M72 22h26a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H82l-6 5v-5h-4a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4z" />
      <path d="M76 31h18" className="art-accent" />
    </>
  ),
  viraltech: (
    <>
      <circle cx="22" cy="38" r="7" />
      <circle cx="58" cy="20" r="7" />
      <circle cx="58" cy="56" r="7" />
      <circle cx="90" cy="38" r="7" className="art-accent" />
      <path d="M28 34l24-10M28 42l24 10M64 22l20 12M64 54l20-12" />
    </>
  ),
  lumi: (
    <>
      <circle cx="38" cy="38" r="24" />
      <path d="M38 14l10 18M62 38H42M50 58l-10-18M26 58l10-18M14 38h20M26 18l10 18" className="art-accent" />
      <rect x="72" y="22" width="30" height="32" rx="4" />
      <path d="M72 46l9-9 8 8 5-5 8 8" />
    </>
  ),
  forge: (
    <>
      <path d="M26 22 10 38l16 16M54 22l16 16-16 16M46 16 34 60" />
      <path d="M80 50h24M84 50l2-14h12l2 14M92 36V24M86 28h12" className="art-accent" />
    </>
  ),
}

interface Fact {
  label: TxKey
  value: string
  tone?: string
}
interface CardModel {
  p: Project
  state: ProjectState
  /** ring: share of the project working now (0..1) and what it measures */
  ring: { v: number | null; label: string; cap: TxKey }
  facts: Fact[]
}

const STATE_ICON = { live: 'radar', ready: 'check', home: 'clock', off: 'x', soon: 'clock' } as const

function Ring({ v, label, hue }: { v: number | null; label: string; hue: string }) {
  const r = 17
  const c = 2 * Math.PI * r
  return (
    <svg className="jh-ring" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} className="jh-ring-bg" />
      {v != null && <circle cx="22" cy="22" r={r} className="jh-ring-fg" stroke={hue} strokeDasharray={`${Math.max(0.02, Math.min(1, v)) * c} ${c}`} transform="rotate(-90 22 22)" />}
      <text x="22" y="22" dy="0.36em" textAnchor="middle">{label}</text>
    </svg>
  )
}

/**
 * The main page: every project Chanh runs, each with its live state, plus a quick search that jumps
 * straight to a project or one of its tools. Every number comes from data the app already has.
 */
export function JarvisHub(p: Props) {
  const lang = useLang()
  const vi = lang === 'vi'
  const L = (k: TxKey, vars?: Record<string, string | number>): string => Object.entries(vars ?? {}).reduce<string>((s, [a, b]) => s.replace(`{${a}}`, String(b)), TX[k][lang])
  const [name] = useLocalStorage('arc.jarvisName.v1', 'Chanh')

  // two cheap live checks: is the home PC agent reachable, and how many globe layers answer
  const [homeUp, setHomeUp] = useState<boolean | null>(null)
  const [geo, setGeo] = useState<{ id: string; state: string }[] | null>(null)
  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/home/health', { signal: ac.signal })
      .then((r) => r.json())
      .then((j: { offline?: boolean; error?: string }) => setHomeUp(!j.offline && !j.error))
      .catch(() => !ac.signal.aborted && setHomeUp(false))
    if (p.on.godseye)
      fetch('/api/godseye/status', { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { layers?: { id: string; state: string }[] } | null) => setGeo(j?.layers ?? []))
        .catch(() => !ac.signal.aborted && setGeo([]))
    return () => ac.abort()
  }, [p.on.godseye])

  const equity = practiceEquity(p.practice)
  const change = (equity / PRACTICE_START - 1) * 100
  const calls = p.learn.score.right + p.learn.score.wrong
  const pcFact = (): Fact => ({ label: 'homePcShort', value: homeUp == null ? '…' : homeUp ? L('on') : L('offShort'), tone: homeUp ? 'up' : homeUp === false ? 'warn' : '' })
  const geoOk = geo?.filter((l) => l.state === 'ok').length ?? null
  const geoOf = (id: string) => {
    const s = geo?.find((l) => l.id === id)?.state
    return geo == null ? '…' : s == null ? '—' : s === 'ok' ? L('ok') : L('down')
  }

  const cards: CardModel[] = PROJECTS.map((pr): CardModel => {
    const on = pageOn(pr.opens, p.on)
    const rc = readyCount(pr, p.on)
    const base = { p: pr }
    switch (pr.id) {
      case 'atlas':
        return {
          ...base,
          state: p.scanning ? 'live' : 'ready',
          ring: { v: calls ? p.learn.score.right / calls : null, label: calls ? `${Math.round((p.learn.score.right / calls) * 100)}%` : '—', cap: 'learnerRight' },
          facts: [
            { label: 'accountShort', value: fmtUsd(equity), tone: tone(change) },
            { label: 'buyCalls', value: String(p.picks.length) },
            { label: 'openTrades', value: String(p.practice.open.length) },
          ],
        }
      case 'argus':
        return {
          ...base,
          state: !on ? 'off' : geoOk ? 'live' : 'ready',
          ring: { v: geo && geo.length ? (geoOk ?? 0) / geo.length : null, label: geo == null ? '…' : geo.length ? `${geoOk}/${geo.length}` : '—', cap: 'layersLive' },
          facts: [
            { label: 'flights', value: geoOf('flights') },
            { label: 'quakes', value: geoOf('quakes') },
            { label: 'layers', value: geo == null ? '…' : geo.length ? String(geo.length) : '—' },
          ],
        }
      case 'echo': {
        const parts = [on, homeUp === true]
        return {
          ...base,
          state: !on ? 'off' : homeUp ? 'live' : 'home',
          ring: { v: parts.filter(Boolean).length / parts.length, label: `${parts.filter(Boolean).length}/${parts.length}`, cap: 'partsOk' },
          facts: [{ label: 'version', value: RUVIEW.release.replace(/-.*$/, '') }, pcFact(), { label: 'stage', value: L('beta') }],
        }
      }
      case 'volt':
        return {
          ...base,
          state: !on ? 'off' : 'ready',
          ring: { v: rc.total ? rc.ready / rc.total : null, label: `${rc.ready}/${rc.total}`, cap: 'partsOk' },
          facts: [
            { label: 'firmware', value: RUVIEW.firmware.replace(/-.*$/, '') },
            { label: 'boards', value: String(BOARDS.filter((b) => b.supported).length) },
            { label: 'flash', value: on && p.webFlash ? 'Chrome' : L('offShort') },
          ],
        }
      case 'nexus': {
        const parts = [on, homeUp === true, true]
        return {
          ...base,
          state: !on ? 'off' : homeUp ? 'ready' : 'home',
          ring: { v: parts.filter(Boolean).length / parts.length, label: `${parts.filter(Boolean).length}/${parts.length}`, cap: 'partsOk' },
          facts: [pcFact(), { label: 'phoneApp', value: L('android') }, { label: 'tools', value: String(rc.total) }],
        }
      }
      case 'nova':
        return {
          ...base,
          state: on ? 'ready' : 'off',
          ring: { v: on ? 1 : 0, label: on ? '1/1' : '0/1', cap: 'partsOk' },
          facts: [
            { label: 'modes', value: '3' },
            { label: 'langs', value: 'EN+VI' },
            { label: 'export', value: 'MP4' },
          ],
        }
      case 'viraltech': {
        const linked = VIRALTECH.channels.filter((ch) => ch.connected).length
        const n = postCounts(VIRALTECH.posts)
        return {
          ...base,
          state: n.scheduled || n.published ? 'live' : 'ready',
          ring: { v: linked / VIRALTECH.channels.length, label: `${linked}/${VIRALTECH.channels.length}`, cap: 'channelsConnected' },
          facts: [
            { label: 'scheduled', value: String(n.scheduled) },
            { label: 'published', value: String(n.published) },
            { label: 'drafts', value: String(n.draft) },
          ],
        }
      }
      case 'lumi':
        return {
          ...base,
          state: 'soon',
          ring: { v: rc.total ? rc.ready / rc.total : null, label: `${rc.ready}/${rc.total}`, cap: 'partsOk' },
          facts: [
            { label: 'mediaLab', value: L('soon') },
            { label: 'outside', value: L('ready') },
          ],
        }
      case 'forge':
        return {
          ...base,
          state: 'ready',
          ring: { v: rc.total ? rc.ready / rc.total : null, label: `${rc.ready}/${rc.total}`, cap: 'partsOk' },
          facts: [
            { label: 'app', value: `v${APP_VERSION}` },
            { label: 'updates', value: String(RELEASES.length) },
            { label: 'lastUpdate', value: RELEASES[0]?.date.slice(5).replace('-', '/') ?? '—' },
          ],
        }
    }
  })

  const working = cards.filter((c) => c.state === 'live' || c.state === 'ready').length
  const stats: Stat[] = [
    { key: 'ready', icon: 'check', label: L('running'), value: `${working}/${cards.length}`, sub: L('runningSub') },
    { key: 'acct', icon: 'wallet', label: L('account'), value: fmtUsd(equity), chip: { text: fmtPct(change), tone: tone(change) }, sub: L('vsStart'), onClick: () => p.onOpen('portfolio') },
    { key: 'buys', icon: 'target', label: L('buys'), value: String(p.picks.length), sub: L('buysSub'), onClick: () => p.onOpen('brief') },
    {
      key: 'pc',
      icon: 'radar',
      label: L('homePc'),
      value: homeUp == null ? L('checking') : homeUp ? L('online') : L('offline'),
      tone: homeUp ? 'up' : '',
      sub: L('homeSub'),
    },
  ]

  // activity across projects: Atlas's newest trades and every app update, newest first
  const activity: FeedItem[] = useMemo(
    () =>
      [
        ...p.practice.events.slice(0, 6).map((e): FeedItem => ({ id: `e${e.id}`, time: e.time, kind: e.kind, text: vi ? e.vi : e.en, sub: `Atlas · ${e.symbol}` })),
        ...RELEASES.slice(0, 6).map((r): FeedItem => ({ id: `r${r.version}`, time: Date.parse(`${r.date}T00:00:00Z`), kind: 'ok', text: (vi ? r.changesVi?.[0] : undefined) ?? r.changes[0], sub: `Max · v${r.version}` })),
      ]
        .sort((a, b) => b.time - a.time)
        .slice(0, 8),
    [p.practice.events, vi],
  )

  // quick search
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => searchHub(q).slice(0, 7), [q])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const canOpen = (pr: Project) => pr.opens != null && pageOn(pr.opens, p.on)
  const openTool = (t: ToolNode) => {
    if (t.action.kind === 'page') p.onOpen(t.action.page)
    else if (t.action.kind === 'url') window.open(t.action.url, '_blank', 'noopener,noreferrer')
    else if (t.action.kind === 'scroll') p.onAtlasBlock(t.action.id)
  }
  const toolOk = (t: ToolNode) => t.action.kind !== 'soon' && (t.action.kind !== 'page' || pageOn(t.action.page, p.on))
  const openHit = (h: Hit) => {
    if (h.tool) {
      if (toolOk(h.tool)) openTool(h.tool)
    } else if (canOpen(h.project)) p.onOpen(h.project.opens!)
  }
  const hitOk = (h: Hit) => (h.tool ? toolOk(h.tool) : canOpen(h.project))

  const hello = (vi ? greeting(name, p.practice, p.killSwitch).vi : greeting(name, p.practice, p.killSwitch).en).split('. ')[0]

  return (
    <main className="jh" id="hub-top">
      <div className="jh-main">
        <header className="jh-head">
          <div className="jh-brand">
            <ArcLogo size={30} />
            <div>
              <h1 className="jh-hello">{hello}.</h1>
              <p className="jh-sub">{L('sub', { n: cards.length })}</p>
            </div>
          </div>
          <div className="jh-head-acts">
            <LangSwitch />
            <button className="icon-btn" onClick={p.onSettings} aria-label={L('settings')} title={L('settings')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="jh-search">
          <label className="jh-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
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
            <ul className="jh-hits" role="listbox" aria-label={L('searchLabel')}>
              {hits.length === 0 && <li className="jh-nohit">{L('noHit')}</li>}
              {hits.map((h) => (
                <li key={`${h.project.id}-${h.tool?.id ?? ''}`}>
                  <button className="jh-hit" style={{ '--k': h.project.hue } as CSSProperties} disabled={!hitOk(h)} onClick={() => openHit(h)}>
                    <i />
                    <span>
                      <b>{h.tool ? (vi ? h.tool.label.vi : h.tool.label.en) : h.project.name}</b>
                      <em>{h.tool ? `${vi ? h.tool.note.vi : h.tool.note.en} · ${L('inProject', { p: h.project.name })}` : `${L('project')} · ${vi ? h.project.what.vi : h.project.what.en}`}</em>
                    </span>
                    <small>{hitOk(h) ? L('open') : L('soon')}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <StatRow items={stats} className="jh-stats" />

        <section className="jh-grid" aria-label={vi ? 'Dự án' : 'Projects'}>
          {cards.map((c) => {
            const openable = canOpen(c.p)
            const tools = toolsOf(c.p).filter(toolOk).slice(0, 3)
            const what = vi ? c.p.what.vi : c.p.what.en
            return (
              <article key={c.p.id} className={`jh-card s-${c.state}${c.p.id === 'atlas' ? ' jh-feat' : ''}`} style={{ '--k': c.p.hue } as CSSProperties}>
                <button className="jh-hit-area" disabled={!openable} onClick={() => openable && p.onOpen(c.p.opens!)} aria-label={`${L('open')} ${c.p.name}`} />
                <div className="jh-art">
                  <span className={`jh-state st-${c.state}`}>
                    <Icon name={STATE_ICON[c.state]} size={11} />
                    {L(c.state)}
                  </span>
                  <svg viewBox="0 0 120 72" className="jh-glyph" aria-hidden="true">
                    {ART[c.p.id]}
                  </svg>
                  {c.p.id === 'atlas' && (
                    <div className="jh-picks">
                      <h3>{L('topPicks')}</h3>
                      {p.picks.length === 0 && <p>{L('noPicks')}</p>}
                      {p.picks.slice(0, 4).map((b) => (
                        <div key={b.symbol} className="jh-pick">
                          <b className="mono">{b.symbol}</b>
                          <span className={`mono ${tone(b.gainPct ?? 0)}`}>{b.gainPct != null ? fmtPct(b.gainPct) : ''}</span>
                          <span className="mono muted">{b.tradeScore != null ? `TS ${Math.round(b.tradeScore)}` : ''}</span>
                        </div>
                      ))}
                      <small>{L('paperOnly')}</small>
                    </div>
                  )}
                  {c.p.id === 'atlas' && p.practice.curve.length > 1 && (
                    <div className="jh-curve">
                      <Sparkline data={[PRACTICE_START, ...p.practice.curve.map((x) => x.equity)]} width={180} height={52} />
                    </div>
                  )}
                </div>
                <div className="jh-body">
                  <div className="jh-title">
                    <h2>{c.p.name}</h2>
                    <p>{what}</p>
                  </div>
                  <div className="jh-gauge" title={L(c.ring.cap)}>
                    <Ring v={c.ring.v} label={c.ring.label} hue={c.p.hue} />
                    <span>{L(c.ring.cap)}</span>
                  </div>
                </div>
                <dl className="jh-facts">
                  {c.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{L(f.label)}</dt>
                      <dd className={`mono ${f.tone ?? ''}`}>{f.label === 'accountShort' ? <CountUp text={f.value} /> : f.value}</dd>
                    </div>
                  ))}
                </dl>
                {c.p.id === 'viraltech' && <p className="jh-note">{L('plannedVt')}</p>}
                {tools.length > 0 && (
                  <div className="jh-tools">
                    {tools.map((t) => (
                      <button key={t.id} onClick={() => openTool(t)}>
                        {vi ? t.label.vi : t.label.en}
                        {t.action.kind === 'url' && <span aria-hidden="true"> ↗</span>}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </section>
      </div>

      <aside className="jh-side">
        <section className="bf-card jh-activity">
          <header>
            <h3>{L('activity')}</h3>
          </header>
          <p className="bf-source">{L('activitySrc')}</p>
          <ActivityFeed items={activity} empty={L('activityEmpty')} />
        </section>
      </aside>
    </main>
  )
}
