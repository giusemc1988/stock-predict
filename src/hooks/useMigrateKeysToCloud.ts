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
        if (!statusResp.ok) {
          console.warn('Migration: cannot check cloud status, KV may not be available')
          migrated.current = true
          return
        }

        const status = (await statusResp.json()) as Record<string, boolean>

        // Migrate Alpaca paper key if it exists locally and not in cloud
        if (alpacaKeys.keyId && alpacaKeys.secret && !status.alpaca_paper) {
          const res = await fetch('/api/data/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'alpaca_paper', keyId: alpacaKeys.keyId, secret: alpacaKeys.secret }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            console.warn('Migration: Alpaca paper key upload failed:', err)
          }
        }

        // Migrate Alpha Vantage key if it exists locally and not in cloud
        if (keys.alphaVantage && !status.alpha_vantage) {
          console.log('Migration: Found Alpha Vantage key in localStorage, attempting upload. Key length:', keys.alphaVantage.length)
          const res = await fetch('/api/data/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'alpha_vantage', key: keys.alphaVantage }),
          })
          if (res.ok) {
            console.log('Migration: Alpha Vantage key uploaded to cloud successfully')
          } else {
            const err = await res.json().catch(() => ({}))
            console.warn('Migration: Alpha Vantage key upload failed (HTTP', res.status, '):', err)
          }
        }

        // Migrate Finnhub key if it exists locally and not in cloud
        if (keys.finnhub && !status.finnhub) {
          const res = await fetch('/api/data/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'finnhub', key: keys.finnhub }),
          })
          if (res.ok) {
            console.log('Migration: Finnhub key uploaded to cloud')
          } else {
            const err = await res.json().catch(() => ({}))
            console.warn('Migration: Finnhub key upload failed:', err)
          }
        }
      } catch (e) {
        console.warn('Migration error:', e)
      }

      migrated.current = true
    }

    migrate()
  }, [keys, alpacaKeys])
}
