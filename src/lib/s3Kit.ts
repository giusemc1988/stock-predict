/**
 * The shared ESP32-S3 kit: one USB (Web Serial) connection, used by both Echo (RuView room watch) and Nexus (pocket scout).
 * Pure helpers here (no DOM) so they are easy to test; the connect itself is NodeLink in ruviewSerial.ts.
 * Own devices and networks only.
 */

export type KitFirmware = 'ruview' | 'nexus-scout' | 'unknown'

/** Boot/log lines that identify what is flashed on the board. nexus-scout prints "NEXUS-SCOUT v<ver> board=<b> ready". */
export function detectFirmware(line: string): KitFirmware {
  if (/^NEXUS-SCOUT v/.test(line.trim())) return 'nexus-scout'
  if (/RUVIEW_HELLO_OK_V1|csi_collector|edge_proc|Vitals: br=|\bruview\b/i.test(line)) return 'ruview'
  return 'unknown'
}

export function nexusBoard(line: string): { version: string; board: string } | null {
  const m = /^NEXUS-SCOUT v(\S+) board=(\S+) ready/.exec(line.trim())
  return m ? { version: m[1], board: m[2] } : null
}

/** One RuView on-chip result line: "Vitals: br=14.0 hr=72.0 motion=0.0310 pres=YES fall=no persons=1 frames=200 drops=0". */
export interface RoomVitals {
  breathing: number | null
  heart: number | null
  motion: number
  present: boolean
  fall: boolean
  persons: number
  frames: number
}

export function parseVitalsLine(line: string): RoomVitals | null {
  const m = /Vitals: br=(\S+) hr=(\S+) motion=(\S+) pres=(YES|no) fall=(YES|no) persons=(\d+) frames=(\d+)/.exec(line)
  if (!m) return null
  const num = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const motion = Number(m[3])
  return { breathing: num(m[1]), heart: num(m[2]), motion: Number.isFinite(motion) ? motion : 0, present: m[4] === 'YES', fall: m[5] === 'YES', persons: Number(m[6]), frames: Number(m[7]) }
}

export type RoomState = 'empty' | 'still' | 'moving'

export function roomState(v: RoomVitals): RoomState {
  if (!v.present) return 'empty'
  return v.motion >= 0.05 ? 'moving' : 'still'
}

/** Alert wording key when the room changes between two readings, or null when nothing worth telling. */
export function roomChange(prev: RoomVitals | null, next: RoomVitals): 'enter' | 'leave' | 'fall' | null {
  if (next.fall && !prev?.fall) return 'fall'
  if (prev && !prev.present && next.present) return 'enter'
  if (prev && prev.present && !next.present) return 'leave'
  return null
}

/** The Wi-Fi the board needs to see CSI: a phone hotspot works anywhere. Credentials stay on the board (sent once over USB). */
export const HOTSPOT_TIP = { en: 'Travelling: turn on your phone hotspot, then give the board that name and password.', vi: 'Khi đi xa: bật điểm phát Wi-Fi của điện thoại rồi nhập tên và mật khẩu đó cho board.' }
