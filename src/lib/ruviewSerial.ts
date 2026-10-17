/**
 * RuView's USB serial setup protocol (firmware 0.8.12+, firmware/esp32-csi-node/main/serial_onboarding*.c):
 *   page  → RUVIEW_HELLO_V1 <32 hex nonce>
 *   node  → RUVIEW_HELLO_OK_V1 nonce= chip= version= node_id= target_ip= target_port= configured= device_digest=
 *   page  → RUVIEW_CONFIG_V1 <nonce> <node id 1-255> <private IPv4> <port> <base64 ssid|KEEP> <base64 password|KEEP>
 *   node  → RUVIEW_CONFIG_OK_V1 nonce= node_id= rebooting=1   or   RUVIEW_CONFIG_ERR_V1 reason=...
 * The checks below mirror the firmware's, so a bad value is caught here before it reaches the board.
 */
import { isPrivateIPv4 } from './netParse'

export const SERIAL_BAUD = 115200

export function makeNonce(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export const helloLine = (nonce: string) => `RUVIEW_HELLO_V1 ${nonce}\n`

export interface Hello {
  nonce: string
  chip: string
  version: string
  nodeId: number
  targetIp: string
  targetPort: number
  configured: boolean
}

const fields = (line: string) => Object.fromEntries([...line.matchAll(/(\w+)=(\S*)/g)].map((m) => [m[1], m[2]]))

export function parseHello(line: string): Hello | null {
  if (!line.startsWith('RUVIEW_HELLO_OK_V1 ')) return null
  const f = fields(line)
  return { nonce: f.nonce ?? '', chip: f.chip ?? '', version: f.version ?? '', nodeId: Number(f.node_id ?? 0), targetIp: f.target_ip ?? '', targetPort: Number(f.target_port ?? 0), configured: f.configured === '1' }
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
const printable = (s: string) => [...new TextEncoder().encode(s)].every((c) => c >= 0x20 && c !== 0x7f)

export interface ConfigInput {
  nonce: string
  nodeId: number
  targetIp: string
  targetPort: number
  /** Leave both empty to keep the Wi-Fi the board already has. */
  ssid: string
  password: string
}
export type ConfigError = 'node_id' | 'target_ip' | 'target_port' | 'ssid' | 'password'

export function configLine(c: ConfigInput): { line: string } | { error: ConfigError } {
  if (!Number.isInteger(c.nodeId) || c.nodeId < 1 || c.nodeId > 255) return { error: 'node_id' }
  if (!isPrivateIPv4(c.targetIp)) return { error: 'target_ip' }
  if (!Number.isInteger(c.targetPort) || c.targetPort < 1 || c.targetPort > 65535) return { error: 'target_port' }
  const keep = !c.ssid && !c.password
  if (!keep) {
    const ssidLen = new TextEncoder().encode(c.ssid).length
    const passLen = new TextEncoder().encode(c.password).length
    if (!ssidLen || ssidLen > 32 || !printable(c.ssid)) return { error: 'ssid' }
    if (passLen < 8 || passLen > 63 || !printable(c.password)) return { error: 'password' }
  }
  const wifi = keep ? 'KEEP KEEP' : `${b64(c.ssid)} ${b64(c.password)}`
  return { line: `RUVIEW_CONFIG_V1 ${c.nonce} ${c.nodeId} ${c.targetIp} ${c.targetPort} ${wifi}\n` }
}

export function parseConfigReply(line: string): { ok: true; nodeId: number } | { ok: false; reason: string } | null {
  if (line.startsWith('RUVIEW_CONFIG_OK_V1 ')) return { ok: true, nodeId: Number(fields(line).node_id ?? 0) }
  if (line.startsWith('RUVIEW_CONFIG_ERR_V1 ')) return { ok: false, reason: fields(line).reason ?? 'unknown' }
  return null
}

/** Minimal Web Serial types (Chrome and Edge on a computer); TypeScript's DOM library does not have them yet. */
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}
type SerialApi = { requestPort(): Promise<SerialPortLike> }
export const serialApi = (): SerialApi | null => (navigator as Navigator & { serial?: SerialApi }).serial ?? null

/** One open USB link to a node: send a line, wait for a reply line that matches. */
export class NodeLink {
  private buf = ''
  private lines: string[] = []
  private waiters: (() => void)[] = []
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private port: SerialPortLike
  private constructor(port: SerialPortLike) {
    this.port = port
  }

  static async open(): Promise<NodeLink> {
    const api = serialApi()
    if (!api) throw new Error('no Web Serial')
    const port = await api.requestPort()
    await port.open({ baudRate: SERIAL_BAUD })
    const link = new NodeLink(port)
    void link.pump()
    return link
  }

  private async pump() {
    if (!this.port.readable) return
    this.reader = this.port.readable.getReader()
    const dec = new TextDecoder()
    try {
      for (;;) {
        const { value, done } = await this.reader.read()
        if (done) break
        this.buf += dec.decode(value, { stream: true })
        const parts = this.buf.split('\n')
        this.buf = parts.pop() ?? ''
        for (const p of parts) this.lines.push(p.replace(/\r$/, ''))
        this.waiters.splice(0).forEach((w) => w())
      }
    } catch {
      /* the board rebooted or the cable came out */
    }
  }

  async send(line: string) {
    const w = this.port.writable?.getWriter()
    if (!w) throw new Error('port not writable')
    await w.write(new TextEncoder().encode(line))
    w.releaseLock()
  }

  /** Waits for the first line `pick` accepts, ignoring the board's normal log output. */
  async waitFor<T>(pick: (l: string) => T | null, ms = 4000): Promise<T | null> {
    const end = Date.now() + ms
    for (;;) {
      while (this.lines.length) {
        const v = pick(this.lines.shift() as string)
        if (v) return v
      }
      const left = end - Date.now()
      if (left <= 0) return null
      await new Promise<void>((r) => {
        const t = setTimeout(r, left)
        this.waiters.push(() => {
          clearTimeout(t)
          r()
        })
      })
    }
  }

  async close() {
    await this.reader?.cancel().catch(() => {})
    this.reader?.releaseLock()
    await this.port.close().catch(() => {})
  }
}
