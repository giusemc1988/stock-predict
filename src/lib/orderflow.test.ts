import { estimateOrderFlow } from './orderflow'

describe('estimateOrderFlow', () => {
  it('estimates buy volume when price closes higher than open', () => {
    const candles = [
      { open: 100, high: 105, low: 99, close: 104, volume: 1000 },
    ]
    const result = estimateOrderFlow(candles, 104)
    expect(result.buyVolume).toBeGreaterThan(0)
    expect(result.sellVolume).toBe(0)
  })

  it('estimates sell volume when price closes lower than open', () => {
    const candles = [
      { open: 100, high: 105, low: 95, close: 96, volume: 1000 },
    ]
    const result = estimateOrderFlow(candles, 96)
    expect(result.sellVolume).toBeGreaterThan(0)
    expect(result.buyVolume).toBe(0)
  })

  it('splits volume when close equals open', () => {
    const candles = [
      { open: 100, high: 103, low: 97, close: 100, volume: 1000 },
    ]
    const result = estimateOrderFlow(candles, 100)
    expect(result.buyVolume + result.sellVolume).toBe(1000)
    expect(result.buyVolume).toBeGreaterThan(0)
    expect(result.sellVolume).toBeGreaterThan(0)
  })

  it('handles zero-volume candles', () => {
    const candles = [
      { open: 100, high: 100, low: 100, close: 100, volume: 0 },
    ]
    const result = estimateOrderFlow(candles, 100)
    expect(result.buyVolume).toBe(0)
    expect(result.sellVolume).toBe(0)
  })
})
