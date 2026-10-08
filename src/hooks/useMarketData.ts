import { useEffect, useRef, useState } from 'react'
import type { Candle, FeedStatus, Instrument, Timeframe } from '../types'
import { tfSeconds } from '../types'
import { demoHistory, demoTick } from '../data/demo'
import type { ApiKeys } from '../data/providers'
import { alphaVantageCandles, binanceKlines, binanceStream, finnhubTrades } from '../data/providers'

export interface MarketData {
  candles: Candle[]
  status: FeedStatus
  source: string
  error: string | null
  /** Increments on every price change so consumers can cheaply react. */
  version: number
}

/** Merge a tick into the candle list, rolling a new bar when the bucket changes. */
function applyTick(list: Candle[], price: number, volume: number, unixSec: number, step: number): Candle[] {
  const bucket = unixSec - (unixSec % step)
  const last = list[list.length - 1]
  if (!last) return list
  if (bucket > last.time) {
    return [...list.slice(-1499), { time: bucket, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price, volume }]
  }
  const next = list.slice()
  next[next.length - 1] = { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price, volume: last.volume + volume }
  return next
}

export function useMarketData(inst: Instrument, tf: Timeframe, keys: ApiKeys): MarketData {
  const [state, setState] = useState<MarketData>({ candles: [], status: 'connecting', source: '', error: null, version: 0 })
  const keysRef = useRef(keys)
  keysRef.current = keys

  useEffect(() => {
    let cancelled = false
    const cleanups: (() => void)[] = []
    const step = tfSeconds(tf)
    const set = (patch: Partial<MarketData> | ((s: MarketData) => Partial<MarketData>)) =>
      !cancelled && setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch), version: s.version + 1 }))

    setState({ candles: [], status: 'connecting', source: '', error: null, version: 0 })

    const startDemo = (err: string | null) => {
      set({ candles: demoHistory(inst, tf), status: 'demo', source: 'Simulated feed', error: err })
      const id = setInterval(() => {
        set((s) => ({ candles: applyTick(s.candles, demoTick(inst), Math.random() * 20, Math.floor(Date.now() / 1000), step) }))
      }, 1000)
      cleanups.push(() => clearInterval(id))
    }

    const run = async () => {
      const k = keysRef.current
      try {
        if (inst.assetClass === 'crypto') {
          const candles = await binanceKlines(inst.feedId, tf)
          if (cancelled) return
          set({ candles, status: 'connecting', source: 'Binance', error: null })
          cleanups.push(
            binanceStream(
              [`${inst.feedId.toLowerCase()}@kline_${tf}`],
              (d) => {
                const kl = d.k
                if (!kl) return
                const c: Candle = { time: Math.floor(kl.t / 1000), open: +kl.o, high: +kl.h, low: +kl.l, close: +kl.c, volume: +kl.v }
                set((s) => {
                  const list = s.candles
                  const last = list[list.length - 1]
                  if (last && last.time === c.time) return { candles: [...list.slice(0, -1), c] }
                  if (!last || c.time > last.time) return { candles: [...list.slice(-1499), c] }
                  return {}
                })
              },
              (live) => set({ status: live ? 'live' : 'connecting' }),
            ),
          )
          return
        }
        // stocks
        if (k.alphaVantage) {
          const candles = await alphaVantageCandles(inst.feedId, tf, k.alphaVantage)
          if (cancelled) return
          set({ candles, status: 'polling', source: 'Alpha Vantage', error: null })
          const id = setInterval(async () => {
            try {
              const fresh = await alphaVantageCandles(inst.feedId, tf, keysRef.current.alphaVantage)
              set({ candles: fresh })
            } catch {
              /* keep last good data on rate limit */
            }
          }, 60_000)
          cleanups.push(() => clearInterval(id))
          if (k.finnhub) {
            cleanups.push(
              finnhubTrades(
                inst.feedId,
                k.finnhub,
                (p, v, t) => set((s) => ({ candles: applyTick(s.candles, p, v, Math.floor(t / 1000), step) })),
                (live) => set({ status: live ? 'live' : 'polling', source: live ? 'Alpha Vantage + Finnhub' : 'Alpha Vantage' }),
              ),
            )
          }
          return
        }
        startDemo(k.finnhub ? 'Add an Alpha Vantage key for stock history' : null)
      } catch (e) {
        if (!cancelled) startDemo(e instanceof Error ? e.message : String(e))
      }
    }
    run()
    return () => {
      cancelled = true
      cleanups.forEach((f) => f())
    }
  }, [inst, tf, keys.alphaVantage, keys.finnhub])

  return state
}
