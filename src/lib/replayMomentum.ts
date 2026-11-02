/**
 * Atlas momentum lab (round 5): cross-sectional 12-1 month momentum, rebalanced once a month, long only.
 * Idea (Jegadeesh & Titman 1993; Israel, Moskowitz, Ross & Serban on live trading costs): hold the names with
 * the best return from month-end k-12 to k-1 (the last month is skipped), equal weight, fill at the next open.
 *
 * Why this is a different test from the older rounds: it trades once a month, so costs are small, and it ranks
 * names against each other instead of timing one name.
 *
 * Honest limits, built into the pass rule:
 *  - The stock list is today's liquid names (survivor-biased). The control picks RANDOM names from the same list
 *    on the same dates with the same costs, so the survivor drift cancels in the excess, but a ranking that
 *    mostly finds "names that later became big" cannot be told apart from skill. So a stock result alone never
 *    passes: the same rule must also pass on a universe with no survivors, ETFs (sectors, countries, styles).
 *  - Trials are counted in TRIAL_LEDGER (momentumRound5).
 * Paper only; the live Atlas never reads this file.
 */
import { seededRng } from './replayDaily'
import { deflatedSharpe } from './replayLab'
import { perf, type Perf } from './replayRound2'

/** Ideas tried in this round: {top-N, top-N with SPY above its 200-day average} x {stocks, ETFs}. */
export const MOMENTUM_TRIALS = 4
export const STOCK_TOP_N = 10
export const ETF_TOP_N = 5
export const TREND_DAYS = 200
export const CONTROL_DRAWS = 200

/** Sector, country and style ETFs plus bonds and commodities: broad, no single-name survivors. */
export const MOMENTUM_ETFS = `SPY QQQ IWM MDY EFA EEM VGK EWJ EWZ EWY EWT EWG EWU EWA EWC FXI INDA
XLK XLF XLE XLV XLY XLP XLI XLU XLB XLRE XLC
IWD IWF MTUM QUAL USMV VNQ TLT IEF LQD HYG GLD SLV DBC USO`.split(/\s+/).filter(Boolean)

/** Month-end bar index with a following bar (a copy of the helper used by round 2, kept local on purpose). */
export function monthEndIdx(days: string[]): number[] {
  const out: number[] = []
  for (let i = 0; i + 1 < days.length; i++) if (days[i].slice(0, 7) !== days[i + 1].slice(0, 7)) out.push(i)
  return out
}

/** Simple average of the n closes ending at index i (NaN while there are fewer than n finite closes). */
export function smaAt(close: number[], i: number, n: number): number {
  if (i < n - 1) return NaN
  let s = 0
  for (let j = i - n + 1; j <= i; j++) {
    if (!Number.isFinite(close[j])) return NaN
    s += close[j]
  }
  return s / n
}

/** One name's 12-1 return at rebalance k: month-end k-1 over month-end k-12. NaN when any price is missing. */
export function mom121(c: number[], ends: number[], k: number): number {
  if (k < 12) return NaN
  const [a, b] = [c[ends[k - 12]], c[ends[k - 1]]]
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 ? b / a - 1 : NaN
}

/** Names tradable at rebalance k: a 12-1 return, a close at the signal day and an open at the fill. */
export function eligibleAt(close: number[][], open: number[][], ends: number[], k: number): number[] {
  const out: number[] = []
  for (let a = 0; a < close.length; a++) {
    if (Number.isFinite(mom121(close[a], ends, k)) && Number.isFinite(close[a][ends[k]]) && open[a][ends[k] + 1] > 0) out.push(a)
  }
  return out
}

/** The n best 12-1 returns among `elig` (ties keep the lower index, so the result is deterministic). */
export function topN(close: number[][], ends: number[], k: number, elig: number[], n: number): number[] {
  return [...elig].sort((x, y) => mom121(close[y], ends, k) - mom121(close[x], ends, k) || x - y).slice(0, n)
}

/** True when the market proxy closes the signal day above its n-day average (a missing average counts as off). */
export function trendOn(spy: number[], e: number, n = TREND_DAYS): boolean {
  const m = smaAt(spy, e, n)
  return Number.isFinite(m) && spy[e] > m
}

/** Equal-weight rows: weight 1/N on each picked name (cash when `picks` is empty). */
export function weightRow(width: number, picks: number[]): number[] {
  const row = new Array<number>(width).fill(0)
  for (const a of picks) row[a] = 1 / picks.length
  return row
}

/** Fill price of each name at every rebalance k = 12.. plus the last close: columns 0..P (as in round 2). */
export function fillPx(open: number[][], close: number[][], ends: number[]): number[][] {
  return open.map((o, a) => [...ends.slice(12).map((e) => o[e + 1]), close[a][close[a].length - 1]])
}

/**
 * Monthly net returns of target weights `w[p]` held from fill p to fill p+1. Turnover is measured against the
 * weights after the month's drift, and name a pays `side[a]` (a fraction) on every unit traded. A name with no
 * price at the next fill earns 0 (it was held flat), never a made-up return.
 */
export function monthlyNet(px: number[][], w: number[][], side: number[]): number[] {
  const out: number[] = []
  let prev = px.map(() => 0)
  w.forEach((row, p) => {
    const r = row.map((x, a) => (x > 0 && Number.isFinite(px[a][p + 1] / px[a][p]) ? px[a][p + 1] / px[a][p] - 1 : 0))
    const cost = row.reduce((s, x, a) => s + Math.abs(x - prev[a]) * side[a], 0)
    const gross = row.reduce((s, x, a) => s + x * r[a], 0)
    out.push(gross - cost)
    prev = row.map((x, a) => (x * (1 + r[a])) / (1 + gross))
  })
  return out
}

export interface MomentumPlan {
  /** Weights per rebalance for the real strategy. */
  w: number[][]
  /** For the random control: per rebalance, the names it may draw from and how many, or null when it sits in cash. */
  pool: ({ elig: number[]; n: number } | null)[]
}

/** The real weights and the control's draw pools for one idea (`trend`: sit in cash while the market proxy is below its average). */
export function momentumPlan(close: number[][], open: number[][], spy: number[], ends: number[], n: number, trend: boolean, drop?: Set<number>): MomentumPlan {
  const w: number[][] = []
  const pool: MomentumPlan['pool'] = []
  for (let k = 12; k < ends.length; k++) {
    const elig = eligibleAt(close, open, ends, k).filter((a) => !drop?.has(a))
    if (elig.length < n + 1 || (trend && !trendOn(spy, ends[k]))) {
      w.push(new Array(close.length).fill(0))
      pool.push(null)
      continue
    }
    w.push(weightRow(close.length, topN(close, ends, k, elig, n)))
    pool.push({ elig, n })
  }
  return { w, pool }
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const sdOf = (a: number[]) => {
  const m = mean(a)
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1))
}
export const sharpeM = (a: number[]) => (sdOf(a) > 0 ? mean(a) / sdOf(a) : 0)

export interface ControlOut {
  /** Mean over draws of the exam / book mean monthly return (fractions). */
  examMean: number
  bookMean: number
  /** (1 + draws at least as good as the real exam mean) / (draws + 1). */
  p: number
}

/** Random-pick control: every month draw N names from the same eligible pool (cash in the same months), same
 *  costs, `draws` seeded draws. `examIdx` is the first month index of the exam. */
export function randomControl(px: number[][], plan: MomentumPlan, side: number[], realExam: number, examIdx: number, draws = CONTROL_DRAWS, seed = 5): ControlOut {
  let hits = 0
  let sumE = 0
  let sumB = 0
  for (let d = 0; d < draws; d++) {
    const rnd = seededRng(seed * 100_003 + d)
    const w = plan.pool.map((p) => {
      const row = new Array<number>(px.length).fill(0)
      if (!p) return row
      const pick: number[] = []
      const left = [...p.elig]
      while (pick.length < p.n && left.length) pick.push(left.splice(Math.floor(rnd() * left.length), 1)[0])
      for (const a of pick) row[a] = 1 / pick.length
      return row
    })
    const r = monthlyNet(px, w, side)
    const e = mean(r.slice(examIdx))
    sumE += e
    sumB += mean(r.slice(0, examIdx))
    if (e >= realExam) hits++
  }
  return { examMean: sumE / draws, bookMean: sumB / draws, p: (1 + hits) / (draws + 1) }
}

export interface MomentumEval {
  id: string
  en: string
  vi: string
  months: number
  examMonths: number
  /** Share of months holding names. */
  invested: number
  book: Perf
  exam: Perf
  exam2x: Perf
  spyExam: Perf
  control: ControlOut
  control2x: ControlOut
  dsr: number
  passed: boolean
}

export const PASS_MOMENTUM_EN = (trials: number) =>
  `PASS = on the exam (newest 1/3 of months) the monthly average beats the 200-draw random-pick control at 1x AND 2x costs with p <= 0.05 at both, the BOOK average also beats its control, the exam Sharpe is above SPY's buy-and-hold over the same months, and a Deflated Sharpe >= 0.95 on the monthly exam returns counting all ${trials} trials of every round. A STOCK idea must also have its ETF twin pass (the stock list is survivor-biased). Fixed in advance; nothing is tuned on the exam.`
export const PASS_MOMENTUM_VI = (trials: number) =>
  `QUA = ở bài thi (1/3 tháng mới nhất) trung bình tháng thắng nhóm đối chứng chọn mã ngẫu nhiên (200 lần) ở phí 1x VÀ 2x với p <= 0,05 ở cả hai, trung bình BOOK cũng thắng đối chứng, Sharpe bài thi cao hơn SPY mua-giữ cùng các tháng, và Deflated Sharpe >= 0,95 trên lợi nhuận tháng của bài thi tính cả ${trials} lần thử của mọi vòng. Ý tưởng trên CỔ PHIẾU còn phải có bản ETF song sinh cùng đạt (danh sách cổ phiếu bị thiên lệch người sống sót). Cố định từ trước; không chỉnh gì trên bài thi.`

export interface EvalInput {
  id: string
  en: string
  vi: string
  px: number[][]
  plan: MomentumPlan
  side1: number[]
  side2: number[]
  years: number[]
  spyMonthly: number[]
  examIdx: number
  trials: number
  trialVar: number
}

export function evalMomentum(o: EvalInput): MomentumEval {
  const r1 = monthlyNet(o.px, o.plan.w, o.side1)
  const r2 = monthlyNet(o.px, o.plan.w, o.side2)
  const exam1 = r1.slice(o.examIdx)
  const c1 = randomControl(o.px, o.plan, o.side1, mean(exam1), o.examIdx)
  const c2 = randomControl(o.px, o.plan, o.side2, mean(r2.slice(o.examIdx)), o.examIdx)
  const dsr = deflatedSharpe(exam1, o.trials, o.trialVar)
  const spyExam = perf(o.spyMonthly.slice(o.examIdx), o.years.slice(o.examIdx), 12)
  const exam = perf(exam1, o.years.slice(o.examIdx), 12)
  const passed = exam.sharpe > spyExam.sharpe && c1.p <= 0.05 && c2.p <= 0.05 && mean(r1.slice(0, o.examIdx)) > c1.bookMean && dsr >= 0.95
  return {
    id: o.id, en: o.en, vi: o.vi, months: r1.length, examMonths: exam1.length,
    invested: o.plan.pool.filter(Boolean).length / Math.max(1, o.plan.pool.length),
    book: perf(r1.slice(0, o.examIdx), o.years.slice(0, o.examIdx), 12), exam,
    exam2x: perf(r2.slice(o.examIdx), o.years.slice(o.examIdx), 12), spyExam,
    control: c1, control2x: c2, dsr, passed,
  }
}

/** A stock idea only counts when its ETF twin passed too. */
export const finalPass = (stock: MomentumEval, etfTwin: MomentumEval) => stock.passed && etfTwin.passed
