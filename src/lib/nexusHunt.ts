/**
 * Nexus pocket scout: what the passive scan can tell you about hidden cameras, Bluetooth trackers and a
 * hotel room, plus the "hot / cold" finder. Pure logic (no DOM, no radio); NexusScoutPanel draws it.
 *
 * Everything here only READS what the nexus-scout board hears: Wi-Fi access points that announce
 * themselves (SSID, BSSID/vendor, signal) and Bluetooth advertisements. Nothing is transmitted, nothing
 * is captured from other people's traffic, nobody's network is joined (AGENTS.md rule 5).
 *
 * Honest limits, shown to the user in the report: a camera that only talks to the room's own Wi-Fi as a
 * client, or records to an SD card, does not announce itself and this cannot see it. A clean result is
 * "nothing obvious", never "guaranteed safe".
 */
import type { ScoutBle, ScoutScan, ScoutWifi } from './nexusScout'

export type HitKind = 'camera' | 'tracker' | 'iot'

/** One reason a device was flagged; the page turns `code` into a sentence (netText hunt* keys). */
export interface Reason {
  code: 'ssid' | 'oui' | 'hidden' | 'open' | 'chip' | 'name' | 'near' | 'apple' | 'tile' | 'smarttag'
  arg?: string
}

export interface Hit {
  kind: HitKind
  source: 'wifi' | 'ble'
  /** BSSID or BLE id, what the hot/cold finder locks onto. */
  id: string
  label: string
  rssi: number
  channel?: number
  score: number
  reasons: Reason[]
}

const mac = (b: string) => b.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 6)

/**
 * Vendors that make surveillance / IP cameras. PARTIAL list of well-known prefixes, only used as a hint
 * next to other signs; a hit alone means "a camera maker's radio", not proof of anything.
 */
const CAMERA_OUI: Record<string, string> = {}
const addOui = (vendor: string, list: string[]) => list.forEach((o) => (CAMERA_OUI[mac(o)] = vendor))
addOui('Hikvision', ['44:19:B6', 'C0:56:E3', 'BC:AD:28', '4C:BD:8F', '28:57:BE', '54:C4:15', '18:68:CB', 'A4:14:37'])
addOui('Dahua', ['3C:EF:8C', '4C:11:BF', '90:02:A9', 'E0:50:8B', '9C:14:63', 'A0:BD:1D', 'BC:32:5F', '38:AF:29'])
addOui('Reolink', ['EC:71:DB'])
addOui('Amcrest', ['9C:8E:CD'])
addOui('Wyze', ['2C:AA:8E', '7C:78:B2', 'D0:3F:27'])
addOui('Axis', ['00:40:8C', 'AC:CC:8E'])

/** Espressif (ESP32/ESP8266): the chip inside most DIY and cheap IoT gadgets, cameras included. Weak hint only. */
const ESPRESSIF = new Set(
  ['24:0A:C4', '30:AE:A4', '7C:DF:A1', 'A4:CF:12', '84:0D:8E', '3C:71:BF', '24:6F:28', '08:3A:F2', 'EC:62:60', '94:B9:7E', '8C:AA:B5', 'A0:76:4E', 'C4:DD:57', 'CC:50:E3', '34:85:18', '58:BF:25', 'D8:A0:1D', 'E8:68:E7', 'FC:F5:C4', 'B4:E6:2D', 'BC:DD:C2', '40:F5:20', '4C:75:25', '68:C6:3A', 'B8:D6:1A', '0C:B8:15', '10:52:1C', 'C8:2B:96', '7C:9E:BD', '34:94:54', '98:F4:AB'].map(mac),
)

/** Access-point names that small cameras broadcast for their own setup (before or instead of joining Wi-Fi). */
const CAMERA_SSID = /^(ipc[-_ ]?\w|ipcam|ip[-_ ]?cam|wifi[-_ ]?cam|hdwificam|hd[-_ ]?cam|hd[-_ ]?\d|mini[-_ ]?cam|spy[-_ ]?cam|cam[-_ ]?\d|camera|a9[-_ ]|v380|yi[-_ ]|yicam|ycc365|icsee|xmeye|hik[-_ ]|ezviz|reolink|imou|dahua|cctv|dvr|nvr|p2p[-_ ]|pnp[-_ ]|jooan|sricam|escam|onvif|webcam|dash[-_ ]?cam|action[-_ ]?cam|tapo[-_ ]?c|wyzecam|eufycam|arlo|blink[-_ ])/i
const IOT_SSID = /^(esp[-_ ]?\d*|esp32|esp8266|tuya|smartlife|smart[-_ ]?life)/i
const CAMERA_BLE_NAME = /cam|ipc|spy|v380|icsee|tuya|smartlife|eye/i

export function classifyWifi(w: ScoutWifi): Hit | null {
  const reasons: Reason[] = []
  let score = 0
  let kind: HitKind = 'iot'
  const oui = mac(w.bssid)
  if (w.ssid && CAMERA_SSID.test(w.ssid)) {
    score += 3
    kind = 'camera'
    reasons.push({ code: 'ssid', arg: w.ssid })
  }
  const vendor = CAMERA_OUI[oui]
  if (vendor) {
    score += 2
    kind = 'camera'
    reasons.push({ code: 'oui', arg: vendor })
  }
  const chip = ESPRESSIF.has(oui)
  if ((chip || (w.ssid && IOT_SSID.test(w.ssid))) && !reasons.some((r) => r.code === 'ssid')) {
    score += 1
    reasons.push({ code: 'chip' })
  }
  if (!w.ssid && (reasons.length || w.auth === 'open')) {
    score += 1
    reasons.push({ code: 'hidden' })
  }
  if (w.auth === 'open' && score > 0) {
    score += 1
    reasons.push({ code: 'open' })
  }
  if (!score) return null
  if (w.rssi > -50) {
    score += 1
    reasons.push({ code: 'near' })
  }
  return { kind, source: 'wifi', id: w.bssid, label: w.ssid || '(hidden)', rssi: w.rssi, channel: w.channel, score, reasons }
}

export type TrackerBrand = 'apple' | 'tile' | 'smarttag'

export function trackerBrand(b: ScoutBle): TrackerBrand | null {
  if (b.co === 76 && b.ty === 0x12) return 'apple'
  const su = b.su ?? []
  if (su.includes('feed') || su.includes('feec')) return 'tile'
  if (su.includes('fd5a')) return 'smarttag'
  return null
}

export function classifyBle(b: ScoutBle): Hit | null {
  const brand = trackerBrand(b)
  const label = b.name ?? b.id.slice(0, 17)
  if (brand) {
    const reasons: Reason[] = [{ code: brand }]
    let score = 2
    if (b.rssi > -60) {
      score += 2
      reasons.push({ code: 'near' })
    }
    return { kind: 'tracker', source: 'ble', id: b.id, label, rssi: b.rssi, score, reasons }
  }
  if (b.name && CAMERA_BLE_NAME.test(b.name)) {
    const reasons: Reason[] = [{ code: 'name', arg: b.name }]
    let score = 2
    if (b.rssi > -55) {
      score += 1
      reasons.push({ code: 'near' })
    }
    return { kind: 'camera', source: 'ble', id: b.id, label, rssi: b.rssi, score, reasons }
  }
  return null
}

/** Everything flagged in one scan, strongest suspicion first. */
export function scanHits(scan: ScoutScan): Hit[] {
  const out: Hit[] = []
  for (const w of scan.wifi) {
    const h = classifyWifi(w)
    if (h) out.push(h)
  }
  for (const b of scan.ble) {
    const h = classifyBle(b)
    if (h) out.push(h)
  }
  return out.sort((a, b) => b.score - a.score || b.rssi - a.rssi)
}

/** Merges several scan cycles (a device keeps its strongest signal) so a room check does not miss a device that only answered once. */
export function mergeScans(scans: ScoutScan[]): ScoutScan {
  const wifi = new Map<string, ScoutWifi>()
  const ble = new Map<string, ScoutBle>()
  for (const s of scans) {
    for (const w of s.wifi) {
      const prev = wifi.get(w.bssid.toLowerCase())
      if (!prev || w.rssi > prev.rssi) wifi.set(w.bssid.toLowerCase(), w)
    }
    for (const b of s.ble) {
      const prev = ble.get(b.id.toLowerCase())
      if (!prev || b.rssi > prev.rssi || (!prev.name && b.name)) ble.set(b.id.toLowerCase(), { ...prev, ...b, rssi: Math.max(prev?.rssi ?? -99, b.rssi) })
    }
  }
  return { wifi: [...wifi.values()], ble: [...ble.values()], at: Math.max(0, ...scans.map((s) => s.at)) }
}

export type Verdict = 'safe' | 'check' | 'suspicious'

export interface RoomReport {
  verdict: Verdict
  hits: Hit[]
  cameras: Hit[]
  trackers: Hit[]
  iot: Hit[]
  openNets: number
  hiddenNets: number
  wifiCount: number
  bleCount: number
}

/**
 * One-tap hotel-room verdict from the merged scans. `suspicious` = a camera-like name/maker, or a tracker
 * very close; `check` = something worth a look (weak hints, any tracker, open networks); `safe` = nothing obvious.
 */
export function roomReport(scans: ScoutScan[]): RoomReport {
  const merged = mergeScans(scans)
  const hits = scanHits(merged)
  const cameras = hits.filter((h) => h.kind === 'camera')
  const trackers = hits.filter((h) => h.kind === 'tracker')
  const iot = hits.filter((h) => h.kind === 'iot')
  const openNets = merged.wifi.filter((w) => w.auth === 'open').length
  const hiddenNets = merged.wifi.filter((w) => !w.ssid).length
  const strongCamera = cameras.some((h) => h.score >= 3)
  const nearTracker = trackers.some((h) => h.rssi > -65)
  let verdict: Verdict = 'safe'
  if (strongCamera || nearTracker) verdict = 'suspicious'
  else if (cameras.length || trackers.length || iot.some((h) => h.score >= 2) || openNets > 0) verdict = 'check'
  return { verdict, hits, cameras, trackers, iot, openNets, hiddenNets, wifiCount: merged.wifi.length, bleCount: merged.ble.length }
}

// ---------------------------------------------------------------- hot / cold finder

export interface HuntState {
  /** smoothed signal in dBm, null until the first reading */
  rssi: number | null
  trend: 'hotter' | 'colder' | 'same' | null
  /** consecutive readings with no signal */
  misses: number
  best: number | null
}

export const huntStart = (): HuntState => ({ rssi: null, trend: null, misses: 0, best: null })

/** Folds one reading (dBm, or null when the target was not heard) into the state. Smoothing 0.5, trend threshold 2 dB. */
export function huntStep(s: HuntState, reading: number | null): HuntState {
  if (reading == null) return { ...s, misses: s.misses + 1, trend: s.misses + 1 >= 3 ? null : s.trend }
  const next = s.rssi == null ? reading : s.rssi * 0.5 + reading * 0.5
  const d = s.rssi == null ? 0 : next - s.rssi
  return { rssi: next, trend: s.rssi == null ? null : d >= 2 ? 'hotter' : d <= -2 ? 'colder' : 'same', misses: 0, best: Math.max(s.best ?? -999, next) }
}

/** 0 (cold/far) .. 1 (touching) bar fill for a dBm value. */
export const huntFill = (rssi: number | null): number => (rssi == null ? 0 : Math.max(0, Math.min(1, (rssi + 95) / 55)))

export type HuntRange = 'touch' | 'close' | 'near' | 'far' | 'lost'

/** Rough range from signal strength; walls, bodies and antennas shift it a lot, so it is only a direction aid. */
export function huntRange(rssi: number | null): HuntRange {
  if (rssi == null) return 'lost'
  if (rssi > -45) return 'touch'
  if (rssi > -58) return 'close'
  if (rssi > -72) return 'near'
  return 'far'
}

const MAC = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i

export type HuntTarget = { kind: 'wifi'; bssid: string; channel: number } | { kind: 'ble'; id: string } | null

/** The serial line that points the board's finder at one device (or stops it). null if the id is not a MAC. */
export function huntCommand(t: HuntTarget): string | null {
  if (t == null) return 'hunt off\n'
  if (t.kind === 'wifi') return MAC.test(t.bssid) && t.channel >= 1 && t.channel <= 14 ? `hunt wifi ${t.bssid.toLowerCase()} ${t.channel}\n` : null
  return MAC.test(t.id) ? `hunt ble ${t.id.toLowerCase()}\n` : null
}
