/**
 * Turns the person's photos and clips into pictures the studio canvas can draw, on a phone.
 * Two traps this guards against:
 *   - a clip whose video track the phone cannot decode (HDR / 10-bit HEVC from a newer camera) still loads
 *     its metadata because the audio plays, so the video element has no frame and createImageBitmap throws
 *     "The image source is not usable". We wait for a real frame and say so plainly when none comes.
 *   - a photo createImageBitmap cannot read is tried again through an <img>, and big photos are shrunk
 *     so eight of them do not run a phone out of memory.
 */
import type { Media } from './render'
import type { StudioKey } from './text'

/** longest side kept, in px; the export is 1920 at most */
export const MAX_SIDE = 1920
const WAIT_MS = 8000

/** Why a file could not be used, as a text key the page shows. */
export class DecodeError extends Error {
  readonly key: StudioKey
  constructor(key: StudioKey) {
    super(key)
    this.key = key
  }
}

/** Width and height scaled so the longer side is at most `max`, never enlarged. */
export function fitSize(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h, 1))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

/** A seek target in the middle of a clip, safe for a missing or endless duration. */
export function middleOf(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration / 2 : 0
}

function once(el: HTMLMediaElement, ok: string, ms = WAIT_MS): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => done(new DecodeError('mediaSlow')), ms)
    const good = () => done()
    const bad = () => done(new DecodeError('mediaClipCodec'))
    function done(e?: Error) {
      clearTimeout(t)
      el.removeEventListener(ok, good)
      el.removeEventListener('error', bad)
      if (e) rej(e)
      else res()
    }
    el.addEventListener(ok, good)
    el.addEventListener('error', bad)
  })
}

async function shrink(src: ImageBitmapSource, w: number, h: number): Promise<ImageBitmap> {
  const s = fitSize(w, h)
  return s.w === w && s.h === h ? createImageBitmap(src) : createImageBitmap(src, { resizeWidth: s.w, resizeHeight: s.h, resizeQuality: 'high' })
}

async function photo(file: File, url: string): Promise<ImageBitmap> {
  try {
    const raw = await createImageBitmap(file)
    if (Math.max(raw.width, raw.height) <= MAX_SIDE) return raw
    const small = await shrink(raw, raw.width, raw.height)
    raw.close()
    return small
  } catch {
    // some phones' pickers hand over files createImageBitmap refuses but an <img> still reads
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      throw new DecodeError(/hei[cf]/i.test(file.type + file.name) ? 'mediaHeic' : 'mediaPhotoFormat')
    }
    return shrink(img, img.naturalWidth, img.naturalHeight)
  }
}

async function clipStill(url: string): Promise<ImageBitmap> {
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  const loaded = once(v, 'loadeddata')
  v.src = url
  v.load()
  await loaded
  // audio plays but the picture cannot be decoded: no frame will ever come
  if (!v.videoWidth || !v.videoHeight) throw new DecodeError('mediaClipCodec')
  const mid = middleOf(v.duration)
  if (mid > 0) {
    const seeked = once(v, 'seeked')
    v.currentTime = mid
    await seeked
  }
  try {
    return await shrink(v, v.videoWidth, v.videoHeight)
  } catch {
    throw new DecodeError('mediaClipCodec')
  } finally {
    v.removeAttribute('src')
    v.load()
  }
}

/** A small preview for the footage list, as a data URL. */
function thumbOf(img: ImageBitmap): string {
  const s = fitSize(img.width, img.height, 160)
  const c = document.createElement('canvas')
  c.width = s.w
  c.height = s.h
  c.getContext('2d')?.drawImage(img, 0, 0, s.w, s.h)
  return c.toDataURL('image/jpeg', 0.7)
}

/** A photo as is, or the middle frame of a clip as a labelled still, plus a thumbnail. */
export async function loadMedia(file: File): Promise<Media & { thumb: string }> {
  const url = URL.createObjectURL(file)
  try {
    const still = file.type.startsWith('video/')
    const img = still ? await clipStill(url) : await photo(file, url)
    return { img, still, thumb: thumbOf(img) }
  } finally {
    URL.revokeObjectURL(url)
  }
}
