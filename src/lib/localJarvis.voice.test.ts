import { narrate, type VoiceSettings } from './localJarvis'

describe('narrate', () => {
  // Mock speechSynthesis API
  const mockSpeak = jest.fn()
  const mockCancel = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    if (typeof window !== 'undefined') {
      ;(window.speechSynthesis as any) = {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: () => [
          { name: 'Voice 1', lang: 'en-US' },
          { name: 'Voice 2', lang: 'en-US' },
        ],
      }
    }
  })

  it('reads text aloud using browser speechSynthesis', async () => {
    const text = 'You bought AAPL because RSI is below 30.'
    const settings: VoiceSettings = { rate: 1, pitch: 1, volume: 0.8 }

    narrate(text, settings)

    expect(mockSpeak).toHaveBeenCalled()
    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.text).toBe(text)
    expect(utterance.rate).toBe(1)
  })

  it('respects volume setting (0-1)', async () => {
    narrate('Test', { rate: 1, pitch: 1, volume: 0.5 })

    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.volume).toBe(0.5)
  })

  it('chunks long text (>1000 chars) to avoid cuts', async () => {
    const longText = 'a'.repeat(2000)
    narrate(longText, { rate: 1, pitch: 1, volume: 0.8 })

    // Should be called multiple times for chunks
    expect(mockSpeak.mock.calls.length).toBeGreaterThan(1)
  })

  it('cancels previous speech before starting new', async () => {
    narrate('Text 1', { rate: 1, pitch: 1, volume: 0.8 })
    narrate('Text 2', { rate: 1, pitch: 1, volume: 0.8 })

    // Should cancel before second speak
    expect(mockCancel).toHaveBeenCalled()
  })

  it('returns promise that resolves when speech ends', async () => {
    const text = 'You bought AAPL.'
    const promise = narrate(text, { rate: 1, pitch: 1, volume: 0.8 })

    expect(promise).toBeInstanceOf(Promise)

    // Simulate end of speech
    const utterance = mockSpeak.mock.calls[0][0]
    utterance.onend?.()

    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects promise on error', async () => {
    const promise = narrate('Test', { rate: 1, pitch: 1, volume: 0.8 })

    const utterance = mockSpeak.mock.calls[0][0]
    utterance.onerror?.({ error: 'synthesis-error' })

    await expect(promise).rejects.toThrow()
  })
})
