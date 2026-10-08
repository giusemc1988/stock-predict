import { useEffect, useState } from 'react'
import type { Analysis, Instrument } from '../types'
import type { BrokerState, OrderRequest, OrderSide, OrderType, TimeInForce } from '../broker/types'
import type { PlaceResult } from '../hooks/useBroker'
import { fmtPrice, fmtUsd } from '../lib/format'
import { InfoTip } from './InfoTip'
import { RobotIcon } from './RobotIcon'

interface Props {
  inst: Instrument
  last: number
  broker: BrokerState
  analysis: Analysis | null
  onSubmit: (r: OrderRequest) => Promise<PlaceResult>
  autoTrade: boolean
  onAutoTrade: (v: boolean) => void
  robotPaused: string | null
}

const TYPES: { id: OrderType; label: string; help: string }[] = [
  { id: 'market', label: 'Market', help: 'Buy or sell right now at the best available price.' },
  { id: 'limit', label: 'Limit', help: 'Only fill at your price or better. A buy limit fills at or below it, a sell limit at or above it.' },
  { id: 'stop', label: 'Stop', help: 'Becomes a market order once price reaches your stop. Often used to cut a loss.' },
  { id: 'stop_limit', label: 'Stop limit', help: 'When price reaches the stop, a limit order at your limit price is placed.' },
]

const clean = (v: number) => (v ? String(+v.toFixed(v < 1 ? 6 : v < 10 ? 4 : 2)) : '')

export function OrderTicket({ inst, last, broker, analysis, onSubmit, autoTrade, onAutoTrade, robotPaused }: Props) {
  const [side, setSide] = useState<OrderSide>('buy')
  const [type, setType] = useState<OrderType>('market')
  const [unit, setUnit] = useState<'qty' | 'usd'>('qty')
  const [amount, setAmount] = useState('')
  const [limit, setLimit] = useState('')
  const [stop, setStop] = useState('')
  const [tif, setTif] = useState<TimeInForce>('day')
  const [bracket, setBracket] = useState(false)
  const [tp, setTp] = useState('')
  const [sl, setSl] = useState('')
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PlaceResult | null>(null)
  const crypto = inst.assetClass === 'crypto'
  const pos = broker.positions.find((p) => p.symbol === inst.symbol)
  const bracketBlocked = broker.mode === 'alpaca' && crypto

  const hasPrice = last > 0
  useEffect(() => {
    if (!hasPrice) return
    setLimit(clean(last))
    setStop(clean(last))
    setAmount(crypto ? clean(Math.max(0.0001, 1000 / last)) : '10')
    setUnit('qty')
    setTp(clean(last * 1.03))
    setSl(clean(last * 0.98))
    setResult(null)
  }, [inst.symbol, hasPrice]) // eslint-disable-line react-hooks/exhaustive-deps

  const refPrice = type === 'market' || type === 'stop' ? (type === 'stop' ? +stop || last : last) : +limit || last
  const qty = unit === 'qty' ? +amount || 0 : refPrice ? (+amount || 0) / refPrice : 0
  const est = qty * refPrice
  const maxQty = side === 'buy' ? (refPrice ? broker.account.buyingPower / refPrice : 0) : pos?.qty ?? 0

  const quick = (f: number) => {
    const q = maxQty * f
    if (unit === 'usd') setAmount(clean(q * refPrice))
    else setAmount(crypto ? clean(q) : String(Math.floor(q)))
  }

  const useAiPlan = () => {
    if (!analysis?.plan) return
    setSide(analysis.verdict === 'SELL' ? 'sell' : 'buy')
    setBracket(true)
    setTp(clean(analysis.plan.target))
    setSl(clean(analysis.plan.stop))
  }

  const req: OrderRequest = {
    symbol: inst.symbol,
    side,
    type,
    qty: crypto ? +qty.toFixed(6) : unit === 'usd' ? +qty.toFixed(4) : qty,
    limitPrice: type === 'limit' || type === 'stop_limit' ? +limit : undefined,
    stopPrice: type === 'stop' || type === 'stop_limit' ? +stop : undefined,
    tif: crypto ? 'gtc' : tif,
    bracket: bracket && !bracketBlocked ? { takeProfit: +tp, stopLoss: +sl } : undefined,
    source: 'manual',
  }

  const problems: string[] = []
  if (!(req.qty > 0)) problems.push('Enter a quantity')
  if (side === 'buy' && est > broker.account.buyingPower) problems.push('Not enough buying power')
  if (side === 'sell' && req.qty > (pos?.qty ?? 0) + 1e-9) problems.push(`You hold ${pos ? +pos.qty.toFixed(6) : 0}; short selling is off`)
  if (req.bracket) {
    const up = side === 'buy'
    if (up ? !(req.bracket.takeProfit > refPrice) : !(req.bracket.takeProfit < refPrice)) problems.push(`Take profit should be ${up ? 'above' : 'below'} ${fmtPrice(refPrice)}`)
    if (up ? !(req.bracket.stopLoss < refPrice) : !(req.bracket.stopLoss > refPrice)) problems.push(`Stop loss should be ${up ? 'below' : 'above'} ${fmtPrice(refPrice)}`)
  }

  const submit = async () => {
    setBusy(true)
    const r = await onSubmit(req)
    setBusy(false)
    setReview(false)
    setResult(r)
  }

  const typeLabel = TYPES.find((t) => t.id === type)!.label

  return (
    <div className="ticket">
      <div className={`acct-pill ${broker.mode}`}>
        <span className="paper-badge">PAPER</span>
        <span>
          {broker.label} · {fmtUsd(broker.account.buyingPower)} buying power
        </span>
      </div>

      <div className="side-toggle">
        <button className={`buy ${side === 'buy' ? 'on' : ''}`} onClick={() => setSide('buy')}>
          Buy
        </button>
        <button className={`sell ${side === 'sell' ? 'on' : ''}`} onClick={() => setSide('sell')}>
          Sell
        </button>
      </div>

      <label className="field">
        <span>
          Order type <InfoTip text={TYPES.find((t) => t.id === type)!.help} />
        </span>
        <select value={type} onChange={(e) => setType(e.target.value as OrderType)}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {(type === 'stop' || type === 'stop_limit') && (
        <label className="field">
          <span>Stop price</span>
          <input className="mono" value={stop} onChange={(e) => setStop(e.target.value)} inputMode="decimal" />
        </label>
      )}
      {(type === 'limit' || type === 'stop_limit') && (
        <label className="field">
          <span>Limit price</span>
          <div className="stepper">
            <button onClick={() => setLimit(clean((+limit || last) * 0.999))}>−</button>
            <input className="mono" value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" />
            <button onClick={() => setLimit(clean((+limit || last) * 1.001))}>+</button>
          </div>
        </label>
      )}

      <label className="field">
        <span className="field-row">
          {unit === 'qty' ? (crypto ? 'Quantity (coins)' : 'Shares') : 'Amount (USD)'}
          <span className="unit-toggle">
            <button className={unit === 'qty' ? 'on' : ''} onClick={() => setUnit('qty')}>
              {crypto ? 'Coins' : 'Shares'}
            </button>
            <button className={unit === 'usd' ? 'on' : ''} onClick={() => setUnit('usd')}>
              $
            </button>
          </span>
        </span>
        <input className="mono" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
      </label>
      <div className="pct-row">
        {[0.1, 0.25, 0.5, 1].map((f) => (
          <button key={f} onClick={() => quick(f)}>
            {f === 1 ? 'Max' : `${f * 100}%`}
          </button>
        ))}
      </div>

      {!crypto && (
        <label className="field">
          <span>
            Time in force <InfoTip text="Day: cancels at today's close if not filled. GTC (good till canceled): stays working until it fills or you cancel it." />
          </span>
          <div className="seg full">
            <button className={tif === 'day' ? 'on' : ''} onClick={() => setTif('day')}>
              Day
            </button>
            <button className={tif === 'gtc' ? 'on' : ''} onClick={() => setTif('gtc')}>
              GTC
            </button>
          </div>
        </label>
      )}

      <div className={`bracket ${bracket ? 'on' : ''}`}>
        <label className="check">
          <input type="checkbox" checked={bracket && !bracketBlocked} disabled={bracketBlocked} onChange={(e) => setBracket(e.target.checked)} />
          <span>
            Take profit & stop loss <InfoTip text="A bracket: once your order fills, a take-profit and a stop-loss are placed. When one fills, the other is canceled automatically." />
          </span>
        </label>
        {bracketBlocked && <p className="muted tiny">Alpaca doesn't support brackets on crypto.</p>}
        {bracket && !bracketBlocked && (
          <div className="bracket-grid">
            <label className="field">
              <span className="up">Take profit</span>
              <input className="mono" value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" />
            </label>
            <label className="field">
              <span className="down">Stop loss</span>
              <input className="mono" value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" />
            </label>
          </div>
        )}
        {analysis?.plan && (
          <button className="ai-plan" onClick={useAiPlan}>
            <RobotIcon size={14} side={analysis.verdict === 'SELL' ? 'sell' : 'buy'} /> Use AI plan ({analysis.verdict}, stop {fmtPrice(analysis.plan.stop)}, target {fmtPrice(analysis.plan.target)})
          </button>
        )}
      </div>

      <div className="kv">
        <span>Market price</span>
        <b className="mono">{fmtPrice(last)}</b>
      </div>
      <div className="kv">
        <span>Estimated {side === 'buy' ? 'cost' : 'proceeds'}</span>
        <b className="mono">{fmtUsd(est)}</b>
      </div>
      <div className="kv">
        <span>You own</span>
        <b className="mono">{pos ? `${+pos.qty.toFixed(6)} @ ${fmtPrice(pos.avgCost)}` : 'None'}</b>
      </div>

      {problems.length > 0 && amount !== '' && <p className="ticket-warn">{problems[0]}</p>}
      <button className={`submit ${side}`} onClick={() => setReview(true)} disabled={!hasPrice || problems.length > 0}>
        Review {side === 'buy' ? 'buy' : 'sell'} order
      </button>
      {result && <p className={`ticket-result ${result.ok ? 'ok' : 'bad'}`}>{result.ok ? `Order sent. ${result.message}.` : result.message}</p>}

      <label className="auto">
        <input type="checkbox" checked={autoTrade} onChange={(e) => onAutoTrade(e.target.checked)} />
        <span>
          <b>Robot auto-trade</b>
          <em>
            Paper-trade new live robot signals automatically ({crypto ? '$1,000' : '10 shares'} per buy, sells the whole position on sell).
          </em>
          {robotPaused && autoTrade && <em className="down">{robotPaused}</em>}
        </span>
      </label>

      {review && (
        <div className="modal-back" onClick={() => !busy && setReview(false)}>
          <div className="modal confirm" onClick={(e) => e.stopPropagation()}>
            <h3>
              Confirm {side} order <span className="paper-badge">PAPER</span>
            </h3>
            <div className="confirm-rows mono">
              <div>
                <span>Account</span>
                <b>{broker.label}</b>
              </div>
              <div>
                <span>Symbol</span>
                <b>{inst.symbol}</b>
              </div>
              <div>
                <span>Action</span>
                <b className={side === 'buy' ? 'up' : 'down'}>{side === 'buy' ? 'Buy' : 'Sell'}</b>
              </div>
              <div>
                <span>Order</span>
                <b>
                  {typeLabel}
                  {req.stopPrice ? ` · stop ${fmtPrice(req.stopPrice)}` : ''}
                  {req.limitPrice ? ` · limit ${fmtPrice(req.limitPrice)}` : ''}
                </b>
              </div>
              <div>
                <span>Quantity</span>
                <b>{+req.qty.toFixed(6)}</b>
              </div>
              <div>
                <span>Time in force</span>
                <b>{req.tif.toUpperCase()}</b>
              </div>
              {req.bracket && (
                <>
                  <div>
                    <span>Take profit</span>
                    <b className="up">{fmtPrice(req.bracket.takeProfit)}</b>
                  </div>
                  <div>
                    <span>Stop loss</span>
                    <b className="down">{fmtPrice(req.bracket.stopLoss)}</b>
                  </div>
                </>
              )}
              <div className="total">
                <span>Estimated {side === 'buy' ? 'cost' : 'proceeds'}</span>
                <b>{fmtUsd(est)}</b>
              </div>
            </div>
            <p className="muted tiny">Practice money only. No real order is sent to any exchange.</p>
            <div className="modal-actions">
              <button onClick={() => setReview(false)} disabled={busy}>
                Edit
              </button>
              <button className={`primary ${side}`} onClick={submit} disabled={busy}>
                {busy ? 'Sending…' : `Submit ${side}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
