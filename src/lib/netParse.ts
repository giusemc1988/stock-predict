/**
 * Home network helpers shared by the home agent (agent/jarvis-agent.ts) and the Wi-Fi page.
 * Pure functions: they read the text of `arp -a` and `netsh wlan show networks mode=bssid`
 * (or `nmcli`) and never touch the network themselves.
 */

export interface LanDevice {
  ip: string
  mac: string
  vendor: string | null
}

export interface WifiNetwork {
  ssid: string
  bssid: string
  /** 0..100, as Windows reports it. */
  signal: number
  channel: number
  auth: string
}

/** True for addresses that can only be on a home or office network (RFC 1918 and link-local). */
export function isPrivateIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim())
  if (!m) return false
  const [a, b, c, d] = m.slice(1).map(Number)
  if ([a, b, c, d].some((n) => n > 255)) return false
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
}

const normMac = (mac: string) => mac.toLowerCase().replace(/-/g, ':')

/** A few common makers by the first half of the MAC address. Unknown makers stay null rather than guessed. */
const OUI: Record<string, string> = {
  '24:0a:c4': 'Espressif', '30:ae:a4': 'Espressif', '3c:71:bf': 'Espressif', '7c:9e:bd': 'Espressif', 'a4:cf:12': 'Espressif', 'ec:62:60': 'Espressif', '34:85:18': 'Espressif', 'f4:12:fa': 'Espressif',
  'b8:27:eb': 'Raspberry Pi', 'dc:a6:32': 'Raspberry Pi', 'e4:5f:01': 'Raspberry Pi',
  '00:1a:11': 'Google', 'f4:f5:d8': 'Google', '3c:5a:b4': 'Google',
  'f0:18:98': 'Apple', 'a4:83:e7': 'Apple', '3c:22:fb': 'Apple', 'ac:bc:32': 'Apple', '88:66:5a': 'Apple',
  '50:c7:bf': 'TP-Link', '98:da:c4': 'TP-Link', 'b0:be:76': 'TP-Link', 'c0:06:c3': 'TP-Link',
  '00:15:5d': 'Microsoft', '28:18:78': 'Microsoft', '7c:1e:52': 'Microsoft',
  '8c:79:f5': 'Samsung', 'f4:7b:09': 'Samsung', 'cc:6e:a4': 'Samsung',
  'fc:65:de': 'Amazon', '44:65:0d': 'Amazon',
}

export function vendorOf(mac: string): string | null {
  return OUI[normMac(mac).slice(0, 8)] ?? null
}

const isUnicast = (mac: string) => {
  const m = normMac(mac)
  if (m === 'ff:ff:ff:ff:ff:ff' || m === '00:00:00:00:00:00') return false
  return (parseInt(m.slice(0, 2), 16) & 1) === 0 // multicast addresses have the lowest bit of the first byte set
}

/** Devices from `arp -a` on Windows ("192.168.1.1  aa-bb-..  dynamic") or macOS/Linux ("? (192.168.1.1) at aa:bb:.."). */
export function parseArp(text: string): LanDevice[] {
  const out = new Map<string, LanDevice>()
  for (const line of text.split(/\r?\n/)) {
    const win = /^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})\s+dynamic/i.exec(line)
    const nix = /\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f]{1,2}(?::[0-9a-f]{1,2}){5})/i.exec(line)
    const hit = win ?? nix
    if (!hit) continue
    const ip = hit[1]
    const mac = normMac(hit[2]).split(':').map((x) => x.padStart(2, '0')).join(':')
    if (!isPrivateIPv4(ip) || !isUnicast(mac)) continue
    out.set(ip, { ip, mac, vendor: vendorOf(mac) })
  }
  return [...out.values()].sort((a, b) => ipNum(a.ip) - ipNum(b.ip))
}

const ipNum = (ip: string) => ip.split('.').reduce((n, x) => n * 256 + Number(x), 0)

/** Nearby networks from `netsh wlan show networks mode=bssid` (Windows). One row per access point. */
export function parseNetsh(text: string): WifiNetwork[] {
  const out: WifiNetwork[] = []
  let ssid = ''
  let auth = ''
  let cur: WifiNetwork | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    let m: RegExpExecArray | null
    if ((m = /^SSID \d+\s*:\s*(.*)$/i.exec(line))) {
      ssid = m[1].trim()
      auth = ''
    } else if ((m = /^Authentication\s*:\s*(.*)$/i.exec(line))) auth = m[1].trim()
    else if ((m = /^BSSID \d+\s*:\s*([0-9a-f:]{17})$/i.exec(line))) {
      cur = { ssid: ssid || '(hidden)', bssid: m[1].toLowerCase(), signal: 0, channel: 0, auth }
      out.push(cur)
    } else if (cur && (m = /^Signal\s*:\s*(\d+)%$/i.exec(line))) cur.signal = Number(m[1])
    else if (cur && (m = /^Channel\s*:\s*(\d+)$/i.exec(line))) cur.channel = Number(m[1])
  }
  return out
}

/** Nearby networks from `nmcli -t -f SSID,BSSID,SIGNAL,CHAN,SECURITY dev wifi` (Linux). */
export function parseNmcli(text: string): WifiNetwork[] {
  const out: WifiNetwork[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    // nmcli escapes ':' inside fields as '\:'
    const f = line.split(/(?<!\\):/).map((x) => x.replace(/\\:/g, ':'))
    if (f.length < 5) continue
    out.push({ ssid: f[0] || '(hidden)', bssid: f[1].toLowerCase(), signal: Number(f[2]) || 0, channel: Number(f[3]) || 0, auth: f[4] || 'Open' })
  }
  return out
}

export interface ChannelTip {
  /** How crowded each of channels 1-13 is, from the signal of every network that overlaps it. */
  load: Record<number, number>
  best: 1 | 6 | 11
  current: number | null
  /** True when moving to `best` is clearly better than the current channel. */
  shouldMove: boolean
}

/** Suggests the quietest of channels 1, 6 and 11 on 2.4 GHz, leaving out your own network. */
export function channelTip(nets: WifiNetwork[], ownSsid: string | null): ChannelTip {
  const load: Record<number, number> = {}
  for (let c = 1; c <= 13; c++) load[c] = 0
  let current: number | null = null
  for (const n of nets) {
    if (n.channel < 1 || n.channel > 13) continue
    if (ownSsid && n.ssid === ownSsid) {
      current ??= n.channel
      continue
    }
    // a 20 MHz 2.4 GHz channel overlaps two channels either side
    for (let c = n.channel - 2; c <= n.channel + 2; c++) if (c >= 1 && c <= 13) load[c] += n.signal * (c === n.channel ? 1 : 0.5)
  }
  const best = ([1, 6, 11] as const).reduce((a, b) => (load[b] < load[a] ? b : a))
  const shouldMove = current != null && current !== best && load[current] - load[best] >= 40
  return { load, best, current, shouldMove }
}
