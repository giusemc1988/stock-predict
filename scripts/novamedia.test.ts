import assert from 'node:assert/strict'
import { mediaResponse, importHostOk, importPart, importStart, MAX_MEDIA_BYTES, MEDIA_BUDGET, MEDIA_CHUNK, MEDIA_PREFIX, deleteMedia, finishMedia, listMedia, putMediaPart, readyMedia, startMedia, type MediaStore } from '../src/lib/studioMedia'
import { cleanRenderAsk, queueJobs, type JobStore } from '../src/lib/studioJobs'

function fakeKv() {
  const m = new Map<string, string | ArrayBuffer>()
  const ttl = new Map<string, number | undefined>()
  const kv: MediaStore & { m: typeof m; ttl: typeof ttl } = {
    m,
    ttl,
    async get(k: string, type?: string) {
      const v = m.get(k)
      if (type === 'arrayBuffer') return (typeof v === 'string' ? null : v ?? null) as never
      return (typeof v === 'string' ? v : v ? '[bytes]' : null) as never
    },
    async put(k, v, o) {
      m.set(k, v)
      ttl.set(k, o?.expirationTtl)
    },
    async delete(k) {
      m.delete(k)
    },
    async list({ prefix }) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }
    },
  }
  return kv
}
let n = 0
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

const kv = fakeKv()
// type and size are checked before anything is stored
assert.deepEqual(await startMedia(kv, { type: 'application/pdf', size: 10 }), { error: 'type' })
assert.deepEqual(await startMedia(kv, { type: 'image/jpeg', size: MAX_MEDIA_BYTES + 1 }), { error: 'size' })
assert.deepEqual(await startMedia(kv, { type: 'image/jpeg', size: 0 }), { error: 'size' })
assert.equal(kv.m.size, 0)

// a 20 MB clip: 3 parts, the last one shorter
const size = 20 * 1024 * 1024
const r = await startMedia(kv, { type: 'video/mp4', size }, 1, uuid)
assert.ok('item' in r)
const item = r.item
assert.equal(item.kind, 'video')
assert.equal(item.parts, 3)
assert.ok(kv.ttl.get(MEDIA_PREFIX + item.id)! > 0, 'uploads expire')
assert.equal(await putMediaPart(kv, item.id, 0, new ArrayBuffer(MEDIA_CHUNK)), 'ok')
assert.equal(await putMediaPart(kv, item.id, 1, new ArrayBuffer(10)), 'bad', 'a middle part must be a full chunk')
assert.equal(await putMediaPart(kv, item.id, 3, new ArrayBuffer(10)), 'bad', 'no part past the end')
assert.equal(await putMediaPart(kv, '00000000-0000-4000-8000-999999999999', 0, new ArrayBuffer(1)), 'missing')
assert.equal(await finishMedia(kv, item.id), null, 'not done with parts missing')
assert.equal(await putMediaPart(kv, item.id, 1, new ArrayBuffer(MEDIA_CHUNK)), 'ok')
assert.equal(await putMediaPart(kv, item.id, 2, new ArrayBuffer(size - 2 * MEDIA_CHUNK)), 'ok')
assert.equal((await finishMedia(kv, item.id))!.done, true)
assert.equal((await listMedia(kv)).length, 1, 'parts are not listed as uploads')

// a render only gets finished uploads, de-duplicated, in order
const half = await startMedia(kv, { type: 'image/png', size: 100 }, 2, uuid)
assert.ok('item' in half)
assert.deepEqual(await readyMedia(kv, [half.item.id, item.id, item.id, 'nope', 7]), [item.id])

// the shared budget
const big = fakeKv()
for (let i = 0; i < Math.floor(MEDIA_BUDGET / MAX_MEDIA_BYTES); i++) assert.ok('item' in (await startMedia(big, { type: 'video/mp4', size: MAX_MEDIA_BYTES }, i, uuid)))
assert.deepEqual(await startMedia(big, { type: 'video/mp4', size: MAX_MEDIA_BYTES }, 99, uuid), { error: 'full' })

// delete removes the record and every part
assert.equal(await deleteMedia(kv, item.id), true)
assert.equal([...kv.m.keys()].filter((k) => k.includes(item.id)).length, 0)
assert.equal(await deleteMedia(kv, item.id), false)

// render asks carry upload ids into the job
const ask = cleanRenderAsk({ topic: 'Sea', vi: ['Một'], langs: ['vi'], media: [item.id, 'x', half.item.id] })!
assert.deepEqual(ask.media, [item.id, half.item.id])
const jobs = (await queueJobs(fakeKv() as unknown as JobStore, ask, ['sea'], 1, uuid))!
assert.deepEqual(jobs[0].media, [item.id, half.item.id])
const plain = (await queueJobs(fakeKv() as unknown as JobStore, { ...ask, media: [] }, ['sea'], 1, uuid))!
assert.equal('media' in plain[0], false)


{
  // clips fetched from a Muse link, part by part, by byte range
  assert.ok(importHostOk('https://muse.ai/files/1/2/x.mp4'))
  assert.ok(importHostOk('https://cdn.muse.ai/a.mp4'))
  for (const bad of ['http://muse.ai/a.mp4', 'https://evil.com/muse.ai', 'https://muse.ai.evil.com/a.mp4', 'https://muse.ai:8443/a.mp4', 'not a url', 'https://169.254.169.254/'])
    assert.equal(importHostOk(bad), false, bad)
  const total = MEDIA_CHUNK + 1000
  const data = new Uint8Array(total).map((_, i) => i % 251)
  const calls: string[] = []
  const fake = (async (_u: string, init: RequestInit) => {
    const r = /bytes=(\d+)-(\d+)/.exec((init.headers as Record<string, string>).range)!
    calls.push(r[0])
    const a = Number(r[1]), b = Math.min(Number(r[2]), total - 1)
    return new Response(data.slice(a, b + 1), { status: 206, headers: { 'content-range': `bytes ${a}-${b}/${total}`, 'content-type': 'video/mp4' } })
  }) as unknown as typeof fetch
  const kv = fakeKv()
  const link = 'https://muse.ai/files/1/2/clip.mp4'
  assert.deepEqual(await importStart(kv, 'https://evil.com/a.mp4', fake), { error: 'host' })
  const st = await importStart(kv, link, fake)
  assert.ok('item' in st && st.item.parts === 2 && st.item.size === total && st.item.kind === 'video')
  const id = (st as { item: { id: string } }).item.id
  assert.equal(await importPart(kv, link, id, 0, fake), 'ok')
  assert.equal(await importPart(kv, link, id, 1, fake), 'ok')
  assert.equal(await importPart(kv, link, id, 2, fake), 'bad')
  assert.equal(await importPart(kv, 'https://evil.com/a.mp4', id, 0, fake), 'host')
  assert.equal((await finishMedia(kv, id))?.done, true)
  assert.deepEqual(calls.slice(1), [`bytes=0-${MEDIA_CHUNK - 1}`, `bytes=${MEDIA_CHUNK}-${total - 1}`])
  // a server that ignores Range (answers 200) is refused, not stored whole
  const noRange = (async () => new Response('x', { status: 200 })) as unknown as typeof fetch
  assert.deepEqual(await importStart(kv, link, noRange), { error: 'fetch' })
}

{
  // preview: a stored clip served with Range across part boundaries
  const kv = fakeKv()
  const size = MEDIA_CHUNK + 5000
  const data = new Uint8Array(size).map((_, i) => (i * 7) % 253)
  const st = await startMedia(kv, { type: 'video/mp4', size })
  const id = (st as { item: { id: string } }).item.id
  assert.equal((await mediaResponse(kv, id, null)).status, 404, 'not ready until finished')
  await putMediaPart(kv, id, 0, data.slice(0, MEDIA_CHUNK).buffer)
  await putMediaPart(kv, id, 1, data.slice(MEDIA_CHUNK).buffer)
  await finishMedia(kv, id)
  const all = await mediaResponse(kv, id, null)
  assert.equal(all.status, 200)
  assert.deepEqual(new Uint8Array(await all.arrayBuffer()), data)
  const mid = await mediaResponse(kv, id, `bytes=${MEDIA_CHUNK - 10}-${MEDIA_CHUNK + 9}`)
  assert.equal(mid.status, 206)
  assert.equal(mid.headers.get('content-range'), `bytes ${MEDIA_CHUNK - 10}-${MEDIA_CHUNK + 9}/${size}`)
  assert.deepEqual(new Uint8Array(await mid.arrayBuffer()), data.slice(MEDIA_CHUNK - 10, MEDIA_CHUNK + 10))
  const tail = await mediaResponse(kv, id, 'bytes=-100')
  assert.deepEqual(new Uint8Array(await tail.arrayBuffer()), data.slice(size - 100))
  assert.equal((await mediaResponse(kv, id, `bytes=${size}-`)).status, 416)
  assert.equal((await mediaResponse(kv, id, 'nonsense')).status, 416)
  assert.equal((await mediaResponse(kv, 'not-an-id', null)).status, 404)
}
console.log('novamedia ok')
