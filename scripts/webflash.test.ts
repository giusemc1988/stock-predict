import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { boardOf } from '../src/lib/ruview'
import { boardFromProbe, checkInner, FIRMWARE_ASSETS, firmwareUrl, flashMap, flashMB, gunzip, parseSums, sha256Hex, untar, upstreamAsset } from '../src/lib/webFlash'

// the Worker fetches only the pinned release's bundles and sums
assert.deepEqual(FIRMWARE_ASSETS, ['SHA256SUMS.txt', 'esp32-csi-node-firmware-8mb.tar.gz', 'esp32-csi-node-firmware-4mb.tar.gz', 'esp32-csi-node-firmware-c6-4mb.tar.gz'])
assert.equal(upstreamAsset('v0.8.14-esp32/esp32-csi-node-firmware-8mb.tar.gz', 'v0.8.14-esp32', 'https://github.com/ruvnet/ruview'), 'https://github.com/ruvnet/ruview/releases/download/v0.8.14-esp32/esp32-csi-node-firmware-8mb.tar.gz')
assert.equal(upstreamAsset('v0.8.13-esp32/esp32-csi-node-firmware-8mb.tar.gz', 'v0.8.14-esp32'), null)
assert.equal(upstreamAsset('v0.8.14-esp32/evil.bin', 'v0.8.14-esp32'), null)
assert.equal(upstreamAsset('v0.8.14-esp32/../x/SHA256SUMS.txt', 'v0.8.14-esp32'), null)
assert.equal(upstreamAsset('v0.8.14-esp32/SHA256SUMS.txt/x', 'v0.8.14-esp32'), null)
assert.equal(firmwareUrl('SHA256SUMS.txt', 'v1'), '/api/firmware/v1/SHA256SUMS.txt')

// chip read over USB → board; Chanh's boards: S3-N16R8 (16MB), original ESP32-WROOM-32E (no firmware)
assert.equal(boardFromProbe('ESP32-S3', 16), 's3-8mb')
assert.equal(boardFromProbe('ESP32-S3', 8), 's3-8mb')
assert.equal(boardFromProbe('ESP32-S3', 4), 's3-4mb')
assert.equal(boardFromProbe('ESP32-S3', null), 's3-8mb')
assert.equal(boardFromProbe('ESP32-C6', 4), 'c6')
assert.equal(boardFromProbe('ESP32', 4), null)
assert.equal(boardFromProbe('ESP32-C3', 4), null)
assert.equal(flashMB('16MB'), 16)
assert.equal(flashMB('512KB'), 0.5)
assert.equal(flashMB(undefined), null)

// sums file: plain, "./" and "*" forms
const sums = parseSums('31b25068aad34a119047aaf9b6c2580693fe3017bf4ad4c2f682b731fef01474  esp32-csi-node-firmware-8mb.tar.gz\nAF0C015A6470CA542B68D7084A55652BEE7798013D87487CD05FAC1484A25980 *./version.txt\njunk\n')
assert.equal(sums.get('esp32-csi-node-firmware-8mb.tar.gz'), '31b25068aad34a119047aaf9b6c2580693fe3017bf4ad4c2f682b731fef01474')
assert.equal(sums.get('version.txt'), 'af0c015a6470ca542b68d7084a55652bee7798013d87487cd05fac1484a25980')
assert.equal(await sha256Hex(new TextEncoder().encode('0.8.14\n')), 'af0c015a6470ca542b68d7084a55652bee7798013d87487cd05fac1484a25980')

// a tar shaped like the release bundle (GNU tar, "./" names)
function tar(files: [string, Uint8Array][]): Uint8Array {
  const blocks: Uint8Array[] = []
  const header = (name: string, size: number, type: string) => {
    const h = new Uint8Array(512)
    const put = (s: string, o: number) => h.set(new TextEncoder().encode(s), o)
    put(name, 0)
    put('0000644\0', 100)
    put(size.toString(8).padStart(11, '0') + '\0', 124)
    put(type, 156)
    put('ustar  \0', 257)
    return h
  }
  blocks.push(header('./', 0, '5'))
  for (const [name, data] of files) {
    blocks.push(header(`./${name}`, data.length, '0'))
    const pad = new Uint8Array(Math.ceil(data.length / 512) * 512)
    pad.set(data)
    blocks.push(pad)
  }
  blocks.push(new Uint8Array(1024))
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0))
  let o = 0
  for (const b of blocks) out.set(b, (o += b.length) - b.length)
  return out
}
const bin = (n: number, fill: number) => new Uint8Array(n).fill(fill)
const parts: [string, Uint8Array][] = [
  ['partition-table.bin', bin(3072, 1)],
  ['ota_data_initial.bin', bin(8192, 2)],
  ['bootloader.bin', bin(18880, 3)],
  ['esp32-csi-node.bin', bin(1191984 % 70000, 4)],
]
const inner = (await Promise.all(parts.map(async ([n, d]) => `${await sha256Hex(d)}  ${n}`))).join('\n') + '\n'
const gz = new Uint8Array(gzipSync(tar([...parts, ['SHA256SUMS.txt', new TextEncoder().encode(inner)]])))
const files = untar(await gunzip(gz))
assert.deepEqual([...files.keys()].sort(), ['SHA256SUMS.txt', 'bootloader.bin', 'esp32-csi-node.bin', 'ota_data_initial.bin', 'partition-table.bin'])
assert.equal(files.get('bootloader.bin')?.length, 18880)
assert.equal(await checkInner(files), null)

// flash map: RuView README offsets
const s3 = boardOf('s3-8mb')!
assert.deepEqual(flashMap(s3, files)?.map((f) => [f.address, f.name]), [[0x0, 'bootloader.bin'], [0x8000, 'partition-table.bin'], [0xf000, 'ota_data_initial.bin'], [0x20000, 'esp32-csi-node.bin']])
// the 4MB S3 bundle's names are different, so the wrong bundle can't be flashed
assert.equal(flashMap(boardOf('s3-4mb')!, files), null)

// a changed file or a missing one is caught before anything is written
const tampered = new Map(files)
tampered.set('bootloader.bin', bin(18880, 9))
assert.equal(await checkInner(tampered), 'inner')
const missing = new Map(files)
missing.delete('bootloader.bin')
assert.equal(await checkInner(missing), 'missing')
const noSums = new Map(files)
noSums.delete('SHA256SUMS.txt')
assert.equal(await checkInner(noSums), 'missing')

console.log('webflash ok')
