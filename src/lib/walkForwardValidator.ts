export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Fold {
  trainIdx: number[]
  testIdx: number[]
  trainCandles: Candle[]
  testCandles: Candle[]
}

export interface Signal {
  symbol: string
  timestamp: number
  side: 'BUY' | 'SELL' | 'HOLD'
  confidence: number // 0-1
  entry?: number
  stop?: number
  target?: number
}

export interface TradeResult {
  symbol: string
  entry: number
  exit: number
  timestamp: number
  side: 'BUY' | 'SELL'
  pnlPct: number
  won: boolean
  reason: string
}

export interface ValidationMetrics {
  totalSignals: number
  winCount: number
  lossCount: number
  winRate: number // 0-1
  avgWin: number // %
  avgLoss: number // %
  totalReturn: number // %
  sharpe: number
  vsSpy: number // difference in return %
  period: {
    from: number
    to: number
  }
}

export class WalkForwardValidator {
  split(options: {
    candles: Candle[]
    trainSize: number
    testSize: number
    step: number
  }): Fold[] {
    const { candles, trainSize, testSize, step } = options
    const folds: Fold[] = []

    for (let i = 0; i <= candles.length - trainSize - testSize; i += step) {
      const trainIdx = Array.from({ length: trainSize }, (_, j) => i + j)
      const testIdx = Array.from(
        { length: testSize },
        (_, j) => i + trainSize + j
      )

      const trainCandles = trainIdx.map((idx) => candles[idx])
      const testCandles = testIdx.map((idx) => candles[idx])

      folds.push({ trainIdx, testIdx, trainCandles, testCandles })
    }

    return folds
  }

  /**
   * Evaluate signals on test data and compute metrics
   */
  evaluate(options: {
    signals: Signal[]
    trades: TradeResult[]
    spyReturns: number[]
    testPeriod: { from: number; to: number }
  }): ValidationMetrics {
    const { signals, trades, spyReturns, testPeriod } = options

    // Filter trades to test period
    const testTrades = trades.filter(
      (t) => t.timestamp >= testPeriod.from && t.timestamp <= testPeriod.to
    )

    const winCount = testTrades.filter((t) => t.won).length
    const lossCount = testTrades.length - winCount
    const winRate = testTrades.length > 0 ? winCount / testTrades.length : 0

    // Calculate returns
    const wins = testTrades.filter((t) => t.won).map((t) => t.pnlPct)
    const losses = testTrades.filter((t) => !t.won).map((t) => t.pnlPct)

    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b) / wins.length : 0
    const avgLoss =
      losses.length > 0 ? losses.reduce((a, b) => a + b) / losses.length : 0

    const totalReturn = testTrades.reduce((sum, t) => sum + t.pnlPct, 0)

    // Calculate Sharpe (simplified)
    const returns = testTrades.map((t) => t.pnlPct)
    const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0
    const variance =
      returns.length > 0
        ? returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) /
          returns.length
        : 0
    const stdDev = Math.sqrt(variance)
    const sharpe = stdDev > 0 ? meanReturn / stdDev : 0

    // Compare vs SPY
    const spyReturn = spyReturns.reduce((a, b) => a + b, 0)
    const vsSpy = totalReturn - spyReturn

    return {
      totalSignals: signals.length,
      winCount,
      lossCount,
      winRate,
      avgWin,
      avgLoss,
      totalReturn,
      sharpe,
      vsSpy,
      period: testPeriod,
    }
  }

  /**
   * Check if validator proves an edge (beats SPY and win rate > 50%)
   */
  hasProvenEdge(metrics: ValidationMetrics): boolean {
    return metrics.winRate > 0.5 && metrics.vsSpy > 0
  }
}
