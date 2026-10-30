/**
 * Live facts for Iris (the God's Eye agent): earthquakes from USGS (free, no key) and aircraft counts from
 * the argus Worker. They go to the free AI helper as facts, so "any flights or quakes?" is answered from real data.
 */
import { GODS_EYE_URL } from './godsEye'

const USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

const FLIGHT = /flight|plane|aircraft|airplane|military|may bay|chuyen bay|quan su/
const QUAKE = /quake|seismic|tremor|dong dat|rung chan/
const WEATHER = /weather|rain|temperature|forecast|wind|thoi tiet|\bmua\b|nhiet do|\bgio\b|du bao|nang nong|\blanh\b/
const DISASTER = /disaster|storm|typhoon|cyclone|hurricane|flood|volcano|tsunami|thien tai|\bbao\b|\blu\b|ngap|nui lua|song than|lu lut|mua lu/

/** True when the question is about what the globe shows live: aircraft, earthquakes, weather or disasters. */
export const asksLive = (q: string) => {
  const n = norm(q)
  return FLIGHT.test(n) || QUAKE.test(n) || WEATHER.test(n) || DISASTER.test(n)
}

const CODES: [number, string][] = [[0, 'clear'], [3, 'partly cloudy'], [48, 'fog'], [57, 'drizzle'], [67, 'rain'], [77, 'snow'], [82, 'rain showers'], [86, 'snow showers'], [99, 'thunderstorm']]
const sky = (c: number) => CODES.find(([max]) => c <= max)?.[1] ?? 'unknown'

/** The phone's position, or null when it is refused or slow (the answer then covers the whole world). */
function where(ms = 8000): Promise<{ lat: number; lon: number } | null> {
  return new Promise((done) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return done(null)
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => done(null),
      { timeout: ms, maximumAge: 300000 },
    )
  })
}

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

interface Meteo {
  current?: { temperature_2m: number; apparent_temperature: number; precipitation: number; weather_code: number; wind_speed_10m: number }
  daily?: { time: string[]; precipitation_probability_max: number[]; precipitation_sum: number[]; temperature_2m_max: number[] }
}
interface Gdacs {
  features: { properties: { eventtype: string; name?: string; htmldescription?: string; alertlevel: string; country?: string; fromdate: string; severitydata?: { severitytext?: string } }; geometry?: { coordinates?: number[] } }[]
}
const KINDS: Record<string, string> = { FL: 'flood', TC: 'tropical cyclone', EQ: 'earthquake', VO: 'volcano', DR: 'drought', WF: 'wildfire' }

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

export async function irisLiveFacts(question = '', now = Date.now()): Promise<string[]> {
  const n = norm(question)
  const wantWeather = WEATHER.test(n)
  const wantDisaster = DISASTER.test(n)
  const wantQuake = QUAKE.test(n)
  const wantFlight = FLIGHT.test(n)
  const pos = wantWeather || wantDisaster ? await where() : null
  const [q, f, m, w, g] = await Promise.all([
    wantQuake ? getJson<Quakes>(USGS) : null,
    wantFlight ? getJson<{ states?: unknown[][] }>(`${GODS_EYE_URL}/api/flights${pos ? `?lat=${pos.lat.toFixed(2)}&lon=${pos.lon.toFixed(2)}` : ''}`) : null,
    wantFlight ? getJson<{ ac?: unknown[] }>(`${GODS_EYE_URL}/api/military`) : null,
    wantWeather && pos ? getJson<Meteo>(`https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max&forecast_days=3&timezone=auto`) : null,
    wantDisaster ? getJson<Gdacs>('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP?eventlist=FL,TC,EQ,VO&alertlevel=Orange;Red') : null,
  ])
  const out: string[] = []
  if (wantQuake) {
    if (q) {
      const list = [...q.data.features].sort((a, b) => b.properties.mag - a.properties.mag)
      const top = list.slice(0, 5).map((e) => `M${e.properties.mag.toFixed(1)} ${e.properties.place}, ${Math.max(1, Math.round((now - e.properties.time) / 3.6e6))}h ago`)
      out.push(`Live earthquakes (USGS, magnitude 4.5+, last 24 hours): ${list.length} total.${top.length ? ` Strongest: ${top.join('; ')}.` : ''}`)
    } else out.push('The earthquake feed (USGS) did not answer just now.')
  }
  if (wantFlight) {
    if (f) {
      const states = f.data.states ?? []
      const air = states.filter((s) => s[8] === false).length
      const age = Number(f.res.headers.get('x-flight-age'))
      const src = f.res.headers.get('x-flight-source') ?? 'unknown'
      out.push(`Live civil flights on the globe${pos ? ' around the user' : ''}: ${states.length} aircraft tracked, ${air} airborne. Source: ${src}${Number.isFinite(age) && age > 0 ? `, about ${Math.round(age / 60)} minutes old` : ''}. Free ADS-B data is thin in some regions (for example Vietnam), so a low count is not a real count of flights.`)
    } else out.push('The flight feed did not answer just now.')
    if (m) out.push(`Military aircraft on the globe: ${(m.data.ac ?? []).length} tracked.`)
  }
  if (wantWeather) {
    if (!pos) out.push('The user\'s location is not available (permission refused), so say you need location permission to give local weather.')
    else if (w?.data.current) {
      const c = w.data.current
      const d = w.data.daily
      out.push(`Weather at the user's location now (Open-Meteo): ${c.temperature_2m}°C (feels ${c.apparent_temperature}°C), ${sky(c.weather_code)}, wind ${c.wind_speed_10m} km/h, rain now ${c.precipitation} mm.${d ? ` Next days: ${d.time.map((t, i) => `${t}: max ${d.temperature_2m_max[i]}°C, rain chance ${d.precipitation_probability_max[i]}%, ${d.precipitation_sum[i]} mm`).join('; ')}.` : ''}`)
    } else out.push('The weather feed (Open-Meteo) did not answer just now.')
  }
  if (wantDisaster) {
    if (g) {
      const ev = g.data.features
        .map((e) => ({ p: e.properties, c: e.geometry?.coordinates }))
        .map((e) => ({ ...e, d: pos && e.c && e.c.length >= 2 ? km(pos, { lat: e.c[1], lon: e.c[0] }) : null }))
        .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || b.p.fromdate.localeCompare(a.p.fromdate))
        .slice(0, 6)
        .map((e) => `${e.p.alertlevel} ${KINDS[e.p.eventtype] ?? e.p.eventtype} ${e.p.name ?? ''} ${e.p.country ?? ''} (${e.p.fromdate.slice(0, 10)})${e.d != null ? `, ${Math.round(e.d)} km from the user` : ''}`.replace(/\s+/g, ' '))
      out.push(`Current Orange and Red disaster alerts (GDACS, UN/EU): ${g.data.features.length} total.${ev.length ? ` ${pos ? 'Nearest' : 'Latest'}: ${ev.join('; ')}.` : ' None at the moment.'}`)
    } else out.push('The disaster alert feed (GDACS) did not answer just now.')
  }
  out.push('Answer in plain text only, short, from these numbers. Do not invent anything not listed.')
  return out
}
