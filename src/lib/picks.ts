/**
 * Ranks instruments by the AI analyst's call. Uses the same strategy and analyst code as the
 * chart, with no order-flow input. Paper research only, not financial advice.
 */
import type { Analysis, AnalystCheck, Candle, OrderFlow, Verdict } from '../types'
import { runStrategy } from './strategy'
import { analyze } from './analyst'
import { rsi, sma } from './indicators'
import { hasRealBuyVolume, recentBuyShare } from './orderflow'

export interface Pick {
  symbol: string
  verdict: Verdict
  score: number
  confidence: number
  confidenceLabel: Analysis['confidenceLabel']
  headline: string
  /** Past-signal success from the app's own backtest on this symbol's history. */
  winRate: number
  trades: number
  inputs: PickInputs
}

/** Everything the analyst looked at for one stock, so the call can be checked. */
export interface PickInputs {
  rsi: number | null
  /** Last bar's volume divided by its 20-bar average (1 = average). */
  volumeVsAvg: number | null
  /** Share of recent volume that was buying (0..1). */
  buyShare: number
  /** True when buy/sell split is estimated from price, not reported. */
  buyShareEstimated: boolean
  reasons: AnalystCheck[]
  strategyReturnPct: number
  buyHoldReturnPct: number
  /** "edge" only when the strategy's backtest beat buy-and-hold on the same history. */
  versusBaseline: 'edge' | 'no edge'
  /** News is not connected to the app yet. */
  newsCount: null
}

/** Below this many past trades a win rate is mostly noise, so the UI warns. */
export const SMALL_SAMPLE = 30

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
    picks.push({
      inputs: inputsFor(candles, a, closed.stats),
      symbol,
      verdict: a.verdict,
      score: a.score,
      confidence: a.confidence,
      confidenceLabel: a.confidenceLabel,
      headline: a.headline,
      winRate: closed.stats.winRate,
      trades: closed.stats.trades,
    })
  }
  return picks
}

function inputsFor(candles: Candle[], a: Analysis, stats: { totalReturnPct: number; buyHoldPct: number }): PickInputs {
  const close = candles.map((c) => c.close)
  const r = rsi(close, 14)
  const vol = sma(candles.map((c) => c.volume), 20)
  const v = candles[candles.length - 1].volume
  const avg = vol[vol.length - 1]
  const beat = stats.totalReturnPct > stats.buyHoldPct
  return {
    rsi: r[r.length - 1] ?? null,
    volumeVsAvg: avg ? v / avg : null,
    buyShare: recentBuyShare(candles, 20),
    buyShareEstimated: !hasRealBuyVolume(candles),
    reasons: a.checks.map(({ label, detail, stance }) => ({ label, detail, stance })),
    strategyReturnPct: stats.totalReturnPct,
    buyHoldReturnPct: stats.buyHoldPct,
    versusBaseline: beat ? 'edge' : 'no edge',
    newsCount: null,
  }
}

export type PickSort = 'call' | 'success'

export function sortPicks(picks: Pick[], by: PickSort): Pick[] {
  if (by === 'success') return [...picks].sort((x, y) => y.winRate - x.winRate || y.trades - x.trades)
  return [...picks].sort((x, y) => RANK[x.verdict] - RANK[y.verdict] || y.score - x.score)
}

const PICKS_KEY = 'bluechip.picks'
export const PICKS_EVENT = 'bluechip:picks'

/** Last scan's results, kept so the watchlist can sort by them. Browser storage only. */
export function savePicks(picks: Pick[]) {
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify({ at: Date.now(), picks }))
    window.dispatchEvent(new Event(PICKS_EVENT))
  } catch {
    /* storage blocked: the list just stays unsorted by success */
  }
}

export function loadPicks(): Pick[] {
  try {
    const raw = localStorage.getItem(PICKS_KEY)
    return raw ? (JSON.parse(raw).picks as Pick[]) : []
  } catch {
    return []
  }
}
