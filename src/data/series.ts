import type { Candle, Instrument, Timeframe } from '../types'
import { alphaVantageCandlesCached, alpacaStockCandles, binanceKlines, hasAlpacaData, type AlpacaDataKeys, type ApiKeys } from './providers'

/** Crypto from Binance (no key); stocks from Alpaca data if connected, else Alpha Vantage. */
export async function candlesFor(inst: Instrument, tf: Timeframe, keys: ApiKeys, alpaca: AlpacaDataKeys, limit = 500): Promise<Candle[]> {
  if (inst.assetClass === 'crypto') return binanceKlines(inst.feedId, tf, limit)
  if (hasAlpacaData(alpaca)) return alpacaStockCandles(inst.feedId, tf, alpaca)
  if (keys.alphaVantage) return (await alphaVantageCandlesCached(inst.feedId, tf, keys.alphaVantage)).candles
  throw new Error(`${inst.symbol}: no data key`)
}
