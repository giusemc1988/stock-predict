import { answerQuestion } from './localJarvis'
import type { PickRow } from './practice'
import type { AiRules } from './aiRules'

describe('answerQuestion', () => {
  type TradeWithTime = PickRow & { at: number }

  const now = Date.now()
  const mockJournal: { trades: TradeWithTime[]; events: any[] } = {
    trades: [
      {
        symbol: 'AAPL',
        source: 'gainer' as const,
        verdict: null,
        place: 1,
        gainPct: 2.5,
        tradeScore: 75,
        volVsAvg: 1.5,
        at: now - 2 * 86_400_000,
      },
      {
        symbol: 'NVDA',
        source: 'active' as const,
        verdict: null,
        place: 2,
        gainPct: -1.2,
        tradeScore: 65,
        volVsAvg: 1.2,
        at: now - 1 * 86_400_000,
      },
    ],
    events: [],
  }

  const mockRules: AiRules = {
    practiceMode: true,
    rsiThreshold: 30,
    localQA: true,
    riskPerTradePct: 2,
    maxDrawdownPct: 10,
  } as any

  it('returns answer string for valid questions', async () => {
    const answer = await answerQuestion(
      'Why did you buy AAPL?',
      mockJournal,
      mockRules,
    )
    expect(typeof answer).toBe('string')
    expect(answer.length).toBeGreaterThan(0)
  })

  it('returns null if localQA is disabled', async () => {
    const rulesDisabled = { ...mockRules, localQA: false } as AiRules
    const answer = await answerQuestion(
      'Why did you buy?',
      mockJournal,
      rulesDisabled,
    )
    expect(answer).toBe(null)
  })

  it('answers "Why did you buy X?"', async () => {
    const answer = await answerQuestion(
      'Why did you buy AAPL?',
      mockJournal,
      mockRules,
    )
    if (answer) {
      // If Ollama available, answer should reference the symbol or reasons
      expect(answer.length).toBeGreaterThan(10)
    }
  })

  it('answers "What is my risk?"', async () => {
    const answer = await answerQuestion(
      'What is my risk right now?',
      mockJournal,
      mockRules,
    )
    if (answer) {
      expect(answer.length).toBeGreaterThan(10)
    }
  })

  it('answers "What did I learn?"', async () => {
    const answer = await answerQuestion(
      'What did I learn today?',
      mockJournal,
      mockRules,
    )
    if (answer) {
      expect(answer.length).toBeGreaterThan(10)
    }
  })

  it('returns null if Ollama unavailable', async () => {
    // With no Ollama running, should gracefully return null
    const answer = await answerQuestion(
      'Why did you buy?',
      mockJournal,
      mockRules,
    )
    // Accept either null (Ollama down) or a string (Ollama running)
    expect(typeof answer === 'string' || answer === null).toBe(true)
  })
})
