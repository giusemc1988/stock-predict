/**
 * Atlas edge sweep (round 4): nine cheap published ideas on free data, each against its own random-entry or
 * random-timing control, then risk-parity "edge portfolios". Signals and statistics: src/lib/replayEdges.ts.
 *
 * Data (all free): Yahoo daily bars since 2007 (SPY, ^VIX, ^VIX3M, HYG, the shared stock universe), Cboe PUT and
 * BXM index histories (cdn.cboe.com), and, only when SEC_USER_AGENT is set (SEC asks every client to name itself
 * with a contact), the SEC Form 3/4/5 insider transaction data sets. Without it the insider idea is skipped.
 *
 * Book = first 2/3 of SPY trading days, exam = newest 1/3. Nothing is tuned on the exam. The Deflated Sharpe
 * counts every trial of every round (TRIAL_LEDGER, ALL_ROUNDS_TRIALS).
 *
 *   npm run replay:edges                     full run, writes public/replay-edges.json
 *   npm run replay:edges -- --symbols 12 --out x.json   quick run on the first 12 stocks
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import type { Costs } from '../src/lib/costs'
import { dayKey } from '../src/lib/practice'
import { controlDaily, d1Reversal, runDaily, scaleCosts, type Series } from '../src/lib/replayDaily'
import {
  ALL_ROUNDS_TRIALS, EDGES_TRIALS, HIGH_VOL, HOLDOUT_TRIALS, FOMC_ANNOUNCEMENTS, LAB_TRIALS, PASS_SWITCH_EN, PASS_SWITCH_VI, PASS_TRADES_EN, PASS_TRADES_VI, PAIR_RULE, TRIAL_LEDGER,
  barOnOrBefore, bookInvVol, clusterDays, ensembleStream, evalSwitch, evalTrades, eventGroups, eventReturns, eventStream, firstFinite, fomcEvents, hygSignal,
  insiderRows, olsBeta, opexWeeks, overnightRet, overnightSignals, pairPath, pairPool, pairTradeRet, pairTrades, poolControl, shiftControl,
  sleeveCorr, spreadZ, switchStream, turnOfMonthEvents, vixTsSignal, type EdgeEval, type Ev, type Group, type InsiderRow, type PairBars, type Sleeve, type SwitchEval, type TradeSet,
} from '../src/lib/replayEdges'
import { deflatedSharpe } from '../src/lib/replayLab'
import { addStream, gateSignals, legStream, perf, sideCost, vixDays, vixGate } from '../src/lib/replayRound2'
import { symbolCosts } from '../src/lib/replayIntraday'
import type { ControlDraws } from '../src/lib/replayDaily'
import { STOCKS } from '../src/lib/replayUniverse'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-edges.json'
const LIMIT = Number(arg('--symbols') ?? 0)
const EXCLUDE = new Set((arg('--exclude') ?? '').split(',').filter(Boolean)) // robustness runs: drop names from the stock universe
const FROM = Date.UTC(2007, 0, 1) / 1000
const UA = { 'User-Agent': 'Mozilla/5.0 (atlas replay lab)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const PAIRS: [string, string][] = [['KO', 'PEP'], ['XOM', 'CVX'], ['HD', 'LOW'], ['V', 'MA'], ['JPM', 'BAC'], ['GS', 'MS'], ['UPS', 'FDX'], ['WMT', 'TGT']]
/** Yearly expense ratios of the ETFs that track the Cboe indexes (PUTW 0.44%, XYLD 0.60%), charged daily. */
const INDEX_FEE = { PUT: 0.0044, BXM: 0.006 }

type Quote = { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }
type YahooJson = { chart: { result?: { timestamp?: number[]; indicators: { quote: Quote[]; adjclose?: { adjclose: (number | null)[] }[] } }[] } }

async function yahooDaily(symbol: string, adjust = true): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${FROM}&period2=${Math.floor(Date.now() / 1000)}`
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const r = ((await res.json()) as YahooJson).chart.result?.[0]
      const q = r?.indicators.quote[0]
      const adj = adjust ? r?.indicators.adjclose?.[0]?.adjclose : undefined
      if (!r?.timestamp || !q) return []
      const out: Candle[] = []
      r.timestamp.forEach((t, k) => {
        const [o, h, l, c, v] = [q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k]]
        if (o == null || h == null || l == null || c == null || !(c > 0)) return
        const f = adj?.[k] != null ? adj[k]! / c : 1
        out.push({ time: t, open: (o > 0 ? o : c) * f, high: h * f, low: l * f, close: c * f, volume: v ?? 0 })
      })
      return out
    }
    await sleep(1500 * (i + 1))
  }
  throw new Error(`Yahoo failed for ${symbol}`)
}

async function cboe(index: 'PUT' | 'BXM'): Promise<Map<string, number>> {
  const res = await fetch(`https://cdn.cboe.com/api/global/us_indices/daily_prices/${index}_History.csv`, { headers: UA })
  if (!res.ok) throw new Error(`Cboe ${index} ${res.status}`)
  const out = new Map<string, number>()
  for (const line of (await res.text()).split('\n').slice(1)) {
    const [d, v] = line.trim().split(',')
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d ?? '')
    if (m && Number(v) > 0) out.set(`${m[3]}-${m[1]}-${m[2]}`, Number(v))
  }
  return out
}

const medianDV = (bars: Candle[]) => {
  const v = bars.map((b) => b.close * b.volume).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : 0
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)

// ---- SEC insider data sets (optional) ----

const SEC_DIR = '.cache/sec'
async function insiderData(agent: string, symbols: string[]): Promise<{ rows: Map<string, InsiderRow[]>; quarters: number; failed: string[] }> {
  const h = { 'User-Agent': agent }
  const map = (await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: h })).json()) as Record<string, { cik_str: number; ticker: string }>
  const cikOf = new Map(Object.values(map).map((r) => [r.ticker.replace('.', '-'), String(r.cik_str)]))
  const symOf = new Map<string, string>()
  for (const s of symbols) if (cikOf.has(s)) symOf.set(cikOf.get(s)!, s)
  const issuers = new Set(symOf.keys())
  const rows = new Map<string, InsiderRow[]>()
  const failed: string[] = []
  mkdirSync(SEC_DIR, { recursive: true })
  let quarters = 0
  const now = new Date()
  for (let y = 2006; y <= now.getUTCFullYear(); y++) {
    for (let q = 1; q <= 4; q++) {
      if (Date.UTC(y, q * 3, 1) > now.getTime()) break
      const name = `${y}q${q}_form345.zip`
      const file = `${SEC_DIR}/${name}`
      try {
        if (!existsSync(file)) {
          const res = await fetch(`https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets/${name}`, { headers: h })
          if (!res.ok) throw new Error(String(res.status))
          writeFileSync(file, Buffer.from(await res.arrayBuffer()))
          await sleep(250) // SEC fair-access: well under 10 requests a second
        }
        const read = (t: string) => execFileSync('unzip', ['-p', file, t], { maxBuffer: 1 << 30 }).toString('utf8')
        for (const r of insiderRows(read('SUBMISSION.tsv'), read('REPORTINGOWNER.tsv'), read('NONDERIV_TRANS.tsv'), issuers)) {
          const s = symOf.get(r.cik)!
          if (!rows.has(s)) rows.set(s, [])
          rows.get(s)!.push(r)
        }
        quarters++
        console.log(`SEC ${name}: ok`)
      } catch (e) {
        failed.push(name)
        console.log(`SEC ${name}: failed (${e instanceof Error ? e.message : 'error'})`)
      }
    }
  }
  return { rows, quarters, failed }
}

async function main() {
  const t0 = Date.now()
  const stocks = (LIMIT ? [...STOCKS.slice(0, LIMIT), 'SPY'] : [...STOCKS]).filter((s) => !EXCLUDE.has(s))
  const need = [...new Set([...stocks, 'SPY', 'HYG', ...PAIRS.flat()])]
  const bars = new Map<string, Candle[]>()
  const failed: string[] = []
  for (const s of need) {
    try {
      bars.set(s, await yahooDaily(s))
      console.log(`${s}: ${bars.get(s)!.length} bars`)
      await sleep(200)
    } catch (e) {
      failed.push(s)
      console.log(`${s}: failed (${e instanceof Error ? e.message : 'error'})`)
    }
  }
  const vixBars = await yahooDaily('^VIX', false)
  const vix3mBars = await yahooDaily('^VIX3M', false)
  const [putIdx, bxmIdx] = [await cboe('PUT'), await cboe('BXM')]

  // calendar = SPY trading days
  const spyBars = bars.get('SPY')!
  const days = spyBars.map((b) => dayKey(b.time * 1000))
  const n = days.length
  const years = days.map((d) => Number(d.slice(0, 4)))
  const examIdx = Math.floor(n * (2 / 3))
  const examFrom = days[examIdx]
  const dayAt = new Map(days.map((d, i) => [d, i]))
  const aligned = (b: Candle[] | undefined, f: (c: Candle) => number) => {
    const out = new Array<number>(n).fill(NaN)
    for (const c of b ?? []) {
      const i = dayAt.get(dayKey(c.time * 1000))
      if (i != null) out[i] = f(c)
    }
    return out
  }
  const ffill = (a: number[]) => {
    let last = NaN
    return a.map((v) => (Number.isFinite(v) ? (last = v) : last))
  }
  const sOpen = spyBars.map((b) => b.open)
  const sClose = spyBars.map((b) => b.close)
  const costOf = new Map<string, Costs>()
  for (const [s, b] of bars) costOf.set(s, symbolCosts(medianDV(b)))
  const cSpy = costOf.get('SPY')!
  const side = sideCost(cSpy)
  const spyRet = sClose.map((c, i) => (i ? c / sClose[i - 1] - 1 : 0))

  // ---- trade-based ideas: TradeSet + control + daily sleeve ----
  type TradeIdea = { id: string; en: string; vi: string; t: TradeSet; c: ControlDraws; sleeve: Sleeve; sleeve2: number[]; note?: string; gate?: boolean }
  const trade: TradeIdea[] = []
  const split = (evs: Ev[], r1: number[], r2: number[]): TradeSet => {
    const t: TradeSet = { book1: [], exam1: [], exam2: [] }
    evs.forEach((e, k) => {
      if (days[e.b] < examFrom) t.book1.push(r1[k])
      else {
        t.exam1.push(r1[k])
        t.exam2.push(r2[k])
      }
    })
    return t
  }
  const c2Spy = scaleCosts(cSpy, 2)
  const calendar = (id: string, en: string, vi: string, evs: Ev[]): TradeIdea => ({
    id, en, vi,
    t: split(evs, eventReturns(sClose, evs, cSpy), eventReturns(sClose, evs, c2Spy)),
    c: poolControl(eventGroups(sClose, days, evs, examFrom, cSpy, c2Spy)),
    sleeve: { id, rets: eventStream(sClose, evs, side), start: evs.length ? evs[0].b + 1 : n },
    sleeve2: eventStream(sClose, evs, 2 * side),
  })
  const fomc = fomcEvents(days, FOMC_ANNOUNCEMENTS)
  trade.push(calendar('E-FOMC', 'Long SPY from the close before each scheduled FOMC announcement to the announcement-day close (Lucca & Moench 2015)', 'Mua SPY từ lúc đóng cửa hôm trước đến lúc đóng cửa ngày Fed công bố lãi suất (họp định kỳ)', fomc.events))
  trade.push(calendar('E-TOM', 'Turn of the month: long SPY from the close of the 2nd-to-last trading day to the close of the 3rd trading day of the next month (McConnell & Xu 2008)', 'Đầu tháng: mua SPY từ lúc đóng cửa ngày giao dịch áp chót của tháng đến lúc đóng cửa ngày giao dịch thứ 3 của tháng sau', turnOfMonthEvents(days)))
  const ow = opexWeeks(days)
  const opexIdea = calendar('E-OPEX', 'Long SPY in options-expiration weeks (close of the Friday before to the expiration close); counts only if the book is positive', 'Mua SPY trong tuần đáo hạn quyền chọn (đóng cửa thứ Sáu trước đến đóng cửa ngày đáo hạn); chỉ tính nếu book dương', ow.opex)
  opexIdea.gate = mean(opexIdea.t.book1) > 0
  opexIdea.note = `other weeks: book avg ${mean(eventReturns(sClose, ow.other.filter((e) => days[e.b] < examFrom), cSpy)).toFixed(3)}%, exam avg ${mean(eventReturns(sClose, ow.other.filter((e) => days[e.b] >= examFrom), cSpy)).toFixed(3)}%`
  trade.push(opexIdea)

  // pairs
  {
    const t: TradeSet = { book1: [], exam1: [], exam2: [] }
    const groups: Group[] = []
    const pnl = new Map<string, number>()
    const pnl2 = new Map<string, number>()
    const used: string[] = []
    let first = n
    for (const [a, b] of PAIRS) {
      if (!bars.has(a) || !bars.has(b)) continue
      const [oA, cA, oB, cB] = [aligned(bars.get(a), (x) => x.open), aligned(bars.get(a), (x) => x.close), aligned(bars.get(b), (x) => x.open), aligned(bars.get(b), (x) => x.close)]
      const ok = (i: number) => Number.isFinite(cA[i]) && Number.isFinite(cB[i]) && Number.isFinite(oA[i]) && Number.isFinite(oB[i])
      let s0 = 0
      while (s0 < n && !ok(s0)) s0++
      for (let i = s0; i < n; i++) if (!ok(i)) s0 = i + 1 // start after the last gap, so the slice is complete
      if (s0 >= examIdx - 500) continue
      const p: PairBars = { days: days.slice(s0), oA: oA.slice(s0), cA: cA.slice(s0), oB: oB.slice(s0), cB: cB.slice(s0) }
      const la = p.cA.map(Math.log)
      const lb = p.cB.map(Math.log)
      const bookN = examIdx - s0
      const beta = olsBeta(lb.slice(0, bookN), la.slice(0, bookN)) // fitted on the book only
      if (!(beta > 0)) continue
      used.push(`${a}/${b} beta ${beta.toFixed(2)}`)
      first = Math.min(first, s0 + 60)
      const [ca, cb] = [costOf.get(a)!, costOf.get(b)!]
      const [ca2, cb2] = [scaleCosts(ca, 2), scaleCosts(cb, 2)]
      const trades = pairTrades(spreadZ(la, lb, beta, 60), PAIR_RULE)
      const byLen = new Map<string, { len: number; close: boolean; book: number; exam: number }>()
      for (const tr of trades) {
        const r1 = pairTradeRet(p, tr, beta, ca, cb)
        const r2 = pairTradeRet(p, tr, beta, ca2, cb2)
        const exam = p.days[tr.e] >= examFrom
        if (exam) {
          t.exam1.push(r1)
          t.exam2.push(r2)
        } else t.book1.push(r1)
        const k = `${tr.x - tr.e}|${tr.exitClose}`
        const g = byLen.get(k) ?? { len: tr.x - tr.e, close: tr.exitClose, book: 0, exam: 0 }
        g[exam ? 'exam' : 'book']++
        byLen.set(k, g)
        for (const [d, r] of pairPath(p, tr, beta, r1)) pnl.set(d, (pnl.get(d) ?? 0) + r)
        for (const [d, r] of pairPath(p, tr, beta, r2)) pnl2.set(d, (pnl2.get(d) ?? 0) + r)
      }
      for (const g of byLen.values()) groups.push({ want: { book: g.book, exam: g.exam }, pool: pairPool(p, g.len, g.close, examFrom, beta, [ca, cb], [ca2, cb2]) })
    }
    const k0 = Math.max(1, used.length) // capital split equally across the pairs
    trade.push({
      id: 'E-PAIRS',
      en: `Pairs: ${PAIRS.map((x) => x.join('/')).join(', ')}; book-period hedge ratio, 60-day z-score of the log spread, in at |z| > 2 (next open), out at |z| < 0.5 (next open) or day 20 (close); no borrow fee`,
      vi: 'Giao dịch cặp: 8 cặp cổ phiếu cùng ngành, tỉ lệ phòng hộ ước lượng trên book, z-score 60 ngày của chênh lệch log giá, vào khi |z| > 2, ra khi |z| < 0,5 hoặc sau 20 ngày',
      t,
      c: poolControl(groups),
      sleeve: { id: 'E-PAIRS', rets: days.map((d) => (pnl.get(d) ?? 0) / k0), start: first },
      sleeve2: days.map((d) => (pnl2.get(d) ?? 0) / k0),
      note: used.join('; '),
    })
  }

  // overnight winners on daily bars
  const overnightIdea = (list: string[]): TradeIdea => {
    const t: TradeSet = { book1: [], exam1: [], exam2: [] }
    const groups: Group[] = []
    const byDay = new Map<string, number[]>()
    const byDay2 = new Map<string, number[]>()
    for (const s of list) {
      const b = bars.get(s)
      if (!b || b.length < 300) continue
      const c1 = costOf.get(s)!
      const c2 = scaleCosts(c1, 2)
      const g: Group = { want: { book: 0, exam: 0 }, pool: { book: { r1: [], r2: [] }, exam: { r1: [], r2: [] } } }
      for (let i = 21; i + 1 < b.length; i++) {
        const h = dayKey(b[i].time * 1000) >= examFrom ? 'exam' : 'book'
        g.pool[h].r1.push(overnightRet(b, i, c1))
        g.pool[h].r2.push(overnightRet(b, i, c2))
      }
      for (const i of overnightSignals(b)) {
        const r1 = overnightRet(b, i, c1)
        const r2 = overnightRet(b, i, c2)
        const d = dayKey(b[i + 1].time * 1000)
        if (dayKey(b[i].time * 1000) >= examFrom) {
          t.exam1.push(r1)
          t.exam2.push(r2)
          g.want.exam++
        } else {
          t.book1.push(r1)
          g.want.book++
        }
        byDay.set(d, [...(byDay.get(d) ?? []), r1 / 100])
        byDay2.set(d, [...(byDay2.get(d) ?? []), r2 / 100])
      }
      groups.push(g)
    }
    const slot = (a: number[] | undefined) => (a?.length ? (mean(a) * Math.min(a.length, 10)) / 10 : 0) // 10 slots of 10%
    return {
      id: 'E-OVERNIGHT',
      en: 'Buy the close of a 3%+ up day on 2x its 20-day volume, sell the next open (daily-bar version of round 3)',
      vi: 'Mua lúc đóng cửa ngày tăng 3%+ với khối lượng gấp đôi trung bình 20 ngày, bán lúc mở cửa hôm sau',
      t,
      c: poolControl(groups),
      sleeve: { id: 'E-OVERNIGHT', rets: days.map((d) => slot(byDay.get(d))), start: 21 },
      sleeve2: days.map((d) => slot(byDay2.get(d))),
    }
  }
  trade.push(overnightIdea(stocks))
  const onRobust = overnightIdea(stocks.filter((s) => !HIGH_VOL.has(s)))

  // insider clusters (optional)
  const universe: Series[] = stocks.filter((s) => bars.has(s)).map((s) => ({ symbol: s, bars: bars.get(s)! }))
  const perSym = (sym: string) => costOf.get(sym) ?? null
  const legSleeve = (trs: ReturnType<typeof runDaily>, k0: number) => {
    const tot = new Map<string, number>()
    for (const tr of trs) {
      const b = universe.find((u) => u.symbol === tr.symbol)!.bars
      addStream(tot, legStream(b, tr.entryBar!, tr.entry!, tr.exitBar!, tr.exit!, tr.retPct / 100), 1)
    }
    return days.map((d) => (tot.get(d) ?? 0) / k0)
  }
  const agent = process.env.SEC_USER_AGENT
  let insiderNote = 'skipped: SEC_USER_AGENT is not set (SEC asks every client to send a User-Agent with a contact)'
  if (agent) {
    const ins = await insiderData(agent, universe.map((u) => u.symbol))
    const sigs = universe.flatMap((u, sym) => {
      const bd = u.bars.map((b) => dayKey(b.time * 1000))
      return clusterDays(ins.rows.get(u.symbol) ?? [], 2, 30)
        .map((d) => barOnOrBefore(bd, d))
        .filter((i) => i >= 14 && i + 60 < u.bars.length)
        .map((i) => ({ sym, i, hold: 60, stopDist: null, targetDist: null }))
    })
    const r1 = runDaily(universe, sigs, perSym)
    const r2 = runDaily(universe, sigs, (s) => scaleCosts(perSym(s), 2))
    const t: TradeSet = { book1: [], exam1: [], exam2: [] }
    r1.forEach((tr, k) => {
      if (dayKey(tr.openedAt) >= examFrom) {
        t.exam1.push(tr.retPct)
        t.exam2.push(r2[k].retPct)
      } else t.book1.push(tr.retPct)
    })
    insiderNote = `${ins.quarters} quarters read, ${ins.failed.length} failed; ${sigs.length} cluster signals, ${r1.length} trades`
    trade.push({
      id: 'E-INSIDER',
      en: 'SEC Form 4 open-market purchases (code P) by 2+ distinct officers/directors within 30 days: buy the next open after the filing, hold 60 trading days',
      vi: 'Lãnh đạo mua cổ phiếu (Form 4, mã P): từ 2 giám đốc/thành viên HĐQT khác nhau mua trong 30 ngày thì mua ở giá mở cửa sau ngày nộp, giữ 60 phiên',
      t,
      c: controlDaily(universe, sigs, r1, examFrom, perSym),
      sleeve: { id: 'E-INSIDER', rets: legSleeve(r1, 10), start: 0 },
      sleeve2: legSleeve(r2, 10),
      note: insiderNote,
    })
  }

  // ---- switches ----
  type SwitchIdea = { id: string; en: string; vi: string; sig?: number[]; x1: number[]; x2: number[]; start: number; invested: number; note?: string }
  const sw: SwitchIdea[] = []
  const vix = aligned(vixBars, (c) => c.close)
  const vix3m = aligned(vix3mBars, (c) => c.close)
  {
    const sig = vixTsSignal(ffill(vix), ffill(vix3m))
    const start = firstFinite(vix3m) + 1
    sw.push({ id: 'E-VIXTS', en: 'Hold SPY when the VIX closes below the 3-month VIX (contango), else cash', vi: 'Giữ SPY khi VIX thấp hơn VIX 3 tháng (cấu trúc kỳ hạn bình thường), ngược lại để tiền mặt', sig, x1: switchStream(sOpen, sClose, sig, side), x2: switchStream(sOpen, sClose, sig, 2 * side), start, invested: mean(sig.slice(start)) })
  }
  {
    const hyg = ffill(aligned(bars.get('HYG'), (c) => c.close))
    const sig = hygSignal(hyg, 20)
    const start = firstFinite(hyg) + 21
    sw.push({ id: 'E-HYG', en: "Hold SPY when HYG's 20-day return is above 0 at the prior close, else cash", vi: 'Giữ SPY khi trái phiếu lợi suất cao HYG tăng trong 20 ngày qua, ngược lại để tiền mặt', sig, x1: switchStream(sOpen, sClose, sig, side), x2: switchStream(sOpen, sClose, sig, 2 * side), start, invested: mean(sig.slice(start)) })
  }
  for (const [id, idx] of [['PUT', putIdx], ['BXM', bxmIdx]] as const) {
    const lv = ffill(days.map((d) => idx.get(d) ?? NaN))
    const start = firstFinite(lv) + 1
    const fee = INDEX_FEE[id] / 252
    const r = lv.map((v, i) => (i >= start && lv[i - 1] > 0 ? v / lv[i - 1] - 1 : 0))
    sw.push({
      id: `E-${id}`,
      en: id === 'PUT' ? 'Cboe PUT index (sell 1-month at-the-money SPX puts, cash secured), minus a 0.44%/yr ETF fee' : 'Cboe BXM index (buy SPX, sell 1-month at-the-money calls), minus a 0.60%/yr ETF fee',
      vi: id === 'PUT' ? 'Chỉ số PUT của Cboe (bán quyền chọn bán SPX 1 tháng, có tiền đảm bảo), trừ phí ETF 0,44%/năm' : 'Chỉ số BXM của Cboe (mua SPX, bán quyền chọn mua 1 tháng), trừ phí ETF 0,60%/năm',
      x1: r.map((x, i) => (i >= start ? x - fee : 0)),
      x2: r.map((x, i) => (i >= start ? x - 2 * fee : 0)),
      start,
      invested: 1,
      note: 'index level, not a traded fund; 2x costs = 2x the ETF fee',
    })
  }

  // ---- L1 lead (already counted in round 2) as a portfolio sleeve ----
  const vd = vixDays(vixBars)
  const l1Sigs = gateSignals(universe, d1Reversal(universe), vixGate(vd, 'A'))
  const l1r1 = runDaily(universe, l1Sigs, perSym)
  const l1r2 = runDaily(universe, l1Sigs, (s) => scaleCosts(perSym(s), 2))
  const l1Sleeve: Sleeve = { id: 'L1-D1-VIXA', rets: legSleeve(l1r1, 50), start: 260 }
  const l1Sleeve2 = legSleeve(l1r2, 50)

  // ---- judge ----
  // One unit for the luck spread between trials: the per-day Sharpe of each idea's exam return stream.
  const sleevesAll: Sleeve[] = [...trade.map((x) => x.sleeve), ...sw.map((x) => ({ id: x.id, rets: x.x1, start: x.start })), l1Sleeve]
  const sleeves2 = [...trade.map((x) => x.sleeve2), ...sw.map((x) => x.x2), l1Sleeve2]
  const examRets = (s: Sleeve) => s.rets.slice(Math.max(s.start, examIdx))
  const evals: EdgeEval[] = trade.map((x) => {
    const e = evalTrades(x.id, x.en, x.vi, x.t, x.c, HOLDOUT_TRIALS, deflatedSharpe(examRets(x.sleeve), HOLDOUT_TRIALS))
    if (x.gate === false) e.passed = false
    return e
  })
  const switches: SwitchEval[] = sw.map((x) =>
    evalSwitch(x.id, x.en, x.vi, {
      days, years, start: x.start, examIdx, spy: spyRet, x1: x.x1, x2: x.x2, invested: x.invested, trials: HOLDOUT_TRIALS,
      shift: x.sig ? shiftControl(sOpen, sClose, x.sig, side, x.start, examIdx, years) : undefined,
    }),
  )
  const labDsr = (r: number[]) => deflatedSharpe(r, LAB_TRIALS)

  // ---- portfolios (risk parity = inverse book volatility, monthly rebalance) ----
  const survivors = new Set([...evals.filter((e) => e.passed).map((e) => e.id), ...switches.filter((s) => s.passed).map((s) => s.id)])
  const port = (id: string, en: string, vi: string, pick: (s: Sleeve) => boolean) => {
    const iv = bookInvVol(sleevesAll, examIdx)
    const w = sleevesAll.map((s, k) => (pick(s) ? iv[k] : 0))
    if (!w.some((x) => x > 0)) return null
    const e1 = ensembleStream(sleevesAll, w, days)
    const e2 = ensembleStream(sleevesAll.map((s, k) => ({ ...s, rets: sleeves2[k] })), w, days)
    const tot = w.reduce((a, b) => a + b, 0)
    const ev = evalSwitch(id, en, vi, { days, years, start: e1.start, examIdx, spy: spyRet, x1: e1.rets, x2: e2.rets, invested: 1, trials: HOLDOUT_TRIALS })
    return { ...ev, weights: Object.fromEntries(sleevesAll.map((s, k) => [s.id, +(w[k] / tot).toFixed(3)]).filter(([, x]) => (x as number) > 0)) }
  }
  const portfolios = [
    port('P-SURVIVORS', 'Risk-parity portfolio of the ideas that passed', 'Danh mục chia vốn theo rủi ro của các ý tưởng đã qua', (s) => survivors.has(s.id)),
    port('P-ALL', 'Risk-parity portfolio of every idea tried here plus lead L1 (information: most sleeves failed on their own)', 'Danh mục chia vốn theo rủi ro của mọi ý tưởng đã thử và hướng L1 (chỉ để tham khảo)', () => true),
  ].filter((x) => x != null)

  const corr: Record<string, Record<string, number>> = {}
  const examSleeves = sleevesAll.map((s) => ({ ...s, rets: s.rets.slice(examIdx), start: Math.max(0, s.start - examIdx) }))
  for (const a of examSleeves) {
    corr[a.id] = {}
    for (const b of examSleeves) corr[a.id][b.id] = +sleeveCorr(a, b).toFixed(2)
  }
  const sleeveStats = sleevesAll.map((s, k) => ({ id: s.id, exam: perf(s.rets.slice(Math.max(s.start, examIdx)), years.slice(Math.max(s.start, examIdx)), 252), exam2x: perf(sleeves2[k].slice(Math.max(s.start, examIdx)), years.slice(Math.max(s.start, examIdx)), 252), dsrLab: labDsr(s.rets.slice(Math.max(s.start, examIdx))) }))

  const won = [...evals.filter((e) => e.passed).map((e) => e.id), ...switches.filter((s) => s.passed).map((s) => s.id), ...portfolios.filter((p) => p.passed).map((p) => p.id)]
  const out = {
    updated: new Date().toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
    markets: need.length,
    failed,
    split: { from: days[0], examFrom, days: n },
    trials: { ledger: TRIAL_LEDGER, total: ALL_ROUNDS_TRIALS, holdout: HOLDOUT_TRIALS, round4Edges: EDGES_TRIALS, labConvention: LAB_TRIALS },
    costs: 'Per-symbol tiers (half-spread by median daily dollar volume: >$5B 0.5 bps, $1-5B 1.5, $0.2-1B 4, below 10; slippage 1 bp per fill; fee 0), at 1x and 2x.',
    passRule: { trades: { en: PASS_TRADES_EN, vi: PASS_TRADES_VI }, switches: { en: PASS_SWITCH_EN, vi: PASS_SWITCH_VI } },
    trades: evals.map((e, k) => ({ ...e, dsrLab: labDsr(examRets(trade[k].sleeve)), note: trade[k].note })),
    switches: switches.map((s, k) => ({ ...s, dsrLab: labDsr(sw[k].x1.slice(Math.max(sw[k].start, examIdx))), note: sw[k].note })),
    portfolios,
    robustness: { overnightWithoutHighVol: { dropped: [...HIGH_VOL], ...evalTrades('E-OVERNIGHT-exHV', 'Overnight winners without the 14 high-volatility names', 'Qua đêm, bỏ 14 mã biến động mạnh', onRobust.t, onRobust.c, HOLDOUT_TRIALS, deflatedSharpe(examRets(onRobust.sleeve), HOLDOUT_TRIALS)) } },
    sleeves: sleeveStats,
    examCorrelation: corr,
    fomcSkipped: fomc.skipped,
    insider: insiderNote,
    summary: {
      en: won.length ? `Passed: ${won.join(', ')}.` : `Nothing passed with ${HOLDOUT_TRIALS} trials counted.`,
      vi: won.length ? `Đạt: ${won.join(', ')}.` : `Không ý tưởng nào đạt khi tính cả ${HOLDOUT_TRIALS} lần thử.`,
    },
    caveats: [
      'Survivorship: today\'s liquid names applied back to 2007 (pairs, overnight, L1).',
      'Shorts in pairs pay no borrow fee. PUT/BXM are index levels, not fund returns (fees approximated).',
      'Switch and calendar ideas are long SPY part of the time: they are judged on Sharpe and drawdown against SPY over the same days, not on raw return.',
      'L1 is included in the portfolios as a sleeve but was counted (and failed DSR) in round 2.',
    ],
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`\nexam from ${examFrom}, ${n} days, ${out.seconds}s, trials ${HOLDOUT_TRIALS}`)
  for (const e of out.trades) console.log(`${e.passed ? 'PASS' : '    '} ${e.id}: exam n=${e.exam.n} avg ${e.exam.avg1x.toFixed(3)}% (2x ${e.exam.avg2x.toFixed(3)}) excess ${e.exam.excess1x.toFixed(3)} p ${e.exam.p1x.toFixed(3)}/${e.exam.p2x.toFixed(3)} book ex ${e.book.excess.toFixed(3)} dsr ${e.dsr.toFixed(3)} (per trade ${e.dsrTrades.toFixed(3)}, lab N ${e.dsrLab.toFixed(3)})`)
  for (const s of [...out.switches, ...portfolios]) console.log(`${s.passed ? 'PASS' : '    '} ${s.id}: exam Sharpe ${s.x1.exam.sharpe.toFixed(2)} (2x ${s.x2.exam.sharpe.toFixed(2)}) vs SPY ${s.spy.exam.sharpe.toFixed(2)}, maxDD ${s.x1.exam.maxDD.toFixed(1)} vs ${s.spy.exam.maxDD.toFixed(1)}, book Sharpe ${s.x1.book.sharpe.toFixed(2)} vs ${s.spy.book.sharpe.toFixed(2)} DD ${s.x1.book.maxDD.toFixed(1)} vs ${s.spy.book.maxDD.toFixed(1)}, shift p ${s.shift?.p.toFixed(3) ?? '-'}, dsr ${s.dsr.toFixed(3)}`)
  console.log(out.summary.en)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : 'failed')
  process.exit(1)
})
