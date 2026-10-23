/**
 * RuView (github.com/ruvnet/ruview, MIT): Wi-Fi sensing from ESP32 nodes, run unchanged on the home PC.
 * The pinned upstream version lives in ruview.versions.json; a daily GitHub Action opens a PR when a newer one ships.
 * This file holds the pure parts: board/firmware choice, presence wording, node list merge, version compare.
 */
import pinned from '../../ruview.versions.json'

export const RUVIEW = pinned as { upstream: string; release: string; image: string; firmware: string; checked: string }
export const RUVIEW_IMAGE = `${RUVIEW.image}:${RUVIEW.release}`
export const RUVIEW_RELEASE_URL = `${RUVIEW.upstream}/releases/tag/${RUVIEW.release}`
/** UDP port the nodes send CSI to (RuView default). */
export const CSI_PORT = 5005

/** The parts of RuView's /api/v1/sensing/latest the page uses. */
export interface SensingLatest {
  status?: 'stale' | 'no data yet'
  source?: string
  age_ms?: number
  timestamp?: number
  classification?: { motion_level: 'absent' | 'present_still' | 'present_moving'; presence: boolean; confidence: number }
  estimated_persons?: number
}
export interface LiveNode {
  node_id: number
  status: 'active' | 'stale'
  last_seen_ms: number
  rssi_dbm?: number | null
  motion_level?: string | null
  person_count?: number | null
}
export interface Vitals {
  vital_signs?: { breathing_rate_bpm: number | null; heart_rate_bpm: number | null }
  authority?: 'explicit_calibration' | 'abstained'
  abstention_reason?: string | null
}

export type BoardId = 's3-8mb' | 's3-4mb' | 'c6' | 'xiao-c6' | 'c3' | 'esp32'
export interface Board {
  id: BoardId
  label: string
  chip: 'esp32s3' | 'esp32c6' | 'esp32c3' | 'esp32'
  /** false: RuView does not run on it. */
  supported: boolean
  /** RuView lists C6 as a research target, still being validated. */
  research?: boolean
  /** Upstream release files for this board. */
  bundle?: string
  app?: string
  table?: string
  /** An external antenna is possible (U.FL), chosen when the firmware is built. */
  externalAntenna?: boolean
}

/** Boards from RuView's firmware README and CI matrix (firmware/esp32-csi-node, v0.8.14). */
export const BOARDS: Board[] = [
  { id: 's3-8mb', label: 'ESP32-S3 · 8 MB+ flash (N8, N16R8)', chip: 'esp32s3', supported: true, bundle: 'esp32-csi-node-firmware-8mb.tar.gz', app: 'esp32-csi-node.bin', table: 'partition-table.bin' },
  { id: 's3-4mb', label: 'ESP32-S3 · 4 MB flash (N4)', chip: 'esp32s3', supported: true, bundle: 'esp32-csi-node-firmware-4mb.tar.gz', app: 'esp32-csi-node-4mb.bin', table: 'partition-table-4mb.bin' },
  { id: 'c6', label: 'ESP32-C6 · 4 MB', chip: 'esp32c6', supported: true, research: true, bundle: 'esp32-csi-node-firmware-c6-4mb.tar.gz', app: 'esp32-csi-node-c6.bin', table: 'partition-table-c6.bin' },
  { id: 'xiao-c6', label: 'Seeed XIAO ESP32-C6', chip: 'esp32c6', supported: true, research: true, externalAntenna: true, bundle: 'esp32-csi-node-firmware-c6-4mb.tar.gz', app: 'esp32-csi-node-c6.bin', table: 'partition-table-c6.bin' },
  { id: 'c3', label: 'ESP32-C3', chip: 'esp32c3', supported: false },
  { id: 'esp32', label: 'ESP32 (original)', chip: 'esp32', supported: false },
]

export const boardOf = (id: string) => BOARDS.find((b) => b.id === id)

/** The board a node's own report (chip=esp32s3 / esp32c6) most likely is; flash size still has to be read off the module. */
export function boardFromChip(chip: string): BoardId | null {
  if (chip === 'esp32s3') return 's3-8mb'
  if (chip === 'esp32c6') return 'c6'
  return null
}

/** esptool command for one board, from the offsets in RuView's firmware README. Run inside the unpacked release folder. */
export function flashCommand(b: Board, port = 'COM5'): string | null {
  if (!b.supported || !b.app || !b.table) return null
  return `python -m esptool --chip ${b.chip} --port ${port} --baud 460800 write_flash --flash_mode dio 0x0 bootloader.bin 0x8000 ${b.table} 0xf000 ota_data_initial.bin 0x20000 ${b.app}`
}

export type Presence = 'absent' | 'still' | 'moving' | 'stale' | 'waiting'

/** What the room is doing right now, in one word. */
export function presenceOf(s: SensingLatest | null): Presence {
  if (!s || s.status === 'no data yet') return 'waiting'
  if (s.status === 'stale') return 'stale'
  const m = s.classification?.motion_level
  return m === 'present_moving' ? 'moving' : m === 'present_still' ? 'still' : 'absent'
}

export interface RegistryNode {
  id: number
  room: string
  board: BoardId
  antenna: 'internal' | 'external'
  firmware?: string
  added: number
}
export interface NodeRow extends RegistryNode {
  live: LiveNode | null
  /** Firmware older than the pinned release. */
  behind: boolean
}

/** Registry (what you told Neo) joined with the live list from RuView; unknown live nodes still show up. */
export function mergeNodes(reg: RegistryNode[], live: LiveNode[]): NodeRow[] {
  const rows: NodeRow[] = reg.map((r) => ({ ...r, live: live.find((l) => l.node_id === r.id) ?? null, behind: !!r.firmware && newer(RUVIEW.firmware, r.firmware) }))
  for (const l of live) if (!reg.some((r) => r.id === l.node_id)) rows.push({ id: l.node_id, room: '', board: 's3-8mb', antenna: 'internal', added: 0, live: l, behind: false })
  return rows.sort((a, b) => a.id - b.id)
}

/** The lowest node id (1-255) not used yet. */
export function nextNodeId(reg: RegistryNode[]): number {
  for (let i = 1; i < 256; i++) if (!reg.some((r) => r.id === i)) return i
  return 255
}

const parts = (v: string) => (/(\d+)\.(\d+)\.(\d+)/.exec(v) ?? [0, 0, 0, 0]).slice(1).map(Number)
/** true when version a is newer than b ("0.8.14" > "0.8.9"; a leading v and suffixes are ignored). */
export function newer(a: string, b: string): boolean {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}
