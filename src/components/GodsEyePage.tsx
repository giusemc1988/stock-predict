import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { LangSwitch } from './HubPanels'
import { GE_TEXT, GODS_EYE_REPO, GODS_EYE_URL, LAYERS, type LayerResult } from '../lib/godsEye'

type Status = { at: number; layers: LayerResult[]; debugOpen: string[] }

/** God's Eye View inside the Hub: the live globe plus a server-side check of every data layer. */
export function GodsEyePage({ onBack }: { onBack: () => void }) {
  const lang = useLang()
  const t = (k: keyof typeof GE_TEXT) => GE_TEXT[k][lang]
  const [status, setStatus] = useState<Status | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // phones load the heavy globe only when asked
  const [globe, setGlobe] = useState(() => typeof window === 'undefined' || !window.matchMedia?.('(max-width: 700px)').matches)

  const check = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    try {
      const r = await fetch('/api/godseye/status')
      if (!r.ok) throw new Error(String(r.status))
      setStatus((await r.json()) as Status)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => void check(), [check])

  const byId = new Map(status?.layers.map((l) => [l.id, l]))
  return (
    <main className="net-page ge-page">
      <div className="hub-head">
        <div className="net-title">
          <button className="btn net-back" onClick={onBack}>{t('back')}</button>
          <span className="hub-hello">{t('title')}</span>
        </div>
        <div className="net-status">
          <a className="btn" href={GODS_EYE_URL} target="_blank" rel="noreferrer noopener">{t('open')}</a>
          <LangSwitch />
        </div>
      </div>
      <p className="muted small">{t('sub')}</p>

      <section className="bf-card">
        <header>
          <h3>{t('layers')}</h3>
          <button className="btn small" disabled={busy} onClick={() => void check()}>{busy ? t('checking') : t('recheck')}</button>
        </header>
        {failed && <p className="warn">{t('failed')}</p>}
        <ul className="ge-layers">
          {LAYERS.map((l) => {
            const r = byId.get(l.id)
            return (
              <li key={l.id} className={`ge-layer ${r?.state ?? 'wait'}`}>
                <span className="ge-dot" />
                <span>{l.label[lang]}</span>
                <span className="small">{r ? t(r.state) : t('checking')}</span>
                {r && r.state !== 'ok' && <span className="small muted">{r.detail}</span>}
              </li>
            )
          })}
        </ul>
        {!!status?.debugOpen.length && <p className="warn">{t('debug')}</p>}
        <p className="muted small">
          {t('note')} · <a href={GODS_EYE_REPO} target="_blank" rel="noreferrer noopener">{t('source')}</a>
        </p>
      </section>

      <section className="bf-card ge-frame">
        {globe ? (
          <iframe title={t('title')} src={GODS_EYE_URL} loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" allow="fullscreen; geolocation" referrerPolicy="no-referrer" />
        ) : (
          <button className="btn primary" onClick={() => setGlobe(true)}>{t('load')}</button>
        )}
      </section>
    </main>
  )
}
