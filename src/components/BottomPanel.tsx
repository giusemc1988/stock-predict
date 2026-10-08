import { useState } from 'react'
import type { Signal } from '../types'
import type { BrokerPosition, BrokerState } from '../broker/types'
import { OPEN_STATUSES } from '../broker/types'
import { fmtPct, fmtPrice, fmtTime, fmtUsd, tone } from '../lib/format'
import { RobotIcon } from './RobotIcon'
import { OrdersTable, PositionsTable } from './AccountTables'

interface Props {
  broker: BrokerState
  signals: Signal[]
  symbol: string
  onCancel: (id: string) => unknown
  onClose: (p: BrokerPosition) => unknown
  onSelect: (symbol: string) => void
  onPortfolio: () => void
}

export function BottomPanel({ broker, signals, symbol, onCancel, onClose, onSelect, onPortfolio }: Props) {
  const [tab, setTab] = useState<'positions' | 'open' | 'history' | 'signals'>('positions')
  const { account, positions, orders } = broker
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status))

  return (
    <section className="panel bottom">
      <div className="bottom-head">
        <div className="tabs">
          <button className={tab === 'positions' ? 'on' : ''} onClick={() => setTab('positions')}>
            Positions <em>{positions.length}</em>
          </button>
          <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>
            Open orders <em>{open.length}</em>
          </button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
            History
          </button>
          <button className={tab === 'signals' ? 'on' : ''} onClick={() => setTab('signals')}>
            🤖 Signals <em>{signals.length}</em>
          </button>
        </div>
        <button className="acct mono" onClick={onPortfolio} title="Open portfolio">
          <span>
            Value <b>{fmtUsd(account.equity)}</b>
          </span>
          <span>
            Today <b className={tone(account.dayPL)}>{fmtUsd(account.dayPL)}</b> <b className={tone(account.dayPL)}>({fmtPct(account.dayPLPct)})</b>
          </span>
          <span>
            Buying power <b>{fmtUsd(account.buyingPower)}</b>
          </span>
        </button>
      </div>
      <div className="table-wrap">
        {tab === 'positions' && <PositionsTable positions={positions} onSelect={onSelect} onClose={onClose} />}
        {tab === 'open' && <OrdersTable orders={open} onCancel={onCancel} empty="No working orders." />}
        {tab === 'history' && <OrdersTable orders={orders.filter((o) => !OPEN_STATUSES.includes(o.status))} empty="No completed orders yet." />}
        {tab === 'signals' && (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Signal</th>
                <th className="r">Price</th>
                <th className="r">P(up)</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
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
                    <td className="mono r">{fmtPrice(s.price)}</td>
                    <td className="mono r">{(s.probUp * 100).toFixed(0)}%</td>
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
