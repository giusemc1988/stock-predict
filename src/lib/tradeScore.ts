/**
 * Trade Score 0-100, ported from the AI Trading Analyst for Claude Code
 * (MIT, zubair-trabzada/ai-trading-claude). That project runs five agents
 * (technical, fundamental, sentiment, risk, thesis) and blends their 0-100
 * scores 25/25/20/15/15. Here each agent's rubric is scored from the data the
 * app actually has. Parts with no data (fundamentals, news) are left out and
 * the remaining weights are scaled up, never guessed.
 *
 * Educational only, not financial advice.
 */
import type { BacktestStats, Candle, OrderFlow, ScorePart, TradeScore, VolRegime } from '../types'
import { atr, ema, macd, rsi } from './indicators'
import { recentBuyShare } from './orderflow'

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const pts = (x: number, max = 20) => Math.round(clamp(x, 0, max))

/** Grade and signal bands from the ai-trading-claude orchestrator. */
export function gradeFor(score: number): { grade: TradeScore['grade']; signal: string } {
  if (score >= 85) return { grade: 'A+', signal: 'Strong Buy' }
  if (score >= 70) return { grade: 'A', signal: 'Buy' }
  if (score >= 55) return { grade: 'B', signal: 'Hold / Accumulate' }
  if (score >= 40) return { grade: 'C', signal: 'Neutral' }
  if (score >= 25) return { grade: 'D', signal: 'Caution' }
  return { grade: 'F', signal: 'Avoid' }
}

/**
 * Volatility regime: current ATR as a share of price against its median over the
 * last 100 bars. Ported from CloddsBot's risk engine (MIT, alsk1992/cloddsbot),
 * which halves size in high volatility and halts in extreme volatility.
 */
export function volRegime(candles: Candle[]): { regime: VolRegime; ratio: number } {
  const a = atr(candles, 14)
  const pct: number[] = []
  for (let i = Math.max(0, candles.length - 100); i < candles.length; i++) {
    const v = a[i]
    if (v != null && candles[i].close > 0) pct.push(v / candles[i].close)
  }
  if (pct.length < 20) return { regime: 'normal', ratio: 1 }
  const now = pct[pct.length - 1]
  const sorted = [...pct].sort((x, y) => x - y)
  const median = sorted[Math.floor(sorted.length / 2)]
  const ratio = median > 0 ? now / median : 1
  const regime: VolRegime = ratio > 2.5 ? 'extreme' : ratio > 1.5 ? 'high' : ratio < 0.7 ? 'calm' : 'normal'
  return { regime, ratio }
}

interface Inputs {
  candles: Candle[]
  stats: BacktestStats
  flow: OrderFlow
  /** Reward-to-risk of the analyst plan, null when it suggests no trade. */
  riskReward: number | null
  /** Share of the analyst checks that agree with its verdict (0..1). */
  agreement: number
}

export function tradeScore({ candles, stats, flow, riskReward, agreement }: Inputs): TradeScore | null {
  if (candles.length < 60) return null
  const close = candles.map((c) => c.close)
  const n = close.length - 1
  const last = close[n]
  const e9 = ema(close, 9)
  const e21 = ema(close, 21)
  const e50 = ema(close, 50)
  const r = rsi(close, 14)[n] ?? 50
  const m = macd(close)
  const hist = m.hist[n] ?? 0
  const histPrev = m.hist[n - 3] ?? 0
  const atrNow = atr(candles, 14)[n] ?? 0

  // --- Technical (25%): trend, momentum, volume, breakout, strength; 20 points each
  const trendConds = [last > e21[n]!, last > e50[n]!, e9[n]! > e21[n]!, e21[n]! > e50[n]!, e50[n]! > (e50[n - 10] ?? e50[n]!)]
  const trendPts = trendConds.filter(Boolean).length * 4
  const rsiPts = r >= 55 && r <= 70 ? 10 : r >= 45 && r < 55 ? 6 : r > 70 && r <= 80 ? 6 : r > 80 ? 2 : r < 30 ? 4 : 3
  const macdPts = (hist > 0 ? 5 : 0) + (hist > histPrev ? 5 : 0)
  let upVol = 0
  let upN = 0
  let downVol = 0
  let downN = 0
  for (let i = Math.max(1, n - 19); i <= n; i++) {
    if (close[i] >= close[i - 1]) {
      upVol += candles[i].volume
      upN++
    } else {
      downVol += candles[i].volume
      downN++
    }
  }
  const upAvg = upN ? upVol / upN : 0
  const downAvg = downN ? downVol / downN : 0
  const volRatio = downAvg > 0 ? upAvg / downAvg : upAvg > 0 ? 2 : 1
  const volPts = pts(10 + 10 * (volRatio - 1))
  const win = close.slice(-50)
  const hi = Math.max(...win)
  const lo = Math.min(...win)
  const rangePos = hi > lo ? (last - lo) / (hi - lo) : 0.5
  const prior20High = Math.max(...close.slice(-21, -1))
  const breakout = last > prior20High
  const patternPts = pts(4 + 14 * rangePos + (breakout ? 2 : 0))
  const ret50 = close[Math.max(0, n - 50)] > 0 ? last / close[Math.max(0, n - 50)] - 1 : 0
  const atrPct = last > 0 ? atrNow / last : 0
  const z = atrPct > 0 ? ret50 / (atrPct * Math.sqrt(50)) : 0
  const strengthPts = pts(10 + 5 * z)
  const technical: ScorePart = {
    key: 'technical',
    label: 'Technical',
    weight: 0.25,
    score: trendPts + rsiPts + macdPts + volPts + patternPts + strengthPts,
    subs: [
      { label: 'Trend', points: trendPts, max: 20, note: `${trendConds.filter(Boolean).length} of 5 trend checks up (price over the 21 and 50 averages, averages stacked and rising).` },
      { label: 'Momentum', points: rsiPts + macdPts, max: 20, note: `RSI ${r.toFixed(0)}; MACD ${hist > 0 ? 'above' : 'below'} zero and ${hist > histPrev ? 'rising' : 'falling'}.` },
      { label: 'Volume', points: volPts, max: 20, note: `Up bars traded ${volRatio.toFixed(2)}x the volume of down bars over the last 20.` },
      { label: 'Breakout', points: patternPts, max: 20, note: `Price sits ${Math.round(rangePos * 100)}% of the way up its 50-bar range${breakout ? ' and just broke the 20-bar high' : ''}.` },
      { label: 'Strength', points: strengthPts, max: 20, note: `${(ret50 * 100).toFixed(1)}% over 50 bars, measured against its own swings (no index comparison yet).` },
    ],
  }

  // --- Fundamental (25%): no company financials in the app, so it is left out.
  const fundamental: ScorePart = {
    key: 'fundamental',
    label: 'Fundamental',
    weight: 0.25,
    score: null,
    subs: [],
    missing: 'No company financials in the app yet, so this part is left out and the others count for more.',
  }

  // --- Sentiment (20%): no news feed, so buying vs selling pressure stands in.
  const share = recentBuyShare(candles, 20)
  const barPts = Math.round(clamp(50 + (share - 0.5) * 400, 0, 100))
  const tape = flow.buyVolume + flow.sellVolume
  const tapeShare = tape > 0 ? flow.buyVolume / tape : null
  const tapePts = tapeShare == null ? null : Math.round(clamp(50 + (tapeShare - 0.5) * 300, 0, 100))
  const sentimentScore = tapePts == null ? barPts : Math.round(barPts * 0.5 + tapePts * 0.5)
  const sentiment: ScorePart = {
    key: 'sentiment',
    label: 'Sentiment',
    weight: 0.2,
    score: sentimentScore,
    subs: [
      { label: 'Bar volume', points: Math.round(barPts / 5), max: 20, note: `${Math.round(share * 100)}% of the last 20 bars' volume was buying.` },
      ...(tapePts != null && tapeShare != null ? [{ label: 'Live tape', points: Math.round(tapePts / 5), max: 20, note: `${Math.round(tapeShare * 100)}% of live trades were buys${flow.estimated ? ' (estimated)' : ''}.` }] : []),
    ],
    missing: 'No news or social feed yet; this reads buying vs selling volume only.',
  }

  // --- Risk (15%): higher = safer. Volatility regime and drawdown, 50 points each.
  const vr = volRegime(candles)
  const volaPts = Math.round(clamp(55 - 25 * vr.ratio, 0, 50))
  let peak = close[0]
  let dd = 0
  for (const c of close) {
    peak = Math.max(peak, c)
    dd = Math.max(dd, 1 - c / peak)
  }
  const ddPts = Math.round(clamp(50 - 1.5 * dd * 100, 0, 50))
  const risk: ScorePart = {
    key: 'risk',
    label: 'Risk (higher is safer)',
    weight: 0.15,
    score: volaPts + ddPts,
    subs: [
      { label: 'Volatility', points: Math.round(volaPts / 2.5), max: 20, note: `Swings are ${vr.ratio.toFixed(2)}x their usual size (${vr.regime}).` },
      { label: 'Drawdown', points: Math.round(ddPts / 2.5), max: 20, note: `Worst drop from a high on this chart: ${(dd * 100).toFixed(1)}%.` },
    ],
  }

  // --- Thesis (15%): does the model have an edge worth acting on?
  const acc = stats.modelAccuracy
  const edgePts = Math.round(clamp((acc - 0.5) / 0.1, 0, 1) * 30)
  const beatHold = stats.trades > 0 && stats.totalReturnPct > stats.buyHoldPct
  const samplePts = Math.round(clamp(stats.trades / 30, 0, 1) * 20)
  const rrPts = riskReward == null ? 5 : riskReward >= 2 ? 15 : 8
  const agreePts = Math.round(clamp(agreement, 0, 1) * 10)
  const thesis: ScorePart = {
    key: 'thesis',
    label: 'Thesis',
    weight: 0.15,
    score: edgePts + (beatHold ? 25 : 0) + samplePts + rrPts + agreePts,
    subs: [
      { label: 'Model edge', points: Math.round(edgePts / 1.5), max: 20, note: acc ? `Model right ${Math.round(acc * 100)}% of the time (50% is a coin flip).` : 'Not graded yet.' },
      { label: 'Beat holding', points: beatHold ? 20 : 0, max: 20, note: beatHold ? 'The robot beat just holding on this chart.' : 'Just holding did as well or better.' },
      { label: 'Sample size', points: samplePts, max: 20, note: `${stats.trades} backtest trades (30+ wanted).` },
    ],
  }

  const parts = [technical, fundamental, sentiment, risk, thesis]
  const used = parts.filter((p) => p.score != null)
  const wsum = used.reduce((a, p) => a + p.weight, 0)
  const score = Math.round(used.reduce((a, p) => a + (p.score as number) * p.weight, 0) / wsum)
  return { score, ...gradeFor(score), parts, regime: vr.regime, volRatio: vr.ratio, riskScore: risk.score as number }
}
