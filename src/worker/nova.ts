/**
 * /api/studio/render, /jobs, /video, /pexels: Nova's server renders. The queue lives in the SETTINGS KV
 * (see src/lib/studioJobs.ts); .github/workflows/nova-render.yml does the rendering.
 */
import { cleanKey, sameOrigin, withSavedKeys, type KeyStore } from '../lib/brainKeys'
import type { BrainEnv } from '../lib/brainServer'
import { writeTerms } from '../lib/studioServer'
import { PEXELS_KEY, cleanRenderAsk, deleteJob, isJobId, listJobs, queueJobs, videoResponse, type JobStore } from '../lib/studioJobs'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function novaRoute(req: Request, pathname: string, env: BrainEnv, settings?: KeyStore): Promise<Response | null> {
  if (!pathname.startsWith('/api/studio/') || pathname === '/api/studio/write') return null
  if (!settings) return json({ error: 'Storage is not set up on this server yet' }, 501)
  const kv = settings as unknown as JobStore
  const url = new URL(req.url)

  if (pathname === '/api/studio/jobs') {
    if (req.method === 'GET') return json({ jobs: (await listJobs(kv)).map(({ lines: _l, terms: _t, ...j }) => j), pexels: !!(await kv.get(PEXELS_KEY)) })
    if (req.method !== 'DELETE') return json({ error: 'GET or DELETE only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    return (await deleteJob(kv, url.searchParams.get('id') ?? '')) ? json({ ok: true }) : json({ error: 'No such video' }, 404)
  }
  if (pathname === '/api/studio/render') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const ask = cleanRenderAsk(await req.json().catch(() => null))
    if (!ask) return json({ error: 'Add a topic and at least one script line' }, 400)
    const terms = await writeTerms(ask.topic, ask.en.length ? ask.en : ask.vi, await withSavedKeys(env, settings))
    const jobs = await queueJobs(kv, ask, terms)
    return jobs ? json({ jobs: jobs.map((j) => j.id), terms }) : json({ error: 'busy' }, 429)
  }
  if (pathname === '/api/studio/video') {
    const id = url.searchParams.get('id')
    if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'GET only' }, 405)
    if (!isJobId(id)) return json({ error: 'No such video' }, 404)
    const res = await videoResponse(kv, id, req.headers.get('range'), url.searchParams.has('download'))
    return req.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res
  }
  if (pathname === '/api/studio/pexels') {
    if (req.method !== 'PUT' && req.method !== 'DELETE') return json({ error: 'PUT or DELETE only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    if (req.method === 'DELETE') {
      await kv.delete(PEXELS_KEY)
      return json({ pexels: false })
    }
    const key = cleanKey(((await req.json().catch(() => null)) as { key?: unknown } | null)?.key)
    if (!key) return json({ error: 'That does not look like a Pexels key' }, 400)
    // a quick real search, so a typo shows up here and not 10 minutes later in a failed render
    const test = await fetch('https://api.pexels.com/videos/search?query=ocean&per_page=1', { headers: { authorization: key } }).catch(() => null)
    if (test?.status === 401 || test?.status === 403) return json({ error: 'Pexels refused this key' }, 400)
    await kv.put(PEXELS_KEY, key)
    return json({ pexels: true })
  }
  return json({ error: 'Not found' }, 404)
}
