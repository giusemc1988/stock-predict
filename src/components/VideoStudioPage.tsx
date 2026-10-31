import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLang } from '../lib/i18n'
import { useHubTheme } from '../lib/themes'
import { AgentFace } from './AgentFace'
import { LangSwitch } from './HubPanels'
import { ProjectLogo } from './ProjectLogo'
import { CHANNEL, fromText, titleLab, type Script, type StudioMode } from '../lib/studio/script'
import { drawFrame, plan, sizeOf, type Aspect, type Media } from '../lib/studio/render'
import { SAMPLE_RATE, renderMusic } from '../lib/studio/audio'
import { canExport, exportMp4 } from '../lib/studio/encode'
import { DecodeError, loadMedia } from '../lib/studio/decode'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { StudioRenderPanel } from './StudioRenderPanel'
import { NovaTrends } from './NovaTrends'
import { Copy, NovaPostKit } from './NovaPostKit'
import { NovaUploads } from './NovaUploads'
import { NovaClipPreview } from './NovaClipPreview'
import { NovaProgress } from './NovaProgress'
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

/** Bilingual Faceless Video Studio: script EN + VI, preview, MP4 export and Title Lab, all in the browser. */
export function VideoStudioPage({ onBack, glass = true, trends = true, postKit = true, videoSettings = true, uploads = true, lemo = true, handoff = true, channel = false, importLink = true, clipText = true, quickPost = true, hookThemes = true, onViraltech }: { onBack: () => void; glass?: boolean; trends?: boolean; postKit?: boolean; videoSettings?: boolean; uploads?: boolean; lemo?: boolean; handoff?: boolean; channel?: boolean; importLink?: boolean; clipText?: boolean; quickPost?: boolean; hookThemes?: boolean; onViraltech?: () => void }) {
  const lang = useLang()
  const theme = useHubTheme()
  const active = useActiveStep()
  // the glass look (AI rule novaGlass); off = the plain cards from before
  const card = glass ? 'bf-card nv-card hg-glass' : 'bf-card'
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  // Nova makes the channel's faceless videos; the old Philosophy and My Trip tabs are gone
  const mode: StudioMode = 'faceless'
  const [aspect, setAspect] = useState<Aspect>('9:16')
  const [topic, setTopic] = useState('')
  const [topicVi, setTopicVi] = useState('')
  const [en, setEn] = useState('')
  const [vi, setVi] = useState('')
  // the topic the lines on screen were written for; a different topic means the lines are old
  const [scriptFor, setScriptFor] = useState('')
  const [music, setMusic] = useState(true)
  const [scenes, setScenes] = useState<number | null>(null)
  // channel rules: 3 to 5 slides, 4 unless picked; otherwise 5 and up to 12
  const sceneN = channel ? Math.max(CHANNEL.min, Math.min(CHANNEL.max, scenes ?? CHANNEL.def)) : (scenes ?? 5)
  // the post kit's chosen hook opens the server video
  const [hook, setHook] = useState({ en: '', vi: '' })
  // ids of the user's uploads for the server video, in order
  const [serverMedia, setServerMedia] = useState<string[]>([])
  // the uploaded or imported clips, for the preview with text
  const [clipIds, setClipIds] = useState<string[]>([])
  const [fades, setFades] = useState(true)
  const [voice, setVoice] = useState(false)
  const [media, setMedia] = useState<(Media & { thumb: string })[]>([])
  // what happened to the last files picked for the in-app video, shown under its picker
  const [footMsg, setFootMsg] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [out, setOut] = useState<{ url: string; name: string; size: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stopRef = useRef<() => void>(() => {})

  const script: Script = useMemo(() => fromText(topic, mode, en, vi, topicVi), [topic, mode, en, vi, topicVi])
  const shown = media
  const p = useMemo(() => plan(script, aspect, fades, shown, channel ? CHANNEL.seconds : 0), [script, aspect, fades, shown, channel])
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

  // picking a new topic throws away the old lines and hooks, so nothing from the last topic is left behind
  const chooseTopic = (a: string, b: string) => {
    setTopic(a)
    setTopicVi(b)
    if (a !== scriptFor) {
      setEn('')
      setVi('')
      setHook({ en: '', vi: '' })
      setOut(null)
    }
  }
  const stale = !!scriptFor && !!en.trim() && topic.trim() !== scriptFor

  const writeAi = async (ask?: { topic: string; topicVi: string }) => {
    setMsg(null)
    setBusy(t('writing'))
    try {
      const body = JSON.stringify({ topic: ask?.topic ?? topic, topicVi: ask?.topicVi ?? topicVi, mode, scenes: sceneN, channel })
      // the server gives each AI helper 12 s, so 45 s is more than enough; after that the wait ends with a message
      const r = await fetch('/api/studio/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(45_000) }).catch(() => null)
      if (!r) throw new Error(t('netDown'))
      const j = (await r.json().catch(() => ({}))) as { en?: string[]; vi?: string[]; by?: string; error?: string }
      if (!r.ok || !j.en?.length || !j.vi?.length) throw new Error(j.error ?? `HTTP ${r.status}`)
      setEn(j.en.join('\n'))
      setVi(j.vi.join('\n'))
      setScriptFor((ask?.topic ?? topic).trim())
      setMsg(`${t('writtenBy')} ${j.by}`)
    } catch (e) {
      setMsg(`${t('aiFailed')} (${(e as Error).message})`)
    } finally {
      setBusy(null)
    }
  }

  // a trending topic fills both topic boxes; the AI writes each script in its own language
  const applyTrend = (it: TrendItem) => {
    chooseTopic(it.title, it.title)
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
    setFootMsg([])
    setBusy(t('loadingMedia'))
    try {
      const picked = [...files].slice(0, MAX_MEDIA - media.length)
      // one file a phone cannot open no longer throws away the others
      const tries = await Promise.allSettled(picked.map(loadMedia))
      const ok = tries.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      setMedia((m) => [...m, ...ok].slice(0, MAX_MEDIA))
      const bad = tries.flatMap((r, i) => {
        if (r.status === 'fulfilled') return []
        const e = r.reason
        return [`${t('mediaFailed')} ${picked[i].name}: ${e instanceof DecodeError ? t(e.key) : (e as Error)?.message ?? e}`]
      })
      setFootMsg(bad.length && ok.length ? [`${t('mediaAdded')} ${ok.length}.`, ...bad] : bad)
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

        <section id="nv-idea" className={card}>
          {head(1, 'stepIdea')}
          {trends && <NovaTrends onPick={(it) => void applyTrend(it)} onAuto={autoTrend} busy={!!busy} themes={hookThemes} picked={topic} onTopic={(en, vi) => { chooseTopic(en, vi); setMsg(t('trendPicked')); setTimeout(() => document.getElementById('nv-script')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }} />}
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
        </section>

        <section id="nv-script" className={card}>
          {head(2, 'stepScript')}
          <p className="small">{t('topicChosen')}: <b>{(lang === 'vi' ? topicVi || topic : topic) || '—'}</b></p>
          <div className="vs-row">
            <button className="btn primary" disabled={!!busy || !topic.trim()} onClick={() => void writeAi()}>{t('writeAi')}</button>
          </div>
          <NovaProgress active={busy === t('writing')} label={t('writing')} secs={25} />
          {videoSettings && (
            <label className="vs-field nv-scenes">
              <span className="small muted">{t('scenesCount')}: <b>{sceneN}</b></span>
              <input type="range" min={3} max={channel ? CHANNEL.max : 12} value={sceneN} onChange={(e) => setScenes(Number(e.target.value))} />
            </label>
          )}
          <p className="muted small">{t('aiNote')}</p>
          <div className="vs-scripts">
            <label className="vs-field"><span className="small muted">EN · {t('oneLine')}</span><textarea rows={6} value={en} onChange={(e) => setEn(e.target.value)} /></label>
            <label className="vs-field"><span className="small muted">VI · {t('oneLine')}</span><textarea rows={6} value={vi} onChange={(e) => setVi(e.target.value)} /></label>
          </div>
          {stale && <p className="warn">{t('staleScript')}</p>}
          {!en.trim() && !vi.trim() && busy !== t('writing') && <p className="muted small">{t('scriptEmpty')}</p>}
          {mismatch && <p className="warn">{t('mismatch')}</p>}
          {msg && busy == null && !out && <p className="small">{msg}</p>}
        </section>

        <section id="nv-make" className="nv-make">
          <details className={`${card} nv-adv`}>
            <summary className="small">{t('advTitle')} {media.length > 0 && <span className="muted">· {media.length}/{MAX_MEDIA}</span>}</summary>
            <div className="seg small" role="group" aria-label={t('aspect')}>
              {(['9:16', '16:9', '1:1'] as Aspect[]).map((a) => (
                <button key={a} className={aspect === a ? 'on' : ''} onClick={() => setAspect(a)}>{a}</button>
              ))}
            </div>
            <p className="muted small">{t('footageAuto')}</p>
            <label className={`nv-drop${media.length >= MAX_MEDIA || busy ? ' off' : ''}`}>
              <input type="file" accept="image/*,video/*" multiple disabled={media.length >= MAX_MEDIA || !!busy} onChange={(e) => { void addMedia(e.target.files); e.target.value = '' }} />
              <span>＋ {t('step3')}</span>
            </label>
            <NovaProgress active={busy === t('loadingMedia')} label={t('loadingMedia')} secs={10} />
            {footMsg.map((m) => <p key={m} className="warn small">{m}</p>)}
            {media.length > 0 && (
              <div className="nv-up-grid">
                {media.map((m, i) => (
                  <div key={m.thumb + i} className="nv-up-tile">
                    <img src={m.thumb} alt="" />
                    <span className="nv-up-n">{i + 1}</span>
                    <div className="nv-up-act">
                      <button className="btn small" aria-label={t('serverDelete')} title={t('serverDelete')} onClick={() => setMedia((list) => list.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {media.length > 0 && <button className="btn small" onClick={() => { setMedia([]); setFootMsg([]) }}>{t('clear')}</button>}
            {uploads && <NovaUploads onChange={setServerMedia} onClips={setClipIds} importLink={importLink} />}
            {uploads && clipText && clipIds.length > 0 && <NovaClipPreview ids={clipIds} script={script} topic={topic} />}
          </details>
          <StudioRenderPanel topic={topic} topicVi={topicVi} en={script.en} vi={script.vi} aspect={aspect} glass={glass} settings={videoSettings} hook={postKit ? hook : undefined} onClearHook={() => setHook({ en: '', vi: '' })} media={uploads ? serverMedia : []} lemo={lemo} handoff={handoff} onViraltech={onViraltech} post={quickPost ? { caption: lab.caption, tags: lab.hashtags } : undefined} />

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
            {busy && busy !== t('writing') && <NovaProgress label={busy} value={busy === t('rendering') ? progress : undefined} secs={15} />}
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
              {head(4, 'stepPost')}
              <NovaPostKit script={script} hook={hook} onHook={videoSettings ? (l, x) => setHook((h) => ({ ...h, [l]: x })) : undefined} />
            </>
          ) : (
            <>
              {head(4, 'stepPost', <Copy text={lab.hashtags.join(' ')} label={t('copyTags')} />)}
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
