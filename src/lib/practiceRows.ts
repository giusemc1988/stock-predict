import type { BrokerOrder, BrokerPosition } from '../broker/types'
import { kindOf, type PracticeState } from './practice'

/** A row from the practice account, shown in the bottom panel next to your paper account. */
export type PracticePositionRow = BrokerPosition & { id: string; tag: string }
export type PracticeOrderRow = BrokerOrder & { tag: string }

const tifOf = (p: { kind?: 'day' | 'long' }) => (kindOf(p) === 'long' ? ('gtc' as const) : ('day' as const))
const tagOf = (p: { kind?: 'day' | 'long' }) => (kindOf(p) === 'long' ? 'Practice · long' : 'Practice · day')

/**
 * The practice account as Positions, Open orders and History rows. Practice trades live in their own
 * account (practice.ts), so the broker panels never saw them. Open orders are each position's stop and
 * target (they cancel each other, like a bracket); history is every fill, newest first.
 */
export function practiceRows(s: PracticeState, priceOf: (symbol: string) => number) {
  const positions: PracticePositionRow[] = s.open.map((p) => {
    const px = priceOf(p.symbol)
    const last = Number.isFinite(px) && px > 0 ? px : p.entry
    const cost = p.qty * p.entry
    const unrealized = p.qty * (last - p.entry)
    return { id: p.id, tag: tagOf(p), symbol: p.symbol, qty: p.qty, avgCost: p.entry, last, marketValue: p.qty * last, unrealized, unrealizedPct: cost ? (unrealized / cost) * 100 : 0 }
  })
  const base = { type: 'market' as const, source: 'robot' as const }
  const working: PracticeOrderRow[] = s.open
    .slice()
    .sort((a, b) => b.openedAt - a.openedAt)
    .flatMap((p) => [
      { ...base, id: `${p.id}-tp`, tag: tagOf(p), tif: tifOf(p), symbol: p.symbol, side: 'sell' as const, type: 'limit' as const, qty: p.qty, filledQty: 0, limitPrice: p.target, status: 'open' as const, createdAt: p.openedAt, parentId: p.id, legLabel: 'Take profit' as const },
      { ...base, id: `${p.id}-sl`, tag: tagOf(p), tif: tifOf(p), symbol: p.symbol, side: 'sell' as const, type: 'stop' as const, qty: p.qty, filledQty: 0, stopPrice: p.stop, status: 'open' as const, createdAt: p.openedAt, parentId: p.id, legLabel: 'Stop loss' as const },
    ])
  const fills: PracticeOrderRow[] = []
  for (const p of [...s.open, ...s.trades]) fills.push({ ...base, id: `${p.id}-buy`, tag: tagOf(p), tif: tifOf(p), symbol: p.symbol, side: 'buy', qty: p.qty, filledQty: p.qty, status: 'filled', createdAt: p.openedAt, filledAt: p.openedAt, filledPrice: p.entry, reason: p.info?.reason })
  for (const t of s.trades) fills.push({ ...base, id: `${t.id}-sell`, tag: tagOf(t), tif: tifOf(t), symbol: t.symbol, side: 'sell', qty: t.qty, filledQty: t.qty, status: 'filled', createdAt: t.closedAt, filledAt: t.closedAt, filledPrice: t.exit, reason: `Closed: ${t.exitReason}` })
  fills.sort((a, b) => b.createdAt - a.createdAt)
  return { positions, working, history: fills }
}
