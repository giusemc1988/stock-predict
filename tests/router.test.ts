import assert from 'node:assert/strict'
import { JarvisRouter, type JarvisDecision } from '../src/lib/jarvisRouter'
import type { Candle } from '../src/lib/walkForwardValidator'

// Helper to generate synthetic candles
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

// Test 1: Router basic structure
const router = new JarvisRouter()
assert.ok(router, 'router should be instantiable')
assert.ok(typeof router.decide === 'function', 'router should have decide method')

// Test 2: Router returns decision with required fields
const candles = generateSyntheticCandles(100)
const decision = router.decide(candles[candles.length - 1], candles)

assert.ok(decision, 'router should return a decision')
assert.ok(decision.action, 'decision should have action property')
assert.ok(typeof decision.confidence === 'number', 'decision should have confidence property')
assert.ok(decision.reason, 'decision should have reason property')
assert.match(decision.action, /^(BUY|SELL|HOLD)$/, 'action should be BUY, SELL, or HOLD')
assert.ok(decision.confidence >= 0 && decision.confidence <= 1, 'confidence should be between 0 and 1')

// Test 3: Router consensus voting - single signal
const decision1 = router.decide(candles[candles.length - 1], candles)
assert.ok(['BUY', 'SELL', 'HOLD'].includes(decision1.action), 'decision action should be valid')

console.log('✓ Router tests passed')
