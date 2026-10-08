/**
 * Local paper-trading simulator. Fills against live (or simulated) prices from
 * the app's own feeds. Supports market, limit, stop, stop-limit and bracket
 * (take-profit + stop-loss, one-cancels-other) orders. Nothing leaves the browser.
 */
import type { BrokerOrder, EquityPoint, OrderRequest } from './types'
import { OPEN_STATUSES } from './types'

export const SIM_STARTING_CASH = 100_000
const SLIPPAGE = 0.0002

export interface SimPosition {
  qty: number
  avgCost: number
  realized: number
}

export interface SimState {
  cash: number
  startingCash: number
  positions: Record<string, SimPosition>
  orders: BrokerOrder[]
  marks: Record<string, number>
  dayStart: { date: string; equity: number }
  history: EquityPoint[]
}

export const today = () => new Date().toLocaleDateString('en-CA')

export const freshSim = (): SimState => ({
  cash: SIM_STARTING_CASH,
  startingCash: SIM_STARTING_CASH,
  positions: {},
  orders: [],
  marks: {},
  dayStart: { date: today(), equity: SIM_STARTING_CASH },
  history: [{ time: Math.floor(Date.now() / 1000), equity: SIM_STARTING_CASH }],
})

export type SimAction =
  | { type: 'place'; req: OrderRequest; last: number }
  | { type: 'price'; symbol: string; price: number }
  | { type: 'cancel'; id: string }
  | { type: 'snapshot' }
  | { type: 'reset' }

let seq = 0
const newId = () => `sim-${Date.now().toString(36)}-${(seq++).toString(36)}`

export function simEquity(s: SimState) {
  let v = s.cash
  for (const [sym, p] of Object.entries(s.positions)) v += p.qty * (s.marks[sym] ?? p.avgCost)
  return v
}

const upsert = (orders: BrokerOrder[], o: BrokerOrder) => {
  const i = orders.findIndex((x) => x.id === o.id)
  if (i < 0) return [o, ...orders].slice(0, 300)
  const next = orders.slice()
  next[i] = o
  return next
}

// a rejected entry also cancels its bracket legs, so they don't linger as working orders
const reject = (s: SimState, o: BrokerOrder, reason: string): SimState => ({
  ...s,
  orders: upsert(s.orders, { ...o, status: 'rejected', reason }).map((x) =>
    x.parentId === o.id && OPEN_STATUSES.includes(x.status) ? { ...x, status: 'canceled' as const, reason: 'Entry order rejected' } : x,
  ),
})

function fill(s: SimState, o: BrokerOrder, price: number): SimState {
  const px = o.type === 'limit' || o.type === 'stop_limit' ? price : o.side === 'buy' ? price * (1 + SLIPPAGE) : price * (1 - SLIPPAGE)
  const pos = s.positions[o.symbol] ?? { qty: 0, avgCost: 0, realized: 0 }
  const cost = px * o.qty
  if (o.side === 'buy' && cost > s.cash + 1e-6) return reject(s, o, 'Insufficient buying power')
  if (o.side === 'sell' && o.qty > pos.qty + 1e-9) return reject(s, o, 'Not enough shares to sell (short selling is off)')
  const nextPos: SimPosition =
    o.side === 'buy'
      ? { qty: pos.qty + o.qty, avgCost: (pos.avgCost * pos.qty + cost) / (pos.qty + o.qty), realized: pos.realized }
      : { qty: pos.qty - o.qty, avgCost: pos.avgCost, realized: pos.realized + (px - pos.avgCost) * o.qty }
  const positions = { ...s.positions, [o.symbol]: nextPos }
  if (nextPos.qty <= 1e-9) delete positions[o.symbol]
  let orders = upsert(s.orders, { ...o, status: 'filled', filledQty: o.qty, filledAt: Date.now(), filledPrice: px })
  // bracket: entry filled → arm its legs; a leg filled → cancel its sibling (OCO)
  orders = orders.map((x) => {
    if (x.parentId === o.id && x.status === 'held') return { ...x, status: 'open' as const }
    if (o.parentId && x.parentId === o.parentId && x.id !== o.id && OPEN_STATUSES.includes(x.status)) return { ...x, status: 'canceled' as const, reason: 'Other bracket leg filled' }
    return x
  })
  return { ...s, cash: s.cash + (o.side === 'buy' ? -cost : cost), positions, orders, marks: { ...s.marks, [o.symbol]: price } }
}

function rollDay(s: SimState): SimState {
  const d = today()
  return s.dayStart.date === d ? s : { ...s, dayStart: { date: d, equity: simEquity(s) } }
}

export function simReducer(s: SimState, a: SimAction): SimState {
  switch (a.type) {
    case 'place': {
      const r = a.req
      const base: BrokerOrder = {
        id: newId(),
        symbol: r.symbol,
        side: r.side,
        type: r.type,
        qty: r.qty,
        filledQty: 0,
        limitPrice: r.limitPrice,
        stopPrice: r.stopPrice,
        tif: r.tif,
        status: 'open',
        createdAt: Date.now(),
        source: r.source,
      }
      if (!(r.qty > 0)) return reject(s, base, 'Quantity must be more than zero')
      if ((r.type === 'limit' || r.type === 'stop_limit') && !(r.limitPrice! > 0)) return reject(s, base, 'Enter a limit price')
      if ((r.type === 'stop' || r.type === 'stop_limit') && !(r.stopPrice! > 0)) return reject(s, base, 'Enter a stop price')
      let next: SimState = { ...rollDay(s), orders: upsert(s.orders, base), marks: a.last ? { ...s.marks, [r.symbol]: a.last } : s.marks }
      if (r.bracket) {
        const exit: OrderRequest['side'] = r.side === 'buy' ? 'sell' : 'buy'
        const leg = (type: 'limit' | 'stop', price: number, label: BrokerOrder['legLabel']): BrokerOrder => ({
          ...base,
          id: newId(),
          side: exit,
          type,
          limitPrice: type === 'limit' ? price : undefined,
          stopPrice: type === 'stop' ? price : undefined,
          tif: 'gtc',
          status: 'held',
          parentId: base.id,
          legLabel: label,
        })
        next = { ...next, orders: [leg('limit', r.bracket.takeProfit, 'Take profit'), leg('stop', r.bracket.stopLoss, 'Stop loss'), ...next.orders] }
      }
      if (r.type === 'market') {
        if (!(a.last > 0)) return reject(next, base, 'No price available yet')
        return fill(next, base, a.last)
      }
      // a marketable limit fills right away, like a real exchange
      return simReducer(next, { type: 'price', symbol: r.symbol, price: a.last })
    }
    case 'price': {
      if (!(a.price > 0)) return s
      let next: SimState = rollDay({ ...s, marks: { ...s.marks, [a.symbol]: a.price } })
      for (const o0 of s.orders) {
        const o = next.orders.find((x) => x.id === o0.id)!
        if (o.status !== 'open' || o.symbol !== a.symbol) continue
        const p = a.price
        const limitHit = o.limitPrice != null && (o.side === 'buy' ? p <= o.limitPrice : p >= o.limitPrice)
        const stopHit = o.stopPrice != null && (o.side === 'buy' ? p >= o.stopPrice : p <= o.stopPrice)
        if (o.type === 'limit' && limitHit) next = fill(next, o, o.side === 'buy' ? Math.min(p, o.limitPrice!) : Math.max(p, o.limitPrice!))
        else if (o.type === 'stop' && stopHit) next = fill(next, o, p)
        else if (o.type === 'stop_limit') {
          const armed = o.triggered || stopHit
          if (armed && limitHit) next = fill(next, o, o.limitPrice!)
          else if (armed && !o.triggered) next = { ...next, orders: upsert(next.orders, { ...o, triggered: true }) }
        }
      }
      return next
    }
    case 'cancel': {
      const o = s.orders.find((x) => x.id === a.id)
      if (!o || !OPEN_STATUSES.includes(o.status)) return s
      // cancelling an entry also cancels its bracket legs
      return { ...s, orders: s.orders.map((x) => (x.id === a.id || (x.parentId === a.id && OPEN_STATUSES.includes(x.status)) ? { ...x, status: 'canceled' as const } : x)) }
    }
    case 'snapshot': {
      const eq = simEquity(s)
      const t = Math.floor(Date.now() / 1000)
      const last = s.history[s.history.length - 1]
      if (last && t - last.time < 55) return s
      return { ...rollDay(s), history: [...s.history, { time: t, equity: eq }].slice(-2000) }
    }
    case 'reset':
      return freshSim()
  }
}
