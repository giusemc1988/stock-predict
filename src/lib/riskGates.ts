/**
 * Pre-trade risk gates for paper orders. The order of checks follows CloddsBot's
 * unified risk engine (MIT, alsk1992/cloddsbot): kill switch, daily loss,
 * drawdown, concentration, trade count, volatility regime. The "paper by default,
 * circuit breakers on" idea comes from MetaHarness's trading template.
 *
 * A "block" stops the order; a "warn" is shown on the review screen. Sells that
 * reduce or close a position are never blocked, so you can always get out.
 * Educational only, not financial advice.
 */
import type { BrokerState, OrderRequest } from '../broker/types'
import type { Analysis } from '../types'
import { fmtUsd } from './format'
import { getAiRules, type AiRules } from './aiRules'

export interface GateCheck {
  name: string
  level: 'pass' | 'warn' | 'block'
  message: string
}

export interface GateLimits {
  killSwitch: boolean
  lossLimitOn: boolean
  lossLimit: number
}

export function riskGates(req: OrderRequest, price: number, broker: BrokerState, analysis: Analysis | null, limits: GateLimits, rules: AiRules = getAiRules(), now = Date.now()): GateCheck[] {
  const checks: GateCheck[] = []
  const buy = req.side === 'buy'
  const equity = broker.account.equity

  checks.push(
    limits.killSwitch && buy
      ? { name: 'Kill switch', level: 'block', message: 'The kill switch is on. New buys are stopped; you can still sell.' }
      : { name: 'Kill switch', level: 'pass', message: limits.killSwitch ? 'On, but selling is always allowed.' : 'Off.' },
  )
  if (!rules.gatesOn) {
    checks.push({ name: 'Other gates', level: 'warn', message: 'Turned off in Settings > AI rules. Only the kill switch is checked.' })
    return checks
  }
  const MAX_DRAWDOWN = rules.maxDrawdownPct / 100
  const MAX_POSITION = rules.maxPositionPct / 100
  const MAX_TRADES_PER_DAY = rules.maxTradesPerDay

  const lossHit = limits.lossLimitOn && limits.lossLimit > 0 && broker.account.dayPL <= -limits.lossLimit
  checks.push(
    lossHit && buy
      ? { name: 'Daily loss limit', level: req.source === 'robot' ? 'block' : 'warn', message: `Today's loss reached your ${fmtUsd(limits.lossLimit)} limit.` }
      : { name: 'Daily loss limit', level: 'pass', message: limits.lossLimitOn ? `Within your ${fmtUsd(limits.lossLimit)} limit.` : 'Not set.' },
  )

  const peak = Math.max(equity, ...broker.history.map((h) => h.equity))
  const dd = peak > 0 ? 1 - equity / peak : 0
  checks.push(
    dd >= MAX_DRAWDOWN && buy
      ? { name: 'Drawdown', level: 'block', message: `The account is ${(dd * 100).toFixed(0)}% below its high (limit ${rules.maxDrawdownPct}%). Buys are paused.` }
      : { name: 'Drawdown', level: 'pass', message: `${(dd * 100).toFixed(1)}% below the account's high.` },
  )

  const pos = broker.positions.find((p) => p.symbol === req.symbol)
  const after = (pos?.marketValue ?? 0) + (buy ? req.qty * price : 0)
  const share = equity > 0 ? after / equity : 0
  checks.push(
    buy && share > MAX_POSITION
      ? { name: 'Concentration', level: 'block', message: `This would put ${(share * 100).toFixed(0)}% of the account in ${req.symbol} (limit ${rules.maxPositionPct}%).` }
      : { name: 'Concentration', level: 'pass', message: `${(share * 100).toFixed(0)}% of the account in ${req.symbol} after this order.` },
  )

  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const today = broker.orders.filter((o) => o.createdAt >= dayStart.getTime() && !o.parentId).length
  checks.push(
    buy && today >= MAX_TRADES_PER_DAY
      ? { name: 'Trades today', level: 'block', message: `${today} orders today (limit ${MAX_TRADES_PER_DAY}). Overtrading usually costs money.` }
      : { name: 'Trades today', level: 'pass', message: `${today} of ${MAX_TRADES_PER_DAY} orders today.` },
  )

  const ts = analysis?.tradeScore
  if (ts) {
    const r = ts.regime
    if (rules.volatilityOn) {
      checks.push(
        buy && r === 'extreme'
          ? { name: 'Volatility', level: 'block', message: `Swings are ${ts.volRatio.toFixed(1)}x normal. Buys wait until it calms down.` }
          : buy && r === 'high'
            ? { name: 'Volatility', level: 'warn', message: `Swings are ${ts.volRatio.toFixed(1)}x normal. Consider half your usual size.` }
            : { name: 'Volatility', level: 'pass', message: `Swings are ${ts.volRatio.toFixed(1)}x normal (${r}).` },
      )
    }
    checks.push(
      buy && ts.score < rules.minScoreWarn
        ? { name: 'Trade Score', level: 'warn', message: `Score ${ts.score}/100 (${ts.grade}, ${ts.signal}). The setup is weak.` }
        : { name: 'Trade Score', level: 'pass', message: `Score ${ts.score}/100 (${ts.grade}, ${ts.signal}).` },
    )
  }
  return checks
}

export const blocking = (checks: GateCheck[]) => checks.filter((c) => c.level === 'block')
