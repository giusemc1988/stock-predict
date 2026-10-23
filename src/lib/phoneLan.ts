/**
 * The Android app's network tools (android/.../LanToolsPlugin.java), and the per-Wi-Fi memory the
 * Wi-Fi page keeps on the phone: each shop or house gets its own device names, trusted list and
 * "new device" flags, keyed by its router.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import { vendorOf, type WifiNetwork } from './netParse'

export interface PhoneWifi {
  ssid: string | null
  bssid: string | null
  signal: number | null
  channel: number | null
  ip: string | null
  gateway: string | null
}
export interface PhoneDevice {
  ip: string
  name: string | null
  mac: string | null
  ms: number
}
interface LanTools {
  currentWifi(): Promise<PhoneWifi>
  wifiScan(): Promise<PhoneWifi & { networks: WifiNetwork[] }>
  devices(): Promise<{ devices: PhoneDevice[]; me: string; gateway: string | null }>
  ping(o: { ip: string }): Promise<{ host: string; sent: number; received: number; avgMs: number | null }>
  ports(o: { ip: string }): Promise<{ ip: string; open: number[] }>
  wol(o: { mac: string }): Promise<{ ok: boolean }>
}

export const LanTools = registerPlugin<LanTools>('LanTools')

/** true inside the Neo Android app, where the phone can scan the Wi-Fi it is on. */
export const inPhoneApp = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LanTools')

export interface Known {
  name?: string
  trusted?: boolean
  firstSeen: number
  lastSeen: number
}
export interface PhoneNet {
  ssid: string | null
  known: Record<string, Known>
}
export type PhoneNets = Record<string, PhoneNet>

/** One Wi-Fi = one shop or house: keyed by the router's BSSID, else its name, else the router address. */
export const netKey = (w: Pick<PhoneWifi, 'bssid' | 'ssid' | 'gateway'>) => (w.bssid && w.bssid !== '02:00:00:00:00:00' ? w.bssid : null) ?? w.ssid ?? w.gateway ?? 'unknown'

/** A device's id on the phone: its MAC when Android shows it, otherwise its address. */
export const deviceKey = (d: Pick<PhoneDevice, 'ip' | 'mac'>) => d.mac ?? `ip:${d.ip}`

export interface PageDevice {
  ip: string
  mac: string
  vendor: string | null
  name: string | null
  trusted: boolean
  isNew: boolean
  router: boolean
}

/**
 * Folds a phone scan into that Wi-Fi's memory. The first scan of a Wi-Fi marks nothing as new
 * (everything there is assumed to be yours); later scans flag devices first seen in the last 24 hours.
 */
export function mergePhoneScan(nets: PhoneNets, key: string, ssid: string | null, scan: { devices: PhoneDevice[]; me: string; gateway: string | null }, now: number) {
  const net: PhoneNet = { ssid, known: { ...(nets[key]?.known ?? {}) } }
  const first = Object.keys(net.known).length === 0
  const devices: PageDevice[] = scan.devices.map((d) => {
    const k = deviceKey(d)
    const prev = net.known[k]
    const kn: Known = { ...prev, firstSeen: prev?.firstSeen ?? (first ? 0 : now), lastSeen: now }
    net.known[k] = kn
    return {
      ip: d.ip,
      mac: k,
      vendor: d.mac ? vendorOf(d.mac) : null,
      name: kn.name ?? (d.ip === scan.me ? null : d.name),
      trusted: !!kn.trusted,
      isNew: !kn.trusted && kn.firstSeen > 0 && now - kn.firstSeen < 24 * 3600_000,
      router: d.ip === scan.gateway,
    }
  })
  const seen = new Set(devices.map((d) => d.mac))
  const offline = Object.entries(net.known)
    .filter(([k]) => !seen.has(k))
    .map(([mac, kn]) => ({ mac, name: kn.name ?? null, lastSeen: kn.lastSeen }))
  return { nets: { ...nets, [key]: net }, data: { devices, me: [scan.me], offline } }
}

/** Rename or trust a device in one Wi-Fi's memory. */
export function patchKnown(nets: PhoneNets, key: string, dev: string, patch: { name?: string; trusted?: boolean }): PhoneNets {
  const net = nets[key]
  if (!net?.known[dev]) return nets
  return { ...nets, [key]: { ...net, known: { ...net.known, [dev]: { ...net.known[dev], ...patch } } } }
}

const STORE = 'bluechip.phoneNets'
export function loadNets(): PhoneNets {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as PhoneNets
  } catch {
    return {}
  }
}
export function saveNets(n: PhoneNets) {
  try {
    localStorage.setItem(STORE, JSON.stringify(n))
  } catch {
    /* storage full or blocked: the scan still shows, names are just not kept */
  }
}
