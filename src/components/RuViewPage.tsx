import { useCallback, useEffect, useState } from 'react'
import { BOARDS, boardFromChip, boardOf, CSI_PORT, flashCommand, mergeNodes, nextNodeId, presenceOf, RUVIEW, RUVIEW_IMAGE, RUVIEW_RELEASE_URL, type BoardId, type LiveNode, type RegistryNode, type SensingLatest, type Vitals } from '../lib/ruview'
import { configLine, helloLine, makeNonce, NodeLink, parseConfigReply, parseHello, serialApi, type Hello } from '../lib/ruviewSerial'
import { useRuviewT, type RuviewKey } from '../lib/ruviewText'
import { LangSwitch } from './HubPanels'

type Offline = { offline: true; why: string; snapshot: { at: number; data: unknown } | null }
type Down = { down: true; why: string }
interface Status {
  up: boolean
  source?: string | null
  version?: string | null
  image: string | null
  pinned: string
  why?: string
}

const GUIDE = 'https://github.com/giusemc1988/stock-predict/blob/main/agent/README.md#ruview'
const START_SIM = 'npm run ruview -- sim'

async function call<T>(path: string, init?: RequestInit): Promise<T | Offline> {
  const r = await fetch(`/api/home/ruview/${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const j = (await r.json().catch(() => ({ error: `HTTP ${r.status}` }))) as T | Offline | { error: string }
  if (j && typeof j === 'object' && 'error' in j) throw new Error(j.error)
  return j as T | Offline
}
const isOffline = (v: unknown): v is Offline => !!v && typeof v === 'object' && (v as Offline).offline === true
const isDown = (v: unknown): v is Down => !!v && typeof v === 'object' && (v as Down).down === true

function CopyLine({ text }: { text: string }) {
  const t = useRuviewT()
  const [done, setDone] = useState(false)
  return (
    <div className="rv-cmd">
      <code>{text}</code>
      <button className="btn" onClick={() => void navigator.clipboard?.writeText(text).then(() => setDone(true))}>{done ? t('copied') : t('copy')}</button>
    </div>
  )
}

/** Step-by-step "add a node": pick board, flash the pinned firmware, then set Wi-Fi and node number over USB. */
function AddNode({ reg, me, onSaved, onClose }: { reg: RegistryNode[]; me: string[]; onSaved: (n: RegistryNode) => Promise<void>; onClose: () => void }) {
  const t = useRuviewT()
  const [board, setBoard] = useState<BoardId>('s3-8mb')
  const [hello, setHello] = useState<Hello | null>(null)
  const [link, setLink] = useState<NodeLink | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ room: '', id: nextNodeId(reg), ssid: '', password: '', pc: me[0] ?? '', port: CSI_PORT, antenna: 'internal' as 'internal' | 'external' })
  const b = boardOf(board) ?? BOARDS[0]
  const cmd = flashCommand(b)
  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => () => void link?.close(), [link])

  const connect = async () => {
    setMsg(null)
    setBusy(true)
    try {
      const l = await NodeLink.open()
      setLink(l)
      setMsg(t('talking'))
      const nonce = makeNonce()
      await l.send(helloLine(nonce))
      const h = await l.waitFor((line) => {
        const p = parseHello(line)
        return p && p.nonce.toLowerCase() === nonce ? p : null
      })
      if (!h) return setMsg(t('noAnswer'))
      setHello(h)
      const guess = boardFromChip(h.chip)
      if (guess && boardOf(board)?.chip !== h.chip) setBoard(guess)
      if (h.nodeId) set('id', h.nodeId)
      setMsg(t('found', { chip: h.chip, ver: h.version, id: h.nodeId || '—' }))
    } catch (e) {
      if (e instanceof Error && e.name !== 'NotFoundError') setMsg(t('error', { msg: e.message }))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!link) return
    setBusy(true)
    try {
      // a fresh nonce each time: the board only accepts a setup line within a minute of its hello
      const nonce = makeNonce()
      await link.send(helloLine(nonce))
      const h = await link.waitFor((line) => {
        const p = parseHello(line)
        return p && p.nonce.toLowerCase() === nonce ? p : null
      })
      if (!h) return setMsg(t('noAnswer'))
      const c = configLine({ nonce, nodeId: Number(form.id), targetIp: form.pc, targetPort: Number(form.port), ssid: form.ssid, password: form.password })
      if ('error' in c) return setMsg(t(`e${c.error[0].toUpperCase()}${c.error.slice(1)}` as RuviewKey))
      await link.send(c.line)
      const r = await link.waitFor(parseConfigReply, 6000)
      if (!r) return setMsg(t('noAnswer'))
      if (!r.ok) return setMsg(t('boardSaid', { reason: r.reason }))
      setForm((f) => ({ ...f, password: '' }))
      await onSaved({ id: Number(form.id), room: form.room, board, antenna: form.antenna, firmware: h.version, added: Date.now() })
      setMsg(t('saved'))
    } catch (e) {
      setMsg(t('error', { msg: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bf-card rv-wiz">
      <header>
        <h3>{t('wizTitle')}</h3>
        <button className="btn" onClick={onClose}>{t('close')}</button>
      </header>

      <h4>{t('wiz1')}</h4>
      <div className="rv-boards">
        {BOARDS.map((x) => (
          <button key={x.id} className={`${x.id === board ? 'on' : ''}${x.supported ? '' : ' no'}`} disabled={!x.supported} onClick={() => setBoard(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {b.research && <p className="small muted">{t('boardResearch')}</p>}
      <p className="small muted">{t('boardNo')} ESP32-C3, ESP32.</p>
      <p className="rv-warn small">{t('hwcheck')}</p>

      <h4>{t('wiz2', { ver: RUVIEW.release })}</h4>
      <p className="small">{t('wiz2Note', { file: b.bundle ?? '' })}</p>
      {cmd && <CopyLine text={cmd} />}
      <div className="bf-acts">
        <a className="btn" href={RUVIEW_RELEASE_URL} target="_blank" rel="noreferrer noopener">{t('openRelease')}</a>
      </div>
      <p className="small muted">{t('noWebFlash')}</p>

      <h4>{t('wiz3')}</h4>
      {serialApi() ? (
        <button className="btn prime" disabled={busy} onClick={() => void connect()}>{t('connectUsb')}</button>
      ) : (
        <p className="muted">{t('noSerial')}</p>
      )}

      {hello && (
        <>
          <h4>{t('wiz4')}</h4>
          <div className="rv-form">
            <label>{t('fRoom')}<input value={form.room} maxLength={40} onChange={(e) => set('room', e.target.value)} /></label>
            <label>{t('fId')}<input type="number" min={1} max={255} value={form.id} onChange={(e) => set('id', Number(e.target.value))} /></label>
            <label>{t('fSsid')}<input value={form.ssid} autoComplete="off" onChange={(e) => set('ssid', e.target.value)} /></label>
            <label>{t('fPass')}<input type="password" value={form.password} autoComplete="new-password" onChange={(e) => set('password', e.target.value)} /></label>
            <label>{t('fPc')}
              {me.length > 1 ? (
                <select value={form.pc} onChange={(e) => set('pc', e.target.value)}>{me.map((ip) => <option key={ip}>{ip}</option>)}</select>
              ) : (
                <input value={form.pc} placeholder="192.168.1.10" onChange={(e) => set('pc', e.target.value)} />
              )}
            </label>
            <label>{t('fPort')}<input type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} /></label>
            <label>{t('fAntenna')}
              <select value={form.antenna} onChange={(e) => set('antenna', e.target.value)}>
                <option value="internal">{t('antInternal')}</option>
                {b.externalAntenna && <option value="external">{t('antExternal')}</option>}
              </select>
            </label>
          </div>
          <p className="small muted">{t('fKeep')} {t('passStays')}</p>
          {b.externalAntenna && <p className="small muted">{t('antennaNote')}</p>}
          <button className="btn prime" disabled={busy} onClick={() => void save()}>{t('send')}</button>
        </>
      )}
      {msg && <p className="net-note" role="status">{msg}</p>}
    </section>
  )
}

/** RuView sensing (github.com/ruvnet/ruview) on the home PC, read through the home agent. */
export function RuViewPage({ onBack }: { onBack: () => void }) {
  const t = useRuviewT()
  const [off, setOff] = useState<Offline | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [latest, setLatest] = useState<SensingLatest | null>(null)
  const [live, setLive] = useState<LiveNode[]>([])
  const [vitals, setVitals] = useState<Vitals | null>(null)
  const [reg, setReg] = useState<RegistryNode[]>([])
  const [me, setMe] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([call<Status>('status'), call<{ nodes: RegistryNode[]; me: string[] }>('registry')])
      if (isOffline(s)) {
        setOff(s)
        setStatus(null)
      } else {
        setOff(null)
        setStatus(s)
      }
      if (isOffline(r)) {
        const snap = r.snapshot?.data as { nodes: RegistryNode[] } | undefined
        if (snap) setReg(snap.nodes)
      } else {
        setReg(r.nodes)
        setMe(r.me)
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => void load(), 0)
    return () => clearTimeout(id)
  }, [load])

  // live feed: room state every 3 s, nodes and vitals every 15 s, paused while the tab is hidden
  useEffect(() => {
    if (!status?.up) return
    let n = 0
    const tick = async () => {
      if (document.hidden) return
      const slow = n++ % 5 === 0
      const [l, ns, v] = await Promise.all([call<SensingLatest>('latest'), slow ? call<{ nodes: LiveNode[] }>('nodes') : null, slow ? call<Vitals>('vitals') : null]).catch(() => [null, null, null] as const)
      if (l && !isOffline(l) && !isDown(l)) setLatest(l)
      if (ns && !isOffline(ns) && !isDown(ns)) setLive(ns.nodes)
      if (v && !isOffline(v) && !isDown(v)) setVitals(v)
    }
    void tick()
    const id = setInterval(() => void tick(), 3000)
    return () => clearInterval(id)
  }, [status?.up])

  const saveNode = async (node: RegistryNode) => {
    await call('registry', { method: 'POST', body: JSON.stringify({ node }) })
    await load()
  }
  const removeNode = async (id: number) => {
    await call('registry', { method: 'POST', body: JSON.stringify({ remove: id }) })
    await load()
  }

  const p = presenceOf(latest)
  const pKey: Record<typeof p, RuviewKey> = { absent: 'pAbsent', still: 'pStill', moving: 'pMoving', stale: 'pStale', waiting: 'pWaiting' }
  const rows = mergeNodes(reg, live)
  const head = off ? (off.why === 'not set up' ? t('agentNotSetUp') : t('agentOff')) : status?.up ? t('live') : status ? t('serverDown') : '…'
  const vs = vitals?.authority === 'explicit_calibration' ? vitals.vital_signs : null
  const sim = /simulat/i.test(status?.source ?? latest?.source ?? '')
  const behind = !!status?.image && status.image !== RUVIEW_IMAGE

  return (
    <main className="net-page rv-page">
      <div className="hub-head">
        <div className="net-title">
          <button className="btn net-back" onClick={onBack}>{t('back')}</button>
          <span className="hub-hello">{t('title')} <em className="rv-beta">{t('beta')}</em></span>
        </div>
        <div className="net-status">
          <span className={`net-dot${status?.up ? ' on' : ''}`} />
          <span className="small">{head}</span>
          <LangSwitch />
        </div>
      </div>

      <p className="rv-privacy small">{t('privacy')}</p>

      {off && (
        <section className="bf-card net-setup">
          <header><h3>{t('setupAgentTitle')}</h3></header>
          <p className="muted">{t('setupAgentWhy')}</p>
          <a className="btn prime" href={GUIDE} target="_blank" rel="noreferrer noopener">{t('setupGuide')}</a>
        </section>
      )}
      {status && !status.up && (
        <section className="bf-card net-setup">
          <header><h3>{t('setupServerTitle')}</h3></header>
          <p className="muted">{t('setupServerWhy')}</p>
          <CopyLine text={START_SIM} />
          <a className="btn" href={GUIDE} target="_blank" rel="noreferrer noopener">{t('setupGuide')}</a>
        </section>
      )}
      {note && <p className="net-note" role="status">{t('error', { msg: note })}</p>}

      <div className="net-grid">
        {status?.up && (
          <section className={`bf-card rv-room p-${p}`}>
            <header>
              <h3>{t('room')}</h3>
              {sim && <em className="flag">{t('practiceData')}</em>}
            </header>
            <div className="rv-big"><i />{t(pKey[p])}</div>
            <p className="small muted">
              {latest?.classification && t('confidence', { n: Math.round(latest.classification.confidence * 100) })}
              {latest?.estimated_persons != null && ` · ${t('people', { n: latest.estimated_persons })}`}
              {latest?.age_ms != null && ` · ${t('updated', { s: Math.round(latest.age_ms / 1000) })}`}
            </p>
          </section>
        )}

        {status?.up && (
          <section className="bf-card rv-vitals">
            <header><h3>{t('vitals')}</h3></header>
            {vs ? (
              <div className="rv-kv">
                <div><span>{t('breathing')}</span><b className="mono">{vs.breathing_rate_bpm != null ? Math.round(vs.breathing_rate_bpm) : '—'}<small>{t('perMin')}</small></b></div>
                <div><span>{t('heart')}</span><b className="mono">{vs.heart_rate_bpm != null ? Math.round(vs.heart_rate_bpm) : '—'}<small>{t('perMin')}</small></b></div>
              </div>
            ) : (
              <p className="muted">{t('vitalsOff')}</p>
            )}
            <p className="small muted">{t('notMedical')}</p>
          </section>
        )}

        <section className="bf-card rv-nodes">
          <header>
            <h3>{t('nodes')}</h3>
            {!off && !adding && <button className="btn" onClick={() => setAdding(true)}>{t('addNode')}</button>}
          </header>
          {!rows.length && <p className="muted">{t('noNodes')}</p>}
          {rows.map((r) => (
            <div key={r.id} className="net-row">
              <div className="net-row-main">
                <b>#{r.id} {r.room || (r.added ? '' : t('nodeUnnamed'))}</b>
                <small className="mono">{boardOf(r.board)?.label} · {r.antenna === 'external' ? t('antExternal') : t('antInternal')}{r.firmware ? ` · fw ${r.firmware}` : ''}</small>
              </div>
              <span className={`small ${r.live?.status === 'active' ? 'up' : 'muted'}`}>
                {r.live ? (r.live.status === 'active' ? t('nodeLive') : t('nodeStale')) : t('nodeNever')}
                {r.live?.rssi_dbm != null && ` · ${r.live.rssi_dbm} dBm`}
              </span>
              <span className="net-flags">{r.behind && <em className="flag new">{t('nodeBehind')}</em>}</span>
              <span className="net-acts">{r.added > 0 && !off && <button onClick={() => void removeNode(r.id)}>{t('remove')}</button>}</span>
            </div>
          ))}
        </section>

        {adding && <AddNode reg={reg} me={me} onSaved={saveNode} onClose={() => setAdding(false)} />}

        <section className="bf-card rv-conns">
          <header><h3>{t('conns')}</h3></header>
          {(
            [
              ['cUsb', 'cUsbNote', serialApi() ? 'ready' : 'notYet'],
              ['cWifi', 'cWifiNote', status?.up ? 'ready' : 'notYet'],
              ['cMqtt', 'cMqttNote', 'optional'],
              ['cWebUsb', 'cWebUsbNote', 'notNeeded'],
              ['cBle', 'cBleNote', 'notYet'],
            ] as [RuviewKey, RuviewKey, RuviewKey][]
          ).map(([name, d, s]) => (
            <div key={name} className="rv-conn">
              <b>{t(name)}</b>
              <em className={`flag${s === 'ready' ? ' ok' : ''}`}>{t(s)}</em>
              <small className="muted">{t(d, { port: CSI_PORT })}</small>
            </div>
          ))}
        </section>

        <section className="bf-card rv-ver">
          <header><h3>{t('versions')}</h3></header>
          <div className="rv-kv">
            <div><span>{t('pinned')}</span><b className="mono">{RUVIEW.release}</b></div>
            <div><span>{t('running')}</span><b className="mono">{status?.image ? status.image.split(':')[1] ?? status.image : t('unknown')}</b></div>
            <div><span>{t('firmware')}</span><b className="mono">{RUVIEW.firmware}</b></div>
          </div>
          {status?.image && <p className={`small ${behind ? 'rv-warn' : 'muted'}`}>{behind ? t('updateReady', { ver: RUVIEW.release }) : t('upToDate')}</p>}
          <p className="small muted">{t('updateHow')}</p>
          <a className="small" href={RUVIEW_RELEASE_URL} target="_blank" rel="noreferrer noopener">{RUVIEW.upstream.replace('https://', '')}</a>
        </section>

        <section className="bf-card rv-acc">
          <header><h3>{t('accuracy')}</h3></header>
          <ul className="small">
            <li>{t('acc1')}</li>
            <li>{t('acc2')}</li>
            <li>{t('acc3')}</li>
            <li>{t('acc4')}</li>
          </ul>
          <p className="bf-source">{t('source')}</p>
        </section>
      </div>
    </main>
  )
}
