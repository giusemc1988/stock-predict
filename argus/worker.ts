/**
 * Argus API: flights, military, satellites and ships are answered here from free public feeds, no keys.
 * Every other /api route (CCTV, weather, transit, radio, launches, …) runs the upstream server code
 * itself, bundled into this Worker at the pinned commit (upstream-api/). Static files come from the
 * pinned upstream build (see upstream.json).
 */
import { toOpenSky } from './adsbLol'
// built by the deploy workflow (upstream-api/build.mjs)
import { upstreamApi } from './upstream-api/dist/providers.mjs'
import { LAYERS, layerState, type Probe } from '../src/lib/godsEye'
import { digitrafficRows, type DtLocations, type DtVessel } from './digitraffic'

interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> }
  /** The Hub Worker (service binding): reaches the home agent relay with the Hub's own secrets, no Access login. */
  HUB?: { fetch: (r: Request) => Promise<Response> }
  /** Aircraft snapshots written by GitHub Actions every ~10 min (argus/snapshot.ts). */
  SNAP?: { get: (key: string) => Promise<string | null> }
}

type Feed = 'flights' | 'military'

/** Live data through the home PC (residential IP): the Hub forwards /api/home/<feed> to the agent. Null when it is off or not set up. */
async function viaHome(env: Env, feed: Feed, search = ''): Promise<Response | null> {
  if (!env.HUB) return null
  try {
    const r = await env.HUB.fetch(new Request(`https://hub/api/home/${feed}${search}`, { signal: AbortSignal.timeout(7000) }))
    if (!r.ok) return null
    const data = (await r.json()) as { offline?: boolean; ac?: unknown[]; aircraft?: unknown[] }
    if (data.offline || !(Array.isArray(data.ac) || Array.isArray(data.aircraft))) return null
    const body = toOpenSky(data as Parameters<typeof toOpenSky>[0])
    return json(body, 200, { 'x-flight-source': 'home relay', 'x-flight-count': String(body.states.length) })
  } catch {
    return null
  }
}

/** The last GitHub Actions snapshot; minutes old, so it is the last resort. */
async function fromSnapshot(env: Env, feed: Feed): Promise<Response | null> {
  const text = await env.SNAP?.get(`argus:${feed}`).catch(() => null)
  if (!text) return null
  const snap = JSON.parse(text) as { now: number; ac: unknown[] }
  const age = Math.round((Date.now() - snap.now) / 1000)
  if (age > 6 * 3600) return null
  if (feed === 'military') return json(snap, 200, { 'x-flight-source': 'snapshot', 'x-flight-age': String(age) })
  const body = toOpenSky(snap as Parameters<typeof toOpenSky>[0])
  return json(body, 200, { 'x-flight-source': 'snapshot', 'x-flight-age': String(age), 'x-flight-count': String(body.states.length) })
}

const UA = 'argus-hub/1.0 (+https://github.com/giusemc1988/stock-predict)'
/** The Hub page that embeds the globe. */
const HUB = 'https://stock-predict.chanhmn1011.workers.dev'

const API_HEADERS = { 'content-security-policy': "default-src 'none'; sandbox", 'x-content-type-options': 'nosniff', 'access-control-allow-origin': HUB }
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...API_HEADERS, ...extra } })

// The Cache API does nothing on workers.dev, so answers are kept in this isolate's memory instead.
type Hit = { at: number; body: ArrayBuffer; headers: Record<string, string> }
const mem = new Map<string, Hit>()
const reply = (h: Hit, extra: Record<string, string> = {}) => new Response(h.body.slice(0), { headers: { ...h.headers, ...extra } })

/** Serves a fresh copy from memory, else refreshes it; when the upstream fails, the last good copy (up to a day old) is served as STALE. */
async function cached(name: string, ttl: number, load: () => Promise<Response>): Promise<Response> {
  const hit = mem.get(name)
  if (hit && Date.now() - hit.at < ttl * 1000) return reply(hit)
  let r: Response | null = null
  try {
    r = await load()
  } catch {
    r = null
  }
  if (r?.ok) {
    const h: Hit = { at: Date.now(), body: await r.arrayBuffer(), headers: { 'content-type': r.headers.get('content-type') ?? 'application/json', ...API_HEADERS, ...Object.fromEntries([...r.headers].filter(([k]) => k.startsWith('x-'))) } }
    if (mem.size > 200) mem.clear()
    mem.set(name, h)
    return reply(h)
  }
  if (hit && Date.now() - hit.at < 86_400_000) return reply(hit, { 'x-cache': 'STALE' })
  return json({ error: `${name} unavailable`, detail: r ? `Upstream HTTP ${r.status}${r.statusText ? ` (${r.statusText})` : ''}` : 'Upstream timeout' }, 502)
}

const get = (url: string, ms = 12000) => fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(ms) })

/**
 * Flights: with a view position, adsb.lol 250 nm around it (fast, free, no key); without one, OpenSky's
 * global snapshot (it often refuses cloud servers, so it is only the second choice).
 */
async function flights(url: URL, env: Env): Promise<Response> {
  const home = await viaHome(env, 'flights', url.search)
  if (home) return home
  let nearWhy = ''
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon'))
  if (url.searchParams.has('lat') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const rl = Math.round(lat * 4) / 4
    const ro = Math.round(lon * 4) / 4
    // adsb.lol first, then adsb.fi, then airplanes.live (all free, no key, same readsb format)
    const near = await cached(`near/${rl},${ro}`, 15, async () => {
      const why: string[] = []
      for (const [src, u] of [['adsb.lol', `https://api.adsb.lol/v2/lat/${rl}/lon/${ro}/dist/250`], ['adsb.fi', `https://opendata.adsb.fi/api/v2/lat/${rl}/lon/${ro}/dist/250`], ['airplanes.live', `https://api.airplanes.live/v2/point/${rl}/${ro}/250`]]) {
        const r = await get(u, 6000).catch((e: Error) => (why.push(`${src} ${e.name}`), null))
        if (r && !r.ok) why.push(`${src} HTTP ${r.status}`)
        if (!r?.ok) continue
        const body = toOpenSky((await r.json()) as Parameters<typeof toOpenSky>[0])
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'x-flight-source': src, 'x-flight-coverage': '250nm around the view', 'x-flight-count': String(body.states.length) } })
      }
      return new Response('', { status: 502, statusText: why.join(', ') })
    })
    if (near.ok) return near
    nearWhy = ((await near.json().catch(() => ({}))) as { detail?: string }).detail ?? ''
  }
  const open = await cached('opensky', 30, async () => {
    const r = await get('https://opensky-network.org/api/states/all?extended=1', 8000)
    return r.ok ? new Response(r.body, { headers: { 'content-type': 'application/json', 'x-flight-source': 'OpenSky Network', 'x-flight-coverage': 'global' } }) : r
  })
  if (open.ok) return open
  return (await fromSnapshot(env, 'flights')) ?? json({ error: 'Flights unavailable', detail: `Home relay off, no recent snapshot, and adsb.lol, adsb.fi, airplanes.live and OpenSky all refused. ${nearWhy}`.trim() }, 502)
}

/**
 * Ships: Fintraffic Digitraffic AIS (free, no key, Baltic Sea around Finland), shaped like the
 * upstream AISStream rows so the vessel layer reads it as a live feed. AISStream itself needs a key.
 */
async function vessels(): Promise<Response> {
  return cached('vessels', 60, async () => {
    const dt = (path: string) => fetch(`https://meri.digitraffic.fi/api/ais/v1/${path}`, { headers: { accept: 'application/json', 'accept-encoding': 'gzip', 'digitraffic-user': 'argus-hub', 'user-agent': UA }, signal: AbortSignal.timeout(15000) })
    const [loc, meta] = await Promise.all([dt('locations'), dt('vessels').catch(() => null)])
    if (!loc.ok) return loc
    const body = digitrafficRows((await loc.json()) as DtLocations, meta?.ok ? ((await meta.json()) as DtVessel[]) : [])
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'x-feed-source': 'Digitraffic AIS', 'x-vessel-count': String(body.rows.length) } })
  })
}

export default {
  async fetch(req: Request, env: Env, ctx: unknown): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname
    // static files are served before the Worker runs; their headers live in _headers
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (p === '/api/health') return health(url, env)
      const own = await api(url, env)
      if (own) return own
    }
    return upstream(req, env, ctx)
  },
}

/** The GET routes answered here (fast, cached at the edge); null for everything the upstream code serves. */
async function api(url: URL, env: Env): Promise<Response | null> {
  const p = url.pathname
  if (p === '/api/flights') return flights(url, env)
  if (p === '/api/military') {
    // home relay (live) > direct feeds > GitHub snapshot
    const home = await env.HUB?.fetch(new Request('https://hub/api/home/military', { signal: AbortSignal.timeout(7000) })).catch(() => null)
    if (home?.ok) {
      const text = await home.text()
      if (!/"offline"\s*:\s*true/.test(text)) return new Response(text, { headers: { 'content-type': 'application/json', 'x-flight-source': 'home relay', ...API_HEADERS } })
    }
    const direct = await cached('military', 12, async () => {
      const r = await get('https://api.adsb.lol/v2/mil', 6000).catch(() => null)
      if (r?.ok) return r
      const fi = await get('https://opendata.adsb.fi/api/v2/mil', 6000).catch(() => null)
      return fi?.ok ? fi : get('https://api.airplanes.live/v2/mil', 6000)
    })
    return direct.ok ? direct : ((await fromSnapshot(env, 'military')) ?? direct)
  }
  const sat = /^\/api\/celestrak\/([a-z0-9-]{1,40})$/i.exec(p)
  if (sat) {
    const group = sat[1].toLowerCase()
    // orbits baked in at deploy (refreshed every 2 h by the workflow); live CelesTrak only as a last try
    const baked = await env.ASSETS.fetch(new Request(new URL(`/tle/${group}.txt`, url)))
    if (baked.ok && (baked.headers.get('content-type') ?? '').startsWith('text/plain')) return new Response(baked.body, { headers: { 'content-type': 'text/plain', 'x-tle-source': 'baked', ...API_HEADERS } })
    return cached(`celestrak/${group}`, 7200, async () => {
      const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })
      return r.ok ? new Response(r.body, { headers: { 'content-type': 'text/plain' } }) : r
    })
  }
  if (p === '/api/vessels') return vessels()
  return null
}

/** Every other route goes to the upstream server code; its answers get the same API headers as ours. */
async function upstream(req: Request, env: Env, ctx: unknown): Promise<Response> {
  try {
    const r = await upstreamApi.fetch(req, env, ctx)
    const out = new Headers(r.headers)
    out.delete('set-cookie')
    for (const [k, v] of Object.entries(API_HEADERS)) out.set(k, v)
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: out })
  } catch {
    return json({ error: 'Upstream API failed' }, 502)
  }
}

/**
 * One small answer for the Hub: each data layer asked through the same routes the globe uses
 * (a Worker cannot fetch another Worker's workers.dev URL, so the Hub cannot probe these itself).
 */
async function health(url: URL, env: Env): Promise<Response> {
  const probe = async (path: string): Promise<Probe | null> => {
    try {
      const r = path.startsWith('http') ? await get(path, 10000) : await api(new URL(path, url), env)
      if (!r) return null
      return { status: r.status, contentType: r.headers.get('content-type') ?? '', body: (await r.text()).slice(0, 400) }
    } catch {
      return null
    }
  }
  const layers = await Promise.all(LAYERS.map(async (l) => layerState(l.id, await probe(l.probe))))
  return json({ at: Date.now(), layers }, 200, { 'cache-control': 'no-store' })
}
