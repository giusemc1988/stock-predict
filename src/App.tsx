import { useEffect, useMemo, useRef, useState } from 'react'
import type { Timeframe } from './types'
import { TIMEFRAMES } from './types'
import { INSTRUMENTS, findInstrument } from './data/instruments'
import type { ApiKeys } from './data/providers'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useMarketData } from './hooks/useMarketData'
import { useQuotes } from './hooks/useQuotes'
import { usePaperBroker } from './hooks/usePaperBroker'
import { runStrategy } from './lib/strategy'
import { TopBar } from './components/TopBar'
import { Watchlist } from './components/Watchlist'
import { ChartPanel } from './components/ChartPanel'
import { OrderPanel } from './components/OrderPanel'
import { AIPanel } from './components/AIPanel'
import { BottomPanel } from './components/BottomPanel'
import { SettingsModal } from './components/SettingsModal'

interface Prefs {
  symbol: string
  tf: Timeframe
  emas: boolean
  forecast: boolean
  robots: boolean
  autoTrade: boolean
}

export default function App() {
  const [prefs, setPrefs] = useLocalStorage<Prefs>('bluechip.prefs', { symbol: 'BTC/USDT', tf: '15m', emas: true, forecast: true, robots: true, autoTrade: false })
  const [keys, setKeys] = useLocalStorage<ApiKeys>('bluechip.keys', { alphaVantage: '', finnhub: '' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inst = useMemo(() => findInstrument(prefs.symbol), [prefs.symbol])
  const market = useMarketData(inst, prefs.tf, keys)
  const quotes = useQuotes(INSTRUMENTS, keys)
  const broker = usePaperBroker()

  const { candles } = market
  const lastClose = candles.length ? candles[candles.length - 1].close : quotes[inst.symbol]?.price ?? 0

  // Signals + backtest run on closed bars only, so robots never flicker on the forming bar.
  const candlesRef = useRef(candles)
  candlesRef.current = candles
  const closedKey = `${inst.symbol}|${prefs.tf}|${candles.length}|${candles[0]?.time ?? 0}`
  const closed = useMemo(() => runStrategy(candlesRef.current.slice(0, -1)), [closedKey])
  // The live prediction/forecast updates with every tick.
  const live = useMemo(() => (candles.length > 40 ? runStrategy(candles).prediction : null), [candles])

  const lastSignal = closed.signals.length ? closed.signals[closed.signals.length - 1] : null

  // Robot auto-trade: act only on signals that appear after the series was loaded.
  const seen = useRef<{ key: string; time: number }>({ key: '', time: 0 })
  const { place, onPrice } = broker
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
    const pos = broker.account.positions[inst.symbol]
    const qty = lastSignal.side === 'buy' ? (inst.assetClass === 'crypto' ? +(1000 / lastClose).toFixed(5) : 10) : pos?.qty ?? 0
    if (qty > 0) place({ symbol: inst.symbol, side: lastSignal.side, type: 'market', qty, source: 'robot' }, lastClose)
  }, [lastSignal, inst, prefs.tf, prefs.autoTrade, candles.length, lastClose, place, broker.account.positions])

  // Feed prices to the paper broker so limit/stop orders can trigger.
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

  return (
    <div className="app">
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
      />
      <Watchlist instruments={INSTRUMENTS} quotes={quotes} active={inst.symbol} onSelect={(symbol) => setPrefs((p) => ({ ...p, symbol }))} activeSignal={lastSignal} />
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
              Simulated data{market.error ? ` (live source unavailable: ${market.error})` : inst.assetClass === 'stock' ? '. Add a free API key in settings for real stock data' : ''}
            </div>
          )}
        </section>
        <BottomPanel
          account={broker.account}
          quotes={quotes}
          lastPrices={{ [inst.symbol]: lastClose }}
          signals={closed.signals}
          symbol={inst.symbol}
          onCancel={broker.cancel}
          onReset={broker.reset}
          onSelect={(symbol) => setPrefs((p) => ({ ...p, symbol }))}
        />
      </main>
      <div className="right">
        <OrderPanel inst={inst} last={lastClose} account={broker.account} onPlace={place} autoTrade={prefs.autoTrade} onAutoTrade={(autoTrade) => setPrefs((p) => ({ ...p, autoTrade }))} />
        <AIPanel prediction={live} stats={closed.stats} lastSignal={lastSignal} tfLabel={tfLabel} />
      </div>
      {settingsOpen && <SettingsModal keys={keys} onSave={setKeys} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
