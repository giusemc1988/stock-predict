/**
 * Cloudflare Worker: serves the app's built files, /api/brain for Jarvis's free-AI helper, and
 * the 24/7 practice account. A cron trigger runs one practice cycle every 5 minutes in US market
 * hours (wrangler.jsonc); the account lives in the PracticeStore Durable Object and is served at
 * /practice.json, so the app sees each new trade within minutes. Keys are Worker secrets
 * (wrangler secret put GEMINI_API_KEY, etc.). Paper only: nothing here places an order.
 */
import { askBrain, brainStatus, cleanAsk, type BrainEnv } from './lib/brainServer'
import { parseState } from './lib/autoLearn'
import type { JournalEntry } from './lib/journal'
import { parsePractice, type PracticeState } from './lib/practice'
import { runPracticeCycle } from './lib/practiceServer'

interface Stub {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
}
interface DONamespace {
  idFromName: (name: string) => unknown
  get: (id: unknown) => Stub
}
interface DOState {
  storage: { get: <T>(key: string) => Promise<T | undefined>; put: (key: string, value: unknown) => Promise<void> }
}
interface Ctx {
  waitUntil: (p: Promise<unknown>) => void
}

interface Env extends BrainEnv {
  ASSETS: { fetch: (r: Request) => Promise<Response> }
  PRACTICE: DONamespace
}

/** Last run, for /api/practice/status. */
interface RunInfo {
  at: number
  ok: boolean
  traded: boolean
  log: string[]
}

/** Two cron runs closer than this are one run (a retried trigger must not decide the same bar twice). */
const MIN_GAP_MS = 4 * 60_000
/** Free plan: 50 outbound requests per run, so the movers lists are a little shorter than in the app. */
const CYCLE = { stockMovers: 8, cryptoMovers: 6 }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** Holds the server practice account and runs each cycle, one at a time. */
export class PracticeStore {
  private state: DOState
  constructor(state: DOState) {
    this.state = state
  }

  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url)
    const store = this.state.storage
    if (pathname === '/state') {
      const s = await store.get<string>('state')
      return s ? new Response(s, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) : json({ error: 'empty' }, 404)
    }
    if (pathname === '/status') return json((await store.get<RunInfo>('run')) ?? null)
    if (pathname === '/run' && req.method === 'POST') {
      const body = (await req.json().catch(() => null)) as { seed?: unknown; journal?: JournalEntry[] } | null
      const saved = await store.get<string>('state')
      const prev: PracticeState | null = saved ? parsePractice(JSON.parse(saved)) : parsePractice(body?.seed)
      if (!prev) return json({ error: 'needs seed' }, 428)
      const now = Date.now()
      if (prev.server && now - prev.server.lastRun < MIN_GAP_MS) return json({ skipped: 'ran moments ago' })
      try {
        const r = await runPracticeCycle(prev, body?.journal ?? [], now, CYCLE)
        await store.put('state', JSON.stringify(r.next))
        const info: RunInfo = { at: now, ok: true, traded: r.traded, log: r.log }
        await store.put('run', info)
        return json(info)
      } catch (e) {
        const info: RunInfo = { at: now, ok: false, traded: false, log: [(e as Error).message] }
        await store.put('run', info)
        return json(info, 502)
      }
    }
    return json({ error: 'not found' }, 404)
  }
}

const store = (env: Env) => env.PRACTICE.get(env.PRACTICE.idFromName('main'))
const asset = (env: Env, path: string) => env.ASSETS.fetch(new Request(`https://assets.local${path}`))

/** One practice cycle; the first ever run starts from the practice.json in the deploy. */
async function practiceCycle(env: Env): Promise<Response> {
  const learn = await asset(env, '/auto-learning.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)
  const journal = parseState(learn)?.journal ?? []
  const run = (seed?: unknown) => store(env).fetch('https://practice/run', { method: 'POST', body: JSON.stringify({ journal, seed }) })
  let res = await run()
  if (res.status === 428) res = await run(await asset(env, '/practice.json').then((r) => (r.ok ? r.json() : null)).catch(() => null))
  return res
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url)
    if (pathname === '/practice.json') {
      const r = await store(env).fetch('https://practice/state')
      return r.ok ? r : env.ASSETS.fetch(req)
    }
    if (pathname === '/api/practice/status') return store(env).fetch('https://practice/status')
    if (pathname === '/api/practice/run') return req.method === 'POST' ? practiceCycle(env) : json({ error: 'POST only' }, 405)
    if (pathname === '/api/brain/status') return json({ providers: brainStatus(env) })
    if (pathname === '/api/brain') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
      const ask = cleanAsk(await req.json().catch(() => null))
      if (!ask) return json({ error: 'No question' }, 400)
      const r = await askBrain(ask, env)
      return r ? json(r) : json({ error: 'No AI helper answered' }, 503)
    }
    return env.ASSETS.fetch(req)
  },

  async scheduled(_event: unknown, env: Env, ctx: Ctx): Promise<void> {
    ctx.waitUntil(practiceCycle(env))
  },
}
