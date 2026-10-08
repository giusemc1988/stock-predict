export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export const TIMEFRAMES: { id: Timeframe; label: string; seconds: number }[] = [
  { id: '1m', label: '1m', seconds: 60 },
  { id: '5m', label: '5m', seconds: 300 },
  { id: '15m', label: '15m', seconds: 900 },
  { id: '1h', label: '1H', seconds: 3600 },
  { id: '4h', label: '4H', seconds: 14400 },
  { id: '1d', label: '1D', seconds: 86400 },
]

export const tfSeconds = (tf: Timeframe) => TIMEFRAMES.find((t) => t.id === tf)!.seconds

/** One OHLCV bar. `time` is a UTC unix timestamp in seconds (bar open). */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type AssetClass = 'crypto' | 'stock'

export interface Instrument {
  symbol: string // display symbol, e.g. BTC/USDT or AAPL
  name: string
  assetClass: AssetClass
  /** Provider-native id (Binance pair, ticker). */
  feedId: string
  /** Seed price used by the demo feed when no live source is reachable. */
  demoPrice: number
  /** Annualised-ish volatility used by the demo feed. */
  demoVol: number
}

export interface Quote {
  symbol: string
  price: number
  change: number
  changePct: number
  high: number
  low: number
  volume: number
  spark: number[]
  live: boolean
  updatedAt: number
}

export type FeedStatus = 'connecting' | 'live' | 'polling' | 'demo' | 'error'

export type SignalSide = 'buy' | 'sell'

export interface Signal {
  time: number
  index: number
  side: SignalSide
  price: number
  /** Probability of an up-move over the forecast horizon at signal time. */
  probUp: number
  confidence: number
  reasons: string[]
}

export interface Prediction {
  probUp: number
  score: number
  bias: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  horizon: number
  targetPrice: number
  forecast: { time: number; value: number; upper: number; lower: number }[]
  factors: { name: string; value: number; contribution: number; label: string }[]
  rsi: number
  atr: number
}

export interface BacktestStats {
  trades: number
  winRate: number
  totalReturnPct: number
  buyHoldPct: number
  maxDrawdownPct: number
  avgTradePct: number
  modelAccuracy: number
}

export interface StrategyResult {
  signals: Signal[]
  prediction: Prediction | null
  stats: BacktestStats
  emaFast: (number | null)[]
  emaSlow: (number | null)[]
  probSeries: (number | null)[]
}
