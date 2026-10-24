/** Fintraffic Digitraffic AIS (meri.digitraffic.fi, CC BY 4.0) to the row shape the upstream vessel layer reads. */

export interface DtLocations {
  features?: { geometry?: { coordinates?: [number, number] }; properties?: { mmsi?: number; sog?: number; cog?: number; heading?: number; timestampExternal?: number } }[]
}
export interface DtVessel {
  mmsi?: number
  name?: string
  imo?: number
  shipType?: number
  destination?: string
}

const num = (v: unknown, ok: (n: number) => boolean) => (typeof v === 'number' && Number.isFinite(v) && ok(v) ? v : null)

export function digitrafficRows(loc: DtLocations, meta: DtVessel[], now = Date.now()) {
  const byMmsi = new Map(meta.filter((v) => v.mmsi).map((v) => [v.mmsi, v]))
  const rows = []
  for (const f of loc.features ?? []) {
    const p = f.properties ?? {}
    const [lon, lat] = f.geometry?.coordinates ?? []
    if (!p.mmsi || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const m = byMmsi.get(p.mmsi) ?? {}
    const at = num(p.timestampExternal, (n) => n > 0) ?? now
    rows.push({
      lat,
      lon,
      name: (m.name ?? '').trim() || `MMSI ${p.mmsi}`,
      mmsi: String(p.mmsi),
      imo: m.imo ? String(m.imo) : '',
      type: m.shipType != null ? String(m.shipType) : '',
      destination: (m.destination ?? '').trim(),
      // AIS "not available" codes: speed 102.3, course 360, heading 511
      speed: num(p.sog, (n) => n >= 0 && n < 102.3),
      course: num(p.cog, (n) => n >= 0 && n < 360),
      heading: num(p.heading, (n) => n >= 0 && n <= 360),
      last_position_UTC: new Date(at).toISOString(),
      last_position_epoch: Math.floor(at / 1000),
    })
  }
  rows.sort((a, b) => b.last_position_epoch - a.last_position_epoch)
  return { rows, source: 'Digitraffic AIS (Finland, Baltic Sea)', status: 'live', refreshing: false, newestPositionAt: rows[0]?.last_position_UTC ?? null }
}
