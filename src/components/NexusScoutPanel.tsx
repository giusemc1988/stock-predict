/**
 * "Thiết bị bỏ túi": connects over Web Bluetooth to an ESP32 running firmware/nexus-scout, which
 * only ever scans and reports — it never transmits deauth, beacon spam or any other attack frame.
 * Draws a radar (signal strength -> distance from center, risk -> color) with a plain list as a
 * fallback, and lists findings computed by src/lib/nexusScout.ts.
 */
import { useEffect, useRef, useState } from 'react'
import { feedScoutLine, SCOUT_BAUD, SCOUT_PING_LINE, SCOUT_PING_MS, splitLines } from '../lib/nexusSerial'
import { findingsFor, parseScoutChunk, radarLayout, riskOf, weakNetworks, type Finding, type ScoutScan } from '../lib/nexusScout'
import { S3KitBar } from './S3KitBar'
import { detectFirmware, type KitFirmware } from '../lib/s3Kit'
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

type SerialPortLike = {
  open(o: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}
type SerialApi = { requestPort(): Promise<SerialPortLike> }

function emptyScan(): ScoutScan {
  return { wifi: [], ble: [], at: 0 }
}

export function NexusScoutPanel({ knownNets = [], onEcho }: { knownNets?: { ssid: string; bssids: string[] }[]; onEcho?: () => void }) {
  const t = useNetT()
  const [state, setState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [scan, setScan] = useState<ScoutScan>(emptyScan())
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<'radar' | 'list'>('radar')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const deviceRef = useRef<Awaited<ReturnType<Bt['requestDevice']>> | null>(null)
  const usbRef = useRef<{ stop(): Promise<void> } | null>(null)
  const [fw, setFw] = useState<KitFirmware>('unknown')
  const [via, setVia] = useState<'ble' | 'usb'>('ble')

  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator
  const usbSupported = typeof navigator !== 'undefined' && 'serial' in navigator

  /** USB path: Web Serial, line-delimited JSON; a "ping" every 10s keeps the firmware streaming. */
  const connectUsb = async () => {
    const serial = (navigator as Navigator & { serial?: SerialApi }).serial
    if (!serial) return
    setState('connecting')
    setErr(null)
    try {
      const port = await serial.requestPort()
      await port.open({ baudRate: SCOUT_BAUD })
      if (!port.readable || !port.writable) throw new Error('port')
      const writer = port.writable.getWriter()
      const reader = port.readable.getReader()
      const ping = () => void writer.write(new TextEncoder().encode(SCOUT_PING_LINE)).catch(() => {})
      ping()
      const timer = window.setInterval(ping, SCOUT_PING_MS)
      let stopped = false
      usbRef.current = {
        async stop() {
          stopped = true
          window.clearInterval(timer)
          await reader.cancel().catch(() => {})
          reader.releaseLock()
          writer.releaseLock()
          await port.close().catch(() => {})
        },
      }
      setVia('usb')
      setFw('unknown')
      setState('connected')
      void (async () => {
        let buf = ''
        let acc = emptyScan()
        const dec = new TextDecoder()
        try {
          while (!stopped) {
            const { value, done } = await reader.read()
            if (done) break
            const { lines, rest } = splitLines(buf + dec.decode(value, { stream: true }))
            buf = rest
            for (const line of lines) {
              const fed = feedScoutLine(line, acc)
              acc = fed.scan
              if (detectFirmware(line) === 'ruview') setFw('ruview')
              else if (fed.banner) setFw('nexus-scout')
              else setScan(acc)
              if (fed.complete) acc = emptyScan()
            }
          }
        } catch {
          // port unplugged mid-read
        }
        if (!stopped) {
          usbRef.current = null
          setState('idle')
        }
      })()
    } catch (e) {
      setState('error')
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

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
      setFw('nexus-scout') // only nexus-scout exposes this GATT service
      setVia('ble')
      setState('connected')
    } catch (e) {
      setState('error')
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const disconnect = () => {
    deviceRef.current?.gatt?.disconnect()
    void usbRef.current?.stop()
    usbRef.current = null
    setState('idle')
  }

  useEffect(() => () => {
    deviceRef.current?.gatt?.disconnect()
    void usbRef.current?.stop()
  }, [])

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
      <S3KitBar mode="nexus" firmware={fw} connected={state === 'connected'} onSwitch={onEcho} />
      <p className="small muted">{t('scoutNote')}</p>
      {!supported && !usbSupported && <p className="small muted">{t('scoutNoSupport')}</p>}
      {state !== 'connected' && (
        <div className="scout-connect">
          {usbSupported && (
            <button className="btn" disabled={state === 'connecting'} onClick={() => void connectUsb()}>{state === 'connecting' ? t('scoutConnecting') : t('scoutConnectUsb')}</button>
          )}
          {supported && (
            <button className="btn" disabled={state === 'connecting'} onClick={() => void connect()}>{state === 'connecting' ? t('scoutConnecting') : t('scoutConnect')}</button>
          )}
        </div>
      )}
      {state === 'connected' && <button className="btn" onClick={disconnect}>{t('scoutDisconnect')}{via === 'usb' ? ' (USB)' : ''}</button>}
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
