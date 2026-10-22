/**
 * Argus API: the few /api routes the God's Eye globe needs, from free public feeds, no keys.
 * Everything else under /api answers a clear 404 so the app marks that layer unavailable.
 * Static files come from the pinned upstream build (see upstream.json).
 */
import { toOpenSky } from './adsbLol'

interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> }
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
async function flights(url: URL): Promise<Response> {
  let nearWhy = ''
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon'))
  if (url.searchParams.has('lat') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const rl = Math.round(lat * 4) / 4
    const ro = Math.round(lon * 4) / 4
    // adsb.lol first, adsb.fi when it refuses (both free, no key, same readsb format)
    const near = await cached(`near/${rl},${ro}`, 15, async () => {
      const why: string[] = []
      for (const [src, u] of [['adsb.lol', `https://api.adsb.lol/v2/lat/${rl}/lon/${ro}/dist/250`], ['adsb.fi', `https://opendata.adsb.fi/api/v2/lat/${rl}/lon/${ro}/dist/250`]]) {
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
  return open.ok ? open : json({ error: 'Flights unavailable', detail: `adsb.lol, adsb.fi and OpenSky all refused. ${nearWhy}`.trim() }, 502)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname
    // static files are served before the Worker runs; their headers live in _headers
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'GET only' }, 405)
    if (p === '/api/flights') return flights(url)
    if (p === '/api/military')
      return cached('military', 12, async () => {
        const r = await get('https://api.adsb.lol/v2/mil', 6000).catch(() => null)
        return r?.ok ? r : get('https://opendata.adsb.fi/api/v2/mil', 6000)
      })
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
    if (p === '/api/vessels') return json({ status: 'missing-key', error: 'AISSTREAM_API_KEY is not set', hasKey: false, vessels: [] }, 503)
    return json({ error: 'Not available on this deploy' }, 404)
  },
}
