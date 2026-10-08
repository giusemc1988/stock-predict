/**
 * Live order flow for the active symbol:
 *  - crypto: Binance order book (top 20, 100 ms) + aggregated trades, where the
 *    exchange reports which side was the aggressor, so buy/sell volume is real.
 *  - stocks with a Finnhub key: real trades, sides inferred with the tick rule
 *    (no free order book for US stocks).
 *  - otherwise: a simulated book and tape, clearly marked.
 */
import { useEffect, useState } from 'react'
import type { BookLevel, Instrument, OrderFlow, TapeTrade } from '../types'
import { demoPrice } from '../data/demo'
import type { ApiKeys } from '../data/providers'
import { binanceDepth, binanceRecentTrades, binanceStream, finnhubTrades } from '../data/providers'

const WINDOW_SEC = 300
const TAPE = 60

const empty = (source: string): OrderFlow => ({
  bids: [],
  asks: [],
  trades: [],
  buyVolume: 0,
  sellVolume: 0,
  windowSec: WINDOW_SEC,
  hasBook: false,
  estimated: false,
  source,
  live: false,
})

export function useOrderFlow(inst: Instrument, keys: ApiKeys): OrderFlow {
  const [flow, setFlow] = useState<OrderFlow>(() => empty('Connecting'))

  useEffect(() => {
    let cancelled = false
    const cleanups: (() => void)[] = []
    // trades are buffered and flushed a few times a second so busy markets stay smooth
    let recent: TapeTrade[] = []
    let book: { bids: BookLevel[]; asks: BookLevel[] } = { bids: [], asks: [] }
    let meta: Pick<OrderFlow, 'hasBook' | 'estimated' | 'source' | 'live'> = { hasBook: false, estimated: false, source: 'Connecting', live: false }
    let dirty = true
    const addTrades = (ts: TapeTrade[]) => {
      recent.push(...ts)
      dirty = true
    }
    const flush = () => {
      if (cancelled || !dirty) return
      dirty = false
      const cutoff = Date.now() - WINDOW_SEC * 1000
      recent = recent.filter((t) => t.time >= cutoff)
      let buy = 0
      let sell = 0
      for (const t of recent) t.side === 'buy' ? (buy += t.size) : (sell += t.size)
      setFlow({ ...meta, bids: book.bids, asks: book.asks, trades: recent.slice(-TAPE).reverse(), buyVolume: buy, sellVolume: sell, windowSec: WINDOW_SEC })
    }
    const timer = setInterval(() => {
      dirty = true
      flush()
    }, 400)
    cleanups.push(() => clearInterval(timer))
    setFlow(empty('Connecting'))

    const startDemo = (reason: string) => {
      meta = { hasBook: true, estimated: true, source: reason, live: false }
      let seq = 0
      const id = setInterval(() => {
        const mid = demoPrice(inst)
        const tick = mid * 0.0002
        const lvl = (side: 1 | -1) =>
          Array.from({ length: 20 }, (_, i) => ({ price: mid + side * tick * (i + 1 + Math.random() * 0.3), size: +(Math.random() ** 2 * 6 + 0.2).toFixed(3) }))
        book = { bids: lvl(-1), asks: lvl(1) }
        const n = 1 + Math.floor(Math.random() * 4)
        addTrades(
          Array.from({ length: n }, () => {
            const side = Math.random() < 0.5 ? 'buy' : 'sell'
            return { id: `d${seq++}`, price: mid + (side === 'buy' ? tick : -tick) * Math.random(), size: +(Math.random() ** 3 * 3 + 0.01).toFixed(3), side, time: Date.now() } as TapeTrade
          }),
        )
      }, 500)
      cleanups.push(() => clearInterval(id))
    }

    ;(async () => {
      if (inst.assetClass === 'crypto') {
        try {
          const [snap, recent] = await Promise.all([binanceDepth(inst.feedId), binanceRecentTrades(inst.feedId)])
          if (cancelled) return
          book = snap
          meta = { hasBook: true, estimated: false, source: 'Binance', live: false }
          addTrades(recent)
          const pair = inst.feedId.toLowerCase()
          cleanups.push(
            binanceStream(
              [`${pair}@depth20@100ms`, `${pair}@aggTrade`],
              (d) => {
                if (d.e === 'aggTrade') {
                  addTrades([{ id: String(d.a), price: +d.p, size: +d.q, side: d.m ? 'sell' : 'buy', time: d.T }])
                } else if (d.bids) {
                  book = {
                    bids: d.bids.map(([p, q]: [string, string]) => ({ price: +p, size: +q })),
                    asks: d.asks.map(([p, q]: [string, string]) => ({ price: +p, size: +q })),
                  }
                  dirty = true
                }
              },
              (live) => {
                meta = { ...meta, live }
                dirty = true
              },
            ),
          )
        } catch {
          if (!cancelled) startDemo('Simulated (Binance unreachable)')
        }
        return
      }
      if (keys.finnhub) {
        meta = { hasBook: false, estimated: true, source: 'Finnhub trades', live: false }
        let last = 0
        let seq = 0
        cleanups.push(
          finnhubTrades(
            inst.feedId,
            keys.finnhub,
            (p, v, t) => {
              // tick rule: trade above the previous price = buyer-initiated
              const side = p > last ? 'buy' : p < last ? 'sell' : seq % 2 ? 'buy' : 'sell'
              last = p
              addTrades([{ id: `f${seq++}`, price: p, size: v, side, time: t }])
            },
            (live) => {
              meta = { ...meta, live }
              dirty = true
            },
          ),
        )
        return
      }
      startDemo('Simulated (add a Finnhub key for real trades)')
    })()

    return () => {
      cancelled = true
      cleanups.forEach((f) => f())
    }
  }, [inst, keys.finnhub])

  return flow
}
