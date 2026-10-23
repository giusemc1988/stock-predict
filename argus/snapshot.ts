/**
 * Aircraft snapshot for Argus, taken by GitHub Actions (.github/workflows/argus-snapshot.yml) about every 10 minutes.
 * The free feeds refuse Cloudflare's servers but answer GitHub's, so the runner asks adsb.lol (adsb.fi as backup)
 * around a list of busy areas plus the military feed, keeps only the fields the globe reads, and the workflow
 * stores the result in the Worker's KV. The Worker serves it when the home relay and the direct feeds both fail.
 *
 *   ARGUS_SNAPSHOT_OUT=out node argus/snapshot.ts     (Node 24: runs TypeScript as is)
 */

type Row = Record<string, unknown>

/** Areas the snapshot covers, 250 nm around each: the world's busiest airspace plus Vietnam. Add a line to cover more. */
export const AREAS: [string, number, number][] = [
  ['Hanoi', 21.0, 105.8],
  ['Ho Chi Minh City', 10.8, 106.7],
  ['Da Nang', 16.1, 108.2],
  ['Bangkok', 13.7, 100.7],
  ['Singapore', 1.35, 103.9],
  ['Hong Kong', 22.3, 114.2],
  ['Shanghai', 31.2, 121.5],
  ['Beijing', 40.0, 116.5],
  ['Seoul', 37.5, 127.0],
  ['Tokyo', 35.6, 139.8],
  ['Delhi', 28.6, 77.1],
  ['Dubai', 25.2, 55.4],
  ['Istanbul', 41.0, 28.8],
  ['London', 51.5, -0.4],
  ['Paris', 49.0, 2.5],
  ['Frankfurt', 50.0, 8.6],
  ['Madrid', 40.5, -3.6],
  ['Rome', 41.8, 12.3],
  ['New York', 40.7, -74.0],
  ['Washington', 38.9, -77.0],
  ['Chicago', 41.9, -87.9],
  ['Atlanta', 33.6, -84.4],
  ['Dallas', 32.9, -97.0],
  ['Denver', 39.8, -104.7],
  ['Los Angeles', 33.9, -118.4],
  ['San Francisco', 37.6, -122.4],
  ['Seattle', 47.4, -122.3],
  ['Miami', 25.8, -80.3],
  ['Toronto', 43.7, -79.6],
  ['Mexico City', 19.4, -99.1],
  ['Sao Paulo', -23.4, -46.5],
  ['Sydney', -33.9, 151.2],
]

/** The only fields adsbLol.toState reads; everything else is dropped to keep the snapshot small. */
const KEEP = ['hex', 'flight', 'r', 'seen_pos', 'seen', 'lat', 'lon', 'alt_baro', 'alt_geom', 'gs', 'baro_rate', 'geom_rate', 'track', 'squawk', 'spi', 'category'] as const

export function slim(a: Row): Row | null {
  if (!a || typeof a.hex !== 'string' || typeof a.lat !== 'number' || typeof a.lon !== 'number') return null
  const out: Row = {}
  for (const k of KEEP) if (a[k] !== undefined && a[k] !== null) out[k] = a[k]
  return out
}

/** Merges several readsb answers into one, one row per aircraft (the most recently seen copy wins). */
export function merge(answers: { ac?: Row[]; aircraft?: Row[] }[], nowMs = Date.now()): { now: number; ac: Row[] } {
  const by = new Map<string, Row>()
  for (const a of answers) {
    for (const raw of a.ac ?? a.aircraft ?? []) {
      const r = slim(raw)
      if (!r) continue
      const hex = String(r.hex).toLowerCase()
      const old = by.get(hex)
      if (!old || Number(r.seen ?? 99) < Number(old.seen ?? 99)) by.set(hex, r)
    }
  }
  return { now: nowMs, ac: [...by.values()] }
}

const UA = 'argus-hub/1.0 (+https://github.com/giusemc1988/stock-predict)'

async function getJson(urls: string[]): Promise<{ ac?: Row[]; aircraft?: Row[] } | null> {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(15000) })
      if (r.ok) return (await r.json()) as { ac?: Row[] }
      console.log(`  ${new URL(u).host} HTTP ${r.status}`)
    } catch (e) {
      console.log(`  ${new URL(u).host} ${e instanceof Error ? e.name : e}`)
    }
  }
  return null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main(out: string) {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(out, { recursive: true })
  const answers = []
  for (const [name, lat, lon] of AREAS) {
    const a = await getJson([`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`, `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/250`])
    console.log(`${name}: ${a ? (a.ac ?? a.aircraft ?? []).length : 'failed'}`)
    if (a) answers.push(a)
    await sleep(1100) // both feeds ask for about one request a second
  }
  const flights = merge(answers)
  const mil = await getJson(['https://api.adsb.lol/v2/mil', 'https://opendata.adsb.fi/api/v2/mil'])
  const military = mil ? merge([mil]) : null
  console.log(`flights: ${flights.ac.length} aircraft from ${answers.length}/${AREAS.length} areas; military: ${military ? military.ac.length : 'failed'}`)
  if (answers.length) writeFileSync(`${out}/flights.json`, JSON.stringify(flights))
  if (military) writeFileSync(`${out}/military.json`, JSON.stringify(military))
  if (!answers.length && !military) process.exit(1)
}

if (typeof process !== 'undefined' && process.env.ARGUS_SNAPSHOT_OUT) void main(process.env.ARGUS_SNAPSHOT_OUT)
