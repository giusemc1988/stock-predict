import assert from 'node:assert/strict'
import { JOB_PREFIX, MAX_ACTIVE, VID_PREFIX, checkGithubToken, cleanRenderAsk, kickFarm, deleteJob, fallbackTerms, isJobId, listJobs, parseRange, parseTerms, queueJobs, videoResponse, type JobStore } from '../src/lib/studioJobs'

/** Map-backed stand-in for the SETTINGS KV binding. */
function fakeKv(): JobStore & { m: Map<string, string | ArrayBuffer> } {
  const m = new Map<string, string | ArrayBuffer>()
  return {
    m,
    async get(k: string, type?: 'text' | 'arrayBuffer') {
      const v = m.get(k)
      if (v === undefined) return null
      return (type === 'arrayBuffer' ? v : v) as never
    },
    async put(k, v) { m.set(k, v) },
    async delete(k) { m.delete(k) },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true } },
  }
}

// asks are cleaned: no topic or no lines for the chosen language -> refused
assert.equal(cleanRenderAsk({ topic: '', vi: ['a'], langs: ['vi'] }), null)
assert.equal(cleanRenderAsk({ topic: 'x', vi: [], en: ['a'], langs: ['vi'] }), null)
const ask = cleanRenderAsk({ topic: ' Why  the sea is blue ', topicVi: 'Vì sao biển xanh', en: ['One', ' ', 'Two'], vi: ['Một', 'Hai'], langs: ['vi', 'en', 'vi', 'fr'], voice: 'male', aspect: '16:9' })!
assert.deepEqual(ask.langs, ['vi', 'en'])
assert.equal(ask.topic, 'Why the sea is blue')
assert.deepEqual(ask.en, ['One', 'Two'])
assert.equal(ask.voice, 'male')
assert.equal(cleanRenderAsk({ topic: 'x', en: ['a'], langs: ['en'], aspect: 'weird' })!.aspect, '9:16')
assert.equal(cleanRenderAsk({ topic: 'x', en: Array(30).fill('line'), langs: ['en'] })!.en.length, 12)

// search terms: AI lists are cleaned, the topic is the fallback
assert.deepEqual(parseTerms('1. Ocean Waves\n- "sunrise beach"\n* deep water.'), ['ocean waves', 'sunrise beach', 'deep water'])
assert.deepEqual(parseTerms('ocean, sky , ocean'), ['ocean', 'sky'])
assert.ok(fallbackTerms('Why the ocean is blue').includes('ocean blue'))
assert.deepEqual(fallbackTerms('?!'), ['nature landscape'])

// one job per language, in the order asked; the farm takes at most MAX_ACTIVE at once
const kv = fakeKv()
let n = 0
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const made = (await queueJobs(kv, ask, ['ocean'], 1000, uuid))!
assert.equal(made.length, 2)
assert.equal(made[0].lang, 'vi')
assert.equal(made[0].topic, 'Vì sao biển xanh')
assert.deepEqual(made[1].lines, ['One', 'Two'])
assert.ok(made.every((j) => j.status === 'queued' && isJobId(j.id)))
assert.equal((await listJobs(kv))[0].lang, 'en', 'newest first')
assert.ok(await queueJobs(kv, ask, ['ocean'], 2000, uuid))
assert.equal(MAX_ACTIVE, 4)
assert.equal(await queueJobs(kv, ask, ['ocean'], 3000, uuid), null, 'a fifth job waits')

// ids must be the Worker's own UUIDs
assert.ok(!isJobId('../x'))
assert.ok(!isJobId('00000000-0000-4000-8000-00000000000Z'))

// ranges, as phones ask for them
assert.equal(parseRange(null, 10), null)
assert.deepEqual(parseRange('bytes=0-', 10), [0, 9])
assert.deepEqual(parseRange('bytes=2-4', 10), [2, 4])
assert.deepEqual(parseRange('bytes=-3', 10), [7, 9])
assert.deepEqual(parseRange('bytes=5-99', 10), [5, 9])
assert.equal(parseRange('bytes=10-', 10), 'bad')
assert.equal(parseRange('items=0-1', 10), 'bad')

// a finished video in 3-byte chunks is served whole or by range across chunk edges
const done = { ...made[0], status: 'done' as const, size: 8, parts: 3, chunk: 3 }
await kv.put(JOB_PREFIX + done.id, JSON.stringify(done))
const bytes = [[0, 1, 2], [3, 4, 5], [6, 7]]
bytes.forEach((b, i) => kv.m.set(`${VID_PREFIX}${done.id}:${i}`, new Uint8Array(b).buffer))
const whole = await videoResponse(kv, done.id, null, false)
assert.equal(whole.status, 200)
assert.deepEqual([...new Uint8Array(await whole.arrayBuffer())], [0, 1, 2, 3, 4, 5, 6, 7])
const part = await videoResponse(kv, done.id, 'bytes=2-6', true)
assert.equal(part.status, 206)
assert.equal(part.headers.get('content-range'), 'bytes 2-6/8')
assert.equal(part.headers.get('content-length'), '5')
assert.match(part.headers.get('content-disposition') ?? '', /attachment; filename="vi-sao-bien-xanh-vi\.mp4"/)
assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [2, 3, 4, 5, 6])
assert.equal((await videoResponse(kv, done.id, 'bytes=9-', false)).status, 416)
assert.equal((await videoResponse(kv, made[1].id, null, false)).status, 404, 'not done yet')

// deleting removes the job and every chunk
assert.ok(await deleteJob(kv, done.id))
assert.ok(![...kv.m.keys()].some((k) => k.includes(done.id)))
assert.equal(await deleteJob(kv, done.id), false)

// the GitHub key starts nova-render.yml on main, and is checked before it is saved
const calls: { url: string; init?: RequestInit }[] = []
const gh = (status: number) => (async (url: string, init?: RequestInit) => { calls.push({ url, init }); return new Response(null, { status }) }) as unknown as typeof fetch
assert.ok(await kickFarm('tok', gh(204)))
assert.equal(calls[0].url, 'https://api.github.com/repos/giusemc1988/stock-predict/actions/workflows/nova-render.yml/dispatches')
assert.equal(calls[0].init?.method, 'POST')
assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { ref: 'main' })
assert.equal((calls[0].init?.headers as Record<string, string>).authorization, 'Bearer tok')
assert.equal(await kickFarm('tok', gh(401)), false)
assert.equal(await kickFarm('tok', (async () => { throw new Error('offline') }) as unknown as typeof fetch), false)
assert.ok(await checkGithubToken('tok', gh(200)))
assert.equal(await checkGithubToken('tok', gh(404)), false)

// video settings: clamped, odd values fall back to Nova's defaults
{
  const { DEFAULT_RENDER_OPTS, cleanRenderOpts, withHook } = await import('../src/lib/studioJobs')
  assert.deepEqual(cleanRenderOpts(undefined), DEFAULT_RENDER_OPTS)
  const o = cleanRenderOpts({ voiceRate: 9, voiceVolume: 0.73, music: false, musicVolume: -1, clip: 3.6, transition: 'Spin', subSize: 500, subColor: '#ffe14d', subStroke: 2.3, subBox: 1, subPos: 5, subMode: 'word_by_word', subPop: true })
  assert.equal(o.voiceRate, 1.5)
  assert.equal(o.voiceVolume, 0.73)
  assert.equal(o.music, false)
  assert.equal(o.musicVolume, 0)
  assert.equal(o.clip, 4)
  assert.equal(o.transition, 'none')
  assert.equal(o.subSize, 110)
  assert.equal(o.subColor, '#FFE14D')
  assert.equal(o.subStroke, 2.5)
  assert.equal(o.subBox, true)
  assert.equal(o.subPos, 10)
  assert.equal(o.subMode, 'word_by_word')
  assert.equal(cleanRenderOpts({ subColor: 'red; drop' }).subColor, '#FFFFFF')
  assert.equal(cleanRenderOpts({ voiceRate: 1.15 }).voiceRate, 1.15)

  // the hook opens the video once
  assert.deepEqual(withHook(['a', 'b'], 'Hook!'), ['Hook!', 'a', 'b'])
  assert.deepEqual(withHook(['Hook!', 'b'], ' hook! '), ['Hook!', 'b'])
  assert.deepEqual(withHook(['a'], ''), ['a'])
  assert.equal(withHook(Array(12).fill('x'), 'h').length, 12)

  const kv2 = fakeKv()
  const a2 = cleanRenderAsk({ topic: 'Sea', en: ['One'], vi: ['Một'], langs: ['vi', 'en'], aspect: '1:1', opts: { subSize: 80 }, hook: { vi: 'Bạn có biết?', en: '' } })!
  assert.equal(a2.aspect, '1:1')
  const jobs2 = (await queueJobs(kv2, a2, ['sea'], 1, uuid))!
  const vi2 = jobs2.find((j) => j.lang === 'vi')!
  const en2 = jobs2.find((j) => j.lang === 'en')!
  assert.deepEqual(vi2.lines, ['Bạn có biết?', 'Một'])
  assert.deepEqual(en2.lines, ['One'])
  assert.equal(vi2.opts!.subSize, 80)
}
console.log('novajobs ok')
