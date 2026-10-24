/**
 * /api/studio/render, /jobs, /video, /key: Nova's server renders. The queue lives in the SETTINGS KV
 * (see src/lib/studioJobs.ts); .github/workflows/nova-render.yml does the rendering.
 * /api/studio/lemo/*: the home PC (agent/lemo-render.ts) takes Lemo-Opuscar jobs and sends the MP4 back,
 * with HOME_AGENT_TOKEN, the secret the Worker already shares with the home agent.
 * /api/studio/handoff: puts a finished video on Viraltech's waiting list; posting stays with Chanh.
 */
import { cleanKey, sameOrigin, withSavedKeys, type KeyStore } from '../lib/brainKeys'
import type { BrainEnv } from '../lib/brainServer'
import { cleanKitAsk, writeKitItem, writePostKit, writeTerms } from '../lib/studioServer'
import { TRENDS_CACHE, TRENDS_TTL_MS, YOUTUBE_KEY, fetchTrends, type TrendGeo, type TrendsResult } from '../lib/studioTrends'
import { PRESETS_KEY, cleanPresets } from '../lib/studio/presets'
import { MEDIA_CHUNK, deleteMedia, finishMedia, putMediaPart, readyMedia, startMedia, type MediaStore } from '../lib/studioMedia'
import { GITHUB_KEY, PEXELS_KEY, checkGithubToken, cleanRenderAsk, finishLemo, kickFarm, deleteJob, isJobId, listJobs, pcOnline, pickLemo, putLemoPart, queueJobs, setHandoff, videoResponse, type JobStore } from '../lib/studioJobs'

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

/** Same length and same bytes, without stopping at the first difference. */
function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export async function novaRoute(req: Request, pathname: string, env: BrainEnv, settings?: KeyStore, homeToken?: string): Promise<Response | null> {
  if (!pathname.startsWith('/api/studio/') || pathname === '/api/studio/write') return null
  if (!settings) return json({ error: 'Storage is not set up on this server yet' }, 501)
  const kv = settings as unknown as JobStore
  const url = new URL(req.url)

  if (pathname.startsWith('/api/studio/lemo/')) {
    // only the home PC: no token on the Worker means Lemo is not set up
    if (!homeToken || !sameSecret(req.headers.get('authorization') ?? '', `Bearer ${homeToken}`)) return json({ error: 'Not allowed' }, 403)
    const id = url.searchParams.get('id') ?? ''
    if (pathname === '/api/studio/lemo/pick' && req.method === 'POST') {
      const job = await pickLemo(kv, Date.now(), !url.searchParams.has('busy'))
      return json({ job: job && { id: job.id, topic: job.topic, lang: job.lang, voice: job.voice, aspect: job.aspect, lines: job.lines } })
    }
    if (pathname === '/api/studio/lemo/part' && req.method === 'PUT') {
      const r = await putLemoPart(kv, id, Number(url.searchParams.get('i')), await req.arrayBuffer())
      return r === 'ok' ? json({ ok: true }) : json({ error: r }, r === 'missing' ? 404 : 400)
    }
    if (pathname === '/api/studio/lemo/done' && req.method === 'POST') return (await finishLemo(kv, id, await req.json().catch(() => null))) ? json({ ok: true }) : json({ error: 'No such job' }, 404)
    return json({ error: 'Not found' }, 404)
  }
  if (pathname === '/api/studio/handoff') {
    if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'POST or DELETE only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const job = await setHandoff(kv, url.searchParams.get('id') ?? '', req.method === 'POST')
    return job ? json({ handoff: job.handoff ?? null }) : json({ error: 'Only a finished video can go to Viraltech' }, 404)
  }

  if (pathname === '/api/studio/jobs') {
    if (req.method === 'GET') return json({ jobs: (await listJobs(kv)).map(({ lines: _l, terms: _t, ...j }) => j), pexels: !!(await kv.get(PEXELS_KEY)), github: !!(await kv.get(GITHUB_KEY)), youtube: !!(await kv.get(YOUTUBE_KEY)), pc: { setup: !!homeToken, online: !!homeToken && (await pcOnline(kv)) } })
    if (req.method !== 'DELETE') return json({ error: 'GET or DELETE only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    return (await deleteJob(kv, url.searchParams.get('id') ?? '')) ? json({ ok: true }) : json({ error: 'No such video' }, 404)
  }
  if (pathname === '/api/studio/render') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const ask = cleanRenderAsk(await req.json().catch(() => null))
    if (!ask) return json({ error: 'Add a topic and at least one script line' }, 400)
    ask.media = await readyMedia(kv as unknown as MediaStore, ask.media)
    const terms = await writeTerms(ask.topic, ask.en.length ? ask.en : ask.vi, await withSavedKeys(env, settings))
    const jobs = await queueJobs(kv, ask, terms, Date.now(), undefined, !!homeToken && (await pcOnline(kv)))
    if (!jobs) return json({ error: 'busy' }, 429)
    const engine = jobs[0].engine ?? 'turbo'
    // Lemo jobs wait for the home PC; only server jobs start the farm
    const token = engine === 'turbo' ? await kv.get(GITHUB_KEY) : null
    const kicked = token ? await kickFarm(token) : false
    return json({ jobs: jobs.map((j) => j.id), terms, kicked, engine, fallback: jobs[0].fallback ?? null })
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
  if (pathname === '/api/studio/media') {
    // POST {type,size} starts an upload; PUT ?id=&i= sends one part; PATCH ?id= finishes; DELETE ?id= removes
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const store = kv as unknown as MediaStore
    const id = url.searchParams.get('id') ?? ''
    if (req.method === 'POST') {
      const r = await startMedia(store, await req.json().catch(() => null))
      if ('error' in r) return json({ error: r.error }, r.error === 'full' ? 507 : 400)
      return json({ id: r.item.id, chunk: MEDIA_CHUNK, parts: r.item.parts })
    }
    if (req.method === 'PUT') {
      const r = await putMediaPart(store, id, Number(url.searchParams.get('i')), await req.arrayBuffer())
      return r === 'ok' ? json({ ok: true }) : json({ error: r }, r === 'missing' ? 404 : 400)
    }
    if (req.method === 'PATCH') return (await finishMedia(store, id)) ? json({ ok: true }) : json({ error: 'parts missing' }, 409)
    if (req.method === 'DELETE') return (await deleteMedia(store, id)) ? json({ ok: true }) : json({ error: 'missing' }, 404)
    return json({ error: 'POST, PUT, PATCH or DELETE' }, 405)
  }
  if (pathname === '/api/studio/presets') {
    if (req.method === 'GET') return json({ presets: cleanPresets(JSON.parse((await kv.get(PRESETS_KEY)) ?? '[]')) })
    if (req.method !== 'PUT') return json({ error: 'GET or PUT only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const presets = cleanPresets(((await req.json().catch(() => null)) as { presets?: unknown } | null)?.presets)
    await kv.put(PRESETS_KEY, JSON.stringify(presets))
    return json({ presets })
  }
  if (pathname === '/api/studio/postkit') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const a = cleanKitAsk(await req.json().catch(() => null))
    if (!a) return json({ error: 'No topic' }, 400)
    const e = await withSavedKeys(env, settings)
    if (!a.only) return json(await writePostKit(a, e))
    const one = await writeKitItem(a, e)
    return one ? json(one) : json({ error: 'No AI helper answered. Add a free Gemini or Groq key in Settings.' }, 503)
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
