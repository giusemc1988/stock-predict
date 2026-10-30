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
export function NovaClipPreview({ ids, script }: { ids: string[]; script: Script }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [pick, setPick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const ref = useRef<HTMLVideoElement>(null)
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
            <div className="nv-clip-txt en"><span>EN</span><p>{script.en[idx]}</p></div>
            <div className="nv-clip-txt vi"><span>VI</span><p>{script.vi[idx]}</p></div>
          </>
        )}
      </div>
      <p className="muted small">{t('clipNote')}</p>
    </div>
  )
}
