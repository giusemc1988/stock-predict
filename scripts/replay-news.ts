/**
 * Atlas news lab (round 4): Chan (2003) "no-news moves reverse, news moves continue", tested on D1 (short-term
 * reversal, plain and VIX-gated), the I3 intraday winners held overnight, and all big daily movers.
 * Signals, windows, statistics: src/lib/replayNews.ts. This script fetches prices (Yahoo) and news timestamps
 * (Alpaca News API, timestamps and symbols only) and writes public/replay-news.json.
 *
 * Needs ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY (GitHub repo secrets). Without them it prints a message,
 * exits 0 and writes NOTHING. News is cached per symbol per month in .cache/news (gitignored) and the fetch
 * stops after --budget-min minutes; run again to continue from the cache (the workflow keeps the cache).
 * Keys are never printed.
 *
 *   npm run replay:news                              full run, writes public/replay-news.json
 *   npm run replay:news -- --symbols 8 --out x       quick run on the first 8 markets
 *   options: --from YYYY-MM (news start, default 2018-01), --budget-min N (default 95), --pause-ms N (default 330)
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { costsFrom } from '../src/lib/costs'
import { dayKey } from '../src/lib/practice'
import { d1Reversal, type Series } from '../src/lib/replayDaily'
import { ALL_TRIALS, medianDollarVolume, i3Winners, sessionDays, symbolCosts, type CostModel, type SymDays } from '../src/lib/replayIntraday'
import { vixDays, vixGate, gateSignals } from '../src/lib/replayRound2'
import {
  NEWS_ALL_TRIALS, NEWS_TRIALS, NO_KEYS_MSG, NewsIncomplete, PASS_RULE_EN, PASS_RULE_VI, afternoonWindow, bucketOf, hasAlpacaKeys, judgeDailyLeads, judgeIntradayLeads, loadSymbolNews, monthStart,
  moverSignals, newsCoverageMonth, prepDailyLead, trailingWindow, type LeadInfo, type NewsDeps, type NewsIndex,
} from '../src/lib/replayNews'
import { STOCKS } from '../src/lib/replayUniverse'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-news.json'
const LIMIT = Number(arg('--symbols') ?? 0)
const NEWS_FROM = arg('--from') ?? '2018-01'
const BUDGET_MS = Number(arg('--budget-min') ?? 95) * 60_000
const PAUSE_MS = Number(arg('--pause-ms') ?? 330)
const CACHE = '.cache/news'
const ETFS = new Set(['SPY', 'QQQ', 'IWM'])
const UA = { 'User-Agent': 'Mozilla/5.0 (atlas replay lab)' }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

type Quote = { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }
type YahooJson = { chart: { result?: { timestamp?: number[]; indicators: { quote: Quote[]; adjclose?: { adjclose: (number | null)[] }[] } }[] } }

async function yahoo(symbol: string, query: string, adjust: boolean): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const r = ((await res.json()) as YahooJson).chart.result?.[0]
      const q = r?.indicators.quote[0]
      const adj = adjust ? r?.indicators.adjclose?.[0]?.adjclose : undefined
      if (!r?.timestamp || !q) return []
      const out: Candle[] = []
      r.timestamp.forEach((t, k) => {
        const [o, h, l, c, v] = [q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k]]
        if (o == null || h == null || l == null || c == null) return
        const f = adj?.[k] != null && c > 0 ? adj[k]! / c : 1
        out.push({ time: t, open: o * f, high: h * f, low: l * f, close: c * f, volume: v ?? 0 })
      })
      return out
    }
    await sleep(1000 * (i + 1))
  }
  throw new Error(`Yahoo failed for ${symbol}`)
}
const yahooDaily = (s: string) => yahoo(s, `interval=1d&period1=${Date.UTC(2010, 0, 1) / 1000}&period2=${Math.floor(Date.now() / 1000)}`, true)
const yahoo60 = (s: string) => yahoo(s, 'interval=60m&range=730d', false)

const fileOf = (symbol: string, month: string) => `${CACHE}/${symbol.replace(/[^A-Za-z0-9]/g, '_')}/${month}.json`
const cache: NonNullable<NewsDeps['cache']> = {
  get: (s, m) => {
    try {
      return existsSync(fileOf(s, m)) ? (JSON.parse(readFileSync(fileOf(s, m), 'utf8')) as number[]) : null
    } catch {
      return null
    }
  },
  set: (s, m, t) => {
    mkdirSync(`${CACHE}/${s.replace(/[^A-Za-z0-9]/g, '_')}`, { recursive: true })
    writeFileSync(fileOf(s, m), JSON.stringify(t))
  },
}

const medianDV = (bars: Candle[]) => {
  const v = bars.map((b) => b.close * b.volume).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : 0
}

async function main() {
  if (!hasAlpacaKeys(process.env)) {
    console.log(NO_KEYS_MSG)
    return
  }
  const t0 = Date.now()
  const markets = LIMIT ? STOCKS.slice(0, LIMIT) : [...STOCKS]
  const names = markets.filter((s) => !ETFS.has(s))

  // 1. news timestamps (resumable)
  const deps: NewsDeps = {
    keyId: process.env.ALPACA_API_KEY_ID!,
    secret: process.env.ALPACA_API_SECRET_KEY!,
    fetchFn: (u, init) => fetch(u, init),
    pause: sleep,
    gapMs: PAUSE_MS,
    cache,
    stop: () => Date.now() - t0 > BUDGET_MS,
  }
  const news: NewsIndex = new Map()
  const failedNews: string[] = []
  try {
    for (const s of names) {
      try {
        news.set(s, await loadSymbolNews(s, NEWS_FROM, deps))
        console.log(`${s}: ${news.get(s)!.length} news items`)
      } catch (e) {
        if (e instanceof NewsIncomplete) throw e
        failedNews.push(s)
        console.log(`${s}: news failed (${e instanceof Error ? e.message : 'error'})`) // messages never contain the keys
        if (/ 40[13] /.test(String(e instanceof Error ? e.message : ''))) throw e // wrong keys or no news plan: stop at once
      }
    }
  } catch (e) {
    if (e instanceof NewsIncomplete) {
      console.log(`News fetch stopped at the time budget after ${news.size}/${names.length} symbols. Finished months are cached in ${CACHE}; run again to continue. No result file was written.`)
      return
    }
    throw e
  }
  if (failedNews.length > names.length * 0.1) {
    console.log(`News failed for ${failedNews.length}/${names.length} symbols (${failedNews.join(', ')}); not writing a result from partial news.`)
    return
  }
  const covMonth = newsCoverageMonth(news, names.filter((s) => !failedNews.includes(s)))
  if (!covMonth) {
    console.log('Alpaca returned (almost) no news for these symbols, so there is no news/no-news split to test. No result file was written.')
    return
  }
  const coverageFrom = monthStart(covMonth)
  const articles = [...news.values()].reduce((a, t) => a + t.length, 0)
  console.log(`news archive trusted from ${covMonth} (${articles} items)`)

  // 2. prices
  const universe: Series[] = []
  const sixty: SymDays[] = []
  const failed: string[] = []
  const model: CostModel = { sym: new Map(), old: costsFrom(DEFAULT_AI_RULES) }
  const dailyCosts = new Map<string, ReturnType<typeof symbolCosts>>()
  for (const s of markets) {
    try {
      const d = await yahooDaily(s)
      universe.push({ symbol: s, bars: d })
      dailyCosts.set(s, symbolCosts(medianDV(d)))
      if (!ETFS.has(s)) {
        const d60 = sessionDays(await yahoo60(s), 930)
        sixty.push({ symbol: s, days: d60 })
        model.sym.set(s, symbolCosts(medianDollarVolume(d60)))
      }
      console.log(`${s}: ${d.length} daily bars`)
      await sleep(250)
    } catch (e) {
      failed.push(s)
      console.log(`${s}: failed (${e instanceof Error ? e.message : 'error'})`)
    }
  }
  const spy = universe.find((s) => s.symbol === 'SPY')?.bars ?? universe[0].bars
  const covDay = dayKey(coverageFrom * 1000)
  const days = spy.map((b) => dayKey(b.time * 1000)).filter((d) => d >= covDay)
  const examFrom = days[Math.floor(days.length * (2 / 3))] ?? days[days.length - 1]
  const days60 = [...new Set(sixty.flatMap((s) => s.days.map((d) => d.key)))].sort()
  const examFrom60 = days60[Math.floor(days60.length * (2 / 3))] ?? days60[days60.length - 1]

  // 3. leads
  const costOf = (symbol: string) => dailyCosts.get(symbol) ?? null
  const symIdx = (win: (bars: Candle[], i: number) => [number, number] | null) => (sym: number, i: number) => {
    const s = universe[sym]
    return ETFS.has(s.symbol) ? null : bucketOf(news.get(s.symbol), win(s.bars, i), coverageFrom)
  }
  const n1Ctx = { u: universe, examFrom, costs: costOf, bucketAt: symIdx((b, i) => trailingWindow(b, i, 5)) }
  const n3Ctx = { u: universe, examFrom, costs: costOf, bucketAt: symIdx((b, i) => trailingWindow(b, i, 1)) }
  const lead = (id: string, en: string, vi: string, expect: LeadInfo['expect']): LeadInfo => ({ id, en, vi, expect })

  const vix = vixDays(await yahoo('^VIX', `interval=1d&period1=${Date.UTC(2010, 0, 1) / 1000}&period2=${Math.floor(Date.now() / 1000)}`, false))
  const d1 = d1Reversal(universe)
  const gate = (kind: 'A' | 'B') => {
    const ok = vixGate(vix, kind)
    return { sigs: gateSignals(universe, d1, ok), ok }
  }
  const [gA, gB] = [gate('A'), gate('B')]
  const preps = [
    prepDailyLead(n1Ctx, lead('N1-D1', 'D1 short-term reversal (bottom 10% by 5-day return, hold 5 days), split by news in [5 trading days before the signal close, signal close]', 'D1 đảo chiều ngắn hạn (10% giảm mạnh nhất 5 ngày, giữ 5 ngày), chia theo tin trong [5 phiên trước đến lúc đóng cửa ngày tín hiệu]', 'noNewsHigher'), d1, 5),
    prepDailyLead(n1Ctx, lead('N1-D1-VIXA', 'D1 only when VIX >= its 252-day median, split by news', 'D1 chỉ khi VIX >= trung vị 252 ngày, chia theo tin', 'noNewsHigher'), gA.sigs, 5, gA.ok),
    prepDailyLead(n1Ctx, lead('N1-D1-VIXB', 'D1 only when VIX >= 25, split by news', 'D1 chỉ khi VIX >= 25, chia theo tin', 'noNewsHigher'), gB.sigs, 5, gB.ok),
    prepDailyLead(n3Ctx, lead('N3-up', 'Big up movers (1-day return >= +4%), long the next 5 days, split by news since the prior close', 'Cổ phiếu tăng mạnh (1 ngày >= +4%), mua giữ 5 ngày tiếp, chia theo tin từ lúc đóng cửa hôm trước', 'newsHigher'), moverSignals(universe, 'up'), 5),
    prepDailyLead(n3Ctx, lead('N3-down', 'Big down movers (1-day return <= -4%), long the next 5 days, split by news since the prior close', 'Cổ phiếu giảm mạnh (1 ngày <= -4%), mua giữ 5 ngày tiếp, chia theo tin từ lúc đóng cửa hôm trước', 'noNewsHigher'), moverSignals(universe, 'down'), 5),
  ]
  const daily = judgeDailyLeads(examFrom, preps)

  const nightEn = (limit: boolean) => `Intraday winners (up 3%+ on 2x volume by 15:30 ET, 60m bars), ${limit ? 'limit' : 'market'} entry, held overnight to the next open, split by news since the prior close`
  const nightVi = (limit: boolean) => `Cổ phiếu thắng trong ngày (tăng 3%+ với khối lượng 2x lúc 15:30 NY, nến 60 phút), ${limit ? 'lệnh giới hạn' : 'lệnh thị trường'}, giữ qua đêm đến lúc mở cửa hôm sau, chia theo tin từ lúc đóng cửa hôm trước`
  const intraday = judgeIntradayLeads(
    { syms: sixty, examFrom: examFrom60, model, bucketAt: (sd, di) => bucketOf(news.get(sd.symbol), afternoonWindow(sd, di), coverageFrom) },
    [false, true].map((limit) => ({ lead: lead(`N2-win-night-${limit ? 'lim' : 'mkt'}`, nightEn(limit), nightVi(limit), 'newsHigher'), sigs: i3Winners(sixty, 930, 'nextOpen', limit) })),
  )
  const leads = [...daily.slice(0, 3), ...intraday, ...daily.slice(3)]
  if (leads.length * 2 !== NEWS_TRIALS) throw new Error(`expected ${NEWS_TRIALS} cells, got ${leads.length * 2}`)

  const won = leads.filter((l) => l.passed)
  const summaryEn = won.length ? `Passed: ${won.map((l) => l.id).join(', ')}.` : 'No lead passed: the news / no-news split does not give a tradable edge on the exam.'
  const summaryVi = won.length ? `Đạt: ${won.map((l) => l.id).join(', ')}.` : 'Không hướng nào đạt: việc chia theo có tin / không tin không cho lợi thế giao dịch được trên kỳ thi.'
  const out = {
    updated: new Date().toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
    markets: markets.length,
    failed,
    failedNews,
    news: { source: 'Alpaca News API v1beta1 (timestamps and symbols only)', fetchedFrom: NEWS_FROM, trustedFrom: covMonth, articles, symbols: names.length, meanPerSymbol: Math.round(articles / Math.max(1, names.length)) },
    split: { daily: { examFrom, days: days.length }, intraday: { examFrom: examFrom60, days: days60.length } },
    trials: { earlier: ALL_TRIALS, round4: NEWS_TRIALS, total: NEWS_ALL_TRIALS },
    costs: { assumption: 'Per-symbol tiers from replayIntraday (half-spread by median daily dollar volume: >$5B 0.5 bps, $1-5B 1.5, $0.2-1B 4, below 10; slippage 1 bp per market fill; fee 0), at 1x and 2x. Daily-lead tiers use each name\'s full-history median daily dollar volume.' },
    passRule: { en: PASS_RULE_EN, vi: PASS_RULE_VI },
    leads,
    summary: { en: summaryEn, vi: summaryVi },
    caveats: [
      'Only news timestamps and symbols are used, never headline text. An item tagged with a symbol counts as news for it, including multi-symbol roundups and ETF-wide items, so "no news" is a lower bound on quiet names and the news bucket is broad.',
      'News windows use 16:00 ET closes; on half days (13:00 close) late-afternoon items are counted as same-day. Alpaca does not document its earliest date, so signals before the measured archive start are dropped.',
      'The 60m N2 data covers only the last 730 days (about 170 exam days): N2 is underpowered. Survivorship bias as in the other labs (today\'s liquid names applied back).',
      'Per-trade excess for the difference test subtracts the mean of the same-bucket random-entry population for the trade\'s symbol and year (the 200 draws give the headline control and p).',
    ],
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`\n${markets.length - failed.length} markets in ${out.seconds}s; daily exam from ${examFrom}, intraday exam from ${examFrom60}`)
  console.log(summaryEn)
  for (const l of leads) console.log(l.passed ? 'PASS' : '    ', l.summary.en)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'failed')
  process.exit(1)
})
