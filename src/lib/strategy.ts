/**
 * Arc Analyst prediction engine.
 *
 * A walk-forward online logistic regression learns P(close[t+H] > close[t]) from a
 * handful of normalised technical features. It only ever trains on bars whose
 * outcome is already known at time t, so the signals painted on the chart are
 * exactly what the model would have produced live (no look-ahead).
 *
 * The model probability is blended with a deterministic rule score (trend,
 * momentum, mean-reversion) and run through a long/flat state machine with
 * hysteresis and a cooldown to produce BUY / SELL trigger points.
 *
 * Educational tool only. This is not financial advice.
 */
import type { BacktestStats, Candle, Prediction, Signal, StrategyResult } from '../types'
import { atr, ema, macd, regressionSlope, rsi, sma, stdev, zscore } from './indicators'

export interface StrategyConfig {
  horizon: number
  fast: number
  slow: number
  buyThreshold: number
  sellThreshold: number
  cooldown: number
  learningRate: number
  l2: number
}

export const DEFAULT_CONFIG: StrategyConfig = {
  horizon: 5,
  fast: 9,
  slow: 21,
  buyThreshold: 0.6,
  sellThreshold: 0.42,
  cooldown: 4,
  learningRate: 0.05,
  l2: 0.001,
}

const FEATURE_NAMES = ['Trend (EMA spread)', 'Momentum (MACD)', 'RSI', 'Bollinger %B', 'Regression slope', 'Volume surge', '5-bar return'] as const

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/** Running mean/variance (Welford) so features are standardised without look-ahead. */
class RunningNorm {
  n = 0
  mean: number[]
  m2: number[]
  constructor(dim: number) {
    this.mean = new Array(dim).fill(0)
    this.m2 = new Array(dim).fill(0)
  }
  push(x: number[]) {
    this.n++
    for (let i = 0; i < x.length; i++) {
      const d = x[i] - this.mean[i]
      this.mean[i] += d / this.n
      this.m2[i] += d * (x[i] - this.mean[i])
    }
  }
  apply(x: number[]) {
    return x.map((v, i) => {
      const sd = this.n > 1 ? Math.sqrt(this.m2[i] / (this.n - 1)) : 1
      return clamp((v - this.mean[i]) / (sd || 1), -4, 4)
    })
  }
}

export function runStrategy(candles: Candle[], cfg: StrategyConfig = DEFAULT_CONFIG): StrategyResult {
  const n = candles.length
  const close = candles.map((c) => c.close)
  const vol = candles.map((c) => c.volume)
  const emaF = ema(close, cfg.fast)
  const emaS = ema(close, cfg.slow)
  const atr14 = atr(candles, 14)
  const rsi14 = rsi(close, 14)
  const m = macd(close)
  const bbMid = sma(close, 20)
  const bbSd = stdev(close, 20)
  const slope = regressionSlope(close, 20)
  const volZ = zscore(vol, 20)
  const ema200 = ema(close, Math.min(100, Math.max(30, Math.floor(n / 5))))

  const rawFeatures: (number[] | null)[] = candles.map((c, i) => {
    const a = atr14[i]
    if (a == null || !a || emaF[i] == null || emaS[i] == null || rsi14[i] == null || m.hist[i] == null || bbSd[i] == null || slope[i] == null || i < 5) return null
    const pctB = bbSd[i] ? (c.close - (bbMid[i]! - 2 * bbSd[i]!)) / (4 * bbSd[i]!) : 0.5
    return [
      (emaF[i]! - emaS[i]!) / a,
      m.hist[i]! / a,
      (rsi14[i]! - 50) / 50,
      pctB - 0.5,
      (slope[i]! * 10) / a,
      volZ[i] ?? 0,
      (c.close - close[i - 5]) / a,
    ]
  })

  // Prior weights encode a sensible trend-following view; the online learner adapts them.
  const dim = FEATURE_NAMES.length
  const w = [0.6, 0.4, 0.15, -0.1, 0.5, 0.05, 0.2]
  let bias = 0
  const norm = new RunningNorm(dim)
  const probSeries: (number | null)[] = new Array(n).fill(null)
  let correct = 0
  let graded = 0
  let smoothed: number | null = null

  for (let i = 0; i < n; i++) {
    const f = rawFeatures[i]
    // 1) learn from the sample whose outcome just became known (bar i - H)
    const j = i - cfg.horizon
    if (j >= 0 && rawFeatures[j]) {
      const xj = norm.apply(rawFeatures[j]!)
      const y = close[i] > close[j] ? 1 : 0
      const p = sigmoid(bias + xj.reduce((s, v, k) => s + v * w[k], 0))
      if (probSeries[j] != null && norm.n > 50) {
        graded++
        if ((probSeries[j]! > 0.5 ? 1 : 0) === y) correct++
      }
      const err = y - p
      for (let k = 0; k < dim; k++) w[k] += cfg.learningRate * (err * xj[k] - cfg.l2 * w[k])
      bias += cfg.learningRate * err * 0.5
    }
    if (!f) continue
    norm.push(f)
    const x = norm.apply(f)
    const pModel = sigmoid(bias + x.reduce((s, v, k) => s + v * w[k], 0))
    // deterministic rule score in [-1, 1]
    const trend = Math.tanh(f[0])
    const mom = Math.tanh(f[1] * 2)
    const meanRev = rsi14[i]! > 75 ? -0.5 : rsi14[i]! < 25 ? 0.5 : 0
    const regime = ema200[i] != null ? (close[i] > ema200[i]! ? 0.2 : -0.2) : 0
    const rs = clamp(0.45 * trend + 0.35 * mom + 0.2 * Math.tanh(f[4]) + meanRev * 0.4 + regime, -1, 1)
    const warm = clamp((norm.n - 30) / 120, 0, 0.7) // trust the model more as it sees more data
    const blended = warm * pModel + (1 - warm) * (0.5 + rs / 2)
    smoothed = smoothed == null ? blended : smoothed * 0.5 + blended * 0.5
    probSeries[i] = smoothed
  }

  // 2) state machine → signals
  const signals: Signal[] = []
  let inPos = false
  let lastIdx = -Infinity
  let entry = 0
  let equity = 1
  let peak = 1
  let maxDd = 0
  const tradeRets: number[] = []
  for (let i = 1; i < n; i++) {
    const p = probSeries[i]
    if (p == null || emaF[i] == null || emaS[i] == null || atr14[i] == null) continue
    const cooled = i - lastIdx >= cfg.cooldown
    const up = emaF[i]! > emaS[i]!
    const reasons: string[] = []
    if (!inPos && cooled && p >= cfg.buyThreshold && (up || (rsi14[i] ?? 50) < 30)) {
      reasons.push(`P(up ${cfg.horizon} bars) ${(p * 100).toFixed(0)}%`)
      reasons.push(up ? `EMA${cfg.fast} above EMA${cfg.slow}` : 'Oversold rebound (RSI < 30)')
      if ((m.hist[i] ?? 0) > 0) reasons.push('MACD histogram positive')
      reasons.push(`RSI ${rsi14[i]!.toFixed(1)}`)
      signals.push(mkSignal(candles[i], i, 'buy', p, reasons))
      inPos = true
      entry = close[i]
      lastIdx = i
    } else if (inPos && cooled) {
      const stop = close[i] < emaS[i]! - 1.0 * atr14[i]!
      if (p <= cfg.sellThreshold || stop || (rsi14[i] ?? 50) > 80) {
        reasons.push(`P(up ${cfg.horizon} bars) ${(p * 100).toFixed(0)}%`)
        if (stop) reasons.push(`Close broke EMA${cfg.slow} − 1 ATR`)
        if (!up) reasons.push(`EMA${cfg.fast} crossed below EMA${cfg.slow}`)
        if ((rsi14[i] ?? 50) > 80) reasons.push('Overbought (RSI > 80)')
        reasons.push(`RSI ${rsi14[i]!.toFixed(1)}`)
        signals.push(mkSignal(candles[i], i, 'sell', p, reasons))
        const r = close[i] / entry - 1
        tradeRets.push(r)
        equity *= 1 + r
        inPos = false
        lastIdx = i
      }
    }
    const mark = inPos ? equity * (close[i] / entry) : equity
    peak = Math.max(peak, mark)
    maxDd = Math.max(maxDd, 1 - mark / peak)
  }
  if (inPos) equity *= close[n - 1] / entry

  const firstIdx = probSeries.findIndex((p) => p != null)
  const stats: BacktestStats = {
    trades: tradeRets.length,
    winRate: tradeRets.length ? tradeRets.filter((r) => r > 0).length / tradeRets.length : 0,
    totalReturnPct: (equity - 1) * 100,
    buyHoldPct: firstIdx >= 0 ? (close[n - 1] / close[firstIdx] - 1) * 100 : 0,
    maxDrawdownPct: maxDd * 100,
    avgTradePct: tradeRets.length ? (tradeRets.reduce((a, b) => a + b, 0) / tradeRets.length) * 100 : 0,
    modelAccuracy: graded ? correct / graded : 0,
  }

  return {
    signals,
    prediction: buildPrediction(candles, rawFeatures, norm, w, probSeries, atr14, rsi14, cfg),
    stats,
    emaFast: emaF,
    emaSlow: emaS,
    probSeries,
  }
}

function mkSignal(c: Candle, index: number, side: 'buy' | 'sell', probUp: number, reasons: string[]): Signal {
  return {
    time: c.time,
    index,
    side,
    price: c.close,
    probUp,
    confidence: Math.min(1, Math.abs(probUp - 0.5) * 2),
    reasons,
  }
}

function buildPrediction(
  candles: Candle[],
  raw: (number[] | null)[],
  norm: RunningNorm,
  w: number[],
  prob: (number | null)[],
  atr14: (number | null)[],
  rsi14: (number | null)[],
  cfg: StrategyConfig,
): Prediction | null {
  const n = candles.length
  const last = n - 1
  const f = raw[last]
  const p = prob[last]
  const a = atr14[last]
  if (!f || p == null || a == null || n < 2) return null
  const x = norm.apply(f)
  const step = candles[last].time - candles[last - 1].time
  const drift = (p - 0.5) * 2 * a * 0.6 // expected move per bar, scaled by conviction
  const lastClose = candles[last].close
  const forecast = [{ time: candles[last].time, value: lastClose, upper: lastClose, lower: lastClose }]
  for (let h = 1; h <= cfg.horizon * 2; h++) {
    const v = lastClose + drift * h
    const band = a * Math.sqrt(h)
    forecast.push({ time: candles[last].time + step * h, value: v, upper: v + band, lower: v - band })
  }
  const score = (p - 0.5) * 2
  return {
    probUp: p,
    score,
    bias: p > 0.55 ? 'bullish' : p < 0.45 ? 'bearish' : 'neutral',
    confidence: Math.min(1, Math.abs(score)),
    horizon: cfg.horizon,
    targetPrice: lastClose + drift * cfg.horizon,
    forecast,
    factors: FEATURE_NAMES.map((name, k) => ({
      name,
      value: f[k],
      contribution: x[k] * w[k],
      label: describe(k, f[k], rsi14[last]),
    })),
    rsi: rsi14[last] ?? 50,
    atr: a,
  }
}

function describe(k: number, v: number, r: number | null): string {
  switch (k) {
    case 0:
      return v > 0 ? 'Fast EMA above slow' : 'Fast EMA below slow'
    case 1:
      return v > 0 ? 'Momentum building' : 'Momentum fading'
    case 2:
      return `RSI ${(r ?? 50).toFixed(0)}`
    case 3:
      return v > 0.4 ? 'Near upper band' : v < -0.4 ? 'Near lower band' : 'Mid-band'
    case 4:
      return v > 0 ? 'Rising regression' : 'Falling regression'
    case 5:
      return v > 1 ? 'Volume spike' : v < -1 ? 'Volume drying up' : 'Normal volume'
    default:
      return v > 0 ? 'Up over last 5 bars' : 'Down over last 5 bars'
  }
}
