/**
 * Atlas shadow filters ("chạy bóng"): rules proposed from trade audits that are
 * RECORDED on each trade but never block one. Once enough trades close, the report says whether the
 * trades a rule would have skipped really lost money, so Chanh can decide to switch it on.
 *
 * 1. Volume (#271 proposal 1, approved for shadow 2026-11-10): buy only when the 15m volume is at
 *    least SHADOW_MIN_VOL x normal (was 1.0x in the 2026-11-01 audit; #271 found below 1.5x won
 *    41% while 1.5x+ won ~48-50%). The LIVE floor stays MIN_VOL_MULT = 1 (practice.ts) — this
 *    shadow value is the proposed one, not the live one.
 * 2. Source: no day trades picked from the watchlist (audit: 45 trades, won 29%, PF 0.48).
 *    (Now a live gate too — practiceNoWatchlistDay — but kept in the tag for the record.)
 * 3. Learner: what the journal learner said, even while learning is paused, to see whether its HOLD
 *    calls lose (it is recorded only and never gates a trade).
 * 4. Kronos: whether Kronos's 5-day forecast for the symbol was a drop of SHADOW_KRONOS_PCT or more at the
 *    moment of the buy ("Kronos objects"). Reported on its own, it is not part of `pass`.
 * 5. Stop distance (#271 proposal 2, approved for shadow 2026-11-10): skip a buy whose planned stop
 *    sits under SHADOW_MIN_STOP_PCT % away from the entry — inside normal 15m noise. In-sample
 *    (433 trades): stop >= 2% won 47.1% alone; with rule 1 together, kept 88/433, WR 52.3%, PF 2.19.
 *    Recorded only, never gates: `stopOk` + `stopPct` on the tag, `tightStop` bucket in the report.
 *
 * `pass` = volOk && srcOk && stopOk: the trade the #271 (1)+(2) pair would keep. All thresholds are
 * in-sample (picked from the same 433 trades) and will shrink out of sample — the verdict that
 * matters is the live-tagged slice (`liveKeep` / `liveSkip`), not the backfilled one.
 */
import type { PracticeKind, PracticeTrade } from './practice'

/** #271 (1): proposed volume floor, shadow-only. The LIVE floor is MIN_VOL_MULT = 1 (practice.ts) — do not change it here. */
export const SHADOW_MIN_VOL = 1.5
/** #271 (2): proposed minimum planned-stop distance, in % of entry. Shadow-only, never gates. */
export const SHADOW_MIN_STOP_PCT = 2
/** Kronos objects when its 5-day forecast is at least this many percent below the price (a negative number). */
export const SHADOW_KRONOS_PCT = -1

/** Record-only: the entry was between 11:00 and 14:59 New York time (the ledger shows these lose). Never gates, not part of `pass`. */
export function isMidday(openedAt: number | null | undefined): boolean {
  if (!openedAt) return false
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(new Date(openedAt))) % 24
  return h >= 11 && h < 15
}

export interface ShadowTag {
  volOk: boolean
  srcOk: boolean
  /** #271 (2): the planned stop is at least SHADOW_MIN_STOP_PCT % from the entry. */
  stopOk: boolean
  /** Planned stop distance in % of entry at the buy (null when the entry/stop are unknown — old trades). */
  stopPct?: number | null
  learner: 'BUY' | 'HOLD' | 'n/a'
  /** Opened between 11:00 and 14:59 ET. Recorded only; absent on older tags (the report works it out from the entry time). */
  midday?: boolean
  /** Kronos's 5-day forecast at the buy: 'against' = a drop of SHADOW_KRONOS_PCT or more, 'n/a' = no forecast for the symbol. Absent on older trades. */
  kronos?: 'against' | 'ok' | 'n/a'
  /** volOk, srcOk and stopOk: the trade the #271 (1)+(2) pair would still take. */
  pass: boolean
}

export function shadowTag(x: { kind: PracticeKind; source?: string | null; volVsAvg?: number | null; kronosPct?: number | null; stopPct?: number | null; openedAt?: number | null }, learner: ShadowTag['learner'] = 'n/a'): ShadowTag {
  // unknown volume counts as passing: the rule only skips trades it can see are thin
  const volOk = x.volVsAvg == null || x.volVsAvg >= SHADOW_MIN_VOL
  const srcOk = !(x.kind === 'day' && x.source === 'watchlist')
  // unknown stop distance counts as passing, same convention as unknown volume
  const stopOk = x.stopPct == null || x.stopPct >= SHADOW_MIN_STOP_PCT
  const kronos = x.kronosPct == null ? 'n/a' : x.kronosPct <= SHADOW_KRONOS_PCT ? 'against' : 'ok'
  return { volOk, srcOk, stopOk, stopPct: x.stopPct ?? null, learner, kronos, midday: isMidday(x.openedAt), pass: volOk && srcOk && stopOk }
}

/** The tag a trade carries, or one rebuilt from its pick info for trades closed before tags existed. */
export function tagOf(t: Pick<PracticeTrade, 'info' | 'kind' | 'entry' | 'stop'>): ShadowTag {
  const stored = t.info.shadow
  // Tags written before #271 have no stopOk and graded volume at 1.0x: rebuild them under the
  // current rules (pick volume + entry/stop) so old and new trades grade alike. The stored
  // learner call and Kronos verdict are kept — only the rule outcomes are recomputed.
  if (stored && stored.stopOk !== undefined) return stored
  const stopPct =
    t.entry != null && t.stop != null && t.entry > 0 ? ((t.entry - t.stop) / t.entry) * 100 : null
  const rebuilt = shadowTag({ kind: t.kind ?? 'day', source: t.info.pick?.source, volVsAvg: t.info.pick?.volVsAvg, stopPct })
  return stored ? { ...rebuilt, learner: stored.learner, kronos: stored.kronos ?? rebuilt.kronos } : rebuilt
}

export interface ShadowBucket {
  n: number
  wins: number
  net: number
  /** Gross wins / gross losses (null when the bucket has no losing trade to divide by). */
  pf: number | null
}

const bucket = (rows: Pick<PracticeTrade, 'pnl'>[]): ShadowBucket => {
  const winSum = rows.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const lossSum = rows.filter((t) => t.pnl <= 0).reduce((s, t) => s + Math.abs(t.pnl), 0)
  return {
    n: rows.length,
    wins: rows.filter((t) => t.pnl > 0).length,
    net: +rows.reduce((s, t) => s + t.pnl, 0).toFixed(2),
    pf: lossSum > 0 ? +(winSum / lossSum).toFixed(2) : null,
  }
}

export interface ShadowReport {
  /** Trades the new rules would keep / skip. */
  keep: ShadowBucket
  skip: ShadowBucket
  /** Skipped by each rule (a trade can fail both). */
  lowVolume: ShadowBucket
  watchlistDay: ShadowBucket
  /** #271 (2): skipped because the planned stop was under SHADOW_MIN_STOP_PCT % away. */
  tightStop: ShadowBucket
  /** Entered 11:00-14:59 ET (record only, never gates). */
  midday: ShadowBucket
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
const pf = (b: ShadowBucket) => (b.pf == null ? '–' : b.pf.toFixed(2))

export function shadowReport(trades: (Pick<PracticeTrade, 'pnl' | 'info' | 'kind' | 'entry' | 'stop'> & { openedAt?: number })[]): ShadowReport {
  const tagged = trades.map((t) => ({ t, tag: tagOf(t) }))
  const keep = bucket(tagged.filter((x) => x.tag.pass).map((x) => x.t))
  const skip = bucket(tagged.filter((x) => !x.tag.pass).map((x) => x.t))
  const live = tagged.filter((x) => x.t.info.shadow)
  const r = {
    keep,
    skip,
    lowVolume: bucket(tagged.filter((x) => !x.tag.volOk).map((x) => x.t)),
    watchlistDay: bucket(tagged.filter((x) => !x.tag.srcOk).map((x) => x.t)),
    tightStop: bucket(tagged.filter((x) => !x.tag.stopOk).map((x) => x.t)),
    midday: bucket(tagged.filter((x) => (x.tag.midday ?? isMidday((x.t as { openedAt?: number }).openedAt))).map((x) => x.t)),
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
      ? `lọc (vol ≥${SHADOW_MIN_VOL}x + stop ≥${SHADOW_MIN_STOP_PCT}%) sẽ bỏ ${sk.n} lệnh đã lỗ ${money(sk.net)}: có ích`
      : `lọc (vol ≥${SHADOW_MIN_VOL}x + stop ≥${SHADOW_MIN_STOP_PCT}%) sẽ bỏ ${sk.n} lệnh đã lời ${money(sk.net)}: chưa có ích`
  const vi = `${label}: giữ ${k.n} lệnh (thắng ${wr(k)}, PF ${pf(k)}, ${money(k.net)}) · bỏ ${sk.n} lệnh (thắng ${wr(sk)}, PF ${pf(sk)}, ${money(sk.net)}) → ${verdict}`
  const kronosAgainst = bucket(live.filter((x) => x.tag.kronos === 'against').map((x) => x.t))
  const kronosOk = bucket(live.filter((x) => x.tag.kronos === 'ok').map((x) => x.t))
  const kronosNone = live.filter((x) => (x.tag.kronos ?? 'n/a') === 'n/a').length
  const kronosVi = kronosAgainst.n + kronosOk.n
    ? `Kronos phản đối ${kronosAgainst.n} lệnh (thắng ${wr(kronosAgainst)}, ${money(kronosAgainst.net)}) · không phản đối ${kronosOk.n} lệnh (thắng ${wr(kronosOk)}, ${money(kronosOk.net)}) · ${kronosNone} lệnh chưa có dự báo`
    : `Kronos chưa có dự báo cho lệnh nào (${kronosNone} lệnh)`
  return { ...r, liveKeep, liveSkip, kronosAgainst, kronosOk, kronosNone, vi, kronosVi }
}
