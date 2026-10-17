import assert from 'node:assert/strict'
import { BOARDS, boardFromChip, flashCommand, mergeNodes, newer, nextNodeId, presenceOf, RUVIEW, RUVIEW_IMAGE } from '../src/lib/ruview'
import { configLine, helloLine, makeNonce, parseConfigReply, parseHello } from '../src/lib/ruviewSerial'
// @ts-expect-error plain JS module, run by the GitHub Action
import { bump, latestRelease } from './ruview-update.mjs'

// pinned version is one exact upstream release, image and firmware agree
assert.match(RUVIEW.release, /^v\d+\.\d+\.\d+-esp32$/)
assert.equal(RUVIEW_IMAGE, `ruvnet/wifi-densepose:${RUVIEW.release}`)
assert.equal(`v${RUVIEW.firmware}-esp32`, RUVIEW.release)

// versions
assert.ok(newer('0.8.14', '0.8.9') && newer('v0.9.0-esp32', '0.8.14') && !newer('0.8.14', '0.8.14') && !newer('0.8.2', '0.8.10'))

// update check: only vX.Y.Z-esp32 tags count, numeric order, no bump when current
const tags = ['latest', 'main', 'sha-0f95193', 'v0.8.9-esp32', 'v0.8.14-esp32', 'v0.8.13-esp32', 'v3263', 'v0.9.0-realtek-beta.1']
assert.equal(latestRelease(tags), 'v0.8.14-esp32')
assert.equal(latestRelease(['latest']), null)
const pin = { upstream: 'x', release: 'v0.8.14-esp32', image: 'ruvnet/wifi-densepose', firmware: '0.8.14', checked: '2026-10-17' }
assert.equal(bump(pin, tags, '2026-10-18'), null)
assert.deepEqual(bump(pin, [...tags, 'v0.9.1-esp32'], '2026-10-18'), { ...pin, release: 'v0.9.1-esp32', firmware: '0.9.1', checked: '2026-10-18' })
assert.equal(bump({ ...pin, release: 'v0.9.1-esp32' }, tags, 'd'), null)

// boards: S3 and C6 flash from the release files, C3 and original ESP32 are refused
assert.equal(boardFromChip('esp32s3'), 's3-8mb')
assert.equal(boardFromChip('esp32'), null)
assert.equal(flashCommand(BOARDS.find((b) => b.id === 'c3')!), null)
const s3 = flashCommand(BOARDS.find((b) => b.id === 's3-4mb')!, 'COM7')!
assert.ok(s3.includes('--chip esp32s3 --port COM7') && s3.includes('0x8000 partition-table-4mb.bin') && s3.endsWith('0x20000 esp32-csi-node-4mb.bin'))
assert.ok(BOARDS.filter((b) => b.externalAntenna).every((b) => b.chip === 'esp32c6'))

// presence wording
assert.equal(presenceOf(null), 'waiting')
assert.equal(presenceOf({ status: 'stale' }), 'stale')
assert.equal(presenceOf({ classification: { motion_level: 'present_moving', presence: true, confidence: 0.7 } }), 'moving')
assert.equal(presenceOf({ classification: { motion_level: 'absent', presence: false, confidence: 0.9 } }), 'absent')

// registry joins the live list; unknown live nodes still appear; old firmware is flagged
const reg = [{ id: 2, room: 'Living', board: 's3-8mb' as const, antenna: 'internal' as const, firmware: '0.8.9', added: 1 }]
const rows = mergeNodes(reg, [{ node_id: 5, status: 'active', last_seen_ms: 10 }, { node_id: 2, status: 'stale', last_seen_ms: 9000 }])
assert.deepEqual(rows.map((r) => [r.id, r.live?.status, r.behind]), [[2, 'stale', true], [5, 'active', false]])
assert.equal(nextNodeId(reg), 1)
assert.equal(nextNodeId([1, 2, 3].map((id) => ({ ...reg[0], id }))), 4)

// serial setup protocol, checked against the firmware's own rules
const nonce = makeNonce()
assert.match(nonce, /^[0-9a-f]{32}$/)
assert.equal(helloLine(nonce), `RUVIEW_HELLO_V1 ${nonce}\n`)
const h = parseHello(`RUVIEW_HELLO_OK_V1 nonce=${nonce} chip=esp32s3 version=0.8.14 node_id=3 target_ip=192.168.1.10 target_port=5005 configured=1 device_digest=abcd`)!
assert.deepEqual([h.chip, h.version, h.nodeId, h.targetIp, h.targetPort, h.configured], ['esp32s3', '0.8.14', 3, '192.168.1.10', 5005, true])
assert.equal(parseHello('I (123) wifi: connected'), null)

const ok = configLine({ nonce, nodeId: 3, targetIp: '192.168.1.10', targetPort: 5005, ssid: 'Nhà Chanh', password: 'secret123' })
assert.ok('line' in ok)
const parts = ok.line.trim().split(' ')
assert.equal(parts.length, 7)
assert.equal(Buffer.from(parts[5], 'base64').toString('utf8'), 'Nhà Chanh')
assert.equal(Buffer.from(parts[6], 'base64').toString('utf8'), 'secret123')
const keep = configLine({ nonce, nodeId: 3, targetIp: '10.0.0.2', targetPort: 5005, ssid: '', password: '' })
assert.ok('line' in keep && keep.line.endsWith(' KEEP KEEP\n'))
const bad = (o: object) => {
  const r = configLine({ nonce, nodeId: 3, targetIp: '192.168.1.10', targetPort: 5005, ssid: 'Home', password: 'secret123', ...o })
  return 'error' in r ? r.error : null
}
assert.equal(bad({ nodeId: 0 }), 'node_id')
assert.equal(bad({ nodeId: 256 }), 'node_id')
assert.equal(bad({ targetIp: '8.8.8.8' }), 'target_ip')
assert.equal(bad({ targetPort: 0 }), 'target_port')
assert.equal(bad({ password: 'short' }), 'password')
assert.equal(bad({ ssid: '' }), 'ssid')
assert.equal(bad({ ssid: 'x'.repeat(33) }), 'ssid')
assert.equal(bad({}), null)

assert.deepEqual(parseConfigReply(`RUVIEW_CONFIG_OK_V1 nonce=${nonce} node_id=3 rebooting=1`), { ok: true, nodeId: 3 })
assert.deepEqual(parseConfigReply(`RUVIEW_CONFIG_ERR_V1 nonce=${nonce} reason=claim_expired`), { ok: false, reason: 'claim_expired' })
assert.equal(parseConfigReply('boot: ok'), null)

console.log('ruview tests passed')
