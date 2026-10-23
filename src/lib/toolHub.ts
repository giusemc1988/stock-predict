/**
 * Tool Hub: every tool and project around Jarvis, grouped, each one opening real work
 * (a page in this app, a link, or a spot on the home page). Pure data and layout; ToolHub.tsx draws it.
 */
import type { Bi } from './hubText'
import { GODS_EYE_URL } from './godsEye'

export type HubPage = 'trade' | 'portfolio' | 'net' | 'ruview' | 'ruview-flash' | 'godseye' | 'studio' | 'viraltech'
export type ToolAction = { kind: 'page'; page: HubPage } | { kind: 'url'; url: string } | { kind: 'scroll'; id: string } | { kind: 'soon' }

export interface ToolNode {
  id: string
  cluster: ClusterId
  label: Bi
  note: Bi
  action: ToolAction
}
export type ClusterId = 'trading' | 'world' | 'esp32' | 'network' | 'build' | 'studio'
export interface Cluster {
  id: ClusterId
  label: Bi
  /** colour token, matches the hub's palette */
  tone: string
}

const REPO = 'https://github.com/giusemc1988/stock-predict'

export const CLUSTERS: Cluster[] = [
  { id: 'trading', label: { en: 'Trading', vi: 'Trading' }, tone: 'var(--robot)' },
  { id: 'world', label: { en: 'Argus', vi: 'Argus' }, tone: '#6fd3ff' },
  { id: 'esp32', label: { en: 'ESP32 Lab', vi: 'ESP32 Lab' }, tone: '#7ee0b5' },
  { id: 'network', label: { en: 'Network', vi: 'Mạng' }, tone: '#8fb8ff' },
  { id: 'build', label: { en: 'Build', vi: 'Xây dựng' }, tone: '#f2c46d' },
  { id: 'studio', label: { en: 'Studio', vi: 'Studio' }, tone: '#d9a3ff' },
]

export const TOOLS: ToolNode[] = [
  { id: 'desk', cluster: 'trading', label: { en: 'Trading desk', vi: 'Bàn giao dịch' }, note: { en: 'Chart, signals, paper orders', vi: 'Biểu đồ, tín hiệu, lệnh tiền ảo' }, action: { kind: 'page', page: 'trade' } },
  { id: 'portfolio', cluster: 'trading', label: { en: 'Portfolio', vi: 'Danh mục' }, note: { en: 'Paper account and history', vi: 'Tài khoản tiền ảo và lịch sử' }, action: { kind: 'page', page: 'portfolio' } },
  { id: 'board', cluster: 'trading', label: { en: 'Prediction board', vi: 'Bảng dự đoán' }, note: { en: 'Every BUY call with 6 agent votes', vi: 'Mọi lệnh MUA kèm 6 phiếu agent' }, action: { kind: 'scroll', id: 'hub-board' } },
  { id: 'godseye', cluster: 'world', label: { en: "Argus · God's Eye", vi: "Argus · God's Eye" }, note: { en: 'Live 3D globe: flights, military, satellites, quakes', vi: 'Địa cầu 3D trực tiếp: máy bay, quân sự, vệ tinh, động đất' }, action: { kind: 'page', page: 'godseye' } },
  { id: 'godseye-full', cluster: 'world', label: { en: 'Globe full screen', vi: 'Địa cầu toàn màn hình' }, note: { en: 'The argus Worker on your Cloudflare', vi: 'Worker argus trên Cloudflare của anh' }, action: { kind: 'url', url: GODS_EYE_URL } },
  { id: 'flash', cluster: 'esp32', label: { en: 'Flash a board', vi: 'Nạp firmware' }, note: { en: 'ESP32-S3 / C6 from Chrome over USB', vi: 'ESP32-S3 / C6 qua USB trên Chrome' }, action: { kind: 'page', page: 'ruview-flash' } },
  { id: 'ruview', cluster: 'esp32', label: { en: 'RuView live', vi: 'RuView trực tiếp' }, note: { en: 'Rooms, nodes, presence', vi: 'Phòng, node, có người' }, action: { kind: 'page', page: 'ruview' } },
  { id: 'firmware', cluster: 'esp32', label: { en: 'Firmware releases', vi: 'Các bản firmware' }, note: { en: 'RuView on GitHub', vi: 'RuView trên GitHub' }, action: { kind: 'url', url: 'https://github.com/ruvnet/ruview/releases' } },
  { id: 'esp32div', cluster: 'esp32', label: { en: 'ESP32-DIV', vi: 'ESP32-DIV' }, note: { en: 'Your ESP32-DIV fork on GitHub', vi: 'Bản ESP32-DIV của anh trên GitHub' }, action: { kind: 'url', url: 'https://github.com/giusemc1988/ESP32-DIV' } },
  { id: 'wifi', cluster: 'network', label: { en: 'Wi-Fi scan', vi: 'Quét Wi-Fi' }, note: { en: 'Devices and channels on your Wi-Fi', vi: 'Thiết bị và kênh trong Wi-Fi của anh' }, action: { kind: 'page', page: 'net' } },
  { id: 'speed', cluster: 'network', label: { en: 'Speed test', vi: 'Đo tốc độ' }, note: { en: 'Download, upload, ping', vi: 'Tải xuống, tải lên, ping' }, action: { kind: 'page', page: 'net' } },
  { id: 'android', cluster: 'network', label: { en: 'Android app', vi: 'App Android' }, note: { en: 'Scan any of your shops by phone', vi: 'Quét Wi-Fi tiệm nào cũng được bằng điện thoại' }, action: { kind: 'url', url: `${REPO}/releases/tag/android-latest` } },
  { id: 'dev', cluster: 'build', label: { en: 'Jarvis Dev (offline)', vi: 'Jarvis Dev (offline)' }, note: { en: 'Fix and upgrade on your PC, no Claude needed', vi: 'Sửa và nâng cấp trên máy, không cần Claude' }, action: { kind: 'url', url: `${REPO}/blob/main/tools/jarvis-dev/README.md` } },
  { id: 'prs', cluster: 'build', label: { en: 'Pull requests', vi: 'Pull request' }, note: { en: 'Changes waiting for you to merge', vi: 'Thay đổi chờ anh merge' }, action: { kind: 'url', url: `${REPO}/pulls` } },
  { id: 'repo', cluster: 'build', label: { en: 'Source code', vi: 'Mã nguồn' }, note: { en: 'The whole project on GitHub', vi: 'Toàn bộ dự án trên GitHub' }, action: { kind: 'url', url: REPO } },
  { id: 'apps', cluster: 'build', label: { en: 'App Builder', vi: 'Tạo app' }, note: { en: 'Jarvis writes small apps for you', vi: 'Jarvis viết app nhỏ cho anh' }, action: { kind: 'soon' } },
  { id: 'video', cluster: 'studio', label: { en: 'Nova · Video Studio', vi: 'Nova · Video Studio' }, note: { en: 'Bilingual faceless videos, MP4 + Title Lab', vi: 'Video không lộ mặt song ngữ, MP4 + Title Lab' }, action: { kind: 'page', page: 'studio' } },
  { id: 'media', cluster: 'studio', label: { en: 'Media Lab', vi: 'Media Lab' }, note: { en: 'Image and video tools', vi: 'Công cụ ảnh và video' }, action: { kind: 'soon' } },
  { id: 'viraltech', cluster: 'studio', label: { en: 'Viraltech', vi: 'Viraltech' }, note: { en: 'Social media posts and engagement', vi: 'Bài đăng và tương tác mạng xã hội' }, action: { kind: 'page', page: 'viraltech' } },
  { id: 'outside', cluster: 'studio', label: { en: 'Outside tools', vi: 'Công cụ bên ngoài' }, note: { en: 'CapCut, Canva, Gemini…', vi: 'CapCut, Canva, Gemini…' }, action: { kind: 'scroll', id: 'hub-studio' } },
]

/** Lower-case, accent-free, no hyphens, so "toc do" finds "Tốc độ" and "wifi" finds "Wi-Fi". */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/-/g, '').toLowerCase()

/** Tools whose name, note or group matches the search, in either language. Empty search = all. */
export function searchTools(q: string, tools: ToolNode[] = TOOLS): Set<string> {
  const words = fold(q).split(/\s+/).filter(Boolean)
  if (!words.length) return new Set(tools.map((t) => t.id))
  const groupOf = new Map(CLUSTERS.map((c) => [c.id, c.label]))
  return new Set(
    tools
      .filter((t) => {
        const g = groupOf.get(t.cluster)
        const hay = fold([t.label.en, t.label.vi, t.note.en, t.note.vi, g?.en, g?.vi].join(' '))
        return words.every((w) => hay.includes(w))
      })
      .map((t) => t.id),
  )
}

/** Whether a tool can open right now (a page switched off in Settings counts as off). */
export function toolOpen(t: ToolNode, on: { net: boolean; ruview: boolean; godseye?: boolean; studio?: boolean }): boolean {
  if (t.action.kind === 'soon') return false
  if (t.action.kind !== 'page') return true
  if (t.action.page === 'net') return on.net
  if (t.action.page === 'godseye') return on.godseye ?? true
  if (t.action.page === 'studio') return on.studio ?? true
  if (t.action.page === 'ruview' || t.action.page === 'ruview-flash') return on.ruview
  return true
}

export interface Pt {
  x: number
  y: number
}
/**
 * Graph positions in a 720 x 440 box: Jarvis in the middle, groups on a ring, each group's tools
 * fanned out away from the middle so lines don't cross.
 */
export function graphLayout(clusters: Cluster[] = CLUSTERS, tools: ToolNode[] = TOOLS) {
  const W = 720
  const H = 440
  const c = { x: W / 2, y: H / 2 }
  const groups = new Map<ClusterId, Pt>()
  const nodes = new Map<string, Pt>()
  clusters.forEach((g, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / clusters.length
    const gp = { x: c.x + Math.cos(a) * 205, y: c.y + Math.sin(a) * 118 }
    groups.set(g.id, gp)
    const mine = tools.filter((t) => t.cluster === g.id)
    const spread = Math.min(1.9, 0.62 * mine.length)
    mine.forEach((t, j) => {
      const b = a + (mine.length > 1 ? -spread / 2 + (j * spread) / (mine.length - 1) : 0)
      nodes.set(t.id, { x: Math.round(gp.x + Math.cos(b) * 92), y: Math.round(gp.y + Math.sin(b) * 62) })
    })
  })
  return { W, H, center: c, groups, nodes }
}
