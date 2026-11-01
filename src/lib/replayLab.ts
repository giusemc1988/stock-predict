/**
 * Replay lab statistics: find simple filter rules on the older "book" part of replayed trades and keep
 * only those that also win on the newer "exam" part and pass a Deflated Sharpe check
 * (Bailey & López de Prado 2014) for how many rules were tried. Pure functions; scripts/replay-lab.ts
 * produces the trades.
 */
import { dayKey } from './practice'

export interface ReplayTrade {
  symbol: string
  asset: 'stock' | 'crypto'
  openedAt: number
  /** Return on the money put in, after fees, spread and slippage, percent. */
  retPct: number
  exitReason: string
  volVsAvg: number | null
  gainPct: number | null
  grade: string | null
  tradeScore: number | null
  regime: string | null
  score: number
  stopPct: number
  /** SPY's move so far today at entry, percent (stocks). */
  spyDay: number | null
}

export interface Stats {
  n: number
  winRate: number
  avgRet: number
  pf: number
  /** Mean / standard deviation of per-trade returns. */
  sharpe: number
}

export interface RuleResult {
  name: string
  vi: string
  book: Stats
  exam: Stats
  /** Probability the book Sharpe is real after the number of rules tried (needs >= 0.95). */
  dsr: number
  passed: boolean
}

interface Cond {
  feature: string
  name: string
  vi: string
  test: (t: ReplayTrade) => boolean
}

const hourET = (ms: number) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(new Date(ms))) % 24

const num = (f: (t: ReplayTrade) => number | null, op: '>=' | '<', x: number) => (t: ReplayTrade) => {
  const v = f(t)
  return v != null && (op === '>=' ? v >= x : v < x)
}

export const CONDITIONS: Cond[] = [
  ...[0.5, 1, 1.5, 2].map((x) => ({ feature: 'vol', name: `volume >= ${x}x`, vi: `khối lượng ≥ ${x}x`, test: num((t) => t.volVsAvg, '>=', x) })),
  { feature: 'vol', name: 'volume < 1x', vi: 'khối lượng < 1x', test: num((t) => t.volVsAvg, '<', 1) },
  { feature: 'gain', name: 'down today', vi: 'đang giảm trong ngày', test: num((t) => t.gainPct, '<', 0) },
  ...[0, 3, 6, 10].map((x) => ({ feature: 'gain', name: `up >= ${x}% today`, vi: `tăng ≥ ${x}% trong ngày`, test: num((t) => t.gainPct, '>=', x) })),
  { feature: 'gain', name: 'up < 6% today', vi: 'tăng < 6% trong ngày', test: num((t) => t.gainPct, '<', 6) },
  { feature: 'hour', name: 'stock, before 11:00 ET', vi: 'cổ phiếu, trước 11h NY', test: (t) => t.asset === 'stock' && hourET(t.openedAt) < 11 },
  { feature: 'hour', name: 'stock, 11:00-14:00 ET', vi: 'cổ phiếu, 11h-14h NY', test: (t) => t.asset === 'stock' && hourET(t.openedAt) >= 11 && hourET(t.openedAt) < 14 },
  { feature: 'hour', name: 'stock, after 14:00 ET', vi: 'cổ phiếu, sau 14h NY', test: (t) => t.asset === 'stock' && hourET(t.openedAt) >= 14 },
  { feature: 'grade', name: 'grade A', vi: 'điểm A', test: (t) => t.grade === 'A' },
  { feature: 'grade', name: 'grade A or B', vi: 'điểm A hoặc B', test: (t) => t.grade === 'A' || t.grade === 'B' },
  ...[60, 70].map((x) => ({ feature: 'ts', name: `trade score >= ${x}`, vi: `Trade Score ≥ ${x}`, test: num((t) => t.tradeScore, '>=', x) })),
  { feature: 'regime', name: 'high volatility', vi: 'biến động cao', test: (t) => t.regime === 'high' },
  { feature: 'regime', name: 'normal volatility', vi: 'biến động bình thường', test: (t) => t.regime === 'normal' },
  ...[0.4, 0.6].map((x) => ({ feature: 'score', name: `analyst score >= ${x}`, vi: `điểm phân tích ≥ ${x}`, test: num((t) => t.score, '>=', x) })),
  { feature: 'stop', name: 'stop < 1% away', vi: 'cắt lỗ < 1%', test: num((t) => t.stopPct, '<', 1) },
  { feature: 'stop', name: 'stop >= 1% away', vi: 'cắt lỗ ≥ 1%', test: num((t) => t.stopPct, '>=', 1) },
  { feature: 'stop', name: 'stop >= 2% away', vi: 'cắt lỗ ≥ 2%', test: num((t) => t.stopPct, '>=', 2) },
  { feature: 'spy', name: 'SPY up today', vi: 'SPY đang tăng', test: num((t) => t.spyDay, '>=', 0) },
  { feature: 'spy', name: 'SPY down today', vi: 'SPY đang giảm', test: num((t) => t.spyDay, '<', 0) },
  { feature: 'spy', name: 'SPY up >= 0.5% today', vi: 'SPY tăng ≥ 0.5%', test: num((t) => t.spyDay, '>=', 0.5) },
  { feature: 'asset', name: 'stocks only', vi: 'chỉ cổ phiếu', test: (t) => t.asset === 'stock' },
  { feature: 'asset', name: 'crypto only', vi: 'chỉ crypto', test: (t) => t.asset === 'crypto' },
]

export function stats(rows: { retPct: number }[]): Stats {
  const n = rows.length
  if (!n) return { n: 0, winRate: 0, avgRet: 0, pf: 0, sharpe: 0 }
  const r = rows.map((t) => t.retPct)
  const mean = r.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1))
  const gw = r.filter((x) => x > 0).reduce((a, b) => a + b, 0)
  const gl = -r.filter((x) => x <= 0).reduce((a, b) => a + b, 0)
  return { n, winRate: r.filter((x) => x > 0).length / n, avgRet: mean, pf: gl > 0 ? gw / gl : gw > 0 ? 99 : 0, sharpe: sd > 0 ? mean / sd : 0 }
}

// standard normal CDF (Abramowitz-Stegun 7.1.26) and inverse (Acklam)
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2)
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2
}
export function normInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12)
  if (q < 0.02425) {
    const u = Math.sqrt(-2 * Math.log(q))
    return (((((c[0] * u + c[1]) * u + c[2]) * u + c[3]) * u + c[4]) * u + c[5]) / ((((d[0] * u + d[1]) * u + d[2]) * u + d[3]) * u + 1)
  }
  if (q > 1 - 0.02425) return -normInv(1 - q)
  const u = q - 0.5
  const r = u * u
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * u) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** Deflated Sharpe Ratio: P(true Sharpe > the best you would expect from `trials` lucky tries). */
export function deflatedSharpe(rets: number[], trials: number, trialSharpeVar: number): number {
  const n = rets.length
  if (n < 3) return 0
  const mean = rets.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
  if (!(sd > 0)) return 0
  const sr = mean / sd
  const skew = rets.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / n
  const kurt = rets.reduce((a, b) => a + ((b - mean) / sd) ** 4, 0) / n
  const EM = 0.5772156649
  const N = Math.max(2, trials)
  const sr0 = Math.sqrt(Math.max(trialSharpeVar, 0)) * ((1 - EM) * normInv(1 - 1 / N) + EM * normInv(1 - 1 / (N * Math.E)))
  const denom = Math.sqrt(Math.max(1e-9, 1 - skew * sr + ((kurt - 1) / 4) * sr * sr))
  return normCdf(((sr - sr0) * Math.sqrt(n - 1)) / denom)
}

const pct = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(3)}%`

export function mineRules(trades: ReplayTrade[], opts: { bookShare?: number; minBook?: number; minExam?: number } = {}) {
  const days = [...new Set(trades.map((t) => dayKey(t.openedAt)))].sort()
  const cut = days[Math.floor(days.length * (opts.bookShare ?? 2 / 3))] ?? days[days.length - 1]
  const book = trades.filter((t) => dayKey(t.openedAt) < cut)
  const exam = trades.filter((t) => dayKey(t.openedAt) >= cut)
  const minBook = opts.minBook ?? Math.max(30, Math.round(book.length * 0.03))
  const minExam = opts.minExam ?? 15
  const base = { book: stats(book), exam: stats(exam) }

  // every single condition and every pair from two different features
  const candidates: { name: string; vi: string; test: (t: ReplayTrade) => boolean }[] = CONDITIONS.map((c) => ({ name: c.name, vi: c.vi, test: c.test }))
  for (let i = 0; i < CONDITIONS.length; i++)
    for (let j = i + 1; j < CONDITIONS.length; j++) {
      const [a, b] = [CONDITIONS[i], CONDITIONS[j]]
      if (a.feature === b.feature) continue
      candidates.push({ name: `${a.name} + ${b.name}`, vi: `${a.vi} + ${b.vi}`, test: (t) => a.test(t) && b.test(t) })
    }
  const tried = candidates.map((c) => ({ c, bookRows: book.filter(c.test) })).filter((x) => x.bookRows.length >= minBook)
  const srs = tried.map((x) => stats(x.bookRows).sharpe)
  const mu = srs.reduce((a, b) => a + b, 0) / Math.max(1, srs.length)
  const srVar = srs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, srs.length - 1)

  const results: RuleResult[] = tried
    .map(({ c, bookRows }) => {
      const b = stats(bookRows)
      const e = stats(exam.filter(c.test))
      const dsr = deflatedSharpe(bookRows.map((t) => t.retPct), tried.length, srVar)
      const passed = b.avgRet > 0 && b.avgRet > base.book.avgRet && e.n >= minExam && e.avgRet > 0 && e.avgRet > base.exam.avgRet && dsr >= 0.95
      return { name: c.name, vi: c.vi, book: b, exam: e, dsr, passed }
    })
    // the best on the book first: that is all a rule search may look at
    .sort((x, y) => Number(y.passed) - Number(x.passed) || y.book.sharpe - x.book.sharpe)

  const passed = results.filter((r) => r.passed)
  const vi = passed.length
    ? `${passed.length}/${results.length} luật qua bài thi. Tốt nhất: "${passed[0].vi}" (sách ${pct(passed[0].book.avgRet)}/lệnh, thi ${pct(passed[0].exam.avgRet)}/lệnh, không lọc: ${pct(base.exam.avgRet)}).`
    : `Không luật nào qua bài thi (đã thử ${results.length} luật). Không lọc: sách ${pct(base.book.avgRet)}/lệnh, thi ${pct(base.exam.avgRet)}/lệnh.`
  return {
    split: { bookDays: days.filter((d) => d < cut).length, examDays: days.filter((d) => d >= cut).length, examFrom: cut },
    trades: trades.length,
    base,
    tried: results.length,
    rules: results,
    vi,
  }
}

export interface StrategyResult {
  id: string
  vi: string
  book: Stats
  exam: Stats
  dsr: number
  passed: boolean
}

/** Judge whole strategies on the same split as the rule search: positive and better than Atlas as it is
 *  on the exam, and a Deflated Sharpe >= 0.95 counting every strategy tried (Atlas included). */
export function evalStrategies(examFrom: string, atlas: { retPct: number; openedAt: number }[], runs: { id: string; vi: string; trades: { retPct: number; openedAt: number }[] }[]): StrategyResult[] {
  const split = (rows: { retPct: number; openedAt: number }[]) => [rows.filter((t) => dayKey(t.openedAt) < examFrom), rows.filter((t) => dayKey(t.openedAt) >= examFrom)]
  const [ab, ae] = split(atlas)
  const base = { book: stats(ab), exam: stats(ae) }
  const all = [{ id: 'S0', vi: 'Atlas như hiện tại', trades: atlas }, ...runs]
  const books = all.map((r) => split(r.trades)[0])
  const srs = books.map((b) => stats(b).sharpe)
  const mu = srs.reduce((a, b) => a + b, 0) / srs.length
  const v = srs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, srs.length - 1)
  return all.map((r, k) => {
    const [b, e] = split(r.trades)
    const book = stats(b)
    const exam = stats(e)
    const dsr = deflatedSharpe(b.map((t) => t.retPct), all.length, v)
    const passed = r.id !== 'S0' && book.avgRet > 0 && exam.n >= 15 && exam.avgRet > 0 && exam.avgRet > base.exam.avgRet && dsr >= 0.95
    return { id: r.id, vi: r.vi, book, exam, dsr, passed }
  }).map((x, k) => (k === 0 ? { ...x, book: base.book, exam: base.exam } : x))
}
