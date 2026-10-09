import { useState } from 'react'
import type { ApiKeys } from '../data/providers'
import { setLang, useLang, useT } from '../lib/i18n'

/** Alpaca key IDs start with PK (paper) or AK (live); they don't work as Alpha Vantage or Finnhub keys. */
const looksAlpaca = (v: string) => /^(PK|AK)[A-Z0-9]{14,}$/i.test(v)

export function SettingsModal({ keys, onSave, onClose, onOpenAiRules }: { keys: ApiKeys; onSave: (k: ApiKeys) => void; onClose: () => void; onOpenAiRules: () => void }) {
  const t = useT()
  const lang = useLang()
  const [draft, setDraft] = useState(keys)
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('settings')}</h3>
        <div className="field">
          <span>{t('language')}</span>
          <div className="seg">
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
              English
            </button>
            <button className={lang === 'vi' ? 'on' : ''} onClick={() => setLang('vi')}>
              Tiếng Việt
            </button>
          </div>
        </div>
        <div className="field">
          <span>{t('aiRules')}</span>
          <button onClick={onOpenAiRules}>{t('editAiRules')} →</button>
        </div>
        <h3>Data sources</h3>
        <p className="muted">Crypto streams live from Binance, no key needed. US stocks need a key, otherwise they run on the simulated feed (marked SIM).</p>
        <p className="muted">
          <b>Recommended:</b> a free <b>Alpaca paper</b> key. It gives real stock prices for the charts and watchlist, plus a practice trading account. Get it at{' '}
          <a href="https://app.alpaca.markets/signup" target="_blank" rel="noreferrer">
            app.alpaca.markets
          </a>{' '}
          (Paper account, then API Keys), and paste it on the <b>Portfolio</b> page under Alpaca paper, not here.
        </p>
        <p className="muted">The keys below are optional extras. Alpha Vantage's free plan allows only 25 requests a day. Keys stay in this browser.</p>
        <label className="field">
          <span>
            Alpha Vantage key (optional){' '}
            <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer">
              get one
            </a>
          </span>
          <input value={draft.alphaVantage} onChange={(e) => setDraft({ ...draft, alphaVantage: e.target.value.trim() })} placeholder="Stock candles (1m–1D)" />
          {looksAlpaca(draft.alphaVantage) && <small className="warn">This looks like an Alpaca key. Put it on the Portfolio page instead.</small>}
        </label>
        <label className="field">
          <span>
            Finnhub key (optional){' '}
            <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">
              get one
            </a>
          </span>
          <input value={draft.finnhub} onChange={(e) => setDraft({ ...draft, finnhub: e.target.value.trim() })} placeholder="Real-time stock trades + quotes" />
          {looksAlpaca(draft.finnhub) && <small className="warn">This looks like an Alpaca key. Put it on the Portfolio page instead.</small>}
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
