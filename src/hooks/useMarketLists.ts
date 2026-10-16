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
}

/** Market-wide top gainers, losers and volume, refreshed every minute while `enabled`. Never falls back to a fixed list. */
export function useMarketLists(enabled: boolean, alpacaKeys: AlpacaDataKeys): MarketListsState {
  const stocksNeedKey = !hasAlpacaData(alpacaKeys)
  const [state, setState] = useState<Omit<MarketListsState, 'stocksNeedKey'>>({
    crypto: null,
    stocks: null,
    cryptoError: null,
    stockError: null,
    updatedAt: null,
    loading: false,
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
      setState((s) => ({
        crypto: crypto.status === 'fulfilled' ? crypto.value : s.crypto,
        stocks: stocks.status === 'fulfilled' ? stocks.value : s.stocks,
        cryptoError: msg(crypto),
        stockError: msg(stocks),
        updatedAt: crypto.status === 'fulfilled' || (stocks.status === 'fulfilled' && stocks.value) ? Date.now() : s.updatedAt,
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
