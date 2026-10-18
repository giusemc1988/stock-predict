import assert from 'node:assert/strict'
import { deviceKey, inPhoneApp, mergePhoneScan, netKey, patchKnown, type PhoneNets } from '../src/lib/phoneLan'

// not inside the Android app here
assert.equal(inPhoneApp(), false)

// one Wi-Fi per router; Android's fake BSSID falls back to the name
assert.equal(netKey({ bssid: '50:c7:bf:11:22:33', ssid: 'Tiem 1', gateway: '192.168.1.1' }), '50:c7:bf:11:22:33')
assert.equal(netKey({ bssid: '02:00:00:00:00:00', ssid: 'Tiem 1', gateway: '192.168.1.1' }), 'Tiem 1')
assert.equal(netKey({ bssid: null, ssid: null, gateway: '10.0.0.1' }), '10.0.0.1')
assert.equal(deviceKey({ ip: '192.168.1.9', mac: null }), 'ip:192.168.1.9')

const scan1 = { me: '192.168.1.20', gateway: '192.168.1.1', devices: [
  { ip: '192.168.1.1', name: 'router', mac: null, ms: 3 },
  { ip: '192.168.1.20', name: 'my-phone', mac: null, ms: 0 },
  { ip: '192.168.1.30', name: 'esp32', mac: '24:0a:c4:aa:bb:cc', ms: 12 },
] }
// first scan of a Wi-Fi: nothing is "new"
const a = mergePhoneScan({}, 'shop1', 'Tiem 1', scan1, 1000)
assert.deepEqual(a.data.devices.map((d) => [d.ip, d.isNew, d.router]), [['192.168.1.1', false, true], ['192.168.1.20', false, false], ['192.168.1.30', false, false]])
assert.equal(a.data.devices[2].vendor, 'Espressif')
assert.equal(a.data.devices[1].name, null) // this phone shows as "This PC" style, not its DNS name

// later scan: a new device is flagged, a missing one goes to offline
const scan2 = { ...scan1, devices: [scan1.devices[0], scan1.devices[1], { ip: '192.168.1.77', name: null, mac: null, ms: 40 }] }
const b = mergePhoneScan(a.nets, 'shop1', 'Tiem 1', scan2, 5000)
assert.deepEqual(b.data.devices.map((d) => d.isNew), [false, false, true])
assert.deepEqual(b.data.offline.map((o) => o.mac), ['24:0a:c4:aa:bb:cc'])

// each Wi-Fi keeps its own memory
const c = mergePhoneScan(b.nets, 'house2', 'Nha 2', scan2, 6000)
assert.ok(c.data.devices.every((d) => !d.isNew))
assert.deepEqual(Object.keys(c.nets).sort(), ['house2', 'shop1'])

// rename and trust stick to that Wi-Fi only
let n: PhoneNets = patchKnown(c.nets, 'shop1', 'ip:192.168.1.77', { name: 'Camera', trusted: true })
const d = mergePhoneScan(n, 'shop1', 'Tiem 1', scan2, 7000)
assert.deepEqual([d.data.devices[2].name, d.data.devices[2].trusted, d.data.devices[2].isNew], ['Camera', true, false])
n = patchKnown(n, 'shop1', 'nope', { name: 'x' })
assert.equal(n.shop1.known.nope, undefined)

console.log('phone tests passed')
