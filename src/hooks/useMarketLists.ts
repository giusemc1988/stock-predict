import { useEffect, useSyncExternalStore } from 'react'
import { binanceMarketLists, type AlpacaDataKeys, type MarketLists } from '../data/providers'

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

/** US regular session, New York time, weekdays (holidays not counted). */
export function usMarketOpen(now: number) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const o: Record<string, string> = {}
  for (const x of f.formatToParts(new Date(now))) o[x.type] = x.value
  const m = +o.hour * 60 + +o.minute
  return o.weekday !== 'Sat' && o.weekday !== 'Sun' && m >= 9 * 60 + 30 && m < 16 * 60
}

// One poller for the whole app: every screen that shows market lists shares the same fetch.
// It starts from the last session's lists saved in this browser, so a closed market never shows empty lists.
const cachedCrypto = typeof localStorage === 'undefined' ? null : loadCachedLists(CACHE_KEY_CRYPTO)
const cachedStocks = typeof localStorage === 'undefined' ? null : loadCachedLists(CACHE_KEY_STOCKS)
let state: Omit<MarketListsState, 'stocksNeedKey'> = {
  crypto: cachedCrypto?.data ?? null,
  stocks: cachedStocks?.data ?? null,
  cryptoError: null,
  stockError: null,
  updatedAt: cachedCrypto?.time ?? null,
  staledAt: cachedCrypto?.time ?? null,
  loading: false,
}
let keys: AlpacaDataKeys = { keyId: '', secret: '' }
let users = 0
let timer: ReturnType<typeof setInterval> | null = null
let stocksAt = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const set = (p: Partial<typeof state>) => {
  state = { ...state, ...p }
  emit()
}
const msg = (r: PromiseSettledResult<unknown>) => (r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null)

async function run(force = false) {
  // a hidden tab costs nothing: it refreshes when it is shown again
  if (typeof document !== 'undefined' && document.hidden && !force) return
  const k = keys
  // outside market hours stock lists don't change, so the last one is kept
  const stocksDue = !state.stocks || !stocksAt || usMarketOpen(Date.now()) || Date.now() - stocksAt > 6 * 3600_000
  set({ loading: true })
  const fetchStocks = stocksDue
    ? fetch('/api/market/stocks')
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json() as Promise<MarketLists>
        })
    : Promise.resolve(null)
  const [crypto, stocks] = await Promise.allSettled([binanceMarketLists(), fetchStocks])
  if (k !== keys) return
  const newCrypto = crypto.status === 'fulfilled' ? crypto.value : null
  const newStocks = stocks.status === 'fulfilled' ? stocks.value : null
  if (newCrypto) saveCachedLists(CACHE_KEY_CRYPTO, newCrypto)
  if (newStocks) {
    saveCachedLists(CACHE_KEY_STOCKS, newStocks)
    stocksAt = Date.now()
  }
  const now = Date.now()
  set({
    crypto: newCrypto ?? state.crypto,
    stocks: newStocks ?? state.stocks,
    cryptoError: msg(crypto),
    stockError: stocksDue ? msg(stocks) : state.stockError,
    updatedAt: newCrypto || newStocks ? now : state.updatedAt,
    staledAt: newCrypto || newStocks ? now : state.staledAt,
    loading: false,
  })
}

const onVisible = () => {
  if (!document.hidden && users > 0 && Date.now() - (state.updatedAt ?? 0) > REFRESH_MS) void run()
}

function start() {
  if (timer) return
  if (Date.now() - (state.updatedAt ?? 0) > REFRESH_MS || !stocksAt) void run(true)
  timer = setInterval(run, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisible)
}
function stop() {
  if (timer) clearInterval(timer)
  timer = null
  document.removeEventListener('visibilitychange', onVisible)
}

/** Market-wide top gainers, losers and volume, refreshed every minute while any screen needs them. Never falls back to a fixed list; shows the last session's lists while the market is closed. */
export function useMarketLists(enabled: boolean, alpacaKeys: AlpacaDataKeys): MarketListsState {
  const snap = useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
  useEffect(() => {
    if (!enabled) return
    if (keys.keyId !== alpacaKeys.keyId || keys.secret !== alpacaKeys.secret) {
      const first = !keys.keyId && !keys.secret
      keys = alpacaKeys
      stocksAt = 0
      // a new key means a new account: drop its old list, but keep the saved one on first load
      if (!first) state = { ...state, stocks: null, stockError: null }
      if (timer) void run(true)
    }
    users++
    start()
    return () => {
      if (--users === 0) stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, alpacaKeys.keyId, alpacaKeys.secret])
  // stocksNeedKey is true if we don't have stocks and the error indicates a missing key
  const stocksNeedKey = !snap.stocks && (snap.stockError?.includes('key') || snap.stockError?.includes('configured') || false)
  return { ...snap, stocksNeedKey }
}
