/**
 * Video Studio frames: timing, backgrounds per mode and the two-block bilingual text.
 * No watermark, ever. Drawing works on any 2D canvas, so the preview and the export share it.
 */
import type { Script, StudioMode } from './script'

export type Aspect = '9:16' | '16:9' | '1:1'
export const FPS = 30
export const FADE = 0.7

export const sizeOf = (a: Aspect) => (a === '9:16' ? { w: 1080, h: 1920 } : a === '1:1' ? { w: 1080, h: 1080 } : { w: 1920, h: 1080 })

/** A picture for a scene. `still` marks a frame taken from one of the person's clips. */
export interface Media {
  img: CanvasImageSource & { width: number; height: number }
  still: boolean
}

export interface Plan {
  script: Script
  aspect: Aspect
  fades: boolean
  media: Media[]
  /** scene windows in seconds; with fades on, neighbours overlap by FADE */
  spans: { start: number; end: number }[]
  duration: number
}

/** Seconds a scene stays on screen: long enough to read both languages. */
export function sceneSeconds(en: string, vi: string): number {
  const n = Math.max(en.split(/\s+/).length, vi.split(/\s+/).length)
  return Math.min(8, Math.max(3.2, 1.2 + n * 0.33))
}

/** `target` (seconds, channel rules): slides share it evenly, never shorter than their reading time, never over 15 s. */
export function plan(script: Script, aspect: Aspect, fades: boolean, media: Media[] = [], target = 0): Plan {
  const spans: Plan['spans'] = []
  let t = 0
  script.en.forEach((en, i) => {
    const read = sceneSeconds(en, script.vi[i] ?? '')
    const len = target ? Math.min(15, Math.max(read, (target + (fades ? FADE * (script.en.length - 1) : 0)) / script.en.length)) : read
    const start = i === 0 || !fades ? t : t - FADE
    spans.push({ start, end: start + len })
    t = start + len
  })
  return { script, aspect, fades, media, spans, duration: t }
}

export const frameCount = (p: Plan) => Math.ceil(p.duration * FPS)

/** Scenes visible at time t with their opacity (two during a fade). */
export function visible(p: Plan, t: number): { i: number; alpha: number }[] {
  const out: { i: number; alpha: number }[] = []
  p.spans.forEach((s, i) => {
    if (t < s.start || t >= s.end) return
    let a = 1
    if (p.fades && i > 0 && t < s.start + FADE) a = (t - s.start) / FADE
    out.push({ i, alpha: Math.max(0, Math.min(1, a)) })
  })
  if (!out.length) out.push({ i: Math.max(0, p.spans.length - 1), alpha: 1 })
  return out
}

const PALETTE: Record<StudioMode, [string, string][]> = {
  faceless: [['#0b1530', '#1d2f5f'], ['#101a2e', '#3a2a12'], ['#0c1f2a', '#123d4a'], ['#1a1030', '#2d1d4f']],
  // light and calm, shown as is: no darkening layer on top
  philosophy: [['#f6f1e7', '#e9dcc4'], ['#eef3f1', '#d6e6df'], ['#f4eef3', '#e6d6e4'], ['#f3f1ea', '#dfe3ea']],
  trip: [['#14202b', '#26394a']],
}

function cover(ctx: CanvasRenderingContext2D, m: Media, w: number, h: number, zoom: number) {
  const s = Math.max(w / m.img.width, h / m.img.height) * zoom
  const dw = m.img.width * s
  const dh = m.img.height * s
  ctx.drawImage(m.img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur)
      cur = word
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines
}

/** One language block: a soft panel with the text centred at y. */
function block(ctx: CanvasRenderingContext2D, text: string, tag: string, y: number, w: number, size: number, light: boolean) {
  ctx.font = `600 ${size}px "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif`
  const maxW = w * 0.8
  const lines = wrap(ctx, text, maxW)
  const lh = size * 1.28
  const boxH = lines.length * lh + size * 1.3
  const boxW = Math.min(w * 0.9, Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.6)
  const x = (w - boxW) / 2
  const top = y - boxH / 2
  ctx.fillStyle = light ? 'rgba(255,255,255,0.72)' : 'rgba(6,10,22,0.58)'
  ctx.beginPath()
  ctx.roundRect(x, top, boxW, boxH, size * 0.5)
  ctx.fill()
  ctx.fillStyle = light ? '#8a6a2c' : '#e8c477'
  ctx.font = `700 ${Math.round(size * 0.42)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(tag, w / 2, top + size * 0.55)
  ctx.fillStyle = light ? '#1d2230' : '#f5f1e6'
  ctx.font = `600 ${size}px "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif`
  lines.forEach((l, k) => ctx.fillText(l, w / 2, top + size * 1.15 + lh * (k + 0.5)))
}

function drawScene(ctx: CanvasRenderingContext2D, p: Plan, i: number, t: number) {
  const { w, h } = sizeOf(p.aspect)
  const s = p.spans[i]
  const k = Math.max(0, Math.min(1, (t - s.start) / (s.end - s.start)))
  const mode = p.script.mode
  const m = p.media.length ? p.media[i % p.media.length] : null
  const light = mode === 'philosophy' && !m
  if (m) {
    // gentle zoom on photos; a clip still stays put so it is shown honestly
    cover(ctx, m, w, h, m.still ? 1 : 1 + 0.06 * k)
    if (mode !== 'philosophy') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, 0, w, h)
    }
  } else {
    const pal = PALETTE[mode][i % PALETTE[mode].length]
    const g = ctx.createLinearGradient(0, 0, w * (0.6 + 0.4 * k), h)
    g.addColorStop(0, pal[0])
    g.addColorStop(1, pal[1])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    if (mode === 'faceless') {
      // slow drifting light, no tech icons
      const r = ctx.createRadialGradient(w * (0.3 + 0.4 * k), h * 0.45, 0, w * (0.3 + 0.4 * k), h * 0.45, w * 0.7)
      r.addColorStop(0, 'rgba(232,196,119,0.16)')
      r.addColorStop(1, 'rgba(232,196,119,0)')
      ctx.fillStyle = r
      ctx.fillRect(0, 0, w, h)
    }
  }
  const tall = p.aspect === '9:16'
  const size = Math.round((tall ? w : h) * 0.052)
  // EN high, VI low, far apart so each is easy to read
  block(ctx, p.script.en[i] ?? '', 'EN', h * (tall ? 0.24 : 0.25), w, size, light)
  block(ctx, p.script.vi[i] ?? '', 'VI', h * (tall ? 0.74 : 0.75), w, size, light)
  if (m?.still) {
    ctx.font = `600 ${Math.round(size * 0.42)}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(24, 24, size * 6.4, size * 0.8)
    ctx.fillStyle = '#fff'
    ctx.fillText('Still from clip · Ảnh tĩnh từ clip', 36, 24 + size * 0.4)
  }
}

export function drawFrame(ctx: CanvasRenderingContext2D, p: Plan, t: number) {
  const { w, h } = sizeOf(p.aspect)
  ctx.globalAlpha = 1
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  for (const v of visible(p, t)) {
    ctx.globalAlpha = v.alpha
    drawScene(ctx, p, v.i, t)
  }
  ctx.globalAlpha = 1
}
