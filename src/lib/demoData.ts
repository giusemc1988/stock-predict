/**
 * Sample data for trying the Wi-Fi and RuView pages away from home, without the home agent.
 * Made up (no real device or person); the pages label it "sample data" while it shows.
 * The RuView room numbers follow the shape of RuView's simulated mode, recorded 2026-10-17.
 */
import type { WifiNetwork } from './netParse'
import { RUVIEW_IMAGE, type LiveNode, type RegistryNode, type SensingLatest, type Vitals } from './ruview'

export const DEMO_DEVICES = {
  devices: [
    { ip: '192.168.1.1', mac: '50:c7:bf:11:22:33', vendor: 'TP-Link', name: 'Router', trusted: true, isNew: false, router: true },
    { ip: '192.168.1.12', mac: '7c:1e:52:aa:bb:cc', vendor: 'Microsoft', name: 'Surface', trusted: true, isNew: false, router: false },
    { ip: '192.168.1.30', mac: '24:0a:c4:aa:bb:cc', vendor: 'Espressif', name: 'ESP32', trusted: true, isNew: false, router: false },
    { ip: '192.168.1.47', mac: '3c:71:bf:12:34:56', vendor: 'Espressif', name: null, trusted: false, isNew: true, router: false },
    { ip: '192.168.1.52', mac: '8c:79:f5:01:02:03', vendor: 'Samsung', name: 'TV', trusted: true, isNew: false, router: false },
  ],
  me: ['192.168.1.12'],
  offline: [{ mac: 'a4:83:e7:00:11:22', name: 'iPad', lastSeen: Date.now() - 86_400_000 }],
}

export const DEMO_WIFI: { supported: boolean; ssid: string | null; networks: WifiNetwork[] } = {
  supported: true,
  ssid: 'Home-WiFi',
  networks: [
    { ssid: 'Home-WiFi', bssid: '50:c7:bf:11:22:33', signal: 92, channel: 6, auth: 'WPA2-Personal' },
    { ssid: 'Neighbour 1', bssid: 'aa:bb:cc:dd:ee:01', signal: 70, channel: 6, auth: 'WPA2-Personal' },
    { ssid: 'Neighbour 2', bssid: 'aa:bb:cc:dd:ee:02', signal: 55, channel: 4, auth: 'WPA3-Personal' },
    { ssid: 'Cafe', bssid: 'aa:bb:cc:dd:ee:03', signal: 35, channel: 1, auth: 'Open' },
    { ssid: 'Neighbour 3', bssid: 'aa:bb:cc:dd:ee:04', signal: 25, channel: 11, auth: 'WPA2-Personal' },
  ],
}

export const DEMO_STATUS = { up: true, source: 'sample', version: null, image: null, pinned: RUVIEW_IMAGE }

export const DEMO_REGISTRY: RegistryNode[] = [
  { id: 1, room: 'Living room', board: 's3-8mb', antenna: 'internal', firmware: '0.8.14', added: 1 },
  { id: 2, room: 'Bedroom', board: 'xiao-c6', antenna: 'external', firmware: '0.8.13', added: 1 },
]

/** The room over time: nobody, then someone still, then someone moving, 20 seconds each. */
export function demoLatest(now: number): SensingLatest {
  const phase = Math.floor(now / 20_000) % 3
  const wobble = (Math.sin(now / 1700) + 1) / 2
  const level = (['absent', 'present_still', 'present_moving'] as const)[phase]
  return {
    source: 'sample',
    age_ms: 100 + Math.round(wobble * 200),
    classification: { motion_level: level, presence: phase > 0, confidence: phase === 0 ? 0.8 + wobble * 0.1 : 0.44 + wobble * 0.15 },
    estimated_persons: phase === 0 ? 0 : 1,
  }
}

export function demoNodes(now: number): LiveNode[] {
  const w = Math.round(Math.sin(now / 2300) * 3)
  return [
    { node_id: 1, status: 'active', last_seen_ms: 120, rssi_dbm: -41 + w },
    { node_id: 2, status: 'active', last_seen_ms: 340, rssi_dbm: -58 + w },
  ]
}

export const DEMO_VITALS: Vitals = { authority: 'abstained', abstention_reason: 'calibration required', vital_signs: { breathing_rate_bpm: null, heart_rate_bpm: null } }
