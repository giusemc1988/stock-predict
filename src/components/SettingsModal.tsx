import { useState } from 'react'
import type { ApiKeys } from '../data/providers'

export function SettingsModal({ keys, onSave, onClose }: { keys: ApiKeys; onSave: (k: ApiKeys) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(keys)
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Data sources</h3>
        <p className="muted">
          Crypto streams live from Binance public market data, no key needed. US stocks need a free key, otherwise they run on the simulated feed (marked SIM). Keys stay in this browser's localStorage.
        </p>
        <label className="field">
          <span>
            Alpha Vantage key{' '}
            <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer">
              get one
            </a>
          </span>
          <input value={draft.alphaVantage} onChange={(e) => setDraft({ ...draft, alphaVantage: e.target.value.trim() })} placeholder="Stock candles (1m–1D)" />
        </label>
        <label className="field">
          <span>
            Finnhub key{' '}
            <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">
              get one
            </a>
          </span>
          <input value={draft.finnhub} onChange={(e) => setDraft({ ...draft, finnhub: e.target.value.trim() })} placeholder="Real-time stock trades + quotes" />
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
