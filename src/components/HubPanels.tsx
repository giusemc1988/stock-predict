import type { BriefNode } from '../lib/brief'
import { fmtPct, tone } from '../lib/format'
import { AGENT_COLORS, agentVotes, agreeCount, type AgentVote, type VoteContext } from '../lib/hub'
import { setLang, useLang } from '../lib/i18n'
import type { PickRow } from '../lib/practice'
import { pickSourceLabel } from '../lib/practicePicks'

type Bi = { en: string; vi: string }
const rgb = (i: number, a = 1) => `rgba(${AGENT_COLORS[i].join(',')},${a})`

/** Six dots, one per agent on the sphere, in the sphere's colors: filled agrees, ring disagrees, faint has no data. */
export function AgentDots({ votes, nodes }: { votes: AgentVote[]; nodes: BriefNode[] }) {
  const vi = useLang() === 'vi'
  return (
    <span className="hub-dots" role="img" aria-label={vi ? `${agreeCount(votes)}/6 agent đồng ý` : `${agreeCount(votes)} of 6 agents agree`}>
      {votes.map((v, i) => {
        const name = nodes.find((n) => n.id === v.id)?.name ?? { en: v.id, vi: v.id }
        return <i key={v.id} className={`v-${v.vote}`} style={{ ['--c' as string]: rgb(i) }} title={`${vi ? name.vi : name.en}: ${vi ? v.why.vi : v.why.en}`} />
      })}
    </span>
  )
}

/** The language switch on the hub, the same setting as Settings > Language. */
export function LangSwitch() {
  const lang = useLang()
  return (
    <div className="seg small hub-lang" role="group" aria-label="Language">
      <button className={lang === 'vi' ? 'on' : ''} onClick={() => setLang('vi')}>VI</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
    </div>
  )
}

interface PickProps {
  picks: PickRow[]
  ctx: VoteContext
  nodes: BriefNode[]
  scanOn: boolean
  onOpen: (p: PickRow) => void
  onWhy: (p: PickRow) => void
  onDesk: () => void
}

/** Today's best pick next to the sphere: the scanner's #1 BUY with what each agent thinks of it. */
export function HubBestPick({ picks, ctx, nodes, scanOn, onOpen, onWhy, onDesk }: PickProps) {
  const vi = useLang() === 'vi'
  const L = (b: Bi) => (vi ? b.vi : b.en)
  const top = picks[0]
  if (!top)
    return (
      <section className="hub-pick empty">
        <span className="hub-tag">{vi ? 'Dự đoán tốt nhất hôm nay' : "Today's best pick"}</span>
        <p className="muted">{!scanOn ? (vi ? 'Quét luyện tập đang tắt (Cài đặt > Quy tắc AI).' : 'The practice scan is off (Settings > AI rules).') : vi ? 'Chưa có lệnh MUA nào đạt quy tắc. Jarvis sẽ hiện ở đây khi lần quét tới tìm được.' : 'No BUY call passes the rules yet. It shows here when the next scan finds one.'}</p>
        <div className="bf-acts">
          <button className="btn prime" onClick={onDesk}>{vi ? 'Mở trang Trading' : 'Open Trading'}</button>
        </div>
      </section>
    )
  const votes = agentVotes(top, ctx)
  const n = agreeCount(votes)
  return (
    <section className="hub-pick">
      <header>
        <span className="hub-tag">{vi ? 'Dự đoán tốt nhất hôm nay' : "Today's best pick"}</span>
        <span className="muted small">{L(pickSourceLabel[top.source])}</span>
      </header>
      <button className="hub-sym" onClick={() => onOpen(top)}>
        <b className="mono">{top.symbol}</b>
        <span className={`mono ${tone(top.gainPct ?? 0)}`}>{top.gainPct != null ? fmtPct(top.gainPct) : ''}</span>
      </button>
      <div className="hub-score">
        <div className="hub-bar"><i style={{ width: `${Math.max(4, Math.min(100, top.tradeScore ?? 0))}%` }} /></div>
        <span className="small"><b className="mono">{top.tradeScore != null ? Math.round(top.tradeScore) : '—'}</b> {vi ? 'điểm giao dịch (0-100)' : 'trade score (0-100)'}</span>
      </div>
      <div className="hub-kv">
        <div><span>{vi ? 'Phân tích' : 'Analyst'}</span><b className={top.verdict === 'BUY' ? 'up' : top.verdict === 'SELL' ? 'down' : ''}>{top.verdict ?? '—'}</b></div>
        <div><span>{vi ? 'Khối lượng / TB' : 'Volume vs avg'}</span><b className="mono">{top.volVsAvg != null ? `${top.volVsAvg.toFixed(1)}×` : '—'}</b></div>
        <div><span>{vi ? 'Hạng' : 'Rank'}</span><b className="mono">#{top.place}</b></div>
      </div>
      <div className="hub-agree">
        <span className="small muted">{vi ? `${n}/6 agent đồng ý` : `${n} of 6 agents agree`}</span>
        <div className="hub-chips">
          {votes.map((v, i) => {
            const name = nodes.find((x) => x.id === v.id)?.name
            return (
              <span key={v.id} className={`hub-chip v-${v.vote}`} style={{ ['--c' as string]: rgb(i) }} title={L(v.why)}>
                {name ? L(name) : v.id}
              </span>
            )
          })}
        </div>
      </div>
      <p className="hub-note small muted">{vi ? 'Tín hiệu chưa được chứng minh: Jarvis chưa thắng SPY. Chỉ giao dịch tiền ảo.' : 'Signals are not proven yet: Jarvis has not beaten SPY. Paper trading only.'}</p>
      <div className="bf-acts">
        <button className="btn prime" onClick={onDesk}>{vi ? 'Mở trang Trading' : 'Open Trading'}</button>
        <button className="btn" onClick={() => onWhy(top)}>{vi ? 'Vì sao?' : 'Why?'}</button>
      </div>
    </section>
  )
}

/** The prediction board: every BUY call with its score and the six agent dots. */
export function HubBoard({ picks, ctx, nodes, onOpen, onWhy }: Omit<PickProps, 'onDesk' | 'scanOn'>) {
  const vi = useLang() === 'vi'
  return (
    <section className="bf-card hub-board">
      <header>
        <h3>{vi ? 'Bảng dự đoán' : 'Prediction board'}</h3>
        <span className="muted small">{vi ? 'chấm = 6 agent' : 'dots = 6 agents'}</span>
      </header>
      {!picks.length && <p className="muted">{vi ? 'Chưa có lệnh MUA nào trong lần quét gần nhất.' : 'No BUY calls in the last scan.'}</p>}
      {picks.slice(0, 8).map((p) => {
        const votes = agentVotes(p, ctx)
        return (
          <div key={p.symbol} className="hub-brow">
            <button className="hub-brow-main" onClick={() => onOpen(p)}>
              <b className="mono">{p.symbol}</b>
              <span className="hub-bar"><i style={{ width: `${Math.max(4, Math.min(100, p.tradeScore ?? 0))}%` }} /></span>
              <span className="mono small">{p.tradeScore != null ? Math.round(p.tradeScore) : '—'}</span>
              <AgentDots votes={votes} nodes={nodes} />
            </button>
            <button className="bf-info-btn" onClick={() => onWhy(p)} title={vi ? 'Xem quy trình tín hiệu' : 'View signal flow'}>ℹ</button>
          </div>
        )
      })}
      <p className="bf-source">{vi ? 'Đặc = đồng ý · viền = không · mờ = chưa có dữ liệu. Rê chuột để xem lý do.' : 'Filled = agrees · ring = disagrees · faint = no data. Hover for the reason.'}</p>
    </section>
  )
}

const STUDIO: { k: string; t: Bi; d: Bi; c: string }[] = [
  { k: 'lab', t: { en: 'Media Lab', vi: 'Media Lab' }, d: { en: 'AI or real?', vi: 'AI hay thật?' }, c: '#ff8a6b' },
  { k: 'img', t: { en: 'Image edit', vi: 'Sửa hình' }, d: { en: 'Remove bg, covers', vi: 'Xóa nền, ảnh bìa' }, c: '#4fe0c0' },
  { k: 'vid', t: { en: 'Video edit', vi: 'Sửa video' }, d: { en: 'Cut, captions', vi: 'Cắt, phụ đề' }, c: '#f2c45a' },
]

const OUTSIDE: { n: string; url: string; d: Bi }[] = [
  { n: 'Kling', url: 'https://klingai.com', d: { en: 'Text to video, daily free credits', vi: 'Video từ chữ, có credit miễn phí mỗi ngày' } },
  { n: 'CapCut', url: 'https://www.capcut.com', d: { en: 'Free editor, auto captions', vi: 'Sửa video miễn phí, phụ đề tự động' } },
  { n: 'OpusClip', url: 'https://www.opus.pro', d: { en: 'Long video to short clips', vi: 'Cắt video dài thành clip ngắn' } },
  { n: 'Gemini', url: 'https://gemini.google.com', d: { en: 'Make and edit images', vi: 'Tạo và sửa hình' } },
]

/** Studio: the creative tools around the predictor. The in-app tools come in later steps; the outside tools open in a new tab. */
export function HubStudio() {
  const vi = useLang() === 'vi'
  const L = (b: Bi) => (vi ? b.vi : b.en)
  return (
    <section className="bf-card hub-studio" id="hub-studio">
      <header>
        <h3>Studio</h3>
        <span className="muted small">{vi ? 'sắp có' : 'coming soon'}</span>
      </header>
      <div className="hub-tools">
        {STUDIO.map((s) => (
          <div key={s.k} className="hub-tool" style={{ ['--k' as string]: s.c }} aria-disabled="true">
            <b>{L(s.t)}</b>
            <span>{L(s.d)}</span>
            <em>{vi ? 'Sắp có' : 'Soon'}</em>
          </div>
        ))}
      </div>
      <details className="hub-outside">
        <summary>{vi ? 'Tool tốt nhất bên ngoài (mở tab mới)' : 'Best outside tools (new tab)'}</summary>
        {OUTSIDE.map((o) => (
          <a key={o.n} href={o.url} target="_blank" rel="noreferrer noopener">
            <b>{o.n}</b>
            <span>{L(o.d)}</span>
          </a>
        ))}
        <p className="bf-source">{vi ? 'Giới hạn miễn phí do các hãng đặt và hay thay đổi.' : 'Free limits are set by each company and change often.'}</p>
      </details>
    </section>
  )
}

const DEVICES: { k: string; t: Bi; d: Bi; agent?: boolean }[] = [
  { k: 'esp32', t: { en: 'ESP32 price screen', vi: 'ESP32 màn hình giá' }, d: { en: 'Not connected yet', vi: 'Chưa kết nối' } },
  { k: 'bay', t: { en: 'BayReady', vi: 'BayReady' }, d: { en: 'Your AI agent: Jarvis sends tasks and gets results by API', vi: 'AI agent của anh: Jarvis gửi việc và nhận kết quả qua API' }, agent: true },
  { k: 'net', t: { en: 'Home network', vi: 'Mạng nhà' }, d: { en: 'Device list, Wi-Fi channels, speed test', vi: 'Danh sách thiết bị, kênh Wi-Fi, đo tốc độ' } },
  { k: 'ble', t: { en: 'Nearby Bluetooth', vi: 'Bluetooth gần đây' }, d: { en: 'Find a lost device', vi: 'Tìm đồ bị lạc' } },
  { k: 'ruview', t: { en: 'RuView sensing', vi: 'RuView cảm biến' }, d: { en: 'Presence at home from Wi-Fi signals, no camera (beta)', vi: 'Biết có người trong nhà bằng sóng Wi-Fi, không camera (beta)' }, agent: true },
]

/** Projects, devices and home network: what the hub will connect to. Each one is set up in a later step. */
export function HubDevices() {
  const vi = useLang() === 'vi'
  const L = (b: Bi) => (vi ? b.vi : b.en)
  return (
    <section className="bf-card hub-devices" id="hub-devices">
      <header>
        <h3>{vi ? 'Dự án, thiết bị và mạng nhà' : 'Projects, devices & home network'}</h3>
        <span className="muted small">{vi ? 'chỉ của anh' : 'yours only'}</span>
      </header>
      {DEVICES.map((d) => (
        <div key={d.k} className={`hub-dev${d.agent ? ' agent' : ''}`}>
          <i className="led" />
          <div>
            <b>{L(d.t)}</b>
            <span>{L(d.d)}</span>
          </div>
          <em>{vi ? 'Sắp có' : 'Soon'}</em>
        </div>
      ))}
      <p className="bf-source">{vi ? 'Chỉ dùng cho mạng và thiết bị của anh. Không có công cụ tấn công.' : 'For your own network and devices only. No attack tools.'}</p>
    </section>
  )
}

/** Phone tab bar for the hub. */
export function HubTabbar({ onDesk }: { onDesk: () => void }) {
  const vi = useLang() === 'vi'
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <nav className="hub-tabbar" aria-label={vi ? 'Điều hướng hub' : 'Hub navigation'}>
      <button className="on" onClick={() => go('hub-top')}><i />{vi ? 'Dự đoán' : 'Predict'}</button>
      <button onClick={onDesk}><i />Trading</button>
      <button onClick={() => go('hub-studio')}><i />Studio</button>
      <button onClick={() => go('hub-devices')}><i />{vi ? 'Thiết bị' : 'Devices'}</button>
    </nav>
  )
}
