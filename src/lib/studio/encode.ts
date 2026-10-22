/**
 * MP4 export in the browser: WebCodecs H.264 + AAC (Opus if the browser has no AAC encoder),
 * muxed by mp4-muxer. Frames are converted to I420 by us, BT.709 limited range (tv), so the file
 * never plays "washed out"; the colr box and the frame metadata say the same.
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { FPS, drawFrame, frameCount, sizeOf, type Plan } from './render'
import { SAMPLE_RATE } from './audio'

export const BT709_TV: VideoColorSpaceInit = { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false }

/** RGBA to I420, BT.709 limited range. Exported for the unit test. */
export function rgbaToI420(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 1.5)
  const cw = w >> 1
  const uOff = w * h
  const vOff = uOff + cw * (h >> 1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      out[y * w + x] = 16 + ((0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) * 219) / 255 + 0.5
    }
  }
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      let r = 0, g = 0, b = 0
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = ((y + dy) * w + x + dx) * 4
        r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]
      }
      r /= 4; g /= 4; b /= 4
      const c = (y >> 1) * cw + (x >> 1)
      out[uOff + c] = 128 + ((-0.1146 * r - 0.3854 * g + 0.5 * b) * 224) / 255 + 0.5
      out[vOff + c] = 128 + ((0.5 * r - 0.4542 * g - 0.0458 * b) * 224) / 255 + 0.5
    }
  }
  return out
}

const AVC = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']

export function canExport(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

async function pickVideo(w: number, h: number) {
  for (const codec of AVC) {
    const cfg: VideoEncoderConfig = { codec, width: w, height: h, bitrate: 8_000_000, framerate: FPS, avc: { format: 'avc' } }
    if ((await VideoEncoder.isConfigSupported(cfg).catch(() => ({ supported: false }))).supported) return cfg
  }
  return null
}

async function pickAudio(): Promise<{ cfg: AudioEncoderConfig; mux: 'aac' | 'opus' } | null> {
  if (typeof AudioEncoder === 'undefined') return null
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']] as const) {
    const cfg: AudioEncoderConfig = { codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 160_000 }
    if ((await AudioEncoder.isConfigSupported(cfg).catch(() => ({ supported: false }))).supported) return { cfg, mux }
  }
  return null
}

/** Renders every frame and returns the MP4. `music` is stereo 48 kHz or null. */
export async function exportMp4(p: Plan, music: Float32Array[] | null, onProgress: (f: number) => void): Promise<{ blob: Blob; audio: string | null }> {
  const { w, h } = sizeOf(p.aspect)
  const vcfg = await pickVideo(w, h)
  if (!vcfg) throw new Error('This browser cannot encode H.264. Use Chrome or Edge on a computer or Android.')
  const acfg = music ? await pickAudio() : null
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h, frameRate: FPS },
    audio: acfg ? { codec: acfg.mux, numberOfChannels: 2, sampleRate: SAMPLE_RATE } : undefined,
    fastStart: 'in-memory',
  })
  let failed: Error | null = null
  const venc = new VideoEncoder({
    // the colr box is written from this, so it is always BT.709 tv range
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta?.decoderConfig ? { ...meta, decoderConfig: { ...meta.decoderConfig, colorSpace: BT709_TV } } : meta),
    error: (e) => (failed = e instanceof Error ? e : new Error(String(e))),
  })
  venc.configure(vcfg)

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as unknown as CanvasRenderingContext2D
  const total = frameCount(p)
  for (let f = 0; f < total; f++) {
    if (failed) throw failed
    drawFrame(ctx, p, f / FPS)
    const px = ctx.getImageData(0, 0, w, h).data
    const frame = new VideoFrame(rgbaToI420(px, w, h), { format: 'I420', codedWidth: w, codedHeight: h, timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS), colorSpace: BT709_TV })
    venc.encode(frame, { keyFrame: f % (FPS * 2) === 0 })
    frame.close()
    // keep the encoder queue short so memory stays flat on phones
    while (venc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 1))
    if (f % 10 === 0) {
      onProgress(f / total)
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  await venc.flush()
  venc.close()

  if (acfg && music) {
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (failed = e instanceof Error ? e : new Error(String(e))) })
    aenc.configure(acfg.cfg)
    const step = 1024
    const len = Math.min(music[0].length, Math.round(p.duration * SAMPLE_RATE))
    for (let s = 0; s < len; s += step) {
      const n = Math.min(step, len - s)
      const planar = new Float32Array(n * 2)
      planar.set(music[0].subarray(s, s + n), 0)
      planar.set(music[1].subarray(s, s + n), n)
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((s * 1e6) / SAMPLE_RATE), data: planar })
      aenc.encode(ad)
      ad.close()
    }
    await aenc.flush()
    aenc.close()
  }
  if (failed) throw failed
  muxer.finalize()
  onProgress(1)
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), audio: acfg?.mux ?? null }
}
