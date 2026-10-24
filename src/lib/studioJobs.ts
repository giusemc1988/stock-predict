/**
 * Nova's server renders (MoneyPrinterTurbo on GitHub Actions). The Worker only keeps the queue and
 * serves the finished MP4s; .github/workflows/nova-render.yml picks jobs and stores videos with
 * nova/queue.mjs. Both sides share this KV layout in the SETTINGS namespace:
 *   nova:job:<id>       one StudioJob as JSON
 *   nova:vid:<id>:<n>   the MP4 in chunks of job.chunk bytes (KV values stop at 25 MiB)
 *   nova:pexels         optional free Pexels key for real footage (otherwise Openverse photos)
 *   nova:github         optional GitHub token (Actions: write on NOVA_REPO only) so "Make" starts the farm at once;
 *                       without it the farm waits for GitHub's cron, which on this repo can lag by hours
 *   nova:lemo:seen      last time the home PC asked for Lemo-Opuscar work (ms)
 *   nova:lemo:count:<day>  Lemo films handed to the PC that UTC day
 */
export const JOB_PREFIX = 'nova:job:'
export const VID_PREFIX = 'nova:vid:'
export const PEXELS_KEY = 'nova:pexels'
export const GITHUB_KEY = 'nova:github'
export const NOVA_REPO = 'giusemc1988/stock-predict'
export const NOVA_WORKFLOW = 'nova-render.yml'
/** queued + rendering at once; more waits for the farm to catch up */
export const MAX_ACTIVE = 4
/**
 * Lemo-Opuscar renders on the home PC (agent/lemo-render.ts), never on GitHub. The PC asks the Worker for work
 * every minute with HOME_AGENT_TOKEN; each ask is written to nova:lemo:seen, and that time is how Nova knows the PC is on.
 */
export const LEMO_SEEN_KEY = 'nova:lemo:seen'
/** the PC asks every minute; three missed asks = off */
export const PC_ONLINE_MS = 3 * 60_000
/** a Lemo job nobody picked this long goes to the server farm instead (nova/queue.mjs keeps the same number) */
export const LEMO_WAIT_MS = 30 * 60_000
/** a Lemo film takes long; one still "rendering" after this was lost with the PC and goes to the server farm */
export const LEMO_STALE_MS = 3 * 3600_000
/** Lemo films the PC makes per day at most, so a flood of asks can't keep the PC busy */
export const LEMO_DAILY = 6
export const LEMO_COUNT_KEY = (day: string) => `nova:lemo:count:${day}`
const MAX_LINES = 12
const MAX_LINE = 300

export type RenderLang = 'vi' | 'en'
/** lemo = Lemo-Opuscar on the home PC; turbo = MoneyPrinterTurbo on GitHub Actions */
export type RenderEngine = 'lemo' | 'turbo'
/** why a Lemo ask was made on the server instead */
export type LemoFallback = 'pc-offline' | 'pc-timeout' | 'uploads'
export type RenderVoice = 'female' | 'male'
export type RenderAspect = '9:16' | '16:9' | '1:1'
export const TRANSITIONS = ['none', 'FadeIn', 'SlideIn', 'ZoomIn', 'Shuffle'] as const
export type Transition = (typeof TRANSITIONS)[number]

/** How the server video looks and sounds; each field maps to one MoneyPrinterTurbo setting in nova/render.py. */
export interface RenderOpts {
  /** speech speed, 1 = normal */
  voiceRate: number
  voiceVolume: number
  music: boolean
  musicVolume: number
  /** seconds per footage clip */
  clip: number
  transition: Transition
  subSize: number
  subColor: string
  subStroke: number
  /** a dark rounded box behind the subtitles */
  subBox: boolean
  /** subtitle height, % from the top */
  subPos: number
  /** whole sentences, or one word at a time */
  subMode: 'sentence' | 'word_by_word'
  subPop: boolean
}

export const DEFAULT_RENDER_OPTS: RenderOpts = { voiceRate: 1, voiceVolume: 1, music: true, musicVolume: 0.15, clip: 4, transition: 'none', subSize: 64, subColor: '#FFFFFF', subStroke: 2, subBox: false, subPos: 72, subMode: 'sentence', subPop: false }

const num = (v: unknown, lo: number, hi: number, d: number, step = 0.01) => (typeof v === 'number' && Number.isFinite(v) ? Number((Math.round(Math.max(lo, Math.min(hi, v)) / step) * step).toFixed(2)) : d)

export function cleanRenderOpts(v: unknown): RenderOpts {
  const o = (v ?? {}) as Partial<Record<keyof RenderOpts, unknown>>
  const d = DEFAULT_RENDER_OPTS
  return {
    voiceRate: num(o.voiceRate, 0.7, 1.5, d.voiceRate),
    voiceVolume: num(o.voiceVolume, 0.5, 1.5, d.voiceVolume),
    music: o.music === undefined ? d.music : !!o.music,
    musicVolume: num(o.musicVolume, 0, 0.5, d.musicVolume),
    clip: num(o.clip, 2, 8, d.clip, 1),
    transition: TRANSITIONS.includes(o.transition as Transition) ? (o.transition as Transition) : d.transition,
    subSize: num(o.subSize, 36, 110, d.subSize, 1),
    subColor: typeof o.subColor === 'string' && /^#[0-9a-f]{6}$/i.test(o.subColor) ? o.subColor.toUpperCase() : d.subColor,
    subStroke: num(o.subStroke, 0, 5, d.subStroke, 0.5),
    subBox: !!o.subBox,
    subPos: num(o.subPos, 10, 90, d.subPos, 1),
    subMode: o.subMode === 'word_by_word' ? 'word_by_word' : 'sentence',
    subPop: !!o.subPop,
  }
}

/** The chosen hook opens the video: spoken and subtitled as the first line, unless it already is. */
export function withHook(lines: string[], hook: string): string[] {
  const h = hook.trim()
  if (!h || lines[0]?.trim().toLowerCase() === h.toLowerCase()) return lines
  return [h, ...lines].slice(0, MAX_LINES)
}

export interface StudioJob {
  id: string
  status: 'queued' | 'rendering' | 'done' | 'failed'
  createdAt: number
  startedAt?: number
  doneAt?: number
  topic: string
  lang: RenderLang
  voice: RenderVoice
  aspect: RenderAspect
  lines: string[]
  /** English stock-footage search terms */
  terms: string[]
  error?: string
  size?: number
  parts?: number
  chunk?: number
  duration?: number | null
  /** gradient = no photo source answered, so plain colour backgrounds were used */
  footage?: 'pexels' | 'openverse' | 'gradient' | 'upload'
  /** the user's own uploads (src/lib/studioMedia.ts) used as footage */
  media?: string[]
  run?: string
  /** missing on jobs made before v1.52: the defaults */
  opts?: RenderOpts
  /** missing on jobs made before v1.57: turbo */
  engine?: RenderEngine
  /** set when Lemo was asked for but the server farm made it */
  fallback?: LemoFallback
  /** the Lemo-Opuscar style the PC chose */
  style?: string
  /** when it was sent to Viraltech to post (after Chanh approves there) */
  handoff?: number
}

export interface RenderAsk {
  topic: string
  topicVi: string
  en: string[]
  vi: string[]
  langs: RenderLang[]
  voice: RenderVoice
  aspect: RenderAspect
  opts: RenderOpts
  /** a hook from the post kit, put first in each language's video */
  hook: { en: string; vi: string }
  /** upload ids, checked against the store by the Worker before queueing */
  media: string[]
  /** asked for; the Worker makes it turbo when the PC is off */
  engine: RenderEngine
}

/** KV with list(): the Worker binding, or a Map-backed fake in tests. */
export interface JobStore {
  put(key: string, value: string | ArrayBuffer): Promise<void>
  delete(key: string): Promise<void>
  list(o: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
  get(key: string, type?: 'text'): Promise<string | null>
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const cleanLines = (v: unknown) => (Array.isArray(v) ? v.map((l) => clean(l, MAX_LINE)).filter(Boolean).slice(0, MAX_LINES) : [])

export function cleanRenderAsk(body: unknown): RenderAsk | null {
  const b = body as Record<string, unknown> | null
  const topic = clean(b?.topic, 200)
  const en = cleanLines(b?.en)
  const vi = cleanLines(b?.vi)
  const langs = (Array.isArray(b?.langs) ? b.langs : []).filter((l): l is RenderLang => l === 'vi' || l === 'en')
  const usable = [...new Set(langs)].filter((l) => (l === 'vi' ? vi : en).length > 0)
  if (!topic || !usable.length) return null
  return {
    topic,
    topicVi: clean(b?.topicVi, 200) || topic,
    en,
    vi,
    langs: usable,
    voice: b?.voice === 'male' ? 'male' : 'female',
    aspect: b?.aspect === '16:9' || b?.aspect === '1:1' ? b.aspect : '9:16',
    opts: cleanRenderOpts(b?.opts),
    media: (Array.isArray(b?.media) ? b.media : []).filter(isJobId).slice(0, 10),
    hook: { en: clean((b?.hook as Record<string, unknown> | undefined)?.en, MAX_LINE), vi: clean((b?.hook as Record<string, unknown> | undefined)?.vi, MAX_LINE) },
    engine: b?.engine === 'lemo' ? 'lemo' : 'turbo',
  }
}

const STOP = new Set('a an and are as at be by for from how i in is it its my of on or that the this to was what why with you your'.split(' '))
/** Search terms when no AI helper answers: the topic's own words, two at a time. */
export function fallbackTerms(topic: string): string[] {
  const words = topic.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
  const terms = words.length > 1 ? words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`) : words
  const all = [...new Set([...terms, ...words])].slice(0, 6)
  return all.length ? all : ['nature landscape']
}

/** "1. ocean waves\n- sunrise" or "ocean waves, sunrise" -> ['ocean waves', 'sunrise'] */
export function parseTerms(text: string): string[] {
  return [...new Set(text.split(/[\n,]+/).map((t) => t.replace(/^[\s\-*\d.)"']+|["'\s.]+$/g, '').toLowerCase()).filter((t) => t.length > 1 && t.length < 40))].slice(0, 8)
}

export async function listJobs(kv: JobStore): Promise<StudioJob[]> {
  const names: string[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: JOB_PREFIX, cursor })
    names.push(...page.keys.map((k) => k.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  const jobs = await Promise.all(names.map(async (n) => JSON.parse((await kv.get(n)) ?? 'null') as StudioJob | null))
  return jobs.filter((j): j is StudioJob => !!j).sort((a, b) => b.createdAt - a.createdAt)
}

/** Lemo only when it was asked for, the PC is on and no uploads came along (Lemo films are drawn in code). */
export function pickEngine(ask: Pick<RenderAsk, 'engine' | 'media'>, pcOnline: boolean): { engine: RenderEngine; fallback?: LemoFallback } {
  if (ask.engine !== 'lemo') return { engine: 'turbo' }
  if (ask.media.length) return { engine: 'turbo', fallback: 'uploads' }
  return pcOnline ? { engine: 'lemo' } : { engine: 'turbo', fallback: 'pc-offline' }
}

/** One job per language. Returns null when the farm already has MAX_ACTIVE waiting. */
export async function queueJobs(kv: JobStore, ask: RenderAsk, terms: string[], now = Date.now(), uuid = () => crypto.randomUUID(), pcOnline = false): Promise<StudioJob[] | null> {
  const active = (await listJobs(kv)).filter((j) => j.status === 'queued' || j.status === 'rendering').length
  if (active + ask.langs.length > MAX_ACTIVE) return null
  const how = pickEngine(ask, pcOnline)
  const made = ask.langs.map((lang, i): StudioJob => ({
    id: uuid(),
    status: 'queued',
    createdAt: now + i,
    topic: lang === 'vi' ? ask.topicVi : ask.topic,
    lang,
    voice: ask.voice,
    aspect: ask.aspect,
    lines: withHook(lang === 'vi' ? ask.vi : ask.en, ask.hook[lang]),
    terms,
    opts: ask.opts,
    ...(ask.media.length ? { media: ask.media } : {}),
    ...how,
  }))
  await Promise.all(made.map((j) => kv.put(JOB_PREFIX + j.id, JSON.stringify(j))))
  return made
}

/** Is the home PC asking for Lemo work right now? */
export async function pcOnline(kv: JobStore, now = Date.now()): Promise<boolean> {
  const seen = Number(await kv.get(LEMO_SEEN_KEY))
  return Number.isFinite(seen) && now - seen < PC_ONLINE_MS
}

const day = (now: number) => new Date(now).toISOString().slice(0, 10)

/**
 * The home PC asks for work: marks it online, then hands over the oldest waiting Lemo job (as "rendering"),
 * unless today's LEMO_DAILY films are made. Jobs older than LEMO_WAIT_MS are left to the server farm.
 * take = false only says "still here" while the PC is busy with a film.
 */
export async function pickLemo(kv: JobStore, now = Date.now(), take = true): Promise<StudioJob | null> {
  await kv.put(LEMO_SEEN_KEY, String(now))
  if (!take) return null
  const made = Number(await kv.get(LEMO_COUNT_KEY(day(now)))) || 0
  if (made >= LEMO_DAILY) return null
  const job = (await listJobs(kv))
    .filter((j) => j.engine === 'lemo' && j.status === 'queued' && now - j.createdAt < LEMO_WAIT_MS)
    .sort((a, b) => a.createdAt - b.createdAt)[0]
  if (!job) return null
  const taken: StudioJob = { ...job, status: 'rendering', startedAt: now }
  await kv.put(JOB_PREFIX + job.id, JSON.stringify(taken))
  await kv.put(LEMO_COUNT_KEY(day(now)), String(made + 1))
  return taken
}

/** KV values stop at 25 MiB; the PC sends 20 MiB chunks, like nova/queue.mjs */
export const LEMO_CHUNK = 20 * 1024 * 1024
/** 20 chunks = 400 MiB, far above a short film */
const LEMO_MAX_PARTS = 20

/** One chunk of a Lemo MP4 from the PC; only for a job the PC is rendering. */
export async function putLemoPart(kv: JobStore, id: string, i: number, data: ArrayBuffer): Promise<'ok' | 'missing' | 'bad'> {
  const job = await getJob(kv, id)
  if (!job || job.engine !== 'lemo' || job.status !== 'rendering') return 'missing'
  if (!Number.isInteger(i) || i < 0 || i >= LEMO_MAX_PARTS || !data.byteLength || data.byteLength > LEMO_CHUNK) return 'bad'
  await kv.put(`${VID_PREFIX}${id}:${i}`, data)
  return 'ok'
}

/** The PC is done: the video is in its chunks, or it failed. */
export async function finishLemo(kv: JobStore, id: string, body: unknown, now = Date.now()): Promise<boolean> {
  const job = await getJob(kv, id)
  if (!job || job.engine !== 'lemo' || job.status !== 'rendering') return false
  const b = (body ?? {}) as Record<string, unknown>
  const size = Number(b.size)
  const parts = Number(b.parts)
  if (b.ok !== true || !(size > 0) || !Number.isInteger(parts) || parts < 1 || parts > LEMO_MAX_PARTS || size > parts * LEMO_CHUNK) {
    await kv.put(JOB_PREFIX + id, JSON.stringify({ ...job, status: 'failed', doneAt: now, error: clean(b.error, 300) || 'the PC could not make the video' }))
    return true
  }
  const done: StudioJob = { ...job, status: 'done', doneAt: now, size, parts, chunk: LEMO_CHUNK, duration: Number(b.duration) > 0 ? Number(b.duration) : null, style: clean(b.style, 60) || undefined, error: undefined }
  await kv.put(JOB_PREFIX + id, JSON.stringify(done))
  return true
}

/** Send a finished video to Viraltech's waiting list, or take it back. Nothing is posted here. */
export async function setHandoff(kv: JobStore, id: string, on: boolean, now = Date.now()): Promise<StudioJob | null> {
  const job = await getJob(kv, id)
  if (!job || job.status !== 'done') return null
  const next: StudioJob = { ...job, handoff: on ? now : undefined }
  await kv.put(JOB_PREFIX + id, JSON.stringify(next))
  return next
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const isJobId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id)

export async function getJob(kv: JobStore, id: string): Promise<StudioJob | null> {
  return isJobId(id) ? (JSON.parse((await kv.get(JOB_PREFIX + id)) ?? 'null') as StudioJob | null) : null
}

export async function deleteJob(kv: JobStore, id: string): Promise<boolean> {
  const job = await getJob(kv, id)
  if (!job) return false
  await Promise.all(Array.from({ length: job.parts ?? 0 }, (_, i) => kv.delete(`${VID_PREFIX}${id}:${i}`)))
  await kv.delete(JOB_PREFIX + id)
  return true
}

/** "bytes=0-" style header -> inclusive [start, end], or null for none / unsatisfiable. */
export function parseRange(header: string | null, size: number): [number, number] | null | 'bad' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (!m[1] && !m[2])) return 'bad'
  let start: number
  let end: number
  if (!m[1]) {
    start = Math.max(0, size - Number(m[2]))
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
  }
  return start > end || start >= size ? 'bad' : [start, end]
}

/**
 * The finished MP4. Phones (Safari above all) play video only with Range support,
 * so a range is answered from just the chunks it touches.
 */
export async function videoResponse(kv: JobStore, id: string, range: string | null, download: boolean): Promise<Response> {
  const job = await getJob(kv, id)
  if (!job || job.status !== 'done' || !job.size || !job.parts || !job.chunk) return new Response('Not found', { status: 404 })
  const size = job.size
  const chunk = job.chunk
  const r = parseRange(range, size)
  if (r === 'bad') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
  const [start, end] = r ?? [0, size - 1]
  const first = Math.floor(start / chunk)
  const last = Math.floor(end / chunk)
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      for (let i = first; i <= last; i++) {
        const buf = await kv.get(`${VID_PREFIX}${id}:${i}`, 'arrayBuffer')
        if (!buf) return c.error(new Error(`missing part ${i}`))
        const from = i === first ? start - i * chunk : 0
        const to = i === last ? end - i * chunk + 1 : buf.byteLength
        c.enqueue(new Uint8Array(buf, from, to - from))
      }
      c.close()
    },
  })
  const slug = job.topic.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'nova'
  const headers: Record<string, string> = {
    'content-type': 'video/mp4',
    'accept-ranges': 'bytes',
    'content-length': String(end - start + 1),
    'cache-control': 'private, max-age=3600',
  }
  if (r) headers['content-range'] = `bytes ${start}-${end}/${size}`
  if (download) headers['content-disposition'] = `attachment; filename="${slug}-${job.lang}.mp4"`
  return new Response(body, { status: r ? 206 : 200, headers })
}

const GH_HEADERS = (token: string) => ({ authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'nova-studio', 'x-github-api-version': '2022-11-28' })

/** Start the render workflow now. False when GitHub refused (bad or expired token). */
export async function kickFarm(token: string, f: typeof fetch = fetch): Promise<boolean> {
  const r = await f(`https://api.github.com/repos/${NOVA_REPO}/actions/workflows/${NOVA_WORKFLOW}/dispatches`, { method: 'POST', headers: { ...GH_HEADERS(token), 'content-type': 'application/json' }, body: JSON.stringify({ ref: 'main' }) }).catch(() => null)
  return r?.status === 204
}

/** A saved token must at least see the workflow; a typo shows up here, not in a silent queue. */
export async function checkGithubToken(token: string, f: typeof fetch = fetch): Promise<boolean> {
  const r = await f(`https://api.github.com/repos/${NOVA_REPO}/actions/workflows/${NOVA_WORKFLOW}`, { headers: GH_HEADERS(token) }).catch(() => null)
  return r?.status === 200
}
