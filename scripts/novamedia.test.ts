import assert from 'node:assert/strict'
import { MAX_MEDIA_BYTES, MEDIA_BUDGET, MEDIA_CHUNK, MEDIA_PREFIX, deleteMedia, finishMedia, listMedia, putMediaPart, readyMedia, startMedia, type MediaStore } from '../src/lib/studioMedia'
import { cleanRenderAsk, queueJobs, type JobStore } from '../src/lib/studioJobs'

function fakeKv() {
  const m = new Map<string, string | ArrayBuffer>()
  const ttl = new Map<string, number | undefined>()
  const kv: MediaStore & { m: typeof m; ttl: typeof ttl } = {
    m,
    ttl,
    async get(k) {
      const v = m.get(k)
      return typeof v === 'string' ? v : v ? '[bytes]' : null
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

console.log('novamedia ok')
