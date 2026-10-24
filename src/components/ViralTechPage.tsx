import { useLang } from '../lib/i18n'
import { ANTWORK_URL, postCounts, VIRALTECH, type Platform, type PostStatus } from '../data/viraltech'
import { AgentShell } from './AgentShell'
import { StatRow, type Stat } from './StatCard'

const PLATFORM: Record<Platform, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook' }
const T = {
  back: { en: '← Hub', vi: '← Hub' },
  title: { en: 'Viraltech · Social channels', vi: 'Viraltech · Kênh mạng xã hội' },
  sub: { en: 'New tech and philosophy, on Instagram, TikTok, YouTube and Facebook. Posts are drafted with you and sent through Antwork.', vi: 'Công nghệ mới và triết học, trên Instagram, TikTok, YouTube và Facebook. Bài được soạn cùng anh rồi đăng qua Antwork.' },
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
} as const

/** Viraltech: the 4 social channels, their posts and engagement, from the Antwork snapshot. */
export function ViralTechPage({ onBack, glass = true }: { onBack: () => void; glass?: boolean }) {
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
    <AgentShell
      id="viraltech"
      className="vt-page"
      glass={glass}
      onBack={onBack}
      title={L('title')}
      sub={L('sub')}
      actions={<a className="btn" href={ANTWORK_URL} target="_blank" rel="noopener noreferrer">{L('antwork')}</a>}
    >
      <p className="muted small">{L('asOf')} {when}</p>

      <StatRow items={stats} />

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
    </AgentShell>
  )
}
