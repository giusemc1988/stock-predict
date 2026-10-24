import { useEffect, useState } from 'react'
import { APP_VERSION, RELEASES } from '../data/releases'
import type { Bi } from '../lib/hubText'
import { requestTask, type TaskInfo } from '../lib/hubTasks'
import { useLang } from '../lib/i18n'
import { AgentShell } from './AgentShell'
import { StatRow, type Stat } from './StatCard'

const REPO = 'https://github.com/giusemc1988/stock-predict'
const MAX_HUE = '#f2c46d'

const T = {
  back: { en: '← Hub', vi: '← Hub' },
  title: { en: 'Max · Build & app builder', vi: 'Max · Xây dựng & tạo app' },
  sub: { en: 'Max keeps the hub itself growing: every fix and new feature you ask for becomes a code task, Claude opens a pull request, and nothing changes until it is merged.', vi: 'Max lo cho chính cái hub này lớn lên: mỗi lỗi cần sửa hay tính năng mới anh nhờ thành một việc code, Claude mở PR, chưa merge thì chưa có gì thay đổi.' },
  app: { en: 'App version', vi: 'Phiên bản app' },
  updates: { en: 'Updates', vi: 'Lần cập nhật' },
  updatesSub: { en: 'since the start', vi: 'từ đầu tới giờ' },
  last: { en: 'Last update', vi: 'Cập nhật gần nhất' },
  tasks: { en: 'Code tasks', vi: 'Việc code' },
  tasksSub: { en: 'waiting or in review', vi: 'đang chờ hoặc chờ duyệt' },
  askTitle: { en: 'Ask Max', vi: 'Nhờ Max' },
  askHint: { en: 'Say what to fix or build, e.g. "the Viraltech page needs a posts calendar".', vi: 'Ghi việc cần sửa hay làm, ví dụ "trang Viraltech cần lịch đăng bài".' },
  send: { en: 'Send to Claude', vi: 'Gửi cho Claude' },
  sending: { en: 'Sending…', vi: 'Đang gửi…' },
  listTitle: { en: 'Code tasks', vi: 'Việc code' },
  loading: { en: 'Reading tasks from GitHub…', vi: 'Đang đọc danh sách việc từ GitHub…' },
  noTasks: { en: 'No code tasks yet.', vi: 'Chưa có việc code nào.' },
  noRead: { en: "Couldn't read the tasks from GitHub right now.", vi: 'Chưa đọc được danh sách việc từ GitHub.' },
  waiting: { en: 'Waiting for Claude', vi: 'Chờ Claude' },
  pr: { en: 'Pull request ready', vi: 'Có PR chờ duyệt' },
  done: { en: 'Done', vi: 'Xong' },
  closed: { en: 'Closed', vi: 'Đã đóng' },
  open: { en: 'Open', vi: 'Mở' },
  relTitle: { en: 'Recent updates', vi: 'Cập nhật gần đây' },
  toolsTitle: { en: 'Tools', vi: 'Công cụ' },
  prs: { en: 'Pull requests', vi: 'Pull request' },
  prsNote: { en: 'Changes waiting for a merge', vi: 'Thay đổi chờ merge' },
  repo: { en: 'Source code', vi: 'Mã nguồn' },
  repoNote: { en: 'The whole hub on GitHub', vi: 'Toàn bộ hub trên GitHub' },
  dev: { en: 'Jarvis Dev (offline)', vi: 'Jarvis Dev (offline)' },
  devNote: { en: 'Fix and upgrade on the PC, no Claude needed', vi: 'Sửa và nâng cấp trên máy, không cần Claude' },
  actions: { en: 'Build runs', vi: 'Lần build' },
  actionsNote: { en: 'Tests, deploys and scheduled jobs', vi: 'Kiểm tra, deploy và việc định kỳ' },
} satisfies Record<string, Bi>

/** Max: what the hub's builder is doing — app version, code tasks for Claude and the latest updates. */
export function MaxPage({ onBack, glass = true }: { onBack: () => void; glass?: boolean }) {
  const lang = useLang()
  const L = (k: keyof typeof T) => T[k][lang]
  const [tasks, setTasks] = useState<TaskInfo[] | null | 'error'>(null)
  const [ask, setAsk] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState<Bi | null>(null)

  const load = () =>
    fetch('/api/hub/tasks')
      .then((r) => (r.ok ? (r.json() as Promise<{ tasks?: TaskInfo[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((j) => setTasks(j.tasks ?? []))
      .catch(() => setTasks('error'))
  useEffect(() => void load(), [])

  const send = async () => {
    if (ask.trim().length < 8 || busy) return
    setBusy(true)
    setReply(await requestTask(ask.trim(), 'the Max page'))
    setBusy(false)
    setAsk('')
    void load()
  }

  const list = Array.isArray(tasks) ? tasks : []
  const open = list.filter((x) => x.state === 'waiting' || x.state === 'pr').length
  const stats: Stat[] = [
    { key: 'app', label: L('app'), icon: 'code', accent: MAX_HUE, value: `v${APP_VERSION}` },
    { key: 'upd', label: L('updates'), icon: 'cycle', accent: MAX_HUE, value: String(RELEASES.length), sub: L('updatesSub') },
    { key: 'last', label: L('last'), icon: 'clock', accent: MAX_HUE, value: RELEASES[0]?.date.slice(5).replace('-', '/') ?? '—' },
    { key: 'tasks', label: L('tasks'), icon: 'list', accent: MAX_HUE, value: Array.isArray(tasks) ? String(open) : '—', sub: L('tasksSub') },
  ]
  const tools: { href: string; t: keyof typeof T; n: keyof typeof T }[] = [
    { href: `${REPO}/pulls`, t: 'prs', n: 'prsNote' },
    { href: `${REPO}/actions`, t: 'actions', n: 'actionsNote' },
    { href: REPO, t: 'repo', n: 'repoNote' },
    { href: `${REPO}/blob/main/tools/jarvis-dev/README.md`, t: 'dev', n: 'devNote' },
  ]

  return (
    <AgentShell id="forge" className="mx-page" glass={glass} onBack={onBack} backLabel={L('back')} title={L('title')} sub={L('sub')}>
      <StatRow items={stats} />

      <div className="mx-grid">
        <section className="bf-card mx-ask">
          <header><h3>{L('askTitle')}</h3></header>
          <p className="muted small">{L('askHint')}</p>
          <textarea rows={3} value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={600} />
          <div className="ag-acts">
            <button className="btn primary" disabled={busy || ask.trim().length < 8} onClick={() => void send()}>{busy ? L('sending') : L('send')}</button>
          </div>
          {reply && <p className="small" role="status">{reply[lang]}</p>}
        </section>

        <section className="bf-card mx-tasks">
          <header><h3>{L('listTitle')}</h3></header>
          {tasks === null ? (
            <p className="muted small">{L('loading')}</p>
          ) : tasks === 'error' ? (
            <p className="muted small">{L('noRead')}</p>
          ) : !list.length ? (
            <p className="muted small">{L('noTasks')}</p>
          ) : (
            <ul className="vt-list">
              {list.slice(0, 6).map((x) => (
                <li key={x.number} className="vt-row">
                  <div>
                    <b>#{x.number}</b> {x.title}
                    <div className={`small mx-st s-${x.state}`}>{L(x.state)}</div>
                  </div>
                  <a className="btn" href={x.url} target="_blank" rel="noopener noreferrer">{L('open')}</a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bf-card">
        <header><h3>{L('relTitle')}</h3></header>
        <ol className="mx-rel">
          {RELEASES.slice(0, 6).map((r) => (
            <li key={r.version}>
              <span className="mx-ver">v{r.version}<small>{r.date.slice(5).replace('-', '/')}</small></span>
              <span className="mx-what">{(lang === 'vi' ? r.changesVi ?? r.changes : r.changes)[0]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="bf-card">
        <header><h3>{L('toolsTitle')}</h3></header>
        <div className="net-tg mx-tools">
          {tools.map((x) => (
            <a key={x.t} className="mx-tool" href={x.href} target="_blank" rel="noopener noreferrer"><b>{L(x.t)} ↗</b><small>{L(x.n)}</small></a>
          ))}
        </div>
      </section>
    </AgentShell>
  )
}
