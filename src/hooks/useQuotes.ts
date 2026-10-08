import { useEffect, useRef, useState } from 'react'
import type { Instrument, Quote } from '../types'
import { demoHistory, demoPrice, demoSessionOpen, demoTick } from '../data/demo'
import type { ApiKeys } from '../data/providers'
import { binanceKlines, binanceStream, binanceTickers, finnhubQuote } from '../data/providers'

const mkQuote = (symbol: string, price: number, open: number, high: number, low: number, volume: number, spark: number[], live: boolean): Quote => ({
  symbol,
  price,
  change: price - open,
  changePct: open ? ((price - open) / open) * 100 : 0,
  high: Math.max(high, price),
  low: Math.min(low, price),
  volume,
  spark,
  live,
  updatedAt: Date.now(),
})

/** Watchlist quotes: Binance 24h tickers over WebSocket for crypto, Finnhub or the demo feed for stocks. */
export function useQuotes(instruments: Instrument[], keys: ApiKeys) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const demoSet = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    const cleanups: (() => void)[] = []
    const put = (q: Quote) => !cancelled && setQuotes((s) => ({ ...s, [q.symbol]: { ...q, spark: q.spark.length ? q.spark : s[q.symbol]?.spark ?? [] } }))
    const crypto = instruments.filter((i) => i.assetClass === 'crypto')
    const stocks = instruments.filter((i) => i.assetClass === 'stock')
    demoSet.current = new Set()

    const seedDemo = (list: Instrument[]) => {
      for (const i of list) {
        demoSet.current.add(i.symbol)
        const spark = demoHistory(i, '1h', 48).map((c) => c.close)
        put(mkQuote(i.symbol, demoPrice(i), demoSessionOpen(i), Math.max(...spark), Math.min(...spark), 1e6 * (1 + Math.random()), spark, false))
      }
    }

    // crypto
    ;(async () => {
      try {
        const tickers = await binanceTickers(crypto.map((c) => c.feedId))
        if (cancelled) return
        const sparks = await Promise.all(crypto.map((c) => binanceKlines(c.feedId, '1h', 48).then((k) => k.map((x) => x.close)).catch(() => [])))
        tickers.forEach((t) => {
          const inst = crypto.find((c) => c.feedId === t.symbol)!
          put(mkQuote(inst.symbol, t.last, t.open, t.high, t.low, t.volume, sparks[crypto.indexOf(inst)], true))
        })
        cleanups.push(
          binanceStream(
            crypto.map((c) => `${c.feedId.toLowerCase()}@miniTicker`),
            (d) => {
              const inst = crypto.find((c) => c.feedId === d.s)
              if (inst) put(mkQuote(inst.symbol, +d.c, +d.o, +d.h, +d.l, +d.q, [], true))
            },
            () => {},
          ),
        )
      } catch {
        seedDemo(crypto)
      }
    })()

    // stocks
    if (keys.finnhub) {
      const poll = async () => {
        for (const s of stocks) {
          try {
            const q = await finnhubQuote(s.feedId, keys.finnhub)
            put(mkQuote(s.symbol, q.last, q.open, q.high, q.low, 0, [], true))
          } catch {
            if (!demoSet.current.has(s.symbol)) seedDemo([s])
          }
        }
      }
      poll()
      const id = setInterval(poll, 15_000)
      cleanups.push(() => clearInterval(id))
    } else seedDemo(stocks)

    // one shared ticker drives every demo-fed symbol (the chart reads the same prices)
    const tick = setInterval(() => {
      for (const i of instruments) {
        if (!demoSet.current.has(i.symbol)) continue
        const p = demoTick(i)
        setQuotes((s) => {
          const prev = s[i.symbol]
          if (!prev) return s
          const spark = prev.spark.slice()
          spark[spark.length - 1] = p
          return { ...s, [i.symbol]: mkQuote(i.symbol, p, demoSessionOpen(i), prev.high, prev.low, prev.volume, spark, false) }
        })
      }
    }, 1000)
    cleanups.push(() => clearInterval(tick))

    return () => {
      cancelled = true
      cleanups.forEach((f) => f())
    }
  }, [instruments, keys.finnhub])

  return quotes
}
