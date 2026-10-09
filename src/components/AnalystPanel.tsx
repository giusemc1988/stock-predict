import type { Analysis, BacktestStats, Signal } from '../types'
import { planText } from '../lib/analyst'
import { realityChecks } from '../lib/metrics'
import { fmtPct, fmtPrice, fmtTime, tone } from '../lib/format'
import { RobotIcon } from './RobotIcon'
import { InfoTip } from './InfoTip'
import { useLang, useT } from '../lib/i18n'

interface Props {
  analysis: Analysis | null
  stats: BacktestStats
  lastSignal: Signal | null
  symbol: string
  tfLabel: string
  onTrade: () => void
  onEditRules: () => void
}

const ICON = { bull: '▲', bear: '▼', neutral: '•' }

export function AnalystPanel({ analysis: a, stats, lastSignal, symbol, tfLabel, onTrade, onEditRules }: Props) {
  const t = useT()
  const lang = useLang()
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
            Arc view on {symbol} · {tfLabel} chart
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

      {a.tradeScore && (
        <details className={`tscore g-${a.tradeScore.grade === 'A+' ? 'a' : a.tradeScore.grade.toLowerCase()}`}>
          <summary>
            <span className="tscore-num mono">{a.tradeScore.score}</span>
            <span className="tscore-main">
              <b>
                Trade Score · {a.tradeScore.grade} · {a.tradeScore.signal}
              </b>
              <em>Five-part 0-100 score: technical, fundamental, sentiment, risk and thesis. Tap for the breakdown.</em>
            </span>
          </summary>
          <ul className="tparts">
            {a.tradeScore.parts.map((p) => (
              <li key={p.key}>
                <div className="tpart-head">
                  <b>{p.label}</b>
                  <span className="mono">{p.score == null ? 'n/a' : `${p.score}/100`}</span>
                  <i className="tbar">
                    <i style={{ width: `${p.score ?? 0}%` }} />
                  </i>
                </div>
                {p.subs.map((sub) => (
                  <span key={sub.label} className="tsub">
                    <b className="mono">
                      {sub.points}/{sub.max}
                    </b>{' '}
                    {sub.label}: {sub.note}
                  </span>
                ))}
                {p.missing && <span className="tsub muted">{p.missing}</span>}
              </li>
            ))}
          </ul>
          <p className="muted tiny">Weights 25/25/20/15/15; parts without data are left out and the rest scaled up. Rubric adapted from AI Trading Analyst for Claude Code (MIT).</p>
        </details>
      )}

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
        {a.exitPlan && (
          <div className="xplan">
            <div className="section-title">{t('stopAndScale')}</div>
            <div className="xstep stop">
              <b>
                {t('stopLoss')} <span className="mono down">{fmtPrice(a.exitPlan.stop)}</span>
              </b>
              <span>{a.exitPlan.stopWhy[lang]}</span>
            </div>
            {a.exitPlan.steps.map((s, i) => (
              <div key={i} className={`xstep ${s.kind}`}>
                <b>
                  {s.kind === 'in' ? '＋' : '−'} {s.label[lang]}
                  {s.price != null && <span className="mono"> {fmtPrice(s.price)}</span>}
                  <em className="mono"> {s.sharePct}%</em>
                </b>
                <span>{s.why[lang]}</span>
              </div>
            ))}
            <p className="muted tiny">{t('scaleNote')}</p>
          </div>
        )}
        {a.sizing && (
          <ul className="sizing">
            <li>
              <b className="mono">Size at most {(a.sizing.pctOfAccount * 100).toFixed(1)}% of the account</b>
              {a.sizing.binding === 'no-edge' ? ' (no position)' : ''}
            </li>
            {a.sizing.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {a.plan && (
          <button className="ai-plan" onClick={onTrade}>
            Open order ticket →
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
          <div>
            <span>
              Profit factor <InfoTip text="Money won on winning trades divided by money lost on losing ones. Above 1 means winners outweigh losers." />
            </span>
            <b className="mono">{stats.profitFactor == null ? 'no losses' : stats.profitFactor.toFixed(2)}</b>
          </div>
          <div>
            <span>
              Avg per trade <InfoTip text="Expectancy: what one trade made on average, counting both wins and losses." />
            </span>
            <b className={`mono ${tone(stats.expectancyPct)}`}>{fmtPct(stats.expectancyPct)}</b>
          </div>
          <div>
            <span>Losses in a row</span>
            <b className="mono">{stats.maxLosingStreak}</b>
          </div>
        </div>
        {realityChecks(stats).length > 0 && (
          <ul className="reality">
            {realityChecks(stats).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </details>

      <button className="link-btn" onClick={onEditRules}>
        {t('editAiRules')} →
      </button>

      <p className="disclaimer">Research, not advice. Arc Analyst is an automated read of price and volume patterns, which often fail. Only trade money you can afford to lose.</p>
    </div>
  )
}
