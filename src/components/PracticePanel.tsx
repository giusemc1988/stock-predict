import { useState } from 'react'
import { setAiRules, type AiRules } from '../lib/aiRules'
import { useLang } from '../lib/i18n'
import { dayKey, exitReasonLabel, kindOf, lessons, LONG_WIDTH, MAX_BARS, PRACTICE_START, practiceEquity, practiceReport, type GroupRow, type PracticeKind, type PracticeState, type PracticeTrade } from '../lib/practice'

type Tab = 'live' | 'report' | 'trades'

interface Props {
  state: PracticeState
  rules: AiRules
  symbol: string
  priceOf: (symbol: string) => number
  onReset: () => void
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
export function PracticePanel({ state, rules, symbol, priceOf, onReset }: Props) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const when = (ms: number) => new Date(ms).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const [tab, setTab] = useState<Tab>('live')
  const [confirmReset, setConfirmReset] = useState(false)
  const [only, setOnly] = useState<'all' | PracticeKind>('all')
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

  const toggle = (key: 'practiceMode' | 'practiceOnChart' | 'practiceFeed' | 'practiceDayOn' | 'practiceLongOn', label: string) => (
    <label className="al-toggle">
      <span>{label}</span>
      <span className="switch">
        <input type="checkbox" checked={rules[key]} onChange={(e) => setAiRules({ ...rules, [key]: e.target.checked })} />
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
      </div>
      <div className="pr-why">
        <span className="al-tag">{L('OUT', 'RA')}</span> {px(t.exit)} · {L(exitReasonLabel[t.exitReason].en, exitReasonLabel[t.exitReason].vi)} · {t.bars} {L('bars', 'nến')}
      </div>
    </li>
  )

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
              <h3 className={on ? 'up' : 'muted'}>{on ? L('Trading practice', 'Đang luyện tập') : L('Off', 'Tắt')}</h3>
              <p className="muted al-note">
                {on
                  ? L(
                      `Decides on each closed bar of the chart you have open (${symbol}), ${rules.practiceSizePct}% of the practice account per trade. Each day: the first AI BUY becomes the long-term trade (stop and target ${LONG_WIDTH}x wider, held up to ${rules.practiceHoldDays} days), the next BUYs become up to ${rules.practiceDayTrades} day trades that exit at stop, target, a SELL call, after ${MAX_BARS} bars, or before market close. It only trades when the AI says BUY, so some days have fewer.`,
                      `Quyết định ở mỗi nến đóng trên biểu đồ đang mở (${symbol}), ${rules.practiceSizePct}% tài khoản luyện tập mỗi lệnh. Mỗi ngày: lệnh MUA đầu tiên của AI thành lệnh dài hạn (cắt lỗ và chốt lời rộng gấp ${LONG_WIDTH}, giữ tối đa ${rules.practiceHoldDays} ngày), các lệnh MUA sau thành tối đa ${rules.practiceDayTrades} lệnh trong ngày, thoát ở cắt lỗ, chốt lời, lệnh BÁN, sau ${MAX_BARS} nến hoặc trước giờ đóng cửa. AI chỉ giao dịch khi nói MUA, nên có ngày ít lệnh hơn.`,
                    )
                  : L('Turn it on to let the AI place practice orders. Also in Settings > AI rules.', 'Bật lên để AI đặt lệnh luyện tập. Cũng có trong Cài đặt > Quy tắc AI.')}
              </p>
            </div>
            <label className="al-toggle">
              <b>{on ? 'ON' : 'OFF'}</b>
              <span className="switch">
                <input type="checkbox" checked={on} onChange={(e) => setAiRules({ ...rules, practiceMode: e.target.checked })} />
                <i />
              </span>
            </label>
          </div>
          <div className="pr-subtoggles">
            {toggle('practiceOnChart', L('Orders on chart', 'Lệnh trên biểu đồ'))}
            {toggle('practiceFeed', L('Order pop-ups', 'Thông báo lệnh'))}
            {toggle('practiceDayOn', L('Day trades', 'Lệnh trong ngày'))}
            {toggle('practiceLongOn', L('Long-term trade', 'Lệnh dài hạn'))}
          </div>
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

      <div className="pr-reset">
        {confirmReset ? (
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
