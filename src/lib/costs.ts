/**
 * Trading costs for paper fills, so practice results aren't better than real trading
 * could be: half the bid-ask spread and slippage on market and stop fills, plus a fee
 * on every fill. Limit fills (targets) pay the fee only.
 */

export interface Costs {
  /** Commission and regulatory fees, in basis points of the trade value. */
  feeBps: number
  /** Full bid-ask spread in basis points; each market fill pays half. */
  spreadBps: number
  /** Extra price move against you on market and stop fills, in basis points. */
  slippageBps: number
}

export const NO_COSTS: Costs = { feeBps: 0, spreadBps: 0, slippageBps: 0 }

/** Price actually paid (buy) or received (sell) on a fill. */
export function fillPrice(price: number, side: 'buy' | 'sell', c: Costs | null | undefined, limit = false): number {
  if (!c || limit) return price
  const bps = c.spreadBps / 2 + c.slippageBps
  return side === 'buy' ? price * (1 + bps / 1e4) : price * (1 - bps / 1e4)
}

export const feeFor = (value: number, c: Costs | null | undefined) => (c ? Math.abs(value) * (c.feeBps / 1e4) : 0)

/** The costs set in AI rules, or null when realistic fills are off. */
export const costsFrom = (r: { costsOn: boolean; feeBps: number; spreadBps: number; slippageBps: number }): Costs | null =>
  r.costsOn ? { feeBps: r.feeBps, spreadBps: r.spreadBps, slippageBps: r.slippageBps } : null
