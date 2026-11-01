import assert from 'node:assert/strict'
import { voltRoute } from '../src/worker/volt'

const req = (url: string, init?: RequestInit) => new Request(`https://x${url}`, init)

// /api/volt/release: bad repo input
assert.equal((await voltRoute(req('/api/volt/release?repo=not+a+repo'), '/api/volt/release'))?.status, 400)

// /api/volt/release: not GET
assert.equal((await voltRoute(req('/api/volt/release?repo=a/b', { method: 'POST' }), '/api/volt/release'))?.status, 405)

// /api/volt/asset: missing params
assert.equal((await voltRoute(req('/api/volt/asset?repo=a/b'), '/api/volt/asset'))?.status, 400)
// /api/volt/asset: path traversal in name is rejected
assert.equal((await voltRoute(req('/api/volt/asset?repo=a/b&tag=v1&name=../x'), '/api/volt/asset'))?.status, 400)

// an unrelated path is not handled here
assert.equal(await voltRoute(req('/api/other'), '/api/other'), null)

console.log('volt: ok')
