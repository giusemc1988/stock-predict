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

// an unrelated path is not handled here
assert.equal(await lumiRoute(req('/api/other'), '/api/other', {}), null)

console.log('lumiroute: ok')
