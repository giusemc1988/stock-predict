/**
 * Local AI explain + Q&A + voice using llama3.2 on localhost.
 * Grounding: decision log (7 days) + active rules + risk gates.
 * Runs 100% in browser; no secrets, no cloud keys.
 */
import type { AiRules } from './aiRules'
import type { PickRow } from './practice'
import type { JournalEntry } from './journal'
import { askOllama } from './ollamaClient'

export interface GroundingPacket {
  prompt: string
  tokens: number
}

/**
 * Build a grounding packet for llama3.2: recent trades, active rules, risk gates.
 * Truncates to maxTokens; estimates 1 token ≈ 4 chars.
 */
export function buildGroundingPacket(
  journal: { trades: PickRow[]; events: JournalEntry[] },
  rules: AiRules,
  daysBack: number,
  maxTokens: number,
): GroundingPacket {
  const now = Date.now()
  const cutoff = now - daysBack * 86_400_000

  // Filter trades within date range
  const recentTrades = journal.trades.filter((t) => (t.at ?? 0) >= cutoff)

  let prompt = ''

  // Header
  prompt += `# Your Trading Data\n\n`

  // Recent trades
  if (recentTrades.length > 0) {
    prompt += `## Recent Trades (last ${daysBack} days)\n`
    for (const t of recentTrades) {
      const time = t.at ? new Date(t.at).toLocaleString() : '—'
      const gain = t.gainPct != null ? ` (${(t.gainPct * 100).toFixed(1)}%)` : ''
      prompt += `- ${time}: ${t.side} ${t.symbol} @ rank ${t.place}${gain}\n`
    }
    prompt += '\n'
  }

  // Active rules (simplified)
  prompt += `## Your Rules (Enabled)\n`
  prompt += `- RSI threshold: ${rules.rsiThreshold || 30}\n`
  prompt += `- Max trades/day: ${rules.maxTradesPerDay || 3}\n`
  prompt += `- Risk per trade: ${rules.riskPerTradePct || 2}%\n`
  prompt += `- Position cap: ${rules.positionCapPct || 25}%\n`
  prompt += '\n'

  // Risk gates
  prompt += `## Risk Gates\n`
  prompt += `- Max drawdown: ${rules.maxDrawdownPct || 10}%\n`
  prompt += `- Hard limits: ${rules.hardLimitsOn ? 'ON' : 'OFF'}\n`
  prompt += `- Data guard: ${rules.dataGuardOn ? 'ON' : 'OFF'} (max age: ${rules.maxDataAgeMin || 5} min)\n`
  prompt += '\n'

  // Instruction
  prompt += `## Your Task\n`
  prompt += `Explain the trade above using only the facts above. Cite the rule(s) that matched. Be brief (<500 tokens).\n`

  // Estimate tokens (rough: 1 token ≈ 4 chars)
  let tokens = Math.ceil(prompt.length / 4)

  // Truncate if needed
  if (tokens > maxTokens) {
    // Keep most recent trades, drop oldest
    const targetChars = maxTokens * 4
    prompt = prompt.substring(0, targetChars)
    tokens = maxTokens
  }

  return { prompt, tokens }
}

/**
 * Explain a trade signal using local llama3.2.
 * Returns explanation < 500 tokens, or null if localExplain is off or Ollama unavailable.
 */
export async function explainSignal(
  symbol: string,
  verdict: 'BUY' | 'SELL' | 'HOLD',
  journal: { trades: PickRow[]; events: JournalEntry[] },
  rules: AiRules,
  daysBack: number = 7,
  maxTokens: number = 2000,
): Promise<string | null> {
  // Skip if feature is disabled
  if (!rules.localExplain) {
    return null
  }

  // Build grounding packet
  const packet = buildGroundingPacket(journal, rules, daysBack, maxTokens)

  // Prepare the question for Ollama
  const question = `Explain why you made a ${verdict} signal for ${symbol}.
Use only the rules and facts above. Be brief (2-4 sentences).`

  // Call Ollama
  const response = await askOllama(
    {
      question,
      facts: packet.prompt.split('\n').filter((line) => line.trim().length > 0),
      lang: 'en',
    },
    90_000, // 90 second timeout
  )

  // Return text or null if Ollama failed
  return response?.text ?? null
}
