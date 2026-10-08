import type { Analysis, BacktestStats, Signal } from '../types'
import { planText } from '../lib/analyst'
import { fmtPct, fmtPrice, fmtTime, tone } from '../lib/format'
import { RobotIcon } from './RobotIcon'
import { InfoTip } from './InfoTip'

interface Props {
  analysis: Analysis | null
  stats: BacktestStats
  lastSignal: Signal | null
  symbol: string
  tfLabel: string
  onTrade: () => void
}

const ICON = { bull: '▲', bear: '▼', neutral: '•' }

export function AnalystPanel({ analysis: a, stats, lastSignal, symbol, tfLabel, onTrade }: Props) {
  if (!a) {
    return (
      <div className="analyst">
        <div className="analyst-empty">
          <RobotIcon size={40} />
          <p>Reading the chart…</p>
        </div>
      </div>
    )
  }
  const side = a.verdict === 'BUY' ? 'buy' : a.verdict === 'SELL' ? 'sell' : undefined
  return (
    <div className="analyst">
      <div className={`verdict v-${a.verdict.toLowerCase()}`}>
        <RobotIcon side={side} size={44} />
        <div className="verdict-main">
          <span className="verdict-sub">
            AI view on {symbol} · {tfLabel} chart
          </span>
          <span className="verdict-word">{a.verdict}</span>
        </div>
        <div className="conf">
          <span>
            Confidence <InfoTip text="How strongly the signals agree, discounted by how often the model was actually right on this chart. Low means close to a coin flip." />
          </span>
          <b>{a.confidenceLabel}</b>
          <div className="conf-bar">
            <i style={{ width: `${Math.round(a.confidence * 100)}%` }} />
          </div>
        </div>
      </div>

      <p className="headline">{a.headline}</p>

      <div className="section-title">Why</div>
      <ul className="checks">
        {a.checks.map((c) => (
          <li key={c.label} className={`chk ${c.stance}`}>
            <span className="chk-icon">{ICON[c.stance]}</span>
            <div>
              <b>{c.label}</b>
              <span>{c.detail}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className={`plan ${side ?? 'hold'}`}>
        <div className="section-title">What it suggests</div>
        <p>{planText(a)}</p>
        {a.plan && (
          <div className="plan-grid mono">
            <div>
              <span>Entry</span>
              <b>{fmtPrice(a.plan.entry)}</b>
            </div>
            <div>
              <span>Stop</span>
              <b className="down">{fmtPrice(a.plan.stop)}</b>
            </div>
            <div>
              <span>Target</span>
              <b className="up">{fmtPrice(a.plan.target)}</b>
            </div>
          </div>
        )}
        {a.plan && (
          <button className="ai-plan" onClick={onTrade}>
            Open order ticket with this plan →
          </button>
        )}
      </div>

      <p className="track">{a.trackRecord}</p>

      {lastSignal && (
        <div className={`last-signal ${lastSignal.side}`}>
          <RobotIcon side={lastSignal.side} size={22} />
          <div>
            <b>
              Last robot signal: {lastSignal.side.toUpperCase()} @ {fmtPrice(lastSignal.price)}
            </b>
            <span>{fmtTime(lastSignal.time)}</span>
          </div>
        </div>
      )}

      <details className="bt">
        <summary>
          Robot backtest on this chart <InfoTip text="If you had followed every robot BUY and SELL on the bars loaded here. Past results do not predict future ones." />
        </summary>
        <div className="bt-grid">
          <div>
            <span>Robot return</span>
            <b className={`mono ${tone(stats.totalReturnPct)}`}>{fmtPct(stats.totalReturnPct)}</b>
          </div>
          <div>
            <span>Just holding</span>
            <b className={`mono ${tone(stats.buyHoldPct)}`}>{fmtPct(stats.buyHoldPct)}</b>
          </div>
          <div>
            <span>Winning trades</span>
            <b className="mono">{(stats.winRate * 100).toFixed(0)}%</b>
          </div>
          <div>
            <span>Trades</span>
            <b className="mono">{stats.trades}</b>
          </div>
          <div>
            <span>Worst dip</span>
            <b className="mono down">−{stats.maxDrawdownPct.toFixed(1)}%</b>
          </div>
          <div>
            <span>Model right</span>
            <b className="mono">{(stats.modelAccuracy * 100).toFixed(0)}%</b>
          </div>
        </div>
      </details>

      <p className="disclaimer">Not financial advice. This is an automated read of price and volume patterns, which often fail. Only trade money you can afford to lose.</p>
    </div>
  )
}
