/**
 * Atlas shadow filters ("chạy bóng"): rules proposed from the 314-trade audit (2026-11-01) that are
 * RECORDED on each trade but never block one. Once enough trades close, the report says whether the
 * trades a rule would have skipped really lost money, so Chanh can decide to switch it on.
 *
 * 1. Volume: buy only when the 15m volume is at least SHADOW_MIN_VOL x normal
 *    (audit: below 1x won 34%, -$89 over 154 trades; 2x+ won 51%, +$34 over 89).
 * 2. Source: no day trades picked from the watchlist (audit: 45 trades, won 29%, PF 0.48).
 * 3. Learner: what the journal learner said, even while learning is paused, to see whether its HOLD
 *    calls lose (it is recorded only and never gates a trade).
 * 4. Kronos: whether Kronos's 5-day forecast for the symbol was a drop of SHADOW_KRONOS_PCT or more at the
 *    moment of the buy ("Kronos objects"). Reported on its own, it is not part of `pass`.
 */
import type { PracticeKind, PracticeTrade } from './practice'

export const SHADOW_MIN_VOL = 1
/** Kronos objects when its 5-day forecast is at least this many percent below the price (a negative number). */
export const SHADOW_KRONOS_PCT = -1

export interface ShadowTag {
  volOk: boolean
  srcOk: boolean
  learner: 'BUY' | 'HOLD' | 'n/a'
  /** Kronos's 5-day forecast at the buy: 'against' = a drop of SHADOW_KRONOS_PCT or more, 'n/a' = no forecast for the symbol. Absent on older trades. */
  kronos?: 'against' | 'ok' | 'n/a'
  /** volOk and srcOk: the trade would still be taken with rules 1 and 2 on. */
  pass: boolean
}

export function shadowTag(x: { kind: PracticeKind; source?: string | null; volVsAvg?: number | null; kronosPct?: number | null }, learner: ShadowTag['learner'] = 'n/a'): ShadowTag {
  // unknown volume counts as passing: the rule only skips trades it can see are thin
  const volOk = x.volVsAvg == null || x.volVsAvg >= SHADOW_MIN_VOL
  const srcOk = !(x.kind === 'day' && x.source === 'watchlist')
  const kronos = x.kronosPct == null ? 'n/a' : x.kronosPct <= SHADOW_KRONOS_PCT ? 'against' : 'ok'
  return { volOk, srcOk, learner, kronos, pass: volOk && srcOk }
}

/** The tag a trade carries, or one rebuilt from its pick info for trades closed before tags existed. */
export function tagOf(t: Pick<PracticeTrade, 'info' | 'kind'>): ShadowTag {
  if (t.info.shadow) return t.info.shadow
  return shadowTag({ kind: t.kind ?? 'day', source: t.info.pick?.source, volVsAvg: t.info.pick?.volVsAvg })
}

export interface ShadowBucket {
  n: number
  wins: number
  net: number
}

const bucket = (rows: Pick<PracticeTrade, 'pnl'>[]): ShadowBucket => ({
  n: rows.length,
  wins: rows.filter((t) => t.pnl > 0).length,
  net: +rows.reduce((s, t) => s + t.pnl, 0).toFixed(2),
})

export interface ShadowReport {
  /** Trades the new rules would keep / skip. */
  keep: ShadowBucket
  skip: ShadowBucket
  /** Skipped by each rule (a trade can fail both). */
  lowVolume: ShadowBucket
  watchlistDay: ShadowBucket
  /** Learner calls, only on trades tagged live (it is not rebuilt for older trades). */
  learnerBuy: ShadowBucket
  learnerHold: ShadowBucket
  /** Trades tagged live, the rest rebuilt from pick info. */
  live: number
  /** Keep / skip among live-tagged trades only: the out-of-sample test. */
  liveKeep: ShadowBucket
  liveSkip: ShadowBucket
  /** Kronos objected / did not object, among live-tagged trades that had a Kronos forecast. */
  kronosAgainst: ShadowBucket
  kronosOk: ShadowBucket
  /** Live-tagged trades on symbols Kronos had no forecast for. */
  kronosNone: number
  /** Plain Vietnamese verdict. */
  vi: string
  /** Plain Vietnamese line for the Kronos objection test. */
  kronosVi: string
}

const money = (x: number) => `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(2)}`
const wr = (b: ShadowBucket) => (b.n ? `${Math.round((b.wins / b.n) * 100)}%` : '–')

export function shadowReport(trades: Pick<PracticeTrade, 'pnl' | 'info' | 'kind'>[]): ShadowReport {
  const tagged = trades.map((t) => ({ t, tag: tagOf(t) }))
  const keep = bucket(tagged.filter((x) => x.tag.pass).map((x) => x.t))
  const skip = bucket(tagged.filter((x) => !x.tag.pass).map((x) => x.t))
  const live = tagged.filter((x) => x.t.info.shadow)
  const r = {
    keep,
    skip,
    lowVolume: bucket(tagged.filter((x) => !x.tag.volOk).map((x) => x.t)),
    watchlistDay: bucket(tagged.filter((x) => !x.tag.srcOk).map((x) => x.t)),
    learnerBuy: bucket(live.filter((x) => x.tag.learner === 'BUY').map((x) => x.t)),
    learnerHold: bucket(live.filter((x) => x.tag.learner === 'HOLD').map((x) => x.t)),
    live: live.length,
  }
  // The rules were found on the trades before 2026-11-02, so those only show they fit the past.
  // The real test is trades tagged live from then on: the verdict uses them once there are any.
  const liveKeep = bucket(live.filter((x) => x.tag.pass).map((x) => x.t))
  const liveSkip = bucket(live.filter((x) => !x.tag.pass).map((x) => x.t))
  const [k, sk, label] = live.length ? [liveKeep, liveSkip, `Lệnh mới (${live.length})`] : [keep, skip, 'Lệnh cũ, chưa kiểm chứng']
  const verdict = !sk.n
    ? 'chưa có lệnh nào bị lọc'
    : sk.net < 0
      ? `lọc sẽ bỏ ${sk.n} lệnh đã lỗ ${money(sk.net)}: có ích`
      : `lọc sẽ bỏ ${sk.n} lệnh đã lời ${money(sk.net)}: chưa có ích`
  const vi = `${label}: giữ ${k.n} lệnh (thắng ${wr(k)}, ${money(k.net)}) · bỏ ${sk.n} lệnh (thắng ${wr(sk)}, ${money(sk.net)}) → ${verdict}`
  const kronosAgainst = bucket(live.filter((x) => x.tag.kronos === 'against').map((x) => x.t))
  const kronosOk = bucket(live.filter((x) => x.tag.kronos === 'ok').map((x) => x.t))
  const kronosNone = live.filter((x) => (x.tag.kronos ?? 'n/a') === 'n/a').length
  const kronosVi = kronosAgainst.n + kronosOk.n
    ? `Kronos phản đối ${kronosAgainst.n} lệnh (thắng ${wr(kronosAgainst)}, ${money(kronosAgainst.net)}) · không phản đối ${kronosOk.n} lệnh (thắng ${wr(kronosOk)}, ${money(kronosOk.net)}) · ${kronosNone} lệnh chưa có dự báo`
    : `Kronos chưa có dự báo cho lệnh nào (${kronosNone} lệnh)`
  return { ...r, liveKeep, liveSkip, kronosAgainst, kronosOk, kronosNone, vi, kronosVi }
}
