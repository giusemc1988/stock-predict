/**
 * One stock-picker cycle for practice mode, shared by the browser (usePractice) and the
 * server job (scripts/practice-cycle.ts): fetch 15-minute bars for every market, rank the
 * AI's BUY calls, then exit and enter practice trades. Paper only: nothing here places an order.
 */
import type { AssetClass, Candle, OrderFlow } from '../types'
import { practiceLimits, type AiRules } from './aiRules'
import { analyze } from './analyst'
import { costsFrom } from './costs'
import { stampData } from './dataGuard'
import { baseRate, decide, type JournalEntry } from './journal'
import { onBarClose, onBars, onPrice, type EntryContext, type PickRow, type PracticeState } from './practice'
import { dollarVolume, gainToday, pickWhy, rankCandidates, volumeVsAvg, type PickSource, type PracticeCandidate } from './practicePicks'
import { atrPercent, qualityBlock } from './practiceQuality'
import { runStrategy } from './strategy'
import { shadowTag } from './shadowFilters'
import { baseSymbol } from './kronosView'
import { fetchAlpacaNews } from './newsProvider'
import { analyzeSentiment } from './newsSentiment'

export const PICK_TF = '15m' as const
export const BAR_SEC = 15 * 60
const NO_FLOW: OrderFlow = { bids: [], asks: [], trades: [], buyVolume: 0, sellVolume: 0, windowSec: 0, hasBook: false, estimated: true, source: 'none', live: false }

export interface ScanMarket {
  symbol: string
  asset: AssetClass
  source: PickSource
  /** Market cap in dollars from the movers list, when known. */
  marketCap?: number | null
}

export interface ScanInput {
  markets: ScanMarket[]
  /** 15-minute bars, oldest first; the last one may still be forming. */
  fetchBars: (m: ScanMarket) => Promise<Candle[]>
  rules: AiRules
  journal: JournalEntry[]
  /** Journal for the shadow learner call (works while learning is paused); defaults to `journal`. */
  shadowJournal?: JournalEntry[]
  /** Kronos's 5-day forecast move in percent by base symbol (kronosPct5), for the "Kronos objects" shadow tag. */
  kronosPct?: Record<string, number>
  killSwitch: boolean
  maxTradesPerDay: number
  /** Last closed bar already decided on, per market. */
  lastBars: Record<string, number>
  now: number
  /** Close every day trade with the stock market (the server is not running overnight to close crypto at midnight). */
  dayEnd?: number
  /** Feed name for a market's bars, e.g. "Binance" or "Yahoo Finance"; labels the data real-time, delayed or mock. */
  sourceFor: (m: ScanMarket) => string
  /** Symbols on the nightly Leaders top 100: they get the day's slots first when practiceLeadersFirst is on. */
  leaders?: string[]
  /** Approved skills, recorded on each decision. */
  skills?: string[]
  /** True when rolling win rate < 40%; pause learning to avoid overfitting to unproven signals. */
  pauseLearning?: boolean
  /** Drawdown brake multiplier: 1.0 (normal), 0.5 (-3%), 0.25 (-6%), 0 (-15%+). */
  drawdownBrakeMultiplier?: number
  /** Kelly sizing multiplier: conservative 0.25x Kelly based on closed trade history. */
  kellyMultiplier?: number
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

export interface Mover {
  symbol: string
  source: 'gainer' | 'active' | 'loser'
  marketCap?: number | null
}

/** What one scan looks at: your watchlist, plus today's stock and crypto movers from live market-wide lists. */
export function scanMarkets(watchlist: { symbol: string; assetClass: AssetClass }[], stockMovers: Mover[], cryptoMovers: Mover[]): ScanMarket[] {
  const out: ScanMarket[] = watchlist.map((i) => ({ symbol: i.symbol, asset: i.assetClass, source: 'watchlist' as const }))
  const add = (m: Mover, asset: AssetClass) => {
    if (!out.some((x) => x.symbol === m.symbol)) out.push({ symbol: m.symbol, asset, source: m.source, marketCap: m.marketCap ?? null })
  }
  for (const m of stockMovers) add(m, 'stock')
  for (const m of cryptoMovers) add(m, 'crypto')
  return out
}

/** Today's top crypto gainers and most-traded coins, taken from a live market list. */
export function cryptoMovers(lists: { gainers: { symbol: string }[]; volume: { symbol: string }[] } | null, top = 8): Mover[] {
  if (!lists) return []
  const out: Mover[] = lists.gainers.slice(0, top).map((r) => ({ symbol: r.symbol, source: 'gainer' }))
  for (const r of lists.volume.slice(0, top)) if (!out.some((m) => m.symbol === r.symbol)) out.push({ symbol: r.symbol, source: 'active' })
  return out
}

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
  const sentiments: Record<string, number | null> = {}
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
      // fetch and score news sentiment for stocks (not crypto)
      let sentiment: number | null = null
      if (m.asset === 'stock') {
        try {
          const news = await fetchAlpacaNews(m.symbol)
          if (news.length > 0) {
            const headlines = news.map(n => n.headline)
            sentiment = analyzeSentiment(headlines).sentiment
          }
        } catch {
          // news fetch failed, sentiment stays null
        }
      }
      sentiments[m.symbol] = sentiment
      const dollarVol = dollarVolume(bars)
      const volVsAvg = volumeVsAvg(bars)
      const atrPct = atrPercent(bars)
      raw.push({
        symbol: m.symbol,
        asset: m.asset,
        source: m.source,
        analysis: a,
        probUp: strat.prediction?.probUp ?? null,
        price: last.close,
        barTime: last.time,
        gainPct: gainToday(all),
        volVsAvg,
        dollarVol,
        atrPct,
        marketCap: m.marketCap ?? null,
        blocked: qualityBlock({ asset: m.asset, price: last.close, dollarVol, volVsAvg, atrPct, marketCap: m.marketCap }),
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
  // slots are first come first served, so Leaders stocks go first (stable: the pick order is kept inside each group)
  if (rules.practiceLeadersFirst && input.leaders?.length) {
    const lead = new Set(input.leaders)
    const isLead = (x: { symbol: string; asset: string }) => x.asset === 'stock' && lead.has(x.symbol)
    fresh.splice(0, fresh.length, ...fresh.filter(isLead), ...fresh.filter((x) => !isLead(x)))
  }

  const apply = (prev: PracticeState) => {
    let s = prev
    // exits first: stops and targets reached since the last scan, then market close or end of hold on the latest price
    for (const symbol of Object.keys(prices)) {
      s = onBars(s, symbol, newBars[symbol] ?? [], now) ?? s
      s = onPrice(s, symbol, prices[symbol], latestTimes[symbol], now) ?? s
    }
    // then entries, best pick first: the top BUY takes the day's long-term slot, the next ones the day trades
    for (const x of fresh) {
      const canLearn = x.probUp != null && baseRate(journal) && !input.pauseLearning
      const learner: EntryContext['learner'] =
        !canLearn ? 'n/a' : decide(journal, x.probUp!, 0.55, rules.learnEdgeMarginPct / 100).signal === 'BUY' ? 'BUY' : 'HOLD'
      const why = x.place != null ? pickWhy(x, buys) : null
      const before = new Set(s.open.map((p) => p.id))
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
        qualityBlock: x.blocked ?? null,
        volVsAvg: x.volVsAvg ?? null,
        source: x.source,
        pick: why && x.place != null ? { place: x.place, of: buys, source: x.source, gainPct: x.gainPct, volVsAvg: x.volVsAvg, en: why.en, vi: why.vi } : undefined,
        dayEnd: input.dayEnd,
        sizePct: rules.practiceSizePct,
        gatesOn: rules.gatesOn,
        maxDrawdownPct: rules.maxDrawdownPct,
        maxTradesPerDay: input.maxTradesPerDay,
        killSwitch: input.killSwitch,
        now,
        hardLimitsOn: rules.hardLimitsOn,
        ...practiceLimits(rules),
        pennyOn: rules.practicePenny,
        dollarVol: x.dollarVol ?? null,
        maxExposurePct: rules.maxExposurePct,
        data: stampData(input.sourceFor(x), x.barTime, BAR_SEC, now),
        tfSec: BAR_SEC,
        dataGuardOn: rules.dataGuardOn,
        maxDataAgeMin: rules.maxDataAgeMin,
        costs: costsFrom(rules),
        audit: rules.auditOn,
        playbookGate: rules.jarvisOn && rules.jarvisGate,
        playbookMin: rules.minSample,
        playbookMargin: rules.learnEdgeMarginPct / 100,
        skills: input.skills,
        newsSentiment: sentiments[x.symbol],
        drawdownBrakeMultiplier: input.drawdownBrakeMultiplier,
        kellyMultiplier: input.kellyMultiplier,
      })
      // shadow filters: tag the position this bar opened (if any); recorded only, never blocks
      const opened = s.open.find((p) => !before.has(p.id) && p.symbol === x.symbol)
      if (opened && !opened.info.shadow) {
        const sj = input.shadowJournal ?? journal
        const shadowLearner = x.probUp != null && baseRate(sj) ? (decide(sj, x.probUp, 0.55, rules.learnEdgeMarginPct / 100).signal === 'BUY' ? 'BUY' : 'HOLD') : 'n/a'
        const tag = shadowTag({
          kind: opened.kind ?? 'day',
          source: x.source,
          volVsAvg: x.volVsAvg,
          openedAt: opened.openedAt,
          // #271 (2), shadow-only: planned stop distance from the fill, in % of entry.
          // Recorded only — the live entry gates in practice.ts are untouched.
          stopPct: opened.entry > 0 ? ((opened.entry - opened.stop) / opened.entry) * 100 : null,
          kronosPct: rules.shadowKronos ? (input.kronosPct?.[baseSymbol(opened.symbol)] ?? null) : null,
        }, shadowLearner)
        s = { ...s, open: s.open.map((p) => (p.id === opened.id ? { ...p, info: { ...p.info, shadow: tag } } : p)) }
      }
    }
    return s
  }
  return { apply, candidates: ranked, picks: pickRows(ranked), failed, prices, lastBars }
}
