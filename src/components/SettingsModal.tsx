import { useState } from 'react'
import type { ApiKeys } from '../data/providers'
import { setLang, useLang, useT } from '../lib/i18n'
import { APP_VERSION } from '../data/releases'
import { useAiRules } from '../lib/aiRules'
import { AiKeysSection } from './AiKeysSection'
import { checkPaperKey, looksLikeAlphaVantage, type AlpacaKeys } from '../broker/alpaca'

/** Alpaca key IDs start with PK (paper) or AK (live); they don't work as Alpha Vantage or Finnhub keys. */
const looksAlpaca = (v: string) => /^(PK|AK)[A-Z0-9]{14,}$/i.test(v)

/** The Alpaca paper key, here too so nobody has to leave the trading screen to connect real stock data. */
function AlpacaKeyField({ value, onSave }: { value: AlpacaKeys; onSave: (k: AlpacaKeys) => void }) {
  const vi = useLang() === 'vi'
  const [d, setD] = useState(value)
  const [msg, setMsg] = useState<string | null>(null)
  const saved = !!(value.keyId && value.secret)
  const save = () => {
    // Key and Secret pasted together in the first box also work
    const parts = d.keyId.split(/[\s:,;]+/).filter(Boolean)
    const k = parts.length === 2 ? { keyId: parts[0], secret: parts[1] } : { keyId: parts.join(''), secret: d.secret.trim() }
    const bad = checkPaperKey(k.keyId) ?? ([k.keyId, k.secret].some(looksLikeAlphaVantage) ? 'That looks like an Alpha Vantage key; put it in the box below.' : k.secret ? null : 'Enter the paper secret key too.')
    setMsg(bad ?? (vi ? 'Đã lưu. Dữ liệu cổ phiếu thật sẽ tải ngay.' : 'Saved. Real stock data loads now.'))
    if (!bad) onSave(k)
  }
  return (
    <div className="field">
      <span>
        {vi ? 'Key Alpaca paper (dữ liệu cổ phiếu thật)' : 'Alpaca paper key (real stock data)'}
        {saved && <b className="up"> · {vi ? 'đã kết nối' : 'connected'} {value.keyId.slice(0, 2)}…{value.keyId.slice(-4)}</b>}
      </span>
      <input className="mono" value={d.keyId} onChange={(e) => setD({ ...d, keyId: e.target.value })} placeholder="PK… (Key ID)" />
      <input className="mono" type="password" value={d.secret} onChange={(e) => setD({ ...d, secret: e.target.value.trim() })} placeholder="Secret" />
      <button onClick={save}>{vi ? 'Lưu key' : 'Save key'}</button>
      {msg && <small className={msg.startsWith('Saved') || msg.startsWith('Đã') ? 'up' : 'warn'}>{msg}</small>}
    </div>
  )
}

export function SettingsModal({ keys, onSave, onClose, onOpenAiRules, alpacaKeys, onAlpacaKeys }: { keys: ApiKeys; onSave: (k: ApiKeys) => void; onClose: () => void; onOpenAiRules: () => void; alpacaKeys: AlpacaKeys; onAlpacaKeys: (k: AlpacaKeys) => void }) {
  const t = useT()
  const lang = useLang()
  const rules = useAiRules()
  const [draft, setDraft] = useState(keys)
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('settings')}</h3>
        <div className="modal-body">
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
          (Paper account, then API Keys), and paste it here or on the <b>Portfolio</b> page.
        </p>
        <AlpacaKeyField value={alpacaKeys} onSave={onAlpacaKeys} />
        <p className="muted">The keys below are optional extras. Alpha Vantage's free plan allows only 25 requests a day. Keys stay in this browser's localStorage for this origin ({window.location.origin}). They are separate from keys on other sites or if you access from a different URL.</p>
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
        {rules.aiKeyBoxes && <AiKeysSection />}
        <h3>Jarvis AI Trading (Experimental)</h3>
        <p className="muted">Unified agent for trading decisions. Phase 1 focuses on honest scoreboard and signal testing. These features are disabled until Phase 2 research validates them:</p>
        <label className="field">
          <input
            type="checkbox"
            checked={false}
            readOnly
            disabled
            title="Validator: disabled in Phase 1"
          />
          <span>Walk-forward validator (disabled in Phase 1)</span>
        </label>
        <p className="muted tiny">Tests each signal on unseen data to catch overfitting. Ready when we have enough trades.</p>
        <label className="field">
          <input
            type="checkbox"
            checked={false}
            readOnly
            disabled
            title="Router: disabled in Phase 1"
          />
          <span>Unified router (disabled in Phase 1)</span>
        </label>
        <p className="muted tiny">Combines multiple signal types (price, volume, AI explanations) into one buy/sell/hold decision per chart.</p>
        <label className="field">
          <input
            type="checkbox"
            checked={false}
            readOnly
            disabled
            title="Learner: disabled in Phase 1"
          />
          <span>Auto-learner with walk-forward (disabled in Phase 1)</span>
        </label>
        <p className="muted tiny">Lets Jarvis improve its own signal weights as it watches your trades. Uses the validator first.</p>
        <p className="muted tiny">
          {t('appVersion')} v{APP_VERSION}
        </p>
        </div>
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
