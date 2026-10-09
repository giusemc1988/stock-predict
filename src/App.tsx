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
import { LearningPanel } from './components/LearningPanel'
import { AIPicks } from './components/AIPicks'
import { WhatsNew } from './components/WhatsNew'
import { SettingsModal } from './components/SettingsModal'
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
  equityPeriod: '1M',
}

let toastSeq = 0

export default function App() {
  const [prefs, setPrefs] = useLocalStorage<Prefs>('bluechip.prefs', DEFAULT_PREFS)
  const [keys, setKeys] = useLocalStorage<ApiKeys>('bluechip.keys', { alphaVantage: '', finnhub: '' })
  const [alpacaKeys, setAlpacaKeys] = useLocalStorage<AlpacaKeys>('bluechip.alpaca', { keyId: '', secret: '' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [page, setPage] = useState<'trade' | 'portfolio'>('trade')
  const [rightTab, setRightTab] = useState<'ai' | 'flow' | 'trade' | 'learn' | 'picks'>('ai')
  const [toasts, setToasts] = useState<Toast[]>([])
  // Tickers added from the search box persist in this browser and join the built-in watchlist.
  const [added, setAdded] = useLocalStorage<Instrument[]>('bluechip.added', [])
  const universe = useMemo(() => [...INSTRUMENTS, ...added.filter((a) => !INSTRUMENTS.some((i) => i.symbol === a.symbol))], [added])
  const inst = useMemo(() => universe.find((i) => i.symbol === prefs.symbol) ?? INSTRUMENTS[0], [universe, prefs.symbol])
  const market = useMarketData(inst, prefs.tf, keys, alpacaKeys)
  const quotes = useQuotes(universe, keys, alpacaKeys)
  const addInstrument = (i: Instrument) => setAdded((list) => (list.some((x) => x.symbol === i.symbol) ? list : [...list, i]))
  const flow = useOrderFlow(inst, keys)
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
    const run = () => setAnalysis(analyze(candlesRef.current, closed, liveRef.current, flowRef.current))
    run()
    const id = setInterval(run, 1000)
    return () => clearInterval(id)
  }, [closed, inst.symbol])
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
      submit({ symbol: inst.symbol, side, type: 'market', qty, tif: 'day', source: 'robot' }).then((r) => {
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
    document.title = lastClose ? `${inst.symbol} ${lastClose.toLocaleString('en-US', { maximumFractionDigits: 2 })} · Bluechip` : 'Bluechip Terminal'
  }, [inst.symbol, lastClose])

  const select = (symbol: string) => setPrefs((p) => ({ ...p, symbol }))
  const priceOf = (s: string) => (s === inst.symbol ? lastClose : quotes[s]?.price ?? 0)
  const onClose = (pos: { symbol: string }) => closePosition(pos.symbol, priceOf(pos.symbol))

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
                AI Analyst
              </button>
              <button className={rightTab === 'flow' ? 'on' : ''} onClick={() => setRightTab('flow')}>
                Buyers &amp; Sellers
              </button>
              <button className={rightTab === 'trade' ? 'on' : ''} onClick={() => setRightTab('trade')}>
                Trade
              </button>
              <button className={rightTab === 'learn' ? 'on' : ''} onClick={() => setRightTab('learn')}>
                Learning
              </button>
              <button className={rightTab === 'picks' ? 'on' : ''} onClick={() => setRightTab('picks')}>
                AI Picks
              </button>
            </div>
            <div className="right-body">
              {rightTab === 'ai' && <AnalystPanel analysis={analysis} stats={closed.stats} lastSignal={lastSignal} symbol={inst.symbol} tfLabel={tfLabel} onTrade={() => setRightTab('trade')} />}
              {rightTab === 'flow' && <OrderFlowPanel flow={flow} last={lastClose} />}
              {rightTab === 'learn' && <LearningPanel />}
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
      {settingsOpen && <SettingsModal keys={keys} onSave={setKeys} onClose={() => setSettingsOpen(false)} />}
      <Toasts toasts={toasts} onClose={(id) => setToasts((s) => s.filter((t) => t.id !== id))} />
    </div>
  )
}
