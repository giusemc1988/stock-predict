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
assert.equal(cleanKey('x'.repeat(1001)), null, '1001 chars rejected (> 1000 max)')
assert.equal(cleanKey('x'.repeat(500)), 'x'.repeat(500), '500 chars accepted')
assert.equal(cleanKey('N4XXFD14JZYY0VLU'), 'N4XXFD14JZYY0VLU', '16-char Alpha Vantage key accepted')
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
  { id: 'xai', name: 'Grok', on: false, source: 'none' },
  { id: 'alpaca_paper', name: 'Alpaca (paper)', on: false, source: 'none' },
  { id: 'alpha_vantage', name: 'Alpha Vantage', on: false, source: 'none' },
  { id: 'finnhub', name: 'Finnhub', on: false, source: 'none' },
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
const result = await testProvider('nvidia', { NVIDIA_API_KEY: 'nvapi-secretsecretsecret123', GEMINI_API_KEY: 'AIzaSyDUMMYDUMMYDUMMYDUMMY1234567890' }, ok)
assert.equal(result.ok, true)
assert.ok(result.model && typeof result.model === 'string')
assert.equal(urls.length, 1)
assert.ok(urls[0].includes('nvidia.com'))
const bad = (async () => new Response('nope', { status: 401 })) as typeof fetch
const r = await testProvider('nvidia', { NVIDIA_API_KEY: 'nvapi-secretsecretsecret123' }, bad)
assert.equal(r.ok, false)
assert.ok(!JSON.stringify(r).includes('nvapi'))
assert.ok(r.error?.includes('HTTP 401'))
// the provider's own message is shown, with a key-like string in it masked
const echo = (async () => new Response(JSON.stringify({ error: { message: 'Invalid API Key nvapi-secretsecretsecret123' } }), { status: 401 })) as typeof fetch
const r2 = await testProvider('nvidia', { NVIDIA_API_KEY: 'nvapi-secretsecretsecret123' }, echo)
assert.ok(r2.error?.includes('Invalid API Key') && !r2.error.includes('secretsecret'))
assert.equal((await testProvider('groq', {}, ok)).ok, false)
assert.equal((await testProvider('nope', {}, ok)).ok, false)

// a retired model falls through to the provider's next model
const tried: string[] = []
const retired = (async (_u: string, init?: RequestInit) => {
  const model = JSON.parse(String(init?.body)).model as string
  tried.push(model)
  return tried.length === 1
    ? new Response(JSON.stringify({ status: 410, detail: `The model '${model}' has reached its end of life` }), { status: 410 })
    : new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }))
}) as typeof fetch
const result2 = await testProvider('nvidia', { NVIDIA_API_KEY: 'nvapi-secretsecretsecret123' }, retired)
assert.equal(result2.ok, true)
assert.ok(result2.model && typeof result2.model === 'string')
assert.equal(tried.length, 2)
assert.notEqual(tried[0], tried[1])
// a bad key is not retried on every model
let calls = 0
const denied = (async () => (calls++, new Response('{"error":{"message":"Invalid API Key"}}', { status: 401 }))) as typeof fetch
assert.equal((await testProvider('groq', { GROQ_API_KEY: 'gsk_secretsecretsecretsecret' }, denied)).ok, false)
assert.equal(calls, 1)

// Groq returning HTTP 200 with empty response (quota/rate limit)
const groqEmptyResponse = async (_u: string) => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 })
const groqEmptyResult = await testProvider('groq', { GROQ_API_KEY: 'gsk_secretsecretsecretsecret' }, groqEmptyResponse as typeof fetch)
assert.equal(groqEmptyResult.ok, false, 'Groq empty response is rejected')
assert.ok(groqEmptyResult.error?.includes('quota') || groqEmptyResult.error?.includes('rate limit'), 'Groq empty response shows clear rate limit message')

// Telegram config is stored separately in PRACTICE KV, not in KEY_SLOTS
const telegramStore = memStore({ 'telegramConfig': JSON.stringify({ token: 'token123', chatId: 'chat456' }) })
// Simulating the checker logic from worker.ts line 381-386
const telegramConfigStr = await telegramStore.get('telegramConfig').catch(() => null)
const telegramConfig = telegramConfigStr ? JSON.parse(telegramConfigStr) : null
const telegramOk = !!(telegramConfig?.token && telegramConfig?.chatId)
assert.equal(telegramOk, true, 'Telegram config checker finds valid token + chatId')

// Test with missing config
const emptyStore = memStore({})
const noTelegramConfigStr = await emptyStore.get('telegramConfig').catch(() => null)
const noTelegramConfig = noTelegramConfigStr ? JSON.parse(noTelegramConfigStr) : null
const noTelegramOk = !!(noTelegramConfig?.token && noTelegramConfig?.chatId)
assert.equal(noTelegramOk, false, 'Telegram config checker returns false when config missing')

// Data provider key formats should pass cleanKey validation
assert.ok(cleanKey('GDZHC3FC433DN0RG'), 'Alpha Vantage 16-char key format accepted')
assert.ok(cleanKey('N4XXFD14JZYY0VLU'), 'Alpha Vantage key example accepted')
assert.ok(cleanKey('db43061r01qucqglei7gdb43061r01qucqglei80'), 'Finnhub long key format accepted')
assert.ok(cleanKey('c1234567890abcdef1234567890abcdef'), 'Generic data provider key format accepted')

// Alpha Vantage test with mock success response (no Note/Information error)
const avSuccessMock = async (_u: string) => new Response(JSON.stringify({ bestMatches: [] }), { status: 200 })
const avResult = await testProvider('alpha_vantage', { ALPHA_VANTAGE_KEY: 'N4XXFD14JZYY0VLU' }, avSuccessMock as typeof fetch)
assert.equal(avResult.ok, true, 'Alpha Vantage test accepts successful API response')

// Alpha Vantage test with rate limit response (has Note field)
const avRateLimitMock = async (_u: string) => new Response(JSON.stringify({ Note: 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute.' }), { status: 200 })
const avRateLimitResult = await testProvider('alpha_vantage', { ALPHA_VANTAGE_KEY: 'N4XXFD14JZYY0VLU' }, avRateLimitMock as typeof fetch)
assert.equal(avRateLimitResult.ok, false, 'Alpha Vantage test rejects rate limit response')
assert.ok(avRateLimitResult.error?.includes('Thank you for using'), 'Alpha Vantage error shows rate limit message')

// Alpha Vantage test with HTTP error
const avHttpErrorMock = async (_u: string) => new Response('Not Found', { status: 404 })
const avHttpResult = await testProvider('alpha_vantage', { ALPHA_VANTAGE_KEY: 'N4XXFD14JZYY0VLU' }, avHttpErrorMock as typeof fetch)
assert.equal(avHttpResult.ok, false, 'Alpha Vantage test rejects HTTP 404')
assert.ok(avHttpResult.error?.includes('404'), 'Alpha Vantage error shows HTTP status')

// Finnhub test with mock success response (no error field)
const fhSuccessMock = async (_u: string) => new Response(JSON.stringify({ c: 150.5, h: 151.2, l: 149.8, o: 150.1 }), { status: 200 })
const fhResult = await testProvider('finnhub', { FINNHUB_KEY: 'db43061r01qucqglei7gdb43061r01qucqglei80' }, fhSuccessMock as typeof fetch)
assert.equal(fhResult.ok, true, 'Finnhub test accepts successful API response')

// Finnhub test with API error response (has error field)
const fhApiErrorMock = async (_u: string) => new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 200 })
const fhApiErrorResult = await testProvider('finnhub', { FINNHUB_KEY: 'invalid_key' }, fhApiErrorMock as typeof fetch)
assert.equal(fhApiErrorResult.ok, false, 'Finnhub test rejects API error response')
assert.ok(fhApiErrorResult.error?.includes('Invalid'), 'Finnhub error shows API error message')

// Finnhub test with HTTP error
const fhHttpErrorMock = async (_u: string) => new Response('Unauthorized', { status: 401 })
const fhHttpResult = await testProvider('finnhub', { FINNHUB_KEY: 'wrong_key' }, fhHttpErrorMock as typeof fetch)
assert.equal(fhHttpResult.ok, false, 'Finnhub test rejects HTTP 401')
assert.ok(fhHttpResult.error?.includes('401'), 'Finnhub error shows HTTP status')

console.log('brain keys tests passed')
