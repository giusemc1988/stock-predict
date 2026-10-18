/**
 * Flash the pinned RuView firmware onto a board over USB, in Chrome or Edge on a computer (Web Serial),
 * with Espressif's esptool-js. Loaded only when the button is pressed.
 */
import { ESPLoader, Transport } from 'esptool-js'
import { boardOf, type BoardId } from './ruview'
import { boardFromProbe, checkInner, firmwareUrl, flashMap, flashMB, gunzip, parseSums, sha256Hex, untar } from './webFlash'

export type FlashStep = 'download' | 'check' | 'connect' | 'write' | 'done'
export interface FlashEvents {
  step(s: FlashStep, info?: Record<string, string | number>): void
  progress(pct: number): void
  log(line: string): void
}

export class FlashError extends Error {
  code: 'download' | 'sum' | 'missing' | 'inner' | 'chip' | 'unsupported'
  constructor(code: FlashError['code'], detail = '') {
    super(detail || code)
    this.code = code
  }
}

async function get(asset: string): Promise<Uint8Array> {
  const r = await fetch(firmwareUrl(asset))
  if (!r.ok) throw new FlashError('download', `${asset}: HTTP ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

/** Writes the board's bundle. `want` is the board picked on the page; the chip read over USB has the last word. */
export async function flashBoard(want: BoardId, ev: FlashEvents): Promise<BoardId> {
  type SerialLike = { requestPort(): Promise<ConstructorParameters<typeof Transport>[0]> }
  const serial = (navigator as Navigator & { serial?: SerialLike }).serial
  if (!serial) throw new FlashError('unsupported')

  // pick the port first: the browser only allows the port picker right after the click
  const port = await serial.requestPort()
  const transport = new Transport(port)
  const terminal = { clean() {}, writeLine: (s: string) => ev.log(s), write: (s: string) => ev.log(s) }
  try {
    ev.step('connect')
    const loader = new ESPLoader({ transport, baudrate: 460800, terminal })
    await loader.main()
    const chip = loader.chip.CHIP_NAME
    const size = await loader.detectFlashSize()
    const id = boardFromProbe(chip, flashMB(size))
    if (!id) throw new FlashError('chip', chip)
    // keep the XIAO choice when the chip is a C6; otherwise trust the chip over the page
    const boardId: BoardId = id === 'c6' && want === 'xiao-c6' ? want : id
    const b = boardOf(boardId)
    if (!b?.bundle) throw new FlashError('chip', chip)
    ev.step('download', { chip, size: size ?? '?', file: b.bundle })

    const [sums, gz] = await Promise.all([get('SHA256SUMS.txt'), get(b.bundle)])
    ev.step('check')
    if (parseSums(new TextDecoder().decode(sums)).get(b.bundle) !== (await sha256Hex(gz))) throw new FlashError('sum')
    const files = untar(await gunzip(gz))
    const bad = await checkInner(files)
    if (bad) throw new FlashError(bad)
    const map = flashMap(b, files)
    if (!map) throw new FlashError('missing')

    ev.step('write')
    const total = map.reduce((n, f) => n + f.data.length, 0)
    const before = map.map((_, i) => map.slice(0, i).reduce((n, f) => n + f.data.length, 0))
    await loader.writeFlash({
      fileArray: map.map(({ address, data }) => ({ address, data })),
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (i, written, len) => ev.progress(Math.round(((before[i] + (written / len) * map[i].data.length) / total) * 100)),
    })
    await loader.after('hard_reset')
    ev.step('done', { board: b.label })
    return boardId
  } finally {
    await transport.disconnect().catch(() => {})
  }
}
