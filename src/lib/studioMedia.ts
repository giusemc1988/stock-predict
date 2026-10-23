/**
 * Your own photos and clips for Nova's server render. The phone uploads each file in parts to the Worker
 * (/api/studio/media), which keeps them in the SETTINGS KV for MEDIA_TTL_S; nova/queue.mjs downloads the
 * ones a job names and nova/render.py uses them as the footage. No file names are kept anywhere:
 * the repo is public and the render logs are too.
 *   nova:media:<id>       MediaItem as JSON
 *   nova:media:<id>:<n>   part n of the file, MEDIA_CHUNK bytes each
 */
export const MEDIA_PREFIX = 'nova:media:'
/** parts small enough for a phone on mobile data to retry cheaply */
export const MEDIA_CHUNK = 8 * 1024 * 1024
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024
export const MAX_MEDIA_FILES = 10
export const MAX_CLIP_SECONDS = 60
/** all uploads together; the free KV holds 1 GB and also keeps the finished videos */
export const MEDIA_BUDGET = 400 * 1024 * 1024
/** uploads clean themselves up after 3 days */
export const MEDIA_TTL_S = 3 * 24 * 3600

export const MEDIA_TYPES: Record<string, { kind: 'image' | 'video'; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'video/webm': { kind: 'video', ext: 'webm' },
}

export interface MediaItem {
  id: string
  kind: 'image' | 'video'
  type: string
  size: number
  parts: number
  chunk: number
  createdAt: number
  /** every part arrived */
  done: boolean
}

export interface MediaStore {
  get(key: string, type?: 'text'): Promise<string | null>
  put(key: string, value: string | ArrayBuffer, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(o: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const isMediaId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id)
const partCount = (size: number) => Math.max(1, Math.ceil(size / MEDIA_CHUNK))

export async function getMedia(kv: MediaStore, id: string): Promise<MediaItem | null> {
  return isMediaId(id) ? (JSON.parse((await kv.get(MEDIA_PREFIX + id)) ?? 'null') as MediaItem | null) : null
}

/** Every upload's record (not the parts). */
export async function listMedia(kv: MediaStore): Promise<MediaItem[]> {
  const names: string[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: MEDIA_PREFIX, cursor })
    names.push(...page.keys.map((k) => k.name).filter((n) => isMediaId(n.slice(MEDIA_PREFIX.length))))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return (await Promise.all(names.map((n) => kv.get(n)))).map((v) => JSON.parse(v ?? 'null') as MediaItem | null).filter((m): m is MediaItem => !!m)
}

export type StartResult = { item: MediaItem } | { error: 'type' | 'size' | 'full' }

/** A new upload: checks the type, the size and the shared budget, then waits for its parts. */
export async function startMedia(kv: MediaStore, body: unknown, now = Date.now(), uuid = () => crypto.randomUUID()): Promise<StartResult> {
  const b = body as { type?: unknown; size?: unknown } | null
  const type = typeof b?.type === 'string' ? b.type.toLowerCase() : ''
  const size = Number(b?.size)
  const t = MEDIA_TYPES[type]
  if (!t) return { error: 'type' }
  if (!Number.isInteger(size) || size < 1 || size > MAX_MEDIA_BYTES) return { error: 'size' }
  const used = (await listMedia(kv)).reduce((s, m) => s + m.size, 0)
  if (used + size > MEDIA_BUDGET) return { error: 'full' }
  const item: MediaItem = { id: uuid(), kind: t.kind, type, size, parts: partCount(size), chunk: MEDIA_CHUNK, createdAt: now, done: false }
  await kv.put(MEDIA_PREFIX + item.id, JSON.stringify(item), { expirationTtl: MEDIA_TTL_S })
  return { item }
}

/** One part. The last part may be shorter; every other part is exactly item.chunk bytes. */
export async function putMediaPart(kv: MediaStore, id: string, i: number, data: ArrayBuffer): Promise<'ok' | 'missing' | 'bad'> {
  const item = await getMedia(kv, id)
  if (!item) return 'missing'
  if (!Number.isInteger(i) || i < 0 || i >= item.parts) return 'bad'
  const want = i === item.parts - 1 ? item.size - i * item.chunk : item.chunk
  if (data.byteLength !== want) return 'bad'
  await kv.put(`${MEDIA_PREFIX}${id}:${i}`, data, { expirationTtl: MEDIA_TTL_S })
  return 'ok'
}

/** Marks the upload ready once every part is there. */
export async function finishMedia(kv: MediaStore, id: string): Promise<MediaItem | null> {
  const item = await getMedia(kv, id)
  if (!item) return null
  const have = new Set((await kv.list({ prefix: `${MEDIA_PREFIX}${id}:` })).keys.map((k) => k.name))
  for (let i = 0; i < item.parts; i++) if (!have.has(`${MEDIA_PREFIX}${id}:${i}`)) return null
  const done = { ...item, done: true }
  await kv.put(MEDIA_PREFIX + id, JSON.stringify(done), { expirationTtl: MEDIA_TTL_S })
  return done
}

export async function deleteMedia(kv: MediaStore, id: string): Promise<boolean> {
  const item = await getMedia(kv, id)
  if (!item) return false
  await Promise.all(Array.from({ length: item.parts }, (_, i) => kv.delete(`${MEDIA_PREFIX}${id}:${i}`)))
  await kv.delete(MEDIA_PREFIX + id)
  return true
}

/** The ids a render asks for that are finished uploads, in order, at most MAX_MEDIA_FILES. */
export async function readyMedia(kv: MediaStore, ids: unknown): Promise<string[]> {
  const want = [...new Set((Array.isArray(ids) ? ids : []).filter(isMediaId))].slice(0, MAX_MEDIA_FILES)
  const items = await Promise.all(want.map((id) => getMedia(kv, id)))
  return want.filter((_, i) => items[i]?.done)
}
