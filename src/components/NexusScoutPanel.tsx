/**
 * "Thiết bị bỏ túi": connects over Web Bluetooth to an ESP32 running firmware/nexus-scout, which
 * only ever scans and reports — it never transmits deauth, beacon spam or any other attack frame.
 * Draws a radar (signal strength -> distance from center, risk -> color) with a plain list as a
 * fallback, and lists findings computed by src/lib/nexusScout.ts.
 */
import { useEffect, useRef, useState } from 'react'
import { findingsFor, parseScoutChunk, radarLayout, riskOf, weakNetworks, type Finding, type ScoutScan } from '../lib/nexusScout'
import { useNetT } from '../lib/netText'

// Must match the UUIDs firmware/nexus-scout/src/main.cpp advertises.
const SERVICE_UUID = 'a0a00001-a0a0-4a0a-8a0a-a0a0a0a0a001'
const CHAR_UUID = 'a0a00002-a0a0-4a0a-8a0a-a0a0a0a0a001'

type Bt = {
  requestDevice(opts: { filters: { namePrefix: string }[]; optionalServices: string[] }): Promise<{
    gatt?: { connect(): Promise<{ getPrimaryService(id: string): Promise<{ getCharacteristic(id: string): Promise<BtChar> }> }>; disconnect(): void }
    addEventListener(ev: string, fn: () => void): void
  }>
}
type BtChar = {
  startNotifications(): Promise<void>
  addEventListener(ev: 'characteristicvaluechanged', fn: (e: { target: { value: DataView } }) => void): void
}

function emptyScan(): ScoutScan {
  return { wifi: [], ble: [], at: 0 }
}

export function NexusScoutPanel({ knownNets = [] }: { knownNets?: { ssid: string; bssids: string[] }[] }) {
  const t = useNetT()
  const [state, setState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [scan, setScan] = useState<ScoutScan>(emptyScan())
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<'radar' | 'list'>('radar')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const deviceRef = useRef<Awaited<ReturnType<Bt['requestDevice']>> | null>(null)

  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

  const connect = async () => {
    const bt = (navigator as Navigator & { bluetooth?: Bt }).bluetooth
    if (!bt) return
    setState('connecting')
    setErr(null)
    try {
      const device = await bt.requestDevice({ filters: [{ namePrefix: 'NexusScout' }], optionalServices: [SERVICE_UUID] })
      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', () => setState('idle'))
      const server = await device.gatt?.connect()
      const service = await server?.getPrimaryService(SERVICE_UUID)
      const char = await service?.getCharacteristic(CHAR_UUID)
      await char?.startNotifications()
      let acc = emptyScan()
      char?.addEventListener('characteristicvaluechanged', (e) => {
        const text = new TextDecoder().decode(e.target.value)
        acc = parseScoutChunk(text, acc)
        setScan(acc)
        if (text.includes('"end"')) acc = emptyScan()
      })
      setState('connected')
    } catch (e) {
      setState('error')
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const disconnect = () => {
    deviceRef.current?.gatt?.disconnect()
    setState('idle')
  }

  useEffect(() => () => deviceRef.current?.gatt?.disconnect(), [])

  const findings: Finding[] = findingsFor(scan, knownNets)
  const weak = new Set(weakNetworks(scan.wifi).map((w) => w.wifi.bssid))
  const twinSsids = new Set(findings.filter((f) => f.kind === 'twin').map((f) => f.text.slice('twin:'.length)))
  const items = [
    ...scan.wifi.map((w) => ({ id: w.bssid, label: w.ssid, rssi: w.rssi, risk: riskOf({ flagged: twinSsids.has(w.ssid), weak: weak.has(w.bssid) }) })),
    ...scan.ble.map((b) => ({ id: b.id, label: b.name ?? b.id.slice(0, 8), rssi: b.rssi, risk: riskOf({}) })),
  ]
  const points = radarLayout(items)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || view !== 'radar') return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const w = cv.width
    const h = cv.height
    const cx = w / 2
    const cy = h / 2
    const r = Math.min(w, h) / 2 - 10
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(79,209,255,0.25)'
    for (const ring of [0.33, 0.66, 1]) {
      ctx.beginPath()
      ctx.arc(cx, cy, r * ring, 0, Math.PI * 2)
      ctx.stroke()
    }
    const color = { trusted: '#0ecb81', caution: '#f0b90b', risk: '#ff5b5b' }
    for (const p of points) {
      const x = cx + Math.sin(p.angle) * r * p.ring
      const y = cy - Math.cos(p.angle) * r * p.ring
      ctx.fillStyle = color[p.risk]
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#4fd1ff'
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
  }, [points, view])

  const findingText = (f: Finding) => {
    if (f.kind === 'open') return t('scoutOpen', { ssid: f.text.slice('open:'.length) })
    if (f.kind === 'wep') return t('scoutWeak', { ssid: f.text.slice('wep:'.length) })
    if (f.kind === 'twin') return t('scoutTwin', { ssid: f.text.slice('twin:'.length) })
    if (f.kind === 'tracker') {
      const [, , n] = f.text.split(':')
      return t('scoutTracker', { n })
    }
    const [, ch, n, best] = f.text.split(':')
    return t('scoutCrowded', { ch, n, best })
  }

  return (
    <section className="bf-card net-scout">
      <header><h3>{t('scoutTitle')}</h3></header>
      <p className="small muted">{t('scoutNote')}</p>
      {!supported && <p className="small muted">{t('scoutNoSupport')}</p>}
      {supported && state !== 'connected' && (
        <button className="btn" disabled={state === 'connecting'} onClick={() => void connect()}>{state === 'connecting' ? t('scoutConnecting') : t('scoutConnect')}</button>
      )}
      {state === 'connected' && <button className="btn" onClick={disconnect}>{t('scoutDisconnect')}</button>}
      {err && <p className="small muted">{err}</p>}
      {state !== 'connected' && <p className="small muted">{t('scoutNeedFirmware')}</p>}

      {state === 'connected' && (
        <>
          <div className="scout-tabs">
            <button className={view === 'radar' ? 'on' : ''} onClick={() => setView('radar')}>{t('scoutRadar')}</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>{t('scoutList')}</button>
          </div>
          {view === 'radar' ? (
            <canvas ref={canvasRef} className="scout-radar" width={260} height={260} role="img" aria-label={t('scoutTitle')} />
          ) : (
            <div className="scout-list">
              {points.map((p) => (
                <div key={p.id} className={`scout-row risk-${p.risk}`}>
                  <b>{p.label}</b>
                  <small className="mono">{p.rssi} dBm</small>
                </div>
              ))}
            </div>
          )}
          <div className="net-kpi"><small>{t('scoutWifiSeen')}</small><b className="mono">{scan.wifi.length}</b></div>
          <div className="net-kpi"><small>{t('scoutBleSeen')}</small><b className="mono">{scan.ble.length}</b></div>
          <div className="scout-findings">
            <b className="small">{t('scoutFindings')}</b>
            {!findings.length && <p className="small muted">{t('scoutNoFindings')}</p>}
            {findings.map((f, i) => <p key={i} className="small">{findingText(f)}</p>)}
          </div>
        </>
      )}
    </section>
  )
}
