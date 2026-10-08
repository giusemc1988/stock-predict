import type { BrokerOrder, BrokerPosition } from '../broker/types'
import { OPEN_STATUSES } from '../broker/types'
import { fmtPct, fmtPrice, fmtUsd, tone } from '../lib/format'
import { RobotIcon } from './RobotIcon'

const TYPE_LABEL: Record<BrokerOrder['type'], string> = { market: 'Market', limit: 'Limit', stop: 'Stop', stop_limit: 'Stop limit' }
const STATUS_LABEL: Record<BrokerOrder['status'], string> = {
  open: 'Working',
  held: 'Waiting',
  partially_filled: 'Partial',
  filled: 'Filled',
  canceled: 'Canceled',
  rejected: 'Rejected',
  expired: 'Expired',
}

const qtyFmt = (q: number) => (+q.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 })

export function PositionsTable({
  positions,
  onSelect,
  onClose,
  empty = 'No positions yet. Place a paper order to get started.',
}: {
  positions: BrokerPosition[]
  onSelect?: (s: string) => void
  onClose?: (p: BrokerPosition) => void
  empty?: string
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th className="r">Qty</th>
          <th className="r">Avg cost</th>
          <th className="r">Last</th>
          <th className="r">Market value</th>
          <th className="r">Profit / loss</th>
          {onClose && <th />}
        </tr>
      </thead>
      <tbody>
        {positions.length === 0 && (
          <tr>
            <td colSpan={7} className="empty">
              {empty}
            </td>
          </tr>
        )}
        {positions.map((p) => (
          <tr key={p.symbol} className={onSelect ? 'click' : ''} onClick={() => onSelect?.(p.symbol)}>
            <td>
              <b>{p.symbol}</b>
            </td>
            <td className="mono r">{qtyFmt(p.qty)}</td>
            <td className="mono r">{fmtPrice(p.avgCost)}</td>
            <td className="mono r">{fmtPrice(p.last)}</td>
            <td className="mono r">{fmtUsd(p.marketValue)}</td>
            <td className={`mono r ${tone(p.unrealized)}`}>
              {fmtUsd(p.unrealized)} <span className="sub">({fmtPct(p.unrealizedPct)})</span>
            </td>
            {onClose && (
              <td className="r">
                <button
                  className="btn-mini"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Sell all ${qtyFmt(p.qty)} ${p.symbol} at market (paper)?`)) onClose(p)
                  }}
                >
                  Close
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function OrdersTable({ orders, onCancel, empty = 'No orders yet.' }: { orders: BrokerOrder[]; onCancel?: (id: string) => void; empty?: string }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Placed</th>
          <th>Symbol</th>
          <th>Side</th>
          <th>Type</th>
          <th className="r">Qty</th>
          <th className="r">Price</th>
          <th className="r">Filled at</th>
          <th>Status</th>
          {onCancel && <th />}
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 && (
          <tr>
            <td colSpan={9} className="empty">
              {empty}
            </td>
          </tr>
        )}
        {orders.map((o) => {
          const px = o.type === 'stop_limit' ? `${fmtPrice(o.stopPrice)} → ${fmtPrice(o.limitPrice)}` : o.type === 'stop' ? fmtPrice(o.stopPrice) : o.type === 'limit' ? fmtPrice(o.limitPrice) : 'Market'
          return (
            <tr key={o.id} className={o.parentId ? 'leg' : ''}>
              <td className="mono">
                {new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
              </td>
              <td>
                <b>{o.symbol}</b> {o.source === 'robot' && <RobotIcon size={13} side={o.side} title="Placed by the robot" />}
                {o.legLabel && <span className="leg-tag">{o.legLabel}</span>}
              </td>
              <td className={o.side === 'buy' ? 'up' : 'down'}>{o.side === 'buy' ? 'Buy' : 'Sell'}</td>
              <td>
                {TYPE_LABEL[o.type]} <span className="sub">{o.tif.toUpperCase()}</span>
              </td>
              <td className="mono r">{o.filledQty && o.filledQty !== o.qty ? `${qtyFmt(o.filledQty)}/${qtyFmt(o.qty)}` : qtyFmt(o.qty)}</td>
              <td className="mono r">{px}</td>
              <td className="mono r">{o.filledPrice ? fmtPrice(o.filledPrice) : '—'}</td>
              <td>
                <span className={`status st-${o.status}`} title={o.reason}>
                  {STATUS_LABEL[o.status]}
                </span>
                {o.reason && o.status === 'rejected' && <span className="reason">{o.reason}</span>}
              </td>
              {onCancel && (
                <td className="r">
                  {OPEN_STATUSES.includes(o.status) && (
                    <button className="btn-mini" onClick={() => onCancel(o.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
