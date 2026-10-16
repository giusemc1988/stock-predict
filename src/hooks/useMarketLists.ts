import { useEffect, useSyncExternalStore } from 'react'
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

/** US regular session, New York time, weekdays (holidays not counted). */
export function usMarketOpen(now: number) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const o: Record<string, string> = {}
  for (const x of f.formatToParts(new Date(now))) o[x.type] = x.value
  const m = +o.hour * 60 + +o.minute
  return o.weekday !== 'Sat' && o.weekday !== 'Sun' && m >= 9 * 60 + 30 && m < 16 * 60
}

// One poller for the whole app: every screen that shows market lists shares the same fetch.
let state: Omit<MarketListsState, 'stocksNeedKey'> = { crypto: null, stocks: null, cryptoError: null, stockError: null, updatedAt: null, loading: false }
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
  const needKey = !hasAlpacaData(k)
  // outside market hours stock lists don't change, so the last one is kept
  const stocksDue = !needKey && (!state.stocks || usMarketOpen(Date.now()) || Date.now() - stocksAt > 6 * 3600_000)
  set({ loading: true })
  const [crypto, stocks] = await Promise.allSettled([binanceMarketLists(), stocksDue ? alpacaMarketLists(k) : Promise.resolve(null)])
  if (k !== keys) return
  if (stocksDue && stocks.status === 'fulfilled') stocksAt = Date.now()
  set({
    crypto: crypto.status === 'fulfilled' ? crypto.value : state.crypto,
    stocks: needKey ? null : stocks.status === 'fulfilled' && stocks.value ? stocks.value : state.stocks,
    cryptoError: msg(crypto),
    stockError: stocksDue ? msg(stocks) : state.stockError,
    updatedAt: crypto.status === 'fulfilled' || (stocks.status === 'fulfilled' && stocks.value) ? Date.now() : state.updatedAt,
    loading: false,
  })
}

const onVisible = () => {
  if (!document.hidden && users > 0 && Date.now() - (state.updatedAt ?? 0) > REFRESH_MS) void run()
}

function start() {
  if (timer) return
  if (Date.now() - (state.updatedAt ?? 0) > REFRESH_MS || (!state.stocks && hasAlpacaData(keys))) void run(true)
  timer = setInterval(run, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisible)
}
function stop() {
  if (timer) clearInterval(timer)
  timer = null
  document.removeEventListener('visibilitychange', onVisible)
}

/** Market-wide top gainers, losers and volume, refreshed every minute while any screen needs them. Never falls back to a fixed list. */
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
      keys = alpacaKeys
      stocksAt = 0
      state = { ...state, stocks: null, stockError: null }
      if (timer) void run(true)
    }
    users++
    start()
    return () => {
      if (--users === 0) stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, alpacaKeys.keyId, alpacaKeys.secret])
  return { ...snap, stocksNeedKey: !hasAlpacaData(alpacaKeys) }
}
