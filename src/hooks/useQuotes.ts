import { useEffect, useRef, useState } from 'react'
import type { Instrument, Quote } from '../types'
import { demoHistory, demoPrice, demoSessionOpen, demoTick } from '../data/demo'
import type { AlpacaDataKeys, ApiKeys } from '../data/providers'
import { alpacaSnapshots, binanceKlines, binanceStream, binanceTickers, finnhubQuote, hasAlpacaData } from '../data/providers'

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

/** Watchlist quotes: Binance 24h tickers over WebSocket for crypto; Alpaca, Finnhub or the demo feed for stocks. */
export function useQuotes(instruments: Instrument[], keys: ApiKeys, alpaca: AlpacaDataKeys) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const demoSet = useRef(new Set<string>())
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes
  const useAlpaca = hasAlpacaData(alpaca)

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
    const finnhubPoll = async (list: Instrument[]) => {
      for (const s of list) {
        try {
          const q = await finnhubQuote(s.feedId, keys.finnhub)
          if (cancelled) return
          demoSet.current.delete(s.symbol)
          put(mkQuote(s.symbol, q.last, q.open, q.high, q.low, 0, [], true))
        } catch {
          if (cancelled) return
          if (!demoSet.current.has(s.symbol)) seedDemo([s])
        }
      }
    }
    // Alpaca had nothing for these: use Finnhub if configured, else keep the last real
    // price but stop calling it live, and simulate only symbols that never had one.
    const fallback = (list: Instrument[]) => {
      if (!list.length) return
      if (keys.finnhub) return finnhubPoll(list)
      const fresh = list.filter((s) => !demoSet.current.has(s.symbol))
      setQuotes((st) => {
        const next = { ...st }
        for (const s of fresh) if (next[s.symbol]?.live) next[s.symbol] = { ...next[s.symbol], live: false }
        return next
      })
      seedDemo(fresh.filter((s) => !quotesRef.current[s.symbol]))
    }
    if (useAlpaca && stocks.length) {
      let busy = false
      const poll = async () => {
        if (busy) return
        busy = true
        try {
          let snaps: Awaited<ReturnType<typeof alpacaSnapshots>> = {}
          try {
            snaps = await alpacaSnapshots(stocks.map((s) => s.feedId), alpaca)
          } catch {
            /* every symbol falls back below */
          }
          if (cancelled) return
          const missing: Instrument[] = []
          for (const s of stocks) {
            const q = snaps[s.feedId]
            if (!q) {
              missing.push(s)
              continue
            }
            demoSet.current.delete(s.symbol)
            put(mkQuote(s.symbol, q.last, q.open, q.high, q.low, q.volume, [], true))
          }
          await fallback(missing)
        } finally {
          busy = false
        }
      }
      poll()
      const id = setInterval(poll, 10_000)
      cleanups.push(() => clearInterval(id))
    } else if (keys.finnhub) {
      finnhubPoll(stocks)
      const id = setInterval(() => finnhubPoll(stocks), 15_000)
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
  }, [instruments, keys.finnhub, useAlpaca, alpaca.keyId, alpaca.secret])

  return quotes
}
