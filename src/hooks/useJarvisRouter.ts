import { useState, useCallback, useMemo } from 'react'
import { JarvisRouter, type JarvisDecision } from '../lib/jarvisRouter'
import type { Candle } from '../lib/walkForwardValidator'

export interface UseJarvisRouterReturn {
  lastDecision: JarvisDecision | null
  isLoading: boolean
  onBarClose: (candle: Candle, history: Candle[]) => Promise<void>
}

/**
 * React hook for integrating Jarvis router into trading components.
 * Manages router state, last decision, and loading status.
 */
export function useJarvisRouter(enabled: boolean = false): UseJarvisRouterReturn {
  const [lastDecision, setLastDecision] = useState<JarvisDecision | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const router = useMemo(() => new JarvisRouter(), [])

  const onBarClose = useCallback(
    async (candle: Candle, history: Candle[]) => {
      if (!enabled) return

      setIsLoading(true)
      try {
        const decision = router.decide(candle, history)
        setLastDecision(decision)

        // Log decision for metrics collection (Phase 1 E2E test)
        if (typeof window !== 'undefined') {
          const metrics = (window as any).__jarvis_metrics__ || []
          metrics.push({
            timestamp: Date.now(),
            candle,
            decision,
          })
          ;(window as any).__jarvis_metrics__ = metrics
        }
      } catch (err) {
        console.error('Jarvis router failed:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [enabled, router]
  )

  return {
    lastDecision,
    isLoading,
    onBarClose,
  }
}
