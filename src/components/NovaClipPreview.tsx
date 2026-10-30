import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { NovaProgress } from './NovaProgress'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { plan } from '../lib/studio/render'
import type { Script } from '../lib/studio/script'

/** Which slide shows at time t when the lines are spread evenly over the clip. */
export function slideAt(n: number, duration: number, t: number): number {
  if (n < 1 || !(duration > 0)) return 0
  return Math.max(0, Math.min(n - 1, Math.floor((t / duration) * n)))
}

/** Nova Footage: a clip you added, played with the EN and VI lines over it. Preview only: the file is not changed. */
export function NovaClipPreview({ ids, script, topic, onSent }: { ids: string[]; script: Script; topic: string; onSent?: () => void }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [pick, setPick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const ref = useRef<HTMLVideoElement>(null)
  const [smooth, setSmooth] = useState(false)
  const [textTop, setViPos] = useState(6)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const id = ids[Math.min(pick, ids.length - 1)]
  useEffect(() => {
    setLoading(true)
    setTime(0)
  }, [id])
  const n = Math.min(script.en.length, script.vi.length)
  // same spans the render uses (no fades), stretched to the clip's own length
  const spans = useMemo(() => (dur > 0 && n ? plan(script, '9:16', false, [], dur).spans : []), [script, dur, n])
  const i = spans.length ? Math.max(0, spans.findIndex((s) => time < s.end)) : slideAt(n, dur, time)
  const idx = Math.min(i < 0 ? n - 1 : i, Math.max(0, n - 1))
  const make = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch('/api/studio/overlay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ media: id, en: script.en, vi: script.vi, topic, smooth60: smooth, textTop }) })
      const j = (await r.json().catch(() => null)) as { error?: string } | null
      if (!r.ok) throw new Error(j?.error === 'busy' ? 'busy' : `HTTP ${r.status} ${j?.error ?? ''}`.trim())
      setMsg(t('clipSent'))
      onSent?.()
    } catch (e) {
      setMsg(`${t('clipFail')}: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }
  if (!id) return null
  return (
    <div className="nv-clip">
      <strong className="small">{t('clipTitle')}</strong>
      {ids.length > 1 && (
        <div className="vs-row">
          {ids.map((x, k) => (
            <button key={x} className={`btn small${k === pick ? ' primary' : ''}`} onClick={() => setPick(k)}>{t('clipPick')} {k + 1}</button>
          ))}
        </div>
      )}
      <NovaProgress active={loading} label={t('clipLoading')} secs={8} />
      <div className="nv-clip-box">
        <video
          ref={ref}
          key={id}
          src={`/api/studio/media-file?id=${id}`}
          controls
          playsInline
          muted
          loop
          preload="metadata"
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onLoadedData={() => setLoading(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onSeeked={(e) => setTime(e.currentTarget.currentTime)}
        />
        {n > 0 && (
          <>
            <div className="nv-clip-txt" style={{ top: `${textTop}%` }}>
              <p className="en">{script.en[idx]}</p>
              <p className="vi">{script.vi[idx]}</p>
            </div>
          </>
        )}
      </div>
      <p className="muted small">{t('clipNote')}</p>
      <label className="vs-field">
        <span className="small muted">{t('clipViPos')}: <b>{textTop}%</b></span>
        <input type="range" min={3} max={70} value={textTop} onChange={(e) => setViPos(Number(e.target.value))} />
      </label>
      <label className="small"><input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} /> {t('clipSmooth')}</label>
      <div className="vs-row">
        <button className="btn primary" disabled={busy || n < 1} onClick={() => void make()}>{t('clipMake')}</button>
        <NovaProgress active={busy} label={t('serverSending')} secs={6} />
      </div>
      {msg && <p className="small">{msg}</p>}
    </div>
  )
}
