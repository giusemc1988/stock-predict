/**
 * Cloudflare Worker: serves the app's built files and one small API, /api/brain, for Jarvis's
 * free-AI helper. Keys are Worker secrets (wrangler secret put GEMINI_API_KEY, etc.).
 */
import { askBrain, brainStatus, cleanAsk, type BrainEnv } from './lib/brainServer'

interface Env extends BrainEnv {
  ASSETS: { fetch: (r: Request) => Promise<Response> }
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url)
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
}
