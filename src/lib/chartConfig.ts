import type { Timeframe } from '../types'

export type ChartRange = '1d' | '5d' | '1m' | '3m' | '1y' | 'all'
export const CHART_RANGES: ChartRange[] = ['1d', '5d', '1m', '3m', '1y', 'all']
/** Bar size picked for each range, like Webull: enough bars to fill the range, within the 1,000-bar fetch. */
export const RANGE_TF: Record<ChartRange, Timeframe> = { '1d': '5m', '5d': '15m', '1m': '1h', '3m': '4h', '1y': '1d', all: '1d' }
/** Calendar days a range covers; 5D is five trading days for stocks (a week) and five days for 24/7 crypto. */
export function rangeDays(r: ChartRange, crypto: boolean): number | null {
  return r === '1d' ? 1 : r === '5d' ? (crypto ? 5 : 7) : r === '1m' ? 30 : r === '3m' ? 91 : r === '1y' ? 365 : null
}

/** Which chart overlays are on, and their settings. Saved per browser only. */
export interface ChartConfig {
  sma: { on: boolean; period: number }
  bollinger: { on: boolean; period: number; mult: number }
  volume: boolean
  timeRange: ChartRange | 'custom'
  customDays: number | null
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  sma: { on: false, period: 50 },
  bollinger: { on: false, period: 20, mult: 2 },
  volume: true,
  timeRange: 'all',
  customDays: null,
}

const KEY = 'bluechip.chart.v1'
const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

/** Reads the saved config and clamps every value, so a bad saved value cannot break the chart. */
export function loadChartConfig(): ChartConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw) return DEFAULT_CHART_CONFIG
    const saved = raw.timeRange === '1w' ? '5d' : raw.timeRange
    const timeRange = saved && [...CHART_RANGES, 'custom'].includes(saved) ? saved : DEFAULT_CHART_CONFIG.timeRange
    const customDays = timeRange === 'custom' ? clampInt(raw.customDays, 1, 3650, 30) : null
    return {
      sma: {
        on: !!raw.sma?.on,
        period: clampInt(raw.sma?.period, 2, 200, DEFAULT_CHART_CONFIG.sma.period),
      },
      bollinger: {
        on: !!raw.bollinger?.on,
        period: clampInt(raw.bollinger?.period, 2, 200, DEFAULT_CHART_CONFIG.bollinger.period),
        mult: Math.min(4, Math.max(0.5, Number(raw.bollinger?.mult) || DEFAULT_CHART_CONFIG.bollinger.mult)),
      },
      volume: raw.volume !== false,
      timeRange,
      customDays,
    }
  } catch {
    return DEFAULT_CHART_CONFIG
  }
}

export function saveChartConfig(c: ChartConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* storage blocked: settings last for this visit only */
  }
}
