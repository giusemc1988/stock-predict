import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis, AssetClass, Candle } from '../types'
import type { AiRules } from '../lib/aiRules'
import { baseRate, decide, type JournalEntry } from '../lib/journal'
import { emptyPractice, onBarClose, onPrice, parsePractice, type PracticeEvent, type PracticeState } from '../lib/practice'

const KEY = 'arc.practice.v1'

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
}

/** Runs practice mode while the app is open: decides on each closed bar, exits on live prices. */
export function usePractice({ rules, symbol, asset, tf, candles, analysis, liveScore, journal, priceOf, quotesKey, killSwitch, maxTradesPerDay, onEvent }: Args) {
  const [state, setState] = useState<PracticeState>(load)
  const on = rules.practiceMode

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
    if (!on) return
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
        const px = priceOf(sym)
        if (!(px > 0)) continue
        cur = onPrice(cur, sym, px, sym === symbol ? lastBar : Math.floor(Date.now() / 1000), Date.now()) ?? cur
      }
      return cur
    })
  }, [on, priceOf, quotesKey, symbol, lastBar, minute])

  const reset = useCallback(() => setState(emptyPractice()), [])
  return { state, reset }
}
