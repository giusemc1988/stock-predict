export function priceDecimals(p: number) {
  const a = Math.abs(p)
  if (a >= 1000) return 2
  if (a >= 1) return 2
  if (a >= 0.01) return 4
  return 6
}

export const fmtPrice = (p: number | undefined | null, d?: number) =>
  p == null || !isFinite(p) ? '—' : p.toLocaleString('en-US', { minimumFractionDigits: d ?? priceDecimals(p), maximumFractionDigits: d ?? priceDecimals(p) })

export const fmtSigned = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

export const fmtPct = (v: number, d = 2) => `${fmtSigned(v, d)}%`

export const fmtUsd = (v: number) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtCompact = (v: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v)

export const fmtTime = (unixSec: number, withDate = true) =>
  new Date(unixSec * 1000).toLocaleString('en-US', withDate ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false } : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

export const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')
