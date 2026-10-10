/**
 * One stock-picker cycle for practice mode, shared by the browser (usePractice) and the
 * server job (scripts/practice-cycle.ts): fetch 15-minute bars for every market, rank the
 * AI's BUY calls, then exit and enter practice trades. Paper only: nothing here places an order.
 */
import type { AssetClass, Candle, OrderFlow } from '../types'
import type { AiRules } from './aiRules'
import { analyze } from './analyst'
import { costsFrom } from './costs'
import { stampData } from './dataGuard'
import { baseRate, decide, type JournalEntry } from './journal'
import { onBarClose, onBars, onPrice, type EntryContext, type PickRow, type PracticeState } from './practice'
import { gainToday, pickWhy, rankCandidates, volumeVsAvg, type PickSource, type PracticeCandidate } from './practicePicks'
import { runStrategy } from './strategy'

export const PICK_TF = '15m' as const
export const BAR_SEC = 15 * 60
const NO_FLOW: OrderFlow = { bids: [], asks: [], trades: [], buyVolume: 0, sellVolume: 0, windowSec: 0, hasBook: false, estimated: true, source: 'none', live: false }

export interface ScanMarket {
  symbol: string
  asset: AssetClass
  source: PickSource
}

export interface ScanInput {
  markets: ScanMarket[]
  /** 15-minute bars, oldest first; the last one may still be forming. */
  fetchBars: (m: ScanMarket) => Promise<Candle[]>
  rules: AiRules
  journal: JournalEntry[]
  killSwitch: boolean
  maxTradesPerDay: number
  /** Last closed bar already decided on, per market. */
  lastBars: Record<string, number>
  now: number
  /** Close every day trade with the stock market (the server is not running overnight to close crypto at midnight). */
  dayEnd?: number
  /** Feed name for a market's bars, e.g. "Binance" or "Yahoo Finance"; labels the data real-time, delayed or mock. */
  sourceFor: (m: ScanMarket) => string
  /** Approved skills, recorded on each decision. */
  skills?: string[]
}

export interface ScanResult {
  /** Pure: apply this scan's exits and entries to a practice state. */
  apply: (prev: PracticeState) => PracticeState
  candidates: PracticeCandidate[]
  picks: PickRow[]
  failed: string[]
  prices: Record<string, number>
  lastBars: Record<string, number>
}

export const pickRows = (cs: PracticeCandidate[], max = 15): PickRow[] =>
  cs.slice(0, max).map((c) => ({ symbol: c.symbol, source: c.source, verdict: c.analysis?.verdict ?? null, gainPct: c.gainPct, volVsAvg: c.volVsAvg, tradeScore: c.tradeScore, place: c.place }))

/** Markets with an open practice trade are always scanned, so their exits keep working after they leave the movers list. */
export function withOpenMarkets(markets: ScanMarket[], s: PracticeState): ScanMarket[] {
  const out = [...markets]
  for (const p of s.open) if (!out.some((m) => m.symbol === p.symbol)) out.push({ symbol: p.symbol, asset: p.asset ?? 'stock', source: p.info.pick?.source ?? 'watchlist' })
  return out
}

export async function scanCycle(input: ScanInput): Promise<ScanResult> {
  const { rules, journal, now } = input
  const failed: string[] = []
  const raw: Omit<PracticeCandidate, 'rank' | 'place'>[] = []
  const prices: Record<string, number> = {}
  const newBars: Record<string, Candle[]> = {}
  const latestTimes: Record<string, number> = {}
  for (const m of input.markets) {
    try {
      const all = await input.fetchBars(m)
      if (!all.length) continue
      const bars = all.slice(0, -1)
      // exits need only prices; the 80-bar minimum is for the analysis behind new entries
      prices[m.symbol] = all[all.length - 1].close
      latestTimes[m.symbol] = (bars[bars.length - 1] ?? all[all.length - 1]).time
      const seen = input.lastBars[m.symbol]
      newBars[m.symbol] = seen == null ? [] : all.filter((b) => b.time > seen)
      if (bars.length < 80) continue
      const strat = runStrategy(bars)
      const a = analyze(bars, strat, strat.prediction, NO_FLOW, rules)
      const last = bars[bars.length - 1]
      raw.push({
        symbol: m.symbol,
        asset: m.asset,
        source: m.source,
        analysis: a,
        probUp: strat.prediction?.probUp ?? null,
        price: last.close,
        barTime: last.time,
        gainPct: gainToday(all),
        volVsAvg: volumeVsAvg(bars),
        tradeScore: a?.tradeScore?.score ?? null,
      })
    } catch {
      failed.push(m.symbol)
    }
  }
  const ranked = rankCandidates(raw)
  const buys = ranked.filter((x) => x.place != null).length
  const lastBars = { ...input.lastBars }
  // decide once per newly closed bar. With no record of a market, a bar that just closed still
  // counts (so it can start trading right away) but older bars never trade.
  const fresh = ranked.filter((x) => {
    const seen = lastBars[x.symbol]
    lastBars[x.symbol] = x.barTime
    return seen == null ? now < (x.barTime + 2 * BAR_SEC) * 1000 : seen < x.barTime
  })

  const apply = (prev: PracticeState) => {
    let s = prev
    // exits first: stops and targets reached since the last scan, then market close or end of hold on the latest price
    for (const symbol of Object.keys(prices)) {
      s = onBars(s, symbol, newBars[symbol] ?? [], now) ?? s
      s = onPrice(s, symbol, prices[symbol], latestTimes[symbol], now) ?? s
    }
    // then entries, best pick first: the top BUY takes the day's long-term slot, the next ones the day trades
    for (const x of fresh) {
      const learner: EntryContext['learner'] =
        x.probUp == null || !baseRate(journal) ? 'n/a' : decide(journal, x.probUp, 0.55, rules.learnEdgeMarginPct / 100).signal === 'BUY' ? 'BUY' : 'HOLD'
      const why = x.place != null ? pickWhy(x, buys) : null
      s = onBarClose(s, {
        symbol: x.symbol,
        tf: PICK_TF,
        price: x.price,
        barTime: x.barTime,
        analysis: x.analysis,
        learner,
        asset: x.asset,
        dayOn: rules.practiceDayOn,
        dayTrades: rules.practiceDayTrades,
        longOn: rules.practiceLongOn,
        longTrades: rules.practiceLongTrades,
        holdDays: rules.practiceHoldDays,
        pick: why && x.place != null ? { place: x.place, of: buys, source: x.source, gainPct: x.gainPct, volVsAvg: x.volVsAvg, en: why.en, vi: why.vi } : undefined,
        dayEnd: input.dayEnd,
        sizePct: rules.practiceSizePct,
        gatesOn: rules.gatesOn,
        maxDrawdownPct: rules.maxDrawdownPct,
        maxTradesPerDay: input.maxTradesPerDay,
        killSwitch: input.killSwitch,
        now,
        hardLimitsOn: rules.hardLimitsOn,
        maxOpenPositions: rules.maxOpenPositions,
        maxExposurePct: rules.maxExposurePct,
        data: stampData(input.sourceFor(x), x.barTime, BAR_SEC, now),
        tfSec: BAR_SEC,
        dataGuardOn: rules.dataGuardOn,
        maxDataAgeMin: rules.maxDataAgeMin,
        costs: costsFrom(rules),
        audit: rules.auditOn,
        skills: input.skills,
      })
    }
    return s
  }
  return { apply, candidates: ranked, picks: pickRows(ranked), failed, prices, lastBars }
}
