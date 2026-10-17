/**
 * Compare 2-month vs 6-month history windows for learning.
 * Shows which window gives better out-of-sample performance.
 */
import { readFileSync } from 'node:fs'
import { WalkForwardValidator, type TradeResult } from '../src/lib/walkForwardValidator'
import { parsePractice, type PracticeTrade } from '../src/lib/practice'

function practiceToTradeResult(trade: PracticeTrade): TradeResult {
  return {
    symbol: trade.symbol,
    entry: trade.entry,
    exit: trade.exit,
    timestamp: trade.closedAt,
    side: 'BUY',
    pnlPct: trade.retPct,
    won: trade.pnl > 0,
    reason: trade.exitReason,
  }
}

async function main() {
  const file = 'public/practice.json'
  const raw = readFileSync(file, 'utf-8')
  const state = parsePractice(JSON.parse(raw))

  if (!state || !state.trades.length) {
    console.error('No trades found in', file)
    process.exit(1)
  }

  const now = Date.now()
  const trades = state.trades
    .map((t) => practiceToTradeResult(t))
    .sort((a, b) => a.timestamp - b.timestamp)

  // Filter to last N months
  const filterByMonths = (months: number) => {
    const cutoff = now - months * 30 * 24 * 60 * 60 * 1000
    return trades.filter((t) => t.timestamp >= cutoff)
  }

  const trades6m = filterByMonths(6)
  const trades2m = filterByMonths(2)

  console.log(`\n📊 History Window Comparison`)
  console.log(`====================================`)
  console.log(`Total trades: ${trades.length}`)
  console.log(`Last 6 months: ${trades6m.length} trades`)
  console.log(`Last 2 months: ${trades2m.length} trades`)

  if (trades6m.length < 20 || trades2m.length < 10) {
    console.error('Not enough trades to compare')
    process.exit(1)
  }

  const validator = new WalkForwardValidator()

  // Run walk-forward on 6-month window
  console.log(`\n📈 6-Month Window (Current):`)
  const folds6m = validator.split({
    candles: [],
    trainSize: 15,
    testSize: 5,
    step: 3,
  })

  let provenFolds6m = 0
  let totalFolds6m = 0
  let provenTrades6m = 0
  let totalTrades6m = 0

  for (let i = 0; i <= trades6m.length - 15 - 5; i += 3) {
    const testIdx = Array.from({ length: 5 }, (_, j) => i + 15 + j)
    const testTrades = testIdx.map((idx) => trades6m[idx])

    if (testTrades.length === 0) continue
    totalFolds6m++
    totalTrades6m += testTrades.length

    const winCount = testTrades.filter((t) => t.won).length
    const winRate = winCount / testTrades.length

    console.log(`  Fold: ${(winRate * 100).toFixed(0)}% (${winCount}/${testTrades.length})`)

    if (winRate >= 0.5) provenFolds6m++
    provenTrades6m += winRate >= 0.5 ? testTrades.length : 0
  }

  const sixMonthProvenPct = provenFolds6m / totalFolds6m
  console.log(
    `\n  6-month summary: ${(sixMonthProvenPct * 100).toFixed(0)}% proven folds (${provenFolds6m}/${totalFolds6m})`
  )
  console.log(`  Proven trades: ${provenTrades6m}/${totalTrades6m}`)

  // Run walk-forward on 2-month window
  console.log(`\n📈 2-Month Window (Test):`)
  const folds2m = validator.split({
    candles: [],
    trainSize: 8,
    testSize: 3,
    step: 2,
  })

  let provenFolds2m = 0
  let totalFolds2m = 0
  let provenTrades2m = 0
  let totalTrades2m = 0

  for (let i = 0; i <= trades2m.length - 8 - 3; i += 2) {
    const testIdx = Array.from({ length: 3 }, (_, j) => i + 8 + j)
    const testTrades = testIdx.map((idx) => trades2m[idx])

    if (testTrades.length === 0) continue
    totalFolds2m++
    totalTrades2m += testTrades.length

    const winCount = testTrades.filter((t) => t.won).length
    const winRate = winCount / testTrades.length

    console.log(`  Fold: ${(winRate * 100).toFixed(0)}% (${winCount}/${testTrades.length})`)

    if (winRate >= 0.5) provenFolds2m++
    provenTrades2m += winRate >= 0.5 ? testTrades.length : 0
  }

  const twoMonthProvenPct = provenFolds2m / totalFolds2m
  console.log(`\n  2-month summary: ${(twoMonthProvenPct * 100).toFixed(0)}% proven folds (${provenFolds2m}/${totalFolds2m})`)
  console.log(`  Proven trades: ${provenTrades2m}/${totalTrades2m}`)

  // Comparison
  console.log(`\n🔄 Comparison:`)
  console.log(`  6-month: ${(sixMonthProvenPct * 100).toFixed(0)}% proven folds`)
  console.log(`  2-month: ${(twoMonthProvenPct * 100).toFixed(0)}% proven folds`)

  if (twoMonthProvenPct > sixMonthProvenPct) {
    console.log(`\n✅ 2-month window is BETTER (+${((twoMonthProvenPct - sixMonthProvenPct) * 100).toFixed(0)}%)`)
  } else if (twoMonthProvenPct < sixMonthProvenPct) {
    console.log(`\n❌ 2-month window is WORSE (-${((sixMonthProvenPct - twoMonthProvenPct) * 100).toFixed(0)}%)`)
  } else {
    console.log(`\n➖ Both windows are equal`)
  }
}

main().catch(console.error)
