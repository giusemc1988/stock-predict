/**
 * Simulated (paper) brokerage. No real orders are ever sent anywhere; state lives
 * in localStorage so the account survives reloads.
 */
import { useCallback, useEffect, useReducer } from 'react'

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop'
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'rejected'

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  qty: number
  price?: number
  status: OrderStatus
  createdAt: number
  filledAt?: number
  fillPrice?: number
  reason?: string
  source: 'manual' | 'robot'
}

export interface Position {
  qty: number
  avgCost: number
  realized: number
}

export interface Account {
  cash: number
  startingCash: number
  positions: Record<string, Position>
  orders: Order[]
}

const STORAGE_KEY = 'bluechip.paper.v1'
const SLIPPAGE = 0.0002
export const STARTING_CASH = 100_000

const fresh = (): Account => ({ cash: STARTING_CASH, startingCash: STARTING_CASH, positions: {}, orders: [] })

type Action =
  | { type: 'place'; order: Order; last: number }
  | { type: 'price'; symbol: string; price: number }
  | { type: 'cancel'; id: string }
  | { type: 'reset' }

function fill(acc: Account, o: Order, price: number): Account {
  const px = o.side === 'buy' ? price * (1 + SLIPPAGE) : price * (1 - SLIPPAGE)
  const pos = acc.positions[o.symbol] ?? { qty: 0, avgCost: 0, realized: 0 }
  const cost = px * o.qty
  if (o.side === 'buy' && cost > acc.cash) return reject(acc, o, 'Insufficient buying power')
  if (o.side === 'sell' && o.qty > pos.qty + 1e-9) return reject(acc, o, 'Not enough shares (no shorting in paper mode)')
  const nextPos: Position =
    o.side === 'buy'
      ? { qty: pos.qty + o.qty, avgCost: (pos.avgCost * pos.qty + cost) / (pos.qty + o.qty), realized: pos.realized }
      : { qty: pos.qty - o.qty, avgCost: pos.avgCost, realized: pos.realized + (px - pos.avgCost) * o.qty }
  const positions = { ...acc.positions, [o.symbol]: nextPos }
  if (nextPos.qty <= 1e-9 && nextPos.realized === 0) delete positions[o.symbol]
  const filled: Order = { ...o, status: 'filled', filledAt: Date.now(), fillPrice: px }
  return {
    ...acc,
    cash: acc.cash + (o.side === 'buy' ? -cost : cost),
    positions,
    orders: upsert(acc.orders, filled),
  }
}

const reject = (acc: Account, o: Order, reason: string): Account => ({ ...acc, orders: upsert(acc.orders, { ...o, status: 'rejected', reason }) })

const upsert = (orders: Order[], o: Order) => {
  const i = orders.findIndex((x) => x.id === o.id)
  if (i < 0) return [o, ...orders].slice(0, 200)
  const next = orders.slice()
  next[i] = o
  return next
}

function reducer(acc: Account, a: Action): Account {
  switch (a.type) {
    case 'place':
      if (!(a.order.qty > 0)) return reject(acc, a.order, 'Quantity must be positive')
      if (a.order.type === 'market') return fill(acc, a.order, a.last)
      return { ...acc, orders: upsert(acc.orders, a.order) }
    case 'price': {
      let next = acc
      for (const o of acc.orders) {
        if (o.status !== 'open' || o.symbol !== a.symbol || o.price == null) continue
        const hit =
          o.type === 'limit' ? (o.side === 'buy' ? a.price <= o.price : a.price >= o.price) : o.side === 'buy' ? a.price >= o.price : a.price <= o.price
        if (hit) next = fill(next, o, o.type === 'limit' ? o.price : a.price)
      }
      return next
    }
    case 'cancel': {
      const o = acc.orders.find((x) => x.id === a.id)
      return o && o.status === 'open' ? { ...acc, orders: upsert(acc.orders, { ...o, status: 'cancelled' }) } : acc
    }
    case 'reset':
      return fresh()
  }
}

function load(): Account {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...fresh(), ...JSON.parse(raw) } : fresh()
  } catch {
    return fresh()
  }
}

let seq = 0
export const newOrderId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`

export function usePaperBroker() {
  const [account, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
    } catch {
      /* ignore */
    }
  }, [account])

  const place = useCallback(
    (o: Omit<Order, 'id' | 'status' | 'createdAt'>, last: number) =>
      dispatch({ type: 'place', order: { ...o, id: newOrderId(), status: 'open', createdAt: Date.now() }, last }),
    [],
  )
  const onPrice = useCallback((symbol: string, price: number) => dispatch({ type: 'price', symbol, price }), [])
  const cancel = useCallback((id: string) => dispatch({ type: 'cancel', id }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])
  return { account, place, onPrice, cancel, reset }
}
