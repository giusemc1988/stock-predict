import { useEffect, useState } from 'react'
import { alpacaMarketLists, binanceMarketLists, hasAlpacaData, type AlpacaDataKeys, type MarketLists } from '../data/providers'

const REFRESH_MS = 60_000

export interface MarketListsState {
  crypto: MarketLists | null
  stocks: MarketLists | null
  cryptoError: string | null
  stockError: string | null
  /** No Alpaca paper key, so there is no live market-wide stock list. */
  stocksNeedKey: boolean
  updatedAt: number | null
  loading: boolean
  /** Timestamp of last successful fetch; null if never fetched. Shows market-closed data as stale. */
  staledAt: number | null
}

const CACHE_KEY_CRYPTO = 'bluechip.marketlists.crypto'
const CACHE_KEY_STOCKS = 'bluechip.marketlists.stocks'

function loadCachedLists(key: string): { data: MarketLists; time: number } | null {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    return JSON.parse(cached)
  } catch {
    return null
  }
}

function saveCachedLists(key: string, data: MarketLists): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, time: Date.now() }))
  } catch {
    /* storage full */
  }
}

/** Market-wide top gainers, losers and volume, refreshed every minute while `enabled`. Falls back to cached data when market is closed. */
export function useMarketLists(enabled: boolean, alpacaKeys: AlpacaDataKeys): MarketListsState {
  const stocksNeedKey = !hasAlpacaData(alpacaKeys)
  const [state, setState] = useState<Omit<MarketListsState, 'stocksNeedKey'>>(() => {
    const cachedCrypto = loadCachedLists(CACHE_KEY_CRYPTO)
    const cachedStocks = loadCachedLists(CACHE_KEY_STOCKS)
    return {
      crypto: cachedCrypto?.data ?? null,
      stocks: cachedStocks?.data ?? null,
      cryptoError: null,
      stockError: null,
      updatedAt: cachedCrypto?.time ?? null,
      staledAt: cachedCrypto?.time ?? null,
      loading: false,
    }
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      setState((s) => ({ ...s, loading: true }))
      const [crypto, stocks] = await Promise.allSettled([
        binanceMarketLists(),
        stocksNeedKey ? Promise.resolve(null) : alpacaMarketLists(alpacaKeys),
      ])
      if (cancelled) return
      const msg = (r: PromiseSettledResult<unknown>) => (r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null)
      const newCrypto = crypto.status === 'fulfilled' ? crypto.value : null
      const newStocks = stocks.status === 'fulfilled' ? stocks.value : null
      if (newCrypto) saveCachedLists(CACHE_KEY_CRYPTO, newCrypto)
      if (newStocks) saveCachedLists(CACHE_KEY_STOCKS, newStocks)
      const now = Date.now()
      setState((s) => ({
        crypto: newCrypto ?? s.crypto,
        stocks: newStocks ?? s.stocks,
        cryptoError: msg(crypto),
        stockError: msg(stocks),
        updatedAt: newCrypto || newStocks ? now : s.updatedAt,
        staledAt: newCrypto || newStocks ? now : s.staledAt,
        loading: false,
      }))
    }
    void run()
    const id = setInterval(run, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, stocksNeedKey, alpacaKeys.keyId, alpacaKeys.secret])

  return { ...state, stocksNeedKey }
}
