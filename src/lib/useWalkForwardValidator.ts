/**
 * React hook: validates trading signals on out-of-sample data using walk-forward technique.
 * Marks signals/trades as "Proven" only when they beat 50% win rate on unseen data.
 * Cost: 0 API, runs locally on practice journal history.
 */
import { useMemo } from 'react'
import { WalkForwardValidator, type Signal, type TradeResult, type ValidationMetrics } from './walkForwardValidator'
import type { PracticeTrade } from './practice'

export interface SignalValidation {
  /** Symbol that was traded */
  symbol: string
  /** Timestamp when signal was generated */
  timestamp: number
  /** True if signal passed 50%+ win rate validation on unseen data */
  proven: boolean
  /** Metrics from the fold this trade belonged to */
  metrics?: ValidationMetrics
}

export interface ValidatorResult {
  /** Which trades are marked "Proven" based on walk-forward validation */
  validSignals: Map<string, boolean> // key: symbol:timestamp, value: proven
  /** Metrics from all folds (for monitoring validator health) */
  foldMetrics: ValidationMetrics[]
  /** How many trades were available for validation */
  totalTrades: number
}

/**
 * Convert PracticeTrade to TradeResult for validator.
 * Assumes retPct is the P&L percentage.
 */
function tradeToResult(trade: PracticeTrade, side: 'BUY' | 'SELL' = 'BUY'): TradeResult {
  return {
    symbol: trade.symbol,
    entry: trade.entry,
    exit: trade.exit,
    timestamp: trade.openedAt,
    side,
    pnlPct: trade.retPct * 100, // convert to percentage
    won: trade.pnl > 0,
    reason: trade.info.reason || trade.exitReason,
  }
}

/**
 * Use walk-forward validator to mark signals as "Proven" only when they beat
 * 50%+ win rate on out-of-sample data.
 *
 * Runs a rolling window backtest:
 * - Window 1: train on trades 1-10, test on trades 11-20
 * - Window 2: train on trades 1-20, test on trades 21-30
 * - etc.
 */
export function useWalkForwardValidator(
  trades: PracticeTrade[],
  options: {
    trainSize?: number
    testSize?: number
    step?: number
    enabled?: boolean
  } = {}
): ValidatorResult {
  const { trainSize = 10, testSize = 10, step = 5, enabled = true } = options

  return useMemo(() => {
    const result: ValidatorResult = {
      validSignals: new Map(),
      foldMetrics: [],
      totalTrades: trades.length,
    }

    if (!enabled || trades.length < trainSize + testSize) {
      return result
    }

    // Convert trades to format validator expects
    const results = trades.map((t) => tradeToResult(t))

    // Create dummy signals (in real use, these come from the ranking/analyst)
    const signals: Signal[] = results.map((r) => ({
      symbol: r.symbol,
      timestamp: r.timestamp,
      side: r.side === 'BUY' ? 'BUY' : 'SELL',
      confidence: 0.5, // default confidence; real signals should have real confidence
      entry: r.entry,
    }))

    // SPY returns: simplified (use real SPY data in production)
    const spyReturns = Array(results.length).fill(0.001) // placeholder: assume 0.1% daily SPY return

    // Run walk-forward validation
    const validator = new WalkForwardValidator()
    const folds = validator.split({
      candles: [], // not used for validation; we only need trades
      trainSize,
      testSize,
      step,
    })

    // For each fold, evaluate which trades pass validation
    let foldIdx = 0
    for (let i = 0; i <= results.length - trainSize - testSize; i += step) {
      const testIdx = Array.from({ length: testSize }, (_, j) => i + trainSize + j)
      const testTrades = testIdx.map((idx) => results[idx])
      const testSignals = testIdx.map((idx) => signals[idx])

      // Get test period
      const testPeriod = {
        from: testTrades[0]?.timestamp ?? 0,
        to: testTrades[testTrades.length - 1]?.timestamp ?? 0,
      }

      // Evaluate this fold
      const metrics = validator.evaluate({
        signals: testSignals,
        trades: testTrades,
        spyReturns: spyReturns.slice(...testIdx),
        testPeriod,
      })

      result.foldMetrics.push(metrics)

      // Mark trades in this fold's test period as proven if they beat baseline
      const proven = validator.hasProvenEdge(metrics)
      testTrades.forEach((t) => {
        const key = `${t.symbol}:${t.timestamp}`
        result.validSignals.set(key, proven)
      })

      foldIdx++
    }

    return result
  }, [trades, trainSize, testSize, step, enabled])
}
