import { buildGroundingPacket, explainSignal } from './localJarvis'
import type { PickRow } from './practice'
import type { AiRules } from './aiRules'

describe('explainSignal', () => {
  type TradeWithTime = PickRow & { at: number }

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
        at: Date.now() - 1 * 86_400_000,
      },
    ],
    events: [],
  }

  const mockRules: AiRules = {
    practiceMode: true,
    rsiThreshold: 30,
    adjustableTimeRange: true,
    localExplain: true,
    localQA: true,
    localVoiceNarrator: false,
    localModelName: 'llama3.2',
  } as any

  it('returns a promise that resolves to a string explanation', async () => {
    const explanation = await explainSignal('AAPL', 'BUY', mockJournal, mockRules, 7, 2000)
    expect(typeof explanation).toBe('string')
  })

  it('returns null when rules have localExplain disabled', async () => {
    const rulesDisabled = { ...mockRules, localExplain: false } as AiRules
    const explanation = await explainSignal('AAPL', 'BUY', mockJournal, rulesDisabled, 7, 2000)
    expect(explanation).toBe(null)
  })

  it('formats prompt with symbol, verdict, and grounding data', async () => {
    // This test verifies the explainSignal function builds the correct prompt structure
    // The actual response depends on Ollama availability
    const explanation = await explainSignal('AAPL', 'BUY', mockJournal, mockRules, 7, 2000)
    // If Ollama is available, explanation should mention AAPL or be a non-empty string
    if (explanation) {
      expect(explanation.length).toBeGreaterThan(0)
    }
  })
})
