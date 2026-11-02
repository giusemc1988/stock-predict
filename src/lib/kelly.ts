/**
 * Position-size multiplier from the recent closed trades (Atlas live sizing).
 *
 * Kelly fraction f = (p*b - q) / b with p the win rate, q = 1 - p and b = average win / average loss.
 * - Fewer than KELLY_MIN_TRADES trades, or only wins or only losses: 1 (not enough to judge).
 * - Edge not positive over the window (f <= 0): NEGATIVE_EDGE_MULT (half size). Before v1.98.2 this case
 *   returned 1 (full size), so a system that had lost money kept betting the same amount.
 * - Edge positive and win rate at least 50%: 0.25 x Kelly, capped at 0.25 (unchanged).
 * - Edge positive but win rate under 50%: 1 (unchanged).
 * Only the last KELLY_WINDOW trades count, so size returns to normal once the edge comes back.
 */
export const KELLY_MIN_TRADES = 30
export const KELLY_WINDOW = 100
export const NEGATIVE_EDGE_MULT = 0.5

export function kellyMultiplier(trades: { pnl: number }[]): number {
  const recent = trades.slice(-KELLY_WINDOW)
  if (recent.length < KELLY_MIN_TRADES) return 1
  const wins = recent.filter((t) => t.pnl > 0)
  const losses = recent.filter((t) => t.pnl <= 0)
  if (wins.length === 0 || losses.length === 0) return 1
  const p = wins.length / recent.length
  const q = 1 - p
  const avgWin = wins.reduce((s, t) => s + t.pnl, 0) / wins.length
  const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)
  if (!(avgLoss > 0)) return 1
  const b = avgWin / avgLoss
  const f = (p * b - q) / b
  if (f <= 0) return NEGATIVE_EDGE_MULT
  if (p < 0.5) return 1
  return Math.min(0.25 * f, 0.25)
}
