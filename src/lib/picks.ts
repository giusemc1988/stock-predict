/**
 * Ranks instruments by the AI analyst's call. Uses the same strategy and analyst code as the
 * chart, with no order-flow input. Paper research only, not financial advice.
 */
import type { Analysis, Candle, OrderFlow, Verdict } from '../types'
import { runStrategy } from './strategy'
import { analyze } from './analyst'

export interface Pick {
  symbol: string
  verdict: Verdict
  score: number
  confidence: number
  confidenceLabel: Analysis['confidenceLabel']
  headline: string
}

const NO_FLOW: OrderFlow = { bids: [], asks: [], trades: [], buyVolume: 0, sellVolume: 0, windowSec: 0, hasBook: false, estimated: true, source: 'none', live: false }
const RANK: Record<Verdict, number> = { BUY: 0, HOLD: 1, SELL: 2 }

/** Analyse each symbol's candles and return the ones the analyst would act on first. */
export function rankPicks(series: { symbol: string; candles: Candle[] }[]): Pick[] {
  const picks: Pick[] = []
  for (const { symbol, candles } of series) {
    if (candles.length < 80) continue
    const closed = runStrategy(candles.slice(0, -1))
    const live = runStrategy(candles).prediction
    const a = analyze(candles, closed, live, NO_FLOW)
    if (!a) continue
    picks.push({ symbol, verdict: a.verdict, score: a.score, confidence: a.confidence, confidenceLabel: a.confidenceLabel, headline: a.headline })
  }
  return picks.sort((x, y) => RANK[x.verdict] - RANK[y.verdict] || y.score - x.score)
}
