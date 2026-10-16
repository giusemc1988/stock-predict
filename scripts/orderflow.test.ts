import { estimateOrderFlow } from '../src/lib/orderflow'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (e) {
    console.error(`✗ ${name}`)
    console.error(`  ${(e as Error).message}`)
    failed++
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`)
      }
    },
    toBeGreaterThan(value: number) {
      if (typeof actual !== 'number' || actual <= value) {
        throw new Error(`Expected ${actual} to be > ${value}`)
      }
    },
  }
}

test('estimates buy volume when price closes higher than open', () => {
  const candles = [
    { open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  ]
  const result = estimateOrderFlow(candles, 104)
  expect(result.buyVolume).toBeGreaterThan(0)
  expect(result.sellVolume).toBe(0)
})

test('estimates sell volume when price closes lower than open', () => {
  const candles = [
    { open: 100, high: 105, low: 95, close: 96, volume: 1000 },
  ]
  const result = estimateOrderFlow(candles, 96)
  expect(result.sellVolume).toBeGreaterThan(0)
  expect(result.buyVolume).toBe(0)
})

test('splits volume when close equals open', () => {
  const candles = [
    { open: 100, high: 103, low: 97, close: 100, volume: 1000 },
  ]
  const result = estimateOrderFlow(candles, 100)
  const sum = result.buyVolume + result.sellVolume
  if (Math.abs(sum - 1000) > 0.01) {
    throw new Error(`Expected sum to be 1000, got ${sum}`)
  }
  expect(result.buyVolume).toBeGreaterThan(0)
  expect(result.sellVolume).toBeGreaterThan(0)
})

test('handles zero-volume candles', () => {
  const candles = [
    { open: 100, high: 100, low: 100, close: 100, volume: 0 },
  ]
  const result = estimateOrderFlow(candles, 100)
  expect(result.buyVolume).toBe(0)
  expect(result.sellVolume).toBe(0)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
