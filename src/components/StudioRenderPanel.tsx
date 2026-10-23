import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLang } from '../lib/i18n'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { DEFAULT_RENDER_OPTS, TRANSITIONS, cleanRenderOpts, type RenderAspect, type RenderLang, type RenderOpts, type RenderVoice, type StudioJob } from '../lib/studioJobs'

type JobRow = Omit<StudioJob, 'lines' | 'terms'>
export type KeyKind = 'pexels' | 'github' | 'youtube'
const POLL_MS = 20_000
const STATUS: Record<StudioJob['status'], StudioKey> = { queued: 'statusQueued', rendering: 'statusRendering', done: 'statusDone', failed: 'statusFailed' }

/** Nova step 5: queue the script for MoneyPrinterTurbo on GitHub Actions, then play the finished MP4s. */
export function StudioRenderPanel({ topic, topicVi, en, vi, aspect, glass = false, settings = false, hook, onClearHook }: { topic: string; topicVi: string; en: string[]; vi: string[]; aspect: RenderAspect; glass?: boolean; settings?: boolean; hook?: { en: string; vi: string }; onClearHook?: () => void }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [langs, setLangs] = useState<RenderLang[]>(['vi'])
  const [voice, setVoice] = useState<RenderVoice>('female')
  const [jobs, setJobs] = useState<JobRow[] | null>(null)
  const [keys, setKeys] = useState<Record<'pexels' | 'github', boolean>>({ pexels: false, github: false })
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedOpts, setSavedOpts] = useLocalStorage<Partial<RenderOpts>>('nova.video.v1', {})
  // video settings (AI rule novaVideoSettings); off = Nova's defaults
  const opts = useMemo(() => (settings ? cleanRenderOpts(savedOpts) : DEFAULT_RENDER_OPTS), [settings, savedOpts])

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
      const r = await fetch('/api/studio/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, topicVi, en, vi, langs, voice, aspect, opts, hook: settings ? hook : undefined }) })
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
      {settings && <VideoSettings opts={opts} onChange={(o) => setSavedOpts(o)} />}
      {settings && hook && (
        <p className="small nv-hook-line">
          {langs.some((l) => hook[l]) ? (
            <>
              <span className="muted">{t('vsHook')}</span> “{langs.map((l) => hook[l]).filter(Boolean).join(' / ')}”
              {onClearHook && <button className="btn small" aria-label={t('serverDelete')} onClick={onClearHook}>✕</button>}
            </>
          ) : (
            <span className="muted">{t('vsHookNone')}</span>
          )}
        </p>
      )}
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
export function KeyBox({ kind, saved, title, how, onSaved }: { kind: KeyKind; saved: boolean; title: string; how: string; onSaved: (saved: boolean) => void }) {
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
        {!saved && <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={kind === 'github' ? 'github_pat_…' : kind === 'youtube' ? 'AIza…' : 'Pexels API key'} autoComplete="off" />}
        {!saved && <button className="btn small" disabled={key.trim().length < 10} onClick={() => void save(false)}>{t('keySave')}</button>}
        {saved && <button className="btn small" onClick={() => void save(true)}>{t('keyRemove')}</button>}
      </div>
      {msg && <p className="small warn">{msg}</p>}
    </details>
  )
}

const COLORS = ['#FFFFFF', '#FFE14D', '#7FE8FF', '#FF9FD2', '#A8F0A0']

/** Voice, music, footage and subtitle settings for the server video; saved on this device. */
function VideoSettings({ opts, onChange }: { opts: RenderOpts; onChange: (o: RenderOpts) => void }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const set = (patch: Partial<RenderOpts>) => onChange({ ...opts, ...patch })
  const range = (label: StudioKey, key: 'voiceRate' | 'voiceVolume' | 'musicVolume' | 'clip' | 'subSize' | 'subStroke' | 'subPos', min: number, max: number, step: number, show: (v: number) => string) => (
    <label className="vs-field">
      <span className="small muted">{t(label)}: <b>{show(opts[key])}</b></span>
      <input type="range" min={min} max={max} step={step} value={opts[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} />
    </label>
  )
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <details className="vs-pexels nv-vset">
      <summary className="small">{t('vsTitle')}</summary>
      <div className="nv-kit-grid">
        {range('vsVoiceRate', 'voiceRate', 0.7, 1.5, 0.05, (v) => `${v.toFixed(2)}×`)}
        {range('vsVoiceVolume', 'voiceVolume', 0.5, 1.5, 0.05, pct)}
        {range('vsClip', 'clip', 2, 8, 1, (v) => `${v}s`)}
        {opts.music && range('vsMusicVolume', 'musicVolume', 0, 0.5, 0.05, pct)}
        {range('vsSubSize', 'subSize', 36, 110, 2, String)}
        {range('vsSubStroke', 'subStroke', 0, 5, 0.5, String)}
        {range('vsSubPos', 'subPos', 10, 90, 1, String)}
        <label className="vs-field">
          <span className="small muted">{t('vsTransition')}</span>
          <select className="btn" value={opts.transition} onChange={(e) => set({ transition: e.target.value as RenderOpts['transition'] })}>
            {TRANSITIONS.map((x) => <option key={x} value={x}>{t(`tr${x}` as StudioKey)}</option>)}
          </select>
        </label>
      </div>
      <span className="small muted">{t('vsSubColor')}</span>
      <div className="nv-swatches" role="group" aria-label={t('vsSubColor')}>
        {COLORS.map((c) => (
          <button key={c} className={`nv-swatch${opts.subColor === c ? ' on' : ''}`} style={{ background: c }} aria-label={c} aria-pressed={opts.subColor === c} onClick={() => set({ subColor: c })} />
        ))}
        <input type="color" value={opts.subColor.toLowerCase()} onChange={(e) => set({ subColor: e.target.value.toUpperCase() })} aria-label={t('vsSubColor')} />
      </div>
      <span className="small muted">{t('vsSubMode')}</span>
      <div className="seg small" role="group" aria-label={t('vsSubMode')}>
        <button className={opts.subMode === 'sentence' ? 'on' : ''} onClick={() => set({ subMode: 'sentence' })}>{t('subSentence')}</button>
        <button className={opts.subMode === 'word_by_word' ? 'on' : ''} onClick={() => set({ subMode: 'word_by_word' })}>{t('subWord')}</button>
      </div>
      <label className="vs-check"><input type="checkbox" checked={opts.subPop} onChange={(e) => set({ subPop: e.target.checked })} /> {t('vsSubPop')}</label>
      <label className="vs-check"><input type="checkbox" checked={opts.subBox} onChange={(e) => set({ subBox: e.target.checked })} /> {t('vsSubBox')}</label>
      <label className="vs-check"><input type="checkbox" checked={opts.music} onChange={(e) => set({ music: e.target.checked })} /> {t('vsMusic')}</label>
      <div className="vs-row"><button className="btn small" onClick={() => onChange(DEFAULT_RENDER_OPTS)}>{t('vsReset')}</button></div>
    </details>
  )
}
