import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { NovaProgress } from './NovaProgress'
import { useLang } from '../lib/i18n'
import { STUDIO_TEXT, type StudioKey } from '../lib/studio/text'
import { HOOK_THEMES } from '../lib/studio/hookThemes'
import { TREND_LINKS, TREND_SOURCES, filterTrends, type TopicView, type TrendGeo, type TrendItem, type TrendSourceId, type TrendsResult } from '../lib/studioTrends'

interface Prefs {
  geo: TrendGeo
  topic: TopicView
  off: TrendSourceId[]
  hideSensitive: boolean
  blocked: string
  shown: number
}
// Viraltech is about new tech and philosophy, so those two come first
const DEFAULT_PREFS: Prefs = { geo: 'VN', topic: 'focus', off: [], hideSensitive: true, blocked: '', shown: 12 }
const NOTE: Record<string, StudioKey> = { empty: 'trendEmpty' }
const TOPICS: { id: TopicView; key: StudioKey }[] = [
  { id: 'focus', key: 'topicFocus' },
  { id: 'tech', key: 'topicTech' },
  { id: 'philo', key: 'topicPhilo' },
  { id: 'all', key: 'topicAll' },
]

/** Nova step 1: trending topics from free sources; tap one to use it, or let Nova pick and write. */
export function NovaTrends({ onPick, onAuto, busy, themes = false, onTopic, onAutoTopic }: { onPick: (t: TrendItem) => void; onAuto: (t: TrendItem) => void; busy: boolean; themes?: boolean; onTopic?: (en: string, vi: string) => void; onAutoTopic?: (en: string, vi: string) => void }) {
  const lang = useLang()
  const t = (k: StudioKey) => STUDIO_TEXT[k][lang]
  const [prefs, setPrefs] = useLocalStorage<Prefs>('nova.trends.v1', DEFAULT_PREFS)
  const p = { ...DEFAULT_PREFS, ...prefs }
  const set = (patch: Partial<Prefs>) => setPrefs({ ...p, ...patch })
  const [data, setData] = useState<TrendsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [theme, setTheme] = useState(HOOK_THEMES[0].id)
  const [ai, setAi] = useState<Record<string, { en: string; vi: string }[]>>({})
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const moreIdeas = async (id: string, avoid: string[]) => {
    setAiBusy(true)
    setAiErr('')
    try {
      const r = await fetch('/api/studio/hook-ideas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: id, avoid }), signal: AbortSignal.timeout(30_000) })
      const j = (await r.json().catch(() => ({}))) as { ideas?: { en: string; vi: string }[]; error?: string }
      if (!r.ok || !j.ideas?.length) throw new Error(j.error ?? `HTTP ${r.status}`)
      setAi((a) => ({ ...a, [id]: j.ideas! }))
    } catch (e) {
      setAiErr((e as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  const load = useCallback(async (geo: TrendGeo, fresh = false) => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/studio/trends?geo=${geo}${fresh ? '&fresh=1' : ''}`)
      const j = (await r.json().catch(() => null)) as (TrendsResult & { error?: string }) | null
      if (!r.ok || !j?.items) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setData(j)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load(p.geo)
  }, [load, p.geo])

  // a tech source has nothing for the philosophy view and the other way round, so its chip is hidden
  const sources = TREND_SOURCES.filter((s) => !s.topic || p.topic === 'all' || p.topic === 'focus' || s.topic === p.topic)
  const inTopic = useMemo(() => filterTrends(data?.items ?? [], { topic: p.topic, hideSensitive: p.hideSensitive, blocked: p.blocked.split(',') }), [data, p.topic, p.hideSensitive, p.blocked])
  const list = useMemo(() => inTopic.filter((it) => !p.off.includes(it.source)), [inTopic, p.off])
  const shown = list.slice(0, p.shown)
  const status = (id: TrendSourceId) => data?.sources.find((s) => s.id === id)
  const toggle = (id: TrendSourceId) => set({ off: p.off.includes(id) ? p.off.filter((x) => x !== id) : [...p.off, id] })
  const age = data ? Math.round((Date.now() - data.at) / 60000) : null
  const count = (id: TrendSourceId) => inTopic.filter((it) => it.source === id).length

  const cur = HOOK_THEMES.find((x) => x.id === theme) ?? HOOK_THEMES[0]
  const themeBlock = themes && onTopic && (
    <div className="nv-themes">
      <strong className="small">{t('themeTitle')}</strong>
      <div className="seg small nv-topic" role="group" aria-label={t('themeTitle')}>
        {HOOK_THEMES.map((x) => (
          <button key={x.id} className={theme === x.id ? 'on' : ''} aria-pressed={theme === x.id} onClick={() => setTheme(x.id)}>{x.name[lang]}</button>
        ))}
      </div>
      <div className="nv-trend-list">
        {(ai[cur.id] ?? cur.seeds).map((sd) => (
          <button key={sd.en} className="nv-trend" disabled={busy} onClick={() => onTopic(sd.en, sd.vi)}>
            <span className="nv-trend-t">{lang === 'vi' ? sd.vi : sd.en}</span>
          </button>
        ))}
      </div>
      <div className="vs-row">
        <button className="btn small" disabled={busy || aiBusy} onClick={() => void moreIdeas(cur.id, (ai[cur.id] ?? cur.seeds).map((x) => x.en))}>✦ {t('themeAi')}</button>
      </div>
      <NovaProgress active={aiBusy} label={t('themeAiLoading')} secs={10} />
      {aiErr && <p className="small warn">{aiErr}</p>}
      {onAutoTopic && (
        <div className="vs-row">
          <button className="btn primary" disabled={busy} onClick={() => { const pool = ai[cur.id] ?? cur.seeds; const sd = pool[Math.floor(Math.random() * pool.length)]; onAutoTopic(sd.en, sd.vi) }}>✦ {t('themeWrite')}</button>
        </div>
      )}
    </div>
  )

  const feed = (
    <div className="nv-trends">
      <div className="nv-trends-head">
        <strong className="small">{t('trendTitle')}</strong>
        <div className="seg small nv-geo" role="group" aria-label={t('trendRegion')}>
          {(['VN', 'US'] as TrendGeo[]).map((g) => (
            <button key={g} className={p.geo === g ? 'on' : ''} onClick={() => set({ geo: g })}>{g}</button>
          ))}
        </div>
      </div>

      <div className="seg small nv-topic" role="group" aria-label={t('trendTopic')}>
        {TOPICS.map((tp) => (
          <button key={tp.id} className={p.topic === tp.id ? 'on' : ''} aria-pressed={p.topic === tp.id} onClick={() => set({ topic: tp.id, shown: DEFAULT_PREFS.shown })}>{t(tp.key)}</button>
        ))}
      </div>

      <div className="nv-chips" role="group" aria-label={t('trendSources')}>
        {sources.map((s) => {
          const st = status(s.id)
          const off = p.off.includes(s.id)
          return (
            <button key={s.id} className={`nv-src${off ? '' : ' on'}${st && !st.ok ? ' bad' : ''}`} aria-pressed={!off} onClick={() => toggle(s.id)} title={st?.note}>
              {s.name}
              <span className="nv-src-n">{st ? (st.ok ? count(s.id) : t(NOTE[st.note ?? ''] ?? 'trendDown')) : '…'}</span>
            </button>
          )
        })}
      </div>

      <NovaProgress active={loading} label={t('trendLoading')} secs={12} />
      {err && <p className="small warn">{t('trendFailed')} {err}</p>}
      {data && !list.length && <p className="small muted">{t('trendNone')}</p>}

      <div className="nv-trend-list">
        {shown.map((it) => (
          <button key={`${it.source}:${it.title}`} className="nv-trend" disabled={busy} onClick={() => onPick(it)}>
            <span className="nv-trend-t">{it.title}</span>
            {it.context && <span className="nv-trend-c">{it.context}</span>}
            <span className="nv-trend-m">
              <i className={`nv-dot s-${it.source}`} aria-hidden="true" />
              {TREND_SOURCES.find((s) => s.id === it.source)?.name}
              {it.traffic && ` · ${it.traffic}`}
            </span>
          </button>
        ))}
      </div>

      <div className="vs-row">
        <button className="btn primary" disabled={busy || !list.length} onClick={() => list[0] && onAuto(list[0])}>✦ {t('trendAuto')}</button>
        {list.length > p.shown && <button className="btn small" onClick={() => set({ shown: p.shown + 12 })}>{t('trendMore')} ({list.length - p.shown})</button>}
        <button className="btn small" disabled={loading} onClick={() => void load(p.geo, true)}>↻ {t('trendRefresh')}</button>
        {age != null && <span className="small muted">{age < 1 ? t('trendJustNow') : `${age} ${t('trendMinAgo')}`}</span>}
      </div>

      <details className="vs-pexels" open={more} onToggle={(e) => setMore((e.target as HTMLDetailsElement).open)}>
        <summary className="small">{t('trendFilters')}</summary>
        <label className="vs-check"><input type="checkbox" checked={p.hideSensitive} onChange={(e) => set({ hideSensitive: e.target.checked })} /> {t('trendHideSensitive')}</label>
        <label className="vs-field">
          <span className="small muted">{t('trendBlocked')}</span>
          <input value={p.blocked} onChange={(e) => set({ blocked: e.target.value })} placeholder={lang === 'vi' ? 'bóng đá, xổ số, ...' : 'football, lottery, ...'} />
        </label>
        <label className="vs-field">
          <span className="small muted">{t('trendCount')}: {p.shown}</span>
          <input type="range" min={6} max={60} step={6} value={p.shown} onChange={(e) => set({ shown: Number(e.target.value) })} />
        </label>
        <p className="small muted">{t('trendLinksNote')}</p>
        <div className="vs-row">
          {TREND_LINKS.map((l) => <a key={l.name} className="btn small" href={l.url(p.geo)} target="_blank" rel="noreferrer">{l.name} ↗</a>)}
        </div>
      </details>
    </div>
  )
  if (!themeBlock) return feed
  return (
    <>
      {themeBlock}
      <details className="vs-pexels nv-later">
        <summary className="small">{t('laterTitle')}</summary>
        {feed}
      </details>
    </>
  )
}
