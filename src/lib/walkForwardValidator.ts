export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Fold {
  trainIdx: number[]
  testIdx: number[]
  trainCandles: Candle[]
  testCandles: Candle[]
}

export class WalkForwardValidator {
  split(options: {
    candles: Candle[]
    trainSize: number
    testSize: number
    step: number
  }): Fold[] {
    const { candles, trainSize, testSize, step } = options
    const folds: Fold[] = []

    for (let i = 0; i <= candles.length - trainSize - testSize; i += step) {
      const trainIdx = Array.from({ length: trainSize }, (_, j) => i + j)
      const testIdx = Array.from(
        { length: testSize },
        (_, j) => i + trainSize + j
      )

      const trainCandles = trainIdx.map((idx) => candles[idx])
      const testCandles = testIdx.map((idx) => candles[idx])

      folds.push({ trainIdx, testIdx, trainCandles, testCandles })
    }

    return folds
  }
}
