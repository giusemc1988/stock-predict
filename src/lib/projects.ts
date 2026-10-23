/**
 * Neo Hub: the projects the hub runs, what each one is, where it opens and which Tool Hub tools
 * belong to it. Pure data plus the hub search; JarvisHub.tsx draws it.
 */
import type { Bi } from './hubText'
import { CLUSTERS, TOOLS, fold, toolOpen, type HubPage, type ToolNode } from './toolHub'

export type ProjectId = 'atlas' | 'echo' | 'volt' | 'nexus' | 'forge' | 'lumi' | 'argus' | 'nova' | 'viraltech'
/** live = numbers moving now, ready = opens and works, home = needs the home PC agent, off = switched off in Settings, soon = not built yet */
export type ProjectState = 'live' | 'ready' | 'home' | 'off' | 'soon'

export interface Project {
  id: ProjectId
  /** Chanh's name for it. */
  name: string
  what: Bi
  /** colour of its card and dot */
  hue: string
  /** where tapping the card goes; null = nothing to open yet */
  opens: HubPage | 'brief' | null
  /** Tool Hub tools that belong to this project, shown as quick links and found by search */
  tools: string[]
}

export const PROJECTS: Project[] = [
  { id: 'atlas', name: 'Atlas', what: { en: 'Stock Predictor', vi: 'Dự đoán cổ phiếu' }, hue: '#4fd1ff', opens: 'brief', tools: ['desk', 'portfolio', 'board', 'kronos'] },
  { id: 'argus', name: 'Iris', what: { en: "God's Eye globe", vi: "Địa cầu God's Eye" }, hue: '#7aa7ff', opens: 'godseye', tools: ['godseye', 'godseye-full'] },
  { id: 'echo', name: 'Echo', what: { en: 'RuView sensing', vi: 'Cảm biến RuView' }, hue: '#5fd6c8', opens: 'ruview', tools: ['ruview'] },
  { id: 'volt', name: 'Volt', what: { en: 'ESP32 Lab', vi: 'Phòng ESP32' }, hue: '#7ee0b5', opens: 'ruview-flash', tools: ['flash', 'espconnect', 'firmware', 'esp32div'] },
  { id: 'nexus', name: 'Nexus', what: { en: 'Wi-Fi & Bluetooth', vi: 'Wi-Fi & Bluetooth' }, hue: '#8fb8ff', opens: 'net', tools: ['wifi', 'speed', 'android'] },
  { id: 'nova', name: 'Nova', what: { en: 'Bilingual Video Studio', vi: 'Studio video song ngữ' }, hue: '#d9a3ff', opens: 'studio', tools: ['video'] },
  { id: 'viraltech', name: 'Viraltech', what: { en: 'Social channels', vi: 'Kênh mạng xã hội' }, hue: '#ff7ab6', opens: 'viraltech', tools: ['viraltech', 'explainers'] },
  { id: 'lumi', name: 'Lumi', what: { en: 'Media Lab', vi: 'Media Lab' }, hue: '#ffb36b', opens: null, tools: ['media', 'outside'] },
  { id: 'forge', name: 'Max', what: { en: 'Build & app builder', vi: 'Xây dựng & tạo app' }, hue: '#f2c46d', opens: null, tools: ['prs', 'repo', 'dev', 'apps'] },
]

export interface HubOn {
  net: boolean
  ruview: boolean
  godseye: boolean
  studio: boolean
}

/** Whether the page a project opens is switched on in Settings. */
export function pageOn(p: HubPage | 'brief' | null, on: HubOn): boolean {
  if (p === 'net') return on.net
  if (p === 'ruview' || p === 'ruview-flash') return on.ruview
  if (p === 'godseye') return on.godseye
  if (p === 'studio') return on.studio
  return p != null
}

export const toolsOf = (p: Project): ToolNode[] => p.tools.map((id) => TOOLS.find((t) => t.id === id)).filter((t): t is ToolNode => !!t)

/** How many of a project's tools open right now. */
export function readyCount(p: Project, on: HubOn): { ready: number; total: number } {
  const mine = toolsOf(p)
  return { ready: mine.filter((t) => toolOpen(t, on)).length, total: mine.length }
}

export interface Hit {
  project: Project
  /** the tool that matched; undefined = the project itself */
  tool?: ToolNode
}

/**
 * The hub's quick search: projects and their tools, in either language, accents ignored.
 * Projects whose name starts with the search come first, then other project matches, then tools.
 */
export function searchHub(q: string, projects: Project[] = PROJECTS): Hit[] {
  const words = fold(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const has = (hay: string) => words.every((w) => hay.includes(w))
  const lead = fold(q.trim())
  const out: (Hit & { rank: number })[] = []
  for (const p of projects) {
    const name = fold(p.name)
    if (has(fold([p.name, p.what.en, p.what.vi].join(' ')))) out.push({ project: p, rank: name.startsWith(lead) ? 0 : 1 })
    for (const t of toolsOf(p)) {
      const g = CLUSTERS.find((c) => c.id === t.cluster)?.label
      if (has(fold([t.label.en, t.label.vi, t.note.en, t.note.vi, g?.en, g?.vi, p.name].join(' ')))) out.push({ project: p, tool: t, rank: 2 })
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ project, tool }) => ({ project, tool }))
}
