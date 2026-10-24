import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { ANTWORK_URL, postCounts, VIRALTECH, type Platform, type PostStatus } from '../data/viraltech'
import type { StudioJob } from '../lib/studioJobs'
import { LangSwitch } from './HubPanels'
import { StatRow, type Stat } from './StatCard'

const PLATFORM: Record<Platform, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook' }
const T = {
  back: { en: '← Hub', vi: '← Hub' },
  title: { en: 'Viraltech', vi: 'Viraltech' },
  asOf: { en: 'Data from Antwork, updated', vi: 'Dữ liệu từ Antwork, cập nhật' },
  channels: { en: 'Channels', vi: 'Kênh' },
  connected: { en: 'Connected', vi: 'Đã kết nối' },
  notConnected: { en: 'Not in Antwork yet ($5/month)', vi: 'Chưa có trong Antwork ($5/tháng)' },
  open: { en: 'Open', vi: 'Mở' },
  posts: { en: 'Posts', vi: 'Bài đăng' },
  none: { en: 'No posts yet. Ask Claude in the Viraltech thread to draft one; it shows here after the next refresh.', vi: 'Chưa có bài. Nhắn Claude trong thread Viraltech để soạn bài; bài sẽ hiện ở đây sau lần cập nhật tới.' },
  antwork: { en: 'Open Antwork', vi: 'Mở Antwork' },
  followers: { en: 'followers', vi: 'người theo dõi' },
  draft: { en: 'Drafts', vi: 'Nháp' },
  scheduled: { en: 'Scheduled', vi: 'Đã lên lịch' },
  published: { en: 'Published', vi: 'Đã đăng' },
  failed: { en: 'Failed', vi: 'Lỗi' },
  views: { en: 'views', vi: 'lượt xem' },
  eng: { en: 'interactions', vi: 'tương tác' },
  fromNova: { en: 'Videos from Nova, waiting for your OK', vi: 'Video từ Nova, chờ anh duyệt' },
  fromNovaNone: { en: 'Nothing waiting. In Nova, tap "Send to Viraltech" on a finished video.', vi: 'Chưa có video nào chờ. Trong Nova, bấm "Gửi sang Viraltech" ở video đã xong.' },
  fromNovaHow: { en: 'Nothing here is posted by itself. To post one, tell Claude in the Viraltech thread which video and which channel; Claude drafts the post in Antwork and posts only after you say yes.', vi: 'Không video nào tự đăng. Muốn đăng, anh nhắn Claude trong thread Viraltech: video nào, kênh nào; Claude soạn bài trong Antwork và chỉ đăng khi anh đồng ý.' },
  lemo: { en: 'Lemo-Opuscar', vi: 'Lemo-Opuscar' },
  server: { en: 'server', vi: 'máy chủ' },
  download: { en: 'Download', vi: 'Tải về' },
  takeBack: { en: 'Take back', vi: 'Lấy lại' },
} as const

type NovaVideo = Omit<StudioJob, 'lines' | 'terms'>

/** Finished Nova videos sent here (handoff), newest first. Posting stays a separate, approved step. */
function NovaWaiting() {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  const [videos, setVideos] = useState<NovaVideo[] | null>(null)
  const load = useCallback(async () => {
    const r = await fetch('/api/studio/jobs').catch(() => null)
    const j = (await r?.json().catch(() => null)) as { jobs?: NovaVideo[] } | null
    setVideos((j?.jobs ?? []).filter((v) => v.status === 'done' && v.handoff).sort((a, b) => (b.handoff ?? 0) - (a.handoff ?? 0)))
  }, [])
  useEffect(() => void load(), [load])
  const takeBack = async (id: string) => {
    await fetch(`/api/studio/handoff?id=${id}`, { method: 'DELETE' }).catch(() => null)
    await load()
  }
  return (
    <section className="bf-card">
      <header><h3>{L('fromNova')}</h3>{videos && videos.length > 0 && <span className="small muted">{videos.length}</span>}</header>
      <p className="muted small">{L('fromNovaHow')}</p>
      {videos && !videos.length && <p className="muted small">{L('fromNovaNone')}</p>}
      <ul className="vt-list">
        {videos?.map((v) => (
          <li key={v.id} className="vt-row">
            <div>
              <b>{v.lang.toUpperCase()}</b> <span className="muted small">{v.engine === 'lemo' ? L('lemo') : L('server')}{v.style && ` · ${v.style}`} · {v.aspect}</span>
              <div className="vt-text">{v.topic}</div>
              <div className="vs-out"><video src={`/api/studio/video?id=${v.id}`} controls playsInline preload="metadata" /></div>
            </div>
            <div className="vs-row">
              <a className="btn small" href={`/api/studio/video?id=${v.id}&download`}>{L('download')}</a>
              <button className="btn small" onClick={() => void takeBack(v.id)}>{L('takeBack')}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Viraltech: the 4 social channels, their posts and engagement, from the Antwork snapshot. */
export function ViralTechPage({ onBack, nova = true }: { onBack: () => void; nova?: boolean }) {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  const { channels, posts, asOf } = VIRALTECH
  const n = postCounts(posts)
  const linked = channels.filter((c) => c.connected).length
  const stats: Stat[] = [
    { key: 'ch', label: L('channels'), icon: 'film', accent: '#d9a3ff', value: `${linked}/${channels.length}`, sub: L('connected') },
    ...(['scheduled', 'published', 'draft'] as PostStatus[]).map((s): Stat => ({ key: s, label: L(s), icon: s === 'scheduled' ? 'clock' : s === 'published' ? 'check' : 'list', accent: '#d9a3ff', value: String(n[s]) })),
  ]
  const when = new Date(asOf).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <main className="net-page vt-page">
      <div className="hub-head">
        <div className="net-title">
          <button className="btn net-back" onClick={onBack}>{L('back')}</button>
          <span className="hub-hello">{L('title')}</span>
        </div>
        <div className="net-status">
          <a className="btn" href={ANTWORK_URL} target="_blank" rel="noopener noreferrer">{L('antwork')}</a>
          <LangSwitch />
        </div>
      </div>
      <p className="muted small">{L('asOf')} {when}</p>

      <StatRow items={stats} />

      {nova && <NovaWaiting />}

      <section className="bf-card">
        <header><h3>{L('channels')}</h3></header>
        <ul className="vt-list">
          {channels.map((c) => (
            <li key={c.platform} className="vt-row">
              <div>
                <b>{PLATFORM[c.platform]}</b> <span className="muted small">{c.handle}</span>
                <div className={`small ${c.connected ? 'up' : 'muted'}`}>
                  {c.connected ? L('connected') : L('notConnected')}
                  {c.followers != null && ` · ${c.followers.toLocaleString()} ${L('followers')}`}
                </div>
              </div>
              <a className="btn" href={c.url} target="_blank" rel="noopener noreferrer">{L('open')}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="bf-card">
        <header><h3>{L('posts')}</h3></header>
        {posts.length === 0 ? (
          <p className="muted small">{L('none')}</p>
        ) : (
          <ul className="vt-list">
            {posts.map((p) => (
              <li key={p.id} className="vt-row">
                <div>
                  <b>{PLATFORM[p.platform]}</b> <span className="muted small">{L(p.status)}{p.at && ` · ${new Date(p.at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}`}</span>
                  <div className="vt-text">{p.text}</div>
                  {(p.views != null || p.engagement != null) && (
                    <div className="small muted">
                      {p.views != null && `${p.views.toLocaleString()} ${L('views')}`}
                      {p.views != null && p.engagement != null && ' · '}
                      {p.engagement != null && `${p.engagement.toLocaleString()} ${L('eng')}`}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
