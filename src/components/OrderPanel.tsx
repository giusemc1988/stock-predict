import { useEffect, useState } from 'react'
import type { Instrument } from '../types'
import type { Account, Order, OrderSide, OrderType } from '../hooks/usePaperBroker'
import { fmtPrice, fmtUsd } from '../lib/format'

interface Props {
  inst: Instrument
  last: number
  account: Account
  onPlace: (o: Omit<Order, 'id' | 'status' | 'createdAt'>, last: number) => void
  autoTrade: boolean
  onAutoTrade: (v: boolean) => void
}

export function OrderPanel({ inst, last, account, onPlace, autoTrade, onAutoTrade }: Props) {
  const [side, setSide] = useState<OrderSide>('buy')
  const [type, setType] = useState<OrderType>('market')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const pos = account.positions[inst.symbol]
  const crypto = inst.assetClass === 'crypto'
  const step = crypto ? 0.001 : 1

  // reset the form when the symbol changes (or its first price arrives), not on every tick
  const hasPrice = last > 0
  useEffect(() => {
    if (!hasPrice) return
    setPrice(fmtPrice(last).replace(/,/g, ''))
    setQty(crypto ? Math.max(0.0001, 1000 / last).toFixed(4) : '10')
  }, [inst.symbol, hasPrice]) // eslint-disable-line react-hooks/exhaustive-deps

  const q = parseFloat(qty) || 0
  const px = type === 'market' ? last : parseFloat(price) || 0
  const est = q * px
  const maxBuy = px ? account.cash / px : 0
  const pct = (f: number) => {
    const v = side === 'buy' ? maxBuy * f : (pos?.qty ?? 0) * f
    setQty(crypto ? v.toFixed(4) : String(Math.floor(v)))
  }

  const submit = () => {
    onPlace({ symbol: inst.symbol, side, type, qty: q, price: type === 'market' ? undefined : px, source: 'manual' }, last)
    setConfirm(`${side === 'buy' ? 'Buy' : 'Sell'} ${q} ${inst.symbol} ${type === 'market' ? '@ market' : `${type} @ ${fmtPrice(px)}`} sent`)
    setTimeout(() => setConfirm(null), 2500)
  }

  return (
    <section className="panel order">
      <div className="panel-head">
        <span>Trade</span>
        <span className="paper-badge">PAPER</span>
      </div>
      <div className="side-toggle">
        <button className={`buy ${side === 'buy' ? 'on' : ''}`} onClick={() => setSide('buy')}>
          Buy
        </button>
        <button className={`sell ${side === 'sell' ? 'on' : ''}`} onClick={() => setSide('sell')}>
          Sell
        </button>
      </div>
      <div className="seg small">
        {(['market', 'limit', 'stop'] as const).map((t) => (
          <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <label className="field">
        <span>{type === 'stop' ? 'Stop price' : 'Limit price'}</span>
        <input className="mono" disabled={type === 'market'} value={type === 'market' ? 'Market' : price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
      </label>
      <label className="field">
        <span>Quantity</span>
        <div className="stepper">
          <button onClick={() => setQty(String(Math.max(0, +(q - step).toFixed(6))))}>−</button>
          <input className="mono" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
          <button onClick={() => setQty(String(+(q + step).toFixed(6)))}>+</button>
        </div>
      </label>
      <div className="pct-row">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <button key={f} onClick={() => pct(f)}>
            {f * 100}%
          </button>
        ))}
      </div>
      <div className="kv">
        <span>Est. {side === 'buy' ? 'cost' : 'proceeds'}</span>
        <b className="mono">{fmtUsd(est)}</b>
      </div>
      <div className="kv">
        <span>Buying power</span>
        <b className="mono">{fmtUsd(account.cash)}</b>
      </div>
      <div className="kv">
        <span>Position</span>
        <b className="mono">{pos ? `${+pos.qty.toFixed(6)} @ ${fmtPrice(pos.avgCost)}` : '—'}</b>
      </div>
      <button className={`submit ${side}`} onClick={submit} disabled={!q || !px}>
        {side === 'buy' ? 'Buy' : 'Sell'} {inst.symbol}
      </button>
      {confirm && <div className="toast">{confirm}</div>}
      <label className="auto">
        <input type="checkbox" checked={autoTrade} onChange={(e) => onAutoTrade(e.target.checked)} />
        <span>
          <b>Robot auto-trade</b>
          <em>Paper-trade new live robot signals automatically ({crypto ? '$1,000' : '10 shares'} per signal)</em>
        </span>
      </label>
    </section>
  )
}
