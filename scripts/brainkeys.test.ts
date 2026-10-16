import assert from 'node:assert/strict'
import { cleanKey, keySources, sameOrigin, testProvider, withSavedKeys, type KeyStore } from '../src/lib/brainKeys'
import { brainStatus } from '../src/lib/brainServer'

const memStore = (init: Record<string, string> = {}): KeyStore & { data: Record<string, string> } => {
  const data = { ...init }
  return {
    data,
    get: async (k) => data[k] ?? null,
    put: async (k, v) => void (data[k] = v),
    delete: async (k) => void delete data[k],
  }
}

// keys are cleaned: trimmed, sensible length, no spaces or odd characters
assert.equal(cleanKey('  AIzaSyDUMMYDUMMYDUMMYDUMMY1234567890  '), 'AIzaSyDUMMYDUMMYDUMMYDUMMY1234567890')
assert.equal(cleanKey('short'), null)
assert.equal(cleanKey('has space inside the key value 123456'), null)
assert.equal(cleanKey('x'.repeat(500)), null)
assert.equal(cleanKey(42), null)
assert.equal(cleanKey('<script>alert(1)</script>aaaaaaaa'), null)

// saved keys fill the slots and win over server secrets; no store means nothing changes
const store = memStore({ 'brainkey:gemini': 'AIzaSyDUMMYDUMMYDUMMYDUMMY1234567890' })
const env = await withSavedKeys({ GEMINI_API_KEY: 'old-secret-value-1234567890', NVIDIA_API_KEY: 'nvapi-secretsecretsecret123' }, store)
assert.equal(env.GEMINI_API_KEY, 'AIzaSyDUMMYDUMMYDUMMYDUMMY1234567890')
assert.equal(env.NVIDIA_API_KEY, 'nvapi-secretsecretsecret123')
assert.deepEqual(await withSavedKeys({ GROQ_API_KEY: 'gsk_abcdefghijklmnopqrstuvwx' }, undefined), { GROQ_API_KEY: 'gsk_abcdefghijklmnopqrstuvwx' })
assert.deepEqual(brainStatus(env).filter((p) => p.on).map((p) => p.id), ['gemini', 'nvidia'])

// where each key comes from, and never the key itself
const src = await keySources({ NVIDIA_API_KEY: 'nvapi-secretsecretsecret123' }, store)
assert.deepEqual(src, [
  { id: 'gemini', name: 'Gemini', on: true, source: 'saved' },
  { id: 'groq', name: 'Groq', on: false, source: 'none' },
  { id: 'nvidia', name: 'NVIDIA NIM', on: true, source: 'server' },
])
assert.ok(!JSON.stringify(src).includes('AIza'))
assert.ok(!JSON.stringify(src).includes('nvapi'))

// writes only from this site's own pages
const mk = (origin?: string) => new Request('https://app.example/api/brain/key', { method: 'PUT', headers: origin ? { origin } : {} })
assert.equal(sameOrigin(mk('https://app.example')), true)
assert.equal(sameOrigin(mk('https://evil.example')), false)
assert.equal(sameOrigin(mk()), false)

// test button: one tiny call to that provider only, and never echoes the answer or the key
const urls: string[] = []
const ok = (async (u: string) => {
  urls.push(String(u))
  return new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }))
}) as typeof fetch
assert.deepEqual(await testProvider('nvidia', { NVIDIA_API_KEY: 'nvapi-secretsecretsecret123', GEMINI_API_KEY: 'AIzaSyDUMMYDUMMYDUMMYDUMMY1234567890' }, ok), { ok: true })
assert.equal(urls.length, 1)
assert.ok(urls[0].includes('nvidia.com'))
const bad = (async () => new Response('nope', { status: 401 })) as typeof fetch
const r = await testProvider('nvidia', { NVIDIA_API_KEY: 'nvapi-secretsecretsecret123' }, bad)
assert.equal(r.ok, false)
assert.ok(!JSON.stringify(r).includes('nvapi'))
assert.equal((await testProvider('groq', {}, ok)).ok, false)
assert.equal((await testProvider('nope', {}, ok)).ok, false)

console.log('brain keys tests passed')
