/**
 * Nova's server renders (MoneyPrinterTurbo on GitHub Actions). The Worker only keeps the queue and
 * serves the finished MP4s; .github/workflows/nova-render.yml picks jobs and stores videos with
 * nova/queue.mjs. Both sides share this KV layout in the SETTINGS namespace:
 *   nova:job:<id>       one StudioJob as JSON
 *   nova:vid:<id>:<n>   the MP4 in chunks of job.chunk bytes (KV values stop at 25 MiB)
 *   nova:pexels         optional free Pexels key for real footage (otherwise Openverse photos)
 */
export const JOB_PREFIX = 'nova:job:'
export const VID_PREFIX = 'nova:vid:'
export const PEXELS_KEY = 'nova:pexels'
/** queued + rendering at once; more waits for the farm to catch up */
export const MAX_ACTIVE = 4
const MAX_LINES = 12
const MAX_LINE = 300

export type RenderLang = 'vi' | 'en'
export type RenderVoice = 'female' | 'male'
export type RenderAspect = '9:16' | '16:9'

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
  footage?: 'pexels' | 'openverse'
  run?: string
}

export interface RenderAsk {
  topic: string
  topicVi: string
  en: string[]
  vi: string[]
  langs: RenderLang[]
  voice: RenderVoice
  aspect: RenderAspect
}

/** KV with list(): the Worker binding, or a Map-backed fake in tests. */
export interface JobStore {
  put(key: string, value: string): Promise<void>
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
    aspect: b?.aspect === '16:9' ? '16:9' : '9:16',
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

/** One job per language. Returns null when the farm already has MAX_ACTIVE waiting. */
export async function queueJobs(kv: JobStore, ask: RenderAsk, terms: string[], now = Date.now(), uuid = () => crypto.randomUUID()): Promise<StudioJob[] | null> {
  const active = (await listJobs(kv)).filter((j) => j.status === 'queued' || j.status === 'rendering').length
  if (active + ask.langs.length > MAX_ACTIVE) return null
  const made = ask.langs.map((lang, i): StudioJob => ({
    id: uuid(),
    status: 'queued',
    createdAt: now + i,
    topic: lang === 'vi' ? ask.topicVi : ask.topic,
    lang,
    voice: ask.voice,
    aspect: ask.aspect,
    lines: lang === 'vi' ? ask.vi : ask.en,
    terms,
  }))
  await Promise.all(made.map((j) => kv.put(JOB_PREFIX + j.id, JSON.stringify(j))))
  return made
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
