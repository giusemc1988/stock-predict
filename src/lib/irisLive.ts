/**
 * Live facts for Iris (the God's Eye agent): earthquakes from USGS (free, no key) and aircraft counts from
 * the argus Worker. They go to the free AI helper as facts, so "any flights or quakes?" is answered from real data.
 */
import { GODS_EYE_URL } from './godsEye'

const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

/** True when the question is about what the globe shows live: aircraft or earthquakes. */
export const asksLive = (q: string) => /flight|plane|aircraft|airplane|military|quake|seismic|tremor|may bay|chuyen bay|dong dat|quan su|rung chan/.test(norm(q))

async function getJson<T>(url: string, ms = 8000): Promise<{ data: T; res: Response } | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    return res.ok ? { data: (await res.json()) as T, res } : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

interface Quakes {
  features: { properties: { mag: number; place: string; time: number } }[]
}

export async function irisLiveFacts(now = Date.now()): Promise<string[]> {
  const [q, f, m] = await Promise.all([getJson<Quakes>(USGS), getJson<{ states?: unknown[][] }>(`${GODS_EYE_URL}/api/flights`), getJson<{ ac?: unknown[] }>(`${GODS_EYE_URL}/api/military`)])
  const out: string[] = []
  if (q) {
    const list = [...q.data.features].sort((a, b) => b.properties.mag - a.properties.mag)
    const top = list.slice(0, 5).map((e) => `M${e.properties.mag.toFixed(1)} ${e.properties.place}, ${Math.max(1, Math.round((now - e.properties.time) / 3.6e6))}h ago`)
    out.push(`Live earthquakes (USGS, magnitude 4.5+, last 24 hours): ${list.length} total.${top.length ? ` Strongest: ${top.join('; ')}.` : ''}`)
  } else out.push('The earthquake feed (USGS) did not answer just now.')
  if (f) {
    const states = f.data.states ?? []
    const air = states.filter((s) => s[8] === false).length
    const age = Number(f.res.headers.get('x-flight-age'))
    const src = f.res.headers.get('x-flight-source') ?? 'unknown'
    out.push(`Live civil flights on the globe: ${states.length} aircraft tracked, ${air} airborne. Source: ${src}${Number.isFinite(age) && age > 0 ? `, about ${Math.round(age / 60)} minutes old` : ''}. It is a worldwide snapshot, so give totals, not a single flight's position.`)
  } else out.push('The flight feed did not answer just now.')
  if (m) out.push(`Military aircraft on the globe: ${(m.data.ac ?? []).length} tracked.`)
  out.push('Answer in plain text only, short, from these numbers. Do not invent anything not listed.')
  return out
}
