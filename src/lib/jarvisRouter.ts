import type { Candle } from './walkForwardValidator'

export interface Signal {
  source: 'analyst' | 'scanner' | 'orderflow'
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
}

export interface JarvisDecision {
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reason: string
}

export class JarvisRouter {
  constructor() {}

  /**
   * Generate a trading decision based on current candle and historical data.
   * Returns a decision with consensus voting (>= 2/3 signals must agree).
   */
  decide(currentCandle: Candle, history: Candle[]): JarvisDecision {
    // Default decision: HOLD with low confidence if no signals
    const signals: Signal[] = []

    // For Phase 1, we use simple heuristic signals based on price movement
    const signals_generated = this.generateSignals(currentCandle, history)
    signals.push(...signals_generated)

    // Consensus voting: >= 2/3 signals must agree
    return this.consensusVote(signals)
  }

  private generateSignals(
    currentCandle: Candle,
    history: Candle[]
  ): Signal[] {
    const signals: Signal[] = []

    // Simple technical signal: momentum-based
    if (history.length >= 2) {
      const prev = history[history.length - 2]
      const momentum = currentCandle.close - prev.close

      if (momentum > 1) {
        signals.push({
          source: 'analyst',
          action: 'BUY',
          confidence: 0.6,
        })
      } else if (momentum < -1) {
        signals.push({
          source: 'analyst',
          action: 'SELL',
          confidence: 0.6,
        })
      } else {
        signals.push({
          source: 'analyst',
          action: 'HOLD',
          confidence: 0.5,
        })
      }
    }

    // Scanner signal: volume-based (simplified)
    if (currentCandle.volume > 1200000) {
      signals.push({
        source: 'scanner',
        action: 'BUY',
        confidence: 0.4,
      })
    } else if (currentCandle.volume < 800000) {
      signals.push({
        source: 'scanner',
        action: 'SELL',
        confidence: 0.3,
      })
    } else {
      signals.push({
        source: 'scanner',
        action: 'HOLD',
        confidence: 0.5,
      })
    }

    return signals
  }

  private consensusVote(signals: Signal[]): JarvisDecision {
    if (signals.length === 0) {
      return {
        action: 'HOLD',
        confidence: 0.1,
        reason: 'No signals available',
      }
    }

    const votes: Record<string, number> = {
      BUY: 0,
      SELL: 0,
      HOLD: 0,
    }

    let totalConfidence: Record<string, number> = {
      BUY: 0,
      SELL: 0,
      HOLD: 0,
    }

    // Count votes and accumulate confidence
    for (const signal of signals) {
      votes[signal.action]++
      totalConfidence[signal.action] += signal.confidence
    }

    // Find action with most votes
    const maxVotes = Math.max(votes.BUY, votes.SELL, votes.HOLD)
    const consensusThreshold = signals.length >= 2 ? 2 : 1

    if (maxVotes < consensusThreshold) {
      return {
        action: 'HOLD',
        confidence: 0.2,
        reason: 'No consensus among signals',
      }
    }

    // Determine winning action
    let winningAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
    if (votes.BUY === maxVotes) {
      winningAction = 'BUY'
    } else if (votes.SELL === maxVotes) {
      winningAction = 'SELL'
    }

    const confidence = Math.min(
      maxVotes / signals.length,
      totalConfidence[winningAction] / maxVotes
    )

    return {
      action: winningAction,
      confidence,
      reason: `${maxVotes}/${signals.length} signals agree on ${winningAction}`,
    }
  }
}
