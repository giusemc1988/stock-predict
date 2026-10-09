/**
 * Extra backtest metrics and "too good to be true" checks, ported from the
 * CBT Framework's engine/metrics.py and lookahead-prevention guide (MIT,
 * Trade-With-Claude/cbt-framework). Educational only, not financial advice.
 */
import type { BacktestStats } from '../types'

export interface TradeMetrics {
  /** Gross wins / gross losses. Above 1 means winners outweigh losers. */
  profitFactor: number | null
  /** Average result per trade in percent: winRate * avgWin - lossRate * avgLoss. */
  expectancyPct: number
  /** Longest run of losing trades in a row. */
  maxLosingStreak: number
}

export function tradeMetrics(tradeRets: number[]): TradeMetrics {
  const wins = tradeRets.filter((r) => r > 0)
  const losses = tradeRets.filter((r) => r <= 0)
  const grossWin = wins.reduce((a, b) => a + b, 0)
  const grossLoss = -losses.reduce((a, b) => a + b, 0)
  const n = tradeRets.length
  const avgWin = wins.length ? grossWin / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const expectancy = n ? (wins.length / n) * avgWin - (losses.length / n) * avgLoss : 0
  let streak = 0
  let maxStreak = 0
  for (const r of tradeRets) {
    streak = r <= 0 ? streak + 1 : 0
    maxStreak = Math.max(maxStreak, streak)
  }
  return {
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : wins.length ? null : 0,
    expectancyPct: expectancy * 100,
    maxLosingStreak: maxStreak,
  }
}

/**
 * Red flags from the CBT look-ahead guide: results this good usually mean the test
 * peeked at the future or the sample is tiny, not that the strategy works.
 */
export function realityChecks(s: BacktestStats): string[] {
  const flags: string[] = []
  if (s.trades > 0 && s.trades < 30) flags.push(`Only ${s.trades} trades: too few to tell skill from luck.`)
  if (s.trades >= 10 && s.winRate > 0.7) flags.push(`A ${Math.round(s.winRate * 100)}% win rate is unusually high. Real strategies rarely hold that.`)
  if (s.trades >= 10 && s.profitFactor != null && s.profitFactor > 3) flags.push(`A profit factor of ${s.profitFactor.toFixed(1)} is suspiciously good for this little data.`)
  if (s.trades > 0 && s.totalReturnPct < s.buyHoldPct) flags.push('Just holding beat the robot on this chart.')
  return flags
}
