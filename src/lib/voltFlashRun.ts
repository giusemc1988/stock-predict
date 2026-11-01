/**
 * Volt: talks to the connected ESP32 over Web Serial (Chrome/Edge on a computer), using esptool-js.
 * Loaded only when the user connects. Probing never writes; flashing only runs after voltFlash.ts's
 * checks pass on the browser side.
 */
import { ESPLoader, Transport } from 'esptool-js'
import type { FlashPart } from './voltFlash'

export class VoltError extends Error {
  code: 'unsupported' | 'connect' | 'chip'
  constructor(code: VoltError['code'], detail = '') {
    super(detail || code)
    this.code = code
  }
}

export interface BoardProbe {
  chipName: string
  flashSizeMB: number | null
  mac: string | null
  features: string
}

type SerialLike = { requestPort(): Promise<ConstructorParameters<typeof Transport>[0]> }

/** Opens the port (must run right after a click) and connects esptool's ROM loader. Caller disconnects when done. */
export async function connect(onLog: (line: string) => void): Promise<{ loader: ESPLoader; transport: Transport }> {
  const serial = (navigator as Navigator & { serial?: SerialLike }).serial
  if (!serial) throw new VoltError('unsupported')
  const port = await serial.requestPort()
  const transport = new Transport(port)
  const terminal = { clean() {}, writeLine: onLog, write: onLog }
  const loader = new ESPLoader({ transport, baudrate: 460800, terminal })
  await loader.main()
  return { loader, transport }
}

/** Chip name, real flash size, MAC and feature string read off the board — no write happens here. */
export async function probe(loader: ESPLoader): Promise<BoardProbe> {
  const chipName = loader.chip.CHIP_NAME
  const sizeStr = await loader.detectFlashSize()
  const m = /^(\d+)(KB|MB)/i.exec(sizeStr ?? '')
  const flashSizeMB = m ? (m[2].toUpperCase() === 'KB' ? Number(m[1]) / 1024 : Number(m[1])) : null
  let mac: string | null = null
  try {
    mac = await loader.chip.readMac(loader)
  } catch {
    mac = null
  }
  let features = ''
  try {
    features = (await loader.chip.getChipFeatures(loader)).join(', ')
  } catch {
    features = ''
  }
  return { chipName, flashSizeMB, mac, features }
}

export type VoltStep = 'connect' | 'write' | 'done'
export interface VoltEvents {
  step(s: VoltStep): void
  progress(pct: number): void
  log(line: string): void
}

/** Writes exactly the parts the page's checks already passed (voltFlash.checkParts -> canFlash). */
export async function flashParts(loader: ESPLoader, parts: FlashPart[], ev: VoltEvents): Promise<void> {
  ev.step('write')
  const total = parts.reduce((n, p) => n + p.data.length, 0)
  const before = parts.map((_, i) => parts.slice(0, i).reduce((n, p) => n + p.data.length, 0))
  await loader.writeFlash({
    fileArray: parts.map(({ address, data }) => ({ address, data })),
    flashMode: 'keep',
    flashFreq: 'keep',
    flashSize: 'keep',
    eraseAll: false,
    compress: true,
    reportProgress: (i, written, len) => ev.progress(Math.round(((before[i] + (written / len) * parts[i].data.length) / total) * 100)),
  })
  await loader.after('hard_reset')
  ev.step('done')
}

/** Reads the whole chip's flash back, for the optional "Sao lưu board trước" button. */
export async function backupFlash(loader: ESPLoader, sizeMB: number, onProgress: (pct: number) => void): Promise<Uint8Array> {
  const size = sizeMB * 1024 * 1024
  return loader.readFlash(0, size, (_packet, progress, totalSize) => onProgress(Math.round((progress / totalSize) * 100)))
}
