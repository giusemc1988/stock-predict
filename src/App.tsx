import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Candle, Instrument, Timeframe } from './types'
import { TIMEFRAMES } from './types'
import { INSTRUMENTS } from './data/instruments'
import type { ApiKeys } from './data/providers'
import type { BrokerMode, BrokerOrder, OrderRequest } from './broker/types'
import type { AlpacaKeys } from './broker/alpaca'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useMarketData } from './hooks/useMarketData'
import { useQuotes } from './hooks/useQuotes'
import { useBroker } from './hooks/useBroker'
import { useOrderFlow } from './hooks/useOrderFlow'
import { runStrategy } from './lib/strategy'
import { blocking, riskGates } from './lib/riskGates'
import { analyze } from './lib/analyst'
import { fmtPrice, fmtUsd } from './lib/format'
import { TopBar } from './components/TopBar'
import { Watchlist } from './components/Watchlist'
import { ChartPanel } from './components/ChartPanel'
import { OrderTicket } from './components/OrderTicket'
import { AnalystPanel } from './components/AnalystPanel'
import { OrderFlowPanel } from './components/OrderFlowPanel'
import { BottomPanel } from './components/BottomPanel'
import { PortfolioPage } from './components/PortfolioPage'
import { AutoLearnPanel } from './components/AutoLearnPanel'
import { useAutoLearning } from './hooks/useAutoLearning'
import { usePractice } from './hooks/usePractice'
import { PracticePanel } from './components/PracticePanel'
import type { PracticeEvent } from './lib/practice'
import type { PracticeOverlay } from './components/ChartPanel'
import { useLang, useT } from './lib/i18n'
import { AIPicks } from './components/AIPicks'
import { WhatsNew } from './components/WhatsNew'
import { SettingsModal } from './components/SettingsModal'
import { AiRulesModal } from './components/AiRulesModal'
import { useAiRules } from './lib/aiRules'
import { Toasts, type Toast } from './components/Toasts'

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
  const aiRules = useAiRules()
  const [page, setPage] = useState<'trade' | 'portfolio'>('trade')
  const [rightTab, setRightTab] = useState<'ai' | 'flow' | 'trade' | 'learn' | 'picks' | 'practice'>('ai')
  const lang = useLang()
  const [toasts, setToasts] = useState<Toast[]>([])
  // Tickers added from the search box persist in this browser and join the built-in watchlist.
  const [added, setAdded] = useLocalStorage<Instrument[]>('bluechip.added', [])
  const universe = useMemo(() => [...INSTRUMENTS, ...added.filter((a) => !INSTRUMENTS.some((i) => i.symbol === a.symbol))], [added])
  const inst = useMemo(() => universe.find((i) => i.symbol === prefs.symbol) ?? INSTRUMENTS[0], [universe, prefs.symbol])
  const market = useMarketData(inst, prefs.tf, keys, alpacaKeys)
  const quotes = useQuotes(universe, keys, alpacaKeys)
  const addInstrument = (i: Instrument) => setAdded((list) => (list.some((x) => x.symbol === i.symbol) ? list : [...list, i]))
  const flow = useOrderFlow(inst, keys)
  // 24/7 auto learning runs here so it keeps going whichever tab is open (off by default)
  const autoLearn = useAutoLearning(universe, keys, alpacaKeys, aiRules)
  const brokerApi = useBroker(prefs.brokerMode, alpacaKeys, prefs.equityPeriod)
  const broker = brokerApi.state

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

  // Re-analyse at most once a second; order flow updates several times a second.
  const flowRef = useRef(flow)
  flowRef.current = flow
  const liveRef = useRef(live)
  liveRef.current = live
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyze>>(null)
  useEffect(() => {
    const run = () => setAnalysis(analyze(candlesRef.current, closed, liveRef.current, flowRef.current, aiRules))
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
  const gateRef = useRef({ broker, analysis, prefs })
  gateRef.current = { broker, analysis, prefs }
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
      const req: OrderRequest = { symbol: inst.symbol, side, type: 'market', qty, tif: 'day', source: 'robot' }
      const blocked = blocking(riskGates(req, price, g.broker, g.analysis, g.prefs))
      if (blocked.length) {
        toast({ tone: 'info', title: `Robot skipped a ${side.toUpperCase()} on ${inst.symbol}`, body: `${blocked[0].name}: ${blocked[0].message}` })
        return
      }
      submit(req).then((r) => {
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
  const practiceRules = useRef(aiRules)
  practiceRules.current = aiRules
  const langRef = useRef(lang)
  langRef.current = lang
  const onPracticeEvent = useCallback(
    (e: PracticeEvent) => {
      const r = practiceRules.current
      if (r.practiceOnChart) setFlash(e)
      if (r.practiceFeed) toast({ tone: e.kind === 'buy' ? 'info' : (e.pnl ?? 0) >= 0 ? 'ok' : 'bad', title: `🎯 ${langRef.current === 'vi' ? 'Luyện tập' : 'Practice'}: ${e.kind === 'buy' ? (langRef.current === 'vi' ? 'MUA' : 'BUY') : langRef.current === 'vi' ? 'BÁN' : 'SELL'} ${e.symbol}`, body: langRef.current === 'vi' ? e.vi : e.en })
    },
    [toast],
  )
  const practice = usePractice({
    rules: aiRules,
    symbol: inst.symbol,
    tf: prefs.tf,
    candles,
    analysis,
    liveScore: live?.probUp ?? null,
    journal: autoLearn.state.journal,
    priceOf,
    quotesKey: quotes,
    killSwitch: prefs.killSwitch,
    maxTradesPerDay: aiRules.maxTradesPerDay,
    onEvent: onPracticeEvent,
  })
  const practiceOverlay: PracticeOverlay | null = !aiRules.practiceOnChart
    ? null
    : {
        markers: [
          ...practice.state.trades
            .filter((x) => x.symbol === inst.symbol && x.tf === prefs.tf)
            .flatMap((x) => [
              { time: x.barTime, side: 'buy' as const, text: 'P' },
              { time: x.exitBarTime, side: 'sell' as const, text: `P ${x.pnl >= 0 ? '+' : '−'}$${Math.abs(x.pnl).toFixed(0)}` },
            ]),
          ...practice.state.open.filter((x) => x.symbol === inst.symbol && x.tf === prefs.tf).map((x) => ({ time: x.barTime, side: 'buy' as const, text: 'P' })),
        ],
        lines: practice.state.open
          .filter((x) => x.symbol === inst.symbol)
          .flatMap((x) => [
            { price: x.entry, color: '#f0b90b', title: lang === 'vi' ? 'LT vào' : 'Practice in' },
            { price: x.stop, color: '#f6465d', title: lang === 'vi' ? 'LT cắt lỗ' : 'Practice stop' },
            { price: x.target, color: '#0ecb81', title: lang === 'vi' ? 'LT chốt lời' : 'Practice target' },
          ]),
        flash: flash && flash.symbol === inst.symbol ? flash : null,
        flashText: flash ? (lang === 'vi' ? flash.vi : flash.en) : '',
      }

  return (
    <div className={`app page-${page}`}>
      <WhatsNew />
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
        page={page}
        onPage={setPage}
        equity={broker.account.equity}
        dayPL={broker.account.dayPL}
      />
      <Watchlist
        instruments={universe}
        quotes={quotes}
        active={inst.symbol}
        onSelect={(s) => {
          select(s)
          setPage('trade')
        }}
        onAdd={addInstrument}
        activeSignal={lastSignal}
      />
      {page === 'trade' ? (
        <>
          <main className="center">
            <section className="panel chart-panel">
              <ChartPanel
                symbol={inst.symbol}
                tf={prefs.tf}
                candles={candles}
                signals={closed.signals}
                prediction={prefs.forecast ? live : null}
                emaFast={closed.emaFast}
                emaSlow={closed.emaSlow}
                showEmas={prefs.emas}
                showForecast={prefs.forecast}
                showRobots={prefs.robots}
                practice={practiceOverlay}
              />
              {market.status === 'demo' && (
                <div className="demo-note">
                  Simulated data
                  {market.error ? ` (live source unavailable: ${market.error})` : inst.assetClass === 'stock' ? '. Connect an Alpaca paper key on the Portfolio page (or add a key in settings) for real stock data' : ''}
                </div>
              )}
            </section>
            <BottomPanel
              broker={broker}
              signals={closed.signals}
              symbol={inst.symbol}
              onCancel={cancel}
              onClose={onClose}
              onSelect={select}
              onPortfolio={() => setPage('portfolio')}
            />
          </main>
          <aside className="panel right">
            <div className="right-tabs">
              <button className={rightTab === 'ai' ? 'on' : ''} onClick={() => setRightTab('ai')}>
                {t('aiAnalyst')}
              </button>
              <button className={rightTab === 'flow' ? 'on' : ''} onClick={() => setRightTab('flow')}>
                {t('buyersSellers')}
              </button>
              <button className={rightTab === 'trade' ? 'on' : ''} onClick={() => setRightTab('trade')}>
                {t('trade')}
              </button>
              <button className={rightTab === 'learn' ? 'on' : ''} onClick={() => setRightTab('learn')}>
                {t('learning')}
              </button>
              <button className={rightTab === 'picks' ? 'on' : ''} onClick={() => setRightTab('picks')}>
                {t('aiPicks')}
              </button>
              <button className={rightTab === 'practice' ? 'on' : ''} onClick={() => setRightTab('practice')}>
                {lang === 'vi' ? 'Luyện tập' : 'Practice'}
                {aiRules.practiceMode && <i className="live-dot" />}
              </button>
            </div>
            <div className="right-body">
              {rightTab === 'ai' && <AnalystPanel analysis={analysis} stats={closed.stats} lastSignal={lastSignal} symbol={inst.symbol} tfLabel={tfLabel} onTrade={() => {
                    setPlanNonce((n) => n + 1)
                    setRightTab('trade')
                  }} onEditRules={() => setAiRulesOpen(true)} />}
              {rightTab === 'practice' && <PracticePanel state={practice.state} rules={aiRules} symbol={inst.symbol} priceOf={priceOf} onReset={practice.reset} />}
              {rightTab === 'flow' && <OrderFlowPanel flow={flow} last={lastClose} />}
              {rightTab === 'learn' && <AutoLearnPanel al={autoLearn} rules={aiRules} symbol={inst.symbol} liveScore={live?.probUp ?? null} />}
              {rightTab === 'picks' && (
                <AIPicks
                  instruments={universe}
                  tf={prefs.tf}
                  keys={keys}
                  alpacaKeys={alpacaKeys}
                  onOpen={(symbol) => {
                    select(symbol)
                    setRightTab('ai')
                  }}
                />
              )}
              {rightTab === 'trade' && (
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
            </div>
          </aside>
        </>
      ) : (
        <main className="portfolio-wrap">
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
        </main>
      )}
      {settingsOpen && (
        <SettingsModal
          keys={keys}
          onSave={setKeys}
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
