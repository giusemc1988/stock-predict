/**
 * Atlas daily replay lab: do swing strategies (days to weeks) beat costs where 15-minute trading cannot?
 *
 * 1. Fetch Yahoo DAILY bars (free, since 2010) for the same liquid US stocks and ETFs as the 15m lab.
 *    Prices are scaled by adjclose/close so splits and dividends do not create fake moves.
 * 2. Run four published swing strategies (src/lib/replayDaily.ts): entry at the next day's open, stops on
 *    later highs/lows, the same per-side costs as the 15m lab.
 * 3. Split by date: the first 2/3 of days are the "book", the last 1/3 the "exam". Each strategy is also
 *    rerun at 0x, 1x and 2x costs. SPY buy-and-hold over the exam is shown next to them.
 *
 *   npm run replay:daily                          full run, writes public/replay-daily.json
 *   npm run replay:daily -- --symbols 8 --out x   quick run on the first 8 markets
 *
 * Paper only: nothing here places an order or changes live trading.
 */
import { writeFileSync } from 'node:fs'
import type { Candle } from '../src/types'
import { DEFAULT_AI_RULES } from '../src/lib/aiRules'
import { costsFrom } from '../src/lib/costs'
import { dayKey } from '../src/lib/practice'
import { buyHold, controlDaily, COST_MULTS, DAILY_STRATEGIES, evalDaily, runDaily, scaleCosts, type DailySignal, type DailyTrade, type Series } from '../src/lib/replayDaily'
import { STOCKS } from '../src/lib/replayUniverse'

const args = process.argv.slice(2)
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)
const OUT = arg('--out') ?? 'public/replay-daily.json'
const LIMIT = Number(arg('--symbols') ?? 0)
const FROM = Date.UTC(2010, 0, 1) / 1000

const UA = { 'User-Agent': 'Mozilla/5.0 (atlas replay lab)' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Quote = { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }

async function yahooDaily(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${FROM}&period2=${Math.floor(Date.now() / 1000)}`
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) {
      const json = (await res.json()) as { chart: { result?: { timestamp?: number[]; indicators: { quote: Quote[]; adjclose?: { adjclose: (number | null)[] }[] } }[] } }
      const r = json.chart.result?.[0]
      const q = r?.indicators.quote[0]
      const adj = r?.indicators.adjclose?.[0]?.adjclose
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

const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(3)}%`

async function main() {
  const t0 = Date.now()
  const markets = LIMIT ? STOCKS.slice(0, LIMIT) : STOCKS
  const universe: Series[] = []
  const failed: string[] = []
  let bars = 0
  for (const symbol of markets) {
    try {
      const b = await yahooDaily(symbol)
      bars += b.length
      universe.push({ symbol, bars: b })
      console.log(`${symbol}: ${b.length} bars`)
      await sleep(250)
    } catch (e) {
      failed.push(symbol)
      console.log(`${symbol}: failed (${e instanceof Error ? e.message : e})`)
    }
  }
  // book/exam cut: the day 2/3 of the way through SPY's history (the first 2/3 of days = book)
  const spy = universe.find((s) => s.symbol === 'SPY')?.bars ?? universe[0]?.bars ?? []
  const days = spy.map((b) => dayKey(b.time * 1000))
  const examFrom = days[Math.floor(days.length * (2 / 3))] ?? days[days.length - 1]
  const costs = costsFrom(DEFAULT_AI_RULES)
  const sigsAll = DAILY_STRATEGIES.map((s) => s.run(universe))
  const play = (sigs: DailySignal[]) => {
    const byCost: Record<number, DailyTrade[]> = {}
    for (const m of COST_MULTS) byCost[m] = runDaily(universe, sigs, scaleCosts(costs, m))
    return byCost
  }
  const runs = sigsAll.map(play)
  const controls = sigsAll.map((sigs, k) => controlDaily(universe, sigs, runs[k][1], examFrom, costs))
  const strategies = evalDaily(examFrom, DAILY_STRATEGIES, runs, controls)
  // D4 without the 5 symbols that contributed most on the exam (a diagnostic, picked on the exam on purpose)
  const d4 = DAILY_STRATEGIES.findIndex((x) => x.id === 'D4')
  const gain = new Map<string, number>()
  for (const t of runs[d4][1]) if (dayKey(t.openedAt) >= examFrom) gain.set(t.symbol, (gain.get(t.symbol) ?? 0) + t.retPct)
  const top5 = [...gain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k)
  const skip = new Set(universe.map((s, k) => (top5.includes(s.symbol) ? k : -1)))
  const sigs5 = sigsAll[d4].filter((x) => !skip.has(x.sym))
  const runs5 = play(sigs5)
  const d4Ex = evalDaily(examFrom, [DAILY_STRATEGIES[d4]], [runs5], [controlDaily(universe, sigs5, runs5[1], examFrom, costs)])[0]
  const d4ExTop5 = { removed: top5, exam: d4Ex.exam, examAvgByCost: d4Ex.examAvgByCost, control: d4Ex.control, excess: d4Ex.excess, p: d4Ex.p }
  const benchmark = { id: 'SPY', ...buyHold(spy, examFrom, costs) }
  const won = strategies.filter((x) => x.passed)
  const en = (won.length ? `Strategies with an edge over random entries on the exam: ${won.map((x) => x.id).join(', ')}.` : 'No strategy shows an edge over random entries on the exam.') + ' Raw return is NOT edge: a random-entry control with the same symbols, counts, exits and costs also earns money in a rising market. Judge the excess over control, not the average return.'
  const vi = (won.length ? `Chiến lược có lợi thế so với vào lệnh ngẫu nhiên trên bài thi: ${won.map((x) => `${x.id} (${x.vi})`).join('; ')}.` : 'Chưa chiến lược nào có lợi thế so với vào lệnh ngẫu nhiên trên bài thi.') + ' Lợi nhuận thô KHÔNG phải lợi thế: lệnh vào ngẫu nhiên (cùng mã, số lệnh, cách thoát và phí) cũng có lãi khi thị trường tăng. Hãy xem phần vượt trội so với nhóm đối chứng, không phải lợi nhuận trung bình.'
  const note = 'Raw average return is not edge: it includes market drift (the control earns it too). PASS needs excess over 200 seeded random-entry draws > 0 at 1x and 2x costs, p <= 0.05, 100+ exam trades and DSR >= 0.95. Survivorship bias: the list is today\'s liquid names applied back to 2010, so firms that fell out of the index or went bust are missing and results are flattered (the control shares this bias only partly, since the strategies can pick the winners). D4 is a proxy (gap + volume), not real earnings dates.'
  const noteVi = 'Lợi nhuận trung bình thô không phải lợi thế: nó gồm cả xu hướng chung của thị trường (nhóm đối chứng cũng hưởng). QUA cần vượt trội so với 200 lần vào lệnh ngẫu nhiên (có seed) > 0 ở phí 1x và 2x, p <= 0,05, từ 100 lệnh thi và DSR >= 0,95. Thiên lệch người sống sót: danh sách là các mã thanh khoản hôm nay áp ngược về 2010, nên các công ty đã rớt hạng hay phá sản bị bỏ sót và kết quả bị tô hồng (nhóm đối chứng chỉ chịu một phần, vì chiến lược có thể chọn trúng mã thắng). D4 chỉ là ước lượng (gap + khối lượng), không phải ngày báo cáo thật.'
  const out = {
    updated: new Date().toISOString(),
    markets: markets.length,
    failed,
    bars,
    seconds: Math.round((Date.now() - t0) / 1000),
    split: { bookDays: days.filter((d) => d < examFrom).length, examDays: days.filter((d) => d >= examFrom).length, examFrom },
    trades: runs.reduce((a, r) => a + r[1].length, 0),
    strategies,
    d4ExTop5,
    benchmark,
    en,
    vi,
    note,
    noteVi,
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(`\n${markets.length - failed.length} markets, ${bars} bars in ${out.seconds}s; exam from ${examFrom}`)
  console.log(en)
  for (const x of strategies) console.log(`${x.passed ? 'PASS' : '    '} ${x.id} book ${pct(x.book.avgRet)} (excess ${pct(x.excess.book)}) | exam n=${x.exam.n} WR=${(x.exam.winRate * 100).toFixed(0)}% 0x ${pct(x.examAvgByCost.x0)} 1x ${pct(x.examAvgByCost.x1)} 2x ${pct(x.examAvgByCost.x2)} | control 1x ${pct(x.control.examX1)} excess 1x ${pct(x.excess.examX1)} 2x ${pct(x.excess.examX2)} p=${x.p.x1.toFixed(3)}/${x.p.x2.toFixed(3)} DSR=${x.dsr.toFixed(2)}`)
  console.log(`D4 without ${top5.join(',')}: n=${d4Ex.exam.n} 1x ${pct(d4Ex.examAvgByCost.x1)} control ${pct(d4Ex.control.examX1)} excess 1x ${pct(d4Ex.excess.examX1)} 2x ${pct(d4Ex.excess.examX2)} p=${d4Ex.p.x1.toFixed(3)}/${d4Ex.p.x2.toFixed(3)}`)
  if (benchmark.retPct != null) console.log(`SPY buy-and-hold ${benchmark.from}..${benchmark.to}: ${pct(benchmark.retPct)}`)
  console.log(note)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
