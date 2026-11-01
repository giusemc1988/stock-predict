import assert from 'node:assert/strict'
import { lumiRoute } from '../src/worker/lumi'

const req = (url: string, init?: RequestInit) => new Request(`https://x${url}`, init)

// /api/lumi/hear: wrong method
assert.equal((await lumiRoute(req('/api/lumi/hear'), '/api/lumi/hear', {}))?.status, 405)
// /api/lumi/hear: no Groq key configured -> 409, not a crash
{
  const r = await lumiRoute(req('/api/lumi/hear', { method: 'POST', headers: { origin: 'https://x' } }), '/api/lumi/hear', {})
  assert.equal(r?.status, 409)
}

// /api/lumi/group: empty lines -> empty conversations, no AI call needed
{
  const r = await lumiRoute(req('/api/lumi/group', { method: 'POST', headers: { origin: 'https://x', 'content-type': 'application/json' }, body: JSON.stringify({ lines: [] }) }), '/api/lumi/group', {})
  assert.equal(r?.status, 200)
  const j = (await r!.json()) as { conversations: unknown[] }
  assert.deepEqual(j.conversations, [])
}
// /api/lumi/group: no AI key configured -> falls back to one bucket per language, never 500s
{
  const lines = [{ text: 'hello', lang: 'en', at: 1 }, { text: 'bonjour', lang: 'fr', at: 2 }]
  const r = await lumiRoute(req('/api/lumi/group', { method: 'POST', headers: { origin: 'https://x', 'content-type': 'application/json' }, body: JSON.stringify({ lines, mode: 'ambient' }) }), '/api/lumi/group', {})
  assert.equal(r?.status, 200)
  const j = (await r!.json()) as { conversations: { lang: string }[] }
  assert.equal(j.conversations.length, 2)
}

// /api/lumi/trips: no KV configured
assert.equal((await lumiRoute(req('/api/lumi/trips'), '/api/lumi/trips', {}))?.status, 501)

// /api/lumi/trips: GET then POST then GET again, using an in-memory fake KV
{
  const store = new Map<string, string>()
  const kv = { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => void store.set(k, v), delete: async (k: string) => void store.delete(k) }
  const empty = await lumiRoute(req('/api/lumi/trips'), '/api/lumi/trips', {}, kv)
  assert.deepEqual((await empty!.json()) as { trips: unknown[] }, { trips: [] })

  const saved = await lumiRoute(
    req('/api/lumi/trips', { method: 'POST', headers: { origin: 'https://x', 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'ambient', conversations: [{ lang: 'en', summaryVi: 'Tóm tắt' }] }) }),
    '/api/lumi/trips',
    {},
    kv,
  )
  assert.equal(saved?.status, 200)

  const after = await lumiRoute(req('/api/lumi/trips'), '/api/lumi/trips', {}, kv)
  const j = (await after!.json()) as { trips: { conversations: { summaryVi: string }[] }[] }
  assert.equal(j.trips.length, 1)
  assert.equal(j.trips[0].conversations[0].summaryVi, 'Tóm tắt')
}

// /api/lumi/say: method, bad input, no helper keys -> 503
assert.equal((await lumiRoute(req('/api/lumi/say'), '/api/lumi/say', {}))?.status, 405)
{
  const post = (body: unknown) => req('/api/lumi/say', { method: 'POST', headers: { origin: 'https://x', 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await lumiRoute(post({ text: 'xin chào', lang: 'xx' }), '/api/lumi/say', {}))?.status, 400)
  assert.equal((await lumiRoute(post({ text: '', lang: 'ja' }), '/api/lumi/say', {}))?.status, 400)
  assert.equal((await lumiRoute(post({ text: 'xin chào', lang: 'ja' }), '/api/lumi/say', {}))?.status, 503)
}
// /api/lumi/menu: method, bad image, no keys -> 409
assert.equal((await lumiRoute(req('/api/lumi/menu'), '/api/lumi/menu', {}))?.status, 405)
{
  const post = (body: unknown) => req('/api/lumi/menu', { method: 'POST', headers: { origin: 'https://x', 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await lumiRoute(post({ image: 'nope' }), '/api/lumi/menu', {}))?.status, 400)
  assert.equal((await lumiRoute(post({ image: 'data:image/jpeg;base64,QUJD' }), '/api/lumi/menu', {}))?.status, 409)
}
// /api/lumi/rates: GET only
assert.equal((await lumiRoute(req('/api/lumi/rates', { method: 'POST' }), '/api/lumi/rates', {}))?.status, 405)

// /api/lumi/hear full path with a stubbed network: Whisper text -> live Vietnamese caption
{
  const realFetch = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)
    if (url.includes('/audio/transcriptions')) return Response.json({ text: 'Bro, can I ask you something?', language: 'english', segments: [{ no_speech_prob: 0.01 }] })
    if (url.includes('/models')) return Response.json({ data: [{ id: 'llama-3.3-70b-versatile' }] })
    if (url.includes('/chat/completions')) return Response.json({ choices: [{ message: { content: '"Anh bạn, cho tôi hỏi một chuyện nhé?"' } }] })
    return new Response('nope', { status: 404 })
  }) as typeof fetch
  try {
    const form = () => { const f = new FormData(); f.append('audio', new Blob([new Uint8Array(5000)], { type: 'audio/webm' }), 'chunk.webm'); return f }
    const env = { GROQ_API_KEY: 'gsk_test' }
    for (let i = 0; i < 2; i++) {
      const r = await lumiRoute(req('/api/lumi/hear', { method: 'POST', headers: { origin: 'https://x' }, body: form() }), '/api/lumi/hear', env)
      const j = (await r!.json()) as { text: string; lang: string; vi: string }
      assert.equal(r!.status, 200)
      assert.equal(j.text, 'Bro, can I ask you something?')
      assert.equal(j.lang, 'en')
      assert.equal(j.vi, 'Anh bạn, cho tôi hỏi một chuyện nhé?')
    }
    // a tiny chunk (silence) is skipped without calling Whisper
    const before = calls.length
    const tiny = new FormData(); tiny.append('audio', new Blob([new Uint8Array(100)], { type: 'audio/webm' }), 'chunk.webm')
    const r = await lumiRoute(req('/api/lumi/hear', { method: 'POST', headers: { origin: 'https://x' }, body: tiny }), '/api/lumi/hear', env)
    assert.deepEqual(await r!.json(), { text: '', lang: 'und', vi: '' })
    assert.equal(calls.length, before)
    // Whisper failure is reported, not swallowed
    globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch
    const bad = await lumiRoute(req('/api/lumi/hear', { method: 'POST', headers: { origin: 'https://x' }, body: form() }), '/api/lumi/hear', env)
    assert.equal(bad!.status, 502)
    assert.ok(/429/.test(((await bad!.json()) as { error: string }).error))
  } finally {
    globalThis.fetch = realFetch
  }
}

// /api/lumi/fast + /api/lumi/gist: method, bad input, no keys -> 503; Workers AI binding used when present
{
  const post = (path: string, body: unknown) => req(path, { method: 'POST', headers: { origin: 'https://x', 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await lumiRoute(req('/api/lumi/fast'), '/api/lumi/fast', {}))?.status, 405)
  assert.equal((await lumiRoute(post('/api/lumi/fast', { text: '' }), '/api/lumi/fast', {}))?.status, 400)
  assert.equal((await lumiRoute(post('/api/lumi/fast', { text: 'hello', lang: 'en' }), '/api/lumi/fast', {}))?.status, 503)
  const AI = { run: async (_m: string, input: Record<string, unknown>) => ({ translated_text: `vi:${String(input.text)}` }) }
  const fast = await lumiRoute(post('/api/lumi/fast', { text: 'hello', lang: 'en', draft: true }), '/api/lumi/fast', { AI } as never)
  assert.equal(fast?.status, 200)
  assert.equal(((await fast!.json()) as { vi: string }).vi, 'vi:hello')
  assert.equal((await lumiRoute(req('/api/lumi/gist'), '/api/lumi/gist', {}))?.status, 405)
  assert.equal((await lumiRoute(post('/api/lumi/gist', { lines: [] }), '/api/lumi/gist', {}))?.status, 400)
  assert.equal((await lumiRoute(post('/api/lumi/gist', { lines: [{ text: 'hi', lang: 'en' }] }), '/api/lumi/gist', {}))?.status, 503)
}

// an unrelated path is not handled here
assert.equal(await lumiRoute(req('/api/other'), '/api/other', {}), null)

console.log('lumiroute: ok')
