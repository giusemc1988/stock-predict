import assert from 'node:assert/strict'
import { WalkForwardValidator, type Candle } from '../src/lib/walkForwardValidator'

// Generate synthetic OHLC data for testing
function generateSyntheticBars(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 3600,
    open: 100 + Math.random() * 10,
    high: 110 + Math.random() * 10,
    low: 90 + Math.random() * 10,
    close: 100 + Math.random() * 10,
    volume: 1000000,
  }))
}

// Test 1: splits data without lookahead bias using rolling windows
const candles = generateSyntheticBars(100)
const validator = new WalkForwardValidator()
const folds = validator.split({
  candles,
  trainSize: 60,
  testSize: 20,
  step: 20,
})

// Should have 2 folds: [0-59] train / [60-79] test, [20-79] train / [80-99] test
assert.equal(folds.length, 2)

// Fold 1: train [0-59], test [60-79]
const expectedTrain1 = Array.from({ length: 60 }, (_, i) => i)
const expectedTest1 = Array.from({ length: 20 }, (_, i) => 60 + i)
assert.deepEqual(folds[0].trainIdx, expectedTrain1)
assert.deepEqual(folds[0].testIdx, expectedTest1)

// Fold 2: train [20-79], test [80-99]
const expectedTrain2 = Array.from({ length: 60 }, (_, i) => 20 + i)
const expectedTest2 = Array.from({ length: 20 }, (_, i) => 80 + i)
assert.deepEqual(folds[1].trainIdx, expectedTrain2)
assert.deepEqual(folds[1].testIdx, expectedTest2)

// Verify no overlap between train and test in same fold
folds.forEach((fold, i) => {
  const trainSet = new Set(fold.trainIdx)
  fold.testIdx.forEach((idx) => {
    assert.equal(trainSet.has(idx), false, `Fold ${i}: train and test overlap at index ${idx}`)
  })
})

console.log('✓ Walk-forward validator tests passed')
