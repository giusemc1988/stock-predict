import { useState } from 'react'
import { setAiRules, type AiRules } from '../lib/aiRules'
import { useLang } from '../lib/i18n'
import { decide } from '../lib/journal'
import type { AutoLearning } from '../hooks/useAutoLearning'
import { ARENA_START, arenaEquity, avgRet, HORIZON, learnerView, SIGNALS, statsFor, trendOf, winRate, type LogEntry } from '../lib/autoLearn'
import { LearningPanel } from './LearningPanel'

type Tab = 'live' | 'learned' | 'arena' | 'report' | 'research'

interface Props {
  al: AutoLearning
  rules: AiRules
  symbol: string
  /** The model's current up-probability on the open chart, for the learner's verdict. */
  liveScore: number | null
}

const pct = (x: number | null, d = 1) => (x == null ? '–' : `${(x * 100).toFixed(d)}%`)
const signed = (x: number | null, d = 2) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}%`)

/** 24/7 auto learning: what it is doing, what it learned, the PAPER arena and each signal's record. */
export function AutoLearnPanel({ al, rules, symbol, liveScore }: Props) {
  const lang = useLang()
  const L = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  const when = (ms: number | null) => (ms == null ? '–' : new Date(ms).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))
  const [tab, setTab] = useState<Tab>('live')
  const st = al.state
  const on = rules.autoLearn
  const setOn = (v: boolean) => setAiRules({ ...rules, autoLearn: v })

  const tabs: { id: Tab; en: string; vi: string }[] = [
    { id: 'live', en: '24/7 learning', vi: 'Tự học 24/7' },
    { id: 'learned', en: 'What it learned', vi: 'AI đã học gì' },
    { id: 'arena', en: 'PAPER arena', vi: 'Đấu trường THỬ' },
    { id: 'report', en: 'Success report', vi: 'Báo cáo hiệu quả' },
    { id: 'research', en: 'Research', vi: 'Nghiên cứu' },
  ]

  return (
    <div className="autolearn">
      <p className="al-brain muted">
        {L(
          'Uses every analyst module (trading-analyst rules, Trade Score, risk gates, sizing) on past and new bars. Learning means measured outcomes and a calibrated learner, not a retrained model. Paper only, not financial advice.',
          'Dùng mọi mô-đun phân tích (quy tắc trading-analyst, Điểm Giao dịch, cổng rủi ro, khối lượng) trên nến cũ và mới. Học ở đây là đo kết quả thật và hiệu chỉnh bộ học, không phải huấn luyện lại mô hình. Chỉ thử nghiệm, không phải lời khuyên đầu tư.',
        )}
      </p>
      <div className="al-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {L(t.en, t.vi)}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <>
          <div className="al-card al-hero">
            <div>
              <div className="al-kicker">{L('24/7 AUTO-LEARNING', 'TỰ HỌC 24/7')}</div>
              <h3>
                {!on
                  ? L('Off', 'Đang tắt')
                  : al.running
                    ? L('Learning now…', 'Đang học…')
                    : al.serverFresh
                      ? L('Running around the clock', 'Chạy suốt ngày đêm')
                      : L('Learning while the app is open', 'Đang học khi ứng dụng mở')}
              </h3>
              <p className="muted">
                {al.serverFresh
                  ? L('Server cycle hourly in US market hours, daily on weekends · works while the app is closed', 'Máy chủ chạy mỗi giờ trong giờ thị trường Mỹ, mỗi ngày vào cuối tuần · chạy cả khi đóng ứng dụng')
                  : L(
                      'The server cycle has not reported in the last day, so learning runs only while this app is open.',
                      'Chu kỳ máy chủ chưa báo kết quả trong ngày qua, nên chỉ học khi ứng dụng đang mở.',
                    )}
              </p>
            </div>
            <label className="al-toggle">
              <b>{on ? 'ON' : 'OFF'}</b>
              <span className="switch">
                <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
                <i />
              </span>
            </label>
          </div>

          <div className="al-tiles">
            <div>
              <span>{L('Cycles', 'Chu kỳ')}</span>
              <b>{st.cycles}</b>
            </div>
            <div>
              <span>{L('Old-trade tests', 'Kiểm thử lệnh cũ')}</span>
              <b>{st.oldTests.toLocaleString()}</b>
            </div>
            <div>
              <span>{L('New bars tested', 'Nến mới đã thử')}</span>
              <b>{st.newBars.toLocaleString()}</b>
            </div>
            <div>
              <span>{L('Playbook', 'Cẩm nang')}</span>
              <b>
                {SIGNALS.length} {L('methods', 'cách')}
              </b>
            </div>
          </div>

          <div className="al-card al-when">
            <div>
              <span className="muted">{L('Last cycle', 'Chu kỳ gần nhất')}</span>
              <b>{when(st.lastCycle)}</b>
              {st.lastCycle != null && <em className="muted">{st.source === 'server' ? L('server', 'máy chủ') : L('this browser', 'trình duyệt này')}</em>}
            </div>
            <div>
              <span className="muted">{L('Next scheduled check', 'Lần kiểm tra kế tiếp')}</span>
              <b>{!on ? '–' : al.nextCycle == null ? L('In a moment', 'Ngay sau đây') : when(al.nextCycle)}</b>
            </div>
            <button className="primary" disabled={!on || al.running || !al.markets.length} onClick={al.runNow}>
              {al.running ? L('Running…', 'Đang chạy…') : L('Run learning cycle now', 'Chạy chu kỳ học ngay')}
            </button>
          </div>
          {!on && <p className="muted al-note">{L('Turn it on to start learning. You can also switch it in Settings > AI rules.', 'Bật lên để bắt đầu học. Bạn cũng có thể đổi trong Cài đặt > Quy tắc AI.')}</p>}
          {al.error && <p className="down al-note">{al.error}</p>}

          <div className="al-card">
            <div className="al-kicker">{L('LATEST LEARNING', 'BÀI HỌC MỚI NHẤT')}</div>
            <p>{st.latest ? L(st.latest.en, st.latest.vi) : L('No cycle has run yet.', 'Chưa chạy chu kỳ nào.')}</p>
          </div>

          <div className="al-card">
            <h4>{L('Two learning lanes', 'Hai làn học')}</h4>
            <p>
              <b className="al-tag">{L('OLD TRADES', 'LỆNH CŨ')}</b>{' '}
              {L(
                `Each cycle replays past hourly bars on rotating markets (2 markets x 150 bars in this browser, 4 x 500 on the server), working back through history. Each bar is scored as if it were now, then graded on what price did ${HORIZON} bars later. Nothing from the future is used to make the call.`,
                `Mỗi chu kỳ chạy lại nến giờ trong quá khứ trên các thị trường luân phiên (2 thị trường x 150 nến trên trình duyệt, 4 x 500 trên máy chủ), lùi dần về quá khứ. Mỗi nến được chấm như thể đang là hiện tại, rồi chấm điểm theo giá ${HORIZON} nến sau. Không dùng dữ liệu tương lai để ra quyết định.`,
              )}
            </p>
            <p>
              <b className="al-tag">{L('NEW BARS', 'NẾN MỚI')}</b>{' '}
              {L(
                `Every bar that closed since the last cycle is scored the same way and waits ${HORIZON} bars for its result. These make the self-scorecard and the PAPER arena.`,
                `Mỗi nến đóng sau chu kỳ trước được chấm như vậy và chờ ${HORIZON} nến để có kết quả. Chúng tạo nên bảng tự chấm và đấu trường THỬ.`,
              )}
            </p>
            <p className="muted">
              {L('This browser learns on', 'Trình duyệt này học trên')}: {al.markets.join(', ') || L('nothing yet', 'chưa có')}
              {al.markets.length && !al.markets.some((m) => !m.includes('/'))
                ? L(' (stocks need an Alpaca paper key here; the server covers them).', ' (cổ phiếu cần khóa Alpaca thử nghiệm; máy chủ đã lo phần này).')
                : '.'}{' '}
              {L('The server uses the default AI rules.', 'Máy chủ dùng quy tắc AI mặc định.')}
            </p>
          </div>
        </>
      )}

      {tab === 'learned' && <Learned al={al} rules={rules} liveScore={liveScore} symbol={symbol} L={L} when={when} lang={lang} />}

      {tab === 'arena' && (
        <>
          <div className="al-card">
            <div className="al-kicker">{L('PAPER ARENA · SIMULATED MONEY', 'ĐẤU TRƯỜNG THỬ · TIỀN GIẢ LẬP')}</div>
            <h3 className={arenaEquity(st) >= ARENA_START ? 'up' : 'down'}>${arenaEquity(st).toLocaleString('en-US', { maximumFractionDigits: 0 })}</h3>
            <p className="muted">
              {L(
                `Starts with $10,000 and trades only new bars: AI BUY calls that pass sizing and volatility, one open trade per market, paused after a ${rules.maxDrawdownPct}% drop, and vetoed by the learner once it has data. Each trade closes ${HORIZON} bars later. Separate from your paper account.`,
                `Bắt đầu với 10.000$ và chỉ giao dịch nến mới: lệnh MUA của AI đạt quy tắc khối lượng và biến động, mỗi thị trường một lệnh mở, tạm dừng khi giảm ${rules.maxDrawdownPct}%, và bộ học có quyền bác khi đủ dữ liệu. Mỗi lệnh đóng sau ${HORIZON} nến. Tách biệt với tài khoản thử nghiệm của bạn.`,
              )}
            </p>
          </div>
          <div className="al-tiles">
            <div>
              <span>{L('Return', 'Lợi nhuận')}</span>
              <b className={st.arena.realized >= 0 ? 'up' : 'down'}>{signed((st.arena.realized / ARENA_START) * 100)}</b>
            </div>
            <div>
              <span>{L('Trades', 'Lệnh')}</span>
              <b>{st.arena.n}</b>
            </div>
            <div>
              <span>{L('Win rate', 'Tỷ lệ thắng')}</span>
              <b>{st.arena.n ? pct(st.arena.wins / st.arena.n) : '–'}</b>
            </div>
            <div>
              <span>{L('Open', 'Đang mở')}</span>
              <b>{st.pending.filter((p) => p.notional > 0).length}</b>
            </div>
          </div>
          <p className="muted al-note">
            {L('Skipped', 'Bỏ qua')}: {st.arena.skipped.learner} {L('by the learner (no edge over always-buy)', 'do bộ học (không hơn luôn-mua)')}, {st.arena.skipped.drawdown}{' '}
            {L('by the drawdown gate', 'do cổng sụt giảm')}, {st.arena.skipped.busy} {L('while a trade was open', 'khi đang có lệnh mở')}.
            {st.arena.n < 30 && ` ${L('Under 30 trades is noise, not a record.', 'Dưới 30 lệnh là nhiễu, chưa phải thành tích.')}`}
          </p>
          {st.arena.trades.length > 0 && (
            <table className="al-table">
              <thead>
                <tr>
                  <th>{L('Market', 'Mã')}</th>
                  <th>{L('Opened', 'Mở')}</th>
                  <th>{L('Size', 'Khối lượng')}</th>
                  <th>P/L</th>
                </tr>
              </thead>
              <tbody>
                {[...st.arena.trades].reverse().map((t) => (
                  <tr key={`${t.symbol}${t.openedAt}`}>
                    <td>{t.symbol}</td>
                    <td>{when(t.openedAt * 1000)}</td>
                    <td className="mono">${t.notional.toLocaleString()}</td>
                    <td className={`mono ${t.pnl >= 0 ? 'up' : 'down'}`}>{t.pnl >= 0 ? '+' : '−'}${Math.abs(t.pnl).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === 'report' && <Report al={al} symbol={symbol} L={L} />}

      {tab === 'research' && <LearningPanel />}
    </div>
  )
}

type Lx = (en: string, vi: string) => string

function Report({ al, symbol, L }: { al: AutoLearning; symbol: string; L: Lx }) {
  const st = al.state
  const known = Object.keys(st.stats)
  const [pick, setPick] = useState<string>(known.includes(symbol) ? symbol : 'all')
  const table = statsFor(st, pick === 'all' ? null : pick)
  const base = winRate(table.every_bar)
  const trendLabel = { insufficient: L('insufficient', 'chưa đủ'), improving: L('improving', 'đang tốt lên'), worsening: L('worsening', 'đang xấu đi'), flat: L('flat', 'đi ngang') }
  return (
    <>
      <div className="al-card al-report-head">
        <div className="al-kicker">{L('SIGNAL SUCCESS REPORT', 'BÁO CÁO HIỆU QUẢ TÍN HIỆU')}</div>
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="all">{L('All markets', 'Tất cả thị trường')}</option>
          {known.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <p className="muted al-note">
        {L(
          `Win = price moved the signal's way ${HORIZON} hourly bars later. Avg gain is in the signal's direction. A method only helps if it beats buying every bar. Under 30 tracked is noise.`,
          `Thắng = giá đi đúng hướng tín hiệu sau ${HORIZON} nến giờ. Lãi trung bình tính theo hướng tín hiệu. Một cách chỉ có ích khi hơn việc mua mọi nến. Dưới 30 lần là nhiễu.`,
        )}
      </p>
      {SIGNALS.map((s) => {
        const x = table[s.key]
        const wr = winRate(x)
        const beats = wr != null && base != null && s.key !== 'every_bar' && s.side === 1 && x!.n >= 30 && wr >= base + 0.05
        return (
          <div key={s.key} className={`al-sig ${s.key === 'every_bar' ? 'base' : ''}`}>
            <h4>
              {L(s.en, s.vi)}
              {beats && <em className="up"> {L('beats baseline', 'hơn mốc')}</em>}
            </h4>
            <div className="al-sig-row">
              <div>
                <span>{L('Win rate', 'Tỷ lệ thắng')}</span>
                <b>{pct(wr)}</b>
              </div>
              <div>
                <span>{L('Avg gain', 'Lãi TB')}</span>
                <b className={(avgRet(x) ?? 0) >= 0 ? 'up' : 'down'}>{signed(avgRet(x))}</b>
              </div>
              <div>
                <span>{L('Tracked', 'Đã theo dõi')}</span>
                <b>{x?.n ?? 0}</b>
              </div>
              <div>
                <span>{L('Trend', 'Xu hướng')}</span>
                <b>{trendLabel[trendOf(x)]}</b>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function Learned({ al, rules, liveScore, symbol, L, when, lang }: { al: AutoLearning; rules: AiRules; liveScore: number | null; symbol: string; L: Lx; when: (ms: number | null) => string; lang: string }) {
  const st = al.state
  const [kind, setKind] = useState<'correction' | 'preference'>('correction')
  const [text, setText] = useState('')
  const waiting = st.pending.filter((p) => p.verdict !== 'HOLD').length
  const graded = st.score.right + st.score.wrong
  const lv = learnerView(st)
  const verdict = liveScore == null ? null : decide(st.journal, liveScore, 0.55, rules.learnEdgeMarginPct / 100)

  // log grouped by day, cycles and your notes together, newest first
  const log: LogEntry[] = [...st.log, ...al.notes].sort((a, b) => b.time - a.time).slice(0, 80)
  const days = new Map<string, LogEntry[]>()
  for (const e of log) {
    const d = new Date(e.time).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    days.set(d, [...(days.get(d) ?? []), e])
  }
  const kindLabel = { cycle: L('Market observation', 'Quan sát thị trường'), correction: L('Your correction', 'Bạn sửa'), preference: L('Your preference', 'Sở thích của bạn') }

  return (
    <>
      <div className="al-card al-hero">
        <div>
          <div className="al-kicker">{L('SELF-SCORECARD', 'TỰ CHẤM ĐIỂM')}</div>
          <h3>{graded < 30 ? L('Not enough outcomes', 'Chưa đủ kết quả') : L(`Right ${pct(st.score.right / graded, 0)} of the time`, `Đúng ${pct(st.score.right / graded, 0)} số lần`)}</h3>
        </div>
        <p className="muted">
          {st.score.right} {L('right', 'đúng')} · {st.score.wrong} {L('wrong', 'sai')} · {waiting} {L('waiting', 'đang chờ')}
          <br />
          {L(`AI BUY/SELL calls on new bars, graded ${HORIZON} bars later`, `Lệnh MUA/BÁN của AI trên nến mới, chấm sau ${HORIZON} nến`)}
        </p>
      </div>

      <div className="al-card">
        <div className="al-kicker">{L('THE LEARNER', 'BỘ HỌC')}</div>
        {lv.base ? (
          <>
            <p>
              {L(
                `Always buying won ${pct(lv.base.probability, 0)} of ${lv.base.n} graded AI buys. A score bucket must beat that by ${rules.learnEdgeMarginPct} points (and clear 55%) before the learner says BUY.`,
                `Luôn mua thắng ${pct(lv.base.probability, 0)} trong ${lv.base.n} lệnh MUA của AI đã chấm. Một nhóm điểm phải hơn mức đó ${rules.learnEdgeMarginPct} điểm (và trên 55%) thì bộ học mới nói MUA.`,
              )}
            </p>
            <table className="al-table">
              <thead>
                <tr>
                  <th>{L('Model score', 'Điểm mô hình')}</th>
                  <th>{L('Trades', 'Lệnh')}</th>
                  <th>{L('Learned up', 'Học được: tăng')}</th>
                  <th>{L('Edge', 'Lợi thế')}</th>
                </tr>
              </thead>
              <tbody>
                {lv.rows.map((r) => {
                  const edge = r.learned != null && r.learned >= 0.55 && r.learned >= lv.base!.probability + rules.learnEdgeMarginPct / 100
                  return (
                    <tr key={r.from}>
                      <td>
                        {pct(r.from, 0)}–{pct(r.to, 0)}
                      </td>
                      <td>{r.n}</td>
                      <td>{pct(r.learned)}</td>
                      <td className={edge ? 'up' : 'muted'}>{edge ? L('yes', 'có') : L('no', 'không')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        ) : (
          <p className="muted">
            {L(`Needs ${lv.minTrades} graded AI buys before it reports anything (has ${lv.closedBuys}).`, `Cần ${lv.minTrades} lệnh MUA của AI đã chấm trước khi báo cáo (đang có ${lv.closedBuys}).`)}
          </p>
        )}
        {verdict && (
          <p>
            <b>{symbol}</b>: {L('learner says', 'bộ học nói')} <b className={verdict.signal === 'BUY' ? 'up' : ''}>{verdict.signal}</b> ({verdict.reason})
          </p>
        )}
      </div>

      <div className="al-card">
        <div className="seg al-kind">
          <button className={kind === 'correction' ? 'on' : ''} onClick={() => setKind('correction')}>
            {L('Correction', 'Sửa lỗi')}
          </button>
          <button className={kind === 'preference' ? 'on' : ''} onClick={() => setKind('preference')}>
            {L('Preference', 'Sở thích')}
          </button>
        </div>
        <label className="field">
          <span>{L('Teach the AI', 'Dạy AI')}</span>
          <textarea
            rows={3}
            value={text}
            placeholder={kind === 'correction' ? L('That was wrong because…', 'Lệnh đó sai vì…') : L('I prefer…', 'Tôi thích…')}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button
          className="primary al-save"
          disabled={!text.trim()}
          onClick={() => {
            al.addNote(kind, text)
            setText('')
          }}
        >
          {L('Save learning', 'Lưu bài học')}
        </button>
        <p className="muted al-note">
          {L(
            'Saved in this browser as context in the learning log. Notes do not change the numbers; to change how the AI decides, use Settings > AI rules.',
            'Lưu trong trình duyệt này vào nhật ký học. Ghi chú không thay đổi các con số; để đổi cách AI quyết định, dùng Cài đặt > Quy tắc AI.',
          )}
        </p>
      </div>

      <div className="al-log">
        {days.size === 0 && <p className="muted al-note">{L('The learning log is empty.', 'Nhật ký học đang trống.')}</p>}
        {[...days.entries()].map(([d, es]) => (
          <div key={d}>
            <h4>{d}</h4>
            {es.map((e) => (
              <div key={`${e.kind}${e.time}`} className={`al-entry ${e.kind}`}>
                <div className="al-kicker">
                  {kindLabel[e.kind]} · {when(e.time)}
                </div>
                <p>{L(e.en, e.vi)}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
