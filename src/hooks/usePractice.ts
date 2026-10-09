import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis, AssetClass, Candle, Instrument, OrderFlow } from '../types'
import type { AiRules } from '../lib/aiRules'
import { baseRate, decide, type JournalEntry } from '../lib/journal'
import { emptyPractice, onBarClose, onPrice, parsePractice, type EntryContext, type PracticeEvent, type PracticeState } from '../lib/practice'
import { gainToday, pickWhy, rankCandidates, volumeVsAvg, type PracticeCandidate } from '../lib/practicePicks'
import { alpacaMovers, hasAlpacaData, type AlpacaDataKeys, type ApiKeys, type MarketMover } from '../data/providers'
import { candlesFor } from '../data/series'
import { runStrategy } from '../lib/strategy'
import { analyze } from '../lib/analyst'

const KEY = 'arc.practice.v1'
/** The stock picker trades 15-minute bars and rescans every 5 minutes; movers are refreshed every 30. */
export const PICK_TF = '15m' as const
const SCAN_MS = 5 * 60_000
const MOVERS_MS = 30 * 60_000
const NO_FLOW: OrderFlow = { bids: [], asks: [], trades: [], buyVolume: 0, sellVolume: 0, windowSec: 0, hasBook: false, estimated: true, source: 'none', live: false }

const BAR_SEC = 15 * 60
const BARS_KEY = 'arc.practice.bars.v1'
function loadBars(): Map<string, number> {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(BARS_KEY) ?? '{}') as Record<string, number>))
  } catch {
    return new Map()
  }
}
function saveBars(m: Map<string, number>) {
  try {
    localStorage.setItem(BARS_KEY, JSON.stringify(Object.fromEntries(m)))
  } catch {
    /* ignore */
  }
}

export interface PracticeScan {
  at: number | null
  busy: boolean
  candidates: PracticeCandidate[]
  failed: string[]
  /** Stocks were skipped because no stock data key is connected. */
  noStockData: boolean
}

function load(): PracticeState {
  try {
    return parsePractice(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? emptyPractice()
  } catch {
    return emptyPractice()
  }
}

interface Args {
  rules: AiRules
  symbol: string
  asset: AssetClass
  tf: string
  candles: Candle[]
  analysis: Analysis | null
  /** Model up-probability on the open chart, for the learner's opinion. */
  liveScore: number | null
  journal: JournalEntry[]
  priceOf: (symbol: string) => number
  quotesKey: unknown
  killSwitch: boolean
  maxTradesPerDay: number
  onEvent: (e: PracticeEvent) => void
  /** Markets the stock picker scans (your watchlist), plus today's movers when switched on. */
  universe: Instrument[]
  keys: ApiKeys
  alpacaKeys: AlpacaDataKeys
}

/** Runs practice mode while the app is open: decides on each closed bar, exits on live prices. */
export function usePractice({ rules, symbol, asset, tf, candles, analysis, liveScore, journal, priceOf, quotesKey, killSwitch, maxTradesPerDay, onEvent, universe, keys, alpacaKeys }: Args) {
  const [state, setState] = useState<PracticeState>(load)
  const on = rules.practiceMode
  const autoPick = rules.practiceAutoPick

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage full or blocked: keep going in memory */
    }
  }, [state])

  // announce new buys and sells
  const lastEvent = useRef(state.events[0]?.id)
  useEffect(() => {
    const fresh: PracticeEvent[] = []
    for (const e of state.events) {
      if (e.id === lastEvent.current) break
      fresh.push(e)
    }
    lastEvent.current = state.events[0]?.id
    for (const e of fresh.reverse()) if (e.kind !== 'skip') onEvent(e)
  }, [state.events, onEvent])

  // decide once per closed bar on the open chart
  const ctx = useRef({ analysis, liveScore, journal, rules, killSwitch, maxTradesPerDay, asset })
  ctx.current = { analysis, liveScore, journal, rules, killSwitch, maxTradesPerDay, asset }
  const n = candles.length
  const closed = n > 1 ? candles[n - 2] : null
  const seen = useRef('')
  useEffect(() => {
    if (!closed) return
    const key = `${symbol}|${tf}`
    const mark = `${key}|${closed.time}`
    // the first bar seen after loading a chart only sets the baseline, so old bars never trade
    if (!seen.current.startsWith(key + '|')) {
      seen.current = mark
      return
    }
    if (seen.current === mark) return
    seen.current = mark
    if (!on || ctx.current.rules.practiceAutoPick) return
    const c = ctx.current
    const learner: 'BUY' | 'HOLD' | 'n/a' =
      c.liveScore == null || !baseRate(c.journal) ? 'n/a' : decide(c.journal, c.liveScore, 0.55, c.rules.learnEdgeMarginPct / 100).signal === 'BUY' ? 'BUY' : 'HOLD'
    setState((s) =>
      onBarClose(s, {
        symbol,
        tf,
        price: closed.close,
        barTime: closed.time,
        analysis: c.analysis,
        learner,
        asset: c.asset,
        dayOn: c.rules.practiceDayOn,
        dayTrades: c.rules.practiceDayTrades,
        longOn: c.rules.practiceLongOn,
        longTrades: c.rules.practiceLongTrades,
        holdDays: c.rules.practiceHoldDays,
        sizePct: c.rules.practiceSizePct,
        gatesOn: c.rules.gatesOn,
        maxDrawdownPct: c.rules.maxDrawdownPct,
        maxTradesPerDay: c.maxTradesPerDay,
        killSwitch: c.killSwitch,
        now: Date.now(),
      }),
    )
  }, [closed, symbol, tf, on])

  // the stock picker: scan the watchlist and today's movers, rank BUY calls, trade the best
  const [scan, setScan] = useState<PracticeScan>({ at: null, busy: false, candidates: [], failed: [], noStockData: false })
  const scanCtx = useRef({ universe, keys, alpacaKeys, journal, rules, killSwitch, maxTradesPerDay })
  scanCtx.current = { universe, keys, alpacaKeys, journal, rules, killSwitch, maxTradesPerDay }
  const lastBars = useRef(loadBars())
  const scanPrices = useRef(new Map<string, number>())
  const movers = useRef<{ at: number; list: MarketMover[] }>({ at: 0, list: [] })
  const running = useRef(false)
  const runScan = useCallback(async () => {
    if (running.current) return
    running.current = true
    setScan((x) => ({ ...x, busy: true }))
    const c = scanCtx.current
    const stockData = hasAlpacaData(c.alpacaKeys) || !!c.keys.alphaVantage
    try {
      if (c.rules.practiceMovers && hasAlpacaData(c.alpacaKeys) && Date.now() - movers.current.at > MOVERS_MS)
        movers.current = { at: Date.now(), list: await alpacaMovers(c.alpacaKeys).catch(() => movers.current.list) }
      const list: { inst: Instrument; source: PracticeCandidate['source'] }[] = c.universe.filter((i) => i.assetClass === 'crypto' || stockData).map((inst) => ({ inst, source: 'watchlist' as const }))
      if (c.rules.practiceMovers)
        for (const m of movers.current.list)
          if (!list.some((x) => x.inst.symbol === m.symbol))
            list.push({ inst: { symbol: m.symbol, name: m.symbol, assetClass: 'stock', feedId: m.symbol, demoPrice: m.price ?? 100, demoVol: 0.4 }, source: m.source })
      // markets with an open practice trade are always rescanned, so their exits keep working
      const failed: string[] = []
      const raw: Omit<PracticeCandidate, 'rank' | 'place'>[] = []
      for (const { inst, source } of list) {
        try {
          const all = await candlesFor(inst, PICK_TF, c.keys, c.alpacaKeys, 300)
          const bars = all.slice(0, -1)
          if (bars.length < 80) continue
          const strat = runStrategy(bars)
          const a = analyze(bars, strat, strat.prediction, NO_FLOW, c.rules)
          const last = bars[bars.length - 1]
          scanPrices.current.set(inst.symbol, all[all.length - 1].close)
          raw.push({
            symbol: inst.symbol,
            asset: inst.assetClass,
            source,
            analysis: a,
            probUp: strat.prediction?.probUp ?? null,
            price: last.close,
            barTime: last.time,
            gainPct: gainToday(all),
            volVsAvg: volumeVsAvg(bars),
            tradeScore: a?.tradeScore?.score ?? null,
          })
        } catch {
          failed.push(inst.symbol)
        }
      }
      const ranked = rankCandidates(raw)
      const buys = ranked.filter((x) => x.place != null).length
      const now = Date.now()
      // decide once per newly closed bar. With no record of a market, a bar that just closed
      // still counts (so it can start trading right away) but older bars never trade.
      const fresh = ranked.filter((x) => {
        const seenBar = lastBars.current.get(x.symbol)
        lastBars.current.set(x.symbol, x.barTime)
        return seenBar == null ? now < (x.barTime + 2 * BAR_SEC) * 1000 : seenBar < x.barTime
      })
      saveBars(lastBars.current)
      setState((prev) => {
        let s = prev
        // exits first on the latest prices, then decisions on each newly closed bar, best pick first
        for (const x of ranked) {
          const px = scanPrices.current.get(x.symbol)
          if (px) s = onPrice(s, x.symbol, px, x.barTime, now) ?? s
        }
        for (const x of fresh) {
          const learner: EntryContext['learner'] =
            x.probUp == null || !baseRate(c.journal) ? 'n/a' : decide(c.journal, x.probUp, 0.55, c.rules.learnEdgeMarginPct / 100).signal === 'BUY' ? 'BUY' : 'HOLD'
          const why = x.place != null ? pickWhy(x, buys) : null
          s = onBarClose(s, {
            symbol: x.symbol,
            tf: PICK_TF,
            price: x.price,
            barTime: x.barTime,
            analysis: x.analysis,
            learner,
            asset: x.asset,
            dayOn: c.rules.practiceDayOn,
            dayTrades: c.rules.practiceDayTrades,
            longOn: c.rules.practiceLongOn,
            longTrades: c.rules.practiceLongTrades,
            holdDays: c.rules.practiceHoldDays,
            pick: why && x.place != null ? { place: x.place, of: buys, source: x.source, gainPct: x.gainPct, volVsAvg: x.volVsAvg, en: why.en, vi: why.vi } : undefined,
            sizePct: c.rules.practiceSizePct,
            gatesOn: c.rules.gatesOn,
            maxDrawdownPct: c.rules.maxDrawdownPct,
            maxTradesPerDay: c.maxTradesPerDay,
            killSwitch: c.killSwitch,
            now,
          })
        }
        return s
      })
      setScan({ at: now, busy: false, candidates: ranked, failed, noStockData: !stockData })
    } finally {
      running.current = false
      setScan((x) => (x.busy ? { ...x, busy: false } : x))
    }
  }, [])
  useEffect(() => {
    if (!on || !autoPick) return
    const first = setTimeout(runScan, 0)
    const id = setInterval(runScan, SCAN_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [on, autoPick, runScan])
  // live quotes where there are any, else the last scanned price (movers are not in the quote feed)
  const priceOrScan = useCallback((sym: string) => {
    const p = priceOf(sym)
    return p > 0 ? p : scanPrices.current.get(sym) ?? 0
  }, [priceOf])

  // stops and targets on every live price, for every market with an open practice trade,
  // plus a once-a-minute check so day trades close before market close even when prices stop moving
  const lastBar = n ? candles[n - 1].time : 0
  const [minute, setMinute] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setMinute((m) => m + 1), 60_000)
    return () => clearInterval(id)
  }, [on])
  useEffect(() => {
    if (!on) return
    setState((s) => {
      let cur = s
      for (const sym of new Set(s.open.map((p) => p.symbol))) {
        const px = priceOrScan(sym)
        if (!(px > 0)) continue
        cur = onPrice(cur, sym, px, sym === symbol ? lastBar : Math.floor(Date.now() / 1000), Date.now()) ?? cur
      }
      return cur
    })
  }, [on, priceOrScan, quotesKey, symbol, lastBar, minute])

  const reset = useCallback(() => setState(emptyPractice()), [])
  return { state, reset, scan, rescan: runScan, priceOf: priceOrScan }
}
