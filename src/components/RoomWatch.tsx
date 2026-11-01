import { useEffect, useRef, useState } from 'react'
import { NodeLink, serialApi } from '../lib/ruviewSerial'
import { S3KitBar } from './S3KitBar'
import { useRuviewT } from '../lib/ruviewText'
import { detectFirmware, parseVitalsLine, roomChange, roomState, type KitFirmware, type RoomVitals } from '../lib/s3Kit'

const STALE_MS = 30000
const keyOf = { empty: 'rwEmpty', still: 'rwStill', moving: 'rwMoving' } as const
const logKey = { enter: 'rwEnter', leave: 'rwLeave', fall: 'rwFall' } as const

/** Echo "room watch": one ESP32-S3 on USB, read through Web Serial. The board does the maths; this only shows its result line. */
export function RoomWatch({ onNexus }: { onNexus?: () => void }) {
  const t = useRuviewT()
  const link = useRef<NodeLink | null>(null)
  const last = useRef<RoomVitals | null>(null)
  const [on, setOn] = useState(false)
  const [fw, setFw] = useState<KitFirmware>('unknown')
  const [v, setV] = useState<RoomVitals | null>(null)
  const [at, setAt] = useState(0)
  const [now, setNow] = useState(0)
  const [log, setLog] = useState<{ at: number; key: 'enter' | 'leave' | 'fall' }[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [on])
  useEffect(() => () => void link.current?.close(), [])

  const stop = async () => {
    await link.current?.close()
    link.current = null
    last.current = null
    setOn(false)
    setV(null)
    setFw('unknown')
  }
  const start = async () => {
    setErr(null)
    try {
      const l = await NodeLink.open()
      link.current = l
      l.onLine((line) => {
        const f = detectFirmware(line)
        if (f !== 'unknown') setFw(f)
        const r = parseVitalsLine(line)
        if (!r) return
        const ch = roomChange(last.current, r)
        last.current = r
        const ts = Date.now()
        setV(r)
        setAt(ts)
        setNow(ts)
        if (ch) setLog((a) => [{ at: ts, key: ch }, ...a].slice(0, 8))
      })
      setNow(Date.now())
      setAt(Date.now())
      setOn(true)
    } catch (e) {
      const m = e instanceof Error ? e : new Error(String(e))
      if (m.name !== 'NotFoundError') setErr(m.message)
    }
  }

  const state = v ? roomState(v) : null
  const staleS = on && now - at > STALE_MS ? Math.round((now - at) / 1000) : 0
  return (
    <section className="bf-card rv-watch">
      <header><h3>{t('rwTitle')}</h3>{on && fw === 'ruview' && <em className="flag">{t('rwFwRuview')}</em>}</header>
      <S3KitBar mode="echo" firmware={fw} connected={on} onSwitch={onNexus} />
      {!on && <p className="muted">{t('rwWhy')}</p>}
      {!serialApi() && <p className="muted">{t('noSerial')}</p>}
      {err && <p className="net-note" role="status">{t('rwErr', { msg: err })}</p>}
      {on && fw === 'nexus-scout' && <p className="net-note" role="status">{t('rwFwNexus')}</p>}
      {on && !v && <p className="muted">{t('rwWaiting')}</p>}
      {staleS > 0 && <p className="net-note" role="status">{t('rwStale', { s: staleS })}</p>}
      {v && state && (
        <>
          <div className={`rv-room p-${state === 'empty' ? 'absent' : state}`}>
            <div className="rv-big"><i />{t(keyOf[state])}</div>
          </div>
          <div className="rv-kv">
            <div><span>{t('breathing')}</span><b className="mono">{v.breathing != null ? Math.round(v.breathing) : '—'}<small>{t('perMin')}</small></b></div>
            <div><span>{t('heart')}</span><b className="mono">{v.heart != null ? Math.round(v.heart) : '—'}<small>{t('perMin')}</small></b></div>
          </div>
          <p className="small muted">{t('people', { n: v.persons })} · {t('notMedical')}</p>
        </>
      )}
      {log.length > 0 && (
        <details open>
          <summary className="small">{t('rwLog')}</summary>
          <ul className="small">{log.map((x) => <li key={x.at}>{new Date(x.at).toLocaleTimeString()} · {t(logKey[x.key])}</li>)}</ul>
        </details>
      )}
      <div className="bf-acts">
        {on ? <button className="btn" onClick={() => void stop()}>{t('rwStop')}</button> : serialApi() && <button className="btn prime" onClick={() => void start()}>{t('rwConnect')}</button>}
      </div>
      <p className="small muted">{t('rwTip')}</p>
    </section>
  )
}
