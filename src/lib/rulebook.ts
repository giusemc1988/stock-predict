/**
 * Arc Analyst rulebook: the position-sizing and edge checks from the
 * trading-analyst skill (github.com/agiprolabs/claude-trading-skills, MIT).
 *
 * Sizing ladder: compute fixed-fractional, quarter-Kelly and a single-position
 * cap, then take the smallest and say which rule set it. Negative Kelly means no
 * measured edge, so the plan is paper-only research. Not financial advice.
 */
import type { Analysis, BacktestStats } from '../types'
import { fmtUsd } from './format'

/** Fixed-fractional risk per trade (the skill's "conservative" band is 0.5-1%). */
export const RISK_PCT = 0.01
/** Never full Kelly: edge estimates are noisy. */
export const KELLY_FRACTION = 0.25
/** Single position at most ~10% of the account. */
export const MAX_POSITION_PCT = 0.1
/** Under this many backtest trades the win rate is noise, not a track record. */
export const MIN_TRADES = 30

export type Binding = 'risk' | 'edge' | 'cap'

export interface RuleCheck {
  rule: string
  pass: boolean
  detail: string
}

export interface Sizing {
  shares: number
  value: number
  riskAmount: number
  binding: Binding
  kelly: number | null
  checks: RuleCheck[]
}

/** Kelly fraction f* = (p*b - q) / b, or null when the inputs are missing. */
export function kelly(winRate: number, payoff: number): number | null {
  if (payoff <= 0 || winRate <= 0) return null
  return (winRate * payoff - (1 - winRate)) / payoff
}

export function sizePlan(a: Analysis, stats: BacktestStats, equity: number): Sizing | null {
  if (!a.plan || equity <= 0) return null
  const { entry, stop } = a.plan
  const perShareRisk = Math.abs(entry - stop)
  if (perShareRisk <= 0 || entry <= 0) return null

  const riskAmount = equity * RISK_PCT
  const byRisk = riskAmount / perShareRisk
  const byCap = (equity * MAX_POSITION_PCT) / entry
  const enoughTrades = stats.trades >= MIN_TRADES
  const k = kelly(stats.winRate, stats.payoffRatio)
  // Quarter-Kelly as a share of the account; only trusted with enough trades.
  const byEdge = enoughTrades && k != null ? (Math.max(0, k) * KELLY_FRACTION * equity) / entry : Infinity

  const options: [Binding, number][] = [
    ['risk', byRisk],
    ['edge', byEdge],
    ['cap', byCap],
  ]
  const [binding, raw] = options.reduce((m, o) => (o[1] < m[1] ? o : m))
  // Whole shares when that is meaningful, otherwise fractional (crypto, small accounts).
  const shares = raw >= 10 ? Math.floor(raw) : Math.floor(raw * 1000) / 1000

  const checks: RuleCheck[] = [
    {
      rule: 'Risk 1% per trade',
      pass: true,
      detail: `Losing at the stop costs about ${fmtUsd(riskAmount)} of a ${fmtUsd(equity)} account.`,
    },
    {
      rule: 'Measured edge',
      pass: enoughTrades && k != null && k > 0,
      detail: !enoughTrades
        ? `Only ${stats.trades} backtest trades on this chart; ${MIN_TRADES} are needed before the edge counts.`
        : k == null || k <= 0
          ? 'Past signals here lost more than they won (Kelly is negative). No proven edge, so paper only.'
          : `Kelly says ${(k * 100).toFixed(0)}% of the account; the analyst uses a quarter of that.`,
    },
    {
      rule: 'Max 10% in one position',
      pass: binding !== 'cap' || byRisk <= byCap,
      detail: binding === 'cap' ? `Size trimmed to ${fmtUsd(equity * MAX_POSITION_PCT)}, 10% of the account.` : `At most ${fmtUsd(equity * MAX_POSITION_PCT)} in one position.`,
    },
  ]

  return { shares, value: shares * entry, riskAmount, binding, kelly: k, checks }
}

export const BINDING_TEXT: Record<Binding, string> = {
  risk: 'the 1% risk rule',
  edge: 'the measured edge (quarter Kelly)',
  cap: 'the 10% position cap',
}
