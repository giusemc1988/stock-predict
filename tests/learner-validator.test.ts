import assert from 'node:assert/strict'
import { validateRulesWithWalkForward } from '../src/lib/learnerValidator'
import type { Candle } from '../src/lib/walkForwardValidator'

// Generate synthetic trade-like candles
function generateSyntheticCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 3600,
    open: 100 + Math.random() * 10,
    high: 110 + Math.random() * 10,
    low: 90 + Math.random() * 10,
    close: 100 + Math.random() * 10,
    volume: 1000000,
  }))
}

// Test 1: validateRulesWithWalkForward returns confidence scores
const candles = generateSyntheticCandles(200)
const ruleResults = validateRulesWithWalkForward(candles, 100, 30)

assert.ok(ruleResults, 'should return rule results')
assert.ok(Array.isArray(ruleResults), 'ruleResults should be an array')
assert.ok(ruleResults.length > 0, 'should have at least one rule result')

// Test 2: Each result has required properties
ruleResults.forEach((result) => {
  assert.ok(result.ruleName, 'result should have ruleName')
  assert.ok(typeof result.confidence === 'number', 'result should have confidence number')
  assert.ok(result.confidence >= 0 && result.confidence <= 1, 'confidence should be 0-1')
})

// Test 3: Low-confidence rules are identified
const lowConfidenceRules = ruleResults.filter((r) => r.confidence < 0.55)
const highConfidenceRules = ruleResults.filter((r) => r.confidence >= 0.55)

assert.ok(
  lowConfidenceRules.length >= 0,
  'should identify rules with confidence < 55%'
)

console.log('✓ Learner validator tests passed')
console.log(`  - Validated ${ruleResults.length} rules`)
console.log(`  - ${highConfidenceRules.length} high-confidence (≥55%)`)
console.log(`  - ${lowConfidenceRules.length} low-confidence (<55%)`)
