/**
 * Backtest walk-forward validator against practice history.
 * Shows which signals pass the "Proven" test (50%+ win rate on unseen data).
 *
 * Usage:
 *   npm run ts scripts/backtest-walk-forward.ts
 */
import { readFileSync } from 'node:fs'
import { WalkForwardValidator, type TradeResult } from '../src/lib/walkForwardValidator'
import { parsePractice, type PracticeTrade } from '../src/lib/practice'

/** Convert practice trade to TradeResult for validator. */
function practiceToTradeResult(trade: PracticeTrade, side: 'BUY' | 'SELL' = 'BUY'): TradeResult {
  return {
    symbol: trade.symbol,
    entry: trade.entry,
    exit: trade.exit,
    timestamp: trade.openedAt,
    side,
    pnlPct: trade.retPct, // already in percentage from practice.json
    won: trade.pnl > 0,
    reason: trade.info.reason || trade.exitReason,
  }
}

async function main() {
  // Load practice state
  const file = 'public/practice.json'
  const raw = readFileSync(file, 'utf-8')
  const state = parsePractice(JSON.parse(raw))

  if (!state || !state.trades.length) {
    console.error('No trades found in', file)
    process.exit(1)
  }

  console.log(`\n📊 Walk-Forward Validator Backtest`)
  console.log(`=====================================`)
  console.log(`Loaded ${state.trades.length} closed trades from practice.json`)

  // Convert trades to TradeResult format
  const trades = state.trades.map((t) => practiceToTradeResult(t))

  // Sort by timestamp
  trades.sort((a, b) => a.timestamp - b.timestamp)

  // Generate simple signals (in real use, these come from ranking/analyst)
  const signals = trades.map((t) => ({
    symbol: t.symbol,
    timestamp: t.timestamp,
    side: t.side,
    confidence: 0.5,
    entry: t.entry,
  }))

  // Placeholder SPY returns (0.1% daily)
  const spyReturns = Array(trades.length).fill(0.001)

  // Run walk-forward validation with different window sizes
  const validator = new WalkForwardValidator()
  const windowSizes = [
    { name: 'small (5/5)', train: 5, test: 5, step: 3 },
    { name: 'medium (10/10)', train: 10, test: 10, step: 5 },
    { name: 'large (20/20)', train: 20, test: 20, step: 10 },
  ]

  for (const config of windowSizes) {
    console.log(`\n🔍 Testing with ${config.name} trades...`)

    if (trades.length < config.train + config.test) {
      console.log(`  ⚠️  Not enough trades (need ${config.train + config.test}, have ${trades.length})`)
      continue
    }

    const folds = validator.split({
      candles: [], // Not used; we only validate trades
      trainSize: config.train,
      testSize: config.test,
      step: config.step,
    })

    let totalTestTrades = 0
    let provenFolds = 0
    const allMetrics = []

    // Run each fold
    for (let i = 0; i <= trades.length - config.train - config.test; i += config.step) {
      const testIdx = Array.from({ length: config.test }, (_, j) => i + config.train + j)
      const testTrades = testIdx.map((idx) => trades[idx])
      const testSignals = testIdx.map((idx) => signals[idx])

      const testPeriod = {
        from: testTrades[0]?.timestamp ?? 0,
        to: testTrades[testTrades.length - 1]?.timestamp ?? 0,
      }

      const metrics = validator.evaluate({
        signals: testSignals,
        trades: testTrades,
        spyReturns: spyReturns.slice(...testIdx),
        testPeriod,
      })

      const proven = validator.hasProvenEdge(metrics)
      if (proven) provenFolds++
      totalTestTrades += testTrades.length
      allMetrics.push(metrics)
    }

    // A signal is "Proven" only if the strategy beats baseline in >50% of folds
    const totalProvenTrades = provenFolds > allMetrics.length * 0.5 ? totalTestTrades : 0

    // Report results
    const avgWinRate = (allMetrics.reduce((sum, m) => sum + m.winRate, 0) / allMetrics.length * 100).toFixed(1)
    // totalReturn is sum of all trades in a test window; divide by test count for per-trade avg
    const perTradeAvgReturn = (allMetrics.reduce((sum, m) => sum + m.totalReturn, 0) / totalTestTrades).toFixed(2)
    const summedReturn = (allMetrics.reduce((sum, m) => sum + m.totalReturn, 0)).toFixed(2)
    const avgSharpe = (allMetrics.reduce((sum, m) => sum + m.sharpe, 0) / allMetrics.length).toFixed(2)
    const avgVsSpy = (allMetrics.reduce((sum, m) => sum + m.vsSpy, 0) / allMetrics.length).toFixed(2)

    console.log(`  ✅ Folds with proven edge (>50% winRate): ${provenFolds}/${allMetrics.length}`)
    console.log(`  📈 Avg win rate (across all folds): ${avgWinRate}%`)
    console.log(`  💰 Avg return per trade: ${perTradeAvgReturn}%`)
    console.log(`  💰 Summed return (all test trades): ${summedReturn}%`)
    console.log(`  📊 Avg Sharpe: ${avgSharpe}`)
    console.log(`  🆚 vs SPY (avg per fold): ${avgVsSpy}%`)
    console.log(`  ✔️  Trades from proven folds: ${totalProvenTrades}/${totalTestTrades}`)
  }

  console.log(`\n✨ Backtest complete`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
