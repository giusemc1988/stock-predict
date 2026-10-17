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
  const [saving, setSaving] = useState(false)
  const saved = !!(value.keyId && value.secret)
  const save = async () => {
    // Key and Secret pasted together in the first box also work
    const parts = d.keyId.split(/[\s:,;]+/).filter(Boolean)
    const k = parts.length === 2 ? { keyId: parts[0], secret: parts[1] } : { keyId: parts.join(''), secret: d.secret.trim() }
    const bad = checkPaperKey(k.keyId) ?? ([k.keyId, k.secret].some(looksLikeAlphaVantage) ? 'That looks like an Alpha Vantage key; put it in the box below.' : k.secret ? null : 'Enter the paper secret key too.')
    setMsg(bad ?? (vi ? 'Đã lưu. Dữ liệu cổ phiếu thật sẽ tải ngay.' : 'Saved. Real stock data loads now.'))
    if (!bad) {
      setSaving(true)
      try {
        // Save to Cloudflare KV
        await fetch('/api/data/key', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'alpaca_paper', keyId: k.keyId, secret: k.secret }),
        })
        onSave(k)
      } finally {
        setSaving(false)
      }
    }
  }
  return (
    <div className="field">
      <span>
        {vi ? 'Key Alpaca paper (dữ liệu cổ phiếu thật)' : 'Alpaca paper key (real stock data)'}
        {saved && <b className="up"> · {vi ? 'đã kết nối' : 'connected'} {value.keyId.slice(0, 2)}…{value.keyId.slice(-4)}</b>}
      </span>
      <input className="mono" value={d.keyId} onChange={(e) => setD({ ...d, keyId: e.target.value })} placeholder="PK… (Key ID)" />
      <input className="mono" type="password" value={d.secret} onChange={(e) => setD({ ...d, secret: e.target.value.trim() })} placeholder="Secret" />
      <button onClick={save} disabled={saving}>{saving ? (vi ? 'Đang lưu...' : 'Saving...') : (vi ? 'Lưu key' : 'Save key')}</button>
      {msg && <small className={msg.startsWith('Saved') || msg.startsWith('Đã') ? 'up' : 'warn'}>{msg}</small>}
    </div>
  )
}

export function SettingsModal({ keys, onSave, onClose, onOpenAiRules, alpacaKeys, onAlpacaKeys }: { keys: ApiKeys; onSave: (k: ApiKeys) => void; onClose: () => void; onOpenAiRules: () => void; alpacaKeys: AlpacaKeys; onAlpacaKeys: (k: AlpacaKeys) => void }) {
  const t = useT()
  const lang = useLang()
  const rules = useAiRules()
  const [draft, setDraft] = useState(keys)
  const [checkingKeys, setCheckingKeys] = useState(false)
  const [keyResults, setKeyResults] = useState<Array<{ id: string; name: string; ok: boolean; status?: string; error?: string }> | null>(null)
  const [savingKeys, setSavingKeys] = useState(false)

  const saveDataKeys = async () => {
    try {
      // Save Alpha Vantage key if provided
      if (draft.alphaVantage) {
        const avResp = await fetch('/api/data/key', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'alpha_vantage', key: draft.alphaVantage }),
        })
        if (!avResp.ok) {
          const err = await avResp.json().catch(() => ({}))
          throw new Error(`Alpha Vantage: ${err.error || avResp.statusText}`)
        }
      }
      // Save Finnhub key if provided
      if (draft.finnhub) {
        const fhResp = await fetch('/api/data/key', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'finnhub', key: draft.finnhub }),
        })
        if (!fhResp.ok) {
          const err = await fhResp.json().catch(() => ({}))
          throw new Error(`Finnhub: ${err.error || fhResp.statusText}`)
        }
      }
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      alert(`Error saving: ${msg}`)
      throw e
    }
  }

  const checkAllKeys = async () => {
    setCheckingKeys(true)
    try {
      const resp = await fetch('/api/keys/status', { method: 'POST' })
      if (resp.ok) {
        const { keys: results } = (await resp.json()) as { keys: Array<{ id: string; name: string; ok: boolean; status?: string; error?: string }> }
        setKeyResults(results)
      } else {
        setKeyResults([{ id: 'error', name: 'Error', ok: false, error: 'Failed to check keys' }])
      }
    } catch (e) {
      setKeyResults([{ id: 'error', name: 'Error', ok: false, error: String(e) }])
    } finally {
      setCheckingKeys(false)
    }
  }
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
        <div className="field">
          <button onClick={checkAllKeys} disabled={checkingKeys}>{checkingKeys ? 'Checking...' : 'Check all keys'}</button>
          {keyResults && (
            <table className="key-check-results">
              <tbody>
                {keyResults.map((k) => (
                  <tr key={k.id} className={`key-result ${k.ok ? 'ok' : 'fail'}`}>
                    <td className="key-name">{k.name}</td>
                    <td className={`key-status ${k.ok ? 'up' : 'warn'}`}>{k.ok ? '✓ OK' : `✗ ${k.error || 'No key'}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="muted">The keys below are optional extras. Alpha Vantage's free plan allows only 25 requests a day. Keys are saved to Cloudflare so they sync across devices.</p>
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
            disabled={savingKeys}
            onClick={async () => {
              setSavingKeys(true)
              try {
                await saveDataKeys()
                // Wait for KV sync, then reload keys from server to ensure they persisted
                await new Promise(resolve => setTimeout(resolve, 500))
                const resp = await fetch('/api/data/keys', { method: 'POST' })
                if (resp.ok) {
                  const loaded = (await resp.json()) as ApiKeys
                  onSave(loaded)
                } else {
                  onSave(draft)
                }
                onClose()
              } finally {
                setSavingKeys(false)
              }
            }}
          >
            {savingKeys ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
