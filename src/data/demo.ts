/**
 * Deterministic synthetic market used when no live source is reachable.
 * History is seeded per symbol + timeframe so it is stable across reloads; a
 * shared "last price" random-walks every second so the chart and watchlist agree.
 */
import type { Candle, Instrument, Timeframe } from '../types'
import { tfSeconds } from '../types'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function gauss(rand: () => number) {
  const u = Math.max(rand(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

const SECONDS_PER_YEAR = 365 * 24 * 3600

const lastPrice = new Map<string, number>()
const sessionOpen = new Map<string, number>()
const lastTickAt = new Map<string, number>()
const tickRand = mulberry32(Date.now() & 0xffffffff)

export function demoPrice(inst: Instrument) {
  if (!lastPrice.has(inst.symbol)) {
    lastPrice.set(inst.symbol, inst.demoPrice)
    sessionOpen.set(inst.symbol, inst.demoPrice * (1 + (mulberry32(hash(inst.symbol))() - 0.5) * 0.04))
  }
  return lastPrice.get(inst.symbol)!
}

export function demoSessionOpen(inst: Instrument) {
  demoPrice(inst)
  return sessionOpen.get(inst.symbol)!
}

/**
 * Advance the shared demo price by `dtSec` seconds and return it. Several callers
 * (watchlist, chart) may tick the same symbol; ticks closer than 800 ms are merged.
 */
export function demoTick(inst: Instrument, dtSec = 1) {
  const p = demoPrice(inst)
  const now = Date.now()
  if (now - (lastTickAt.get(inst.symbol) ?? 0) < 800) return p
  lastTickAt.set(inst.symbol, now)
  // exaggerate per-second vol a little so the demo feels alive
  const sigma = inst.demoVol * Math.sqrt(dtSec / SECONDS_PER_YEAR) * 6
  const next = p * Math.exp(sigma * gauss(tickRand))
  lastPrice.set(inst.symbol, next)
  return next
}

export function demoHistory(inst: Instrument, tf: Timeframe, count = 500): Candle[] {
  const step = tfSeconds(tf)
  const rand = mulberry32(hash(inst.symbol + tf))
  const sigma = inst.demoVol * Math.sqrt(step / SECONDS_PER_YEAR) * (tf === '1m' ? 3 : tf === '1d' ? 1 : 1.6)
  const now = Math.floor(Date.now() / 1000)
  const lastOpen = now - (now % step)
  const out: Candle[] = []
  let price = 100
  let drift = 0
  let regimeLeft = 0
  const baseVol = 1000 + rand() * 4000
  for (let i = 0; i < count; i++) {
    if (regimeLeft-- <= 0) {
      // regime switching gives the strategy real trends to find
      drift = (rand() - 0.5) * sigma * 0.9
      regimeLeft = 20 + Math.floor(rand() * 60)
    }
    const open = price
    const r = drift + sigma * gauss(rand)
    const close = open * Math.exp(r)
    const wick = Math.abs(sigma * gauss(rand)) * 0.6
    const high = Math.max(open, close) * (1 + wick * rand())
    const low = Math.min(open, close) * (1 - wick * rand())
    const volume = baseVol * (0.6 + rand() * 0.8) * (1 + Math.min(4, Math.abs(r) / sigma))
    out.push({ time: lastOpen - (count - 1 - i) * step, open, high, low, close, volume })
    price = close
  }
  // rescale so the last close matches the shared live demo price
  const k = demoPrice(inst) / out[out.length - 1].close
  return out.map((c) => ({ ...c, open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k }))
}
