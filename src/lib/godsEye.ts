/**
 * God's Eye View: anh's live 3D globe (fork of bilawalsidhu/gods-eye-view, MIT) runs on its own
 * Cloudflare Pages site. The Hub embeds it and checks each data layer from our Worker, so a dead
 * layer shows a clear reason instead of an empty globe.
 */
import type { Bi } from './hubText'

export const GODS_EYE_URL = 'https://gods-eye-view-9xw.pages.dev'
export const GODS_EYE_REPO = 'https://github.com/bilawalsidhu/gods-eye-view'

export type LayerId = 'flights' | 'military' | 'satellites' | 'vessels' | 'quakes'
export type LayerState = 'ok' | 'key' | 'noproxy' | 'down'

export interface Layer {
  id: LayerId
  label: Bi
  /** what we ask: a path on the God's Eye site, or a full URL for a public feed it reads directly */
  probe: string
}

export const LAYERS: Layer[] = [
  { id: 'flights', label: { en: 'Civil flights', vi: 'Chuyến bay dân sự' }, probe: '/api/flights' },
  { id: 'military', label: { en: 'Military aircraft', vi: 'Máy bay quân sự' }, probe: '/api/military' },
  { id: 'satellites', label: { en: 'Satellites', vi: 'Vệ tinh' }, probe: '/api/celestrak/active' },
  { id: 'vessels', label: { en: 'Ships (AIS)', vi: 'Tàu biển (AIS)' }, probe: '/api/vessels' },
  { id: 'quakes', label: { en: 'Earthquakes', vi: 'Động đất' }, probe: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson' },
]

/** Debug routes that must not be public on a production deploy. */
export const DEBUG_PATHS = ['/api/debug/overpass']

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

/** A debug route is exposed when it answers 2xx with data (not the site's HTML fallback). */
export const debugExposed = (p: Probe | null) => !!p && p.status >= 200 && p.status < 300 && !/text\/html/i.test(p.contentType)

export const GE_TEXT = {
  title: { en: "Argus · God's Eye", vi: "Argus · God's Eye" },
  sub: { en: 'Live 3D globe: flights, military aircraft, satellites, ships, earthquakes', vi: 'Địa cầu 3D trực tiếp: máy bay, máy bay quân sự, vệ tinh, tàu biển, động đất' },
  back: { en: '← Hub', vi: '← Hub' },
  open: { en: 'Open full screen ↗', vi: 'Mở toàn màn hình ↗' },
  layers: { en: 'Data layers (checked from the server)', vi: 'Các lớp dữ liệu (kiểm tra từ máy chủ)' },
  checking: { en: 'Checking…', vi: 'Đang kiểm tra…' },
  recheck: { en: 'Check again', vi: 'Kiểm tra lại' },
  ok: { en: 'Live', vi: 'Đang chạy' },
  key: { en: 'Needs a key', vi: 'Cần key' },
  noproxy: { en: 'No proxy yet', vi: 'Chưa có proxy' },
  down: { en: 'Down', vi: 'Lỗi' },
  debug: { en: 'A debug route is public on the God\'s Eye site (/api/debug/overpass). Delete functions/api/debug/ in that Pages project before calling it production.', vi: 'Trang God\'s Eye còn để lộ đường debug (/api/debug/overpass). Xoá functions/api/debug/ trong dự án Pages đó trước khi coi là bản chính thức.' },
  failed: { en: 'Could not check the layers right now.', vi: 'Chưa kiểm tra được các lớp lúc này.' },
  note: { en: 'The globe is anh\'s own deploy on Cloudflare Pages. Voice and ships need paid keys; add them in that site\'s settings when you decide.', vi: 'Quả địa cầu là bản deploy riêng của anh trên Cloudflare Pages. Giọng nói và tàu biển cần key trả phí; khi nào anh quyết thì thêm trong cài đặt của trang đó.' },
  source: { en: 'Source', vi: 'Mã nguồn' },
  load: { en: 'Load the globe (heavy on phone data)', vi: 'Tải quả địa cầu (tốn dữ liệu di động)' },
} satisfies Record<string, Bi>
