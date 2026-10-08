import { useState } from 'react'
import type { Quote, Signal } from '../types'
import type { Account } from '../hooks/usePaperBroker'
import { fmtPct, fmtPrice, fmtTime, fmtUsd, tone } from '../lib/format'
import { RobotIcon } from './RobotIcon'

interface Props {
  account: Account
  quotes: Record<string, Quote>
  lastPrices: Record<string, number>
  signals: Signal[]
  symbol: string
  onCancel: (id: string) => void
  onReset: () => void
  onSelect: (symbol: string) => void
}

export function BottomPanel({ account, quotes, lastPrices, signals, symbol, onCancel, onReset, onSelect }: Props) {
  const [tab, setTab] = useState<'positions' | 'orders' | 'signals'>('positions')
  const priceOf = (s: string) => lastPrices[s] ?? quotes[s]?.price ?? 0
  const positions = Object.entries(account.positions).filter(([, p]) => p.qty > 1e-9)
  const mv = positions.reduce((a, [s, p]) => a + p.qty * priceOf(s), 0)
  const equity = account.cash + mv
  const pnl = equity - account.startingCash
  const open = account.orders.filter((o) => o.status === 'open').length

  return (
    <section className="panel bottom">
      <div className="bottom-head">
        <div className="tabs">
          <button className={tab === 'positions' ? 'on' : ''} onClick={() => setTab('positions')}>
            Positions <em>{positions.length}</em>
          </button>
          <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>
            Orders <em>{open || account.orders.length}</em>
          </button>
          <button className={tab === 'signals' ? 'on' : ''} onClick={() => setTab('signals')}>
            🤖 Signals <em>{signals.length}</em>
          </button>
        </div>
        <div className="acct mono">
          <span>
            Equity <b>{fmtUsd(equity)}</b>
          </span>
          <span>
            P&L <b className={tone(pnl)}>{fmtUsd(pnl)}</b> <b className={tone(pnl)}>({fmtPct((pnl / account.startingCash) * 100)})</b>
          </span>
          <span>
            Cash <b>{fmtUsd(account.cash)}</b>
          </span>
          <button className="link" onClick={() => confirm('Reset the paper account to $100,000?') && onReset()}>
            Reset
          </button>
        </div>
      </div>
      <div className="table-wrap">
        {tab === 'positions' && (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Qty</th>
                <th>Avg cost</th>
                <th>Last</th>
                <th>Mkt value</th>
                <th>Unrealized</th>
                <th>Realized</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No open positions. Place a paper order or enable robot auto-trade.
                  </td>
                </tr>
              )}
              {positions.map(([s, p]) => {
                const last = priceOf(s)
                const u = (last - p.avgCost) * p.qty
                return (
                  <tr key={s} onClick={() => onSelect(s)} className="click">
                    <td>
                      <b>{s}</b>
                    </td>
                    <td className="mono">{+p.qty.toFixed(6)}</td>
                    <td className="mono">{fmtPrice(p.avgCost)}</td>
                    <td className="mono">{fmtPrice(last)}</td>
                    <td className="mono">{fmtUsd(p.qty * last)}</td>
                    <td className={`mono ${tone(u)}`}>
                      {fmtUsd(u)} ({fmtPct((last / p.avgCost - 1) * 100)})
                    </td>
                    <td className={`mono ${tone(p.realized)}`}>{fmtUsd(p.realized)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {tab === 'orders' && (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {account.orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No orders yet.
                  </td>
                </tr>
              )}
              {account.orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{fmtTime(Math.floor(o.createdAt / 1000))}</td>
                  <td>
                    <b>{o.symbol}</b> {o.source === 'robot' && <RobotIcon size={13} side={o.side} title="Placed by robot" />}
                  </td>
                  <td className={o.side === 'buy' ? 'up' : 'down'}>{o.side.toUpperCase()}</td>
                  <td>{o.type}</td>
                  <td className="mono">{+o.qty.toFixed(6)}</td>
                  <td className="mono">{fmtPrice(o.fillPrice ?? o.price)}</td>
                  <td>
                    <span className={`status st-${o.status}`} title={o.reason}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    {o.status === 'open' && (
                      <button className="link" onClick={() => onCancel(o.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'signals' && (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Signal</th>
                <th>Price</th>
                <th>P(up)</th>
                <th>Confidence</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No robot signals on {symbol} in the loaded range.
                  </td>
                </tr>
              )}
              {signals
                .slice()
                .reverse()
                .map((s) => (
                  <tr key={s.time + s.side}>
                    <td className="mono">{fmtTime(s.time)}</td>
                    <td className={s.side === 'buy' ? 'up' : 'down'}>
                      <RobotIcon size={14} side={s.side} /> {s.side.toUpperCase()}
                    </td>
                    <td className="mono">{fmtPrice(s.price)}</td>
                    <td className="mono">{(s.probUp * 100).toFixed(0)}%</td>
                    <td className="mono">{(s.confidence * 100).toFixed(0)}%</td>
                    <td className="muted">{s.reasons.join(' · ')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
