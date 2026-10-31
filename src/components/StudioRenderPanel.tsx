import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { VIDEO_STORE } from './NovaPresets'
import { NovaProgress } from './NovaProgress'
import { useLang } from '../lib/i18n'
import { fetchVideoFile, shareVideo } from '../lib/studio/share'
import { Copy } from './NovaPostKit'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { DEFAULT_RENDER_OPTS, TRANSITIONS, cleanRenderOpts, type RenderAspect, type RenderEngine, type RenderLang, type RenderOpts, type RenderVoice, type StudioJob } from '../lib/studioJobs'

type JobRow = Omit<StudioJob, 'lines' | 'terms'>
export type KeyKind = 'pexels' | 'github'
const POLL_MS = 20_000
const IDLE_POLL_MS = 60_000
const STATUS: Record<StudioJob['status'], StudioKey> = { queued: 'statusQueued', rendering: 'statusRendering', done: 'statusDone', failed: 'statusFailed' }

/**
 * Nova step 5: queue the script for MoneyPrinterTurbo on GitHub Actions, or for Lemo-Opuscar on the PC while it is on,
 * then play the finished MP4s.
 */
export function StudioRenderPanel({ topic, topicVi, en, vi, aspect, glass = false, settings = false, hook, onClearHook, media = [], lemo = false, handoff = false, post, onViraltech }: { topic: string; topicVi: string; en: string[]; vi: string[]; aspect: RenderAspect; glass?: boolean; settings?: boolean; hook?: { en: string; vi: string }; onClearHook?: () => void; media?: string[]; lemo?: boolean; handoff?: boolean; post?: { caption: { en: string; vi: string }; tags: string[] }; onViraltech?: () => void }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [langs, setLangs] = useState<RenderLang[]>(['vi'])
  const [voice, setVoice] = useState<RenderVoice>('female')
  const [jobs, setJobs] = useState<JobRow[] | null>(null)
  const [keys, setKeys] = useState<Record<'pexels' | 'github', boolean>>({ pexels: false, github: false })
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<RenderEngine>('mpt')
  // the PC pings the Worker every minute while nova/lemo-bridge.mjs runs; off = Lemo cannot be chosen
  const [pcOn, setPcOn] = useState(false)
  const engine: RenderEngine = lemo && pcOn ? picked : 'mpt'
  const [savedOpts, setSavedOpts] = useLocalStorage<Partial<RenderOpts>>(VIDEO_STORE, {})
  // video settings (AI rule novaVideoSettings); off = Nova's defaults
  const opts = useMemo(() => (settings ? cleanRenderOpts(savedOpts) : DEFAULT_RENDER_OPTS), [settings, savedOpts])

  const load = useCallback(async () => {
    const r = await fetch('/api/studio/jobs').catch(() => null)
    const j = (await r?.json().catch(() => null)) as { jobs?: JobRow[]; pexels?: boolean; github?: boolean; lemo?: boolean } | null
    if (j?.jobs) {
      setJobs(j.jobs)
      setKeys({ pexels: !!j.pexels, github: !!j.github })
      setPcOn(!!j.lemo)
    }
  }, [])

  // elapsed minutes on waiting videos tick every 15 s without asking the server
  const [now, setNow] = useState(() => Date.now())
  const waiting = !!jobs?.some((j) => j.status === 'queued' || j.status === 'rendering')
  useEffect(() => {
    void load()
    // with Lemo on, keep checking so the PC's on/off shows without a reload
    if (!waiting && !lemo) return
    // idle checks only watch the PC; slower, to stay well inside the free KV reads
    const id = setInterval(() => void load(), waiting ? POLL_MS : IDLE_POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      clearInterval(id)
      clearInterval(tick)
    }
  }, [load, waiting, lemo])

  // "Try again" on a failed video and "Start now" on one that waits: both put it in the queue and start the farm
  const again = async (id: string) => {
    setMsg(null)
    const r = await fetch(`/api/studio/retry?id=${id}`, { method: 'POST' }).catch(() => null)
    const j = (await r?.json().catch(() => ({}))) as { error?: string; kicked?: boolean } | undefined
    if (!r?.ok) setMsg(`${t('serverFailed')} ${j?.error ?? t('netDown')}`)
    else setMsg(t(j?.kicked ? 'serverQueued' : 'farmNoKey'))
    await load()
  }

  const make = async () => {
    setMsg(null)
    setBusy(true)
    try {
      const r = await fetch('/api/studio/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, topicVi, en, vi, langs, voice, aspect, opts, hook: settings ? hook : undefined, media, engine }) })
      const j = (await r.json().catch(() => ({}))) as { error?: string; kicked?: boolean }
      if (r.status === 429) setMsg(t('serverBusy'))
      else if (r.status === 409) {
        setPcOn(false)
        setMsg(t('lemoOffline'))
      } else if (r.ok && engine === 'lemo') setMsg(t('lemoQueued'))
      else if (!r.ok) setMsg(`${t('serverFailed')} ${j.error ?? `HTTP ${r.status}`}`)
      else setMsg(t(j.kicked ? 'serverQueued' : 'serverQueuedSlow'))
      await load()
    } catch (e) {
      setMsg(`${t('serverFailed')} ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/studio/jobs?id=${id}`, { method: 'DELETE' }).catch(() => null)
    await load()
  }

  // Viraltech's waiting list only; nothing is posted from here
  const send = async (id: string, on: boolean) => {
    const r = await fetch(`/api/studio/handoff?id=${id}`, { method: on ? 'POST' : 'DELETE' }).catch(() => null)
    await load()
    // sending means "I want to post it there": go straight to Viraltech instead of leaving the tap looking dead
    if (on && r?.ok) onViraltech?.()
  }

  // Quick-post: copy caption + hashtags, then hand the MP4 to the phone share sheet. The person posts; nothing is sent from here.
  const [sharing, setSharing] = useState('')
  // the MP4s are fetched before the tap (the newest few): the phone opens its share sheet only within seconds of a tap
  const files = useRef(new Map<string, File>())
  const doneJobs = (jobs ?? []).filter((j) => j.status === 'done').slice(0, 3)
  const doneKey = doneJobs.map((j) => j.id).join()
  useEffect(() => {
    if (!post) return
    for (const j of doneJobs) {
      if (files.current.has(j.id)) continue
      void fetchVideoFile(j.id, j.topic).then((f) => { files.current.set(j.id, f); setReadyKey((k) => k + 1) }).catch(() => null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey, !!post])
  const [, setReadyKey] = useState(0)
  const captionOf = (j: Pick<StudioJob, 'lang' | 'engine'>) => {
    if (!post) return ''
    const cap = j.lang === 'vi' || j.engine === 'overlay' ? post.caption.vi : post.caption.en
    return post.tags.every((h) => cap.includes(h)) ? cap : `${cap}\n\n${post.tags.join(' ')}`
  }
  const share = async (j: Pick<StudioJob, 'id' | 'lang' | 'engine' | 'topic'>) => {
    if (!post) return
    const text = captionOf(j)
    const ready = files.current.get(j.id)
    if (!ready) {
      // not loaded yet: load it now and ask for one more tap, which then opens the sheet at once
      setSharing(j.id)
      setMsg(t('shareBusy'))
      try {
        files.current.set(j.id, await fetchVideoFile(j.id, j.topic))
        setReadyKey((k) => k + 1)
        await navigator.clipboard?.writeText(text).catch(() => null)
        setMsg(t('shareTapAgain'))
      } catch (e) {
        setMsg(`${t('shareFail')} ${(e as Error).message}`)
      } finally {
        setSharing('')
      }
      return
    }
    try {
      const r = await shareVideo(j.id, j.topic, text, ready)
      setMsg(r === 'shared' ? t('shareCopied') : r === 'downloaded' ? t('shareNoSheet') : '')
    } catch (e) {
      setMsg(`${t('shareFail')} ${(e as Error).message}`)
    }
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
      {lemo && (
        <>
          <div className="seg small" role="group" aria-label={t('engineLabel')}>
            <button className={engine === 'mpt' ? 'on' : ''} onClick={() => setPicked('mpt')}>{t('engineMpt')}</button>
            <button className={engine === 'lemo' ? 'on' : ''} disabled={!pcOn} onClick={() => setPicked('lemo')}>{t('engineLemo')}</button>
          </div>
          <p className={`small ${pcOn ? '' : 'muted'}`}>{t(pcOn ? 'lemoOn' : 'lemoOff')}</p>
        </>
      )}
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
      <p className="muted small">{media.length ? `${t('footageUpload')} (${media.length}).` : t(keys.pexels ? 'footagePexels' : 'footageOpenverse')}</p>
      {engine === 'mpt' && !keys.github && <p className="small warn">{t('githubSlow')}</p>}
      <div className="vs-row">
        <button className="btn primary" disabled={busy || !ready} onClick={() => void make()}>{t('serverMake')}</button>
        <NovaProgress active={busy} label={t('serverSending')} secs={8} />
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
            <span className="small"><strong>{j.engine === 'overlay' ? 'EN+VI' : j.lang.toUpperCase()}</strong>{j.engine === 'lemo' ? ' · Lemo' : j.engine === 'overlay' ? ' · clip' : ''} · {j.topic}</span>
            <span className={`small ${j.status === 'failed' ? 'warn' : 'muted'}`}>{t(j.engine === 'lemo' && j.status === 'queued' ? 'statusLemoQueued' : j.engine === 'lemo' && j.status === 'rendering' ? 'statusLemoRendering' : STATUS[j.status])}</span>
          </div>
          {(j.status === 'queued' || j.status === 'rendering') && j.engine !== 'lemo' && <p className="small muted">{Math.max(0, Math.floor((now - (j.status === 'rendering' ? j.startedAt ?? j.createdAt : j.createdAt)) / 60000))} {t('farmMin')} · {t('farmUsually')}</p>}
          {j.status === 'failed' && j.error && <p className="small muted">{j.error}</p>}
          {j.status === 'done' && j.footage === 'gradient' && <p className="small muted">{t('footageGradient')}</p>}
          {j.status === 'done' && (
            <div className="vs-out">
              <video src={`/api/studio/video?id=${j.id}`} controls playsInline preload="metadata" />
            </div>
          )}
          {post && j.status === 'done' && (
            <div className="nv-cap">
              <p className="small">{captionOf(j)}</p>
              <Copy text={captionOf(j)} label={t('copyCaptionTags')} />
            </div>
          )}
          <div className="vs-row">
            {handoff && j.status === 'done' && (j.handoff && onViraltech
              ? <button className="btn small" onClick={onViraltech}>{t('openViraltech')}</button>
              : <button className="btn small" onClick={() => void send(j.id, true)}>{t('sendViraltech')}</button>)}
            {post && j.status === 'done' && <button className="btn small primary" disabled={!!sharing} onClick={() => void share(j)}>{t('shareGo')}{files.current.has(j.id) ? '' : ' …'}</button>}
            {sharing === j.id && <NovaProgress active label={t('shareBusy')} secs={10} />}
            {j.status === 'done' && <a className="btn small primary" href={`/api/studio/video?id=${j.id}&download`}>{t('download')}{j.size ? ` (${(j.size / 1e6).toFixed(1)} MB)` : ''}</a>}
            {j.engine !== 'lemo' && (j.status === 'failed' || (j.status === 'queued' && now - j.createdAt > 3 * 60_000)) && <button className="btn small primary" onClick={() => void again(j.id)}>{t(j.status === 'failed' ? 'farmRetry' : 'farmStart')}</button>}
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
        {!saved && <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={kind === 'github' ? 'github_pat_…' : 'Pexels API key'} autoComplete="off" />}
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
