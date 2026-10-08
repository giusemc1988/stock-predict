import type { BacktestStats, Prediction, Signal } from '../types'
import { fmtPct, fmtPrice, fmtTime, tone } from '../lib/format'
import { RobotIcon } from './RobotIcon'

interface Props {
  prediction: Prediction | null
  stats: BacktestStats
  lastSignal: Signal | null
  tfLabel: string
}

export function AIPanel({ prediction: p, stats, lastSignal, tfLabel }: Props) {
  const pct = p ? p.probUp * 100 : 50
  const maxContrib = p ? Math.max(0.01, ...p.factors.map((f) => Math.abs(f.contribution))) : 1
  return (
    <section className="panel ai">
      <div className="panel-head">
        <span className="ai-title">
          <RobotIcon size={18} side={p?.bias === 'bullish' ? 'buy' : p?.bias === 'bearish' ? 'sell' : undefined} /> Bluechip AI
        </span>
        <span className="muted">next {p?.horizon ?? 5} × {tfLabel}</span>
      </div>
      {!p ? (
        <div className="muted pad">Warming up the model…</div>
      ) : (
        <>
          <div className={`bias bias-${p.bias}`}>
            <div>
              <span className="bias-label">{p.bias.toUpperCase()}</span>
              <span className="muted">Confidence {(p.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="gauge" title="Model probability of an up move">
              <div className="gauge-fill" style={{ width: `${pct}%` }} />
              <div className="gauge-mid" />
              <span className="mono">P(up) {pct.toFixed(1)}%</span>
            </div>
          </div>
          <div className="kv">
            <span>Projected price</span>
            <b className={`mono ${tone(p.score)}`}>{fmtPrice(p.targetPrice)}</b>
          </div>
          <div className="kv">
            <span>RSI 14 · ATR 14</span>
            <b className="mono">
              {p.rsi.toFixed(1)} · {fmtPrice(p.atr)}
            </b>
          </div>
          <div className="factors">
            {p.factors.map((f) => (
              <div key={f.name} className="factor" title={f.label}>
                <span className="fname">{f.name}</span>
                <div className="fbar">
                  <i
                    className={f.contribution >= 0 ? 'pos' : 'neg'}
                    style={{ width: `${(Math.abs(f.contribution) / maxContrib) * 50}%`, [f.contribution >= 0 ? 'left' : 'right']: '50%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {lastSignal && (
        <div className={`last-signal ${lastSignal.side}`}>
          <RobotIcon side={lastSignal.side} size={22} />
          <div>
            <b>
              {lastSignal.side.toUpperCase()} @ {fmtPrice(lastSignal.price)}
            </b>
            <span>{fmtTime(lastSignal.time)}</span>
          </div>
        </div>
      )}
      <div className="bt-grid">
        <div>
          <span>Strategy</span>
          <b className={`mono ${tone(stats.totalReturnPct)}`}>{fmtPct(stats.totalReturnPct)}</b>
        </div>
        <div>
          <span>Buy & hold</span>
          <b className={`mono ${tone(stats.buyHoldPct)}`}>{fmtPct(stats.buyHoldPct)}</b>
        </div>
        <div>
          <span>Win rate</span>
          <b className="mono">{(stats.winRate * 100).toFixed(0)}%</b>
        </div>
        <div>
          <span>Trades</span>
          <b className="mono">{stats.trades}</b>
        </div>
        <div>
          <span>Max DD</span>
          <b className="mono down">−{stats.maxDrawdownPct.toFixed(1)}%</b>
        </div>
        <div>
          <span>Hit rate</span>
          <b className="mono">{(stats.modelAccuracy * 100).toFixed(0)}%</b>
        </div>
      </div>
      <p className="disclaimer">Walk-forward backtest on loaded bars. Model output is experimental and is not financial advice.</p>
    </section>
  )
}
