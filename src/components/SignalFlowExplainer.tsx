/**
 * Signal Flow Explainer: Shows the 6-step decision flow for why a signal passed.
 * Each step explains what was checked and whether it passed.
 */
import { pickSourceLabel } from '../lib/practicePicks'
import { fmtPct } from '../lib/format'
import { useLang } from '../lib/i18n'

interface Signal {
  symbol: string
  source: 'watchlist' | 'gainer' | 'active' | 'loser'
  gainPct: number | null
  volVsAvg: number | null
  tradeScore: number | null
  place: number | null
  analysis?: { score: number; verdict: 'BUY' | 'SELL' | 'HOLD' } | null
  rank?: number
  price?: number
  dollarVol?: number
  asset?: 'stock' | 'crypto'
  probUp?: number | null
  barTime?: number
}

interface Props {
  signal: Signal
  of: number
  onClose: () => void
}

export function SignalFlowExplainer({ signal, of, onClose }: Props) {
  const lang = useLang()
  const vi = lang === 'vi'
  const L = (b: { en: string; vi: string }) => (vi ? b.vi : b.en)
  const whyParts: { en: string; vi: string }[] = [{ en: `#${signal.place} of ${of} BUY calls`, vi: `hạng ${signal.place}/${of} lệnh MUA` }]
  if (signal.gainPct != null) whyParts.push({ en: `${signal.gainPct >= 0 ? '+' : ''}${signal.gainPct.toFixed(1)}% today`, vi: `${signal.gainPct >= 0 ? '+' : ''}${signal.gainPct.toFixed(1)}% hôm nay` })
  if (signal.volVsAvg != null) whyParts.push({ en: `volume ${signal.volVsAvg.toFixed(1)}x normal`, vi: `khối lượng ${signal.volVsAvg.toFixed(1)}x bình thường` })
  if (signal.tradeScore != null) whyParts.push({ en: `Trade Score ${signal.tradeScore}`, vi: `Điểm GD ${signal.tradeScore}` })
  whyParts.push({ en: `from ${L(pickSourceLabel[signal.source])}`, vi: `từ ${L(pickSourceLabel[signal.source])}` })
  const why = { en: whyParts.map((p) => p.en).join(', '), vi: whyParts.map((p) => p.vi).join(', ') }

  const steps = [
    {
      num: 1,
      name: L({ en: 'Scan', vi: 'Quét' }),
      desc: L({
        en: `Found ${signal.symbol} from ${L(pickSourceLabel[signal.source])}`,
        vi: `Tìm thấy ${signal.symbol} từ ${L(pickSourceLabel[signal.source])}`,
      }),
      pass: true,
    },
    {
      num: 2,
      name: L({ en: 'Filter', vi: 'Lọc' }),
      desc: L({
        en: `AI signal: BUY (from technical analysis, score ${signal.analysis?.score.toFixed(2) ?? '—'})`,
        vi: `Tín hiệu AI: MUA (từ phân tích kỹ thuật, điểm ${signal.analysis?.score.toFixed(2) ?? '—'})`,
      }),
      pass: signal.analysis?.verdict === 'BUY',
    },
    {
      num: 3,
      name: L({ en: 'Score', vi: 'Điểm số' }),
      desc: L({
        en: `Trade Score ${signal.tradeScore ?? '—'} (50%), volume ${signal.volVsAvg?.toFixed(1) ?? '—'}x (25%), gain ${fmtPct(signal.gainPct ?? 0)} (25%)`,
        vi: `Điểm GD ${signal.tradeScore ?? '—'} (50%), khối lượng ${signal.volVsAvg?.toFixed(1) ?? '—'}x (25%), lợi ${fmtPct(signal.gainPct ?? 0)} (25%)`,
      }),
      pass: (signal.rank ?? 0) >= 0,
    },
    {
      num: 4,
      name: L({ en: 'Confirm', vi: 'Xác nhận' }),
      desc: L({
        en: `Ranked #${signal.place} of ${of} BUY calls (best first)`,
        vi: `Xếp hạng #${signal.place}/${of} lệnh MUA (tốt nhất trước)`,
      }),
      pass: (signal.place ?? 0) > 0,
    },
    {
      num: 5,
      name: L({ en: 'Risk check', vi: 'Kiểm tra rủi ro' }),
      desc: L({
        en: `Price $${(signal.price ?? 0).toFixed(2)}, liquidity $${(signal.dollarVol ?? 0).toLocaleString()}`,
        vi: `Giá $${(signal.price ?? 0).toFixed(2)}, thanh khoản $${(signal.dollarVol ?? 0).toLocaleString()}`,
      }),
      pass: true,
    },
    {
      num: 6,
      name: L({ en: 'Decision', vi: 'Quyết định' }),
      desc: L({
        en: 'Passed all checks — ready to trade (if practice mode is on)',
        vi: 'Vượt qua tất cả kiểm tra — sẵn sàng giao dịch (nếu chế độ luyện tập đang bật)',
      }),
      pass: true,
    },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content signal-flow" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>
            {signal.symbol} — {L({ en: 'Signal Flow', vi: 'Dòng quy trình tín hiệu' })}
          </h2>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </header>

        <section className="signal-summary">
          <div>
            <b>{vi ? 'Tôi tại sao chọn đây:' : 'Why I picked this:'}</b>
            <p>{why[lang === 'vi' ? 'vi' : 'en']}</p>
          </div>
        </section>

        <section className="signal-steps">
          {steps.map((step) => (
            <div key={step.num} className={`step ${step.pass ? 'pass' : 'fail'}`}>
              <div className="step-header">
                <span className={`step-num ${step.pass ? 'pass' : 'fail'}`}>{step.num}</span>
                <span className="step-name">{step.name}</span>
                <span className="step-badge">{step.pass ? (vi ? '✓ Đạt' : '✓ Pass') : vi ? '✗ Thất bại' : '✗ Fail'}</span>
              </div>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </section>

        <section className="signal-info">
          <div className="info-row">
            <span className="label">{vi ? 'Loại tài sản' : 'Asset'}</span>
            <span className="value">{signal.asset === 'stock' ? vi ? 'Cổ phiếu' : 'Stock' : 'Crypto'}</span>
          </div>
          <div className="info-row">
            <span className="label">{vi ? 'Học viên' : 'Learner'}</span>
            <span className="value">{signal.probUp != null ? (vi ? `Xác suất lên ${(signal.probUp * 100).toFixed(0)}%` : `Up prob ${(signal.probUp * 100).toFixed(0)}%`) : vi ? 'Chưa học' : 'Not trained'}</span>
          </div>
          <div className="info-row">
            <span className="label">{vi ? 'Dữ liệu' : 'Data'}</span>
            <span className="value mono">{signal.barTime ? new Date(signal.barTime * 1000).toLocaleTimeString() : '—'}</span>
          </div>
        </section>

        <footer>
          <button className="btn" onClick={onClose}>
            {vi ? 'Đóng' : 'Close'}
          </button>
        </footer>
      </div>
    </div>
  )
}
