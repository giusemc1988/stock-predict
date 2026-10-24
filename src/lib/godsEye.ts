/**
 * Argus (God's Eye View): the bilawalsidhu/gods-eye-view globe (MIT), built at a pinned commit and
 * served by our own "argus" Worker (argus/ in this repo, deployed by .github/workflows/argus.yml).
 * The Hub embeds it and asks that Worker's /api/health for every data layer, so a dead layer says why.
 */
import type { Bi } from './hubText'

export const GODS_EYE_URL = 'https://argus.chanhmn1011.workers.dev'
export const GODS_EYE_REPO = 'https://github.com/bilawalsidhu/gods-eye-view'
/** The argus Worker checks its own layers (a Worker cannot fetch another Worker's workers.dev URL). */
export const GODS_EYE_HEALTH = `${GODS_EYE_URL}/api/health`

export type LayerId = 'flights' | 'military' | 'satellites' | 'vessels' | 'quakes'
export type LayerState = 'ok' | 'key' | 'noproxy' | 'down'

export interface Layer {
  id: LayerId
  label: Bi
  /** what argus/worker.ts asks: one of its own routes, or a full URL for a public feed the globe reads directly */
  probe: string
}

export const LAYERS: Layer[] = [
  { id: 'flights', label: { en: 'Civil flights', vi: 'Chuyến bay dân sự' }, probe: '/api/flights?lat=40.7&lon=-74' },
  { id: 'military', label: { en: 'Military aircraft', vi: 'Máy bay quân sự' }, probe: '/api/military' },
  { id: 'satellites', label: { en: 'Satellites', vi: 'Vệ tinh' }, probe: '/api/celestrak/stations' },
  { id: 'vessels', label: { en: 'Ships (AIS)', vi: 'Tàu biển (AIS)' }, probe: '/api/vessels' },
  { id: 'quakes', label: { en: 'Earthquakes', vi: 'Động đất' }, probe: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson' },
]

export interface Probe {
  status: number
  contentType: string
  /** first part of the body, enough to read an error */
  body: string
}

export interface LayerResult {
  id: LayerId
  state: LayerState
  detail: string
}

/** Reads one probe: JSON 2xx is live, a key error is "needs key", the site's HTML page means there is no proxy for it. */
export function layerState(id: LayerId, p: Probe | null): LayerResult {
  if (!p) return { id, state: 'down', detail: 'no answer (timeout)' }
  const html = /text\/html/i.test(p.contentType)
  let j: { error?: string; detail?: string; status?: string; hasKey?: boolean } = {}
  try {
    j = JSON.parse(p.body)
  } catch {
    /* not JSON (or cut short) */
  }
  if (p.status >= 200 && p.status < 300 && html) return { id, state: 'noproxy', detail: 'no proxy on this deploy' }
  if (j.status === 'missing-key' || j.hasKey === false || /api[_ ]?key/i.test(j.error ?? '')) return { id, state: 'key', detail: (j.error ?? 'key needed').slice(0, 80) }
  if (p.status >= 200 && p.status < 300) return { id, state: 'ok', detail: `HTTP ${p.status}` }
  return { id, state: 'down', detail: [`HTTP ${p.status}`, j.error, j.detail].filter(Boolean).join(' · ').slice(0, 100) }
}

export const GE_TEXT = {
  title: { en: "Iris · God's Eye", vi: "Iris · God's Eye" },
  sub: { en: 'Live 3D globe: flights, military aircraft, satellites, ships, earthquakes', vi: 'Địa cầu 3D trực tiếp: máy bay, máy bay quân sự, vệ tinh, tàu biển, động đất' },
  back: { en: '← Hub', vi: '← Hub' },
  open: { en: 'Full screen ↗', vi: 'Toàn màn hình ↗' },
  layers: { en: 'Data layers', vi: 'Các lớp dữ liệu' },
  checking: { en: 'Checking…', vi: 'Đang kiểm tra…' },
  recheck: { en: 'Check again', vi: 'Kiểm tra lại' },
  ok: { en: 'Live', vi: 'Đang chạy' },
  key: { en: 'Needs a key', vi: 'Cần key' },
  noproxy: { en: 'No proxy yet', vi: 'Chưa có proxy' },
  down: { en: 'Down', vi: 'Lỗi' },
  failed: { en: 'Could not check the layers right now.', vi: 'Chưa kiểm tra được các lớp lúc này.' },
  note: { en: 'Runs as the argus Worker on your own Cloudflare, built from the original repo at a pinned commit (its server code too), with no keys. Ships come from the free Digitraffic feed (Baltic Sea only); voice is off because it needs an OpenAI key.', vi: 'Chạy thành Worker argus trên Cloudflare của anh, build từ repo gốc ở commit đã ghim (cả code máy chủ), không key. Tàu biển lấy từ nguồn miễn phí Digitraffic (chỉ biển Baltic); giọng nói tắt vì cần key OpenAI.' },
  source: { en: 'Source', vi: 'Mã nguồn' },
  load: { en: 'Load the globe (heavy on phone data)', vi: 'Tải quả địa cầu (tốn dữ liệu di động)' },
} satisfies Record<string, Bi>
