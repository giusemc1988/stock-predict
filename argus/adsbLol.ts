/**
 * adsb.lol v2 records to OpenSky state vectors, the shape the globe's Flights layer reads.
 * Ported from gods-eye-view src/data/adsbLolFallback.js (MIT, Bilawal Sidhu).
 */
const KNOT_TO_MPS = 0.514444
const FOOT_TO_M = 0.3048
const FPM_TO_MPS = 0.00508
const CATEGORIES: Record<string, number> = { A1: 2, A2: 3, A3: 4, A4: 5, A5: 6, A6: 7, A7: 8, B1: 9, B2: 10, B3: 11, B4: 12, B6: 14, B7: 15 }

type Row = Record<string, unknown>
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

export function toState(a: Row, nowS: number): unknown[] | null {
  const hex = String(a.hex ?? '').trim().toLowerCase()
  const lat = num(a.lat)
  const lon = num(a.lon)
  if (!hex || lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const seenPos = Math.max(0, num(a.seen_pos) ?? num(a.seen) ?? NaN)
  const seen = Math.max(0, num(a.seen) ?? seenPos)
  const ground = a.alt_baro === 'ground'
  const baro = ground ? null : num(a.alt_baro)
  const geom = num(a.alt_geom)
  const gs = num(a.gs)
  const vr = num(a.baro_rate) ?? num(a.geom_rate)
  return [
    hex,
    String(a.flight ?? a.r ?? '').trim() || null,
    null,
    Number.isFinite(seenPos) ? Math.max(0, nowS - seenPos) : null,
    Number.isFinite(seen) ? Math.max(0, nowS - seen) : null,
    lon,
    lat,
    baro === null ? null : baro * FOOT_TO_M,
    ground,
    gs === null ? null : gs * KNOT_TO_MPS,
    num(a.track),
    vr === null ? null : vr * FPM_TO_MPS,
    null,
    geom === null ? null : geom * FOOT_TO_M,
    a.squawk ?? null,
    a.spi === 1,
    0,
    CATEGORIES[String(a.category ?? '').trim().toUpperCase()] ?? 0,
  ]
}

/** Reads adsb.lol (`ac`) and adsb.fi (`aircraft`) answers alike; both are readsb v2. */
export function toOpenSky(payload: { now?: unknown; ac?: Row[]; aircraft?: Row[] }): { time: number; states: unknown[][] } {
  const now = num(payload?.now)
  const nowS = now === null ? Math.floor(Date.now() / 1000) : Math.floor(now > 1e10 ? now / 1000 : now)
  const seen = new Set<string>()
  const states: unknown[][] = []
  const rows = Array.isArray(payload?.ac) ? payload.ac : Array.isArray(payload?.aircraft) ? payload.aircraft : []
  for (const row of rows) {
    const s = toState(row, nowS)
    if (!s || seen.has(s[0] as string)) continue
    seen.add(s[0] as string)
    states.push(s)
  }
  return { time: nowS, states }
}
