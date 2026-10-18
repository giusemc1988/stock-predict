/**
 * Flashing a RuView node from the browser: the pure parts (which bundle, unpacking, checks, flash map).
 * The pinned release's bundle comes through the Worker (/api/firmware, GitHub downloads have no CORS),
 * is checked against the release's SHA256SUMS.txt and the sums file inside it, then written by
 * webFlashRun.ts with esptool-js at the offsets from RuView's firmware README.
 */
import { BOARDS, RUVIEW, type Board, type BoardId } from './ruview'

/** The only files /api/firmware will fetch, all from the pinned release. */
export const FIRMWARE_ASSETS = ['SHA256SUMS.txt', ...new Set(BOARDS.flatMap((b) => (b.bundle ? [b.bundle] : [])))]

export const firmwareUrl = (asset: string, release = RUVIEW.release) => `/api/firmware/${release}/${asset}`

/** GitHub download URL for an allowed asset of the pinned release, else null (the Worker's allow-list). */
export function upstreamAsset(path: string, release = RUVIEW.release, upstream = RUVIEW.upstream): string | null {
  const [rel, asset, ...rest] = path.split('/')
  if (rest.length || rel !== release || !FIRMWARE_ASSETS.includes(asset)) return null
  return `${upstream}/releases/download/${rel}/${asset}`
}

/**
 * The board from what esptool reads off the chip: name (ESP32-S3, ESP32-C6, ESP32...) and flash size.
 * null = RuView has no firmware for this chip (the original ESP32, C3...).
 */
export function boardFromProbe(chipName: string, flashMB: number | null): BoardId | null {
  const n = chipName.toUpperCase()
  if (n.startsWith('ESP32-S3')) return flashMB !== null && flashMB < 8 ? 's3-4mb' : 's3-8mb'
  if (n.startsWith('ESP32-C6')) return 'c6'
  return null
}

/** "16MB" → 16, "512KB" → 0.5. */
export function flashMB(size: string | undefined | null): number | null {
  const m = /^(\d+)(KB|MB)/i.exec(size ?? '')
  if (!m) return null
  return m[2].toUpperCase() === 'KB' ? Number(m[1]) / 1024 : Number(m[1])
}

export function parseSums(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(?:\.\/)?(\S+)\s*$/i.exec(line.trim())
    if (m) out.set(m[2], m[1].toLowerCase())
  }
  return out
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}

/** Regular files of a (ustar) tar, keyed by name without a leading "./". */
export function untar(tar: Uint8Array): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>()
  const dec = new TextDecoder()
  const str = (o: number, n: number) => dec.decode(tar.subarray(o, o + n)).replace(/\0.*$/s, '')
  for (let off = 0; off + 512 <= tar.length; ) {
    const name = str(off, 100)
    if (!name) break
    const prefix = str(off + 345, 155)
    const size = parseInt(str(off + 124, 12).trim() || '0', 8)
    const type = str(off + 156, 1)
    const full = (prefix ? `${prefix}/${name}` : name).replace(/^\.\//, '')
    if ((type === '0' || type === '') && full) out.set(full, tar.slice(off + 512, off + 512 + size))
    off += 512 + Math.ceil(size / 512) * 512
  }
  return out
}

export type BundleError = 'sum' | 'missing' | 'inner'

/** Checks every file against the SHA256SUMS.txt inside the bundle. */
export async function checkInner(files: Map<string, Uint8Array>): Promise<BundleError | null> {
  const sums = files.get('SHA256SUMS.txt')
  if (!sums) return 'missing'
  for (const [name, want] of parseSums(new TextDecoder().decode(sums))) {
    const f = files.get(name)
    if (!f) return 'missing'
    if ((await sha256Hex(f)) !== want) return 'inner'
  }
  return null
}

/** What goes where: RuView's README offsets (bootloader 0x0, partition table 0x8000, OTA data 0xf000, app 0x20000). */
export function flashMap(b: Board, files: Map<string, Uint8Array>): { address: number; data: Uint8Array; name: string }[] | null {
  if (!b.app || !b.table) return null
  const plan = [
    { address: 0x0, name: 'bootloader.bin' },
    { address: 0x8000, name: b.table },
    { address: 0xf000, name: 'ota_data_initial.bin' },
    { address: 0x20000, name: b.app },
  ]
  const out = plan.map((p) => ({ ...p, data: files.get(p.name) as Uint8Array }))
  return out.every((p) => p.data?.length) ? out : null
}
