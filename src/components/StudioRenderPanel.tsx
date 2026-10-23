import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import type { RenderLang, RenderVoice, StudioJob } from '../lib/studioJobs'

type JobRow = Omit<StudioJob, 'lines' | 'terms'>
type KeyKind = 'pexels' | 'github'
const POLL_MS = 20_000
const STATUS: Record<StudioJob['status'], StudioKey> = { queued: 'statusQueued', rendering: 'statusRendering', done: 'statusDone', failed: 'statusFailed' }

/** Nova step 5: queue the script for MoneyPrinterTurbo on GitHub Actions, then play the finished MP4s. */
export function StudioRenderPanel({ topic, topicVi, en, vi, aspect, glass = false }: { topic: string; topicVi: string; en: string[]; vi: string[]; aspect: '9:16' | '16:9'; glass?: boolean }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [langs, setLangs] = useState<RenderLang[]>(['vi'])
  const [voice, setVoice] = useState<RenderVoice>('female')
  const [jobs, setJobs] = useState<JobRow[] | null>(null)
  const [keys, setKeys] = useState<Record<KeyKind, boolean>>({ pexels: false, github: false })
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/studio/jobs').catch(() => null)
    const j = (await r?.json().catch(() => null)) as { jobs?: JobRow[]; pexels?: boolean; github?: boolean } | null
    if (j?.jobs) {
      setJobs(j.jobs)
      setKeys({ pexels: !!j.pexels, github: !!j.github })
    }
  }, [])

  const waiting = !!jobs?.some((j) => j.status === 'queued' || j.status === 'rendering')
  useEffect(() => {
    void load()
    if (!waiting) return
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load, waiting])

  const make = async () => {
    setMsg(null)
    setBusy(true)
    try {
      const r = await fetch('/api/studio/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, topicVi, en, vi, langs, voice, aspect }) })
      const j = (await r.json().catch(() => ({}))) as { error?: string; kicked?: boolean }
      if (r.status === 429) setMsg(t('serverBusy'))
      else if (!r.ok) setMsg(`${t('serverFailed')} ${j.error ?? `HTTP ${r.status}`}`)
      else setMsg(t(j.kicked ? 'serverQueued' : 'serverQueuedSlow'))
      await load()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/studio/jobs?id=${id}`, { method: 'DELETE' }).catch(() => null)
    await load()
  }

  const toggle = (l: RenderLang | 'both') => setLangs(l === 'both' ? ['vi', 'en'] : [l])
  const both = langs.length === 2
  const ready = topic.trim() && langs.every((l) => (l === 'vi' ? vi : en).length > 0)

  const card = glass ? 'bf-card nv-card hg-glass' : 'bf-card'
  return (
    <>
    <div className={card}>
      <header><h3><span className="nv-n" aria-hidden="true">4</span>{t('serverTitle')}</h3></header>
      <p className="muted small">{t('serverNote')}</p>
      <div className="seg small" role="group" aria-label={t('serverLang')}>
        <button className={!both && langs[0] === 'vi' ? 'on' : ''} onClick={() => toggle('vi')}>VI</button>
        <button className={!both && langs[0] === 'en' ? 'on' : ''} onClick={() => toggle('en')}>EN</button>
        <button className={both ? 'on' : ''} onClick={() => toggle('both')}>{t('serverBoth')}</button>
      </div>
      <div className="seg small" role="group">
        {(['female', 'male'] as RenderVoice[]).map((v) => (
          <button key={v} className={voice === v ? 'on' : ''} onClick={() => setVoice(v)}>{t(v === 'female' ? 'serverFemale' : 'serverMale')}</button>
        ))}
      </div>
      <p className="muted small">{t(keys.pexels ? 'footagePexels' : 'footageOpenverse')}</p>
      {!keys.github && <p className="small warn">{t('githubSlow')}</p>}
      <div className="vs-row">
        <button className="btn primary" disabled={busy || !ready} onClick={() => void make()}>{t('serverMake')}</button>
      </div>
      {msg && <p className="small">{msg}</p>}
      <KeyBox kind="github" saved={keys.github} title={t('githubKey')} how={t('githubHow')} onSaved={(v) => setKeys((k) => ({ ...k, github: v }))} />
      <KeyBox kind="pexels" saved={keys.pexels} title={t('pexelsKey')} how={t('pexelsHow')} onSaved={(v) => setKeys((k) => ({ ...k, pexels: v }))} />
    </div>

    <div className={card}>
      <header><h3>{t('galleryTitle')}</h3>{jobs && jobs.length > 0 && <span className="small muted">{jobs.length}</span>}</header>
      {jobs && !jobs.length && <p className="small muted">{t('serverEmpty')}</p>}
      <div className="nv-gallery">
      {jobs?.map((j) => (
        <div key={j.id} className={`vs-job nv-tile s-${j.status}`}>
          <div className="vs-lab-row">
            <span className="small"><strong>{j.lang.toUpperCase()}</strong> · {j.topic}</span>
            <span className={`small ${j.status === 'failed' ? 'warn' : 'muted'}`}>{t(STATUS[j.status])}</span>
          </div>
          {j.status === 'failed' && j.error && <p className="small muted">{j.error}</p>}
          {j.status === 'done' && j.footage === 'gradient' && <p className="small muted">{t('footageGradient')}</p>}
          {j.status === 'done' && (
            <div className="vs-out">
              <video src={`/api/studio/video?id=${j.id}`} controls playsInline preload="metadata" />
            </div>
          )}
          <div className="vs-row">
            {j.status === 'done' && <a className="btn small primary" href={`/api/studio/video?id=${j.id}&download`}>{t('download')}{j.size ? ` (${(j.size / 1e6).toFixed(1)} MB)` : ''}</a>}
            {j.run && j.status !== 'done' && <a className="btn small" href={j.run} target="_blank" rel="noreferrer">{t('serverLog')}</a>}
            {j.status !== 'rendering' && <button className="btn small" onClick={() => void remove(j.id)}>{t('serverDelete')}</button>}
          </div>
        </div>
      ))}
      </div>
    </div>
    </>
  )
}

/** One optional key for the render farm: paste, check on the server, save; or remove. */
function KeyBox({ kind, saved, title, how, onSaved }: { kind: KeyKind; saved: boolean; title: string; how: string; onSaved: (saved: boolean) => void }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const save = async (drop: boolean) => {
    setMsg(null)
    const r = await fetch(`/api/studio/key?kind=${kind}`, drop ? { method: 'DELETE' } : { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) })
    const j = (await r.json().catch(() => ({}))) as Partial<Record<KeyKind, boolean>> & { error?: string }
    if (!r.ok) return setMsg(j.error ?? `HTTP ${r.status}`)
    onSaved(!!j[kind])
    setKey('')
  }
  return (
    <details className="vs-pexels">
      <summary className="small">{title}{saved ? ' ✓' : ''}</summary>
      <p className="muted small">{how}</p>
      <div className="vs-row">
        {!saved && <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={kind === 'github' ? 'github_pat_…' : 'Pexels API key'} autoComplete="off" />}
        {!saved && <button className="btn small" disabled={key.trim().length < 10} onClick={() => void save(false)}>{t('keySave')}</button>}
        {saved && <button className="btn small" onClick={() => void save(true)}>{t('keyRemove')}</button>}
      </div>
      {msg && <p className="small warn">{msg}</p>}
    </details>
  )
}
