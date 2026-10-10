/**
 * Functional self-tests for the skill registry: each skill runs on simulated bars and its
 * output is checked against its schema. A skill that fails is quarantined until it passes.
 */
import { demoHistory } from '../data/demo'
import { INSTRUMENTS } from '../data/instruments'
import { DEFAULT_AI_RULES } from './aiRules'
import { analyze } from './analyst'
import { decide } from './journal'
import { checkTrade, PLAYBOOK, ruleEvidence } from './playbook'
import { rankCandidates } from './practicePicks'
import { runStrategy } from './strategy'
import { volRegime } from './tradeScore'
import type { OrderFlow } from '../types'

export interface SkillTest {
  id: string
  ok: boolean
  detail: string
}

const NO_FLOW: OrderFlow = { bids: [], asks: [], trades: [], buyVolume: 0, sellVolume: 0, windowSec: 0, hasBook: false, estimated: true, source: 'none', live: false }
const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x)

export function runSkillTests(): SkillTest[] {
  const out: SkillTest[] = []
  const t = (id: string, fn: () => string | null) => {
    try {
      const err = fn()
      out.push({ id, ok: !err, detail: err ?? 'output matches its schema' })
    } catch (e) {
      out.push({ id, ok: false, detail: e instanceof Error ? e.message : String(e) })
    }
  }
  const bars = demoHistory(INSTRUMENTS[0], '15m', 300)
  const strat = runStrategy(bars)
  const a = analyze(bars, strat, strat.prediction, NO_FLOW, DEFAULT_AI_RULES)
  t('analyst', () => (!a ? 'no analysis' : !['BUY', 'SELL', 'HOLD'].includes(a.verdict) ? `bad verdict ${a.verdict}` : !(finite(a.score) && Math.abs(a.score) <= 1) ? 'score outside -1..1' : null))
  t('trade-score', () => {
    const s = a?.tradeScore
    return !s ? null : !(finite(s.score) && s.score >= 0 && s.score <= 100) ? 'score outside 0..100' : null
  })
  t('volatility', () => {
    const v = volRegime(bars)
    return ['calm', 'normal', 'high', 'extreme'].includes(v.regime) && finite(v.ratio) ? null : 'unknown regime'
  })
  t('exit-plan', () => {
    const p = a?.exitPlan
    if (!p) return null
    return [p.entry, p.stop, p.target].every(finite) && p.stop !== p.target && p.stop > 0 ? null : 'stop or target invalid'
  })
  t('risk-sizing', () => (DEFAULT_AI_RULES.riskPerTradePct > 0 && DEFAULT_AI_RULES.positionCapPct <= 100 ? null : 'limits out of range'))
  t('learner', () => (decide([], 0.6).signal === 'HOLD' ? null : 'traded with no record'))
  t('stock-picker', () => (rankCandidates([]).length === 0 ? null : 'ranked nothing into something'))
  t('playbook', () => {
    const pos = { id: 't', symbol: 'TEST', tf: '15m', qty: 1, entry: 100, stop: 98, target: 104, openedAt: Date.UTC(2026, 9, 9, 15), barTime: 0, bars: 0, info: { verdict: 'BUY' as const, score: 0.5, grade: 'B', tradeScore: 60, regime: 'normal', learner: 'BUY' as const, reason: '' } }
    const res = checkTrade(pos, [])
    if (PLAYBOOK.some((r) => !(r.id in res) || ![true, false, null].includes(res[r.id]))) return 'a rule gave no result'
    if (res.rr !== true || res.tightStop !== true) return 'a 2:1 trade with a 2% stop failed its checks'
    return ruleEvidence([], { minFollowed: 30, margin: 0.03 }).every((e) => e.status === 'unproven') ? null : 'judged a rule with no trades'
  })
  return out
}
