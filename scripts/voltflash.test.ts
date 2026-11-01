import assert from 'node:assert/strict'
import { allowedReleaseHost, canFlash, checkParts, describePart, guessOffset, parseImageHeader, parseRepo, parseSums, partsFromManifest } from '../src/lib/voltFlash'

function img(chipId: number, flashSizeNibble: number, len = 64): Uint8Array {
  const b = new Uint8Array(len)
  b[0] = 0xe9
  b[1] = 3
  b[2] = 2
  b[3] = (flashSizeNibble << 4) | 0x0
  if (len >= 24) {
    b[12] = chipId & 0xff
    b[13] = (chipId >> 8) & 0xff
  }
  return b
}

// parseImageHeader: magic, flash size and chip id for an ESP32-S3 image (8MB)
const h = parseImageHeader(img(9, 3))
assert.equal(h?.magic, 0xe9)
assert.equal(h?.chipName, 'ESP32-S3')
assert.equal(h?.flashSizeMB, 8)
// wrong magic (e.g. a raw partition table) is not a valid image
const bad = new Uint8Array(32)
bad[0] = 0xaa
assert.equal(parseImageHeader(bad), null)
// too short to have a header
assert.equal(parseImageHeader(new Uint8Array(4)), null)

// describePart: a raw partition table is not an image; a real app image is
assert.equal(describePart('partition-table.bin', 0x8000, new Uint8Array(32).fill(0xff)).isImage, false)
const appPart = describePart('app.bin', 0x10000, img(9, 3))
assert.equal(appPart.isImage, true)
assert.equal(appPart.header?.chipName, 'ESP32-S3')

const s3 = { chipName: 'ESP32-S3', flashSizeMB: 16 }

// bad: no valid image at all
{
  const checks = checkParts([describePart('junk.bin', 0x0, new Uint8Array(8).fill(0))], s3)
  assert.equal(checks.find((c) => c.key === 'magic')?.level, 'bad')
  assert.equal(canFlash(checks), false)
}
// bad: image packaged for a different chip
{
  const checks = checkParts([describePart('app.bin', 0x10000, img(0, 3))], s3) // ESP32 original, not S3
  assert.equal(checks.find((c) => c.key === 'chip')?.level, 'bad')
  assert.equal(canFlash(checks), false)
}
// warn: image targets a bigger flash than the board has
{
  const small = { chipName: 'ESP32-S3', flashSizeMB: 4 }
  const checks = checkParts([describePart('app.bin', 0x10000, img(9, 3))], small) // packaged for 8MB
  assert.equal(checks.find((c) => c.key === 'size')?.level, 'warn')
}
// bad: overlapping offsets
{
  const a = describePart('a.bin', 0x10000, img(9, 1, 0x2000))
  const b = describePart('b.bin', 0x11000, img(9, 1, 0x2000))
  const checks = checkParts([a, b], s3)
  assert.equal(checks.find((c) => c.key === 'overlap')?.level, 'bad')
  assert.equal(canFlash(checks), false)
}
// ok: a clean single-image match unlocks the flash button
{
  const parts = [describePart('bootloader.bin', 0x0, img(9, 3)), describePart('app.bin', 0x10000, img(9, 3, 4096))]
  const checks = checkParts(parts, s3)
  assert.ok(checks.every((c) => c.level !== 'bad'))
  assert.equal(canFlash(checks), true)
}
// warn: bootloader at the wrong offset for the chip (S3 wants 0x0, not 0x1000)
{
  const checks = checkParts([describePart('bootloader.bin', 0x1000, img(9, 3))], s3)
  assert.equal(checks.find((c) => c.key === 'boot')?.level, 'warn')
}
// empty file list is bad
assert.equal(checkParts([], s3)[0].level, 'bad')

// guessOffset: bootloader goes to the chip default; others to their known offsets
assert.equal(guessOffset('bootloader.bin', 'ESP32-S3'), 0x0)
assert.equal(guessOffset('bootloader.bin', 'ESP32'), 0x1000)
assert.equal(guessOffset('partition-table.bin', 'ESP32-S3'), 0x8000)
assert.equal(guessOffset('ota_data_initial.bin', 'ESP32-S3'), 0xf000)
assert.equal(guessOffset('esp32-csi-node.bin', 'ESP32-S3'), 0x10000)

// parseSums: standard sha256sum lines
{
  const m = parseSums('31b25068aad34a119047aaf9b6c2580693fe3017bf4ad4c2f682b731fef01474  app.bin\naf0c015a6470ca542b68d7084a55652bee7798013d87487cd05fac1484a25980 *bootloader.bin\njunk\n')
  assert.equal(m.size, 2)
  assert.equal(m.get('app.bin'), '31b25068aad34a119047aaf9b6c2580693fe3017bf4ad4c2f682b731fef01474')
}

// parseRepo: owner/repo, full URL, or a release URL
assert.deepEqual(parseRepo('ruvnet/ruview'), { owner: 'ruvnet', repo: 'ruview' })
assert.deepEqual(parseRepo('https://github.com/ruvnet/ruview'), { owner: 'ruvnet', repo: 'ruview' })
assert.deepEqual(parseRepo('https://github.com/ruvnet/ruview/releases/tag/v0.8.14-esp32'), { owner: 'ruvnet', repo: 'ruview' })
assert.equal(parseRepo('not a repo'), null)

// allowedReleaseHost: only GitHub hosts are ever fetched
assert.equal(allowedReleaseHost('https://github.com/a/b'), true)
assert.equal(allowedReleaseHost('https://api.github.com/repos/a/b'), true)
assert.equal(allowedReleaseHost('https://objects.githubusercontent.com/x'), true)
assert.equal(allowedReleaseHost('https://evil.example.com/a/b'), false)
assert.equal(allowedReleaseHost('not a url'), false)

// partsFromManifest: ESP Web Tools manifest.json
assert.equal(partsFromManifest({ builds: [{ chipFamily: 'ESP32-S3', parts: [{ path: 'bootloader.bin', offset: 0 }, { path: 'app.bin', offset: 0x10000 }] }] })?.length, 2)
assert.equal(partsFromManifest({ builds: [{ chipFamily: 'x' }] }), null)
assert.equal(partsFromManifest({}), null)

console.log('voltflash: ok')

// first 32 bytes of the real nexus-scout-esp32-s3.bin release image (16 MB flash, chip id 9 at bytes 12-13)
const real = Uint8Array.from([0xe9, 0x03, 0x02, 0x4f, 0xb8, 0x88, 0x3c, 0x40, 0xee, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x01, 0x20, 0x28, 0xce, 0x3f, 0xcc, 0x10, 0x00, 0x00])
const rh = parseImageHeader(real)
assert.equal(rh?.chipName, 'ESP32-S3')
assert.equal(rh?.flashSizeMB, 16)
const realChecks = checkParts([describePart('nexus-scout-esp32-s3.bin', 0, real)], { chipName: 'ESP32-S3', flashSizeMB: 16 })
assert.ok(canFlash(realChecks), JSON.stringify(realChecks))
console.log('real s3 image ok')
