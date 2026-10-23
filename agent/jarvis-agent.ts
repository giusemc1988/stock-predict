/**
 * Jarvis home agent: a small server on your own PC that lets the Wi-Fi page see your home network.
 *
 *   npm run agent            (Windows, macOS or Linux; Node 20+)
 *
 * What it does, for YOUR network only:
 *   - lists devices on your LAN (ARP table, after a light wake-up of the local /24)
 *   - lists the Wi-Fi networks your PC already sees, with channels (Windows netsh, Linux nmcli)
 *   - ping, open-port check and Wake-on-LAN, only for private addresses (192.168.x.x, 10.x, 172.16-31.x)
 *   - a download/upload speed test against speed.cloudflare.com
 *   - aircraft relay for Argus: fetches the free adsb.lol / adsb.fi feeds from this home IP (they refuse cloud servers)
 *   - RuView sensing: passes a few read-only calls to the RuView server on this PC (npm run ruview) and keeps the node list
 * It never captures traffic, never joins or attacks other networks, and only listens on 127.0.0.1.
 * Reach it from the app through a Cloudflare Tunnel behind Cloudflare Access (see agent/README.md).
 */
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import dgram from 'node:dgram'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import { join } from 'node:path'
import { isPrivateIPv4, parseArp, parseNetsh, parseNmcli, type LanDevice } from '../src/lib/netParse'
import { boardOf, RUVIEW_IMAGE, type RegistryNode } from '../src/lib/ruview'

const VERSION = '1.2.0'
const PORT = Number(process.env.AGENT_PORT ?? 8787)
const HOME = process.env.AGENT_HOME ?? join(os.homedir(), '.jarvis-agent')
const ORIGINS = (process.env.AGENT_ORIGINS ?? 'https://stock-predict.chanhmn1011.workers.dev,http://localhost:5173').split(',').map((s) => s.trim())
const PORTS = [21, 22, 23, 53, 80, 443, 445, 554, 1883, 3389, 5000, 5353, 8000, 8008, 8009, 8080, 8443, 9100]

function loadJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(HOME, name), 'utf8')) as T
  } catch {
    return fallback
  }
}
const saveJson = (name: string, v: unknown) => writeFileSync(join(HOME, name), JSON.stringify(v, null, 2))

/** The token the app sends; made once and kept in ~/.jarvis-agent/token. */
function token(): string {
  if (process.env.AGENT_TOKEN) return process.env.AGENT_TOKEN
  const file = join(HOME, 'token')
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const t = randomBytes(24).toString('base64url')
  writeFileSync(file, t)
  return t
}

const run = (cmd: string, args: string[], timeout = 15000) =>
  new Promise<string>((resolve) => execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 4 << 20 }, (_e, out) => resolve(String(out ?? ''))))

/** This PC's own IPv4 addresses on private networks. */
function myIps(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal && isPrivateIPv4(i.address))
    .map((i) => i.address)
}

/** Sends one tiny UDP packet to every address of the local /24 so the ARP table fills in. Nothing listens on port 9; no data is read. */
async function wakeSubnet() {
  const sock = dgram.createSocket('udp4')
  for (const ip of myIps()) {
    const base = ip.split('.').slice(0, 3).join('.')
    for (let h = 1; h < 255; h++) sock.send(Buffer.alloc(1), 9, `${base}.${h}`, () => {})
  }
  await new Promise((r) => setTimeout(r, 1500))
  sock.close()
}

type Known = Record<string, { name?: string; trusted?: boolean; firstSeen: number; lastSeen: number }>

async function devices(sweep: boolean) {
  if (sweep) await wakeSubnet()
  const list: LanDevice[] = parseArp(await run('arp', ['-a']))
  const known = loadJson<Known>('known.json', {})
  const firstRun = Object.keys(known).length === 0
  const now = Date.now()
  const mine = myIps()
  const out = list.map((d) => {
    const k = (known[d.mac] ??= { firstSeen: firstRun ? 0 : now, lastSeen: now })
    k.lastSeen = now
    return { ...d, name: k.name ?? null, trusted: !!k.trusted, isNew: !k.trusted && k.firstSeen > 0 && now - k.firstSeen < 24 * 3600_000, router: /\.1$/.test(d.ip) }
  })
  saveJson('known.json', known)
  return { devices: out, me: mine, offline: Object.entries(known).filter(([mac]) => !list.some((d) => d.mac === mac)).map(([mac, k]) => ({ mac, name: k.name ?? null, lastSeen: k.lastSeen })) }
}

async function wifi() {
  const p = os.platform()
  if (p === 'win32') {
    const [nets, iface] = await Promise.all([run('netsh', ['wlan', 'show', 'networks', 'mode=bssid']), run('netsh', ['wlan', 'show', 'interfaces'])])
    const ssid = /^\s*SSID\s*:\s*(.+)$/im.exec(iface)?.[1]?.trim() ?? null
    return { supported: true, ssid, networks: parseNetsh(nets) }
  }
  if (p === 'linux') {
    const [nets, act] = await Promise.all([run('nmcli', ['-t', '-f', 'SSID,BSSID,SIGNAL,CHAN,SECURITY', 'dev', 'wifi']), run('nmcli', ['-t', '-f', 'ACTIVE,SSID', 'dev', 'wifi'])])
    const ssid = act.split('\n').find((l) => l.startsWith('yes:'))?.slice(4) ?? null
    return { supported: true, ssid, networks: parseNmcli(nets) }
  }
  return { supported: false, ssid: null, networks: [] }
}

async function ping(host: string) {
  const win = os.platform() === 'win32'
  const out = await run('ping', win ? ['-n', '4', '-w', '1000', host] : ['-c', '4', '-W', '1', host])
  const times = [...out.matchAll(/time[=<]\s*([\d.]+)\s*ms/gi)].map((m) => Number(m[1]))
  return { host, sent: 4, received: times.length, avgMs: times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10 : null }
}

const probe = (ip: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect({ host: ip, port, timeout: 700 })
    const done = (open: boolean) => {
      s.destroy()
      resolve(open)
    }
    s.once('connect', () => done(true))
    s.once('timeout', () => done(false))
    s.once('error', () => done(false))
  })

async function ports(ip: string) {
  const res = await Promise.all(PORTS.map(async (p) => ({ port: p, open: await probe(ip, p) })))
  return { ip, open: res.filter((r) => r.open).map((r) => r.port), checked: PORTS }
}

function wol(mac: string) {
  const hex = mac.toLowerCase().replace(/[^0-9a-f]/g, '')
  if (hex.length !== 12) throw new Error('bad MAC')
  const pkt = Buffer.concat([Buffer.alloc(6, 0xff), ...Array.from({ length: 16 }, () => Buffer.from(hex, 'hex'))])
  return new Promise<void>((resolve, reject) => {
    const s = dgram.createSocket('udp4')
    s.bind(() => {
      s.setBroadcast(true)
      s.send(pkt, 9, '255.255.255.255', (e) => {
        s.close()
        if (e) reject(e)
        else resolve()
      })
    })
  })
}

async function speed() {
  const t0 = performance.now()
  const down = await fetch('https://speed.cloudflare.com/__down?bytes=20000000')
  const bytes = (await down.arrayBuffer()).byteLength
  const t1 = performance.now()
  const up = Buffer.alloc(5_000_000)
  await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body: up })
  const t2 = performance.now()
  const p0 = performance.now()
  await fetch('https://speed.cloudflare.com/__down?bytes=0')
  const latency = performance.now() - p0
  return { downMbps: Math.round(((bytes * 8) / ((t1 - t0) / 1000) / 1e6) * 10) / 10, upMbps: Math.round(((up.length * 8) / ((t2 - t1) / 1000) / 1e6) * 10) / 10, pingMs: Math.round(latency) }
}

const RUVIEW_URL = process.env.RUVIEW_URL ?? `http://127.0.0.1:${process.env.RUVIEW_PORT ?? 3000}`
/** Read-only RuView calls the page may make, and where they go upstream. */
const RUVIEW_ROUTES: Record<string, string> = {
  latest: '/api/v1/sensing/latest',
  nodes: '/api/v1/nodes',
  vitals: '/api/v1/vital-signs',
}

/** RuView's API token: written by npm run ruview to ~/.jarvis-agent/ruview-token. */
function ruviewToken(): string {
  if (process.env.RUVIEW_API_TOKEN) return process.env.RUVIEW_API_TOKEN
  try {
    return readFileSync(join(HOME, 'ruview-token'), 'utf8').trim()
  } catch {
    return ''
  }
}

async function ruviewGet(path: string): Promise<unknown> {
  const r = await fetch(`${RUVIEW_URL}${path}`, { headers: { authorization: `Bearer ${ruviewToken()}` }, signal: AbortSignal.timeout(5000) })
  if (!r.ok) throw new Error(`RuView ${r.status}`)
  return r.json()
}

/** Is the RuView server up, which version, and is the container on the pinned image? */
async function ruviewStatus() {
  const image = (await run('docker', ['inspect', '-f', '{{.Config.Image}}', 'jarvis-ruview'], 8000)).trim() || null
  try {
    const [ready, ver] = (await Promise.all([ruviewGet('/health/ready'), ruviewGet('/health/version')])) as [Record<string, unknown>, Record<string, unknown>]
    return { up: true, source: ready.source ?? null, waiting: !!ready.waiting_for_frames, version: ver.version ?? null, image, pinned: RUVIEW_IMAGE }
  } catch (e) {
    return { up: false, why: e instanceof Error ? e.message : String(e), image, pinned: RUVIEW_IMAGE }
  }
}

function saveNode(b: Record<string, unknown>) {
  const reg = loadJson<RegistryNode[]>('ruview-nodes.json', [])
  if (typeof b.remove === 'number') return saveJson('ruview-nodes.json', reg.filter((n) => n.id !== b.remove))
  const n = b.node as Partial<RegistryNode> | undefined
  const id = Number(n?.id)
  if (!n || !Number.isInteger(id) || id < 1 || id > 255) throw new Error('node id must be 1-255')
  const clean: RegistryNode = {
    id,
    room: String(n.room ?? '').slice(0, 40),
    board: boardOf(String(n.board))?.id ?? 's3-8mb',
    antenna: n.antenna === 'external' ? 'external' : 'internal',
    firmware: n.firmware ? String(n.firmware).slice(0, 20) : undefined,
    added: Number(n.added) || Date.now(),
  }
  saveJson('ruview-nodes.json', [...reg.filter((x) => x.id !== id), clean].sort((a, c) => a.id - c.id))
}

/** Public aircraft data for the Argus globe, fetched from this PC's home IP. Kept 10 s so many viewers make one request. */
const air = new Map<string, { at: number; data: unknown }>()
async function aircraft(kind: 'flights' | 'military', lat: number, lon: number) {
  const near = (host: string) => `https://${host}/v2/lat/${lat}/lon/${lon}/dist/250`
  const urls = kind === 'military' ? ['https://api.adsb.lol/v2/mil', 'https://opendata.adsb.fi/api/v2/mil'] : [near('api.adsb.lol'), near('opendata.adsb.fi/api')]
  const key = urls[0]
  const hit = air.get(key)
  if (hit && Date.now() - hit.at < 10_000) return hit.data
  const why: string[] = []
  for (const u of urls) {
    const r = await fetch(u, { headers: { accept: 'application/json', 'user-agent': `jarvis-agent/${VERSION}` }, signal: AbortSignal.timeout(8000) }).catch((e: Error) => (why.push(e.name), null))
    if (r && !r.ok) why.push(`${new URL(u).host} HTTP ${r.status}`)
    if (!r?.ok) continue
    const data = await r.json()
    if (air.size > 100) air.clear()
    air.set(key, { at: Date.now(), data })
    return data
  }
  throw new Error(`aircraft feeds refused: ${why.join(', ')}`)
}

async function body(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let s = ''
  for await (const c of req) {
    s += c
    if (s.length > 10_000) throw new Error('body too large')
  }
  return s ? (JSON.parse(s) as Record<string, unknown>) : {}
}

export function start() {
  mkdirSync(HOME, { recursive: true })
  const TOKEN = token()
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin ?? ''
    if (ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }
    if (req.method === 'OPTIONS') return res.writeHead(204).end()
    const send = (code: number, v: unknown) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(v))
    const url = new URL(req.url ?? '/', 'http://agent')
    try {
      if (url.pathname === '/api/health') return send(200, { ok: true, version: VERSION, platform: os.platform(), host: os.hostname() })
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'wrong or missing token' })
      if (url.pathname === '/api/devices' && req.method === 'GET') return send(200, await devices(url.searchParams.get('sweep') === '1'))
      if (url.pathname === '/api/devices' && req.method === 'POST') {
        const b = await body(req)
        const mac = String(b.mac ?? '').toLowerCase()
        const known = loadJson<Known>('known.json', {})
        if (!known[mac]) return send(404, { error: 'unknown device' })
        if (typeof b.name === 'string') known[mac].name = b.name.slice(0, 40)
        if (typeof b.trusted === 'boolean') known[mac].trusted = b.trusted
        saveJson('known.json', known)
        return send(200, { ok: true })
      }
      if (url.pathname === '/api/wifi') return send(200, await wifi())
      const ip = url.searchParams.get('ip') ?? ''
      if (url.pathname === '/api/ping' || url.pathname === '/api/ports') {
        if (!isPrivateIPv4(ip)) return send(400, { error: 'only addresses on your home network are allowed' })
        return send(200, url.pathname === '/api/ping' ? await ping(ip) : await ports(ip))
      }
      if (url.pathname === '/api/wol' && req.method === 'POST') {
        await wol(String((await body(req)).mac ?? ''))
        return send(200, { ok: true })
      }
      if (url.pathname === '/api/speed') return send(200, await speed())
      if (url.pathname === '/api/flights' || url.pathname === '/api/military') {
        const lat = Math.round(Number(url.searchParams.get('lat') ?? 0) * 4) / 4
        const lon = Math.round(Number(url.searchParams.get('lon') ?? 0) * 4) / 4
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return send(400, { error: 'bad lat/lon' })
        return send(200, await aircraft(url.pathname === '/api/military' ? 'military' : 'flights', lat, lon))
      }
      if (url.pathname === '/api/ruview/status') return send(200, await ruviewStatus())
      if (url.pathname === '/api/ruview/registry' && req.method === 'GET') return send(200, { nodes: loadJson<RegistryNode[]>('ruview-nodes.json', []), me: myIps() })
      if (url.pathname === '/api/ruview/registry' && req.method === 'POST') {
        try {
          saveNode(await body(req))
        } catch (e) {
          return send(400, { error: e instanceof Error ? e.message : String(e) })
        }
        return send(200, { ok: true })
      }
      const up = RUVIEW_ROUTES[url.pathname.replace('/api/ruview/', '')]
      if (url.pathname.startsWith('/api/ruview/') && up && req.method === 'GET') {
        // RuView being off is not an agent failure: answer 200 so the page can tell the two apart
        return send(200, await ruviewGet(up).catch((e: unknown) => ({ down: true, why: e instanceof Error ? e.message : String(e) })))
      }
      return send(404, { error: 'not found' })
    } catch (e) {
      return send(500, { error: e instanceof Error ? e.message : String(e) })
    }
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Jarvis home agent ${VERSION} on http://127.0.0.1:${PORT}`)
    console.log(`Token (paste it in the app: Wi-Fi page > Connect home agent): ${TOKEN}`)
    console.log(`Allowed app addresses: ${ORIGINS.join(', ')}`)
  })
  return server
}

start()
