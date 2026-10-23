/**
 * /api/studio/render, /jobs, /video, /key: Nova's server renders. The queue lives in the SETTINGS KV
 * (see src/lib/studioJobs.ts); .github/workflows/nova-render.yml does the rendering.
 */
import { cleanKey, sameOrigin, withSavedKeys, type KeyStore } from '../lib/brainKeys'
import type { BrainEnv } from '../lib/brainServer'
import { writeTerms } from '../lib/studioServer'
import { TRENDS_CACHE, TRENDS_TTL_MS, YOUTUBE_KEY, fetchTrends, type TrendGeo, type TrendsResult } from '../lib/studioTrends'
import { GITHUB_KEY, PEXELS_KEY, checkGithubToken, cleanRenderAsk, kickFarm, deleteJob, isJobId, listJobs, queueJobs, videoResponse, type JobStore } from '../lib/studioJobs'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

const KEYS = {
  pexels: {
    slot: PEXELS_KEY,
    // a quick real search, so a typo shows up here and not 10 minutes later in a failed render
    check: async (key: string) => {
      const r = await fetch('https://api.pexels.com/videos/search?query=ocean&per_page=1', { headers: { authorization: key } }).catch(() => null)
      return r?.status !== 401 && r?.status !== 403
    },
  },
  github: { slot: GITHUB_KEY, check: (key: string) => checkGithubToken(key) },
  youtube: {
    slot: YOUTUBE_KEY,
    check: async (key: string) => (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&regionCode=US&key=${encodeURIComponent(key)}`).catch(() => null))?.status === 200,
  },
} as const
type KeyKind = keyof typeof KEYS

export async function novaRoute(req: Request, pathname: string, env: BrainEnv, settings?: KeyStore): Promise<Response | null> {
  if (!pathname.startsWith('/api/studio/') || pathname === '/api/studio/write') return null
  if (!settings) return json({ error: 'Storage is not set up on this server yet' }, 501)
  const kv = settings as unknown as JobStore
  const url = new URL(req.url)

  if (pathname === '/api/studio/jobs') {
    if (req.method === 'GET') return json({ jobs: (await listJobs(kv)).map(({ lines: _l, terms: _t, ...j }) => j), pexels: !!(await kv.get(PEXELS_KEY)), github: !!(await kv.get(GITHUB_KEY)), youtube: !!(await kv.get(YOUTUBE_KEY)) })
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
    if (!jobs) return json({ error: 'busy' }, 429)
    const token = await kv.get(GITHUB_KEY)
    const kicked = token ? await kickFarm(token) : false
    return json({ jobs: jobs.map((j) => j.id), terms, kicked })
  }
  if (pathname === '/api/studio/video') {
    const id = url.searchParams.get('id')
    if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'GET only' }, 405)
    if (!isJobId(id)) return json({ error: 'No such video' }, 404)
    const res = await videoResponse(kv, id, req.headers.get('range'), url.searchParams.has('download'))
    return req.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res
  }
  if (pathname === '/api/studio/key') {
    const kind = url.searchParams.get('kind') as KeyKind | null
    if (!kind || !(kind in KEYS)) return json({ error: 'Unknown key' }, 400)
    if (req.method !== 'PUT' && req.method !== 'DELETE') return json({ error: 'PUT or DELETE only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const k = KEYS[kind]
    if (req.method === 'DELETE') {
      await kv.delete(k.slot)
      return json({ [kind]: false })
    }
    const key = cleanKey(((await req.json().catch(() => null)) as { key?: unknown } | null)?.key)
    if (!key || !(await k.check(key))) return json({ error: `${kind === 'github' ? 'GitHub' : kind === 'youtube' ? 'YouTube' : 'Pexels'} refused this key` }, 400)
    await kv.put(k.slot, key)
    if (kind === 'youtube') await Promise.all([kv.delete(TRENDS_CACHE('VN')), kv.delete(TRENDS_CACHE('US'))])
    return json({ [kind]: true })
  }
  if (pathname === '/api/studio/trends') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    const geo: TrendGeo = url.searchParams.get('geo') === 'US' ? 'US' : 'VN'
    // one hour of cache: the sources change slowly and some rate-limit; ?fresh=1 refetches
    if (!url.searchParams.has('fresh')) {
      const hit = JSON.parse((await kv.get(TRENDS_CACHE(geo))) ?? 'null') as TrendsResult | null
      if (hit && Date.now() - hit.at < TRENDS_TTL_MS) return json(hit)
    }
    const fresh = await fetchTrends(geo, await kv.get(YOUTUBE_KEY))
    if (fresh.items.length) await kv.put(TRENDS_CACHE(geo), JSON.stringify(fresh))
    return json(fresh)
  }
  return json({ error: 'Not found' }, 404)
}
