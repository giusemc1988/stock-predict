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

/** Hard catalyst words: a company event, not commentary. Record-only tag (shadowCatalyst), never gates a trade. */
const CATALYST_WORDS: [string, RegExp][] = [
  ['earnings', /\b(earnings|q[1-4] (results|revenue|eps)|quarterly results|guidance|outlook)\b/i],
  ['analyst', /\b(upgrade[sd]?|downgrade[sd]?|price target|raises? .*target|initiates?|reiterates?)\b/i],
  ['filing', /\b(8-k|sec filing|files? for|offering|buyback|repurchase)\b/i],
  ['deal', /\b(acquire[sd]?|acquisition|merger|buyout|takeover|partnership|contract|awarded)\b/i],
  ['fda', /\b(fda|phase [123]|trial|approval|clinical)\b/i],
]

export interface CatalystTag {
  /** A company-event headline (earnings, analyst, filing, deal, FDA) was published in the last 24h. */
  hard: boolean
  /** Which kind matched first (null when none). */
  kind: string | null
  /** Headlines published in the last 24h before the buy. */
  fresh: number
  /** Hours since the newest headline (null when there is none). */
  ageH: number | null
}

/** Tag the news seen at the buy. Pure, so it is easy to test. */
export function classifyCatalyst(items: { headline: string; created_at: string }[], nowMs: number): CatalystTag {
  const dated = items
    .map((n) => ({ h: n.headline ?? '', t: Date.parse(n.created_at) }))
    .filter((n) => Number.isFinite(n.t) && n.t <= nowMs + 60_000)
  const fresh = dated.filter((n) => nowMs - n.t <= 24 * 3600_000)
  let kind: string | null = null
  for (const [k, re] of CATALYST_WORDS) {
    if (fresh.some((n) => re.test(n.h))) { kind = k; break }
  }
  const newest = dated.length ? Math.max(...dated.map((n) => n.t)) : null
  return { hard: kind != null, kind, fresh: fresh.length, ageH: newest == null ? null : +((nowMs - newest) / 3600_000).toFixed(1) }
}
