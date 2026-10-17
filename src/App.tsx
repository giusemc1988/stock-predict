import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Candle, Instrument, Timeframe } from './types'
import { TIMEFRAMES } from './types'
import { INSTRUMENTS } from './data/instruments'
import type { ApiKeys } from './data/providers'
import type { BrokerMode, BrokerOrder, OrderRequest } from './broker/types'
import type { AlpacaKeys } from './broker/alpaca'
import { useLocalStorage } from './hooks/useLocalStorage'
import { ResizeHandle } from './components/ResizeHandle'
import { useMarketData } from './hooks/useMarketData'
import { useQuotes } from './hooks/useQuotes'
import { useBroker } from './hooks/useBroker'
import { useOrderFlow } from './hooks/useOrderFlow'
import { useJarvisRouter } from './hooks/useJarvisRouter'
import { getJarvisConfig } from './lib/jarvisConfig'
import { runStrategy } from './lib/strategy'
import { blocking, riskGates } from './lib/riskGates'
import { analyze } from './lib/analyst'
import { fmtPrice, fmtUsd } from './lib/format'
import { TopBar, type Page } from './components/TopBar'
import { JarvisBrief } from './components/JarvisBrief'
import type { NodeId } from './lib/brief'
import { Watchlist } from './components/Watchlist'
import { ChartPanel } from './components/ChartPanel'
import { OrderTicket } from './components/OrderTicket'
import { AnalystPanel } from './components/AnalystPanel'
import { OrderFlowPanel } from './components/OrderFlowPanel'
import { BottomPanel } from './components/BottomPanel'
import { PortfolioPage } from './components/PortfolioPage'
import { AutoLearnPanel } from './components/AutoLearnPanel'
import { useAutoLearning } from './hooks/useAutoLearning'
import { useMigrateKeysToCloud } from './hooks/useMigrateKeysToCloud'
import { useLoadKeysFromCloud } from './hooks/useLoadKeysFromCloud'
import { usePractice } from './hooks/usePractice'
import { PracticePanel } from './components/PracticePanel'
import { BrainPanel } from './components/BrainPanel'
import { JarvisFab } from './components/JarvisFab'
import { JarvisAvatar } from './components/JarvisAvatar'
import { JarvisAlert, type JarvisAlertData } from './components/JarvisAlert'
import type { ChartTour } from './components/ChartPanel'
import { analysisTour, dayReplayTour, stockTour, tourSymbols, tradeTour, type Tour } from './lib/jarvis'
import { canSpeak, loadVoicePrefs, speak, stopSpeaking } from './lib/speech'
import { dayKey, kindOf, type PracticeEvent } from './lib/practice'
import { practiceRows } from './lib/practiceRows'
import type { AiActiveRow } from './components/Watchlist'
import type { PracticeOverlay } from './components/ChartPanel'
import { useLang, useT } from './lib/i18n'
import { AIPicks } from './components/AIPicks'
import { WhatsNew } from './components/WhatsNew'
import { SettingsModal } from './components/SettingsModal'
import { AiRulesModal } from './components/AiRulesModal'
import { TradeAlerts } from './components/TradeAlerts'
import { setAiRules, useAiRules } from './lib/aiRules'
import type { JarvisAction } from './lib/jarvisActions'
import { approvedTags, effectiveRules, useSkillStatuses } from './lib/skills'
import { runSkillTests } from './lib/skillTests'
import { logRobot } from './lib/audit'
import { stampData, staleReason } from './lib/dataGuard'
import { Toasts, type Toast } from './components/Toasts'
import { PanelGuard } from './components/PanelGuard'

const NO_CANDLES: Candle[] = []

interface Prefs {
  symbol: string
  tf: Timeframe
  emas: boolean
  forecast: boolean
  robots: boolean
  autoTrade: boolean
  brokerMode: BrokerMode
  lossLimit: number
  lossLimitOn: boolean
  killSwitch: boolean
  equityPeriod: '1D' | '1M' | '3M'
}

const DEFAULT_PREFS: Prefs = {
  symbol: 'BTC/USDT',
  tf: '15m',
  emas: true,
  forecast: true,
  robots: true,
  autoTrade: false,
  brokerMode: 'sim',
  lossLimit: 1000,
  lossLimitOn: true,
  killSwitch: false,
  equityPeriod: '1M',
}

let toastSeq = 0

export default function App() {
  const t = useT()
  const [prefs, setPrefs] = useLocalStorage<Prefs>('bluechip.prefs', DEFAULT_PREFS)
  const [keys, setKeys] = useLocalStorage<ApiKeys>('bluechip.keys', { alphaVantage: '', finnhub: '' })
  const [alpacaKeys, setAlpacaKeys] = useLocalStorage<AlpacaKeys>('bluechip.alpaca', { keyId: '', secret: '' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiRulesOpen, setAiRulesOpen] = useState(false)
  const [planNonce, setPlanNonce] = useState(0)
  const rawRules = useAiRules()
  // only approved skills feed signals: a quarantined or revoked skill is switched off in the rules the AI uses
  const skillStatuses = useSkillStatuses()
  const skillFails = useMemo(() => new Set(runSkillTests().filter((t) => !t.ok).map((t) => t.id)), [])
  const aiRules = useMemo(() => effectiveRules(rawRules, skillStatuses, skillFails), [rawRules, skillStatuses, skillFails])
  const skillTags = useMemo(() => approvedTags(rawRules, skillStatuses, skillFails), [rawRules, skillStatuses, skillFails])
  const [page, setPageRaw] = useState<Page>(() => (rawRules.briefHome && rawRules.jarvisOn ? 'brief' : 'trade'))
  const briefOn = aiRules.briefHome && aiRules.jarvisOn
  const shownPage: Page = page === 'brief' && !briefOn ? 'trade' : page
  const setPage = setPageRaw
  const [sortRequest, setSortRequest] = useState(0)
  const [rightTab, setRightTab] = useState<'ai' | 'flow' | 'trade' | 'learn' | 'picks' | 'practice' | 'brain'>('ai')
  const lang = useLang()
  // the Brain tab disappears when Jarvis is switched off
  const shownTab = (rightTab === 'brain' && !aiRules.jarvisOn) || (rightTab === 'picks' && !aiRules.aiPicksTab) ? 'ai' : rightTab
  const [toasts, setToasts] = useState<Toast[]>([])
  // Tickers added from the search box persist in this browser and join the built-in watchlist.
  const [added, setAdded] = useLocalStorage<Instrument[]>('bluechip.added', [])
  // panel sizes the user dragged to, as % of the window so they scale with it; null = auto size
  const [panes, setPanes] = useLocalStorage<{ left: number | null; right: number | null; bottom: number | null }>('arc.panes.v2', { left: null, right: null, bottom: null })
  const universe = useMemo(() => [...INSTRUMENTS, ...added.filter((a) => !INSTRUMENTS.some((i) => i.symbol === a.symbol))], [added])
  // markets practice mode is watching or trading join the chart and quotes (not your saved watchlist)
  const [aiSymbols, setAiSymbols] = useState<string[]>([])
  // Jarvis "Show me": a guided tour on the chart (its market joins the chart list while it runs)
  const [tour, setTour] = useState<{ t: Tour; i: number } | null>(null)
  // "why AAPL?": the stock asked about opens, and its tour starts once its analysis is ready
  const [askedStock, setAskedStock] = useState<string | null>(null)
  const tourSyms = [...(tour ? tourSymbols(tour.t) : []), ...(askedStock ? [askedStock] : [])].join(',')
  const chartUniverse = useMemo(
    () => [
      ...universe,
      ...[...aiSymbols, ...(tourSyms ? tourSyms.split(',') : []).filter((s) => !aiSymbols.includes(s))]
        .filter((s) => !universe.some((i) => i.symbol === s))
        .map((s): Instrument => ({ symbol: s, name: 'AI practice pick', assetClass: s.includes('/') ? 'crypto' : 'stock', feedId: s.includes('/') ? s.replace('/', '') : s, demoPrice: 100, demoVol: 0.4 })),
    ],
    [universe, aiSymbols, tourSyms],
  )
  const inst = useMemo(() => chartUniverse.find((i) => i.symbol === prefs.symbol) ?? INSTRUMENTS[0], [chartUniverse, prefs.symbol])
  // Auto-migrate keys from localStorage to Cloudflare on first load
  useMigrateKeysToCloud(keys, alpacaKeys)
  // Load keys from Cloudflare KV if localStorage is empty
  useLoadKeysFromCloud(setKeys, setAlpacaKeys)

  const market = useMarketData(inst, prefs.tf, keys, alpacaKeys)
  const quotes = useQuotes(chartUniverse, keys, alpacaKeys)
  const addInstrument = (i: Instrument) => setAdded((list) => (list.some((x) => x.symbol === i.symbol) ? list : [...list, i]))
  const marketCandles = market.key === `${inst.symbol}|${prefs.tf}` ? market.candles : NO_CANDLES
  const flow = useOrderFlow(inst, keys, marketCandles)
  // 24/7 auto learning runs here so it keeps going whichever tab is open (off by default)
  // markets the practice scanner found join the learner (set once the scan below has run)
  const [scannerSyms, setScannerSyms] = useState<string[]>([])
  const autoLearn = useAutoLearning(universe, keys, alpacaKeys, aiRules, scannerSyms)
  const brokerApi = useBroker(prefs.brokerMode, alpacaKeys, prefs.equityPeriod)
  const broker = brokerApi.state
  const jarvisConfig = useMemo(() => getJarvisConfig(), [])
  const jarvisRouter = useJarvisRouter(jarvisConfig.jarvisRouterOn)

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastSeq
    setToasts((s) => [...s.slice(-3), { ...t, id }])
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 6000)
  }, [])

  // ignore candles still in flight for the previously selected symbol/timeframe
  const candles = market.key === `${inst.symbol}|${prefs.tf}` ? market.candles : NO_CANDLES
  const lastClose = candles.length ? candles[candles.length - 1].close : quotes[inst.symbol]?.price ?? 0

  // Signals + backtest run on closed bars only, so robots never flicker on the forming bar.
  const candlesRef = useRef(candles)
  candlesRef.current = candles
  const closedKey = `${inst.symbol}|${prefs.tf}|${candles.length}|${candles[0]?.time ?? 0}`
  const closed = useMemo(() => runStrategy(candlesRef.current.slice(0, -1)), [closedKey])
  // The live prediction/forecast updates with every tick.
  const live = useMemo(() => (candles.length > 40 ? runStrategy(candles).prediction : null), [candles])

  // Call Jarvis router when a bar closes
  useEffect(() => {
    if (candles.length > 1) {
      const closedBar = candles[candles.length - 2]
      const routerCandle = { ...closedBar, timestamp: closedBar.time }
      const routerHistory = candles.slice(0, -1).map((c) => ({ ...c, timestamp: c.time }))
      void jarvisRouter.onBarClose(routerCandle, routerHistory)
    }
  }, [closedKey, jarvisRouter])

  // Re-analyse at most once a second; order flow updates several times a second.
  const flowRef = useRef(flow)
  flowRef.current = flow
  const liveRef = useRef(live)
  liveRef.current = live
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyze>>(null)
  // which market the current analysis is for (Jarvis's "why AAPL?" waits for the right one)
  const [analysisSym, setAnalysisSym] = useState('')
  useEffect(() => {
    const run = () => {
      setAnalysis(analyze(candlesRef.current, closed, liveRef.current, flowRef.current, aiRules))
      setAnalysisSym(candlesRef.current.length ? inst.symbol : '')
    }
    run()
    const id = setInterval(run, 1000)
    return () => clearInterval(id)
  }, [closed, inst.symbol, aiRules])
  const tapeTotal = flow.buyVolume + flow.sellVolume
  const buyShare = tapeTotal ? flow.buyVolume / tapeTotal : null

  const lastSignal = closed.signals.length ? closed.signals[closed.signals.length - 1] : null

  // Daily loss limit: pauses the robot (never your manual orders).
  const limitHit = prefs.lossLimitOn && prefs.lossLimit > 0 && broker.account.dayPL <= -prefs.lossLimit
  const robotPaused = limitHit ? `Paused: today's loss reached your ${fmtUsd(prefs.lossLimit)} daily limit.` : null

  const { place, onPrice, cancel, closePosition, reset } = brokerApi
  const submit = useCallback(
    async (req: OrderRequest, last = lastClose) => {
      const r = await place(req, last)
      if (!r.ok) toast({ tone: 'bad', title: 'Order rejected', body: r.message })
      return r
    },
    [place, lastClose, toast],
  )

  // Robot auto-trade: act only on signals that appear after the series was loaded.
  const seen = useRef<{ key: string; time: number }>({ key: '', time: 0 })
  const positionsRef = useRef(broker.positions)
  positionsRef.current = broker.positions
  const gateRef = useRef({ broker, analysis, prefs, aiRules, feed: market.source, skillTags })
  gateRef.current = { broker, analysis, prefs, aiRules, feed: market.source, skillTags }
  useEffect(() => {
    const k = `${inst.symbol}|${prefs.tf}`
    if (!candles.length) return
    if (seen.current.key !== k) {
      seen.current = { key: k, time: lastSignal?.time ?? 0 }
      return
    }
    if (!lastSignal || lastSignal.time <= seen.current.time) return
    seen.current.time = lastSignal.time
    if (!prefs.autoTrade) return
    if (robotPaused) {
      toast({ tone: 'info', title: `Robot skipped a ${lastSignal.side.toUpperCase()} on ${inst.symbol}`, body: robotPaused })
      return
    }
    const pos = positionsRef.current.find((p) => p.symbol === inst.symbol)
    const qty = lastSignal.side === 'buy' ? (inst.assetClass === 'crypto' ? +(1000 / lastClose).toFixed(5) : 10) : pos?.qty ?? 0
    if (qty > 0) {
      const side = lastSignal.side
      const price = lastClose
      const g = gateRef.current
      // one client id per signal: a retry can't place the same order twice
      const req: OrderRequest = { symbol: inst.symbol, side, type: 'market', qty, tif: 'day', source: 'robot', clientOrderId: `robot-${inst.symbol.replace('/', '')}-${side}-${lastSignal.time}` }
      const tfSec = TIMEFRAMES.find((t) => t.id === prefs.tf)!.seconds
      const data = stampData(g.feed, lastSignal.time, tfSec, Date.now())
      const checks = riskGates(req, price, g.broker, g.analysis, g.prefs, g.aiRules)
      const stale = side === 'buy' && g.aiRules.dataGuardOn ? staleReason(data, tfSec, g.aiRules.maxDataAgeMin) : null
      const blocked = stale ? [{ name: 'Data', level: 'block' as const, message: stale.en }] : blocking(checks)
      const audit = (accepted: boolean, en: string, vi: string, blockedBy?: string) =>
        g.aiRules.auditOn &&
        logRobot({
          time: Date.now(),
          symbol: inst.symbol,
          side,
          accepted,
          en,
          vi,
          price,
          barTime: lastSignal.time,
          data,
          verdict: g.analysis?.verdict,
          tradeScore: g.analysis?.tradeScore?.score ?? null,
          passed: checks.filter((c) => c.level !== 'block').map((c) => c.name),
          ...(blockedBy ? { blockedBy } : {}),
          skills: g.skillTags,
        })
      if (blocked.length) {
        audit(false, `Robot skipped a ${side.toUpperCase()}: ${blocked[0].message}`, `Robot bỏ qua lệnh ${side === 'buy' ? 'MUA' : 'BÁN'}: ${blocked[0].message}`, blocked[0].name)
        toast({ tone: 'info', title: `Robot skipped a ${side.toUpperCase()} on ${inst.symbol}`, body: `${blocked[0].name}: ${blocked[0].message}` })
        return
      }
      submit(req).then((r) => {
        audit(r.ok, r.ok ? `Robot ${side === 'buy' ? 'bought' : 'sold'} ${qty} at about ${fmtPrice(price)}` : `Robot order rejected: ${r.message}`, r.ok ? `Robot ${side === 'buy' ? 'mua' : 'bán'} ${qty} giá khoảng ${fmtPrice(price)}` : `Lệnh robot bị từ chối: ${r.message}`, r.ok ? undefined : 'Broker')
        if (r.ok) toast({ tone: 'info', title: `🤖 Robot ${side === 'buy' ? 'bought' : 'sold'} ${qty} ${inst.symbol}`, body: `Paper order at about ${fmtPrice(price)}` })
      })
    }
  }, [lastSignal, inst, prefs.tf, prefs.autoTrade, candles.length, lastClose, submit, robotPaused, toast])

  // Order status notifications (fills, rejections, cancels), like a real broker app.
  const statuses = useRef<{ mode: BrokerMode; map: Map<string, BrokerOrder['status']> } | null>(null)
  useEffect(() => {
    const prev = statuses.current?.mode === prefs.brokerMode ? statuses.current.map : null
    const next = new Map(broker.orders.map((o) => [o.id, o.status]))
    statuses.current = { mode: prefs.brokerMode, map: next }
    // first load or account switch: just take a baseline
    if (!prev) return
    for (const o of broker.orders) {
      const was = prev.get(o.id)
      if (was === o.status) continue
      const what = `${o.side === 'buy' ? 'Buy' : 'Sell'} ${+o.qty.toFixed(6)} ${o.symbol}${o.legLabel ? ` (${o.legLabel.toLowerCase()})` : ''}`
      if (o.status === 'filled') toast({ tone: 'ok', title: `Filled: ${what}`, body: o.filledPrice ? `at ${fmtPrice(o.filledPrice)}` : undefined })
      else if (o.status === 'rejected') toast({ tone: 'bad', title: `Rejected: ${what}`, body: o.reason })
      else if (o.status === 'canceled' && was) toast({ tone: 'info', title: `Canceled: ${what}`, body: o.reason })
      else if (!was && (o.status === 'open' || o.status === 'held') && !o.parentId) toast({ tone: 'info', title: `Order working: ${what}` })
    }
  }, [broker.orders, toast, prefs.brokerMode])

  // Feed prices to the simulator so working orders can trigger.
  useEffect(() => {
    if (lastClose) onPrice(inst.symbol, lastClose)
  }, [lastClose, inst.symbol, onPrice])
  useEffect(() => {
    for (const q of Object.values(quotes)) if (q.symbol !== inst.symbol) onPrice(q.symbol, q.price)
  }, [quotes, inst.symbol, onPrice])

  const tfLabel = TIMEFRAMES.find((t) => t.id === prefs.tf)!.label

  useEffect(() => {
    document.title = lastClose ? `${inst.symbol} ${lastClose.toLocaleString('en-US', { maximumFractionDigits: 2 })} · Arc Analyst` : 'Arc Analyst'
  }, [inst.symbol, lastClose])

  const select = (symbol: string) => setPrefs((p) => ({ ...p, symbol }))
  const priceOf = (s: string) => (s === inst.symbol ? lastClose : quotes[s]?.price ?? 0)
  const onClose = (pos: { symbol: string }) => closePosition(pos.symbol, priceOf(pos.symbol))

  // Practice mode: the AI paper-trades small on live data in its own practice account
  const [flash, setFlash] = useState<PracticeEvent | null>(null)
  const [jAlert, setJAlert] = useState<JarvisAlertData | null>(null)
  const closeAlert = useCallback(() => setJAlert(null), [])
  const practiceRules = useRef(aiRules)
  practiceRules.current = aiRules
  const langRef = useRef(lang)
  langRef.current = lang
  const onPracticeEvent = useCallback(
    (e: PracticeEvent) => {
      const r = practiceRules.current
      if (r.practiceOnChart) setFlash(e)
      // follow the AI: open the chart of the market it just traded
      if (r.practiceFollow && e.kind !== 'skip') setPrefs((p) => (p.symbol === e.symbol ? p : { ...p, symbol: e.symbol }))
      // Jarvis speaks up about the trade instead of the plain pop-up
      if (r.jarvisOn && r.jarvisAlerts && e.kind !== 'skip') {
        const vi = langRef.current === 'vi'
        const kind = e.trade === 'long' ? (vi ? 'lệnh dài hạn' : 'a longer hold') : vi ? 'lệnh trong ngày' : 'a day trade'
        const amt = e.pnl != null ? `${e.pnl >= 0 ? '+' : '−'}$${Math.abs(e.pnl).toFixed(2)}` : ''
        const text =
          e.kind === 'buy'
            ? vi ? `Tôi vừa mua ${e.symbol}, ${kind}. Muốn xem vì sao không?` : `I just bought ${e.symbol} as ${kind}. Want to see why?`
            : (e.pnl ?? 0) >= 0
              ? vi ? `Tôi vừa đóng ${e.symbol}, lãi ${amt}.` : `I just closed ${e.symbol} for a win, ${amt}.`
              : vi ? `Tôi vừa đóng ${e.symbol}, lỗ ${amt}. Để xem có phải lỗi quy trình không.` : `I just closed ${e.symbol} for a loss, ${amt}. Let's see if it was the process or just luck.`
        setJAlert({ id: e.id, symbol: e.symbol, text, tone: e.kind === 'buy' ? 'buy' : (e.pnl ?? 0) >= 0 ? 'win' : 'loss' })
        if (r.jarvisSpeech && canSpeak()) speak(text, loadVoicePrefs(), langRef.current, speechSynthesis.getVoices())
        return
      }
      if (r.practiceFeed) toast({ tone: e.kind === 'buy' ? 'info' : (e.pnl ?? 0) >= 0 ? 'ok' : 'bad', title: `🎯 ${langRef.current === 'vi' ? 'Luyện tập' : 'Practice'}: ${e.kind === 'buy' ? (langRef.current === 'vi' ? 'MUA' : 'BUY') : langRef.current === 'vi' ? 'BÁN' : 'SELL'} ${e.symbol}`, body: langRef.current === 'vi' ? e.vi : e.en })
    },
    [toast],
  )
  // practice only uses real prices: a simulated quote never moves a practice trade or its P&L
  const livePriceOf = useCallback((s: string) => (quotes[s]?.live ? quotes[s].price : 0), [quotes])
  const onPracticeAway = useCallback(
    (n: number) =>
      toast({
        tone: 'info',
        title: langRef.current === 'vi' ? '🎯 Luyện tập khi bạn vắng mặt' : '🎯 Practice while you were away',
        body: langRef.current === 'vi' ? `Máy chủ đã thực hiện ${n} lệnh mua/bán. Xem trong tab Luyện tập.` : `The server made ${n} buys and sells. See them in the Practice tab.`,
      }),
    [toast],
  )
  const practice = usePractice({
    rules: aiRules,
    symbol: inst.symbol,
    asset: inst.assetClass,
    tf: prefs.tf,
    candles,
    analysis,
    liveScore: live?.probUp ?? null,
    journal: autoLearn.state.journal,
    priceOf: livePriceOf,
    quotesKey: quotes,
    killSwitch: prefs.killSwitch,
    maxTradesPerDay: aiRules.maxTradesPerDay,
    onEvent: onPracticeEvent,
    universe,
    keys,
    alpacaKeys,
    onAway: onPracticeAway,
    feedSource: market.source,
    skills: skillTags,
  })
  const scannerKey = practice.scan.candidates.map((c) => c.symbol).join(',')
  useEffect(() => setScannerSyms(scannerKey ? scannerKey.split(',') : []), [scannerKey])
  // practice trades may be on a different timeframe than the chart: mark the chart bar they fall in
  const snapToBar = (t: number) => {
    let lo = 0
    let hi = candles.length - 1
    if (hi < 0 || t < candles[0].time) return t
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (candles[mid].time <= t) lo = mid
      else hi = mid - 1
    }
    return candles[lo].time
  }
  // "AI active" list pinned at the top of the watchlist: open trades, today's closed trades, today's best picks
  const [todayKey] = useState(() => dayKey(Date.now()))
  const aiActive = useMemo<AiActiveRow[]>(() => {
    const st = practice.state
    const rows: AiActiveRow[] = st.open.map((p) => ({ symbol: p.symbol, status: 'trade', kind: kindOf(p), entry: p.entry, qty: p.qty }))
    for (const t of [...st.trades].reverse())
      if (dayKey(t.closedAt) === todayKey && !rows.some((r) => r.symbol === t.symbol)) rows.push({ symbol: t.symbol, status: 'closed', kind: kindOf(t), pnl: t.pnl })
    for (const c of practice.scan.candidates.filter((c) => c.place != null).slice(0, 5))
      if (!rows.some((r) => r.symbol === c.symbol)) rows.push({ symbol: c.symbol, status: 'watching', place: c.place ?? undefined, gainPct: c.gainPct })
    return rows
  }, [practice.state, practice.scan.candidates, todayKey])
  // practice trades live in their own account: list them in the bottom panel too, tagged, so they aren't invisible there
  const panelPractice = aiRules.practiceMode && aiRules.practiceInPanels ? practiceRows(practice.state, practice.priceOf, Date.now(), aiRules.jarvisOn && aiRules.jarvisStory) : null
  const aiKey = aiRules.practiceMode ? aiActive.map((r) => r.symbol).join(',') : ''
  useEffect(() => setAiSymbols(aiKey ? aiKey.split(',') : []), [aiKey])
  const kindTag = (x: { kind?: 'day' | 'long' }) => (kindOf(x) === 'day' ? (lang === 'vi' ? 'Ngày' : 'Day') : lang === 'vi' ? 'Dài' : 'Long')
  const practiceOverlay: PracticeOverlay | null = !aiRules.practiceOnChart
    ? null
    : {
        markers: [
          ...practice.state.trades
            .filter((x) => x.symbol === inst.symbol)
            .flatMap((x) => [
              { time: x.barTime, side: 'buy' as const, text: kindTag(x) },
              { time: x.exitBarTime, side: 'sell' as const, text: `${kindTag(x)} ${x.pnl >= 0 ? '+' : '−'}$${Math.abs(x.pnl).toFixed(0)}` },
            ]),
          ...practice.state.open.filter((x) => x.symbol === inst.symbol).map((x) => ({ time: x.barTime, side: 'buy' as const, text: kindTag(x) })),
        ].map((m) => ({ ...m, time: snapToBar(m.time) })),
        lines: practice.state.open
          .filter((x) => x.symbol === inst.symbol)
          .flatMap((x) => [
            { price: x.entry, color: '#f0b90b', title: `${kindTag(x)} ${lang === 'vi' ? 'vào' : 'in'}` },
            { price: x.stop, color: '#f6465d', title: `${kindTag(x)} ${lang === 'vi' ? 'cắt lỗ' : 'stop'}` },
            { price: x.target, color: '#0ecb81', title: `${kindTag(x)} ${lang === 'vi' ? 'chốt lời' : 'target'}` },
          ]),
        flash,
        flashText: flash ? (lang === 'vi' ? flash.vi : flash.en) : '',
      }

  const showMeOn = aiRules.jarvisOn && aiRules.jarvisShowMe
  const startTour = useCallback(
    (t: Tour | null) => {
      if (!t || !t.steps.length) return
      setTour({ t, i: 0 })
      setPrefs((p) => ({ ...p, symbol: t.symbol }))
      setPage('trade')
      // on a phone the chart may be scrolled away: bring it into view
      requestAnimationFrame(() => document.querySelector('.chart-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    },
    [setPrefs],
  )
  const endTour = useCallback(() => {
    setTour(null)
    stopSpeaking()
  }, [])
  // the tour ends when Show me is switched off or Escape is pressed
  useEffect(() => {
    if (!tour) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && endTour()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour, endTour])
  const tourStep = tour && showMeOn ? tour.t.steps[tour.i] : null
  // a tour can move between stocks (the day replay): open each step's chart
  const stepSymbol = tour && tourStep ? (tourStep.symbol ?? tour.t.symbol) : ''
  useEffect(() => {
    if (stepSymbol) setPrefs((p) => (p.symbol === stepSymbol ? p : { ...p, symbol: stepSymbol }))
  }, [stepSymbol, setPrefs])
  // each step is read aloud when Jarvis speaks
  const spokenKey = tourStep && aiRules.jarvisSpeech ? `${tour!.t.id}|${tour!.i}|${lang}` : ''
  useEffect(() => {
    if (!spokenKey || !tourStep || !canSpeak()) return
    speak(lang === 'vi' ? tourStep.vi : tourStep.en, loadVoicePrefs(), lang, speechSynthesis.getVoices())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenKey])
  const chartTour: ChartTour | null =
    tour && tourStep && inst.symbol === stepSymbol
      ? {
          key: `${tour.t.id}-${tour.i}`,
          title: lang === 'vi' ? tour.t.title.vi : tour.t.title.en,
          text: lang === 'vi' ? tourStep.vi : tourStep.en,
          index: tour.i,
          total: tour.t.steps.length,
          lines: tourStep.lines,
          focus: tourStep.focus ? { time: snapToBar(tourStep.focus.time), price: tourStep.focus.price } : undefined,
          marker: tourStep.marker ? { ...tourStep.marker, time: snapToBar(tourStep.marker.time) } : undefined,
          backLabel: lang === 'vi' ? 'Lùi' : 'Back',
          nextLabel: lang === 'vi' ? 'Tiếp' : 'Next',
          doneLabel: lang === 'vi' ? 'Xong' : 'Done',
          motion: aiRules.jarvisMotion,
          onBack: () => setTour((x) => (x ? { ...x, i: Math.max(0, x.i - 1) } : x)),
          onNext: () => setTour((x) => (x ? { ...x, i: Math.min(x.t.steps.length - 1, x.i + 1) } : x)),
          onClose: endTour,
        }
      : null
  const showTrade = showMeOn ? (id: string) => {
    const t = [...practice.state.open, ...practice.state.trades].find((x) => x.id === id)
    if (t) startTour(tradeTour(t, practice.state.trades))
  } : undefined
  const showReplay = showMeOn && aiRules.jarvisReplay ? () => startTour(dayReplayTour(practice.state)) : undefined
  const askStock = aiRules.jarvisAnyStock
    ? (symbol: string) => {
        setPrefs((p) => ({ ...p, symbol }))
        if (showMeOn) {
          setTour(null)
          setAskedStock(symbol)
        }
      }
    : undefined
  useEffect(() => {
    if (!askedStock || inst.symbol !== askedStock || analysisSym !== askedStock || !analysis || candles.length < 60) return
    setAskedStock(null)
    startTour(stockTour(analysis, askedStock, candles[candles.length - 1].time, practice.state))
  }, [askedStock, inst.symbol, analysisSym, analysis, candles, startTour, practice.state])
  // Jarvis actions run only from the confirm card in the Brain tab (you tapped "Do it")
  const jarvisAct = aiRules.jarvisActions
    ? (a: JarvisAction) => {
        if (a.kind === 'rule') setAiRules({ ...rawRules, [a.key]: a.value })
        else if (a.kind === 'killSwitch') setPrefs((p) => ({ ...p, killSwitch: a.value }))
        else addInstrument(chartUniverse.find((i) => i.symbol === a.symbol) ?? { symbol: a.symbol, name: a.symbol, assetClass: a.symbol.includes('/') ? 'crypto' : 'stock', feedId: a.symbol.replace('/', ''), demoPrice: 100, demoVol: 0.4 })
      }
    : undefined
  const showAnalysis = showMeOn && analysis && candles.length ? () => startTour(analysisTour(analysis, inst.symbol, candles[candles.length - 1].time)) : undefined

  // Jarvis Brief: each node opens the screen that holds its data
  const openNode = (id: NodeId) => {
    if (id === 'risk') return setPage('portfolio')
    if (id === 'news') return setAiRulesOpen(true)
    setPage('trade')
    if (id === 'scanner') setSortRequest((n) => n + 1)
    else setRightTab(id === 'flow' ? 'flow' : id === 'signals' ? 'practice' : aiRules.jarvisOn ? 'brain' : 'learn')
  }
  const openSymbol = (symbol: string, assetClass: 'stock' | 'crypto') => {
    if (!chartUniverse.some((i) => i.symbol === symbol)) addInstrument({ symbol, name: symbol, assetClass, feedId: assetClass === 'crypto' ? symbol.replace('/', '') : symbol, demoPrice: 100, demoVol: 0.4 })
    select(symbol)
    setPage('trade')
  }

  return (
    <div
      className={`app page-${shownPage}`}
      style={
        aiRules.resizePanels
          ? ({
              ...(panes.left != null && { '--left-w': `max(170px, ${panes.left}vw)` }),
              ...(panes.right != null && { '--right-w': `max(260px, ${panes.right}vw)` }),
              ...(panes.bottom != null && { '--bottom-h': `max(120px, ${panes.bottom}vh)` }),
            } as CSSProperties)
          : undefined
      }
    >
      <WhatsNew />
      <TradeAlerts />
      {aiRules.jarvisOn && aiRules.jarvisFab && (
        <PanelGuard name="Jarvis"><JarvisFab state={practice.state} rules={aiRules} journal={autoLearn.state.journal} learn={autoLearn.state} killSwitch={prefs.killSwitch} priceOf={practice.priceOf} known={chartUniverse} watchlist={universe.map((i) => i.symbol)} onAskStock={askStock} onShowTrade={showTrade} onReplay={showReplay} onAction={jarvisAct} symbol={inst.symbol} /></PanelGuard>
      )}
      {jAlert && aiRules.jarvisOn && aiRules.jarvisAlerts && (
        <JarvisAlert
          alert={jAlert}
          motion={aiRules.jarvisMotion}
          showLabel={lang === 'vi' ? 'Chỉ cho tôi' : 'Show me'}
          onShow={
            showTrade
              ? () => {
                  const st = practice.state
                  const t = [...st.open, ...st.trades].filter((x) => x.symbol === jAlert.symbol).sort((a, b) => b.openedAt - a.openedAt)[0]
                  if (t) showTrade(t.id)
                  closeAlert()
                }
              : undefined
          }
          onClose={closeAlert}
        />
      )}
      <TopBar
        inst={inst}
        quote={quotes[inst.symbol]}
        lastPrice={lastClose}
        tf={prefs.tf}
        onTf={(tf) => setPrefs((p) => ({ ...p, tf }))}
        status={market.status}
        source={market.source}
        error={market.error}
        toggles={{ emas: prefs.emas, forecast: prefs.forecast, robots: prefs.robots }}
        onToggle={(k) => setPrefs((p) => ({ ...p, [k]: !p[k] }))}
        onSettings={() => setSettingsOpen(true)}
        analysis={analysis}
        buyShare={buyShare}
        onAnalyst={() => {
          setPage('trade')
          setRightTab('ai')
        }}
        page={shownPage}
        onPage={setPage}
        brief={briefOn}
        equity={broker.account.equity}
        dayPL={broker.account.dayPL}
      />
      {shownPage !== 'brief' && <PanelGuard name="Watchlist"><Watchlist
        sortRequest={sortRequest}
        aiActive={aiRules.practiceMode && aiRules.practiceWatchlist ? aiActive : null}
        instruments={universe}
        quotes={quotes}
        active={inst.symbol}
        onSelect={(s) => {
          select(s)
          setPage('trade')
        }}
        onAdd={addInstrument}
        activeSignal={lastSignal}
        alpacaKeys={alpacaKeys}
        keys={keys}
        tf={prefs.tf}
        scanOn={aiRules.watchlistScan}
      /></PanelGuard>}
      {shownPage === 'brief' ? (
        <PanelGuard name="Jarvis Brief">
        <JarvisBrief
          rules={aiRules}
          alpacaKeys={alpacaKeys}
          flow={{ symbol: inst.symbol, buyShare, live: flow.live, source: flow.source, estimated: flow.estimated }}
          practice={practice.state}
          priceOf={practice.priceOf}
          scan={practice.scan}
          serverMode={practice.serverMode}
          learn={autoLearn.state}
          dayPL={broker.account.dayPL}
          lossLimit={prefs.lossLimit}
          lossLimitOn={prefs.lossLimitOn}
          killSwitch={prefs.killSwitch}
          onNode={openNode}
          onSymbol={openSymbol}
          onDesk={() => setPage('trade')}
        />
        </PanelGuard>
      ) : shownPage === 'trade' ? (
        <>
          <main className="center">
            <section className="panel chart-panel">
              <PanelGuard name="Chart" resetKey={`${inst.symbol}|${prefs.tf}`}>
              <ChartPanel
                symbol={inst.symbol}
                tf={prefs.tf}
                onTf={(tf) => setPrefs((p) => ({ ...p, tf }))}
                candles={candles}
                signals={closed.signals}
                prediction={prefs.forecast ? live : null}
                emaFast={closed.emaFast}
                emaSlow={closed.emaSlow}
                showEmas={prefs.emas}
                showForecast={prefs.forecast}
                showRobots={prefs.robots}
                practice={practiceOverlay}
                tour={chartTour}
              />
              </PanelGuard>
              {market.status === 'demo' && (
                <div className="demo-note">
                  Simulated data
                  {market.error ? ` (live source unavailable: ${market.error})` : inst.assetClass === 'stock' ? '. Connect an Alpaca paper key on the Portfolio page (or add a key in settings) for real stock data' : ''}
                </div>
              )}
            </section>
            <PanelGuard name="Positions" resetKey={inst.symbol}>
            <BottomPanel
              broker={broker}
              signals={closed.signals}
              symbol={inst.symbol}
              onCancel={cancel}
              onClose={onClose}
              onSelect={select}
              onPortfolio={() => setPage('portfolio')}
              practice={panelPractice}
            />
            </PanelGuard>
            {aiRules.resizePanels && (
              <ResizeHandle
                axis="y"
                className="rz-bottom"
                label={lang === 'vi' ? 'Kéo để đổi chiều cao (nhấp đúp: tự động)' : 'Drag to resize (double-click: auto)'}
                measure={() => document.querySelector('.panel.bottom')?.getBoundingClientRect().height ?? 236}
                dir={-1}
                min={120}
                max={() => window.innerHeight * 0.65}
                onSize={(px) => setPanes((p) => ({ ...p, bottom: +((px / window.innerHeight) * 100).toFixed(2) }))}
                onReset={() => setPanes((p) => ({ ...p, bottom: null }))}
              />
            )}
          </main>
          {aiRules.resizePanels && (
            <>
              <ResizeHandle
                axis="x"
                className="rz-left"
                label={lang === 'vi' ? 'Kéo để đổi độ rộng (nhấp đúp: tự động)' : 'Drag to resize (double-click: auto)'}
                measure={() => document.querySelector('.watchlist')?.getBoundingClientRect().width ?? 252}
                dir={1}
                min={170}
                max={() => window.innerWidth * 0.3}
                onSize={(px) => setPanes((p) => ({ ...p, left: +((px / window.innerWidth) * 100).toFixed(2) }))}
                onReset={() => setPanes((p) => ({ ...p, left: null }))}
              />
              <ResizeHandle
                axis="x"
                className="rz-right"
                label={lang === 'vi' ? 'Kéo để đổi độ rộng (nhấp đúp: tự động)' : 'Drag to resize (double-click: auto)'}
                measure={() => document.querySelector('.panel.right')?.getBoundingClientRect().width ?? 340}
                dir={-1}
                min={260}
                max={() => window.innerWidth * 0.45}
                onSize={(px) => setPanes((p) => ({ ...p, right: +((px / window.innerWidth) * 100).toFixed(2) }))}
                onReset={() => setPanes((p) => ({ ...p, right: null }))}
              />
            </>
          )}
          <aside className="panel right">
            <div className={`right-tabs${aiRules.jarvisOn ? ' has-brain' : ''}${aiRules.aiPicksTab ? '' : ' no-picks'}`}>
              {aiRules.jarvisOn && (
                <button className={`brain-tab${shownTab === 'brain' ? ' on' : ''}`} onClick={() => setRightTab('brain')}>
                  <JarvisAvatar size={14} motion={false} /> {lang === 'vi' ? 'Bộ não' : 'Brain'}
                </button>
              )}
              <button className={shownTab === 'ai' ? 'on' : ''} onClick={() => setRightTab('ai')}>
                {t('aiAnalyst')}
              </button>
              <button className={shownTab === 'flow' ? 'on' : ''} onClick={() => setRightTab('flow')}>
                {t('buyersSellers')}
              </button>
              <button className={shownTab === 'trade' ? 'on' : ''} onClick={() => setRightTab('trade')}>
                {t('trade')}
              </button>
              <button className={shownTab === 'learn' ? 'on' : ''} onClick={() => setRightTab('learn')}>
                {t('learning')}
              </button>
              {aiRules.aiPicksTab && (
                <button className={shownTab === 'picks' ? 'on' : ''} onClick={() => setRightTab('picks')}>
                  {t('aiPicks')}
                </button>
              )}
              <button className={shownTab === 'practice' ? 'on' : ''} onClick={() => setRightTab('practice')}>
                {lang === 'vi' ? 'Luyện tập' : 'Practice'}
                {aiRules.practiceMode && <i className="live-dot" />}
              </button>
            </div>
            <div className="right-body">
              <PanelGuard name={shownTab} resetKey={`${shownTab}|${inst.symbol}`}>
              {shownTab === 'ai' && <AnalystPanel analysis={analysis} stats={closed.stats} lastSignal={lastSignal} symbol={inst.symbol} tfLabel={tfLabel} onTrade={() => {
                    setPlanNonce((n) => n + 1)
                    setRightTab('trade')
                  }} onEditRules={() => setAiRulesOpen(true)} jarvis={aiRules.jarvisOn && aiRules.jarvisVoice} jarvisMotion={aiRules.jarvisMotion} onShowMe={showAnalysis} />}
              {shownTab === 'practice' && <PracticePanel state={practice.state} rules={aiRules} symbol={inst.symbol} priceOf={practice.priceOf} onReset={practice.reset} scan={practice.scan} onRescan={practice.rescan} onOpen={(s) => select(s)} universe={chartUniverse.map((i) => i.symbol)} serverMode={practice.serverMode} serverLastRun={practice.serverLastRun} />}
              {shownTab === 'brain' && <BrainPanel state={practice.state} rules={aiRules} journal={autoLearn.state.journal} learn={autoLearn.state} killSwitch={prefs.killSwitch} priceOf={practice.priceOf} onEditRules={() => setAiRulesOpen(true)} onShowTrade={showTrade} onReplay={showReplay} known={chartUniverse} onAskStock={askStock} onAction={jarvisAct} watchlist={universe.map((i) => i.symbol)} symbol={inst.symbol} />}
              {shownTab === 'flow' && <OrderFlowPanel flow={flow} last={lastClose} />}
              {shownTab === 'learn' && <AutoLearnPanel al={autoLearn} rules={aiRules} symbol={inst.symbol} liveScore={live?.probUp ?? null} />}
              {shownTab === 'picks' && (
                <AIPicks
                  instruments={universe}
                  tf={prefs.tf}
                  keys={keys}
                  alpacaKeys={alpacaKeys}
                  onOpen={(symbol) => {
                    openSymbol(symbol, symbol.includes('/') ? 'crypto' : 'stock')
                    setRightTab('ai')
                  }}
                />
              )}
              {shownTab === 'trade' && (
                <OrderTicket
                  inst={inst}
                  last={lastClose}
                  broker={broker}
                  analysis={analysis}
                  onSubmit={(r) => submit(r)}
                  autoTrade={prefs.autoTrade}
                  onAutoTrade={(autoTrade) => setPrefs((p) => ({ ...p, autoTrade }))}
                  robotPaused={robotPaused}
                  limits={prefs}
                  planNonce={planNonce}
                  onKillSwitch={(killSwitch) => setPrefs((p) => ({ ...p, killSwitch }))}
                />
              )}
              </PanelGuard>
            </div>
          </aside>
        </>
      ) : (
        <main className="portfolio-wrap">
          <PanelGuard name="Portfolio">
          <PortfolioPage
            broker={broker}
            period={prefs.equityPeriod}
            onPeriod={(equityPeriod) => setPrefs((p) => ({ ...p, equityPeriod }))}
            onCancel={cancel}
            onClose={onClose}
            onTrade={(s) => {
              select(s)
              setPage('trade')
              setRightTab('trade')
            }}
            onReset={reset}
            mode={prefs.brokerMode}
            onMode={(brokerMode) => setPrefs((p) => ({ ...p, brokerMode }))}
            alpacaKeys={alpacaKeys}
            onAlpacaKeys={setAlpacaKeys}
            onAlphaVantageKey={(alphaVantage) => setKeys((k) => ({ ...k, alphaVantage }))}
            lossLimit={prefs.lossLimit}
            onLossLimit={(lossLimit) => setPrefs((p) => ({ ...p, lossLimit }))}
            lossLimitOn={prefs.lossLimitOn}
            onLossLimitOn={(lossLimitOn) => setPrefs((p) => ({ ...p, lossLimitOn }))}
          />
          </PanelGuard>
        </main>
      )}
      {settingsOpen && (
        <SettingsModal
          keys={keys}
          onSave={setKeys}
          alpacaKeys={alpacaKeys}
          onAlpacaKeys={setAlpacaKeys}
          onClose={() => setSettingsOpen(false)}
          onOpenAiRules={() => {
            setSettingsOpen(false)
            setAiRulesOpen(true)
          }}
        />
      )}
      {aiRulesOpen && <AiRulesModal onClose={() => setAiRulesOpen(false)} />}
      <Toasts toasts={toasts} onClose={(id) => setToasts((s) => s.filter((t) => t.id !== id))} />
    </div>
  )
}
