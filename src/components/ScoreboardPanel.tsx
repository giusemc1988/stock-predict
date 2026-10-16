import { fmtPct, fmtUsd, tone } from '../lib/format'
import { practiceReport, PRACTICE_START, type PracticeState } from '../lib/practice'
import { useLang } from '../lib/i18n'

export function ScoreboardPanel({ practice }: { practice: PracticeState }) {
  const lang = useLang()
  const vi = lang === 'vi'
  const rep = practiceReport(practice)
  const equity = practice.v + practice.realized
  const edgeVsBaseline = equity - PRACTICE_START - (practice.v + practice.realized - PRACTICE_START) * 0.5 // simplified: assume 50% baseline

  return (
    <section className="bf-card scoreboard">
      <header>
        <h3>{vi ? 'Bảng điểm Jarvis' : "Jarvis's Scoreboard"}</h3>
        <span className="muted small">{vi ? 'Luyện tập vs Cơ bản' : 'Practice vs baseline'}</span>
      </header>
      <p className="bf-source">{vi ? 'Nguồn: tài khoản luyện tập' : 'Source: practice account'}</p>

      <div className="scoreboard-grid">
        <div className="score-metric">
          <div className={`score-value mono ${tone(rep.pnl)}`}>{fmtUsd(rep.pnl)}</div>
          <div className="score-label">{vi ? 'P&L luyện tập' : 'Practice P&L'}</div>
          <div className="score-sub mono">{vi ? `${rep.n} lệnh` : `${rep.n} trades`}</div>
        </div>

        <div className="score-metric">
          <div className="score-value mono">{rep.winRate != null ? `${Math.round(rep.winRate * 100)}%` : '—'}</div>
          <div className="score-label">{vi ? 'Tỉ lệ thắng' : 'Win rate'}</div>
          <div className="score-sub mono">
            {rep.winRate != null && rep.n > 0
              ? vi
                ? `${Math.round(rep.winRate * rep.n)} thắng / ${rep.n - Math.round(rep.winRate * rep.n)} thua`
                : `${Math.round(rep.winRate * rep.n)} wins / ${rep.n - Math.round(rep.winRate * rep.n)} losses`
              : '—'}
          </div>
        </div>

        <div className="score-metric">
          <div className={`score-value mono ${rep.avgWin ? (rep.avgWin > 0 ? 'up' : 'down') : ''}`}>
            {rep.avgWin ? fmtUsd(rep.avgWin) : '—'}
          </div>
          <div className="score-label">{vi ? 'Trung bình thắng' : 'Avg win'}</div>
          <div className="score-sub mono">
            {rep.profitFactor != null ? (vi ? `Tỉ suất lợi nhuận ${rep.profitFactor.toFixed(2)}` : `Profit factor ${rep.profitFactor.toFixed(2)}`) : '—'}
          </div>
        </div>

        <div className="score-metric">
          <div className={`score-value mono ${rep.avgLoss ? (rep.avgLoss < 0 ? 'down' : 'up') : ''}`}>
            {rep.avgLoss ? fmtUsd(rep.avgLoss) : '—'}
          </div>
          <div className="score-label">{vi ? 'Trung bình thua' : 'Avg loss'}</div>
          <div className="score-sub mono">
            {rep.n > 0 ? (vi ? `Trung bình/lệnh ${(rep.pnl / rep.n).toFixed(2)}` : `Per trade ${(rep.pnl / rep.n).toFixed(2)}`) : '—'}
          </div>
        </div>
      </div>

      {rep.n < 30 && (
        <p className="muted small" style={{ marginTop: '8px' }}>
          {vi ? 'Dưới 30 lệnh: các con số chưa đáng tin.' : 'Under 30 trades: the numbers are not reliable yet.'}
        </p>
      )}
    </section>
  )
}
