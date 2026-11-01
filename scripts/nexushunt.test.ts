import assert from 'node:assert/strict'
import { parseScoutChunk } from '../src/lib/nexusScout.ts'
import { feedScoutLine } from '../src/lib/nexusSerial.ts'
import { classifyBle, classifyWifi, huntCommand, huntFill, huntRange, huntStart, huntStep, roomReport, trackerBrand } from '../src/lib/nexusHunt.ts'

const wifi = (ssid: string, bssid: string, rssi = -70, auth = 'wpa2') => ({ ssid, bssid, channel: 6, rssi, auth: auth as 'wpa2', wps: false })
const empty = { wifi: [], ble: [], at: 0 }

// camera-looking SSID, camera maker radio, plain home router
assert.ok((classifyWifi(wifi('IPC-1A2B', 'aa:bb:cc:00:00:01'))?.score ?? 0) >= 3)
assert.equal(classifyWifi(wifi('HomeNet', '44:19:b6:00:00:01'))?.reasons[0].code, 'oui')
assert.equal(classifyWifi(wifi('HomeNet', 'aa:bb:cc:00:00:01')), null)
assert.equal(classifyWifi(wifi('Hotel Guest', 'aa:bb:cc:00:00:01', -40)), null)

// trackers
assert.equal(trackerBrand({ id: 'a', name: null, rssi: -60, kind: 'ibeacon', co: 76, ty: 0x12 }), 'apple')
assert.equal(trackerBrand({ id: 'a', name: null, rssi: -60, kind: 'other', su: ['feed'] }), 'tile')
assert.equal(trackerBrand({ id: 'a', name: null, rssi: -60, kind: 'other', su: ['fd5a'] }), 'smarttag')
assert.equal(trackerBrand({ id: 'a', name: null, rssi: -60, kind: 'ibeacon', co: 76, ty: 0x10 }), null)
assert.equal(classifyBle({ id: 'a', name: 'Headphones', rssi: -60, kind: 'other' }), null)
assert.equal(classifyBle({ id: 'a', name: 'WiFi-Cam01', rssi: -60, kind: 'other' })?.kind, 'camera')

// verdicts
assert.equal(roomReport([empty]).verdict, 'safe')
assert.equal(roomReport([{ ...empty, wifi: [wifi('IPC-1A2B', 'aa:bb:cc:00:00:01')] }]).verdict, 'suspicious')
assert.equal(roomReport([{ ...empty, wifi: [wifi('Cafe', 'aa:bb:cc:00:00:02', -70, 'open')] }]).verdict, 'check')
const near = { id: '11:22:33:44:55:66', name: null, rssi: -50, kind: 'ibeacon' as const, co: 76, ty: 0x12 }
assert.equal(roomReport([{ ...empty, ble: [near] }]).verdict, 'suspicious')
assert.equal(roomReport([{ ...empty, ble: [{ ...near, rssi: -85 }] }]).verdict, 'check')
// merging keeps the device seen only in one scan
const r = roomReport([empty, { ...empty, ble: [near] }, empty])
assert.equal(r.trackers.length, 1)
assert.equal(r.bleCount, 1)

// chunk + serial parsing of the new BLE fields
const s = parseScoutChunk('{"t":"ble","items":[{"id":"aa:bb:cc:dd:ee:ff","name":"","rssi":-60,"kind":"ibeacon","co":76,"ty":18,"su":"FEED"}]}', empty)
assert.equal(s.ble[0].co, 76)
assert.equal(s.ble[0].ty, 18)
assert.deepEqual(s.ble[0].su, ['feed'])
assert.equal(s.ble[0].name, null)
assert.equal(feedScoutLine('{"t":"hunt","rssi":-61}', empty).hunt, -61)
assert.equal(feedScoutLine('{"t":"hunt","rssi":null}', empty).hunt, null)
assert.equal(feedScoutLine('{"t":"end","at":5}', empty).hunt, undefined)

// hot / cold
let h = huntStep(huntStart(), -80)
assert.equal(h.rssi, -80)
h = huntStep(h, -60)
assert.equal(h.trend, 'hotter')
h = huntStep(h, -90)
assert.equal(h.trend, 'colder')
h = huntStep(h, null)
assert.equal(h.misses, 1)
assert.equal(huntRange(-40), 'touch')
assert.equal(huntRange(-50), 'close')
assert.equal(huntRange(-65), 'near')
assert.equal(huntRange(-85), 'far')
assert.equal(huntRange(null), 'lost')
assert.equal(huntFill(-95), 0)
assert.equal(huntFill(-40), 1)

// commands
assert.equal(huntCommand(null), 'hunt off\n')
assert.equal(huntCommand({ kind: 'wifi', bssid: 'AA:BB:CC:00:00:01', channel: 6 }), 'hunt wifi aa:bb:cc:00:00:01 6\n')
assert.equal(huntCommand({ kind: 'ble', id: 'AA:BB:CC:00:00:01' }), 'hunt ble aa:bb:cc:00:00:01\n')
assert.equal(huntCommand({ kind: 'ble', id: 'not a mac' }), null)
assert.equal(huntCommand({ kind: 'wifi', bssid: 'aa:bb:cc:00:00:01', channel: 40 }), null)
console.log('nexushunt ok')
