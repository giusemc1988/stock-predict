import { Fragment, useState } from 'react'
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

/** Tracks in-flight row actions so a double click can't send a request twice. */
function usePending() {
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const run = async (key: string, fn: () => unknown) => {
    if (pending.has(key)) return
    setPending((s) => new Set(s).add(key))
    try {
      await fn()
    } finally {
      setPending((s) => {
        const n = new Set(s)
        n.delete(key)
        return n
      })
    }
  }
  return [pending, run] as const
}

type Detail = { k: string; v: string; tone?: 'up' | 'down' }[]

/** Rows that carry a story (practice trades) open and close a detail line under them on click. */
function useExpanded() {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  return [open, toggle] as const
}

function DetailRow({ detail, cols }: { detail: Detail; cols: number }) {
  return (
    <tr className="pr-detail">
      <td colSpan={cols}>
        <dl>
          {detail.map((d) => (
            <Fragment key={d.k}>
              <dt>{d.k}</dt>
              <dd className={d.tone ?? ''}>{d.v}</dd>
            </Fragment>
          ))}
        </dl>
      </td>
    </tr>
  )
}

const PRACTICE_STATUS = { open: 'Open', closed: 'Closed', blocked: 'Blocked' } as const

const qtyFmt = (q: number) => (+q.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 })

export function PositionsTable({
  positions,
  onSelect,
  onClose,
  empty = 'No positions yet. Place a paper order to get started.',
}: {
  positions: (BrokerPosition & { id?: string; tag?: string; detail?: Detail })[]
  onSelect?: (s: string) => void
  onClose?: (p: BrokerPosition) => unknown
  empty?: string
}) {
  const [pending, run] = usePending()
  const [expanded, toggle] = useExpanded()
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
          <Fragment key={p.id ?? p.symbol}>
          <tr
            className={onSelect || p.detail ? 'click' : ''}
            onClick={() => {
              onSelect?.(p.symbol)
              if (p.detail && p.id) toggle(p.id)
            }}
          >
            <td>
              <b>{p.symbol}</b>
              {p.tag && <span className="leg-tag">🎯 {p.tag}</span>}
              {p.detail && <span className="pr-more">{p.id && expanded.has(p.id) ? '▾' : '▸'} details</span>}
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
                {!p.tag && (
                <button
                  className="btn-mini"
                  disabled={pending.has(p.symbol)}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Sell all ${qtyFmt(p.qty)} ${p.symbol} at market (paper)?`)) run(p.symbol, () => onClose(p))
                  }}
                >
                  {pending.has(p.symbol) ? 'Closing…' : 'Close'}
                </button>
                )}
              </td>
            )}
          </tr>
          {p.detail && p.id && expanded.has(p.id) && <DetailRow detail={p.detail} cols={onClose ? 7 : 6} />}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

export function OrdersTable({ orders, onCancel, empty = 'No orders yet.' }: { orders: (BrokerOrder & { tag?: string; detail?: Detail; practiceStatus?: keyof typeof PRACTICE_STATUS })[]; onCancel?: (id: string) => unknown; empty?: string }) {
  const [pending, run] = usePending()
  const [expanded, toggle] = useExpanded()
  const cols = onCancel ? 9 : 8
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
            <Fragment key={o.id}>
            <tr className={`${o.parentId ? 'leg' : ''}${o.detail ? ' click' : ''}`} onClick={o.detail ? () => toggle(o.id) : undefined}>
              <td className="mono">
                {new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
              </td>
              <td>
                <b>{o.symbol}</b> {o.source === 'robot' && <RobotIcon size={13} side={o.side} title="Placed by the robot" />}
                {o.legLabel && <span className="leg-tag">{o.legLabel}</span>}
                {o.tag && <span className="leg-tag">🎯 {o.tag}</span>}
                {o.detail && <span className="pr-more">{expanded.has(o.id) ? '▾' : '▸'} details</span>}
              </td>
              <td className={o.side === 'buy' ? 'up' : 'down'}>{o.side === 'buy' ? 'Buy' : 'Sell'}</td>
              <td>
                {TYPE_LABEL[o.type]} <span className="sub">{o.tif.toUpperCase()}</span>
              </td>
              <td className="mono r">{o.practiceStatus === 'blocked' ? '—' : o.filledQty && o.filledQty !== o.qty ? `${qtyFmt(o.filledQty)}/${qtyFmt(o.qty)}` : qtyFmt(o.qty)}</td>
              <td className="mono r">{px}</td>
              <td className="mono r">{o.filledPrice ? fmtPrice(o.filledPrice) : '—'}</td>
              <td>
                {o.practiceStatus && !o.parentId ? (
                  <span className={`status pst-${o.practiceStatus}`} title={o.reason}>
                    {PRACTICE_STATUS[o.practiceStatus]}
                  </span>
                ) : (
                  <span className={`status st-${o.status}`} title={o.reason}>
                    {STATUS_LABEL[o.status]}
                  </span>
                )}
                {o.reason && o.status === 'rejected' && <span className="reason">{o.reason}</span>}
              </td>
              {onCancel && (
                <td className="r">
                  {!o.tag && OPEN_STATUSES.includes(o.status) && (
                    <button className="btn-mini" disabled={pending.has(o.id)} onClick={() => run(o.id, () => onCancel(o.id))}>
                      {pending.has(o.id) ? 'Canceling…' : 'Cancel'}
                    </button>
                  )}
                </td>
              )}
            </tr>
            {o.detail && expanded.has(o.id) && <DetailRow detail={o.detail} cols={cols} />}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
