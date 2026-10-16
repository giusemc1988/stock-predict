import { buildGroundingPacket, type GroundingPacket } from './localJarvis'
import type { PickRow } from './practice'
import type { AiRules } from './aiRules'

describe('buildGroundingPacket', () => {
  // Extend PickRow with timestamp for testing
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
        at: Date.now() - 2 * 86_400_000, // 2 days ago
      },
      {
        symbol: 'NVDA',
        source: 'active' as const,
        verdict: null,
        place: 2,
        gainPct: -1.2,
        tradeScore: 65,
        volVsAvg: 1.2,
        at: Date.now() - 1 * 86_400_000, // 1 day ago
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

  it('includes recent trades and active rules, max 2000 tokens', () => {
    const packet = buildGroundingPacket(mockJournal, mockRules, 7, 2000)
    expect(packet.tokens).toBeLessThan(2000)
    expect(packet.prompt).toContain('AAPL')
    expect(packet.prompt).toContain('NVDA')
  })

  it('excludes trades older than daysBack', () => {
    const packet = buildGroundingPacket(mockJournal, mockRules, 1, 2000)
    // Should not include AAPL (2 days old when daysBack=1)
    expect(packet.prompt).not.toContain('AAPL')
    expect(packet.prompt).toContain('NVDA')
  })

  it('truncates old trades if exceeding token limit', () => {
    const manyTrades = {
      ...mockJournal,
      trades: Array(50)
        .fill(null)
        .map((_, i) => ({
          ...mockJournal.trades[0],
          symbol: `SYM${i}`,
          at: Date.now() - i * 3_600_000,
        })),
    }
    const packet = buildGroundingPacket(manyTrades, mockRules, 7, 500)
    expect(packet.tokens).toBeLessThan(500)
    // Most recent trades should be kept
    expect(packet.prompt).toContain('SYM0')
  })

  it('estimates tokens roughly (1 token ≈ 4 chars)', () => {
    const packet = buildGroundingPacket(mockJournal, mockRules, 7, 2000)
    const charCount = packet.prompt.length
    const estimatedTokens = Math.ceil(charCount / 4)
    // Allow some margin
    expect(packet.tokens).toBeLessThan(estimatedTokens + 50)
    expect(packet.tokens).toBeGreaterThan(estimatedTokens - 50)
  })
})
