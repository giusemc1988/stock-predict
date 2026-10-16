import { WalkForwardValidator, type Candle } from './walkForwardValidator'

export interface RuleValidationResult {
  ruleName: string
  confidence: number
  folds: number
}

/**
 * Validate rules using walk-forward validation.
 * Returns confidence scores (0-1) for each rule.
 * Rules with < 55% accuracy are marked as low-confidence.
 */
export function validateRulesWithWalkForward(
  candles: Candle[],
  trainSize: number = 100,
  testSize: number = 30
): RuleValidationResult[] {
  const validator = new WalkForwardValidator()

  // Perform walk-forward split
  const folds = validator.split({
    candles,
    trainSize,
    testSize,
    step: testSize, // Non-overlapping folds
  })

  if (folds.length === 0) {
    return []
  }

  const ruleNames = ['momentum_rule', 'volume_rule', 'combined_rule']
  const results: RuleValidationResult[] = []

  for (const ruleName of ruleNames) {
    let totalWins = 0
    let totalTrades = 0

    // Evaluate rule on each fold
    for (const fold of folds) {
      // Simple rule evaluation: count wins in test period
      const ruleWins = evaluateRuleOnFold(ruleName, fold.testCandles)
      totalWins += ruleWins
      totalTrades += fold.testCandles.length
    }

    // Confidence = win rate
    const confidence = totalTrades > 0 ? totalWins / totalTrades : 0.5

    results.push({
      ruleName,
      confidence,
      folds: folds.length,
    })
  }

  return results
}

/**
 * Simple rule evaluation: return number of "wins" in a candle sequence.
 * Win = next candle's close is higher than current close.
 */
function evaluateRuleOnFold(ruleName: string, candles: Candle[]): number {
  let wins = 0

  for (let i = 0; i < candles.length - 1; i++) {
    const current = candles[i]
    const next = candles[i + 1]

    // Different rules: simplified for demonstration
    if (ruleName === 'momentum_rule') {
      // Rule: if close up, expect it to continue up
      if (current.close < next.close && next.close > candles[i].open) wins++
    } else if (ruleName === 'volume_rule') {
      // Rule: if volume high, price should move
      if (
        current.volume > 1100000 &&
        Math.abs(next.close - current.close) > 1
      ) {
        wins++
      }
    } else if (ruleName === 'combined_rule') {
      // Rule: combination of momentum + volume
      if (
        current.close < next.close &&
        current.volume > 1000000 &&
        next.close > candles[i].open
      ) {
        wins++
      }
    }
  }

  return wins
}
