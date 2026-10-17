import { useEffect, useRef } from 'react'
import type { ApiKeys } from '../data/providers'
import type { AlpacaKeys } from '../broker/alpaca'

/**
 * On first load, auto-migrate keys from localStorage to Cloudflare KV.
 * Runs once per session. Never overwrites cloud values that already exist.
 * Never logs key values.
 */
export function useMigrateKeysToCloud(keys: ApiKeys, alpacaKeys: AlpacaKeys) {
  const migrated = useRef(false)

  useEffect(() => {
    if (migrated.current) return

    const migrate = async () => {
      try {
        // Check which keys exist in the cloud
        const statusResp = await fetch('/api/data/key', { method: 'GET' })
        if (!statusResp.ok) return

        const status = (await statusResp.json()) as Record<string, boolean>

        // Migrate Alpaca paper key if it exists locally and not in cloud
        if (alpacaKeys.keyId && alpacaKeys.secret && !status.alpaca_paper) {
          await fetch('/api/data/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'alpaca_paper', keyId: alpacaKeys.keyId, secret: alpacaKeys.secret }),
          })
        }

        // Migrate Alpha Vantage key if it exists locally and not in cloud
        if (keys.alphaVantage && !status.alpha_vantage) {
          await fetch('/api/data/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'alpha_vantage', key: keys.alphaVantage }),
          })
        }

        // Migrate Finnhub key if it exists locally and not in cloud
        if (keys.finnhub && !status.finnhub) {
          await fetch('/api/data/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'finnhub', key: keys.finnhub }),
          })
        }
      } catch {
        // Silent fail: if migration fails, user can still manually save keys
      }

      migrated.current = true
    }

    migrate()
  }, [keys, alpacaKeys])
}
