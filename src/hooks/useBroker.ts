/**
 * One brokerage interface for the UI, backed by either the local simulator or an
 * Alpaca PAPER account. Both are practice money only.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { BrokerMode, BrokerOrder, BrokerPosition, BrokerState, EquityPoint, OrderRequest } from '../broker/types'
import { freshSim, simEquity, simReducer, type SimState } from '../broker/sim'
import type { AlpacaKeys } from '../broker/alpaca'

const SIM_KEY = 'bluechip.sim.v2'

function loadSim(): SimState {
  try {
    const raw = localStorage.getItem(SIM_KEY)
    return raw ? { ...freshSim(), ...JSON.parse(raw) } : freshSim()
  } catch {
    return freshSim()
  }
}

export interface PlaceResult {
  ok: boolean
  message: string
}

export function useBroker(mode: BrokerMode, keys: AlpacaKeys, historyPeriod: '1D' | '1M' | '3M') {
  const [sim, dispatch] = useReducer(simReducer, undefined, loadSim)
  const [remote, setRemote] = useState<Omit<BrokerState, 'mode' | 'label' | 'history'> | null>(null)
  const [remoteHistory, setRemoteHistory] = useState<EquityPoint[]>([])
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const keysRef = useRef(keys)
  keysRef.current = keys
  const alpaca = mode === 'alpaca'

  useEffect(() => {
    try {
      localStorage.setItem(SIM_KEY, JSON.stringify(sim))
    } catch {
      /* storage full or blocked */
    }
  }, [sim])

  useEffect(() => {
    if (alpaca) return
    const id = setInterval(() => dispatch({ type: 'snapshot' }), 60_000)
    dispatch({ type: 'snapshot' })
    return () => clearInterval(id)
  }, [alpaca])

  // several refreshes can overlap (poll, place, cancel); only the newest may write state
  const reqSeq = useRef(0)
  const refresh = useCallback(async () => {
    const my = ++reqSeq.current
    try {
      const res = await fetch('/api/broker/snapshot')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const snap = (await res.json()) as { account: any; positions: any; orders: any; status: string; error?: string }
      if (snap.error) throw new Error(snap.error)
      if (my !== reqSeq.current) return
      setRemote({ connected: snap.status === 'ACTIVE', error: null, account: snap.account, positions: snap.positions, orders: snap.orders })
      setRemoteError(null)
    } catch (e) {
      if (my !== reqSeq.current) return
      setRemoteError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (!alpaca) {
      setRemote(null)
      setRemoteError(null)
      return
    }
    // a poll waits for the previous one, so a slow snapshot is not superseded forever
    let stop = false
    let pending = false
    const poll = () => {
      if (stop || pending) return
      pending = true
      refresh().finally(() => (pending = false))
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => {
      stop = true
      clearInterval(id)
      reqSeq.current++ // drop responses for the old mode or keys
    }
  }, [alpaca, keys.keyId, keys.secret, refresh])

  useEffect(() => {
    if (!alpaca) return
    const load = async () => {
      try {
        const res = await fetch(`/api/broker/history?period=${historyPeriod}`)
        if (res.ok) {
          const data = (await res.json()) as { history: any[]; error?: string }
          if (!data.error) setRemoteHistory(data.history)
        }
      } catch {
        /* ignore errors */
      }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [alpaca, keys.keyId, keys.secret, historyPeriod])

  const place = useCallback(
    async (req: OrderRequest, last: number): Promise<PlaceResult> => {
      if (!alpaca) {
        dispatch({ type: 'place', req, last })
        return { ok: true, message: 'Sent to simulator' }
      }
      try {
        const crypto = req.symbol.includes('/')
        const body: Record<string, unknown> = {
          symbol: req.symbol,
          qty: String(+req.qty.toFixed(crypto ? 8 : 4)),
          side: req.side,
          type: req.type,
          time_in_force: crypto ? 'gtc' : req.tif,
          client_order_id: req.clientOrderId ?? `${req.source}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        }
        const px = (p: number) => (crypto ? String(+p.toPrecision(8)) : p.toFixed(p >= 1 ? 2 : 4))
        if (req.limitPrice != null && (req.type === 'limit' || req.type === 'stop_limit')) body.limit_price = px(req.limitPrice)
        if (req.stopPrice != null && (req.type === 'stop' || req.type === 'stop_limit')) body.stop_price = px(req.stopPrice)
        if (req.bracket) {
          if (crypto) throw new Error('Alpaca does not support bracket orders for crypto')
          body.order_class = 'bracket'
          body.take_profit = { limit_price: px(req.bracket.takeProfit) }
          body.stop_loss = { stop_price: px(req.bracket.stopLoss) }
        }
        const res = await fetch('/api/broker/place', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as any
        if (data.error) throw new Error(data.error)
        refresh()
        return { ok: true, message: 'Sent to Alpaca paper' }
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) }
      }
    },
    [alpaca, refresh],
  )

  const cancel = useCallback(
    async (id: string) => {
      if (!alpaca) return dispatch({ type: 'cancel', id })
      try {
        const res = await fetch('/api/broker/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
        if (res.ok) refresh()
      } catch {
        /* ignore errors */
      }
    },
    [alpaca, refresh],
  )

  const closePosition = useCallback(
    async (symbol: string, last: number) => {
      if (alpaca) {
        try {
          const res = await fetch('/api/broker/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol }) })
          if (res.ok) refresh()
        } catch {
          /* ignore errors */
        }
        return
      }
      const p = sim.positions[symbol]
      if (p) dispatch({ type: 'place', req: { symbol, side: 'sell', type: 'market', qty: p.qty, tif: 'day', source: 'manual' }, last })
    },
    [alpaca, refresh, sim.positions],
  )

  const onPrice = useCallback((symbol: string, price: number) => dispatch({ type: 'price', symbol, price }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  let state: BrokerState
  if (alpaca) {
    const r = remote
    const base = remoteHistory[0]?.equity
    state = {
      mode,
      label: 'Alpaca Paper',
      connected: !!r?.connected && !remoteError,
      error: remoteError,
      account: r ? { ...r.account, totalPL: base ? r.account.equity - base : null } : { equity: 0, cash: 0, buyingPower: 0, dayPL: 0, dayPLPct: 0, totalPL: null },
      positions: r?.positions ?? [],
      orders: r?.orders ?? [],
      history: remoteHistory,
    }
  } else {
    const equity = simEquity(sim)
    const positions: BrokerPosition[] = Object.entries(sim.positions).map(([symbol, p]) => {
      const last = sim.marks[symbol] ?? p.avgCost
      return {
        symbol,
        qty: p.qty,
        avgCost: p.avgCost,
        last,
        marketValue: p.qty * last,
        unrealized: (last - p.avgCost) * p.qty,
        unrealizedPct: (last / p.avgCost - 1) * 100,
        realized: p.realized,
      }
    })
    const now = Math.floor(Date.now() / 1000)
    const cutoff = historyPeriod === '1D' ? now - 86400 : historyPeriod === '1M' ? now - 30 * 86400 : now - 90 * 86400
    state = {
      mode,
      label: 'Simulator',
      connected: true,
      error: null,
      account: {
        equity,
        cash: sim.cash,
        buyingPower: sim.cash,
        dayPL: equity - sim.dayStart.equity,
        dayPLPct: sim.dayStart.equity ? ((equity - sim.dayStart.equity) / sim.dayStart.equity) * 100 : 0,
        totalPL: equity - sim.startingCash,
      },
      positions,
      orders: sim.orders as BrokerOrder[],
      history: [...sim.history.filter((h) => h.time >= cutoff), { time: now, equity }],
    }
  }

  return { state, place, cancel, closePosition, onPrice, reset }
}
