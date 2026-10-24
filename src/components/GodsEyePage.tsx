import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { LangSwitch } from './HubPanels'
import { GE_TEXT, GODS_EYE_HEALTH, GODS_EYE_REPO, GODS_EYE_URL, LAYERS, type LayerResult } from '../lib/godsEye'

/**
 * God's Eye View inside the Hub: one row of layer chips, then the globe filling the rest of the
 * screen. The page itself never needs scrolling, because a touch on the globe belongs to the globe.
 */
export function GodsEyePage({ onBack }: { onBack: () => void }) {
  const lang = useLang()
  const t = (k: keyof typeof GE_TEXT) => GE_TEXT[k][lang]
  const [layers, setLayers] = useState<LayerResult[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // phones load the heavy globe only when asked
  const [globe, setGlobe] = useState(() => typeof window === 'undefined' || !window.matchMedia?.('(max-width: 700px)').matches)

  const check = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    try {
      const r = await fetch(GODS_EYE_HEALTH)
      if (!r.ok) throw new Error(String(r.status))
      setLayers(((await r.json()) as { layers: LayerResult[] }).layers)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => void check(), [check])

  // the globe takes exactly the screen height left under the chips (the top bar wraps differently per width)
  const frame = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const fit = () => {
      const el = frame.current
      if (el) el.style.height = `${Math.max(360, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 12)}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const byId = new Map(layers?.map((l) => [l.id, l]))
  return (
    <main className="net-page ge-page">
      <div className="ge-head">
        <button className="btn net-back" onClick={onBack}>{t('back')}</button>
        <span className="hub-hello">{t('title')}</span>
        <span className="ge-spacer" />
        <a className="btn small" href={GODS_EYE_URL} target="_blank" rel="noreferrer noopener">{t('open')}</a>
        <LangSwitch />
      </div>

      <div className="ge-chips" aria-label={t('layers')}>
        {LAYERS.map((l) => {
          const r = byId.get(l.id)
          const state = r?.state ?? (failed ? 'down' : 'wait')
          const tip = r ? `${t(r.state)}${r.state === 'ok' ? '' : ` · ${r.detail}`}` : failed ? t('failed') : t('checking')
          return (
            <span key={l.id} className={`ge-chip ${state}`} title={tip}>
              <span className="ge-dot" />
              {l.label[lang]}
            </span>
          )
        })}
        <button className="ge-chip ge-recheck" disabled={busy} onClick={() => void check()} title={t('recheck')} aria-label={t('recheck')}>
          {busy ? '…' : '↻'}
        </button>
      </div>

      <section className="ge-frame" ref={frame}>
        {globe ? (
          <iframe title={t('title')} src={GODS_EYE_URL} loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" allow="fullscreen; geolocation" referrerPolicy="no-referrer" />
        ) : (
          <button className="btn primary" onClick={() => setGlobe(true)}>{t('load')}</button>
        )}
      </section>

      <p className="muted small ge-note">
        {t('note')} · <a href={GODS_EYE_REPO} target="_blank" rel="noreferrer noopener">{t('source')}</a>
      </p>
    </main>
  )
}
