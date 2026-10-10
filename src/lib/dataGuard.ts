/**
 * Data freshness: every price the AI decides on is labeled real-time, delayed, historical
 * or mock, with its age, and a new entry is blocked when the data is mock or too old.
 * Exits are never blocked, so an open trade can always be closed.
 */

export type DataLabel = 'real' | 'delayed' | 'historical' | 'mock'

export interface DataStamp {
  label: DataLabel
  /** Feed name, e.g. "Binance", "Alpaca (IEX)", "Yahoo Finance". */
  source: string
  /** Seconds between the decision and the close of the bar it used. */
  ageSec: number
}

export const DATA_LABEL: Record<DataLabel, { en: string; vi: string }> = {
  real: { en: 'Real-time', vi: 'Thời gian thực' },
  delayed: { en: 'Delayed', vi: 'Trễ' },
  historical: { en: 'Historical', vi: 'Lịch sử' },
  mock: { en: 'Mock (simulated)', vi: 'Giả lập' },
}

/** Label a feed by its name. Unknown feeds count as delayed, never as real-time. */
export function labelForSource(source: string): DataLabel {
  const s = source.toLowerCase()
  if (!s || s.includes('simulat') || s.includes('demo') || s.includes('mock')) return 'mock'
  if (s.includes('binance') || s.includes('alpaca') || s.includes('finnhub')) return 'real'
  if (s.includes('cached') || s.includes('saved')) return 'historical'
  return 'delayed'
}

/** Stamp a decision made at `now` (ms) on the bar that opened at `barTime` (s) and lasts `tfSec`. */
export function stampData(source: string, barTime: number, tfSec: number, now: number, label = labelForSource(source)): DataStamp {
  return { label, source, ageSec: Math.max(0, Math.round(now / 1000 - (barTime + tfSec))) }
}

/** Oldest data allowed for a new entry: one bar, or `maxAgeMin`, whichever is longer. */
export const maxAgeSec = (tfSec: number, maxAgeMin: number) => Math.max(tfSec, maxAgeMin * 60)

/** Why this data can't open a trade, or null when it can. */
export function staleReason(d: DataStamp, tfSec: number, maxAgeMin: number): { en: string; vi: string } | null {
  if (d.label === 'mock') return { en: 'the price data is simulated, not real', vi: 'dữ liệu giá là giả lập, không phải thật' }
  const limit = maxAgeSec(tfSec, maxAgeMin)
  if (d.ageSec > limit) {
    const m = Math.round(d.ageSec / 60)
    return { en: `the price data is ${m} min old (limit ${Math.round(limit / 60)})`, vi: `dữ liệu giá đã cũ ${m} phút (giới hạn ${Math.round(limit / 60)})` }
  }
  return null
}
