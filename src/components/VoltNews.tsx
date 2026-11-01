/**
 * Volt "Mới cập nhật" card: new ESP32 firmware releases found daily on GitHub (free search API, built by
 * .github/workflows/volt-news.yml), plus the firmware Chanh flashed recently. Tapping Nạp only fills the
 * repo + tag on the Volt page; the same checks and the Flash button still decide whether anything is written.
 */
import { useEffect, useState } from 'react'
import type { Bi } from '../lib/hubText'
import { useLang } from '../lib/i18n'
import { ageDays, buildNews, chipFit, parseNews, sortNews, type GhGet, type NewsFeed, type RecentFlash } from '../lib/voltNews'

const T = {
  title: { en: 'What\'s new', vi: 'Mới cập nhật' },
  note: { en: 'New ESP32 firmware releases found on GitHub when you tap Refresh (free, nothing runs in the background). Attack tools are filtered out.', vi: 'Firmware ESP32 mới trên GitHub, chỉ tìm khi anh bấm Làm mới (miễn phí, không chạy nền). Đã lọc bỏ công cụ tấn công.' },
  recent: { en: 'Flashed recently', vi: 'Đã nạp gần đây' },
  empty: { en: 'Nothing yet. Tap Refresh to look on GitHub.', vi: 'Chưa có gì. Bấm Làm mới để tìm trên GitHub.' },
  refresh: { en: 'Refresh', vi: 'Làm mới' },
  refreshing: { en: 'Searching GitHub…', vi: 'Đang tìm trên GitHub…' },
  limited: { en: 'GitHub free limit reached — showing what was found; try again in a few minutes.', vi: 'Chạm giới hạn miễn phí của GitHub — đang hiện phần đã tìm được, thử lại sau vài phút.' },
  failed: { en: 'Could not reach GitHub.', vi: 'Không kết nối được GitHub.' },
  use: { en: 'Use', vi: 'Dùng' },
  fits: { en: 'fits your board', vi: 'hợp board của anh' },
  other: { en: 'other chip', vi: 'chip khác' },
  unknown: { en: 'chip not stated', vi: 'chưa rõ chip' },
  today: { en: 'today', vi: 'hôm nay' },
  daysAgo: { en: 'd ago', vi: ' ngày trước' },
  updated: { en: 'Updated', vi: 'Cập nhật' },
  manifest: { en: 'one-tap', vi: 'nạp một bước' },
  onlyFits: { en: 'Only my chip', vi: 'Chỉ hợp board của tôi' },
} satisfies Record<string, Bi>

export function VoltNews({ chipName, recent, onPick }: { chipName: string | null; recent: RecentFlash[]; onPick: (repo: string, tag: string) => void }) {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  const [feed, setFeed] = useState<NewsFeed | null>(null)
  const [onlyFits, setOnlyFits] = useState(false)

  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    try {
      setFeed(parseNews(JSON.parse(localStorage.getItem('neo.volt.news') ?? 'null')))
    } catch {
      setFeed({ updated: '', items: [] })
    }
  }, [])

  const refresh = async () => {
    setBusy(true)
    setNote(null)
    const get: GhGet = async (path) => {
      try {
        const r = await fetch(`https://api.github.com${path}`, { headers: { accept: 'application/vnd.github+json' } })
        return { status: r.status, data: r.ok ? await r.json() : null }
      } catch {
        return { status: 0, data: null }
      }
    }
    try {
      const { feed: next, limited } = await buildNews(get)
      if (next.items.length || !feed?.items.length) {
        setFeed(next)
        try {
          localStorage.setItem('neo.volt.news', JSON.stringify(next))
        } catch {
          // storage blocked: the list just won't persist
        }
      }
      setNote(limited ? L('limited') : null)
    } catch {
      setNote(L('failed'))
    } finally {
      setBusy(false)
    }
  }

  const items = sortNews(feed?.items ?? []).filter((i) => !onlyFits || chipFit(i, chipName) !== 'other')
  const age = (iso: string) => {
    const d = ageDays(iso)
    return d == null ? '' : d === 0 ? L('today') : `${d}${L('daysAgo')}`
  }

  return (
    <section className="bf-card volt-news">
      <header><h3>{L('title')}</h3></header>
      <p className="small muted">{L('note')}</p>

      {recent.length > 0 && (
        <>
          <b className="small">{L('recent')}</b>
          <div className="volt-recent">
            {recent.map((r) => (
              <button key={`${r.repo}@${r.tag}`} className="btn" onClick={() => onPick(r.repo, r.tag)}>{r.label} · {r.tag}</button>
            ))}
          </div>
        </>
      )}

      <div className="ag-acts">
        <button className="btn" disabled={busy} onClick={() => void refresh()}>{busy ? L('refreshing') : `↻ ${L('refresh')}`}</button>
      </div>
      {note && <p className="small muted" role="status">{note}</p>}

      {chipName && (
        <label className="small volt-only">
          <input type="checkbox" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} /> {L('onlyFits')} ({chipName})
        </label>
      )}

      {feed && !items.length && !busy && <p className="small muted">{L('empty')}</p>}
      <div className="volt-feed">
        {items.map((i) => {
          const fit = chipFit(i, chipName)
          return (
            <div key={`${i.repo}@${i.tag}`} className="volt-feed-item">
              <div className="volt-feed-head">
                <b>{i.repo}</b>
                <small className="mono">★ {i.stars}</small>
              </div>
              {i.desc && <p className="small muted">{i.desc}</p>}
              <div className="volt-tags">
                <span className="tag">{i.tag}{i.published ? ` · ${age(i.published)}` : ''}</span>
                {i.chips.map((c) => <span key={c} className="tag">{c}</span>)}
                <span className={`tag tag-${fit === 'fits' ? 'ok' : fit === 'other' ? 'warn' : 'info'}`}>{L(fit)}</span>
                {i.hasManifest && <span className="tag tag-ok">{L('manifest')}</span>}
              </div>
              <button className="btn" onClick={() => onPick(i.repo, i.tag)}>{L('use')}</button>
            </div>
          )
        })}
      </div>
      {feed?.updated && <p className="small muted">{L('updated')}: {feed.updated.slice(0, 10)}</p>}
    </section>
  )
}
