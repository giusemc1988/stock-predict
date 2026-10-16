import { fmtPct, fmtUsd, tone } from '../lib/format'
import { practiceReport, scoreboardNumbers, type PracticeState } from '../lib/practice'
import { hhmm } from '../lib/brief'
import { useLang } from '../lib/i18n'

interface Props {
  practice: PracticeState
  /** Show open P&L and the account against buy-and-hold (Settings > AI rules). */
  baseline?: boolean
  /** Live prices for open positions; the server's last prices fill the gaps. */
  priceOf?: (symbol: string) => number
}

export function ScoreboardPanel({ practice, baseline = true, priceOf }: Props) {
  const lang = useLang()
  const vi = lang === 'vi'
  const rep = practiceReport(practice)
  const sb = scoreboardNumbers(practice, priceOf)
  const b = sb.baseline
  const recentTrades = practice.trades.slice(-8) // Last 8 trades

  return (
    <section className="bf-card scoreboard">
      <header>
        <h3>{vi ? "Bảng điểm Jarvis" : "Jarvis's Scoreboard"}</h3>
        <span className="muted small">{vi ? "Luyện tập vs Cơ bản" : "Practice vs baseline"}</span>
      </header>
      <p className="bf-source">{vi ? "Nguồn: tài khoản luyện tập" : "Source: practice account"}</p>

      {baseline && (
        <div className="scoreboard-vs">
          <div className="score-metric">
            <div className={`score-value mono ${tone(sb.total)}`}>{fmtPct(sb.jarvisPct)}</div>
            <div className="score-label">Jarvis</div>
            <div className="score-sub mono">{vi ? `${fmtUsd(sb.total)} đã đóng + đang mở` : `${fmtUsd(sb.total)} closed + open`}</div>
          </div>
          <div className="score-metric">
            <div className={`score-value mono ${sb.basePct == null ? '' : tone(sb.basePct)}`}>{sb.basePct == null ? '—' : fmtPct(sb.basePct)}</div>
            <div className="score-label">{vi ? `Mua giữ ${b?.symbol ?? 'SPY'}` : `Buy & hold ${b?.symbol ?? 'SPY'}`}</div>
            <div className="score-sub mono">{b ? `${b.start.toFixed(2)} → ${b.last.toFixed(2)}` : vi ? 'chờ máy chủ' : 'waiting for the server'}</div>
          </div>
          <div className="score-metric">
            <div className={`score-value mono ${sb.edgePct == null ? '' : tone(sb.edgePct)}`}>{sb.edgePct == null ? '—' : `${fmtPct(sb.edgePct)}`}</div>
            <div className="score-label">{sb.edgePct == null || Math.abs(sb.edgePct) < 0.005 ? (sb.edgePct == null ? (vi ? 'Chênh lệch' : 'Difference') : vi ? 'Đang hòa' : 'Even so far') : sb.edgePct > 0 ? (vi ? 'Jarvis đang hơn' : 'Jarvis ahead by') : vi ? 'Jarvis đang thua' : 'Jarvis behind by'}</div>
            <div className="score-sub mono">{b ? (vi ? `từ ${hhmm(b.startAt)}` : `since ${hhmm(b.startAt)}`) : '—'}</div>
          </div>
          <div className="score-metric">
            <div className={`score-value mono ${sb.priced ? tone(sb.unrealized) : ''}`}>{sb.open === 0 ? fmtUsd(0) : sb.priced ? fmtUsd(sb.unrealized) : '—'}</div>
            <div className="score-label">{vi ? 'Lãi/lỗ đang mở' : 'Open P&L'}</div>
            <div className="score-sub mono">
              {vi ? `${sb.open} lệnh đang mở` : `${sb.open} open`}
              {sb.priced < sb.open ? (vi ? `, ${sb.open - sb.priced} chưa có giá` : `, ${sb.open - sb.priced} unpriced`) : ''}
            </div>
          </div>
        </div>
      )}

      <div className="scoreboard-grid">
        <div className="score-metric">
          <div className={`score-value mono ${tone(rep.pnl)}`}>{fmtUsd(rep.pnl)}</div>
          <div className="score-label">{vi ? "Lãi/lỗ đã đóng" : "Closed P&L"}</div>
          <div className="score-sub mono">{vi ? `${rep.n} lệnh` : `${rep.n} trades`}</div>
        </div>

        <div className="score-metric">
          <div className="score-value mono">{rep.winRate != null ? `${Math.round(rep.winRate * 100)}%` : "—"}</div>
          <div className="score-label">{vi ? "Tỉ lệ thắng" : "Win rate"}</div>
          <div className="score-sub mono">
            {rep.winRate != null && rep.n > 0
              ? vi
                ? `${Math.round(rep.winRate * rep.n)} thắng / ${rep.n - Math.round(rep.winRate * rep.n)} thua`
                : `${Math.round(rep.winRate * rep.n)} wins / ${rep.n - Math.round(rep.winRate * rep.n)} losses`
              : "—"}
          </div>
        </div>

        <div className="score-metric">
          <div className={`score-value mono ${rep.avgWin ? (rep.avgWin > 0 ? "up" : "down") : ""}`}>
            {rep.avgWin ? fmtUsd(rep.avgWin) : "—"}
          </div>
          <div className="score-label">{vi ? "Trung bình thắng" : "Avg win"}</div>
          <div className="score-sub mono">
            {rep.profitFactor != null ? (vi ? `Tỉ suất lợi nhuận ${rep.profitFactor.toFixed(2)}` : `Profit factor ${rep.profitFactor.toFixed(2)}`) : "—"}
          </div>
        </div>

        <div className="score-metric">
          <div className={`score-value mono ${rep.avgLoss ? (rep.avgLoss < 0 ? "down" : "up") : ""}`}>
            {rep.avgLoss ? fmtUsd(rep.avgLoss) : "—"}
          </div>
          <div className="score-label">{vi ? "Trung bình thua" : "Avg loss"}</div>
          <div className="score-sub mono">
            {rep.n > 0 ? (vi ? `Trung bình/lệnh ${(rep.pnl / rep.n).toFixed(2)}` : `Per trade ${(rep.pnl / rep.n).toFixed(2)}`) : "—"}
          </div>
        </div>
      </div>

      {recentTrades.length > 0 && (
        <div className="scoreboard-trades" style={{ marginTop: "12px" }}>
          <div className="trades-label muted small">{vi ? "Các lệnh gần đây" : "Recent trades"}</div>
          <div className="trades-list">
            {recentTrades.map((trade) => (
              <div key={trade.id} className="trade-row">
                <b className="mono">{trade.symbol}</b>
                <span className="muted small">{trade.info.reason || trade.exitReason}</span>
                <span className={`mono ${tone(trade.pnl)}`}>{fmtUsd(trade.pnl)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rep.n === 0 && (
        <p className="muted small" style={{ marginTop: "8px" }}>
          {vi
            ? "Chưa có lệnh nào đóng. Lệnh trong ngày đóng trước 3:55 chiều giờ New York, lúc đó các ô trên mới có số."
            : "No closed trades yet. Day trades close by 3:55 PM New York time; the boxes above fill in then."}
        </p>
      )}

      {rep.n < 30 && (
        <p className="muted small" style={{ marginTop: "8px" }}>
          {vi ? "Dưới 30 lệnh: các con số chưa đáng tin." : "Under 30 trades: the numbers are not reliable yet."}
        </p>
      )}
    </section>
  )
}
