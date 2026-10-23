import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLang } from '../lib/i18n'
import { useHubTheme } from '../lib/themes'
import { AgentFace } from './AgentFace'
import { LangSwitch } from './HubPanels'
import { ProjectLogo } from './ProjectLogo'
import { LIBRARY, fromText, libraryFor, titleLab, type Script, type StudioMode } from '../lib/studio/script'
import { drawFrame, plan, sizeOf, type Aspect, type Media } from '../lib/studio/render'
import { SAMPLE_RATE, renderMusic } from '../lib/studio/audio'
import { canExport, exportMp4 } from '../lib/studio/encode'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { StudioRenderPanel } from './StudioRenderPanel'
import { NovaTrends } from './NovaTrends'
import { Copy, NovaPostKit } from './NovaPostKit'
import { NovaUploads } from './NovaUploads'
import { NovaPresets } from './NovaPresets'
import type { TrendItem } from '../lib/studioTrends'
import './JarvisHub.css'
import './NovaStudio.css'

const MAX_MEDIA = 8
/** Nova's colour on the Hub (JarvisHub HUE). */
const NOVA_HUE = '#d6a4ea'
/** The five steps, top to bottom; the sticky bar jumps between them. */
const STEPS = [
  { id: 'nv-idea', key: 'stepIdea' },
  { id: 'nv-script', key: 'stepScript' },
  { id: 'nv-footage', key: 'stepFootage' },
  { id: 'nv-make', key: 'stepMake' },
  { id: 'nv-post', key: 'stepPost' },
] as const satisfies readonly { id: string; key: StudioKey }[]

/** Which step is on screen, for the step bar. */
function useActiveStep(): string {
  const [active, setActive] = useState<string>(STEPS[0].id)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (es) => {
        const seen = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (seen) setActive(seen.target.id)
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    STEPS.forEach((st) => {
      const el = document.getElementById(st.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return active
}

/** A photo as is, or the middle frame of a clip as a labelled still. */
async function loadMedia(file: File): Promise<Media> {
  const url = URL.createObjectURL(file)
  try {
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.preload = 'auto'
      v.src = url
      await new Promise<void>((ok, bad) => {
        v.onloadedmetadata = () => ok()
        v.onerror = () => bad(new Error(file.name))
      })
      v.currentTime = Math.max(0, (v.duration || 0) / 2)
      await new Promise<void>((ok) => (v.onseeked = () => ok()))
      return { img: await createImageBitmap(v), still: true }
    }
    return { img: await createImageBitmap(file), still: false }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Bilingual Faceless Video Studio: script EN + VI, preview, MP4 export and Title Lab, all in the browser. */
export function VideoStudioPage({ onBack, glass = true, trends = true, postKit = true, videoSettings = true, uploads = true, presets = true }: { onBack: () => void; glass?: boolean; trends?: boolean; postKit?: boolean; videoSettings?: boolean; uploads?: boolean; presets?: boolean }) {
  const lang = useLang()
  const theme = useHubTheme()
  const active = useActiveStep()
  // the glass look (AI rule novaGlass); off = the plain cards from before
  const card = glass ? 'bf-card nv-card hg-glass' : 'bf-card'
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [mode, setMode] = useState<StudioMode>('faceless')
  const [aspect, setAspect] = useState<Aspect>('9:16')
  const [topic, setTopic] = useState(LIBRARY[0].topic.en)
  const [topicVi, setTopicVi] = useState(LIBRARY[0].topic.vi)
  const [en, setEn] = useState(LIBRARY[0].en.join('\n'))
  const [vi, setVi] = useState(LIBRARY[0].vi.join('\n'))
  const [music, setMusic] = useState(true)
  const [scenes, setScenes] = useState(5)
  // the post kit's chosen hook opens the server video
  const [hook, setHook] = useState({ en: '', vi: '' })
  // ids of the user's uploads for the server video, in order
  const [serverMedia, setServerMedia] = useState<string[]>([])
  // a loaded preset rewrites the saved settings; this remounts the parts that read them
  const [presetRev, setPresetRev] = useState(0)
  const [fades, setFades] = useState(true)
  const [voice, setVoice] = useState(false)
  const [media, setMedia] = useState<Media[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [out, setOut] = useState<{ url: string; name: string; size: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stopRef = useRef<() => void>(() => {})

  const script: Script = useMemo(() => fromText(topic, mode, en, vi, topicVi), [topic, mode, en, vi, topicVi])
  const shown = useMemo(() => (mode === 'trip' || mode === 'philosophy' ? media : []), [mode, media])
  const p = useMemo(() => plan(script, aspect, fades, shown), [script, aspect, fades, shown])
  const lab = useMemo(() => titleLab(script), [script])
  const { w, h } = sizeOf(aspect)
  const mismatch = en.split('\n').filter((l) => l.trim()).length !== vi.split('\n').filter((l) => l.trim()).length

  // still preview of the first scene whenever the script changes
  useEffect(() => {
    if (playing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && script.en.length) drawFrame(ctx, p, Math.min(1, p.duration / 2))
  }, [p, playing, script.en.length])

  useEffect(() => () => { stopRef.current(); if (out) URL.revokeObjectURL(out.url) }, [out])

  const pickLibrary = (i: number) => {
    const s = libraryFor(mode)[i]
    if (!s) return
    setTopic(s.topic.en)
    setTopicVi(s.topic.vi)
    setEn(s.en.join('\n'))
    setVi(s.vi.join('\n'))
  }

  const writeAi = async (ask?: { topic: string; topicVi: string }) => {
    setMsg(null)
    setBusy(t('writing'))
    try {
      const r = await fetch('/api/studio/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: ask?.topic ?? topic, topicVi: ask?.topicVi ?? topicVi, mode, scenes }) })
      const j = (await r.json().catch(() => ({}))) as { en?: string[]; vi?: string[]; by?: string; error?: string }
      if (!r.ok || !j.en?.length || !j.vi?.length) throw new Error(j.error ?? `HTTP ${r.status}`)
      setEn(j.en.join('\n'))
      setVi(j.vi.join('\n'))
      setMsg(`${t('writtenBy')} ${j.by}`)
    } catch (e) {
      setMsg(`${t('aiFailed')} (${(e as Error).message})`)
    } finally {
      setBusy(null)
    }
  }

  // a trending topic fills both topic boxes; the AI writes each script in its own language
  const applyTrend = (it: TrendItem) => {
    setTopic(it.title)
    setTopicVi(it.title)
    setMsg(t('trendPicked'))
    return { topic: it.title, topicVi: it.title }
  }
  const autoTrend = (it: TrendItem) => {
    const ask = applyTrend(it)
    document.getElementById('nv-script')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    void writeAi(ask)
  }

  const addMedia = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(t('loadingMedia'))
    try {
      const list = await Promise.all([...files].slice(0, MAX_MEDIA - media.length).map(loadMedia))
      setMedia((m) => [...m, ...list].slice(0, MAX_MEDIA))
    } catch (e) {
      setMsg(`${t('mediaFailed')} ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const play = async () => {
    if (playing) return stopRef.current()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !script.en.length) return
    let audio: AudioContext | null = null
    if (music) {
      const ch = await renderMusic(p.duration, topic.length)
      audio = new AudioContext({ sampleRate: SAMPLE_RATE })
      const buf = audio.createBuffer(2, ch[0].length, SAMPLE_RATE)
      buf.copyToChannel(ch[0] as Float32Array<ArrayBuffer>, 0)
      buf.copyToChannel(ch[1] as Float32Array<ArrayBuffer>, 1)
      const src = audio.createBufferSource()
      src.buffer = buf
      src.connect(audio.destination)
      src.start()
    }
    const t0 = performance.now()
    let raf = 0
    let spoken = -1
    const stop = () => {
      cancelAnimationFrame(raf)
      void audio?.close()
      speechSynthesis?.cancel()
      setPlaying(false)
      stopRef.current = () => {}
    }
    stopRef.current = stop
    setPlaying(true)
    const tick = () => {
      const s = (performance.now() - t0) / 1000
      if (s >= p.duration) return stop()
      drawFrame(ctx, p, s)
      const cur = p.spans.findIndex((x) => s >= x.start && s < x.end)
      if (voice && cur > spoken && 'speechSynthesis' in window) {
        spoken = cur
        const u = new SpeechSynthesisUtterance(lang === 'vi' ? script.vi[cur] : script.en[cur])
        u.lang = lang === 'vi' ? 'vi-VN' : 'en-US'
        speechSynthesis.speak(u)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
  }

  const make = async () => {
    stopRef.current()
    setMsg(null)
    if (out) URL.revokeObjectURL(out.url)
    setOut(null)
    setBusy(t('rendering'))
    setProgress(0)
    try {
      const ch = music ? await renderMusic(p.duration, topic.length) : null
      const r = await exportMp4(p, ch, setProgress)
      // played from an object URL: a relative path breaks inside sandboxed frames
      const url = URL.createObjectURL(r.blob)
      const slug = (topic || 'video').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
      setOut({ url, name: `${slug || 'video'}-${w}x${h}.mp4`, size: r.blob.size })
      if (music && !r.audio) setMsg(t('noAudioEnc'))
    } catch (e) {
      setMsg(`${t('renderFailed')} ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const modes: StudioMode[] = ['faceless', 'philosophy', 'trip']
  const usesMedia = mode === 'trip' || mode === 'philosophy'
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const head = (n: number, key: StudioKey, extra?: ReactNode) => (
    <header>
      <h3><span className="nv-n" aria-hidden="true">{n}</span>{t(key)}</h3>
      {extra}
    </header>
  )
  return (
    <main className={`net-page vs-page nv${glass ? ' hg' : ''}`} data-theme={glass ? theme : undefined}>
      {glass && (
        <div className="hg-wall" aria-hidden="true">
          <i className="hg-b1" />
          <i className="hg-b2" />
          <i className="hg-b3" />
        </div>
      )}
      <div className={glass ? 'hg-wrap nv-wrap' : 'nv-wrap'}>
        <header className={`nv-bar${glass ? ' hg-glass' : ''}`}>
          <button className="btn net-back" onClick={onBack}>{t('back')}</button>
          <b className="nv-bar-t">{t('title')}</b>
          <LangSwitch />
        </header>

        <section className="nv-hero">
          <div className="nv-face" aria-hidden="true"><AgentFace id="nova" hue={NOVA_HUE} /></div>
          <div className="nv-hero-t">
            <h1 className="nv-brand"><ProjectLogo id="nova" hue={NOVA_HUE} className="nv-logo" />Nova</h1>
            <p className="nv-tag">{t('sub')}</p>
          </div>
        </section>

        <nav className={`nv-steps${glass ? ' hg-glass' : ''}`} aria-label={t('stepsNav')}>
          {STEPS.map((st, i) => (
            <button key={st.id} className={active === st.id ? 'on' : ''} aria-current={active === st.id ? 'step' : undefined} onClick={() => jump(st.id)}>
              <span className="nv-n">{i + 1}</span>
              <span className="nv-step-t">{t(st.key)}</span>
            </button>
          ))}
        </nav>

        {presets && (
          <NovaPresets
            mode={mode}
            aspect={aspect}
            onApply={(pr) => {
              setMode(pr.mode)
              setAspect(pr.aspect)
              setPresetRev((n) => n + 1)
            }}
          />
        )}

        <section id="nv-idea" className={card}>
          {head(1, 'stepIdea')}
          {trends && <NovaTrends onPick={(it) => void applyTrend(it)} onAuto={autoTrend} busy={!!busy} />}
          <div className="seg small" role="tablist" aria-label={t('step1')}>
            {modes.map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{t(m)}</button>
            ))}
          </div>
          <p className="muted small">{t(`${mode}Note` as StudioKey)}</p>
          <div className="seg small" role="group" aria-label={t('aspect')}>
            {(['9:16', '16:9', '1:1'] as Aspect[]).map((a) => (
              <button key={a} className={aspect === a ? 'on' : ''} onClick={() => setAspect(a)}>{a}</button>
            ))}
          </div>
          <div className="nv-two">
            <label className="vs-field">
              <span className="small muted">{t('topic')} (EN)</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />
            </label>
            <label className="vs-field">
              <span className="small muted">{t('topic')} (VI)</span>
              <input value={topicVi} onChange={(e) => setTopicVi(e.target.value)} maxLength={200} />
            </label>
          </div>
          <select className="btn" value="" onChange={(e) => pickLibrary(Number(e.target.value))} aria-label={t('library')}>
            <option value="">{t('library')}</option>
            {libraryFor(mode).map((s, i) => <option key={i} value={i}>{s.topic[lang]}</option>)}
          </select>
        </section>

        <section id="nv-script" className={card}>
          {head(2, 'stepScript')}
          <div className="vs-row">
            <button className="btn primary" disabled={!!busy || !topic.trim()} onClick={() => void writeAi()}>{t('writeAi')}</button>
            {busy === t('writing') && <span className="small muted">{busy}</span>}
          </div>
          {videoSettings && (
            <label className="vs-field nv-scenes">
              <span className="small muted">{t('scenesCount')}: <b>{scenes}</b></span>
              <input type="range" min={3} max={12} value={scenes} onChange={(e) => setScenes(Number(e.target.value))} />
            </label>
          )}
          <p className="muted small">{t('aiNote')}</p>
          <div className="vs-scripts">
            <label className="vs-field"><span className="small muted">EN · {t('oneLine')}</span><textarea rows={6} value={en} onChange={(e) => setEn(e.target.value)} /></label>
            <label className="vs-field"><span className="small muted">VI · {t('oneLine')}</span><textarea rows={6} value={vi} onChange={(e) => setVi(e.target.value)} /></label>
          </div>
          {mismatch && <p className="warn">{t('mismatch')}</p>}
          {msg && busy == null && !out && <p className="small">{msg}</p>}
        </section>

        <section id="nv-footage" className={card}>
          {head(3, 'stepFootage', usesMedia ? <span className="small muted">{media.length}/{MAX_MEDIA}</span> : undefined)}
          {usesMedia ? (
            <>
              <label className={`nv-drop${media.length >= MAX_MEDIA || busy ? ' off' : ''}`}>
                <input type="file" accept="image/*,video/*" multiple disabled={media.length >= MAX_MEDIA || !!busy} onChange={(e) => void addMedia(e.target.files)} />
                <span>＋ {t('step3')}</span>
              </label>
              <p className="muted small">{t('mediaNote')}</p>
              {media.length > 0 && <button className="btn small" onClick={() => setMedia([])}>{t('clear')}</button>}
            </>
          ) : (
            <p className="muted small">{t('footageAuto')}</p>
          )}
          {uploads && <NovaUploads onChange={setServerMedia} />}
        </section>

        <section id="nv-make" className="nv-make">
          <StudioRenderPanel key={presetRev} topic={topic} topicVi={topicVi} en={script.en} vi={script.vi} aspect={aspect} glass={glass} settings={videoSettings} hook={postKit ? hook : undefined} onClearHook={() => setHook({ en: '', vi: '' })} media={uploads ? serverMedia : []} />

          <div className={card}>
            <header><h3>{t('quickTitle')}</h3></header>
            <p className="muted small">{t('quickNote')}</p>
            <div className="vs-row">
              <label className="vs-check"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> {t('music')}</label>
              <label className="vs-check"><input type="checkbox" checked={fades} onChange={(e) => setFades(e.target.checked)} /> {t('fades')}</label>
              <label className="vs-check"><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> {t('voice')}</label>
            </div>
            {voice && <p className="muted small">{t('voiceNote')}</p>}
            <div className="vs-preview" style={{ aspectRatio: `${w} / ${h}` }}>
              <canvas ref={canvasRef} width={w} height={h} />
            </div>
            <p className="small muted">{script.en.length} {t('scenes')} · {p.duration.toFixed(1)}s · {w}×{h} · 30fps</p>
            <div className="vs-row">
              <button className="btn" disabled={!script.en.length || !!busy} onClick={() => void play()}>{playing ? t('stop') : t('play')}</button>
              <button className="btn" disabled={!script.en.length || !!busy || !canExport()} onClick={() => void make()}>{t('make')}</button>
            </div>
            {!canExport() && <p className="warn">{t('noExport')}</p>}
            {busy && busy !== t('writing') && <p className="small">{busy}{busy === t('rendering') ? ` ${Math.round(progress * 100)}%` : ''}</p>}
            {msg && (busy != null || out) && <p className="small">{msg}</p>}
            {out && (
              <div className="vs-out">
                <video src={out.url} controls playsInline />
                <a className="btn primary" href={out.url} download={out.name}>{t('download')} ({(out.size / 1e6).toFixed(1)} MB)</a>
              </div>
            )}
          </div>
        </section>

        <section id="nv-post" className={card}>
          {postKit ? (
            <>
              {head(5, 'stepPost')}
              <NovaPostKit key={presetRev} script={script} hook={hook} onHook={videoSettings ? (l, x) => setHook((h) => ({ ...h, [l]: x })) : undefined} />
            </>
          ) : (
            <>
              {head(5, 'stepPost', <Copy text={lab.hashtags.join(' ')} label={t('copyTags')} />)}
              <p className="muted small">{t('postNote')}</p>
              <div className="nv-two">
                {(['en', 'vi'] as const).map((l) => (
                  <div key={l} className="vs-lab nv-inset">
                    <strong className="small">{l.toUpperCase()}</strong>
                    {lab.titles[l].map((x) => (
                      <div key={x} className="vs-lab-row"><span>{x}</span><Copy text={x} label={t('copy')} /></div>
                    ))}
                    <div className="vs-lab-row"><span className="small muted vs-cap">{lab.caption[l]}</span><Copy text={lab.caption[l]} label={t('copyCaption')} /></div>
                  </div>
                ))}
              </div>
              <p className="small muted">{lab.hashtags.join(' ')}</p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
