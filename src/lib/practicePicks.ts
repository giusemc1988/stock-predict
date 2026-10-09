/**
 * Practice mode's stock picker: scores every market it scanned on the AI's call, today's gain,
 * volume and Trade Score, so the practice account trades the best-looking setups instead of
 * whatever chart is open. A higher rank is a stronger setup by these rules, not a promise of profit.
 */
import type { Analysis, AssetClass, Candle } from '../types'
import { dayKey } from './practice'

export type PickSource = 'watchlist' | 'gainer' | 'active'

export interface PracticeCandidate {
  symbol: string
  asset: AssetClass
  source: PickSource
  analysis: Analysis | null
  /** Up-probability from the live model, for the learner's opinion. */
  probUp: number | null
  price: number
  /** Last closed bar. */
  barTime: number
  /** % change since the previous trading day's last bar. */
  gainPct: number | null
  /** Volume over the last 4 closed bars vs the 20-bar average (1 = normal). */
  volVsAvg: number | null
  tradeScore: number | null
  /** 0..1, higher is better. Only BUY calls are ranked. */
  rank: number
  /** Position among BUY calls, 1 = best; null when the AI does not say BUY. */
  place: number | null
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export function gainToday(candles: Candle[]): number | null {
  const n = candles.length
  if (n < 2) return null
  const today = dayKey(candles[n - 1].time * 1000)
  for (let i = n - 2; i >= 0; i--) if (dayKey(candles[i].time * 1000) !== today) return (candles[n - 1].close / candles[i].close - 1) * 100
  return null
}

export function volumeVsAvg(closedBars: Candle[]): number | null {
  const n = closedBars.length
  if (n < 24) return null
  const recent = closedBars.slice(-4).reduce((a, c) => a + c.volume, 0) / 4
  const avg = closedBars.slice(-24, -4).reduce((a, c) => a + c.volume, 0) / 20
  return avg > 0 ? recent / avg : null
}

/** Trade Score counts most (half), then volume and today's gain (a quarter each). */
export function rankScore(c: { tradeScore: number | null; volVsAvg: number | null; gainPct: number | null }) {
  const ts = (c.tradeScore ?? 50) / 100
  const vol = clamp((c.volVsAvg ?? 1) / 3, 0, 1)
  const gain = clamp(((c.gainPct ?? 0) + 5) / 10, 0, 1)
  return 0.5 * ts + 0.25 * vol + 0.25 * gain
}

/** Sort BUY calls best first and number them; everything else follows unranked. */
export function rankCandidates(list: Omit<PracticeCandidate, 'rank' | 'place'>[]): PracticeCandidate[] {
  const buys = list
    .filter((c) => c.analysis?.verdict === 'BUY')
    .map((c) => ({ ...c, rank: rankScore(c) }))
    .sort((a, b) => b.rank - a.rank)
    .map((c, i) => ({ ...c, place: i + 1 }))
  const rest = list.filter((c) => c.analysis?.verdict !== 'BUY').map((c) => ({ ...c, rank: 0, place: null }))
  return [...buys, ...rest]
}

const SOURCE = {
  watchlist: { en: 'your watchlist', vi: 'danh sách theo dõi' },
  gainer: { en: 'top gainers today', vi: 'mã tăng mạnh nhất hôm nay' },
  active: { en: 'most traded today', vi: 'mã giao dịch nhiều nhất hôm nay' },
}
export const pickSourceLabel = SOURCE

/** Plain-language reason a candidate was picked. */
export function pickWhy(c: PracticeCandidate, of: number): { en: string; vi: string } {
  const parts: { en: string; vi: string }[] = [{ en: `#${c.place} of ${of} BUY calls`, vi: `hạng ${c.place}/${of} lệnh MUA` }]
  if (c.gainPct != null) parts.push({ en: `${c.gainPct >= 0 ? '+' : ''}${c.gainPct.toFixed(1)}% today`, vi: `${c.gainPct >= 0 ? '+' : ''}${c.gainPct.toFixed(1)}% hôm nay` })
  if (c.volVsAvg != null) parts.push({ en: `volume ${c.volVsAvg.toFixed(1)}x normal`, vi: `khối lượng ${c.volVsAvg.toFixed(1)}x bình thường` })
  if (c.tradeScore != null) parts.push({ en: `Trade Score ${c.tradeScore}`, vi: `Điểm GD ${c.tradeScore}` })
  parts.push({ en: `from ${SOURCE[c.source].en}`, vi: `từ ${SOURCE[c.source].vi}` })
  return { en: parts.map((p) => p.en).join(', '), vi: parts.map((p) => p.vi).join(', ') }
}
