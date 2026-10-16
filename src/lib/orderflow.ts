import type { BookLevel, Candle } from '../types'

/**
 * Buy volume for a bar. Binance reports aggressive-buyer volume directly; for other
 * feeds it is estimated from where the bar closed inside its range (close-location value).
 */
export function barBuyVolume(c: Candle) {
  if (c.buyVolume != null && isFinite(c.buyVolume)) return c.buyVolume
  const range = c.high - c.low
  const clv = range > 0 ? (c.close - c.low - (c.high - c.close)) / range : 0
  return c.volume * (0.5 + 0.35 * clv)
}

export const hasRealBuyVolume = (candles: Candle[]) => candles.length > 0 && candles[candles.length - 1].buyVolume != null

/** Share of volume that was aggressive buying over the last `n` bars (0..1). */
export function recentBuyShare(candles: Candle[], n = 20) {
  const slice = candles.slice(-n)
  let buy = 0
  let total = 0
  for (const c of slice) {
    buy += barBuyVolume(c)
    total += c.volume
  }
  return total > 0 ? buy / total : 0.5
}

/** Resting bid size vs ask size near the touch (0..1, >0.5 = more buyers waiting). */
export function bookImbalance(bids: BookLevel[], asks: BookLevel[], levels = 10) {
  const b = bids.slice(0, levels).reduce((a, l) => a + l.size, 0)
  const a = asks.slice(0, levels).reduce((s, l) => s + l.size, 0)
  return a + b > 0 ? b / (a + b) : 0.5
}

/** Estimate buy/sell volume split from OHLCV when live data is unavailable. Uses On-Balance Volume logic. */
export function estimateOrderFlow(
  candles: Candle[],
  lastPrice: number
): { buyVolume: number; sellVolume: number } {
  let buyVolume = 0
  let sellVolume = 0

  for (const candle of candles) {
    if (candle.volume === 0) continue

    if (candle.close > candle.open) {
      // Price closed higher: buyer initiated
      buyVolume += candle.volume
    } else if (candle.close < candle.open) {
      // Price closed lower: seller initiated
      sellVolume += candle.volume
    } else {
      // Close == open: split by relative position in high/low range
      const range = candle.high - candle.low
      if (range === 0) {
        // No range, split evenly
        buyVolume += candle.volume / 2
        sellVolume += candle.volume / 2
      } else {
        // Position high = more buyers
        const buyPct = (lastPrice - candle.low) / range
        buyVolume += candle.volume * buyPct
        sellVolume += candle.volume * (1 - buyPct)
      }
    }
  }

  return { buyVolume, sellVolume }
}
