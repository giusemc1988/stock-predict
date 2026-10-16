/**
 * Agent Readiness: Shows status of each agent (Scanner, Order flow, Signals, Learner, Risk guard, News)
 * for tomorrow's trading readiness check.
 */
import type { BriefNode } from '../lib/brief'
import { useLang } from '../lib/i18n'

interface Props {
  nodes: BriefNode[]
  onClose: () => void
}

export function AgentReadiness({ nodes, onClose }: Props) {
  const lang = useLang()
  const vi = lang === 'vi'

  const statusColor = (status: 'live' | 'missing' | 'off') => {
    switch (status) {
      case 'live':
        return 'green'
      case 'missing':
        return 'amber'
      case 'off':
        return 'gray'
    }
  }

  const statusLabel = (status: 'live' | 'missing' | 'off') => {
    switch (status) {
      case 'live':
        return vi ? 'Trực tiếp' : 'Live'
      case 'missing':
        return vi ? 'Thiếu dữ liệu' : 'Missing data'
      case 'off':
        return vi ? 'Tắt' : 'Off'
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content agent-readiness" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{vi ? 'Sẵn sàng cho ngày mai' : 'Tomorrow\'s Readiness Check'}</h2>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </header>

        <section className="readiness-list">
          <p className="readiness-intro">{vi ? 'Trạng thái của 6 trợ lý hôm nay:' : 'Status of your 6 helpers today:'}</p>
          {nodes.map((node) => (
            <div key={node.id} className={`agent-row status-${statusColor(node.status)}`}>
              <div className="agent-header">
                <span className={`agent-dot status-${statusColor(node.status)}`} />
                <span className="agent-name">{node.name[lang === 'vi' ? 'vi' : 'en']}</span>
                <span className={`agent-status status-${statusColor(node.status)}`}>{statusLabel(node.status)}</span>
              </div>
              <p className="agent-note">{node.note[lang === 'vi' ? 'vi' : 'en']}</p>
              <p className="agent-source muted small">{node.source}</p>
              {node.load > 0 && <div className="agent-load" style={{ width: `${node.load * 100}%` }} />}
            </div>
          ))}
        </section>

        <section className="readiness-tips">
          <h3>{vi ? 'Để sẵn sàng giao dịch ngày mai:' : 'To be ready for tomorrow\'s trading:'}</h3>
          <ul>
            <li>{vi ? 'Bật quét luyện tập (Cài đặt > Quy tắc AI)' : 'Enable practice scan (Settings > AI rules)'}</li>
            <li>{vi ? 'Thêm key Alpaca paper để quét cổ phiếu' : 'Add Alpaca paper key to scan stocks'}</li>
            <li>{vi ? 'Kiểm tra kết nối internet cho dữ liệu thị trường' : 'Check internet for market data'}</li>
            <li>{vi ? 'Thiết lập giới hạn lỗ hàng ngày' : 'Set your daily loss limit'}</li>
          </ul>
        </section>

        <footer>
          <button className="btn" onClick={onClose}>
            {vi ? 'Đã hiểu' : 'Got it'}
          </button>
        </footer>
      </div>
    </div>
  )
}
