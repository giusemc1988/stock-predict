export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'
export type TimeInForce = 'day' | 'gtc'
export type OrderStatus = 'open' | 'held' | 'partially_filled' | 'filled' | 'canceled' | 'rejected' | 'expired'

export const OPEN_STATUSES: OrderStatus[] = ['open', 'held', 'partially_filled']

export interface OrderRequest {
  symbol: string
  side: OrderSide
  type: OrderType
  qty: number
  limitPrice?: number
  stopPrice?: number
  tif: TimeInForce
  /** Attach a take-profit and a stop-loss that cancel each other (bracket / OCO). */
  bracket?: { takeProfit: number; stopLoss: number }
  source: 'manual' | 'robot'
}

export interface BrokerOrder {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  qty: number
  filledQty: number
  limitPrice?: number
  stopPrice?: number
  tif: TimeInForce
  status: OrderStatus
  createdAt: number
  filledAt?: number
  filledPrice?: number
  reason?: string
  source: 'manual' | 'robot'
  /** For bracket legs: the entry order id. */
  parentId?: string
  legLabel?: 'Take profit' | 'Stop loss'
  /** Simulator only: a stop-limit whose stop has been hit. */
  triggered?: boolean
}

export interface BrokerPosition {
  symbol: string
  qty: number
  avgCost: number
  last: number
  marketValue: number
  unrealized: number
  unrealizedPct: number
  realized?: number
}

export interface BrokerAccount {
  equity: number
  cash: number
  buyingPower: number
  dayPL: number
  dayPLPct: number
  totalPL: number | null
}

export interface EquityPoint {
  time: number // unix seconds
  equity: number
}

export type BrokerMode = 'sim' | 'alpaca'

export interface BrokerState {
  mode: BrokerMode
  label: string
  connected: boolean
  error: string | null
  account: BrokerAccount
  positions: BrokerPosition[]
  orders: BrokerOrder[]
  history: EquityPoint[]
}
