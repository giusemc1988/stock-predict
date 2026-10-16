import { fmtUsd, tone } from '../lib/format'
import { practiceReport, type PracticeState } from '../lib/practice'
import { useLang } from '../lib/i18n'
import { scoreboardFigures } from '../lib/scoreboard'

export function ScoreboardPanel({ practice, priceOf, extras }: { practice: PracticeState; priceOf: (symbol: string) => number; extras: boolean }) {
  const lang = useLang()
  const vi = lang === 'vi'
  const rep = practiceReport(practice)
  const fig = scoreboardFigures(practice, priceOf)
  const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}%`
  const clock = (ms: number) => new Date(ms).toLocaleString(vi ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  const recentTrades = practice.trades.slice(-8) // Last 8 trades

  return (
    <section className="bf-card scoreboard">
      <header>
        <h3>{vi ? "Bảng điểm Jarvis" : "Jarvis's Scoreboard"}</h3>
        <span className="muted small">{vi ? "Luyện tập vs Cơ bản" : "Practice vs baseline"}</span>
      </header>
      <p className="bf-source">{vi ? "Nguồn: tài khoản luyện tập" : "Source: practice account"}</p>

      {extras && (
        <div className="scoreboard-grid">
          <div className="score-metric">
            <div className={`score-value mono ${tone(fig.total)}`}>{fmtUsd(fig.total)}</div>
            <div className="score-label">{vi ? "Tổng lãi/lỗ (đã đóng + đang mở)" : "Total P&L (closed + open)"}</div>
            <div className="score-sub mono">
              {pct(fig.totalPct)}
              {fig.openCount > 0 ? (vi ? ` · ${fig.openCount} lệnh đang mở` : ` · ${fig.openCount} open`) : ""}
              {fig.unpriced > 0 ? (vi ? ` · ${fig.unpriced} chưa có giá` : ` · ${fig.unpriced} unpriced`) : ""}
            </div>
          </div>
          <div className="score-metric">
            <div className={`score-value mono ${fig.spyPct == null ? "" : tone(fig.spyPct)}`}>{fig.spyPct == null ? "—" : pct(fig.spyPct)}</div>
            <div className="score-label">{vi ? "Mua giữ SPY từ lúc bắt đầu" : "Buy and hold SPY since start"}</div>
            <div className="score-sub mono">
              {fig.spyAt != null ? (vi ? `Tính lúc ${clock(fig.spyAt)}` : `As of ${clock(fig.spyAt)}`) : vi ? "Có khi tài khoản máy chủ đang chạy" : "Available once the server account runs"}
            </div>
          </div>
          <div className="score-metric">
            <div className={`score-value mono ${fig.vsSpyPct == null ? "" : tone(fig.vsSpyPct)}`}>{fig.vsSpyPct == null ? "—" : `${fig.vsSpyPct >= 0 ? "+" : "−"}${Math.abs(fig.vsSpyPct).toFixed(2)} pt`}</div>
            <div className="score-label">{vi ? "Jarvis so với SPY" : "Jarvis vs SPY"}</div>
            <div className="score-sub mono">{vi ? "Trước phí thoát lệnh" : "Before exit costs"}</div>
          </div>
        </div>
      )}

      <div className="scoreboard-grid">
        <div className="score-metric">
          <div className={`score-value mono ${tone(rep.pnl)}`}>{fmtUsd(rep.pnl)}</div>
          <div className="score-label">{vi ? "P&L luyện tập" : "Practice P&L"}</div>
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

      {rep.n < 30 && (
        <p className="muted small" style={{ marginTop: "8px" }}>
          {vi ? "Dưới 30 lệnh: các con số chưa đáng tin." : "Under 30 trades: the numbers are not reliable yet."}
        </p>
      )}
    </section>
  )
}
