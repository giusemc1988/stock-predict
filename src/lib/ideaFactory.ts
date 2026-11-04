/**
 * Atlas idea factory: Atlas makes up its own trading rules instead of only the textbook ones, tests them hard,
 * and keeps only the ones that survive. Pure functions; scripts/idea-factory.ts fetches the bars and runs it.
 *
 * 1. Ideas: a rule is 1-3 conditions on features Atlas can see at a day's close (returns, gap, volume, RSI(2),
 *    distance to the 200-day average and the 52-week high, ATR, where the close sits in the day's range, down
 *    streak, SPY context) plus an exit (hold N days, optional ATR stop). Thresholds are quantiles of the
 *    DISCOVERY years only, so no later data leaks into a rule. The first ideas are the hand-written seeds in
 *    src/data/ideaSeeds.ts (each with its "why"), the best rules of the previous run, and random rules; a
 *    genetic search then mutates and crosses the best ones.
 * 2. Exams, in order, each on data the step before never saw:
 *    discovery (2008-2017): fitness = t-stat of the daily excess over the same symbol's average trade of the same
 *      hold (one number per entry day), times the share of the three eras where that excess is positive;
 *    validation (2018-2022): the best discovery rules must stay positive at 2x costs (picks the finalists);
 *    vault (2023-now): the finalists are judged once with the full lab rule: a 200-draw random-entry control
 *      at 1x and 2x costs, p <= 0.05, at least 100 trades, still positive without the 14 high-volatility names,
 *      and a Deflated Sharpe >= 0.95 that counts every trial of every round PLUS every rule the factory ever tried.
 * Long only (the short side is a separate lab). Paper only: nothing here trades or changes a live rule.
 */
import type { Candle } from '../types'
import type { Costs } from './costs'
import { dayKey } from './practice'
import { controlDaily, runDaily, scaleCosts, seededRng, simulateDaily, sma, type DailySignal, type DailyTrade, type Series } from './replayDaily'
import { deflatedSharpe, stats } from './replayLab'
import { atr, netRetPct, rsi } from './replayStrategies'

type Bi = { en: string; vi: string }

export const DISCOVERY_END = '2018-01-01'
export const VALIDATION_END = '2023-01-01'
export const HOLDS = [1, 2, 3, 5, 10, 20] as const
export const STOPS = [null, 2, 3] as const
export const LEVELS = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95] as const
export const MIN_DISCOVERY_TRADES = 300
export const MIN_DISCOVERY_DAYS = 60
export const MIN_VALIDATION_TRADES = 80
export const MIN_VAULT_TRADES = 100
export const MIN_VAULT_DAYS = 30
export const FINALISTS = 5
export const POP = 80
export const ELITE = 20
export const GENERATIONS = 12

// ---- features ----

export const FEATURES = ['r1', 'r5', 'r20', 'gap', 'vol', 'rsi2', 'd200', 'd52', 'atrp', 'clv', 'rng', 'down', 'spy1', 'spy5', 'spyTrend', 'rel5'] as const
export type Feature = (typeof FEATURES)[number]

/** What each feature means, with `{v}` for the threshold value (already formatted). */
export const FEATURE_TEXT: Record<Feature, { unit: string; en: string; vi: string }> = {
  r1: { unit: '%', en: "today's change", vi: 'giá hôm nay' },
  r5: { unit: '%', en: '5-day change', vi: 'giá 5 ngày' },
  r20: { unit: '%', en: '20-day change', vi: 'giá 20 ngày' },
  gap: { unit: '%', en: 'opening gap', vi: 'gap lúc mở cửa' },
  vol: { unit: 'x', en: 'volume vs its 20-day average', vi: 'khối lượng so với trung bình 20 ngày' },
  rsi2: { unit: '', en: 'RSI(2)', vi: 'RSI(2)' },
  d200: { unit: '%', en: 'distance to the 200-day average', vi: 'khoảng cách tới MA200' },
  d52: { unit: '%', en: 'distance to the 52-week high', vi: 'khoảng cách tới đỉnh 52 tuần' },
  atrp: { unit: '%', en: 'daily swing (ATR) of the price', vi: 'biên độ dao động ngày (ATR)' },
  clv: { unit: '', en: 'where it closed in the day range (0 = low, 1 = high)', vi: 'vị trí giá đóng cửa trong nến (0 = đáy, 1 = đỉnh)' },
  rng: { unit: 'x', en: "today's range vs ATR", vi: 'độ dài nến hôm nay so với ATR' },
  down: { unit: '', en: 'down days in a row', vi: 'số ngày giảm liên tiếp' },
  spy1: { unit: '%', en: "SPY's change today", vi: 'SPY hôm nay' },
  spy5: { unit: '%', en: "SPY's 5-day change", vi: 'SPY 5 ngày' },
  spyTrend: { unit: '%', en: 'SPY vs its 200-day average', vi: 'SPY so với MA200' },
  rel5: { unit: '%', en: '5-day change minus SPY', vi: 'giá 5 ngày trừ SPY (mạnh hơn thị trường)' },
}

export type FeatureMatrix = Record<Feature, Float64Array>

const pctChg = (a: number, b: number) => (b > 0 ? (a / b - 1) * 100 : NaN)

/** Every feature at every bar, using only data up to that bar's close. `spy` is SPY's close aligned to `bars` (NaN when missing). */
export function features(bars: Candle[], spyClose: number[]): FeatureMatrix {
  const n = bars.length
  const f = Object.fromEntries(FEATURES.map((k) => [k, new Float64Array(n).fill(NaN)])) as FeatureMatrix
  const a = atr(bars, 14)
  const r2 = rsi(bars, 2)
  const s200 = sma(bars, 200)
  const spyBars = spyClose.map((c) => ({ close: c })) as Candle[]
  const spy200 = sma(spyBars, 200)
  let volSum = 0
  let down = 0
  const hi: number[] = [] // monotonic deque of indices for the 252-day high
  for (let i = 0; i < n; i++) {
    const b = bars[i]
    while (hi.length && bars[hi[hi.length - 1]].high <= b.high) hi.pop()
    hi.push(i)
    if (hi[0] <= i - 252) hi.shift()
    if (i > 0) down = b.close < bars[i - 1].close ? down + 1 : 0
    const avgVol = i >= 20 ? volSum / 20 : NaN
    volSum += b.volume
    if (i >= 20) volSum -= bars[i - 20].volume
    if (i < 1) continue
    const c = b.close
    f.r1[i] = pctChg(c, bars[i - 1].close)
    f.gap[i] = pctChg(b.open, bars[i - 1].close)
    if (i >= 5) f.r5[i] = pctChg(c, bars[i - 5].close)
    if (i >= 20) f.r20[i] = pctChg(c, bars[i - 20].close)
    f.vol[i] = avgVol > 0 ? b.volume / avgVol : NaN
    f.rsi2[i] = r2[i]
    f.d200[i] = Number.isFinite(s200[i]) ? pctChg(c, s200[i]) : NaN
    if (i >= 251) f.d52[i] = pctChg(c, bars[hi[0]].high)
    f.atrp[i] = i >= 14 && c > 0 ? (a[i] / c) * 100 : NaN
    f.clv[i] = b.high > b.low ? (c - b.low) / (b.high - b.low) : 0.5
    f.rng[i] = i >= 14 && a[i] > 0 ? (b.high - b.low) / a[i] : NaN
    f.down[i] = down
    f.spy1[i] = pctChg(spyClose[i], spyClose[i - 1])
    if (i >= 5) {
      f.spy5[i] = pctChg(spyClose[i], spyClose[i - 5])
      f.rel5[i] = f.r5[i] - f.spy5[i]
    }
    f.spyTrend[i] = Number.isFinite(spy200[i]) ? pctChg(spyClose[i], spy200[i]) : NaN
  }
  return f
}

/** Feature cut values at each quantile LEVEL, from the discovery bars of every symbol pooled. */
export type Cuts = Record<Feature, number[]>
export function quantileCuts(mats: FeatureMatrix[], inDiscovery: boolean[][]): Cuts {
  const out = {} as Cuts
  for (const k of FEATURES) {
    const all: number[] = []
    mats.forEach((m, s) => {
      const a = m[k]
      for (let i = 0; i < a.length; i++) if (inDiscovery[s][i] && Number.isFinite(a[i])) all.push(a[i])
    })
    all.sort((x, y) => x - y)
    out[k] = LEVELS.map((q) => (all.length ? all[Math.min(all.length - 1, Math.floor(q * all.length))] : NaN))
  }
  return out
}

// ---- rules ----

export interface Cond {
  f: Feature
  op: '<' | '>'
  /** index into LEVELS */
  q: number
}
export interface Rule {
  conds: Cond[]
  hold: (typeof HOLDS)[number]
  stop: (typeof STOPS)[number]
  /** its family: the seed id it grew from, 'prev' (last run's best) or 'random'; children keep their parent's */
  origin: string
}

export const ruleKey = (r: Pick<Rule, 'conds' | 'hold' | 'stop'>) =>
  `${[...r.conds].map((c) => `${c.f}${c.op}${c.q}`).sort().join('&')}|h${r.hold}|s${r.stop ?? 0}`

const fmt = (x: number, unit: string) => {
  const v = Math.abs(x) >= 10 ? x.toFixed(0) : Math.abs(x) >= 1 ? x.toFixed(1) : x.toFixed(2)
  return unit === '%' ? `${x > 0 ? '+' : ''}${v}%` : unit === 'x' ? `${v}x` : v
}

/** The rule in plain words, with the real threshold values. */
export function describeRule(r: Pick<Rule, 'conds' | 'hold' | 'stop'>, cuts: Cuts): Bi {
  const parts = r.conds.map((c) => {
    const t = FEATURE_TEXT[c.f]
    const v = fmt(cuts[c.f][c.q], t.unit)
    return { en: `${t.en} ${c.op === '<' ? 'below' : 'above'} ${v}`, vi: `${t.vi} ${c.op === '<' ? 'dưới' : 'trên'} ${v}` }
  })
  const stopEn = r.stop ? `, stop ${r.stop} ATR` : ''
  const stopVi = r.stop ? `, cắt lỗ ${r.stop} ATR` : ''
  return {
    en: `Buy at the next open when ${parts.map((p) => p.en).join(' and ')}; hold ${r.hold} day${r.hold > 1 ? 's' : ''}${stopEn}.`,
    vi: `Mua ở giá mở cửa hôm sau khi ${parts.map((p) => p.vi).join(' và ')}; giữ ${r.hold} ngày${stopVi}.`,
  }
}

export interface Universe {
  series: Series[]
  mats: FeatureMatrix[]
  /** per symbol, per bar: YYYY-MM-DD of the bar */
  days: string[][]
  atr: number[][]
  costs: (Costs | null)[]
}

/** Signals of a rule on bars whose day is in [from, to). One trade per symbol at a time is enforced later. */
export function ruleSignals(u: Universe, r: Rule, cuts: Cuts, from: string, to: string): DailySignal[] {
  const out: DailySignal[] = []
  const cs = r.conds.map((c) => ({ a: null as Float64Array | null, f: c.f, lt: c.op === '<', v: cuts[c.f][c.q] }))
  if (cs.some((c) => !Number.isFinite(c.v))) return out
  for (let s = 0; s < u.series.length; s++) {
    const m = u.mats[s]
    const d = u.days[s]
    const bars = u.series[s].bars
    for (const c of cs) c.a = m[c.f]
    for (let i = 252; i + 1 < bars.length; i++) {
      if (d[i] < from || d[i] >= to) continue
      let ok = true
      for (const c of cs) {
        const x = c.a![i]
        if (!(c.lt ? x < c.v : x > c.v)) {
          ok = false
          break
        }
      }
      if (ok) out.push({ sym: s, i, hold: r.hold, stopDist: r.stop ? r.stop * u.atr[s][i] : null, targetDist: null, stopAtr: r.stop ?? undefined })
    }
  }
  return out
}

/** Average net return of entering every day of [from, to) with this hold (no stop): the drift a rule must beat. */
export function baselines(u: Universe, from: string, to: string, m = 1): Record<number, number[]> {
  const out: Record<number, number[]> = {}
  for (const h of HOLDS) {
    out[h] = u.series.map((s, k) => {
      const b = s.bars
      const c = scaleCosts(u.costs[k], m)
      let sum = 0
      let n = 0
      for (let i = 252; i + h < b.length; i++) {
        const d = u.days[k][i]
        if (d < from || d >= to) continue
        sum += netRetPct(b[i + 1].open, b[i + h].close, c, false)
        n++
      }
      return n ? sum / n : 0
    })
  }
  return out
}

export interface Fit {
  n: number
  /** different entry days */
  days: number
  avg: number
  excess: number
  t: number
  /** share of the eras with a positive excess */
  eras: number
  fitness: number
  sharpe: number
}

const sym = (u: Universe) => new Map(u.series.map((s, k) => [s.symbol, k]))

/** Excess of each trade over its symbol's baseline, the t-stat and the era split. Trades bought on the same day
 *  move together (one market flush fills dozens at once), so the t-stat is computed on ONE number per entry day:
 *  otherwise a rule that only fires in two crashes looks like thousands of independent wins. */
export function fitOf(u: Universe, trades: DailyTrade[], base: Record<number, number[]>, hold: number, eraCuts: string[] = []): Fit {
  const idx = sym(u)
  const n = trades.length
  if (!n) return { n: 0, days: 0, avg: 0, excess: 0, t: 0, eras: 0, fitness: -99, sharpe: 0 }
  const byDay = new Map<number, number[]>()
  for (const t of trades) byDay.set(t.openedAt, [...(byDay.get(t.openedAt) ?? []), t.retPct - base[hold][idx.get(t.symbol)!]])
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const ex = days.map((d) => mean(byDay.get(d)!))
  const m = ex.length
  const mu = mean(ex)
  const sd = Math.sqrt(ex.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, m - 1))
  const t = sd > 0 ? (mu / sd) * Math.sqrt(m) : 0
  let eras = 1
  if (eraCuts.length) {
    const bins = Array.from({ length: eraCuts.length + 1 }, () => ({ s: 0, n: 0 }))
    days.forEach((d, k) => {
      const key = dayKey(d)
      let e = 0
      while (e < eraCuts.length && key >= eraCuts[e]) e++
      bins[e].s += ex[k]
      bins[e].n++
    })
    const used = bins.filter((b) => b.n >= 10)
    eras = used.length ? used.filter((b) => b.s > 0).length / used.length : 0
  }
  const st = stats(trades)
  const fitness = n >= MIN_DISCOVERY_TRADES && m >= MIN_DISCOVERY_DAYS ? t * eras : -99
  return { n, days: m, avg: st.avgRet, excess: mu, t, eras, fitness, sharpe: st.sharpe }
}

// ---- search ----

const pick = <T>(a: readonly T[], rnd: () => number): T => a[Math.floor(rnd() * a.length)]

export function randomRule(rnd: () => number): Rule {
  const k = 1 + Math.floor(rnd() * 3)
  const conds: Cond[] = []
  const used = new Set<Feature>()
  while (conds.length < k) {
    const f = pick(FEATURES, rnd)
    if (used.has(f)) continue
    used.add(f)
    const op = rnd() < 0.5 ? '<' : '>'
    // a "<" condition sits on a low quantile and ">" on a high one, so a rule is not almost always true
    const q = op === '<' ? Math.floor(rnd() * 5) : 4 + Math.floor(rnd() * 5)
    conds.push({ f, op, q })
  }
  return { conds, hold: pick(HOLDS, rnd), stop: pick(STOPS, rnd), origin: 'random' }
}

/** One small change: move a threshold, flip a side, swap a feature, change the hold or the stop, add or drop a condition. */
export function mutate(r: Rule, rnd: () => number): Rule {
  const conds = r.conds.map((c) => ({ ...c }))
  const out: Rule = { conds, hold: r.hold, stop: r.stop, origin: r.origin }
  const kind = Math.floor(rnd() * 6)
  const c = conds[Math.floor(rnd() * conds.length)]
  if (kind === 0) c.q = Math.max(0, Math.min(LEVELS.length - 1, c.q + (rnd() < 0.5 ? -1 : 1)))
  else if (kind === 1) {
    c.op = c.op === '<' ? '>' : '<'
    c.q = LEVELS.length - 1 - c.q
  } else if (kind === 2) {
    const free = FEATURES.filter((f) => !conds.some((x) => x.f === f))
    c.f = pick(free, rnd)
  } else if (kind === 3) out.hold = pick(HOLDS, rnd)
  else if (kind === 4) out.stop = pick(STOPS, rnd)
  else if (conds.length < 3 && rnd() < 0.6) {
    const extra = randomRule(rnd).conds.find((x) => !conds.some((y) => y.f === x.f))
    if (extra) conds.push(extra)
  } else if (conds.length > 1) conds.splice(Math.floor(rnd() * conds.length), 1)
  return out
}

/** A child that takes conditions from both parents (at most 3, one per feature) and one parent's exit. */
export function crossover(a: Rule, b: Rule, rnd: () => number): Rule {
  const pool = [...a.conds, ...b.conds].sort(() => rnd() - 0.5)
  const conds: Cond[] = []
  for (const c of pool) if (conds.length < 3 && !conds.some((x) => x.f === c.f) && rnd() < 0.7) conds.push({ ...c })
  if (!conds.length) conds.push({ ...pool[0] })
  const p = rnd() < 0.5 ? a : b
  return { conds, hold: p.hold, stop: p.stop, origin: a.origin }
}

export interface Scored {
  rule: Rule
  key: string
  fit: Fit
}

/** Genetic search on the discovery years. Every distinct rule scored counts as one trial. */
export function search(start: Rule[], score: (r: Rule) => Fit, seed: number, gens = GENERATIONS, pop = POP, elite = ELITE): { all: Map<string, Scored>; best: Scored[] } {
  const rnd = seededRng(seed)
  const all = new Map<string, Scored>()
  const scoreOne = (r: Rule): Scored => {
    const key = ruleKey(r)
    const hit = all.get(key)
    if (hit) return hit
    const s = { rule: r, key, fit: score(r) }
    all.set(key, s)
    return s
  }
  let cur = start.slice(0, pop).map(scoreOne)
  while (cur.length < pop) cur.push(scoreOne(randomRule(rnd)))
  for (let g = 0; g < gens; g++) {
    const top = [...new Map(cur.map((s) => [s.key, s])).values()].sort((x, y) => y.fit.fitness - x.fit.fitness).slice(0, elite)
    const next = [...top]
    let guard = 0
    while (next.length < pop && guard++ < pop * 20) {
      const a = pick(top, rnd).rule
      const child = rnd() < 0.35 ? crossover(a, pick(top, rnd).rule, rnd) : mutate(a, rnd)
      const key = ruleKey(child)
      if (all.has(key)) continue // already tried: no new trial, find another
      next.push(scoreOne(child))
    }
    cur = next
  }
  const best = [...all.values()].sort((x, y) => y.fit.fitness - x.fit.fitness)
  return { all, best }
}

/** The same idea with another hold or threshold is not a new idea: keep the best rule of each feature set. */
export const familyOf = (r: Pick<Rule, 'conds'>) => [...new Set(r.conds.map((c) => `${c.f}${c.op}`))].sort().join('&')

// ---- vault ----

export interface VaultResult {
  n: number
  /** different entry days */
  days: number
  avg1: number
  /** share of vault trades that made money after 1x costs, % */
  winRate: number
  avg2: number
  control1: number
  control2: number
  excess1: number
  excess2: number
  p1: number
  p2: number
  /** excess at 1x over the control without the 14 high-volatility names */
  exHighVol: number
  dsr: number
  passed: boolean
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)

/** The final, one-shot exam on the vault years with the full lab rule. `trials` = every trial of every round + the factory's total. */
export function vaultExam(u: Universe, r: Rule, cuts: Cuts, from: string, trials: number, highVol: Set<string>, draws = 200): VaultResult {
  const sigs = ruleSignals(u, r, cuts, from, '9999')
  const c1 = (s: string) => u.costs[sym(u).get(s)!]
  const c2 = (s: string) => scaleCosts(c1(s), 2)
  const t1 = runDaily(u.series, sigs, c1)
  const t2 = runDaily(u.series, sigs, c2)
  const cd = controlDaily(u.series, sigs, t1, from, c1, draws, 7)
  const avg1 = stats(t1).avgRet
  const avg2 = stats(t2).avgRet
  const control1 = mean(cd.exam1)
  const control2 = mean(cd.exam2)
  const p1 = cd.exam1.filter((x) => x >= avg1).length / Math.max(1, cd.exam1.length)
  const p2 = cd.exam2.filter((x) => x >= avg2).length / Math.max(1, cd.exam2.length)
  // robustness: the same rule and control without the high-volatility names
  const keep = sigs.filter((s) => !highVol.has(u.series[s.sym].symbol))
  const k1 = runDaily(u.series, keep, c1)
  const kd = keep.length ? controlDaily(u.series, keep, k1, from, c1, Math.min(draws, 100), 9) : { exam1: [0] }
  const exHighVol = k1.length ? stats(k1).avgRet - mean(kd.exam1) : 0
  // trades bought on the same day move together (a market flush fills many at once), so the DSR is computed on
  // one number per entry day, and a rule needs enough different days, not only enough trades
  const byDay = new Map<number, number[]>()
  for (const t of t1) byDay.set(t.openedAt, [...(byDay.get(t.openedAt) ?? []), t.retPct])
  const dayRets = [...byDay.values()].map(mean)
  const dsr = deflatedSharpe(dayRets, trials)
  const excess1 = avg1 - control1
  const excess2 = avg2 - control2
  const passed = t1.length >= MIN_VAULT_TRADES && dayRets.length >= MIN_VAULT_DAYS && excess1 > 0 && excess2 > 0 && p1 <= 0.05 && p2 <= 0.05 && exHighVol > 0 && dsr >= 0.95
  return { n: t1.length, days: dayRets.length, avg1, winRate: Math.round(stats(t1).winRate * 100), avg2, control1, control2, excess1, excess2, p1, p2, exHighVol, dsr, passed }
}

export const PASS_EN = (trials: number) =>
  `PASS = in the vault years (never seen by the search or the validation step): at least ${MIN_VAULT_TRADES} trades on at least ${MIN_VAULT_DAYS} different days, average per trade above a 200-draw random-entry control (same symbols, counts, exits, costs) at 1x AND 2x costs with p <= 0.05 at both, still above its control without the 14 high-volatility names, and a Deflated Sharpe >= 0.95 (one return per entry day, since same-day trades move together) counting ${trials} trials (every lab idea judged on the recent years plus every rule that ever reached the vault; the luck spread is that of a zero-edge Sharpe over the same number of days). Fixed in advance.`
export const PASS_VI = (trials: number) =>
  `ĐẠT = trong "két khóa" (những năm mà vòng tìm kiếm và vòng kiểm tra chưa từng thấy): từ ${MIN_VAULT_TRADES} lệnh trên ít nhất ${MIN_VAULT_DAYS} ngày khác nhau, trung bình mỗi lệnh cao hơn nhóm mua ngẫu nhiên 200 lần (cùng mã, cùng số lệnh, cùng cách thoát, cùng phí) ở phí 1x VÀ 2x với p <= 0,05 ở cả hai, vẫn thắng khi bỏ 14 mã biến động mạnh, và Deflated Sharpe >= 0,95 (mỗi ngày vào lệnh tính một con số, vì lệnh cùng ngày đi cùng nhau) khi tính ${trials} lần thử (mọi ý tưởng lab từng thi trên những năm gần đây cộng mọi luật từng vào két). Cố định từ trước.`

// ---- signals: the factory's rules on the latest close, graded later with real prices ----

export interface FactorySignal {
  /** YYYY-MM-DD of the close the rule fired on; the buy is the next open */
  day: string
  symbol: string
  key: string
  close: number
  /** stop price from that close (null = time exit only) */
  sl: number | null
  hold: number
  vi: string
  en: string
  /** filled once the hold has passed: net % after 1x costs */
  retPct?: number | null
  exitDay?: string
}

/** Rules that fire on each symbol's LAST bar (the latest close). */
export function latestSignals(u: Universe, rules: Rule[], cuts: Cuts): FactorySignal[] {
  const out: FactorySignal[] = []
  for (const r of rules) {
    const text = describeRule(r, cuts)
    const key = ruleKey(r)
    for (let s = 0; s < u.series.length; s++) {
      const bars = u.series[s].bars
      const i = bars.length - 1
      if (i < 252) continue
      const ok = r.conds.every((c) => {
        const x = u.mats[s][c.f][i]
        const v = cuts[c.f][c.q]
        return c.op === '<' ? x < v : x > v
      })
      if (!ok) continue
      const close = bars[i].close
      out.push({ day: u.days[s][i], symbol: u.series[s].symbol, key, close, sl: r.stop ? close - r.stop * u.atr[s][i] : null, hold: r.hold, vi: text.vi, en: text.en })
    }
  }
  return out
}

/** Grade a logged signal once its whole hold has passed: buy the next open, the same stop and time exit as the lab. */
export function gradeSignal(sig: FactorySignal, bars: Candle[], days: string[], costs: Costs | null): FactorySignal {
  if (sig.retPct != null) return sig
  const i = days.indexOf(sig.day)
  if (i < 0 || i + sig.hold >= bars.length) return sig // not enough bars yet (the exit day must exist)
  const t = simulateDaily(bars, { i, hold: sig.hold, stopDist: sig.sl != null ? sig.close - sig.sl : null, targetDist: null }, costs)
  return t ? { ...sig, retPct: Math.round(t.retPct * 1000) / 1000, exitDay: days[t.exitBar!] } : sig
}

/** Win rate of the graded signals (net of costs). */
export function signalScore(sigs: FactorySignal[]): { graded: number; wins: number; winRate: number | null; avgPct: number | null; waiting: number } {
  const g = sigs.filter((s) => s.retPct != null)
  const wins = g.filter((s) => s.retPct! > 0).length
  return {
    graded: g.length,
    wins,
    winRate: g.length ? Math.round((wins / g.length) * 100) : null,
    avgPct: g.length ? Math.round((g.reduce((a, s) => a + s.retPct!, 0) / g.length) * 100) / 100 : null,
    waiting: sigs.length - g.length,
  }
}

// ---- strategy slots (v2.0.11): many rules run live on paper side by side, each with its own scoreboard ----

/** How many rules send live paper signals at the same time (was 3, one per family). Paper only, so wrong ideas cost nothing. */
export const SIGNAL_SLOTS = 10
/** A slot needs this many graded signals before it can be called working or failing. */
export const SLOT_MIN_GRADED = 20
export const SLOT_MIN_WIN_RATE = 55

/** Up to `max` distinct rules (by key) holding at most `maxHold` days, best first, at most 2 per family so one idea cannot fill every slot. */
export function pickSlotRules<T extends Pick<Rule, 'conds' | 'hold' | 'stop' | 'origin'>>(pool: T[], maxHold: number, max = SIGNAL_SLOTS): T[] {
  const seen = new Set<string>()
  const perFamily: Record<string, number> = {}
  const out: T[] = []
  for (const r of pool) {
    const k = ruleKey(r)
    const fam = r.origin ?? 'x'
    if (r.hold > maxHold || seen.has(k) || (perFamily[fam] ?? 0) >= 2) continue
    seen.add(k)
    perFamily[fam] = (perFamily[fam] ?? 0) + 1
    out.push(r)
    if (out.length >= max) break
  }
  return out
}

export interface SlotRow {
  key: string
  graded: number
  wins: number
  winRate: number | null
  avgPct: number | null
  waiting: number
  /** testing = too few graded signals yet; working = enough, wins >= 55% and average above zero; failing = enough but not. */
  status: 'testing' | 'working' | 'failing'
}

/** The live scoreboard of every slot (one row per rule key), best win rate first among the ones with graded signals. */
export function slotBoard(sigs: FactorySignal[]): SlotRow[] {
  const keys = [...new Set(sigs.map((s) => s.key))]
  return keys
    .map((key) => {
      const sc = signalScore(sigs.filter((s) => s.key === key))
      const status: SlotRow['status'] = sc.graded < SLOT_MIN_GRADED ? 'testing' : sc.winRate! >= SLOT_MIN_WIN_RATE && sc.avgPct! > 0 ? 'working' : 'failing'
      return { key, ...sc, status }
    })
    .sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.graded - a.graded)
}
