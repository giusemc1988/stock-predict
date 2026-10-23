/**
 * Generative background music (Web Audio, no files, no licence questions) and loudness
 * normalising to about -24.5 LUFS (ITU-R BS.1770 K-weighting with gating), computed in plain JS.
 */
export const SAMPLE_RATE = 48000
export const TARGET_LUFS = -24.5

/** One biquad pass, in place. */
function biquad(x: Float32Array, b: number[], a: number[]) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let n = 0; n < x.length; n++) {
    const x0 = x[n]
    const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
    x2 = x1; x1 = x0; y2 = y1; y1 = y0
    x[n] = y0
  }
}

/** Integrated loudness in LUFS for 48 kHz channels. -Infinity for silence. */
export function lufs(channels: Float32Array[]): number {
  const k = channels.map((c) => {
    const x = c.slice()
    biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585])
    biquad(x, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621])
    return x
  })
  const block = Math.round(0.4 * SAMPLE_RATE)
  const hop = Math.round(0.1 * SAMPLE_RATE)
  const len = k[0]?.length ?? 0
  const powers: number[] = []
  for (let s = 0; s + block <= len; s += hop) {
    let sum = 0
    for (const x of k) {
      let e = 0
      for (let n = s; n < s + block; n++) e += x[n] * x[n]
      sum += e / block
    }
    powers.push(sum)
  }
  const L = (p: number) => -0.691 + 10 * Math.log10(p)
  const abs = powers.filter((p) => L(p) > -70)
  if (!abs.length) return -Infinity
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10
  const gated = abs.filter((p) => L(p) > rel)
  return L(gated.reduce((a, b) => a + b, 0) / gated.length)
}

/** Scales channels in place to the target loudness; never above 0.98 peak. */
export function normalise(channels: Float32Array[], target = TARGET_LUFS): number {
  const now = lufs(channels)
  if (!isFinite(now)) return now
  let gain = Math.pow(10, (target - now) / 20)
  let peak = 0
  for (const c of channels) for (let n = 0; n < c.length; n++) peak = Math.max(peak, Math.abs(c[n]))
  if (peak * gain > 0.98) gain = 0.98 / peak
  for (const c of channels) for (let n = 0; n < c.length; n++) c[n] *= gain
  return lufs(channels)
}

// calm progressions; the seed picks one so each video sounds a little different
const PROGRESSIONS = [
  [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]],
  [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]],
]
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** Renders soft pad chords plus a light pluck for `seconds`, normalised, as stereo 48 kHz. */
export async function renderMusic(seconds: number, seed = 0): Promise<Float32Array[]> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE)
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, 0)
  master.gain.linearRampToValueAtTime(0.5, Math.min(1.5, seconds / 4))
  master.gain.setValueAtTime(0.5, Math.max(0, seconds - 2))
  master.gain.linearRampToValueAtTime(0, seconds)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1800
  master.connect(lp).connect(ctx.destination)
  const prog = PROGRESSIONS[Math.abs(seed) % PROGRESSIONS.length]
  const bar = 4
  for (let t = 0, i = 0; t < seconds; t += bar, i++) {
    const chord = prog[i % prog.length]
    chord.forEach((m, j) => {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.value = hz(m)
        o.detune.value = detune
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.05, t + 1.2)
        g.gain.linearRampToValueAtTime(0, t + bar + 0.8)
        const pan = ctx.createStereoPanner()
        pan.pan.value = (j - 1) * 0.4 + detune / 30
        o.connect(g).connect(pan).connect(master)
        o.start(t)
        o.stop(Math.min(seconds, t + bar + 1))
      }
    })
    for (let b = 0; b < 4; b++) {
      const at = t + b + 0.5
      if (at >= seconds) break
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = hz(chord[(b + i) % 3] + 12)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.06, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
      o.connect(g).connect(master)
      o.start(at)
      o.stop(at + 1)
    }
  }
  const buf = await ctx.startRendering()
  const ch = [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()]
  normalise(ch)
  return ch
}
