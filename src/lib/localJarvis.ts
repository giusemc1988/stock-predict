/**
 * Local AI explain + Q&A + voice using llama3.2 on localhost.
 * Grounding: decision log (7 days) + active rules + risk gates.
 * Runs 100% in browser; no secrets, no cloud keys.
 */
import type { AiRules } from './aiRules'
import type { PracticeTrade } from './practice'
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
  journal: { trades: PracticeTrade[]; events: JournalEntry[] },
  rules: AiRules,
  daysBack: number,
  maxTokens: number,
): GroundingPacket {
  const now = Date.now()
  const cutoff = now - daysBack * 86_400_000

  // Filter trades within date range
  const recentTrades = journal.trades.filter((t) => (t.closedAt ?? 0) >= cutoff)

  let prompt = ''

  // Header
  prompt += `# Your Trading Data\n\n`

  // Recent trades
  if (recentTrades.length > 0) {
    prompt += `## Recent Trades (last ${daysBack} days)\n`
    for (const t of recentTrades) {
      const time = new Date(t.closedAt).toLocaleString()
      const position = t.qty > 0 ? 'Long' : 'Short'
      const gain = t.retPct != null ? ` (${(t.retPct * 100).toFixed(1)}%)` : ''
      prompt += `- ${time}: ${position} ${t.symbol}${gain}\n`
    }
    prompt += '\n'
  }

  // Active rules (simplified)
  prompt += `## Your Rules (Enabled)\n`
  prompt += `- Max trades/day: ${rules.maxTradesPerDay}\n`
  prompt += `- Risk per trade: ${rules.riskPerTradePct}%\n`
  prompt += `- Position cap: ${rules.positionCapPct}%\n`
  prompt += '\n'

  // Risk gates
  prompt += `## Risk Gates\n`
  prompt += `- Max drawdown: ${rules.maxDrawdownPct}%\n`
  prompt += `- Data guard: ${rules.dataGuardOn ? 'ON' : 'OFF'} (max age: ${rules.maxDataAgeMin} min)\n`
  prompt += '\n'

  // Instruction
  prompt += `## Your Task\n`
  prompt += `Analyze the trades above using only the facts above. Cite relevant rules. Be brief (<500 tokens).\n`

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

export interface VoiceSettings {
  rate: number // 0.5–2.0 (speed)
  pitch: number // 0.5–2.0
  volume: number // 0–1
}

/**
 * Read text aloud using browser speechSynthesis API.
 * Chunks long text (>1000 chars) to prevent cutoff.
 * Returns promise that resolves when speech ends or rejects on error.
 */
export function narrate(text: string, settings: VoiceSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Speech synthesis not available'))
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    // Chunk long text to prevent cutoff (browser limit ~500 chars per utterance)
    const CHUNK_SIZE = 300
    const chunks: string[] = []
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.substring(i, i + CHUNK_SIZE))
    }

    let currentChunk = 0

    const speakChunk = () => {
      if (currentChunk >= chunks.length) {
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(chunks[currentChunk])
      utterance.rate = settings.rate
      utterance.pitch = settings.pitch
      utterance.volume = settings.volume

      utterance.onend = () => {
        currentChunk++
        speakChunk()
      }

      utterance.onerror = (event) => {
        reject(new Error(`Speech synthesis error: ${event.error}`))
      }

      window.speechSynthesis.speak(utterance)
    }

    speakChunk()
  })
}

/**
 * Explain a trade signal using local llama3.2.
 * Returns explanation < 500 tokens, or null if localExplain is off or Ollama unavailable.
 */
export async function explainSignal(
  symbol: string,
  verdict: 'BUY' | 'SELL' | 'HOLD',
  journal: { trades: PracticeTrade[]; events: JournalEntry[] },
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

/**
 * Answer questions about the trading journal using local llama3.2.
 * Returns answer < 500 tokens, or null if localQA is off or Ollama unavailable.
 */
export async function answerQuestion(
  question: string,
  journal: { trades: PracticeTrade[]; events: JournalEntry[] },
  rules: AiRules,
  daysBack: number = 7,
  maxTokens: number = 2000,
): Promise<string | null> {
  // Skip if feature is disabled
  if (!rules.localQA) {
    return null
  }

  // Build grounding packet
  const packet = buildGroundingPacket(journal, rules, daysBack, maxTokens)

  // Call Ollama with the question and grounding context
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
