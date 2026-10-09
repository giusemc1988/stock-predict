/** Which chart overlays are on, and their settings. Saved per browser only. */
export interface ChartConfig {
  sma: { on: boolean; period: number }
  bollinger: { on: boolean; period: number; mult: number }
  volume: boolean
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  sma: { on: false, period: 50 },
  bollinger: { on: false, period: 20, mult: 2 },
  volume: true,
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
