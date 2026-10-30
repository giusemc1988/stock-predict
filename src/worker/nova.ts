/**
 * /api/studio/render, /jobs, /video, /key: Nova's server renders. The queue lives in the SETTINGS KV
 * (see src/lib/studioJobs.ts); .github/workflows/nova-render.yml does the rendering.
 */
import { cleanKey, sameOrigin, withSavedKeys, type KeyStore } from '../lib/brainKeys'
import type { BrainEnv } from '../lib/brainServer'
import { cleanKitAsk, writeKitItem, writePostKit, writeTerms } from '../lib/studioServer'
import { TRENDS_CACHE, TRENDS_TTL_MS, fetchTrends, type TrendGeo, type TrendsResult } from '../lib/studioTrends'
import { PRESETS_KEY, cleanPresets } from '../lib/studio/presets'
import { MEDIA_CHUNK, deleteMedia, finishMedia, importPart, importStart, mediaResponse, putMediaPart, readyMedia, startMedia, type MediaStore } from '../lib/studioMedia'
import { GITHUB_KEY, PEXELS_KEY, checkGithubToken, cleanOverlayAsk, cleanRenderAsk, queueOverlay, expireLemoJobs, kickFarm, deleteJob, isJobId, lemoOnline, listJobs, queueJobs, setHandoff, videoResponse, type JobStore } from '../lib/studioJobs'

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
} as const
type KeyKind = keyof typeof KEYS

export async function novaRoute(req: Request, pathname: string, env: BrainEnv, settings?: KeyStore): Promise<Response | null> {
  if (!pathname.startsWith('/api/studio/') || pathname === '/api/studio/write') return null
  if (!settings) return json({ error: 'Storage is not set up on this server yet' }, 501)
  const kv = settings as unknown as JobStore
  const url = new URL(req.url)

  if (pathname === '/api/studio/handoff') {
    // only puts a finished video on Viraltech's waiting list; posting stays with Chanh
    if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'POST or DELETE only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const job = await setHandoff(kv, url.searchParams.get('id') ?? '', req.method === 'POST')
    return job ? json({ handoff: job.handoff ?? null }) : json({ error: 'Only a finished video can go to Viraltech' }, 404)
  }
  if (pathname === '/api/studio/jobs') {
    if (req.method === 'GET') {
      const lemo = await lemoOnline(kv)
      const jobs = await expireLemoJobs(kv, await listJobs(kv), lemo)
      return json({ jobs: jobs.map(({ lines: _l, terms: _t, ...j }) => j), pexels: !!(await kv.get(PEXELS_KEY)), github: !!(await kv.get(GITHUB_KEY)), lemo })
    }
    if (req.method !== 'DELETE') return json({ error: 'GET or DELETE only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    return (await deleteJob(kv, url.searchParams.get('id') ?? '')) ? json({ ok: true }) : json({ error: 'No such video' }, 404)
  }
  if (pathname === '/api/studio/render') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const ask = cleanRenderAsk(await req.json().catch(() => null))
    if (!ask) return json({ error: 'Add a topic and at least one script line' }, 400)
    // Lemo runs only on the PC: with the PC off nothing is queued for it
    if (ask.engine === 'lemo' && !(await lemoOnline(kv))) return json({ error: 'pc-offline' }, 409)
    ask.media = await readyMedia(kv as unknown as MediaStore, ask.media)
    const terms = await writeTerms(ask.topic, ask.en.length ? ask.en : ask.vi, await withSavedKeys(env, settings))
    const jobs = await queueJobs(kv, ask, terms)
    if (!jobs) return json({ error: 'busy' }, 429)
    // the PC bridge checks every minute; only MoneyPrinterTurbo jobs need GitHub started
    const token = ask.engine === 'mpt' ? await kv.get(GITHUB_KEY) : null
    const kicked = ask.engine === 'lemo' || (token ? await kickFarm(token) : false)
    return json({ jobs: jobs.map((j) => j.id), terms, kicked })
  }
  if (pathname === '/api/studio/overlay') {
    // the user's own clip + the EN and VI lines burned on, made by nova/overlay.py on GitHub Actions
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const ask = cleanOverlayAsk(await req.json().catch(() => null))
    if (!ask) return json({ error: 'Pick a clip and add EN and VI lines' }, 400)
    if (!(await readyMedia(kv as unknown as MediaStore, [ask.media])).length) return json({ error: 'The clip is gone or not finished' }, 404)
    const job = await queueOverlay(kv, ask)
    if (!job) return json({ error: 'busy' }, 429)
    const token = await kv.get(GITHUB_KEY)
    return json({ job: job.id, kicked: token ? await kickFarm(token) : false })
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
    if (!key || !(await k.check(key))) return json({ error: `${kind === 'github' ? 'GitHub' : 'Pexels'} refused this key` }, 400)
    await kv.put(k.slot, key)
    return json({ [kind]: true })
  }
  if (pathname === '/api/studio/media-file') {
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405)
    return mediaResponse(kv as unknown as MediaStore, url.searchParams.get('id') ?? '', req.headers.get('range'))
  }
  if (pathname === '/api/studio/media-import') {
    // POST {url} starts an import from a Muse link; PUT {url,id,i} fetches one part; finish with PATCH /api/studio/media?id=
    if (!sameOrigin(req)) return json({ error: 'Not allowed' }, 403)
    const store = kv as unknown as MediaStore
    const b = (await req.json().catch(() => null)) as { url?: unknown; id?: unknown; i?: unknown } | null
    const link = typeof b?.url === 'string' ? b.url.trim() : ''
    if (req.method === 'POST') {
      const r = await importStart(store, link)
      if ('error' in r) return json({ error: r.error }, r.error === 'full' ? 507 : r.error === 'fetch' ? 502 : 400)
      return json({ id: r.item.id, chunk: MEDIA_CHUNK, parts: r.item.parts })
    }
    if (req.method === 'PUT') {
      const r = await importPart(store, link, String(b?.id ?? ''), Number(b?.i))
      return r === 'ok' ? json({ ok: true }) : json({ error: r }, r === 'missing' ? 404 : r === 'fetch' ? 502 : 400)
    }
    return json({ error: 'POST or PUT' }, 405)
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
    const fresh = await fetchTrends(geo)
    if (fresh.items.length) await kv.put(TRENDS_CACHE(geo), JSON.stringify(fresh))
    return json(fresh)
  }
  return json({ error: 'Not found' }, 404)
}
