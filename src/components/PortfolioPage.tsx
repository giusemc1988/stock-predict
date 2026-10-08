import { useState } from 'react'
import type { BrokerMode, BrokerPosition, BrokerState } from '../broker/types'
import { OPEN_STATUSES } from '../broker/types'
import type { AlpacaKeys } from '../broker/alpaca'
import { checkPaperKey } from '../broker/alpaca'
import { fmtPct, fmtUsd, tone } from '../lib/format'
import { EquityChart } from './EquityChart'
import { OrdersTable, PositionsTable } from './AccountTables'
import { InfoTip } from './InfoTip'

interface Props {
  broker: BrokerState
  period: '1D' | '1M' | '3M'
  onPeriod: (p: '1D' | '1M' | '3M') => void
  onCancel: (id: string) => void
  onClose: (p: BrokerPosition) => void
  onTrade: (symbol: string) => void
  onReset: () => void
  mode: BrokerMode
  onMode: (m: BrokerMode) => void
  alpacaKeys: AlpacaKeys
  onAlpacaKeys: (k: AlpacaKeys) => void
  lossLimit: number
  onLossLimit: (v: number) => void
  lossLimitOn: boolean
  onLossLimitOn: (v: boolean) => void
}

export function PortfolioPage(p: Props) {
  const { broker, period } = p
  const { account, positions, orders } = broker
  const [draft, setDraft] = useState(p.alpacaKeys)
  const [keyErr, setKeyErr] = useState<string | null>(null)
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status))
  const done = orders.filter((o) => !OPEN_STATUSES.includes(o.status))
  const invested = positions.reduce((a, x) => a + x.marketValue, 0)
  const investedPct = account.equity ? (invested / account.equity) * 100 : 0
  const lossUsed = p.lossLimit > 0 ? Math.max(0, -account.dayPL) / p.lossLimit : 0
  const periodPL = broker.history.length ? account.equity - broker.history[0].equity : 0

  return (
    <div className="portfolio">
      <section className="panel pf-hero">
        <div className="pf-top">
          <div>
            <span className="pf-label">
              Portfolio value <span className="paper-badge">PAPER · {broker.label}</span>
            </span>
            <div className="pf-value mono">{fmtUsd(account.equity)}</div>
            <div className={`pf-day mono ${tone(account.dayPL)}`}>
              {fmtUsd(account.dayPL)} ({fmtPct(account.dayPLPct)}) <span>today</span>
            </div>
          </div>
          <div className="pf-stats">
            <div>
              <span>Total P&L</span>
              <b className={`mono ${tone(account.totalPL ?? 0)}`}>{account.totalPL == null ? '—' : fmtUsd(account.totalPL)}</b>
            </div>
            <div>
              <span>Buying power</span>
              <b className="mono">{fmtUsd(account.buyingPower)}</b>
            </div>
            <div>
              <span>Cash</span>
              <b className="mono">{fmtUsd(account.cash)}</b>
            </div>
            <div>
              <span>Invested</span>
              <b className="mono">{fmtUsd(invested)}</b>
            </div>
          </div>
        </div>
        <div className="pf-chart-head">
          <span className={`mono ${tone(periodPL)}`}>
            {fmtUsd(periodPL)} over {period === '1D' ? 'the last day' : period === '1M' ? 'the last month' : 'the last 3 months'}
          </span>
          <div className="seg">
            {(['1D', '1M', '3M'] as const).map((x) => (
              <button key={x} className={period === x ? 'on' : ''} onClick={() => p.onPeriod(x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <EquityChart points={broker.history} up={periodPL >= 0} />
        <div className="alloc">
          <div className="alloc-bar">
            <i style={{ width: `${investedPct}%` }} />
          </div>
          <span>
            {investedPct.toFixed(0)}% invested · {(100 - investedPct).toFixed(0)}% cash
          </span>
        </div>
      </section>

      <div className="pf-cols">
        <div className="pf-main">
          <section className="panel">
            <div className="panel-head">
              <span>Positions</span>
              <span className="muted">{positions.length} holdings</span>
            </div>
            <div className="table-wrap">
              <PositionsTable positions={positions} onSelect={p.onTrade} onClose={p.onClose} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <span>Working orders</span>
              <span className="muted">{open.length}</span>
            </div>
            <div className="table-wrap">
              <OrdersTable orders={open} onCancel={p.onCancel} empty="No working orders." />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <span>Order history</span>
              <span className="muted">{done.length}</span>
            </div>
            <div className="table-wrap tall">
              <OrdersTable orders={done} empty="Filled, canceled and rejected orders appear here." />
            </div>
          </section>
        </div>

        <div className="pf-side">
          <section className="panel card">
            <div className="panel-head">
              <span>Paper account</span>
              <span className={`conn ${broker.connected ? 'ok' : 'bad'}`}>{broker.connected ? 'Connected' : broker.mode === 'alpaca' ? 'Not connected' : ''}</span>
            </div>
            <div className="seg full pad-x">
              <button className={p.mode === 'sim' ? 'on' : ''} onClick={() => p.onMode('sim')}>
                Built-in simulator
              </button>
              <button className={p.mode === 'alpaca' ? 'on' : ''} onClick={() => p.onMode('alpaca')}>
                Alpaca paper
              </button>
            </div>
            {p.mode === 'sim' ? (
              <div className="card-body">
                <p>Starts with $100,000 of practice money. Orders fill against the live prices on this screen. Everything stays in this browser.</p>
                <button className="btn-ghost danger" onClick={() => confirm('Reset the simulator to $100,000 and clear all positions and orders?') && p.onReset()}>
                  Reset simulator
                </button>
              </div>
            ) : (
              <div className="card-body">
                <p>
                  Real paper-trading account with real market fills, from Alpaca (free). Create a paper account at{' '}
                  <a href="https://app.alpaca.markets/signup" target="_blank" rel="noreferrer">
                    alpaca.markets
                  </a>
                  , then copy your <b>paper</b> API key and secret here. Live keys are refused.
                </p>
                <label className="field flush">
                  <span>API key ID</span>
                  <input className="mono" value={draft.keyId} onChange={(e) => setDraft({ ...draft, keyId: e.target.value.trim() })} placeholder="PK…" />
                </label>
                <label className="field flush">
                  <span>Secret key</span>
                  <input className="mono" type="password" value={draft.secret} onChange={(e) => setDraft({ ...draft, secret: e.target.value.trim() })} />
                </label>
                {(keyErr || broker.error) && <p className="ticket-warn">{keyErr ?? broker.error}</p>}
                <button
                  className="btn-primary"
                  onClick={() => {
                    const bad = checkPaperKey(draft.keyId)
                    setKeyErr(bad)
                    if (!bad) p.onAlpacaKeys(draft)
                  }}
                >
                  Save & connect
                </button>
                <p className="muted tiny">Keys are stored only in this browser.</p>
              </div>
            )}
          </section>

          <section className="panel card">
            <div className="panel-head">
              <span>
                Daily loss limit <InfoTip text="If today's loss reaches this amount, the robot stops placing trades until tomorrow. Your own manual orders still work, with a warning." />
              </span>
              <label className="switch">
                <input type="checkbox" checked={p.lossLimitOn} onChange={(e) => p.onLossLimitOn(e.target.checked)} />
                <i />
              </label>
            </div>
            <div className="card-body">
              <label className="field flush">
                <span>Stop the robot after losing (USD)</span>
                <input className="mono" value={p.lossLimit || ''} onChange={(e) => p.onLossLimit(Math.max(0, +e.target.value || 0))} inputMode="decimal" />
              </label>
              <div className="limit-meter">
                <div>
                  <i className={lossUsed >= 1 ? 'hit' : lossUsed > 0.7 ? 'warn' : ''} style={{ width: `${Math.min(100, lossUsed * 100)}%` }} />
                </div>
                <span>
                  {lossUsed >= 1 && p.lossLimitOn
                    ? 'Limit reached: robot paused for today'
                    : `${fmtUsd(Math.max(0, -account.dayPL))} of ${fmtUsd(p.lossLimit)} used today`}
                </span>
              </div>
            </div>
          </section>

          <p className="disclaimer">Paper trading only. Results with practice money often differ from real trading (fills, fees, emotions). Not financial advice.</p>
        </div>
      </div>
    </div>
  )
}
