import { DATA_LABEL, labelForSource } from '../lib/dataGuard'
import type { Analysis, FeedStatus, Instrument, Quote, Timeframe } from '../types'
import { TIMEFRAMES } from '../types'
import { fmtCompact, fmtPct, fmtPrice, fmtSigned, fmtUsd, tone } from '../lib/format'
import { ArcLogo } from './ArcLogo'
import { APP_VERSION } from '../data/releases'
import { RobotIcon } from './RobotIcon'
import { useLang, useT } from '../lib/i18n'

interface Props {
  inst: Instrument
  quote?: Quote
  lastPrice: number
  tf: Timeframe
  onTf: (tf: Timeframe) => void
  status: FeedStatus
  source: string
  error: string | null
  toggles: { emas: boolean; forecast: boolean; robots: boolean }
  onToggle: (k: 'emas' | 'forecast' | 'robots') => void
  onSettings: () => void
  analysis: Analysis | null
  buyShare: number | null
  onAnalyst: () => void
  page: Page
  onPage: (p: Page) => void
  /** Show the Jarvis Brief tab (home page). */
  brief: boolean
  equity: number
  dayPL: number
}

export type Page = 'brief' | 'trade' | 'portfolio' | 'net' | 'ruview'

const STATUS_KEY = { connecting: 'feedConnecting', live: 'feedLive', polling: 'feedDelayed', demo: 'feedSimulated', error: 'feedError' } as const satisfies Record<FeedStatus, string>
const CONF_KEY = { Low: 'confLow', Medium: 'confMedium', High: 'confHigh' } as const

export function TopBar({ inst, quote, lastPrice, tf, onTf, status, source, error, toggles, onToggle, onSettings, analysis, buyShare, onAnalyst, page, onPage, equity, dayPL, brief }: Props) {
  const t = useT()
  const vi = useLang() === 'vi'
  const chg = quote?.change ?? 0
  return (
    <header className="topbar">
      <div className="brand">
        <ArcLogo size={28} />
        <div>
          <b>Arc Analyst</b>
          <span>
            {t('tagline')} · <i className="app-ver">v{APP_VERSION}</i>
          </span>
        </div>
      </div>
      <nav className="nav">
        {brief && (
          <button className={page === 'brief' ? 'on' : ''} onClick={() => onPage('brief')}>
            Jarvis Brief
          </button>
        )}
        <button className={page === 'trade' ? 'on' : ''} onClick={() => onPage('trade')}>
          {brief ? (vi ? 'Bàn giao dịch' : 'Trading desk') : t('trade')}
        </button>
        <button className={page === 'portfolio' ? 'on' : ''} onClick={() => onPage('portfolio')}>
          {t('portfolio')}
          <span className={`nav-pl mono ${tone(dayPL)}`}>{fmtUsd(equity)}</span>
        </button>
      </nav>
      <div className="ticker">
        <div className="ticker-sym">
          <b>{inst.symbol}</b>
          <span>{inst.name}</span>
        </div>
        <div className={`ticker-px mono ${tone(chg)}`}>{fmtPrice(lastPrice)}</div>
        <div className={`ticker-chg mono ${tone(chg)}`}>
          {fmtSigned(chg, lastPrice < 10 ? 4 : 2)} ({fmtPct(quote?.changePct ?? 0)})
        </div>
        <div className="ticker-stats mono">
          <span>
            H <b>{fmtPrice(quote?.high)}</b>
          </span>
          <span>
            L <b>{fmtPrice(quote?.low)}</b>
          </span>
          <span>
            Vol <b>{quote ? fmtCompact(quote.volume) : '—'}</b>
          </span>
        </div>
      </div>
      {analysis && (
        <button className={`ai-chip v-${analysis.verdict.toLowerCase()}`} onClick={onAnalyst} title={analysis.headline}>
          <RobotIcon size={18} side={analysis.verdict === 'BUY' ? 'buy' : analysis.verdict === 'SELL' ? 'sell' : undefined} />
          <span>{t('aiSays')}</span>
          <b>{analysis.verdict}</b>
          <em>{t(CONF_KEY[analysis.confidenceLabel])}</em>
        </button>
      )}
      {buyShare != null && (
        <div className="mini-pressure" title={t('buyersTitle')}>
          <span>
            <b className="up">{Math.round(buyShare * 100)}%</b> {t('buyers')}
          </span>
          <div>
            <i style={{ width: `${buyShare * 100}%` }} />
          </div>
        </div>
      )}
      <div className="seg tf">
        {TIMEFRAMES.map((t) => (
          <button key={t.id} className={tf === t.id ? 'on' : ''} onClick={() => onTf(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="seg toggles">
        <button className={toggles.robots ? 'on' : ''} onClick={() => onToggle('robots')} title={t('robotsTitle')}>
          🤖 {t('robots')}
        </button>
        <button className={toggles.forecast ? 'on' : ''} onClick={() => onToggle('forecast')} title={t('forecastTitle')}>
          {t('forecast')}
        </button>
        <button className={toggles.emas ? 'on' : ''} onClick={() => onToggle('emas')} title="EMA 9 / 21">
          {t('averages')}
        </button>
      </div>
      <div className={`feed feed-${status}`} title={error ?? source}>
        <i />
        <span>{t(STATUS_KEY[status])}</span>
        <em>{source}</em>
        {source && <em className={`data-label ${labelForSource(source)}`}>{DATA_LABEL[labelForSource(source)][vi ? 'vi' : 'en']}</em>}
      </div>
      <button className="icon-btn" onClick={onSettings} title={t('dataSourcesTitle')} aria-label={t('settings')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  )
}
