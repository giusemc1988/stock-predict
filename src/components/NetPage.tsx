import { useCallback, useEffect, useState } from 'react'
import { hhmm } from '../lib/brief'
import { DEMO_DEVICES, DEMO_WIFI } from '../lib/demoData'
import { browserSpeedTest } from '../lib/speedTest'
import { channelTip, isPrivateIPv4, type WifiNetwork } from '../lib/netParse'
import { useNetT, type NetKey } from '../lib/netText'
import { LangSwitch } from './HubPanels'

interface Device {
  ip: string
  mac: string
  vendor: string | null
  name: string | null
  trusted: boolean
  isNew: boolean
  router: boolean
}
interface DevicesData {
  devices: Device[]
  me: string[]
  offline: { mac: string; name: string | null; lastSeen: number }[]
}
interface WifiData {
  supported: boolean
  ssid: string | null
  networks: WifiNetwork[]
}
type Offline = { offline: true; why: string; snapshot: { at: number; data: unknown } | null }

const GUIDE = 'https://github.com/giusemc1988/stock-predict/blob/main/agent/README.md'

async function call<T>(path: string, init?: RequestInit): Promise<T | Offline> {
  const r = await fetch(`/api/home/${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const j = (await r.json().catch(() => ({ error: `HTTP ${r.status}` }))) as T | Offline | { error: string }
  if (j && typeof j === 'object' && 'error' in j) throw new Error(j.error)
  return j as T | Offline
}
const isOffline = (v: unknown): v is Offline => !!v && typeof v === 'object' && (v as Offline).offline === true

/** 2.4 GHz channel chart: one hill per network, your own network highlighted. */
function ChannelChart({ nets, own }: { nets: WifiNetwork[]; own: string | null }) {
  const x = (ch: number) => 20 + ((ch - 1) / 12) * 360
  const two = nets.filter((n) => n.channel >= 1 && n.channel <= 13).sort((a, b) => a.signal - b.signal)
  const colors = ['#ff8a6b', '#a58bff', '#f2c45a', '#8a9bb8', '#37d79c']
  return (
    <svg className="net-chan" viewBox="0 0 400 170" role="img" aria-label="2.4 GHz">
      <line x1="20" y1="150" x2="380" y2="150" stroke="#27426b" />
      {[1, 3, 6, 9, 11, 13].map((c) => (
        <text key={c} x={x(c)} y="164" textAnchor="middle" className="net-tick">{c}</text>
      ))}
      {two.map((n, i) => {
        const mine = !!own && n.ssid === own
        const c = mine ? '#4fd1ff' : colors[i % colors.length]
        const h = 150 - Math.max(12, (n.signal / 100) * 125)
        return (
          <g key={n.bssid}>
            <path d={`M${x(n.channel - 2)} 150 Q ${x(n.channel)} ${2 * h - 150} ${x(n.channel + 2)} 150Z`} fill={c} fillOpacity={mine ? 0.28 : 0.14} stroke={c} strokeWidth={mine ? 2.5 : 1} />
            {(mine || i >= two.length - 3) && <text x={x(n.channel)} y={Math.max(12, h - 4)} textAnchor="middle" className="net-lbl" fill={c}>{n.ssid.slice(0, 14)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

/** Wi-Fi & Bluetooth tools for Chanh's own network, fed by the home agent (agent/jarvis-agent.ts). */
export function NetPage({ onBack }: { onBack: () => void }) {
  const t = useNetT()
  const [devs, setDevs] = useState<DevicesData | null>(null)
  const [wifi, setWifi] = useState<WifiData | null>(null)
  const [off, setOff] = useState<Offline | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [speed, setSpeed] = useState<{ downMbps: number; upMbps: number; pingMs: number } | null>(null)
  const [ble, setBle] = useState<string | null>(null)
  const [demo, setDemo] = useState(false)

  const say = (k: NetKey, v?: Record<string, string | number>) => setNote(t(k, v))
  const fail = (e: unknown) => say('error', { msg: e instanceof Error ? e.message : String(e) })

  const scan = useCallback(async (sweep: boolean) => {
    setBusy(true)
    try {
      const [d, w] = await Promise.all([call<DevicesData>(`devices${sweep ? '?sweep=1' : ''}`), call<WifiData>('wifi')])
      if (isOffline(d)) {
        setOff(d)
        if (d.snapshot) setDevs(d.snapshot.data as DevicesData)
      } else {
        setOff(null)
        setDevs(d)
      }
      if (isOffline(w)) {
        if (w.snapshot) setWifi(w.snapshot.data as WifiData)
      } else setWifi(w)
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => void scan(false), 0)
    return () => clearTimeout(id)
  }, [scan])

  const live = !off
  const ask = (k: NetKey) => window.prompt(t(k))?.trim() ?? ''

  const pingIp = async (ip: string) => {
    try {
      const r = await call<{ received: number; sent: number; avgMs: number | null }>(`ping?ip=${encodeURIComponent(ip)}`)
      if (isOffline(r)) return say('needAgent')
      say(r.received ? 'pingResult' : 'pingNone', { ip, got: r.received, sent: r.sent, ms: r.avgMs ?? '—' })
    } catch (e) {
      fail(e)
    }
  }
  const portsIp = async (ip: string) => {
    try {
      const r = await call<{ open: number[] }>(`ports?ip=${encodeURIComponent(ip)}`)
      if (isOffline(r)) return say('needAgent')
      say(r.open.length ? 'portsOpen' : 'portsNone', { ip, list: r.open.join(', ') })
    } catch (e) {
      fail(e)
    }
  }
  const wake = async (mac: string) => {
    try {
      const r = await call<{ ok: boolean }>('wol', { method: 'POST', body: JSON.stringify({ mac }) })
      if (isOffline(r)) return say('needAgent')
      say('wakeSent')
    } catch (e) {
      fail(e)
    }
  }
  const update = async (mac: string, patch: { name?: string; trusted?: boolean }) => {
    try {
      await call('devices', { method: 'POST', body: JSON.stringify({ mac, ...patch }) })
      await scan(false)
    } catch (e) {
      fail(e)
    }
  }
  const runSpeed = async () => {
    setBusy(true)
    try {
      // with the home agent the PC measures the home line; without it this phone or computer measures its own Wi-Fi
      const viaAgent = live && !demo ? await call<{ downMbps: number; upMbps: number; pingMs: number }>('speed') : null
      const r = viaAgent && !isOffline(viaAgent) ? viaAgent : await browserSpeedTest()
      setSpeed(r)
      say(viaAgent && !isOffline(viaAgent) ? 'speedResult' : 'speedHere', { down: r.downMbps, up: r.upMbps, ping: r.pingMs })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }
  const dns = async () => {
    const name = ask('dnsPrompt')
    if (!name) return
    try {
      // Cloudflare DNS over HTTPS answers straight from the browser, no agent needed
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=A`, { headers: { accept: 'application/dns-json' } })
      const j = (await r.json()) as { Answer?: { data: string; type: number }[] }
      const ips = (j.Answer ?? []).filter((a) => a.type === 1).map((a) => a.data)
      setNote(ips.length ? `${name} → ${ips.join(', ')}` : t('dnsNone', { name }))
    } catch (e) {
      fail(e)
    }
  }
  const pickBle = async () => {
    const bt = (navigator as Navigator & { bluetooth?: { requestDevice: (o: { acceptAllDevices: boolean }) => Promise<{ name?: string; id: string }> } }).bluetooth
    if (!bt) return setBle(t('bleNoSupport'))
    try {
      const d = await bt.requestDevice({ acceptAllDevices: true })
      setBle(t('blePicked', { name: d.name || d.id }))
    } catch {
      /* the person closed the picker */
    }
  }
  const askIp = (k: NetKey, fn: (ip: string) => void) => {
    const ip = ask(k)
    if (!ip) return
    if (!isPrivateIPv4(ip)) return say('privateOnly')
    fn(ip)
  }

  const list = devs?.devices ?? []
  const nets = wifi?.networks ?? []
  const tip = nets.length ? channelTip(nets, wifi?.ssid ?? null) : null
  const status = demo ? t('demoOn') : off ? (off.why === 'not set up' ? t('agentNotSetUp') : t('agentOff')) : t('agentLive')
  const shown = live || !!off?.snapshot || demo
  const startDemo = () => {
    setDevs(DEMO_DEVICES)
    setWifi(DEMO_WIFI)
    setDemo(true)
  }
  const stopDemo = () => {
    setDemo(false)
    setDevs(null)
    setWifi(null)
    void scan(false)
  }

  return (
    <main className="net-page">
      <div className="hub-head">
        <div className="net-title">
          <button className="btn net-back" onClick={onBack}>{t('back')}</button>
          <span className="hub-hello">{t('title')}</span>
        </div>
        <div className="net-status">
          <span className={`net-dot${live ? ' on' : ''}`} />
          <span className="small">{status}</span>
          <LangSwitch />
        </div>
      </div>

      {demo && (
        <p className="net-demo small">
          <span>{t('demoNote')}</span>
          <button className="btn" onClick={stopDemo}>{t('demoExit')}</button>
        </p>
      )}

      {off && !demo && (
        <section className="bf-card net-setup">
          <header><h3>{t('setupTitle')}</h3></header>
          <p className="muted">{t('setupWhy')}</p>
          {off.snapshot && <p className="small">{t('lastScan', { when: hhmm(off.snapshot.at) })}</p>}
          <div className="bf-acts">
            <a className="btn prime" href={GUIDE} target="_blank" rel="noreferrer noopener">{t('setupGuide')}</a>
            {!off.snapshot && <button className="btn" onClick={startDemo}>{t('demoTry')}</button>}
          </div>
        </section>
      )}

      {shown && (
      <section className="net-sum">
        <div className="net-wifi-name">
          <b>{wifi?.ssid ?? '—'}</b>
          <small className="muted">{list.find((d) => d.router)?.ip ?? ''}</small>
        </div>
        <div className="net-kpi"><small>{t('devicesKpi')}</small><b className="mono">{devs ? list.length : '—'}</b></div>
        <div className="net-kpi warn"><small>{t('newKpi')}</small><b className="mono">{devs ? list.filter((d) => d.isNew).length : '—'}</b></div>
        <div className="net-kpi"><small>{t('nearbyKpi')}</small><b className="mono">{wifi ? new Set(nets.map((n) => n.ssid)).size : '—'}</b></div>
        <div className="net-kpi"><small>{t('speedKpi')}</small><b className="mono">{speed ? `${Math.round(speed.downMbps)} / ${Math.round(speed.upMbps)}` : '—'}</b></div>
        <button className="btn prime" disabled={busy} onClick={() => void scan(true)}>{busy ? t('scanning') : t('rescan')}</button>
      </section>
      )}

      {note && <p className="net-note" role="status">{note}</p>}

      <div className={`net-grid${shown ? "" : " bare"}`}>
        {shown && (
        <section className="bf-card net-devices">
          <header><h3>{t('devices')}</h3></header>
          {!list.length && <p className="muted">{t('noDevices')}</p>}
          {list.map((d) => {
            const me = devs?.me.includes(d.ip)
            return (
              <div key={d.mac} className={`net-row${d.isNew ? ' alert' : ''}`}>
                <div className="net-row-main">
                  <b>{d.name ?? (me ? 'PC' : t('unknownDevice'))}</b>
                  <small className="mono">{d.ip} · {d.mac}</small>
                </div>
                <span className="small muted">{d.vendor ?? t('unknownMaker')}</span>
                <span className="net-flags">
                  {d.isNew && <em className="flag new">{t('flagNew')}</em>}
                  {me && <em className="flag me">{t('flagMe')}</em>}
                  {d.router && <em className="flag">{t('flagRouter')}</em>}
                  {d.trusted && <em className="flag ok">{t('flagTrusted')}</em>}
                </span>
                <span className="net-acts">
                  <button disabled={!live} onClick={() => { const n = ask('renamePrompt'); if (n) void update(d.mac, { name: n }) }}>{t('rename')}</button>
                  {!d.trusted && <button disabled={!live} onClick={() => void update(d.mac, { trusted: true })}>{t('trust')}</button>}
                  <button disabled={!live} onClick={() => void pingIp(d.ip)}>{t('ping')}</button>
                  <button disabled={!live} onClick={() => void portsIp(d.ip)}>{t('checkPorts')}</button>
                </span>
              </div>
            )
          })}
          {!!devs?.offline.length && (
            <details className="net-offline">
              <summary className="small muted">{t('offlineDevices', { n: devs.offline.length })}</summary>
              {devs.offline.map((o) => (
                <div key={o.mac} className="net-row off">
                  <div className="net-row-main"><b>{o.name ?? t('unknownDevice')}</b><small className="mono">{o.mac}</small></div>
                  <span className="small muted">{hhmm(o.lastSeen)}</span>
                  <span />
                  <span className="net-acts"><button disabled={!live} onClick={() => void wake(o.mac)}>{t('wake')}</button></span>
                </div>
              ))}
            </details>
          )}
        </section>

        )}

        {shown && (
        <section className="bf-card net-analyzer">
          <header><h3>{t('analyzer')}</h3></header>
          {wifi && !wifi.supported && <p className="muted">{t('wifiUnsupported')}</p>}
          {wifi?.supported && !nets.length && <p className="muted">{t('noNetworks')}</p>}
          {!!nets.length && <ChannelChart nets={nets} own={wifi?.ssid ?? null} />}
          {tip && tip.current != null && <p className="net-tip">{tip.shouldMove ? t('tipMove', { cur: tip.current, best: tip.best }) : t('tipOk', { best: tip.best })}</p>}
          <div className="net-nets">
            {[...nets].sort((a, b) => b.signal - a.signal).slice(0, 8).map((n) => (
              <div key={n.bssid}>
                <span className="net-bars" style={{ ['--s' as string]: `${n.signal}%` }}><i /></span>
                <b>{n.ssid}</b>
                <small className="muted">{n.signal}% · ch {n.channel} · {/open/i.test(n.auth) ? t('open') : n.auth}</small>
              </div>
            ))}
          </div>
        </section>

        )}

        <section className="bf-card net-ble">
          <header><h3>{t('ble')}</h3></header>
          <button className="btn" onClick={() => void pickBle()}>{t('blePick')}</button>
          {ble && <p className="small">{ble}</p>}
          <p className="small muted">{t('bleNote')}</p>
        </section>

        <section className="bf-card net-tools">
          <header><h3>{t('tools')}</h3></header>
          <div className="net-tg">
            <button disabled={busy} onClick={() => void runSpeed()}><b>{t('speedTest')}</b><small>{live && !demo ? t('speedNote') : t('speedNoteHere')}</small></button>
            <button onClick={() => void dns()}><b>{t('dns')}</b><small>{t('dnsNote')}</small></button>
            <button onClick={() => askIp('ipPrompt', (ip) => void pingIp(ip))}><b>{t('pingTool')}</b><small>{live ? t('pingNote') : t('needAgent')}</small></button>
            <button onClick={() => askIp('ipPrompt', (ip) => void portsIp(ip))}><b>{t('portsTool')}</b><small>{live ? t('portsNote') : t('needAgent')}</small></button>
            <button onClick={() => { const m = ask('macPrompt'); if (m) void wake(m) }}><b>{t('wolTool')}</b><small>{live ? t('wolNote') : t('needAgent')}</small></button>
          </div>
          <p className="small muted">{t('soonAlert')}</p>
          <p className="small muted">{t('legal')}</p>
        </section>
      </div>
    </main>
  )
}
