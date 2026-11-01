import assert from 'node:assert/strict'
import {
  bestChannel,
  crowdedChannels,
  findingsFor,
  followingDevices,
  parseScoutChunk,
  possibleEvilTwins,
  radarLayout,
  ringOf,
  riskOf,
  weakNetworks,
  type ScoutScan,
} from '../src/lib/nexusScout'

// chunks accumulate; malformed or unknown chunks are ignored rather than throwing
let scan: ScoutScan = { wifi: [], ble: [], at: 0 }
scan = parseScoutChunk(JSON.stringify({ t: 'wifi', items: [{ ssid: 'Home', bssid: 'aa:aa:aa:aa:aa:01', ch: 6, rssi: -40, auth: 'wpa2', wps: false }] }), scan)
scan = parseScoutChunk('not json', scan)
scan = parseScoutChunk(JSON.stringify({ t: 'ble', items: [{ id: 'dev1', name: 'Headphones', rssi: -55 }] }), scan)
scan = parseScoutChunk(JSON.stringify({ t: 'end', at: 1000 }), scan)
assert.equal(scan.wifi.length, 1)
assert.equal(scan.ble.length, 1)
assert.equal(scan.at, 1000)
assert.equal(scan.ble[0].kind, 'other')
console.log('parse ok')

// channel crowding and the quietest of 1/6/11
const wifi = [
  { ssid: 'A', bssid: '1', channel: 1, rssi: -50, auth: 'wpa2' as const, wps: false },
  { ssid: 'B', bssid: '2', channel: 1, rssi: -60, auth: 'wpa2' as const, wps: false },
  { ssid: 'C', bssid: '3', channel: 1, rssi: -70, auth: 'wpa2' as const, wps: false },
  { ssid: 'D', bssid: '4', channel: 6, rssi: -50, auth: 'wpa2' as const, wps: false },
]
assert.deepEqual(crowdedChannels(wifi)[0], { channel: 1, count: 3 })
assert.equal(bestChannel(wifi), 11)
console.log('channels ok')

// open / WEP / WPS networks are flagged, never acted on
const risky = [
  { ssid: 'OpenCafe', bssid: '1', channel: 1, rssi: -50, auth: 'open' as const, wps: false },
  { ssid: 'OldRouter', bssid: '2', channel: 6, rssi: -50, auth: 'wep' as const, wps: false },
  { ssid: 'WpsOn', bssid: '3', channel: 11, rssi: -50, auth: 'wpa2' as const, wps: true },
  { ssid: 'Fine', bssid: '4', channel: 1, rssi: -50, auth: 'wpa2' as const, wps: false },
]
const weak = weakNetworks(risky)
assert.deepEqual(weak.map((w) => w.flag), ['open', 'wep', 'wps'])
console.log('weak ok')

// a known SSID seen on a BSSID that isn't one of Chanh's own access points
const known = [{ ssid: 'ChanhHome', bssids: ['aa:aa:aa:aa:aa:01'] }]
const twins = possibleEvilTwins(
  [
    { ssid: 'ChanhHome', bssid: 'aa:aa:aa:aa:aa:01', channel: 6, rssi: -40, auth: 'wpa2', wps: false },
    { ssid: 'ChanhHome', bssid: 'bb:bb:bb:bb:bb:02', channel: 11, rssi: -60, auth: 'open', wps: false },
    { ssid: 'OtherNet', bssid: 'cc:cc:cc:cc:cc:03', channel: 1, rssi: -50, auth: 'wpa2', wps: false },
  ],
  known,
)
assert.equal(twins.length, 1)
assert.equal(twins[0].bssid, 'bb:bb:bb:bb:bb:02')
console.log('twin ok')

// a BLE device seen at 3+ distinct places is flagged as possibly following; 2 places is not enough
assert.deepEqual(followingDevices([{ id: 'x', place: 'cafe' }, { id: 'x', place: 'park' }, { id: 'x', place: 'hotel' }, { id: 'y', place: 'cafe' }, { id: 'y', place: 'park' }]), [{ id: 'x', places: 3 }])
console.log('tracker ok')

// radar: strongest signal nearest the center, ring clamped to 0..1, items spread evenly
assert.equal(ringOf(-30), 0)
assert.equal(ringOf(-95), 1)
assert.equal(ringOf(-10), 0) // clamps
assert.equal(ringOf(-200), 1) // clamps
const points = radarLayout([
  { id: 'a', label: 'A', rssi: -30, risk: 'trusted' },
  { id: 'b', label: 'B', rssi: -95, risk: 'risk' },
])
assert.equal(points[0].ring, 0)
assert.equal(points[1].ring, 1)
assert.equal(points[1].angle, Math.PI)
assert.equal(riskOf({ flagged: true }), 'risk')
assert.equal(riskOf({ weak: true }), 'caution')
assert.equal(riskOf({}), 'trusted')
console.log('radar ok')

// findings: open/WEP networks are flagged from a plain scan with no known-network or sighting history
const full: ScoutScan = { wifi: risky, ble: [], at: 1 }
const findings = findingsFor(full, [], [])
assert.ok(findings.some((f) => f.kind === 'open'))
assert.ok(findings.some((f) => f.kind === 'wep'))
console.log('findings ok')

console.log('nexusscout: ok')
