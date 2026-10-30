import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { NovaProgress } from './NovaProgress'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { MAX_CLIP_SECONDS, MAX_MEDIA_BYTES, MAX_MEDIA_FILES, MEDIA_TYPES } from '../lib/studioMedia'

/** shorter side, in px; MoneyPrinterTurbo drops smaller footage */
const MIN_SIDE = 480
const TRIES = 3

interface Up {
  key: number
  id?: string
  kind: 'image' | 'video'
  thumb: string
  status: 'checking' | 'uploading' | 'ready' | 'error'
  progress: number
  error?: StudioKey | string
}

/** Width, height and (for a clip) length, read on the phone before anything is sent. */
async function probe(file: File, url: string): Promise<{ w: number; h: number; s: number }> {
  if (file.type.startsWith('video/')) {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.src = url
    // a clip the phone cannot decode may fire neither event: do not wait on it forever
    await new Promise<void>((ok, bad) => {
      const t = setTimeout(() => bad(new Error('unreadable')), 6000)
      v.onloadedmetadata = () => (clearTimeout(t), ok())
      v.onerror = () => (clearTimeout(t), bad(new Error('unreadable')))
    })
    return { w: v.videoWidth, h: v.videoHeight, s: v.duration || 0 }
  }
  const img = await createImageBitmap(file)
  const out = { w: img.width, h: img.height, s: 0 }
  img.close()
  return out
}

const BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }
/** The type the server accepts: phones often hand over an empty type or video/x-m4v for a plain MP4. */
function typeOf(file: File): string {
  if (MEDIA_TYPES[file.type]) return file.type
  return BY_EXT[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? file.type
}

async function send(file: File, type: string, onProgress: (p: number) => void): Promise<string> {
  const start = await fetch('/api/studio/media', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, size: file.size }) })
  const s = (await start.json().catch(() => null)) as { id?: string; chunk?: number; parts?: number; error?: string } | null
  if (!start.ok || !s?.id || !s.chunk || !s.parts) throw new Error(s?.error === 'full' ? 'upErrFull' : (s?.error ?? `HTTP ${start.status}`))
  for (let i = 0; i < s.parts; i++) {
    const part = file.slice(i * s.chunk, (i + 1) * s.chunk)
    let ok = false
    let why = 'upFailed'
    // a phone on mobile data drops now and then: each part gets a few tries
    for (let t = 0; t < TRIES && !ok; t++) {
      const r = await fetch(`/api/studio/media?id=${s.id}&i=${i}`, { method: 'PUT', body: part }).catch(() => null)
      ok = !!r?.ok
      // keep the server's reason (e.g. the free KV limit) so the phone shows why, not just "failed"
      if (r && !ok) why = `HTTP ${r.status} ${((await r.text().catch(() => '')) || '').slice(0, 80)}`.trim()
    }
    if (!ok) throw new Error(why)
    onProgress((i + 1) / s.parts)
  }
  const fin = await fetch(`/api/studio/media?id=${s.id}`, { method: 'PATCH' })
  if (!fin.ok) throw new Error(`HTTP ${fin.status} ${((await fin.text().catch(() => '')) || '').slice(0, 80)}`.trim())
  return s.id
}

/** Nova step 3: the user's own photos and clips for the server video, uploaded in parts and used in this order. */
export function NovaUploads({ onChange, importLink = true }: { onChange: (ids: string[]) => void; importLink?: boolean }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [items, setItems] = useState<Up[]>([])
  const [link, setLink] = useState('')
  const next = useRef(0)
  const patch = (key: number, p: Partial<Up>) => setItems((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)))

  const ready = items.filter((x) => x.status === 'ready' && x.id).map((x) => x.id!).join()
  useEffect(() => {
    onChange(ready ? ready.split(',') : [])
  }, [ready, onChange])
  useEffect(() => () => items.forEach((x) => URL.revokeObjectURL(x.thumb)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const add = (files: FileList | null) => {
    const room = MAX_MEDIA_FILES - items.length
    for (const file of [...(files ?? [])].slice(0, Math.max(0, room))) {
      const key = next.current++
      const type = typeOf(file)
      const kind = type.startsWith('video/') ? 'video' : 'image'
      const thumb = URL.createObjectURL(file)
      setItems((list) => [...list, { key, kind, thumb, status: 'checking', progress: 0 }])
      void (async () => {
        try {
          if (!MEDIA_TYPES[type]) throw new Error('upErrType')
          if (file.size > MAX_MEDIA_BYTES) throw new Error('upErrSize')
          // a format this browser cannot read (0 x 0) is left for the server to judge
          patch(key, { status: 'checking' })
          const { w, h, s } = await probe(file, thumb).catch(() => ({ w: 0, h: 0, s: 0 }))
          if (w && h && Math.min(w, h) < MIN_SIDE) throw new Error('upErrSmall')
          if (s > MAX_CLIP_SECONDS + 0.5) throw new Error('upErrLong')
          patch(key, { status: 'uploading' })
          const id = await send(file, type, (p) => patch(key, { progress: p }))
          patch(key, { id, status: 'ready', progress: 1 })
        } catch (e) {
          patch(key, { status: 'error', error: (e as Error).message })
        }
      })()
    }
  }

  const fetchLink = () => {
    const url = link.trim()
    if (items.length >= MAX_MEDIA_FILES) return
    const key = next.current++
    setLink('')
    setItems((list) => [...list, { key, kind: 'video', thumb: '', status: 'uploading', progress: 0 }])
    void (async () => {
      try {
        if (!/^https:\/\/([a-z0-9-]+\.)*muse\.ai\//i.test(url)) throw new Error('upLinkBad')
        const post = (method: string, body: unknown) => fetch('/api/studio/media-import', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        const start = await post('POST', { url })
        const s = (await start.json().catch(() => null)) as { id?: string; parts?: number; error?: string } | null
        if (!start.ok || !s?.id || !s.parts) throw new Error(s?.error === 'full' ? 'upErrFull' : s?.error === 'type' ? 'upErrType' : s?.error === 'size' ? 'upErrSize' : `HTTP ${start.status} ${s?.error ?? ''}`.trim())
        for (let i = 0; i < s.parts; i++) {
          let ok = false
          let why = 'upFailed'
          for (let n = 0; n < TRIES && !ok; n++) {
            const r = await post('PUT', { url, id: s.id, i }).catch(() => null)
            ok = !!r?.ok
            if (r && !ok) why = `HTTP ${r.status} ${((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? ''}`.trim()
          }
          if (!ok) throw new Error(why)
          patch(key, { progress: (i + 1) / s.parts })
        }
        const fin = await fetch(`/api/studio/media?id=${s.id}`, { method: 'PATCH' })
        if (!fin.ok) throw new Error(`HTTP ${fin.status}`)
        patch(key, { id: s.id, status: 'ready', progress: 1 })
      } catch (e) {
        patch(key, { status: 'error', error: (e as Error).message })
      }
    })()
  }

  const remove = (x: Up) => {
    if (x.id) void fetch(`/api/studio/media?id=${x.id}`, { method: 'DELETE' }).catch(() => null)
    if (x.thumb) URL.revokeObjectURL(x.thumb)
    setItems((list) => list.filter((y) => y.key !== x.key))
  }
  const earlier = (i: number) => setItems((list) => (i < 1 ? list : [...list.slice(0, i - 1), list[i], list[i - 1], ...list.slice(i + 1)]))
  const full = items.length >= MAX_MEDIA_FILES
  const msg = (e?: string) => (e && e in STUDIO_TEXT ? t(e as StudioKey) : `${t('upFailed')}: ${e}`)

  return (
    <div className="nv-up">
      <div className="vs-lab-row">
        <strong className="small">{t('upTitle')}</strong>
        <span className="small muted">{items.length}/{MAX_MEDIA_FILES}</span>
      </div>
      <label className={`nv-drop${full ? ' off' : ''}`}>
        <input type="file" accept={`${Object.keys(MEDIA_TYPES).join(",")},video/*,image/*`} multiple disabled={full} onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        <span>＋ {t('upAdd')}</span>
      </label>
      {importLink && (
        <div className="vs-row">
          <input className="vs-input" type="url" inputMode="url" placeholder={t('upLink')} value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="btn small" disabled={full || !link.trim()} onClick={fetchLink}>{t('upLinkGo')}</button>
        </div>
      )}
      <p className="muted small">{t('upNote')}</p>
      {items.some((x) => x.status === 'uploading' || x.status === 'checking') && (
        <NovaProgress label={t('upUploading')} value={items.reduce((a, x) => a + (x.status === 'ready' || x.status === 'error' ? 1 : x.progress), 0) / items.length} />
      )}
      {items.length > 0 && (
        <div className="nv-up-grid">
          {items.map((x, i) => (
            <div key={x.key} className={`nv-up-tile s-${x.status}`}>
              {!x.thumb ? <div className="nv-up-ph" /> : x.kind === 'video' ? <video src={x.thumb} muted playsInline preload="metadata" /> : <img src={x.thumb} alt="" />}
              <span className="nv-up-n">{i + 1}</span>
              {x.status !== 'ready' && x.status !== 'error' && <span className="nv-up-bar" style={{ width: `${Math.round(x.progress * 100)}%` }} />}
              <div className="nv-up-act">
                {i > 0 && <button className="btn small" aria-label={t('upEarlier')} title={t('upEarlier')} onClick={() => earlier(i)}>←</button>}
                <button className="btn small" aria-label={t('serverDelete')} title={t('serverDelete')} onClick={() => remove(x)}>✕</button>
              </div>
              <span className={`nv-up-s small${x.status === 'error' ? ' warn' : ''}`}>
                {x.status === 'checking' ? t('upChecking') : x.status === 'uploading' ? `${t('upUploading')} ${Math.round(x.progress * 100)}%` : x.status === 'ready' ? `✓ ${t('upReady')}` : msg(x.error)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
