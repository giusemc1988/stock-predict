import { useEffect, useRef } from 'react'
import type { AlpacaKeys } from '../broker/alpaca'
import type { ApiKeys } from '../data/providers'

/**
 * On first load, try to load keys from Cloudflare KV (cloud storage).
 * Only runs once per session. If cloud has keys, populate local state with them.
 * This ensures that if localStorage is empty but KV has keys (from a previous session),
 * the app can still work with those cloud-stored keys.
 */
export function useLoadKeysFromCloud(
  setKeys: (keys: ApiKeys | ((prev: ApiKeys) => ApiKeys)) => void,
  setAlpacaKeys: (keys: AlpacaKeys | ((prev: AlpacaKeys) => AlpacaKeys)) => void,
) {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return

    const load = async () => {
      try {
        const res = await fetch('/api/data/keys', { method: 'POST' })
        if (!res.ok) return

        const data = (await res.json()) as {
          kv_available?: boolean
          alpaca_paper?: { keyId: string; secret: string } | null
          alpha_vantage?: string | null
          finnhub?: string | null
          telegram?: string | null
        }

        if (!data.kv_available) return

        // Load Alpaca keys if they exist in cloud
        if (data.alpaca_paper?.keyId && data.alpaca_paper?.secret) {
          setAlpacaKeys(data.alpaca_paper)
        }

        // Load data provider keys if they exist in cloud
        const updates: Partial<ApiKeys> = {}
        if (data.alpha_vantage) updates.alphaVantage = data.alpha_vantage
        if (data.finnhub) updates.finnhub = data.finnhub

        if (Object.keys(updates).length > 0) {
          setKeys((prev) => ({ ...prev, ...updates }))
        }
      } catch {
        /* silent fail: if loading fails, user can still manually enter keys */
      }

      loaded.current = true
    }

    load()
  }, [setKeys, setAlpacaKeys])
}
