/**
 * Bluechip AI analyst: turns indicators, real order flow and the model's own
 * track record into a plain-English BUY / HOLD / SELL call.
 *
 * Confidence is deliberately discounted by how well the model actually did on
 * this chart (walk-forward hit rate). Near 50% means "coin flip", and the call is
 * labelled low confidence accordingly. Educational only, not financial advice.
 */
import type { Analysis, AnalystCheck, Candle, OrderFlow, Prediction, StrategyResult, Verdict } from '../types'
import { ema, macd, rsi } from './indicators'
import { bookImbalance, hasRealBuyVolume, recentBuyShare } from './orderflow'
import { fmtPrice } from './format'

const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x))
const stanceOf = (v: number, dead = 0.15): AnalystCheck['stance'] => (v > dead ? 'bull' : v < -dead ? 'bear' : 'neutral')
const pct = (x: number) => `${Math.round(x * 100)}%`

export function analyze(candles: Candle[], strat: StrategyResult, live: Prediction | null, flow: OrderFlow): Analysis | null {
  if (candles.length < 60 || !live) return null
  const close = candles.map((c) => c.close)
  const last = close[close.length - 1]
  const n = close.length - 1
  const e9 = ema(close, 9)[n]!
  const e21 = ema(close, 21)[n]!
  const e50 = ema(close, 50)[n]!
  const r = rsi(close, 14)[n] ?? 50
  const m = macd(close)
  const hist = m.hist[n] ?? 0
  const histPrev = m.hist[n - 3] ?? 0
  const atr = live.atr

  const checks: (AnalystCheck & { score: number; weight: number })[] = []

  // 1. Trend
  const above21 = last > e21
  const above50 = last > e50
  const trendScore = clamp(((last - e50) / (atr * 3)) * 0.5 + ((e9 - e21) / atr) * 0.5)
  checks.push({
    label: 'Trend',
    detail:
      above21 && above50 && e9 > e21
        ? 'Price is above its 21- and 50-bar averages and the short-term average is on top. The trend is up.'
        : !above21 && !above50 && e9 < e21
          ? 'Price is below its 21- and 50-bar averages and the short-term average is falling. The trend is down.'
          : `Mixed: price is ${above50 ? 'above' : 'below'} the 50-bar average but ${above21 ? 'above' : 'below'} the 21-bar one. No clear trend.`,
    stance: stanceOf(trendScore),
    score: trendScore,
    weight: 0.3,
  })

  // 2. Momentum
  const rsiScore = r > 75 ? -0.6 : r < 25 ? 0.6 : (r - 50) / 40
  const macdScore = clamp(hist / (atr * 0.3)) * 0.5 + clamp((hist - histPrev) / (atr * 0.3)) * 0.5
  const momScore = clamp(rsiScore * 0.5 + macdScore * 0.5)
  checks.push({
    label: 'Momentum',
    detail: `RSI is ${r.toFixed(0)}${r > 70 ? ' (overheated, pullbacks are common from here)' : r < 30 ? ' (oversold, bounces are common from here)' : r > 55 ? ' (buyers have the edge)' : r < 45 ? ' (sellers have the edge)' : ' (neutral)'}. MACD momentum is ${hist > histPrev ? 'improving' : 'fading'}.`,
    stance: stanceOf(momScore),
    score: momScore,
    weight: 0.15,
  })

  // 3. Buyer vs seller volume per bar
  const share = recentBuyShare(candles, 20)
  const real = hasRealBuyVolume(candles)
  const volScore = clamp((share - 0.5) * 8)
  checks.push({
    label: 'Buyers vs sellers',
    detail: `${real ? '' : 'Estimated: '}${pct(share)} of volume over the last 20 bars came from buyers hitting the ask, ${pct(1 - share)} from sellers hitting the bid.`,
    stance: stanceOf(volScore),
    score: volScore,
    weight: 0.15,
  })

  // 4. Live order flow (tape + book)
  const tapeTotal = flow.buyVolume + flow.sellVolume
  if (tapeTotal > 0) {
    const tapeShare = flow.buyVolume / tapeTotal
    const imb = flow.hasBook && flow.bids.length ? bookImbalance(flow.bids, flow.asks) : null
    const flowScore = clamp((tapeShare - 0.5) * 6 * (imb == null ? 1 : 0.6) + (imb == null ? 0 : (imb - 0.5) * 4 * 0.4))
    checks.push({
      label: 'Live order flow',
      detail:
        `Last ${flow.windowSec / 60} min: buyers ${pct(tapeShare)} of traded volume` +
        (imb != null ? `; ${pct(imb)} of resting orders near the price are bids.` : '.') +
        (flow.estimated ? ' (simulated or estimated)' : ''),
      stance: stanceOf(flowScore),
      score: flowScore,
      weight: flow.estimated && !flow.live ? 0.05 : 0.15,
    })
  }

  // 5. Model
  const modelScore = clamp((live.probUp - 0.5) * 4)
  checks.push({
    label: 'AI model',
    detail: `Estimates a ${pct(live.probUp)} chance price is higher ${live.horizon} bars from now.`,
    stance: stanceOf(modelScore),
    score: modelScore,
    weight: 0.2,
  })

  const wsum = checks.reduce((a, c) => a + c.weight, 0)
  const score = checks.reduce((a, c) => a + c.score * c.weight, 0) / wsum
  const verdict: Verdict = score > 0.2 ? 'BUY' : score < -0.2 ? 'SELL' : 'HOLD'

  // Discount by real track record on this chart.
  const acc = strat.stats.modelAccuracy
  const reliability = clamp((acc - 0.5) / 0.1, 0, 1)
  const agree = checks.filter((c) => c.stance === (score > 0 ? 'bull' : 'bear')).length / checks.length
  const confidence = Math.min(acc < 0.55 ? 0.5 : 0.85, Math.abs(score) * (0.35 + 0.65 * reliability) * (0.6 + 0.4 * agree) * 1.6)
  const confidenceLabel = confidence < 0.3 ? 'Low' : confidence < 0.55 ? 'Medium' : 'High'

  const bulls = checks.filter((c) => c.stance === 'bull').map(name)
  const bears = checks.filter((c) => c.stance === 'bear').map(name)
  const headline =
    verdict === 'BUY'
      ? `Leaning buy: ${listify(bulls)} point${bulls.length === 1 ? 's' : ''} up${bears.length ? `, though ${listify(bears)} disagree${bears.length === 1 ? 's' : ''}` : ''}.`
      : verdict === 'SELL'
        ? `Leaning sell: ${listify(bears)} point${bears.length === 1 ? 's' : ''} down${bulls.length ? `, though ${listify(bulls)} disagree${bulls.length === 1 ? 's' : ''}` : ''}.`
        : bulls.length || bears.length
          ? `Wait: the signals conflict (${bulls.length} bullish, ${bears.length} bearish). No clear edge right now.`
          : 'Wait: nothing stands out. No clear edge right now.'

  const plan =
    verdict === 'HOLD'
      ? null
      : verdict === 'BUY'
        ? { entry: last, stop: last - 1.5 * atr, target: last + 3 * atr, riskReward: 2 }
        : { entry: last, stop: last + 1.5 * atr, target: last - 3 * atr, riskReward: 2 }

  const trackRecord =
    acc === 0
      ? 'Not enough history yet to grade the model on this chart.'
      : `On this chart the model's past calls were right ${pct(acc)} of the time (a coin flip is 50%). ${
          acc < 0.55 ? 'That is barely better than chance, so treat this as a lean, not a forecast.' : 'Useful, but past accuracy does not guarantee future results.'
        }`

  return {
    verdict,
    score,
    confidence,
    confidenceLabel,
    headline,
    checks: checks.map(({ label, detail, stance }) => ({ label, detail, stance })),
    plan,
    trackRecord,
  }
}

const name = (c: AnalystCheck) => (c.label === 'AI model' ? 'the AI model' : c.label.toLowerCase())

function listify(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

export const planText = (a: Analysis) =>
  a.plan
    ? a.verdict === 'BUY'
      ? `Example plan: buy near ${fmtPrice(a.plan.entry)}, exit if it drops to ${fmtPrice(a.plan.stop)}, take profit around ${fmtPrice(a.plan.target)}.`
      : `If you hold it, consider reducing. A move back above ${fmtPrice(a.plan.stop)} would cancel this view; downside target ${fmtPrice(a.plan.target)}.`
    : 'No trade suggested. Wait for the signals to line up.'
