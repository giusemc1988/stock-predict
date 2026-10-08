import type { OrderFlow } from '../types'
import { bookImbalance } from '../lib/orderflow'
import { fmtCompact, fmtPrice } from '../lib/format'
import { InfoTip } from './InfoTip'

export function PressureBar({ buy, label }: { buy: number; label?: string }) {
  const b = Math.round(buy * 100)
  return (
    <div className="pressure">
      <div className="pressure-labels">
        <span className="up">Buyers {b}%</span>
        {label && <em>{label}</em>}
        <span className="down">{100 - b}% Sellers</span>
      </div>
      <div className="pressure-bar">
        <i className="pb-buy" style={{ width: `${b}%` }} />
        <i className="pb-sell" style={{ width: `${100 - b}%` }} />
      </div>
    </div>
  )
}

export function OrderFlowPanel({ flow, last }: { flow: OrderFlow; last: number }) {
  const total = flow.buyVolume + flow.sellVolume
  const tapeShare = total ? flow.buyVolume / total : 0.5
  const asks = flow.asks.slice(0, 10)
  const bids = flow.bids.slice(0, 10)
  const maxSize = Math.max(1e-9, ...asks.map((l) => l.size), ...bids.map((l) => l.size))
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : null
  const imb = flow.hasBook && bids.length ? bookImbalance(flow.bids, flow.asks) : null
  const d = last < 1 ? 6 : last < 10 ? 4 : 2

  return (
    <div className="flow">
      <div className="flow-src">
        <span className={`dot ${flow.live ? 'on' : ''}`} />
        {flow.source}
        {flow.estimated && <span className="badge-demo">{flow.source.startsWith('Simulated') ? 'SIM' : 'EST'}</span>}
      </div>

      <div className="section-title">
        Who is trading now <InfoTip text="Volume from traders who bought at the asking price (buyers) versus sold at the bid (sellers), over the last 5 minutes. More buyers usually means upward pressure." />
      </div>
      <PressureBar buy={tapeShare} label={`last ${flow.windowSec / 60} min`} />
      <div className="flow-vols mono">
        <span className="up">{fmtCompact(flow.buyVolume)} bought</span>
        <span className="down">{fmtCompact(flow.sellVolume)} sold</span>
      </div>

      {flow.hasBook ? (
        <>
          <div className="section-title">
            Order book <InfoTip text="Orders waiting to be filled. Asks (red) are sellers' prices, bids (green) are buyers' prices. Longer bars mean more size waiting at that price." />
          </div>
          {imb != null && <PressureBar buy={imb} label="waiting orders" />}
          <div className="book mono">
            <div className="book-head">
              <span>Price</span>
              <span>Size</span>
            </div>
            {asks
              .slice()
              .reverse()
              .map((l) => (
                <div key={'a' + l.price} className="lvl ask">
                  <i style={{ width: `${(l.size / maxSize) * 100}%` }} />
                  <span>{fmtPrice(l.price, d)}</span>
                  <span>{fmtCompact(l.size)}</span>
                </div>
              ))}
            <div className="book-mid">
              <b>{fmtPrice(last, d)}</b>
              {spread != null && <span>spread {fmtPrice(spread, d)}</span>}
            </div>
            {bids.map((l) => (
              <div key={'b' + l.price} className="lvl bid">
                <i style={{ width: `${(l.size / maxSize) * 100}%` }} />
                <span>{fmtPrice(l.price, d)}</span>
                <span>{fmtCompact(l.size)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="muted small-note">A live order book for US stocks needs a paid data plan. Buy/sell sides above are inferred from each trade's price move.</p>
      )}

      <div className="section-title">Latest trades</div>
      <div className="tape mono">
        {flow.trades.slice(0, 18).map((t) => (
          <div key={t.id} className={`tape-row ${t.side}`}>
            <span>{new Date(t.time).toLocaleTimeString('en-US', { hour12: false })}</span>
            <span>{fmtPrice(t.price, d)}</span>
            <span>{fmtCompact(t.size)}</span>
          </div>
        ))}
        {!flow.trades.length && <div className="muted">Waiting for trades…</div>}
      </div>
    </div>
  )
}
