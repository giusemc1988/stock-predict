/**
 * Argus API: the few /api routes the God's Eye globe needs, from free public feeds, no keys.
 * Everything else under /api answers a clear 404 so the app marks that layer unavailable.
 * Static files come from the pinned upstream build (see upstream.json).
 */
import { toOpenSky } from './adsbLol'

interface Env {
  ASSETS: { fetch: (r: Request) => Promise<Response> }
}
type Ctx = { waitUntil(p: Promise<unknown>): void }

const UA = 'argus-hub/1.0 (+https://github.com/giusemc1988/stock-predict)'
/** The Hub page that embeds the globe. */
const HUB = 'https://stock-predict.chanhmn1011.workers.dev'

const API_HEADERS = { 'content-security-policy': "default-src 'none'; sandbox", 'x-content-type-options': 'nosniff', 'access-control-allow-origin': HUB }
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...API_HEADERS, ...extra } })

const cache = () => (globalThis as unknown as { caches: { default: Cache } }).caches.default
const key = (name: string) => new Request(`https://argus.cache/${name}`)

/** Serves a cached body when fresh; otherwise refreshes it and keeps the last good copy as a fallback. */
async function cached(name: string, ttl: number, load: () => Promise<Response>, ctx: Ctx): Promise<Response> {
  const fresh = await cache().match(key(`fresh/${name}`))
  if (fresh) return fresh
  let r: Response | null = null
  try {
    r = await load()
  } catch {
    r = null
  }
  if (r?.ok) {
    const body = await r.arrayBuffer()
    const headers = { 'content-type': r.headers.get('content-type') ?? 'application/json', ...API_HEADERS, ...Object.fromEntries([...r.headers].filter(([k]) => k.startsWith('x-'))) }
    const out = new Response(body, { headers: { ...headers, 'cache-control': `public, max-age=${ttl}` } })
    ctx.waitUntil(Promise.all([cache().put(key(`fresh/${name}`), out.clone()), cache().put(key(`last/${name}`), new Response(body, { headers: { ...headers, 'cache-control': 'public, max-age=86400' } }))]))
    return out
  }
  const last = await cache().match(key(`last/${name}`))
  if (last) return new Response(last.body, { headers: { ...Object.fromEntries(last.headers), 'x-cache': 'STALE' } })
  return json({ error: `${name} unavailable`, detail: r ? `Upstream HTTP ${r.status}` : 'Upstream timeout' }, 502)
}

const get = (url: string, ms = 12000) => fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(ms) })

/** Flights: OpenSky's global snapshot first; when it refuses (it often blocks cloud IPs), adsb.lol 250 nm around the view. */
async function flights(url: URL, ctx: Ctx): Promise<Response> {
  // after a refusal, skip OpenSky for 2 minutes so each poll goes straight to the fallback
  const down = await cache().match(key('down/opensky'))
  const open = down ? json({ error: 'OpenSky cooling down' }, 503) : await cached('opensky', 15, async () => {
    const r = await get('https://opensky-network.org/api/states/all?extended=1', 10000)
    return r.ok ? new Response(r.body, { headers: { 'content-type': 'application/json', 'x-flight-source': 'OpenSky Network', 'x-flight-coverage': 'global' } }) : r
  }, ctx)
  if (open.ok) return open
  if (!down && open.headers.get('x-cache') !== 'STALE') ctx.waitUntil(cache().put(key('down/opensky'), new Response('1', { headers: { 'cache-control': 'public, max-age=120' } })))
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon'))
  if (!url.searchParams.has('lat') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: 'Flights unavailable', detail: 'OpenSky refused and no view position was sent for the regional fallback' }, 502)
  const rl = Math.round(lat * 4) / 4
  const ro = Math.round(lon * 4) / 4
  return cached(`adsblol/${rl},${ro}`, 15, async () => {
    const r = await get(`https://api.adsb.lol/v2/lat/${rl}/lon/${ro}/dist/250`)
    if (!r.ok) return r
    const body = toOpenSky((await r.json()) as Parameters<typeof toOpenSky>[0])
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'x-flight-source': 'adsb.lol', 'x-flight-coverage': '250nm regional fallback', 'x-flight-count': String(body.states.length) } })
  }, ctx)
}

export default {
  async fetch(req: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname
    // static files are served before the Worker runs; their headers live in _headers
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'GET only' }, 405)
    if (p === '/api/flights') return flights(url, ctx)
    if (p === '/api/military') return cached('military', 12, () => get('https://api.adsb.lol/v2/mil'), ctx)
    const sat = /^\/api\/celestrak\/([a-z0-9-]{1,40})$/i.exec(p)
    if (sat) {
      const group = sat[1].toLowerCase()
      return cached(`celestrak/${group}`, 7200, async () => {
        const r = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })
        return r.ok ? new Response(r.body, { headers: { 'content-type': 'text/plain' } }) : r
      }, ctx)
    }
    if (p === '/api/vessels') return json({ status: 'missing-key', error: 'AISSTREAM_API_KEY is not set', hasKey: false, vessels: [] }, 503)
    return json({ error: 'Not available on this deploy' }, 404)
  },
}
