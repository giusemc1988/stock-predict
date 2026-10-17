import { useMemo, useState } from 'react'
import type { AlpacaDataKeys, MarketListRow } from '../data/providers'
import type { AiRules } from '../lib/aiRules'
import type { LearnState } from '../lib/autoLearn'
import { briefFacts, briefKey, briefNodes, buyCalls, hhmm, type BriefInputs, type NodeId } from '../lib/brief'
import { fmtCompact, fmtPct, fmtUsd, tone } from '../lib/format'
import { useLang } from '../lib/i18n'
import { greeting } from '../lib/jarvis'
import { dayKey, practiceEquity, PRACTICE_START, type PickRow, type PracticeState } from '../lib/practice'
import { pickSourceLabel } from '../lib/practicePicks'
import { canSpeak, loadVoicePrefs, speak } from '../lib/speech'
import { useBriefText } from '../hooks/useBriefText'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useMarketLists } from '../hooks/useMarketLists'
import type { PracticeScan } from '../hooks/usePractice'
import { BrainCore } from './BrainCore'
import { ScoreboardPanel } from './ScoreboardPanel'
import { SignalFlowExplainer } from './SignalFlowExplainer'
import { AgentReadiness } from './AgentReadiness'
import { LocalAiQA } from './LocalAiQA'
import { NewsBox } from './NewsBox'
import { HubBestPick, HubBoard, HubDevices, HubStudio, HubTabbar, LangSwitch } from './HubPanels'
import type { VoteContext } from '../lib/hub'
import { useNews } from '../hooks/useNews'

interface Props {
  rules: AiRules
  alpacaKeys: AlpacaDataKeys
  flow: { symbol: string; buyShare: number | null; live: boolean; source: string; estimated: boolean }
  practice: PracticeState
  /** Live price of a market (0 when unknown), for the scoreboard's open P&L. */
  priceOf?: (symbol: string) => number
  scan: PracticeScan
  serverMode: boolean
  learn: LearnState
  dayPL: number
  lossLimit: number
  lossLimitOn: boolean
  killSwitch: boolean
  /** Open the screen that holds a node's data. */
  onNode: (id: NodeId) => void
  /** Open a market's chart on the Trading desk. */
  onSymbol: (symbol: string, asset: 'stock' | 'crypto') => void
  onDesk: () => void
  /** Open the Wi-Fi & Bluetooth page (undefined when it is switched off). */
  onNet?: () => void
  onRuview?: () => void
}

function Movers({ title, rows, vol, onPick }: { title: string; rows: MarketListRow[]; vol?: boolean; onPick: (r: MarketListRow) => void }) {
  return (
    <div className="bf-movers">
      <h4>{title}</h4>
      {rows.slice(0, 5).map((r) => (
        <button key={r.symbol} className="bf-row" onClick={() => onPick(r)}>
          <b className="mono">{r.symbol}</b>
          {vol && r.dollarVolume ? <span className="mono muted">${fmtCompact(r.dollarVolume)}</span> : <span className={`mono ${tone(r.changePct)}`}>{fmtPct(r.changePct)}</span>}
        </button>
      ))}
    </div>
  )
}

/** The home page: Jarvis's spoken brief, its second brain and agents, today's picks, the live movers and progress. Every number is real. */
export function JarvisBrief(p: Props) {
  const lang = useLang()
  const vi = lang === 'vi'
  const L = (b: { en: string; vi: string }) => (vi ? b.vi : b.en)
  const [name] = useLocalStorage('arc.jarvisName.v1', 'Chanh')
  const lists = useMarketLists(true, p.alpacaKeys)
  const [moverTab, setMoverTab] = useState<'stock' | 'crypto'>(lists.stocksNeedKey ? 'crypto' : 'stock')
  const [showSignalFlow, setShowSignalFlow] = useState<PickRow | null>(null)
  const [showReadiness, setShowReadiness] = useState(false)
  const now = lists.updatedAt ?? 0
  const today = dayKey(Date.now())
  const learnIn = {
    cycles: p.learn.cycles,
    lastCycle: p.learn.lastCycle,
    lessonsToday: p.learn.log.filter((l) => l.kind !== 'cycle' && dayKey(l.time) === today).length,
    right: p.learn.score.right,
    wrong: p.learn.score.wrong,
  }
  const hello = greeting(name, p.practice, p.killSwitch)
  const buys = buyCalls(p.scan.candidates)
  const memory = p.learn.journal.length + p.practice.trades.length + p.learn.log.length
  const [spoke, setSpoke] = useState<string | null>(null)
  const listen = () => {
    if (!canSpeak()) return setSpoke(vi ? 'Trình duyệt này không đọc được.' : 'This browser cannot read aloud.')
    setSpoke(null)
    void speak(brief.text, loadVoicePrefs(), lang, speechSynthesis.getVoices())
  }
  const time = (ms: number | null) => (ms ? hhmm(ms) : '—')
  const moverRows = moverTab === 'stock' ? lists.stocks : lists.crypto
  const openRow = (r: MarketListRow) => p.onSymbol(r.symbol, r.assetClass)
  const openSignalFlow = (signal: PickRow) => setShowSignalFlow(signal)
  const watchedSymbols = useMemo(() => buys.map((b) => b.symbol), [buys])
  const news = useNews(watchedSymbols, p.rules.newsEnabled)
  const inputs: BriefInputs = {
    now: Date.now(),
    lists,
    flow: p.flow,
    scan: { on: p.rules.practiceMode && (p.rules.practiceAutoPick || p.serverMode), at: p.scan.at, busy: p.scan.busy, candidates: p.scan.candidates, noStockData: p.scan.noStockData, server: p.serverMode },
    learn: learnIn,
    risk: { dayPL: p.dayPL, lossLimit: p.lossLimit, lossLimitOn: p.lossLimitOn, killSwitch: p.killSwitch },
    news: { items: news, enabled: p.rules.newsEnabled },
  }
  const nodes = briefNodes(inputs)
  const facts = briefFacts(inputs)
  const key = briefKey(inputs, lang)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFacts = useMemo(() => facts, [key, now])
  // the AI waits for the first market lists, so it is not asked about an empty page
  const ready = lists.updatedAt != null
  const brief = useBriefText(p.rules.briefAi && p.rules.jarvisCloudAi && ready, stableFacts, key, lang, p.rules.localAiOn && ready)

  const briefBlock = (
        <div className="bf-brief">
          <div className="bf-status">
            <span className={`bf-wave${p.scan.busy || brief.writing ? ' on' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            {p.scan.busy ? (vi ? 'Đang quét thị trường…' : 'Scanning the market…') : brief.writing ? (vi ? 'Đang viết bản tin…' : 'Writing the brief…') : `${vi ? 'Lần quét gần nhất' : 'Last scan'} ${time(p.scan.at)}`}
          </div>
          <h1>{L(hello).split('. ')[0]}.</h1>
          <p className="bf-text">{brief.text}</p>
          <p className="bf-src muted">
            {brief.by ? (vi ? `Viết bởi ${brief.by} từ dữ liệu bên dưới.` : `Written by ${brief.by} from the data below.`) : vi ? 'Ghép từ dữ liệu thật bên dưới.' : 'Put together from the real data below.'}
          </p>
          <div className="bf-acts">
            <button className="btn prime" onClick={listen}>
              ▶ {vi ? 'Nghe bản tin' : 'Hear my brief'}
            </button>
            <button className="btn" onClick={() => p.onNode('learner')}>
              {vi ? 'Hỏi Jarvis' : 'Ask Jarvis'}
            </button>
            <button className="btn" onClick={() => setShowReadiness(true)}>
              {vi ? 'Sẵn sàng ngày mai?' : 'Ready for tomorrow?'}
            </button>
            <button className="btn" onClick={p.onDesk}>
              {vi ? 'Mở Bàn giao dịch' : 'Open Trading desk'}
            </button>
          </div>
          {spoke && <p className="muted small">{spoke}</p>}
          <div className="bf-mood">
            <div>
              <b className="mono">{buys.length}</b>
              <span>{vi ? 'Lệnh MUA hôm nay' : 'BUY calls now'}</span>
            </div>
            <div>
              <b className={`mono ${tone(practiceEquity(p.practice) - PRACTICE_START)}`}>{fmtUsd(practiceEquity(p.practice))}</b>
              <span>{vi ? 'Tài khoản luyện tập' : 'Practice account'}</span>
            </div>
            <div>
              <b className="mono">{p.lossLimitOn && p.lossLimit > 0 ? `${Math.round((Math.max(0, -p.dayPL) / p.lossLimit) * 100)}%` : '—'}</b>
              <span>{vi ? 'giới hạn lỗ đã dùng' : 'of loss limit used'}</span>
            </div>
          </div>
        </div>
  )
  const core = (
        <BrainCore nodes={nodes} memory={memory} thinking={p.scan.busy || brief.writing} motion={p.rules.jarvisMotion} onNode={p.onNode} />
  )
  const picksCard = (
        <section className="bf-card">
          <header>
            <h3>{vi ? 'Lựa chọn hôm nay' : "Today's picks"}</h3>
            <span className="muted small">{time(p.scan.at)}</span>
          </header>
          <p className="bf-source">
            {vi ? "Nguồn" : "Source"}: {p.serverMode ? (vi ? "máy chủ luyện tập, quét mã biến động hôm nay" : "server practice scan of today's movers") : vi ? "quét luyện tập trong trình duyệt" : "practice scan in this browser"}
          </p>
          {!inputs.scan.on && <p className="warn">{vi ? 'Quét luyện tập đang tắt (Cài đặt > Quy tắc AI).' : 'The practice scan is off (Settings > AI rules).'}</p>}
          {inputs.scan.on && !p.scan.at && <p className="muted">{p.scan.busy ? (vi ? 'Đang quét…' : 'Scanning…') : vi ? 'Chưa có lần quét nào.' : 'No scan yet.'}</p>}
          {p.scan.at && !buys.length && <p className="muted">{vi ? 'Lần quét gần nhất không có lệnh MUA nào đạt quy tắc.' : 'The last scan found no BUY call that passes the rules.'}</p>}
          {p.scan.noStockData && <p className="warn">{vi ? 'Chưa quét cổ phiếu: cần key Alpaca paper ở trang Danh mục.' : 'Stocks skipped: add an Alpaca paper key on the Portfolio page.'}</p>}
          {buys.slice(0, 8).map((b) => (
            <div key={b.symbol} className="bf-row-group">
              <button className="bf-row pick" onClick={() => p.onSymbol(b.symbol, b.symbol.includes('/') ? 'crypto' : 'stock')}>
                <span className="bf-place mono">#{b.place}</span>
                <b className="mono">{b.symbol}</b>
                <span className="muted small">{L(pickSourceLabel[b.source])}</span>
                <span className={`mono ${tone(b.gainPct ?? 0)}`}>{b.gainPct != null ? fmtPct(b.gainPct) : ''}</span>
                <span className="mono muted">{b.tradeScore != null ? `TS ${Math.round(b.tradeScore)}` : ''}</span>
              </button>
              <button className="bf-info-btn" onClick={() => openSignalFlow(b)} title={vi ? 'Xem quy trình tín hiệu' : 'View signal flow'}>
                ℹ
              </button>
            </div>
          ))}
        </section>
  )
  const moversCard = (
        <section className="bf-card">
          <header>
            <h3>{vi ? 'Biến động thị trường' : 'Market movers'}</h3>
            <div className="seg small">
              <button className={moverTab === 'stock' ? 'on' : ''} onClick={() => setMoverTab('stock')}>
                {vi ? 'Cổ phiếu' : 'Stocks'}
              </button>
              <button className={moverTab === 'crypto' ? 'on' : ''} onClick={() => setMoverTab('crypto')}>
                Crypto
              </button>
            </div>
          </header>
          <p className="bf-source">
            {vi ? 'Nguồn' : 'Source'}: {moverTab === 'stock' ? 'Alpaca market screener' : 'Binance 24h'} · {lists.updatedAt ? time(lists.updatedAt) : vi ? 'đang tải' : 'loading'}
          </p>
          {moverTab === 'stock' && lists.stocksNeedKey && <p className="warn">{vi ? 'Cần key Alpaca paper ở trang Danh mục để có danh sách cổ phiếu trực tiếp.' : 'Add an Alpaca paper key on the Portfolio page for the live stock list.'}</p>}
          {moverTab === 'stock' && lists.stockError && <p className="warn">{lists.stockError}</p>}
          {moverTab === 'crypto' && lists.cryptoError && <p className="warn">{lists.cryptoError}</p>}
          {moverRows && (
            <div className="bf-movers-2">
              <Movers title={vi ? 'Tăng mạnh nhất' : 'Top gainers'} rows={moverRows.gainers} onPick={openRow} />
              <Movers title={vi ? 'Giao dịch nhiều nhất' : 'Most traded'} rows={moverRows.volume} vol onPick={openRow} />
            </div>
          )}
        </section>
  )
  const scoreCard = (
        <ScoreboardPanel practice={p.practice} baseline={p.rules.scoreboardBaseline} priceOf={p.priceOf} />
  )
  const newsCard = (
        <section className="bf-card">
          <NewsBox news={news} enabled={p.rules.newsEnabled} />
        </section>
  )
  const learnerCard = (
        <section className="bf-card">
          <header>
            <h3>{vi ? "Tự học" : "Learner"}</h3>
          </header>
          <p className="bf-source">{vi ? "Nguồn: bộ tự học" : "Source: auto learner"}</p>
          <div className="bf-stats">
            <div>
              <b className="mono">{learnIn.right + learnIn.wrong ? `${Math.round((learnIn.right / (learnIn.right + learnIn.wrong)) * 100)}%` : "—"}</b>
              <span>{vi ? `Đúng (${learnIn.right + learnIn.wrong} lần)` : `Right (${learnIn.right + learnIn.wrong} calls)`}</span>
            </div>
            <div>
              <b className="mono">{learnIn.lessonsToday}</b>
              <span>{vi ? "Bài học hôm nay" : "Lessons today"}</span>
            </div>
            <div>
              <b className="mono">{learnIn.cycles}</b>
              <span>{vi ? "Chu kỳ học" : "Learn cycles"}</span>
            </div>
          </div>
          {p.learn.latest && <p className="bf-lesson">"{L(p.learn.latest)}"</p>}
        </section>
  )
  const qaCard = p.rules.localQA ? (
          <section className="bf-card">
            <LocalAiQA rules={p.rules} practice={p.practice} />
          </section>
  ) : null

  const hub = p.rules.hubLayout
  const voteCtx: VoteContext = { flow: { symbol: p.flow.symbol, buyShare: p.flow.buyShare }, headlines: news.map((n) => n.headline), learner: { right: learnIn.right, wrong: learnIn.wrong }, risk: { killSwitch: p.killSwitch, dayPL: p.dayPL, lossLimit: p.lossLimit, lossLimitOn: p.lossLimitOn } }
  const openPick = (b: PickRow) => p.onSymbol(b.symbol, b.symbol.includes('/') ? 'crypto' : 'stock')

  if (hub)
    return (
      <main className="brief-page hub">
        <div className="hub-head" id="hub-top">
          <span className="hub-hello">{L(hello).split('. ')[0]}.</span>
          <LangSwitch />
        </div>
        <section className="bf-hero hub-hero">
        <BrainCore nodes={nodes} memory={memory} thinking={p.scan.busy || brief.writing} motion={p.rules.jarvisMotion} onNode={p.onNode} />
          <HubBestPick picks={buys} ctx={voteCtx} nodes={nodes} scanOn={inputs.scan.on} onOpen={openPick} onWhy={openSignalFlow} onDesk={p.onDesk} />
        </section>
        <div className="hub-cols">
          <div className="hub-main">
            <HubBoard picks={buys} ctx={voteCtx} nodes={nodes} onOpen={openPick} onWhy={openSignalFlow} />
            {scoreCard}
            {briefBlock}
            <div className="hub-pair">
              {moversCard}
              {newsCard}
            </div>
            <div className="hub-pair">
              {learnerCard}
              {qaCard}
            </div>
          </div>
          <aside className="hub-side">
            <HubStudio />
            <HubDevices onNet={p.onNet} onRuview={p.onRuview} />
          </aside>
        </div>
        <HubTabbar onDesk={p.onDesk} />
        {showSignalFlow && <SignalFlowExplainer signal={showSignalFlow} of={buys.length} onClose={() => setShowSignalFlow(null)} />}
        {showReadiness && <AgentReadiness nodes={nodes} onClose={() => setShowReadiness(false)} />}
      </main>
    )

  return (
    <main className="brief-page">
      <section className="bf-hero">
        {briefBlock}
        {core}
      </section>

      <div className="bf-grid">
        {picksCard}
        {moversCard}
        {scoreCard}
        {newsCard}
        {learnerCard}
        {qaCard}
      </div>

      {showSignalFlow && (
        <SignalFlowExplainer signal={showSignalFlow} of={buys.length} onClose={() => setShowSignalFlow(null)} />
      )}

      {showReadiness && <AgentReadiness nodes={nodes} onClose={() => setShowReadiness(false)} />}
    </main>
  )
}
