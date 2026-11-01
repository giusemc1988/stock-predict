/**
 * Volt: nạp firmware an toàn cho mọi board ESP32, từ link repo GitHub hoặc file .bin thả vào trình duyệt.
 * Pure parts only: đọc header ảnh ESP (esptool's binary image format), khớp chip, tính offset bootloader,
 * kiểm tra chồng lấn. voltFlashRun.ts dùng các hàm này trước khi cho phép ghi vào board.
 * Header format: https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/firmware-image-format.html
 */

/** esp_image_header_t chip_id values (the ones RuView/Volt's boards can be). */
export const CHIP_ID_NAME: Record<number, string> = {
  0: 'ESP32',
  2: 'ESP32-S2',
  5: 'ESP32-C3',
  9: 'ESP32-S3',
  12: 'ESP32-C2',
  13: 'ESP32-C6',
  16: 'ESP32-H2',
}

/** Bootloader must sit here for each chip family (esp-idf default partition offsets). */
export const BOOTLOADER_OFFSET: Record<string, number> = {
  'ESP32': 0x1000,
  'ESP32-S2': 0x1000,
  'ESP32-S3': 0x0,
  'ESP32-C2': 0x0,
  'ESP32-C3': 0x0,
  'ESP32-C6': 0x0,
  'ESP32-H2': 0x0,
}

export interface ImageHeader {
  magic: number
  segmentCount: number
  flashMode: number
  flashSizeMB: number | null
  chipId: number | null
  chipName: string | null
}

/** Reads the 8-byte base header, and the 16-byte esp-idf extension when present (chip_id at byte 14). */
export function parseImageHeader(data: Uint8Array): ImageHeader | null {
  if (data.length < 8) return null
  const magic = data[0]
  if (magic !== 0xe9) return null
  const segmentCount = data[1]
  const flashMode = data[2]
  const sizeNibble = (data[3] >> 4) & 0xf
  const flashSizeMB = sizeNibble <= 7 ? 2 ** sizeNibble : null
  let chipId: number | null = null
  if (data.length >= 24) {
    chipId = data[14] | (data[15] << 8)
  }
  return { magic, segmentCount, flashMode, flashSizeMB, chipId, chipName: chipId !== null ? (CHIP_ID_NAME[chipId] ?? null) : null }
}

export interface FlashPart {
  name: string
  address: number
  data: Uint8Array
  /** true when this part's bytes look like an ESP image (magic 0xE9: bootloader or app, not a raw partition table). */
  isImage: boolean
  header: ImageHeader | null
}

export function describePart(name: string, address: number, data: Uint8Array): FlashPart {
  const header = data.length >= 8 && data[0] === 0xe9 ? parseImageHeader(data) : null
  return { name, address, data, isImage: header !== null, header }
}

export type CheckLevel = 'ok' | 'warn' | 'bad'
export interface CheckResult {
  key: string
  level: CheckLevel
  /** VI text shown on the page; EN kept in a short code the caller can map. */
  detail: string
}

/**
 * Every rule that must pass before the Flash button unlocks. `want` = the chip the board probe found
 * (null = not connected yet, checks still run against the files alone). `flashSizeMB` = real flash on the board.
 */
export function checkParts(parts: FlashPart[], want: { chipName: string | null; flashSizeMB: number | null } | null): CheckResult[] {
  const out: CheckResult[] = []
  if (!parts.length) return [{ key: 'empty', level: 'bad', detail: 'Chưa có file nào' }]

  const images = parts.filter((p) => p.isImage)
  out.push(images.length ? { key: 'magic', level: 'ok', detail: `Magic 0xE9 đúng trên ${images.length} file` } : { key: 'magic', level: 'bad', detail: 'Không file nào có magic 0xE9 (không phải ảnh ESP hợp lệ)' })

  if (want?.chipName) {
    const mismatched = images.filter((p) => p.header?.chipName && p.header.chipName !== want.chipName)
    out.push(mismatched.length ? { key: 'chip', level: 'bad', detail: `${mismatched.map((p) => p.name).join(', ')} đóng gói cho ${mismatched[0].header?.chipName}, board đang là ${want.chipName}` } : { key: 'chip', level: 'ok', detail: `Chip khớp ${want.chipName}` })
  }

  if (want?.flashSizeMB) {
    const tooBig = images.filter((p) => p.header?.flashSizeMB && p.header.flashSizeMB > (want.flashSizeMB as number))
    out.push(tooBig.length ? { key: 'size', level: 'warn', detail: `${tooBig.map((p) => p.name).join(', ')} ghi cho flash ${tooBig[0].header?.flashSizeMB} MB, board chỉ có ${want.flashSizeMB} MB` } : { key: 'size', level: 'ok', detail: `Vừa ${want.flashSizeMB} MB` })
    const totalEnd = Math.max(0, ...parts.map((p) => p.address + p.data.length))
    out.push(totalEnd > want.flashSizeMB * 1024 * 1024 ? { key: 'total', level: 'bad', detail: 'Tổng dung lượng vượt quá flash thật của board' } : { key: 'total', level: 'ok', detail: 'Tổng dung lượng vừa flash' })
  }

  const sorted = [...parts].sort((a, b) => a.address - b.address)
  const overlaps: string[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    if (prev.address + prev.data.length > sorted[i].address) overlaps.push(`${prev.name} chồng lên ${sorted[i].name}`)
  }
  out.push(overlaps.length ? { key: 'overlap', level: 'bad', detail: overlaps.join('; ') } : { key: 'overlap', level: 'ok', detail: 'Không chồng lấn offset' })

  if (want?.chipName) {
    const expected = BOOTLOADER_OFFSET[want.chipName]
    const bootloaders = parts.filter((p) => /bootloader/i.test(p.name))
    if (bootloaders.length && expected !== undefined) {
      const wrong = bootloaders.filter((p) => p.address !== expected)
      out.push(wrong.length ? { key: 'boot', level: 'warn', detail: `Bootloader nên ở 0x${expected.toString(16)} cho ${want.chipName}, đang để 0x${wrong[0].address.toString(16)}` } : { key: 'boot', level: 'ok', detail: 'Offset bootloader đúng' })
    }
  }

  return out
}

/** The Flash button unlocks only when nothing is 'bad' and there is at least one 'ok'. */
export function canFlash(checks: CheckResult[]): boolean {
  return checks.length > 0 && checks.every((c) => c.level !== 'bad') && checks.some((c) => c.level === 'ok')
}

/** Guesses a part's name/offset from its filename, for the drag-and-drop path (editable afterwards). */
export function guessOffset(filename: string, chipName: string | null): number {
  const n = filename.toLowerCase()
  if (n.includes('bootloader')) return (chipName ? BOOTLOADER_OFFSET[chipName] : undefined) ?? 0x0
  if (n.includes('partition')) return 0x8000
  if (n.includes('ota_data') || n.includes('otadata')) return 0xf000
  return 0x10000
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function parseSums(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(?:\.\/)?(\S+)\s*$/i.exec(line.trim())
    if (m) out.set(m[2], m[1].toLowerCase())
  }
  return out
}

/** ESP Web Tools manifest.json shape (a release asset points flash offsets at named files). */
export interface WebToolsManifest {
  builds?: { chipFamily?: string; parts?: { path: string; offset: number }[] }[]
}

export function partsFromManifest(m: WebToolsManifest): { path: string; offset: number }[] | null {
  const build = m.builds?.[0]
  if (!build?.parts?.length) return null
  return build.parts.filter((p) => typeof p.path === 'string' && typeof p.offset === 'number')
}

/** Only github.com/api.github.com/objects.githubusercontent.com hosts are ever fetched for Volt releases. */
export function allowedReleaseHost(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return h === 'github.com' || h === 'api.github.com' || h.endsWith('.githubusercontent.com')
  } catch {
    return false
  }
}

/** "owner/repo" or a full github.com URL -> {owner, repo}. */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '')
  const m = /^([\w.-]+)\/([\w.-]+)/.exec(s)
  return m ? { owner: m[1], repo: m[2] } : null
}
