import { useState } from 'react'
import { getAiRules, setAiRules, type AiRules } from '../lib/aiRules'
import { useLang } from '../lib/i18n'
import type { PracticeScan } from '../hooks/usePractice'
import { pickSourceLabel } from '../lib/practicePicks'
import { loadRobotAudit, type AuditEntry } from '../lib/audit'
import { buildDailyReport } from '../lib/dailyReport'
import { DATA_LABEL } from '../lib/dataGuard'
import { BUCKET_LABEL, REVIEW_FAIL, reviewCounts, type ReviewBucket } from '../lib/review'
import { dayKey, exitReasonLabel, kindOf, lessons, LONG_WIDTH, MAX_BARS, PRACTICE_START, practiceEquity, practiceReport, type GroupRow, type PracticeKind, type PracticeState, type PracticeTrade } from '../lib/practice'

type Tab = 'live' | 'report' | 'trades' | 'daily' | 'log'

interface Props {
  state: PracticeState
  rules: AiRules
  symbol: string
  priceOf: (symbol: string) => number
  onReset: () => void
  scan: PracticeScan
  onRescan: () => void
  /** Open a market's chart (only markets in your watchlist can be opened). */
  onOpen: (symbol: string) => void
  universe: string[]
  /** Showing the 24/7 server account instead of this browser's. */
  serverMode: boolean
  serverLastRun: number | null
}

const money = (x: number | null) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}$${Math.abs(x).toFixed(2)}`)
const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`)
const px = (p: number) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.toPrecision(5))

/** Equity after each closed practice trade. */
function Curve({ points }: { points: { t: number; equity: number }[] }) {
  if (points.length < 2) return null
  const W = 300
  const H = 70
  const ys = points.map((p) => p.equity)
  const lo = Math.min(...ys, PRACTICE_START)
  const hi = Math.max(...ys, PRACTICE_START)
  const span = hi - lo || 1
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => H - ((v - lo) / span) * (H - 6) - 3
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(' ')
  const up = ys[ys.length - 1] >= PRACTICE_START
  return (
    <svg className="pr-curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="equity curve">
      <line x1="0" x2={W} y1={y(PRACTICE_START)} y2={y(PRACTICE_START)} className="pr-base" />
      <path d={d} className={up ? 'up' : 'down'} />
    </svg>
  )
}

/** Practice mode: the AI paper-trades small on live data. Status, live orders, and the report of what worked and what failed. */
export function PracticePanel({ state, rules, symbol, priceOf, onReset, scan, onRescan, onOpen, universe, serverMode, serverLastRun }: Props) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const [tab, setTab] = useState<Tab>('live')
  const [confirmReset, setConfirmReset] = useState(false)
  const [only, setOnly] = useState<'all' | PracticeKind>('all')
  const [logFilter, setLogFilter] = useState<'all' | 'ok' | 'no'>('all')
  const [day, setDay] = useState<string | null>(null)
  const on = rules.practiceMode
  const r = practiceReport(state, only === 'all' ? undefined : only)
  const shownTrades = only === 'all' ? state.trades : state.trades.filter((t) => kindOf(t) === only)
  const curve = shownTrades.reduce((pts, t) => [...pts, { t: t.closedAt, equity: pts[pts.length - 1].equity + t.pnl }], [{ t: 0, equity: PRACTICE_START }])
  const kindName = (k: PracticeKind) => (k === 'day' ? L('Day trade', 'Trong ngày') : L('Long-term', 'Dài hạn'))
  const kindBadge = (k: PracticeKind) => <span className={`pr-kindtag ${k}`}>{kindName(k)}</span>
  // today's quota use, counted on the US Eastern trading day
  const [today] = useState(() => dayKey(Date.now()))
  const usedToday = (k: PracticeKind) => [...state.trades, ...state.open].filter((t) => kindOf(t) === k && dayKey(t.openedAt) === today).length
  const filterBar = (
    <div className="pr-filter" role="group">
      {(
        [
          ['all', 'All trades', 'Tất cả'],
          ['day', 'Day trades', 'Trong ngày'],
          ['long', 'Long-term', 'Dài hạn'],
        ] as const
      ).map(([id, en, vi]) => (
        <button key={id} className={only === id ? 'on' : ''} onClick={() => setOnly(id)}>
          {L(en, vi)}
        </button>
      ))}
    </div>
  )
  const equity = practiceEquity(state)
  const openPnl = state.open.reduce((a, p) => {
    const now = priceOf(p.symbol)
    return a + (now > 0 ? (now - p.entry) * p.qty : 0)
  }, 0)
  const wins = shownTrades.filter((t) => t.pnl > 0)
  const fails = shownTrades.filter((t) => t.pnl <= 0)

  const toggle = (key: 'practiceMode' | 'practiceOnChart' | 'practiceFeed' | 'practiceDayOn' | 'practiceLongOn' | 'practiceAutoPick' | 'practiceMovers' | 'practiceServer' | 'practiceWatchlist' | 'practiceFollow' | 'practiceInPanels', label: string) => (
    <label className="al-toggle">
      <span>{label}</span>
      <span className="switch">
        <input type="checkbox" checked={rules[key]} onChange={(e) => setAiRules({ ...getAiRules(), [key]: e.target.checked })} />
        <i />
      </span>
    </label>
  )

  const groupTable = (title: string, rows: GroupRow[], label: (k: string) => string = (k) => k) =>
    rows.length > 0 && (
      <div className="al-card">
        <div className="al-kicker">{title}</div>
        <table className="al-table">
          <thead>
            <tr>
              <th />
              <th>{L('Trades', 'Lệnh')}</th>
              <th>{L('Win rate', 'Tỷ lệ thắng')}</th>
              <th>{L('Avg P&L', 'Lãi/lỗ TB')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key}>
                <td>{label(g.key)}</td>
                <td>{g.n}</td>
                <td>{pct(g.winRate)}</td>
                <td className={g.avgPnl >= 0 ? 'up' : 'down'}>{money(g.avgPnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  const tradeRow = (t: PracticeTrade) => (
    <li key={t.id} className={`pr-trade ${t.pnl > 0 ? 'win' : 'loss'}`}>
      <div className="pr-trade-head">
        {kindBadge(kindOf(t))}
        <b>{t.symbol}</b>
        <span className="muted">{t.tf}</span>
        <span className="muted">{when(t.closedAt)}</span>
        <b className={t.pnl > 0 ? 'up' : 'down'}>
          {money(t.pnl)} ({t.retPct >= 0 ? '+' : ''}
          {t.retPct.toFixed(2)}%)
        </b>
      </div>
      <div className="pr-why">
        <span className="al-tag">{L('IN', 'VÀO')}</span> {px(t.entry)} · {t.info.reason}
        {t.info.grade && ` · ${L('Trade Score', 'Điểm GD')} ${t.info.grade}`}
        {t.info.regime && ` · ${L('volatility', 'biến động')} ${t.info.regime}`}
        {` · ${L('learner', 'bộ học')} ${t.info.learner}`}
        {t.info.data && ` · ${L(DATA_LABEL[t.info.data.label].en, DATA_LABEL[t.info.data.label].vi)} ${t.info.data.source}, ${Math.round(t.info.data.ageSec / 60)} ${L('min old', 'phút trước')}`}
      </div>
      {t.info.pick && (
        <div className="pr-why">
          <span className="al-tag">{L('PICKED', 'CHỌN')}</span> {L(t.info.pick.en, t.info.pick.vi)}
        </div>
      )}
      <div className="pr-why">
        <span className="al-tag">{L('OUT', 'RA')}</span> {px(t.exit)} · {L(exitReasonLabel[t.exitReason].en, exitReasonLabel[t.exitReason].vi)} · {t.bars} {L('bars', 'nến')}
        {t.costPaid != null && ` · ${L('costs', 'chi phí')} $${t.costPaid.toFixed(2)}`}
      </div>
      {rules.reviewOn && t.review && (
        <div className="pr-why">
          <span className={`al-tag pr-rv ${t.review.bucket}`}>{L('REVIEW', 'ĐÁNH GIÁ')}</span> {L(BUCKET_LABEL[t.review.bucket].en, BUCKET_LABEL[t.review.bucket].vi)}
          {t.review.fails.length > 0 && `: ${t.review.fails.map((f) => L(REVIEW_FAIL[f].en, REVIEW_FAIL[f].vi)).join(', ')}`}
        </div>
      )}
    </li>
  )

  // decision log: practice decisions plus the robot's orders on your paper account
  const log: AuditEntry[] = tab === 'log' ? [...(state.audit ?? []), ...loadRobotAudit()].sort((a, b) => b.time - a.time) : []
  const shownLog = log.filter((e) => logFilter === 'all' || (logFilter === 'ok') === e.accepted).slice(0, 150)
  const reviews = reviewCounts(shownTrades.map((t) => t.review))
  const reviewed = Object.values(reviews).reduce((a, b) => a + b, 0)
  const costs = shownTrades.reduce((a, t) => a + (t.costPaid ?? 0), 0)
  // daily report: saved ones plus today's, built live
  const days = [...new Set([today, ...Object.keys(state.reports ?? {})])].sort().reverse()
  const shownDay = day ?? days[0]
  const report = shownDay === today ? buildDailyReport(state, today) : state.reports?.[shownDay] ?? buildDailyReport(state, shownDay)

  return (
    <div className="autolearn practice">
      <p className="al-brain muted">
        {L(
          `Practice mode lets the AI paper-trade small on live data while the app is open, in its own $${PRACTICE_START.toLocaleString('en-US')} practice account, even though no method has beaten buying every bar yet. All risk gates stay on. Paper only, never a real broker, not financial advice.`,
          `Chế độ luyện tập cho AI giao dịch thử khối lượng nhỏ trên dữ liệu thật khi ứng dụng đang mở, trong tài khoản luyện tập $${PRACTICE_START.toLocaleString('en-US')} riêng, dù chưa có phương pháp nào thắng việc mua mọi nến. Mọi cổng rủi ro vẫn bật. Chỉ thử nghiệm, không bao giờ dùng sàn thật, không phải lời khuyên đầu tư.`,
        )}
      </p>
      <div className="al-tabs pr-tabs">
        {(
          [
            ['live', 'Live', 'Trực tiếp'],
            ['report', 'What it learned', 'AI đã học gì'],
            ['trades', 'Wins & fails', 'Thắng & thua'],
            ...(rules.dailyReportOn ? ([['daily', 'Daily report', 'Báo cáo ngày']] as const) : []),
            ...(rules.auditOn ? ([['log', 'Decision log', 'Nhật ký quyết định']] as const) : []),
          ] as const
        ).map(([id, en, vi]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {L(en, vi)}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <>
          <div className="al-card al-hero">
            <div>
              <div className="al-kicker">{L('PRACTICE MODE · PAPER', 'CHẾ ĐỘ LUYỆN TẬP · THỬ')}</div>
              <h3 className={on ? 'up' : 'muted'}>{on ? (serverMode ? L('Trading 24/7 on the server', 'Đang giao dịch 24/7 trên máy chủ') : L('Trading practice', 'Đang luyện tập')) : L('Off', 'Tắt')}</h3>
              {on && serverMode && (
                <p className="al-note">
                  {L(
                    `You can close the app: the server trades every 15 minutes during US market hours on weekdays, and its trades show up here and on the chart when you come back. Last run ${serverLastRun ? when(serverLastRun) : '–'}.`,
                    `Bạn có thể đóng ứng dụng: máy chủ giao dịch mỗi 15 phút trong giờ thị trường Mỹ vào ngày thường, và các lệnh hiện ở đây và trên biểu đồ khi bạn quay lại. Lần chạy cuối ${serverLastRun ? when(serverLastRun) : '–'}.`,
                  )}
                </p>
              )}
              {on && !serverMode && rules.practiceServer && (
                <p className="al-note muted">
                  {L(
                    "The 24/7 server account hasn't run yet (it runs every 15 minutes in US market hours), so this browser trades while the app is open.",
                    'Tài khoản máy chủ 24/7 chưa chạy (chạy mỗi 15 phút trong giờ thị trường Mỹ), nên trình duyệt này giao dịch khi ứng dụng đang mở.',
                  )}
                </p>
              )}
              <p className="muted al-note">
                {on
                  ? L(
                      `${rules.practiceAutoPick || serverMode ? `Every ${serverMode ? 15 : 5} minutes it scans your watchlist${rules.practiceMovers ? " and today's top gainers and most-traded stocks" : ''} on 15-minute bars, ranks the AI's BUY calls by Trade Score, volume and today's gain, and trades the best ones.` : `Decides on each closed bar of the chart you have open (${symbol}).`} ${rules.practiceSizePct}% of the practice account per trade. Each day: the best AI BUY becomes the long-term trade (stop and target ${LONG_WIDTH}x wider, held up to ${rules.practiceHoldDays} days), the next best become up to ${rules.practiceDayTrades} day trades that exit at stop, target, a SELL call, after ${MAX_BARS} bars, or before market close. It only trades when the AI says BUY, so some days have fewer.`,
                      `${rules.practiceAutoPick || serverMode ? `Mỗi ${serverMode ? 15 : 5} phút AI quét danh sách theo dõi${rules.practiceMovers ? ' và các mã tăng mạnh, giao dịch nhiều nhất hôm nay' : ''} trên nến 15 phút, xếp hạng lệnh MUA theo Điểm GD, khối lượng và mức tăng hôm nay, rồi giao dịch các mã tốt nhất.` : `Quyết định ở mỗi nến đóng trên biểu đồ đang mở (${symbol}).`} ${rules.practiceSizePct}% tài khoản luyện tập mỗi lệnh. Mỗi ngày: lệnh MUA tốt nhất của AI thành lệnh dài hạn (cắt lỗ và chốt lời rộng gấp ${LONG_WIDTH}, giữ tối đa ${rules.practiceHoldDays} ngày), các lệnh tốt tiếp theo thành tối đa ${rules.practiceDayTrades} lệnh trong ngày, thoát ở cắt lỗ, chốt lời, lệnh BÁN, sau ${MAX_BARS} nến hoặc trước giờ đóng cửa. AI chỉ giao dịch khi nói MUA, nên có ngày ít lệnh hơn.`,
                    )
                  : L('Turn it on to let the AI place practice orders. Also in Settings > AI rules.', 'Bật lên để AI đặt lệnh luyện tập. Cũng có trong Cài đặt > Quy tắc AI.')}
              </p>
            </div>
            <label className="al-toggle">
              <b>{on ? 'ON' : 'OFF'}</b>
              <span className="switch">
                <input type="checkbox" checked={on} onChange={(e) => setAiRules({ ...getAiRules(), practiceMode: e.target.checked })} />
                <i />
              </span>
            </label>
          </div>
          <div className="pr-subtoggles">
            {toggle('practiceOnChart', L('Orders on chart', 'Lệnh trên biểu đồ'))}
            {toggle('practiceFeed', L('Order pop-ups', 'Thông báo lệnh'))}
            {toggle('practiceDayOn', L('Day trades', 'Lệnh trong ngày'))}
            {toggle('practiceLongOn', L('Long-term trade', 'Lệnh dài hạn'))}
            {toggle('practiceAutoPick', L('Picks its own stocks', 'Tự chọn mã'))}
            {rules.practiceAutoPick && toggle('practiceMovers', L("Today's movers", 'Mã biến động hôm nay'))}
            {toggle('practiceServer', L('24/7 on the server', '24/7 trên máy chủ'))}
            {toggle('practiceWatchlist', L('AI active list', 'Danh sách AI'))}
            {toggle('practiceFollow', L('Chart follows trades', 'Biểu đồ theo lệnh'))}
            {toggle('practiceInPanels', L('In Positions & History', 'Trong Vị thế & Lịch sử'))}
          </div>
          {(rules.practiceAutoPick || serverMode) && on && (
            <div className="al-card">
              <div className="al-report-head">
                <div className="al-kicker">{L("TODAY'S PICKS", 'MÃ ĐƯỢC CHỌN HÔM NAY')}</div>
                {!serverMode && (
                  <button className="pr-rescan" onClick={onRescan} disabled={scan.busy}>
                    {scan.busy ? L('Scanning…', 'Đang quét…') : L('Scan now', 'Quét ngay')}
                  </button>
                )}
              </div>
              <p className="muted al-note">
                {scan.at ? `${L('Last scan', 'Lần quét cuối')} ${when(scan.at)}${serverMode ? L(' on the server', ' trên máy chủ') : ''}` : L('First scan is running…', 'Đang quét lần đầu…')}
                {scan.failed.length > 0 && ` · ${L('no data for', 'không có dữ liệu cho')} ${scan.failed.join(', ')}`}
              </p>
              {scan.noStockData && (
                <p className="muted al-note">
                  {L(
                    'Stocks are skipped until an Alpaca paper key is connected (Portfolio page). Crypto is scanned now. Top gainers and most-traded stocks also need the Alpaca key.',
                    'Cổ phiếu được bỏ qua cho đến khi kết nối khoá Alpaca thử nghiệm (trang Danh mục). Tiền điện tử vẫn được quét. Mã tăng mạnh và giao dịch nhiều cũng cần khoá Alpaca.',
                  )}
                </p>
              )}
              {scan.candidates.length > 0 && (
                <table className="al-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{L('Market', 'Mã')}</th>
                      <th>{L('AI', 'AI')}</th>
                      <th>{L('Today', 'Hôm nay')}</th>
                      <th>{L('Volume', 'KL')}</th>
                      <th>{L('Score', 'Điểm')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scan.candidates.slice(0, 12).map((c) => {
                      const held = state.open.find((p) => p.symbol === c.symbol)
                      return (
                        <tr key={c.symbol} className={c.place == null ? 'pr-dim' : ''}>
                          <td>{c.place ?? '–'}</td>
                          <td>
                            {universe.includes(c.symbol) ? (
                              <button className="pr-link" onClick={() => onOpen(c.symbol)}>
                                {c.symbol}
                              </button>
                            ) : (
                              <b>{c.symbol}</b>
                            )}{' '}
                            {held && kindBadge(kindOf(held))}
                            <div className="muted pr-time">{L(pickSourceLabel[c.source].en, pickSourceLabel[c.source].vi)}</div>
                          </td>
                          <td className={c.verdict === 'BUY' ? 'up' : c.verdict === 'SELL' ? 'down' : 'muted'}>{c.verdict ?? '–'}</td>
                          <td className={(c.gainPct ?? 0) >= 0 ? 'up' : 'down'}>{c.gainPct == null ? '–' : `${c.gainPct >= 0 ? '+' : ''}${c.gainPct.toFixed(1)}%`}</td>
                          <td>{c.volVsAvg == null ? '–' : `${c.volVsAvg.toFixed(1)}x`}</td>
                          <td>{c.tradeScore ?? '–'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
          <div className="al-tiles">
            <div>
              <span>{L('Day trades today', 'Lệnh trong ngày hôm nay')}</span>
              <b>{rules.practiceDayOn ? `${usedToday('day')} / ${rules.practiceDayTrades}` : L('off', 'tắt')}</b>
            </div>
            <div>
              <span>{L('Long-term today', 'Dài hạn hôm nay')}</span>
              <b>{rules.practiceLongOn ? `${usedToday('long')} / ${rules.practiceLongTrades}` : L('off', 'tắt')}</b>
            </div>
          </div>

          <div className="al-tiles">
            <div>
              <span>{L('Equity', 'Tài sản')}</span>
              <b>${(equity + openPnl).toFixed(2)}</b>
            </div>
            <div>
              <span>{L('Realized', 'Đã chốt')}</span>
              <b className={state.realized >= 0 ? 'up' : 'down'}>{money(state.realized)}</b>
            </div>
            <div>
              <span>{L('Open P&L', 'Lãi/lỗ mở')}</span>
              <b className={openPnl >= 0 ? 'up' : 'down'}>{money(openPnl)}</b>
            </div>
            <div>
              <span>{L('Win rate', 'Tỷ lệ thắng')}</span>
              <b>
                {pct(r.winRate)} <em className="muted">({r.n})</em>
              </b>
            </div>
          </div>

          <div className="al-card">
            <div className="al-kicker">{L('OPEN PRACTICE TRADES', 'LỆNH LUYỆN TẬP ĐANG MỞ')}</div>
            {state.open.length === 0 ? (
              <p className="muted al-note">{L('None right now.', 'Hiện chưa có.')}</p>
            ) : (
              <table className="al-table">
                <thead>
                  <tr>
                    <th>{L('Market', 'Mã')}</th>
                    <th>{L('Type', 'Loại')}</th>
                    <th>{L('Entry', 'Vào')}</th>
                    <th>{L('Stop / target', 'Cắt lỗ / chốt')}</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {state.open.map((p) => {
                    const now = priceOf(p.symbol)
                    const pnl = now > 0 ? (now - p.entry) * p.qty : null
                    return (
                      <tr key={p.id}>
                        <td>
                          <b>{p.symbol}</b> <span className="muted">{p.tf}</span>
                        </td>
                        <td>
                          {kindBadge(kindOf(p))}
                          {p.closeBy != null && <div className="muted pr-time">{L('by', 'trước')} {when(p.closeBy)}</div>}
                        </td>
                        <td>{px(p.entry)}</td>
                        <td>
                          <span className="down">{px(p.stop)}</span> / <span className="up">{px(p.target)}</span>
                        </td>
                        <td className={(pnl ?? 0) >= 0 ? 'up' : 'down'}>{money(pnl)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="al-card">
            <div className="al-kicker">{L('ACTIVITY', 'HOẠT ĐỘNG')}</div>
            {state.events.length === 0 ? (
              <p className="muted al-note">{L('Nothing yet. Orders and skipped setups show up here as they happen.', 'Chưa có gì. Lệnh và các lần bỏ qua sẽ hiện ở đây khi xảy ra.')}</p>
            ) : (
              <ul className="pr-feed">
                {state.events.slice(0, 40).map((e) => (
                  <li key={e.id} className={e.kind}>
                    <span className="pr-kind">{e.kind === 'buy' ? L('BUY', 'MUA') : e.kind === 'sell' ? L('SELL', 'BÁN') : L('SKIP', 'BỎ QUA')}</span>
                    <span className="pr-text">{L(e.en, e.vi)}</span>
                    <span className="muted pr-time">{when(e.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === 'report' && (
        <>
          {filterBar}
          <div className="al-tiles">
            <div>
              <span>{L('Trades', 'Lệnh')}</span>
              <b>{r.n}</b>
            </div>
            <div>
              <span>{L('Win rate', 'Tỷ lệ thắng')}</span>
              <b>{pct(r.winRate)}</b>
            </div>
            <div>
              <span>P&L</span>
              <b className={r.pnl >= 0 ? 'up' : 'down'}>{money(r.pnl)}</b>
            </div>
            <div>
              <span>{L('Profit factor', 'Hệ số lợi nhuận')}</span>
              <b>{r.profitFactor == null ? '–' : r.profitFactor.toFixed(2)}</b>
            </div>
            <div>
              <span>{L('Avg win', 'Thắng TB')}</span>
              <b className="up">{money(r.avgWin)}</b>
            </div>
            <div>
              <span>{L('Avg loss', 'Thua TB')}</span>
              <b className="down">{money(r.avgLoss)}</b>
            </div>
          </div>
          {costs > 0 && (
            <p className="muted al-note">
              {L(`P&L is after $${costs.toFixed(2)} of fees, spread and slippage.`, `Lãi/lỗ đã trừ $${costs.toFixed(2)} phí, chênh lệch và trượt giá.`)}
            </p>
          )}
          {rules.reviewOn && reviewed > 0 && (
            <div className="al-card">
              <div className="al-kicker">{L('PROCESS VS. LUCK', 'QUY TRÌNH HAY MAY MẮN')}</div>
              <table className="al-table">
                <tbody>
                  {(['skill', 'unlucky', 'lucky', 'mistake'] as ReviewBucket[]).map((b) => (
                    <tr key={b}>
                      <td>{L(BUCKET_LABEL[b].en, BUCKET_LABEL[b].vi)}</td>
                      <td>{reviews[b]}</td>
                      <td>{pct(reviews[b] / reviewed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted al-note">
                {L(
                  'Good process = reward at least 1.5x the risk, Trade Score 40+, fresh real data, and the learner not saying HOLD. Lucky wins are not a reason to repeat a trade.',
                  'Quy trình tốt = lợi nhuận ít nhất 1,5 lần rủi ro, Điểm GD từ 40, dữ liệu thật và mới, và bộ học không nói GIỮ. Thắng nhờ may mắn không phải lý do để lặp lại.',
                )}
              </p>
            </div>
          )}
          <div className="al-card">
            <div className="al-kicker">{L('P&L OVER TIME', 'LÃI/LỖ THEO THỜI GIAN')}</div>
            {curve.length < 2 ? <p className="muted al-note">{L('The curve starts after the first closed trade.', 'Đường cong bắt đầu sau lệnh đóng đầu tiên.')}</p> : <Curve points={curve} />}
          </div>
          <div className="al-card">
            <div className="al-kicker">{L('WHAT IT LEARNED', 'AI ĐÃ HỌC GÌ')}</div>
            <ul className="pr-lessons">
              {lessons(state).map((l) => (
                <li key={l.en}>{L(l.en, l.vi)}</li>
              ))}
            </ul>
          </div>
          {only === 'all' && groupTable(L('DAY TRADES VS LONG-TERM', 'TRONG NGÀY SO VỚI DÀI HẠN'), r.byKind, (k) => kindName(k as PracticeKind))}
          {groupTable(L('BY TRADE SCORE GRADE', 'THEO HẠNG ĐIỂM GIAO DỊCH'), r.byGrade)}
          {groupTable(L('BY HOW IT EXITED', 'THEO CÁCH THOÁT LỆNH'), r.byExit, (k) => {
            const lab = exitReasonLabel[k as keyof typeof exitReasonLabel]
            return lab ? L(lab.en, lab.vi) : k
          })}
          {groupTable(L('BY HOW IT WAS FOUND', 'THEO NGUỒN CHỌN MÃ'), r.bySource, (k) => (k === 'chart' ? L('open chart', 'biểu đồ đang mở') : L(pickSourceLabel[k as keyof typeof pickSourceLabel].en, pickSourceLabel[k as keyof typeof pickSourceLabel].vi)))}
          {groupTable(L('BY VOLATILITY', 'THEO BIẾN ĐỘNG'), r.byRegime)}
          {groupTable(L('BY LEARNER OPINION', 'THEO Ý KIẾN BỘ HỌC'), r.byLearner)}
          {groupTable(L('BY MARKET', 'THEO MÃ'), r.bySymbol)}
        </>
      )}

      {tab === 'trades' && (
        <>
          {filterBar}
          <div className="al-card">
            <div className="al-kicker">
              {L('SUCCESSFUL', 'THÀNH CÔNG')} ({wins.length})
            </div>
            {wins.length === 0 ? <p className="muted al-note">{L('No winning practice trades yet.', 'Chưa có lệnh luyện tập thắng.')}</p> : <ul className="pr-trades">{wins.slice(-30).reverse().map(tradeRow)}</ul>}
          </div>
          <div className="al-card">
            <div className="al-kicker pr-fail">
              {L('FAILED', 'THẤT BẠI')} ({fails.length})
            </div>
            {fails.length === 0 ? <p className="muted al-note">{L('No losing practice trades yet.', 'Chưa có lệnh luyện tập thua.')}</p> : <ul className="pr-trades">{fails.slice(-30).reverse().map(tradeRow)}</ul>}
          </div>
        </>
      )}

      {tab === 'daily' && rules.dailyReportOn && (
        <>
          <div className="pr-filter" role="group">
            {days.slice(0, 7).map((d) => (
              <button key={d} className={shownDay === d ? 'on' : ''} onClick={() => setDay(d)}>
                {d === today ? L('Today', 'Hôm nay') : d.slice(5)}
              </button>
            ))}
          </div>
          <div className="al-tiles">
            <div>
              <span>{L('Trades closed', 'Lệnh đã đóng')}</span>
              <b>{report.trades}</b>
            </div>
            <div>
              <span>{L('Won', 'Thắng')}</span>
              <b>{report.wins}</b>
            </div>
            <div>
              <span>{L('Net P&L', 'Lãi/lỗ ròng')}</span>
              <b className={report.net >= 0 ? 'up' : 'down'}>{money(report.net)}</b>
            </div>
            <div>
              <span>{L('Costs', 'Chi phí')}</span>
              <b>${report.costs.toFixed(2)}</b>
            </div>
            <div>
              <span>{L('Buys taken', 'Lệnh mua đã vào')}</span>
              <b>{report.opened}</b>
            </div>
            <div>
              <span>{L('Buys rejected', 'Lệnh mua bị từ chối')}</span>
              <b>{report.rejected}</b>
            </div>
          </div>
          <div className="al-card">
            <div className="al-kicker">{L('SUMMARY AND LESSONS', 'TÓM TẮT VÀ BÀI HỌC')}</div>
            <ul className="pr-lessons">
              {report.lessons.map((l) => (
                <li key={l.en}>{L(l.en, l.vi)}</li>
              ))}
              {report.best && report.trades > 1 && (
                <li>
                  {L('Best', 'Tốt nhất')}: {report.best.symbol} {money(report.best.pnl)} · {L('worst', 'kém nhất')}: {report.worst!.symbol} {money(report.worst!.pnl)}
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      {tab === 'log' && rules.auditOn && (
        <>
          <div className="pr-filter" role="group">
            {(
              [
                ['all', 'All', 'Tất cả'],
                ['ok', 'Accepted', 'Chấp nhận'],
                ['no', 'Rejected', 'Từ chối'],
              ] as const
            ).map(([id, en, vi]) => (
              <button key={id} className={logFilter === id ? 'on' : ''} onClick={() => setLogFilter(id)}>
                {L(en, vi)}
              </button>
            ))}
          </div>
          <div className="al-card">
            <div className="al-kicker">{L('EVERY AI DECISION, WITH ITS DATA', 'MỌI QUYẾT ĐỊNH AI, KÈM DỮ LIỆU')}</div>
            {shownLog.length === 0 ? (
              <p className="muted al-note">{L('No decisions logged yet.', 'Chưa có quyết định nào.')}</p>
            ) : (
              <ul className="pr-feed pr-log">
                {shownLog.map((e) => (
                  <li key={e.id} className={e.accepted ? 'ok' : 'no'}>
                    <div className="pr-trade-head">
                      <span className={`al-tag ${e.accepted ? 'up' : 'down'}`}>{e.accepted ? L('ACCEPTED', 'CHẤP NHẬN') : L('REJECTED', 'TỪ CHỐI')}</span>
                      <b>{e.symbol}</b>
                      <span className="muted">{e.account === 'robot' ? L('robot', 'robot') : L('practice', 'luyện tập')}</span>
                      <span className="muted">{when(e.time)}</span>
                    </div>
                    <div className="pr-why">{L(e.en, e.vi)}</div>
                    <div className="pr-why muted">
                      {e.data ? `${L(DATA_LABEL[e.data.label].en, DATA_LABEL[e.data.label].vi)} · ${e.data.source} · ${L('bar closed', 'nến đóng')} ${Math.round(e.data.ageSec / 60)} ${L('min before', 'phút trước')}` : L('no bar data', 'không có dữ liệu nến')}
                      {e.tradeScore != null && ` · ${L('Trade Score', 'Điểm GD')} ${e.tradeScore}`}
                      {e.passed && e.passed.length > 0 && ` · ${L('passed', 'đạt')}: ${e.passed.join(', ')}`}
                      {e.blockedBy && ` · ${L('stopped by', 'bị chặn bởi')}: ${e.blockedBy}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="pr-reset">
        {serverMode ? (
          <span className="muted">{L('This is the server account; it is not reset from the browser.', 'Đây là tài khoản máy chủ; không đặt lại từ trình duyệt.')}</span>
        ) : confirmReset ? (
          <>
            <span className="muted">{L('Clear all practice trades and start again at $10,000?', 'Xoá mọi lệnh luyện tập và bắt đầu lại từ $10,000?')}</span>
            <button
              className="danger"
              onClick={() => {
                onReset()
                setConfirmReset(false)
              }}
            >
              {L('Reset', 'Đặt lại')}
            </button>
            <button onClick={() => setConfirmReset(false)}>{L('Cancel', 'Huỷ')}</button>
          </>
        ) : (
          <button onClick={() => setConfirmReset(true)}>{L('Reset practice account', 'Đặt lại tài khoản luyện tập')}</button>
        )}
      </div>
    </div>
  )
}
