import type { Candle } from '../types'

export type Series = (number | null)[]

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function stdev(values: number[], period: number): Series {
  const mean = sma(values, period)
  return values.map((_, i) => {
    const m = mean[i]
    if (m == null) return null
    let s = 0
    for (let j = i - period + 1; j <= i; j++) s += (values[j] - m) ** 2
    return Math.sqrt(s / period)
  })
}

/** Wilder RSI. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  gain /= period
  loss /= period
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    gain = (gain * (period - 1) + Math.max(d, 0)) / period
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}

/** Wilder ATR. */
export function atr(c: Candle[], period = 14): Series {
  const out: Series = new Array(c.length).fill(null)
  if (c.length <= period) return out
  const tr = c.map((b, i) =>
    i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - c[i - 1].close), Math.abs(b.low - c[i - 1].close)),
  )
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period
  out[period] = prev
  for (let i = period + 1; i < c.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period
    out[i] = prev
  }
  return out
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(values, fast)
  const s = ema(values, slow)
  const line: Series = values.map((_, i) => (f[i] != null && s[i] != null ? f[i]! - s[i]! : null))
  const start = line.findIndex((v) => v != null)
  const sig: Series = new Array(values.length).fill(null)
  if (start >= 0) {
    const sub = ema(line.slice(start) as number[], signal)
    sub.forEach((v, j) => (sig[start + j] = v))
  }
  const hist: Series = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i]! : null))
  return { line, signal: sig, hist }
}

/** Least-squares slope over the trailing window, expressed per bar. */
export function regressionSlope(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)
  const xMean = (period - 1) / 2
  let denom = 0
  for (let x = 0; x < period; x++) denom += (x - xMean) ** 2
  for (let i = period - 1; i < values.length; i++) {
    let yMean = 0
    for (let j = 0; j < period; j++) yMean += values[i - period + 1 + j]
    yMean /= period
    let num = 0
    for (let j = 0; j < period; j++) num += (j - xMean) * (values[i - period + 1 + j] - yMean)
    out[i] = num / denom
  }
  return out
}

export function zscore(values: number[], period: number): Series {
  const m = sma(values, period)
  const s = stdev(values, period)
  return values.map((v, i) => (m[i] != null && s[i] ? (v - m[i]!) / s[i]! : null))
}
