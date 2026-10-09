import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis, AssetClass, Candle, Instrument } from '../types'
import type { AiRules } from '../lib/aiRules'
import { baseRate, decide, type JournalEntry } from '../lib/journal'
import { emptyPractice, onBarClose, onPrice, parsePractice, type PickRow, type PracticeEvent, type PracticeState } from '../lib/practice'
import { PICK_TF, scanCycle, withOpenMarkets, type ScanMarket } from '../lib/practiceScan'
import { alpacaMovers, hasAlpacaData, type AlpacaDataKeys, type ApiKeys, type MarketMover } from '../data/providers'
import { candlesFor } from '../data/series'

const KEY = 'arc.practice.v1'
const SEEN_KEY = 'arc.practice.seen.v1'
/** The stock picker trades 15-minute bars and rescans every 5 minutes; movers are refreshed every 30. */
const SCAN_MS = 5 * 60_000
const MOVERS_MS = 30 * 60_000
/** The server account is used while its last run is this recent (covers a weekend with no runs). */
export const SERVER_FRESH_MS = 4 * 86_400_000
const SERVER_PULL_MS = 5 * 60_000

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
  candidates: PickRow[]
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
  /** Called once when the server account made trades since this browser last looked. */
  onAway?: (trades: number) => void
}

/** Runs practice mode while the app is open: decides on each closed bar, exits on live prices. */
export function usePractice({ rules, symbol, asset, tf, candles, analysis, liveScore, journal, priceOf, quotesKey, killSwitch, maxTradesPerDay, onEvent, universe, keys, alpacaKeys, onAway }: Args) {
  const [local, setState] = useState<PracticeState>(load)
  const on = rules.practiceMode
  const autoPick = rules.practiceAutoPick

  // the 24/7 server account (scripts/practice-cycle.ts, every 15 minutes in US market hours)
  const [server, setServer] = useState<PracticeState | null>(null)
  const [pullNow, setPullNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on || !rules.practiceServer) return
    const pull = () =>
      fetch(`${import.meta.env.BASE_URL}practice.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((raw) => {
          const s = parsePractice(raw)
          setPullNow(Date.now())
          if (s?.server) setServer((cur) => (cur && cur.server && cur.server.lastRun >= s.server!.lastRun ? cur : s))
        })
        .catch(() => undefined)
    pull()
    const id = setInterval(pull, SERVER_PULL_MS)
    return () => clearInterval(id)
  }, [on, rules.practiceServer])
  const serverMode = !!(on && rules.practiceServer && server?.server && pullNow - server.server.lastRun < SERVER_FRESH_MS)
  const state = serverMode && server ? server : local

  // tell the user what the server did while the app was closed, once per visit
  const awayRef = useRef(onAway)
  awayRef.current = onAway
  const toldAway = useRef(false)
  useEffect(() => {
    if (!serverMode || !server || toldAway.current) return
    toldAway.current = true
    let seen: string | null = null
    try {
      seen = localStorage.getItem(SEEN_KEY)
    } catch {
      /* ignore */
    }
    if (seen) {
      let n = 0
      for (const e of server.events) {
        if (e.id === seen) break
        if (e.kind !== 'skip') n++
      }
      if (n) awayRef.current?.(n)
    }
  }, [serverMode, server])
  useEffect(() => {
    if (!state.events[0]) return
    try {
      localStorage.setItem(SEEN_KEY, state.events[0].id)
    } catch {
      /* ignore */
    }
  }, [state.events])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(local))
    } catch {
      /* storage full or blocked: keep going in memory */
    }
  }, [local])

  // announce new buys and sells
  const lastEvent = useRef(state.events[0]?.id)
  const lastSource = useRef(serverMode)
  useEffect(() => {
    // switching between the browser and server accounts is not a new order
    if (lastSource.current !== serverMode) {
      lastSource.current = serverMode
      lastEvent.current = state.events[0]?.id
      return
    }
    const fresh: PracticeEvent[] = []
    for (const e of state.events) {
      if (e.id === lastEvent.current) break
      fresh.push(e)
    }
    lastEvent.current = state.events[0]?.id
    for (const e of fresh.reverse()) if (e.kind !== 'skip') onEvent(e)
  }, [state.events, onEvent, serverMode])

  // decide once per closed bar on the open chart
  const ctx = useRef({ analysis, liveScore, journal, rules, killSwitch, maxTradesPerDay, asset, serverMode })
  ctx.current = { analysis, liveScore, journal, rules, killSwitch, maxTradesPerDay, asset, serverMode }
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
    if (!on || ctx.current.rules.practiceAutoPick || ctx.current.serverMode) return
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
  const scanCtx = useRef({ universe, keys, alpacaKeys, journal, rules, killSwitch, maxTradesPerDay, state })
  scanCtx.current = { universe, keys, alpacaKeys, journal, rules, killSwitch, maxTradesPerDay, state }
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
      const markets: ScanMarket[] = c.universe.filter((i) => i.assetClass === 'crypto' || stockData).map((i) => ({ symbol: i.symbol, asset: i.assetClass, source: 'watchlist' as const }))
      if (c.rules.practiceMovers) for (const m of movers.current.list) if (!markets.some((x) => x.symbol === m.symbol)) markets.push({ symbol: m.symbol, asset: 'stock', source: m.source })
      const instFor = (m: ScanMarket): Instrument => c.universe.find((i) => i.symbol === m.symbol) ?? { symbol: m.symbol, name: m.symbol, assetClass: m.asset, feedId: m.symbol, demoPrice: 100, demoVol: 0.4 }
      const r = await scanCycle({
        markets: withOpenMarkets(markets, c.state).filter((m) => m.asset === 'crypto' || stockData),
        fetchBars: (m) => candlesFor(instFor(m), PICK_TF, c.keys, c.alpacaKeys, 300),
        rules: c.rules,
        journal: c.journal,
        killSwitch: c.killSwitch,
        maxTradesPerDay: c.maxTradesPerDay,
        lastBars: Object.fromEntries(lastBars.current),
        now: Date.now(),
      })
      lastBars.current = new Map(Object.entries(r.lastBars))
      saveBars(lastBars.current)
      for (const [sym, px] of Object.entries(r.prices)) scanPrices.current.set(sym, px)
      setState(r.apply)
      setScan({ at: Date.now(), busy: false, candidates: r.picks, failed: r.failed, noStockData: !stockData })
    } finally {
      running.current = false
      setScan((x) => (x.busy ? { ...x, busy: false } : x))
    }
  }, [])
  useEffect(() => {
    if (!on || !autoPick || serverMode) return
    const first = setTimeout(runScan, 0)
    const id = setInterval(runScan, SCAN_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [on, autoPick, serverMode, runScan])
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
    if (!on || serverMode) return
    const id = setInterval(() => setMinute((m) => m + 1), 60_000)
    return () => clearInterval(id)
  }, [on, serverMode])
  useEffect(() => {
    if (!on || serverMode) return
    setState((s) => {
      let cur = s
      for (const sym of new Set(s.open.map((p) => p.symbol))) {
        const px = priceOrScan(sym)
        if (!(px > 0)) continue
        cur = onPrice(cur, sym, px, sym === symbol ? lastBar : Math.floor(Date.now() / 1000), Date.now()) ?? cur
      }
      return cur
    })
  }, [on, serverMode, priceOrScan, quotesKey, symbol, lastBar, minute])

  const reset = useCallback(() => setState(emptyPractice()), [])
  const shownScan: PracticeScan =
    serverMode && server?.server ? { at: server.server.lastRun, busy: false, candidates: server.server.picks, failed: server.server.failed, noStockData: false } : scan
  return { state, reset, scan: shownScan, rescan: runScan, priceOf: priceOrScan, serverMode, serverLastRun: server?.server?.lastRun ?? null }
}
