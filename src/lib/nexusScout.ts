/**
 * Nexus pocket scout: pure logic for the nexus-scout ESP32 firmware (firmware/nexus-scout/).
 * Watch only — nothing here builds or sends an attack frame (deauth, beacon spam, evil-portal, …).
 * The firmware exposes one BLE GATT characteristic that notifies small JSON chunks; this module
 * parses and accumulates them, and turns the result into findings and radar points. NexusScoutPanel.tsx
 * does the Web Bluetooth plumbing and drawing; this file has no DOM/BLE access so it is easy to test.
 */

export interface ScoutWifi {
  ssid: string
  bssid: string
  channel: number
  rssi: number // dBm, typically -30 (close) to -90 (far)
  auth: 'open' | 'wep' | 'wpa' | 'wpa2' | 'wpa3'
  wps: boolean
}

export interface ScoutBle {
  id: string // MAC or a firmware-assigned id
  name: string | null
  rssi: number
  kind: 'ibeacon' | 'other'
  /** Bluetooth company id from the manufacturer data (76 = Apple), when the advertisement has one. */
  co?: number
  /** First byte of the manufacturer payload (Apple: 0x12 = Find My network accessory). */
  ty?: number
  /** Short (16-bit) service UUIDs in the advertisement, lowercase hex, e.g. "feed" (Tile), "fd5a" (SmartTag). */
  su?: string[]
}

export interface ScoutScan {
  wifi: ScoutWifi[]
  ble: ScoutBle[]
  at: number
}

const emptyScan = (): ScoutScan => ({ wifi: [], ble: [], at: 0 })

/**
 * The firmware notifies one JSON object per chunk (a scan can be larger than one BLE packet, so
 * chunks arrive as `{"t":"wifi","items":[...]}`, `{"t":"ble","items":[...]}`, or
 * `{"t":"end","at":<ms>}` to mark a scan cycle complete). Malformed chunks are ignored.
 */
export function parseScoutChunk(raw: string, into: ScoutScan = emptyScan()): ScoutScan {
  let j: unknown
  try {
    j = JSON.parse(raw)
  } catch {
    return into
  }
  if (!j || typeof j !== 'object') return into
  const o = j as { t?: unknown; items?: unknown; at?: unknown }
  if (o.t === 'wifi' && Array.isArray(o.items)) {
    const items = o.items
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x): ScoutWifi | null => {
        const ssid = typeof x.ssid === 'string' ? x.ssid : null
        const bssid = typeof x.bssid === 'string' ? x.bssid : null
        if (ssid == null || bssid == null) return null
        const auth = (['open', 'wep', 'wpa', 'wpa2', 'wpa3'] as const).includes(x.auth as never) ? (x.auth as ScoutWifi['auth']) : 'wpa2'
        return { ssid, bssid, channel: typeof x.ch === 'number' ? x.ch : 0, rssi: typeof x.rssi === 'number' ? x.rssi : -99, auth, wps: x.wps === true }
      })
      .filter((x): x is ScoutWifi => x != null)
    return { ...into, wifi: [...into.wifi, ...items] }
  }
  if (o.t === 'ble' && Array.isArray(o.items)) {
    const items = o.items
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x): ScoutBle | null => {
        const id = typeof x.id === 'string' ? x.id : null
        if (id == null) return null
        const out: ScoutBle = { id, name: typeof x.name === 'string' && x.name ? x.name : null, rssi: typeof x.rssi === 'number' ? x.rssi : -99, kind: x.kind === 'ibeacon' ? 'ibeacon' : 'other' }
        if (typeof x.co === 'number') out.co = x.co
        if (typeof x.ty === 'number') out.ty = x.ty
        if (typeof x.su === 'string') out.su = [x.su.toLowerCase()]
        else if (Array.isArray(x.su)) out.su = x.su.filter((u): u is string => typeof u === 'string').map((u) => u.toLowerCase())
        return out
      })
      .filter((x): x is ScoutBle => x != null)
    return { ...into, ble: [...into.ble, ...items] }
  }
  if (o.t === 'end') return { ...into, at: typeof o.at === 'number' ? o.at : Date.now() }
  return into
}

/** Channels 1-13 with how many networks sit on each, worst first. */
export function crowdedChannels(wifi: ScoutWifi[]): { channel: number; count: number }[] {
  const counts = new Map<number, number>()
  for (const w of wifi) {
    if (w.channel < 1 || w.channel > 13) continue
    counts.set(w.channel, (counts.get(w.channel) ?? 0) + 1)
  }
  return [...counts.entries()].map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count)
}

/** The 2.4 GHz channel (among 1, 6, 11 — the only three that never overlap) with the fewest networks. */
export function bestChannel(wifi: ScoutWifi[]): number {
  const counts = crowdedChannels(wifi)
  const of = (ch: number) => counts.find((c) => c.channel === ch)?.count ?? 0
  return [1, 6, 11].sort((a, b) => of(a) - of(b))[0]
}

/** Open or WEP networks, and ones with WPS on (an easy PIN-guess target) — never acted on, only shown. */
export function weakNetworks(wifi: ScoutWifi[]): { wifi: ScoutWifi; flag: 'open' | 'wep' | 'wps' }[] {
  const out: { wifi: ScoutWifi; flag: 'open' | 'wep' | 'wps' }[] = []
  for (const w of wifi) {
    if (w.auth === 'open') out.push({ wifi: w, flag: 'open' })
    else if (w.auth === 'wep') out.push({ wifi: w, flag: 'wep' })
    else if (w.wps) out.push({ wifi: w, flag: 'wps' })
  }
  return out
}

/**
 * A possible evil twin: the same SSID as one of Chanh's own known networks, seen on a BSSID that
 * isn't one of his own access points' BSSIDs. Flags for Chanh to look at, never acted on automatically.
 */
export function possibleEvilTwins(wifi: ScoutWifi[], known: { ssid: string; bssids: string[] }[]): ScoutWifi[] {
  const byKnownSsid = new Map(known.map((k) => [k.ssid, new Set(k.bssids.map((b) => b.toLowerCase()))]))
  return wifi.filter((w) => {
    const bssids = byKnownSsid.get(w.ssid)
    return bssids != null && !bssids.has(w.bssid.toLowerCase())
  })
}

/** A BLE device (by id) seen at `minPlaces` or more distinct named places — a possible tracker tagging along. */
export function followingDevices(sightings: { id: string; place: string }[], minPlaces = 3): { id: string; places: number }[] {
  const places = new Map<string, Set<string>>()
  for (const s of sightings) {
    if (!places.has(s.id)) places.set(s.id, new Set())
    places.get(s.id)!.add(s.place)
  }
  return [...places.entries()].filter(([, p]) => p.size >= minPlaces).map(([id, p]) => ({ id, places: p.size }))
}

export type RiskLevel = 'trusted' | 'caution' | 'risk'

/** One dot's color tier: red for an evil-twin/tracker flag, amber for open/weak/WPS, green otherwise. */
export function riskOf(opts: { flagged?: boolean; weak?: boolean }): RiskLevel {
  if (opts.flagged) return 'risk'
  if (opts.weak) return 'caution'
  return 'trusted'
}

export interface RadarPoint {
  id: string
  label: string
  ring: number // 0 (center, strong) .. 1 (edge, weak)
  angle: number // radians, 0 = up, clockwise
  rssi: number
  risk: RiskLevel
}

/** RSSI -30..-95 dBm mapped to a 0..1 ring distance, strongest signal nearest the center. */
export function ringOf(rssi: number): number {
  const clamped = Math.max(-95, Math.min(-30, rssi))
  return (-30 - clamped) / 65
}

/** Places N items evenly around the radar (no real bearing data from a single antenna), ring by signal strength. */
export function radarLayout(items: { id: string; label: string; rssi: number; risk: RiskLevel }[]): RadarPoint[] {
  return items.map((it, i) => ({
    id: it.id,
    label: it.label,
    ring: ringOf(it.rssi),
    angle: (i / Math.max(1, items.length)) * Math.PI * 2,
    rssi: it.rssi,
    risk: it.risk,
  }))
}

export interface Finding {
  kind: 'crowded' | 'open' | 'wep' | 'twin' | 'tracker'
  text: string
}

/**
 * All findings for one scan, in priority order (trackers and twins first). `known` and `sightings`
 * are optional — without them only the channel/open/WEP findings run.
 */
export function findingsFor(scan: ScoutScan, known: { ssid: string; bssids: string[] }[] = [], sightings: { id: string; place: string }[] = []): Finding[] {
  const out: Finding[] = []
  for (const t of followingDevices(sightings)) out.push({ kind: 'tracker', text: `tracker:${t.id}:${t.places}` })
  for (const w of possibleEvilTwins(scan.wifi, known)) out.push({ kind: 'twin', text: `twin:${w.ssid}` })
  for (const w of weakNetworks(scan.wifi)) {
    if (w.flag === 'open') out.push({ kind: 'open', text: `open:${w.wifi.ssid}` })
    else if (w.flag === 'wep') out.push({ kind: 'wep', text: `wep:${w.wifi.ssid}` })
  }
  const crowded = crowdedChannels(scan.wifi)
  if (crowded.length && crowded[0].count >= 3) out.push({ kind: 'crowded', text: `crowded:${crowded[0].channel}:${crowded[0].count}:${bestChannel(scan.wifi)}` })
  return out
}
