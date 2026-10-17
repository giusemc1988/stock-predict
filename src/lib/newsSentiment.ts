/**
 * News sentiment analyzer: scores headlines to gauge if recent news is bullish or bearish.
 * Used by the news-sentiment playbook rule to test if positive news predicts next-day gains.
 */

export interface NewsSentimentResult {
  sentiment: number // -1 (very bearish) to +1 (very bullish); 0 = neutral
  count: number // number of headlines analyzed
  isPositive: boolean // true if sentiment >= 0.2
}

const POSITIVE_KEYWORDS = [
  'beat', 'beats', 'beating', 'surge', 'soar', 'spike', 'rally', 'jumps', 'jump', 'surge',
  'gains', 'profit', 'profitable', 'earnings', 'revenue', 'growth', 'upgrade', 'outperform',
  'strong', 'rises', 'rise', 'bulls', 'bullish', 'buy', 'breakout', 'recovery', 'recover',
  'win', 'wins', 'success', 'deal', 'partnership', 'acquisition', 'expansion', 'record',
  'boost', 'boosting', 'momentum', 'positive', 'approval', 'approval', 'ipo', 'debut',
]

const NEGATIVE_KEYWORDS = [
  'miss', 'misses', 'missed', 'crash', 'crashes', 'plunge', 'plunges', 'falls', 'fall',
  'loss', 'losses', 'decline', 'declines', 'down', 'downgrade', 'underperform', 'weak',
  'weakness', 'bearish', 'sell', 'selloff', 'downturn', 'recession', 'inflation', 'debt',
  'bankrupt', 'bankruptcy', 'lawsuit', 'recall', 'issue', 'issues', 'warning', 'warns',
  'risk', 'risks', 'concerns', 'concern', 'charges', 'fine', 'fines', 'cyber', 'breach',
  'restructure', 'layoffs', 'closure', 'close', 'shut', 'suspend', 'halt', 'delay',
]

function scoreHeadline(headline: string): number {
  const lower = headline.toLowerCase()

  let score = 0
  let matches = 0

  for (const word of POSITIVE_KEYWORDS) {
    if (lower.includes(word)) {
      score += 1
      matches++
    }
  }

  for (const word of NEGATIVE_KEYWORDS) {
    if (lower.includes(word)) {
      score -= 1
      matches++
    }
  }

  // If no keywords found, neutral
  if (matches === 0) return 0

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, score / Math.max(1, matches)))
}

/**
 * Analyze sentiment of recent news headlines.
 * @param headlines Array of news headlines from Alpaca News API
 * @returns Sentiment score and whether it's considered positive
 */
export function analyzeSentiment(headlines: string[]): NewsSentimentResult {
  if (!headlines || headlines.length === 0) {
    return { sentiment: 0, count: 0, isPositive: false }
  }

  const scores = headlines.map(scoreHeadline)
  const avgSentiment = scores.reduce((a, b) => a + b, 0) / scores.length

  return {
    sentiment: avgSentiment,
    count: headlines.length,
    isPositive: avgSentiment >= 0.2, // threshold: slightly positive
  }
}
