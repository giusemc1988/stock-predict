/**
 * Everything the Hub home page shows, worked out from data the app already has: one model per
 * project, the stats row, the activity feed and the quick search. Both Hub looks (liquid glass
 * and the classic one) draw from this, so a fix here reaches both.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LearnState } from '../lib/autoLearn'
import { RELEASES, APP_VERSION } from '../data/releases'
import { fmtPct, fmtUsd, tone } from '../lib/format'
import { useLang } from '../lib/i18n'
import { greeting } from '../lib/jarvis'
import { practiceEquity, PRACTICE_START, type PickRow, type PracticeState } from '../lib/practice'
import { PROJECTS, pageOn, readyCount, searchHub, type Hit, type HubOn, type Project, type ProjectState } from '../lib/projects'
import { RUVIEW, BOARDS } from '../lib/ruview'
import { postCounts, VIRALTECH } from '../data/viraltech'
import type { HubPage, ToolNode } from '../lib/toolHub'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { FeedItem } from './ActivityFeed'
import type { Stat } from './StatCard'

export type Target = HubPage | 'brief'

export interface HubProps {
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

export const TX = {
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
export type TxKey = keyof typeof TX

export interface Fact {
  label: TxKey
  value: string
  tone?: string
}
export interface CardModel {
  p: Project
  state: ProjectState
  /** ring: share of the project working now (0..1) and what it measures */
  ring: { v: number | null; label: string; cap: TxKey }
  facts: Fact[]
}

export function useHubModel(p: HubProps) {
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

  return { lang, vi, L, homeUp, equity, change, cards, working, stats, activity, q, setQ, inputRef, hits, canOpen, openTool, toolOk, openHit, hitOk, hello }
}
