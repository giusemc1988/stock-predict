/**
 * Alpaca PAPER trading client. The endpoint is hard-wired to paper-api, and live
 * keys are refused, so this app can never place a real-money order.
 */
import type { BrokerAccount, BrokerOrder, BrokerPosition, EquityPoint, OrderRequest, OrderStatus, OrderType } from './types'

const PAPER = 'https://paper-api.alpaca.markets'

export interface AlpacaKeys {
  keyId: string
  secret: string
}

export function checkPaperKey(keyId: string) {
  if (!keyId) return 'Enter your paper API key ID'
  if (/^AK/i.test(keyId)) return 'That looks like a LIVE key (starts with AK). Only paper keys (start with PK) are allowed here.'
  if (!/^PK/i.test(keyId)) return 'Alpaca paper key IDs start with PK. Check that you copied the Key ID from the Paper account on app.alpaca.markets.'
  return null
}

/** Alpha Vantage keys are 16 letters/digits; Alpaca key IDs start with PK or AK and are longer. */
export const looksLikeAlphaVantage = (k: string) => /^[A-Z0-9]{16}$/i.test(k) && !/^(PK|AK)/i.test(k)

async function call<T>(keys: AlpacaKeys, path: string, init: RequestInit = {}): Promise<T> {
  const bad = checkPaperKey(keys.keyId)
  if (bad) throw new Error(bad)
  let res: Response
  try {
    res = await fetch(PAPER + path, {
      ...init,
      headers: { 'APCA-API-KEY-ID': keys.keyId, 'APCA-API-SECRET-KEY': keys.secret, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
  } catch {
    throw new Error('Could not reach Alpaca (network or browser blocked the request)')
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message || `Alpaca error ${res.status}`)
  return body as T
}

/** Watchlist symbol ↔ Alpaca symbol. Alpaca crypto trades against USD, e.g. BTC/USD. */
export const toAlpaca = (symbol: string) => symbol.replace('/USDT', '/USD')
export const fromAlpaca = (sym: string) => {
  if (sym.includes('/')) return sym.replace('/USD', '/USDT')
  const m = sym.match(/^([A-Z]+)USD$/)
  return m && ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX', 'LTC', 'LINK'].includes(m[1]) ? `${m[1]}/USDT` : sym
}
export const isCrypto = (symbol: string) => symbol.includes('/')

const STATUS: Record<string, OrderStatus> = {
  new: 'open',
  accepted: 'open',
  pending_new: 'open',
  accepted_for_bidding: 'open',
  pending_replace: 'open',
  pending_cancel: 'open',
  calculated: 'open',
  done_for_day: 'open',
  held: 'held',
  partially_filled: 'partially_filled',
  filled: 'filled',
  canceled: 'canceled',
  replaced: 'canceled',
  stopped: 'filled',
  rejected: 'rejected',
  suspended: 'rejected',
  expired: 'expired',
}

interface RawOrder {
  id: string
  client_order_id: string
  symbol: string
  side: 'buy' | 'sell'
  type: string
  qty: string | null
  notional: string | null
  filled_qty: string
  filled_avg_price: string | null
  limit_price: string | null
  stop_price: string | null
  time_in_force: string
  status: string
  created_at: string
  filled_at: string | null
  order_class: string
  legs?: RawOrder[] | null
}

const num = (x: string | null | undefined) => (x == null ? undefined : +x)

function mapOrder(o: RawOrder, parentId?: string): BrokerOrder[] {
  const own: BrokerOrder = {
    id: o.id,
    symbol: fromAlpaca(o.symbol),
    side: o.side,
    type: (['market', 'limit', 'stop', 'stop_limit'].includes(o.type) ? o.type : 'market') as OrderType,
    qty: +(o.qty ?? o.filled_qty ?? 0),
    filledQty: +o.filled_qty,
    limitPrice: num(o.limit_price),
    stopPrice: num(o.stop_price),
    tif: o.time_in_force === 'day' ? 'day' : 'gtc',
    status: STATUS[o.status] ?? 'open',
    createdAt: Date.parse(o.created_at),
    filledAt: o.filled_at ? Date.parse(o.filled_at) : undefined,
    filledPrice: num(o.filled_avg_price),
    source: o.client_order_id?.startsWith('robot-') ? 'robot' : 'manual',
    parentId,
    legLabel: parentId ? (o.type === 'limit' ? 'Take profit' : 'Stop loss') : undefined,
  }
  return [own, ...(o.legs ?? []).flatMap((l) => mapOrder(l, o.id))]
}

export async function alpacaSnapshot(keys: AlpacaKeys) {
  const [acct, pos, orders] = await Promise.all([
    call<Record<string, string>>(keys, '/v2/account'),
    call<Record<string, string>[]>(keys, '/v2/positions'),
    call<RawOrder[]>(keys, '/v2/orders?status=all&limit=100&nested=true&direction=desc'),
  ])
  const equity = +acct.equity
  const lastEquity = +acct.last_equity
  const account: BrokerAccount = {
    equity,
    cash: +acct.cash,
    buyingPower: +acct.buying_power,
    dayPL: equity - lastEquity,
    dayPLPct: lastEquity ? ((equity - lastEquity) / lastEquity) * 100 : 0,
    totalPL: null,
  }
  const positions: BrokerPosition[] = pos.map((p) => ({
    symbol: fromAlpaca(p.symbol),
    qty: +p.qty,
    avgCost: +p.avg_entry_price,
    last: +p.current_price,
    marketValue: +p.market_value,
    unrealized: +p.unrealized_pl,
    unrealizedPct: +p.unrealized_plpc * 100,
  }))
  return { account, positions, orders: orders.flatMap((o) => mapOrder(o)), status: acct.status }
}

export async function alpacaHistory(keys: AlpacaKeys, period: '1D' | '1M' | '3M'): Promise<EquityPoint[]> {
  const tf = period === '1D' ? '5Min' : '1D'
  const h = await call<{ timestamp: number[]; equity: (number | null)[] }>(keys, `/v2/account/portfolio/history?period=${period}&timeframe=${tf}&extended_hours=true`)
  return h.timestamp.flatMap((t, i) => (h.equity[i] != null && h.equity[i]! > 0 ? [{ time: t, equity: h.equity[i]! }] : []))
}

export async function alpacaPlace(keys: AlpacaKeys, r: OrderRequest) {
  const crypto = isCrypto(r.symbol)
  const body: Record<string, unknown> = {
    symbol: toAlpaca(r.symbol),
    qty: String(+r.qty.toFixed(crypto ? 8 : 4)),
    side: r.side,
    type: r.type,
    time_in_force: crypto ? 'gtc' : r.tif,
    client_order_id: `${r.source}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  }
  // Alpaca allows more decimals for crypto and for stocks under $1; don't silently round those away
  const px = (p: number) => (crypto ? String(+p.toPrecision(8)) : p.toFixed(p >= 1 ? 2 : 4))
  if (r.limitPrice != null && (r.type === 'limit' || r.type === 'stop_limit')) body.limit_price = px(r.limitPrice)
  if (r.stopPrice != null && (r.type === 'stop' || r.type === 'stop_limit')) body.stop_price = px(r.stopPrice)
  if (r.bracket) {
    if (crypto) throw new Error('Alpaca does not support bracket orders for crypto')
    body.order_class = 'bracket'
    body.take_profit = { limit_price: px(r.bracket.takeProfit) }
    body.stop_loss = { stop_price: px(r.bracket.stopLoss) }
  }
  return call<RawOrder>(keys, '/v2/orders', { method: 'POST', body: JSON.stringify(body) })
}

export const alpacaCancel = (keys: AlpacaKeys, id: string) => call<void>(keys, `/v2/orders/${id}`, { method: 'DELETE' })
export const alpacaClose = (keys: AlpacaKeys, symbol: string) => call<RawOrder>(keys, `/v2/positions/${encodeURIComponent(toAlpaca(symbol).replace('/', ''))}`, { method: 'DELETE' })
