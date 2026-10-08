# Bluechip Terminal

A dark, multi-panel trading dashboard: live candlestick chart (TradingView Lightweight Charts v5), watchlist, paper-trading order panel, a client-side prediction engine, and "Bluechip" robot markers at every BUY / SELL trigger.

> **Not financial advice.** Predictions are experimental technical-analysis output. Orders are simulated (paper) only; nothing is ever sent to a broker.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
# or a production build
npm run build && npm run preview
```

Requires Node 18+.

## Data sources

| Market | Source | Key | Live updates |
|---|---|---|---|
| Crypto (BTC, ETH, SOL, BNB) | Binance public market data (`data-api.binance.vision`, falls back to `api.binance.com`, `api.binance.us`) | none | WebSocket klines + 24h mini-tickers |
| US stocks (AAPL, NVDA, TSLA, MSFT, AMZN, SPY) | Alpha Vantage candles | free key | polled every 60 s |
| US stocks, real-time | Finnhub trades + quotes | free key | WebSocket trades, quotes every 15 s |
| Anything unreachable | Built-in simulated feed | none | 1 s ticks, marked **SIM** |

Add keys with the gear icon (top right). They stay in your browser's localStorage. Alpha Vantage's free tier allows 25 requests a day, so switching symbols/timeframes a lot will hit the limit; the app then falls back to simulated data and says so.

## AI Analyst (`src/lib/analyst.ts`)

The **AI Analyst** tab gives a plain-English **BUY / HOLD / SELL** call with a confidence level, the reasons behind it (trend, momentum, buyers vs sellers, live order flow, the model), and an example plan (entry, stop, target). Confidence is discounted by how often the model was actually right on the loaded chart: when that is close to 50% (a coin flip), the call is labelled low or medium confidence and says so. In our tests on daily US stock data, next-day models did not beat simple baselines, so treat every call as a lean, not a forecast.

## Buyers & Sellers (`src/hooks/useOrderFlow.ts`)

- **Crypto:** real Binance order book (top 20 levels, 100 ms updates) and every trade with its true side (the exchange reports whether the buyer or seller was the aggressor). The chart's volume bars are split into buyer (green) and seller (red) volume using Binance's taker-buy volume per candle.
- **Stocks with a Finnhub key:** real trades, with sides inferred from each trade's price move (tick rule, marked EST). A US stock order book needs a paid data plan, so none is shown.
- **No key / unreachable:** simulated book and tape, marked SIM.

## How the prediction engine works (`src/lib/strategy.ts`)

1. Seven features per bar, normalised by ATR: EMA 9/21 spread, MACD histogram, RSI, Bollinger %B, 20-bar regression slope, volume z-score, 5-bar return.
2. A **walk-forward online logistic regression** learns `P(close[t+5] > close[t])`. It only trains on bars whose outcome is already known, so every signal on the chart is what the model would have said live (no look-ahead).
3. The model probability is blended with a rule-based trend/momentum score while the model warms up, then smoothed.
4. A long/flat state machine with hysteresis and a cooldown emits signals:
   - **BUY** when P(up) ≥ 60% and EMA 9 > EMA 21 (or RSI < 30 rebound)
   - **SELL** when P(up) ≤ 42%, close breaks EMA 21 − 1 ATR, or RSI > 80
5. Signals and the backtest use closed bars only, so robots never flicker on the forming candle. The forecast cone (dashed line ±1σ ATR band) updates every tick.

The robot backtest (strategy vs buy & hold, win rate, worst dip, model hit rate) is under the AI Analyst tab.

Tune it via `DEFAULT_CONFIG` in `strategy.ts`.

## Robot markers (`src/components/ChartPanel.tsx`)

Each signal gets a small arrow series-marker on the exact bar plus an HTML overlay robot (`RobotIcon.tsx`, green for BUY under the low, red for SELL over the high). A `requestAnimationFrame` loop maps `time → x` and `price → y` with the chart's own coordinate APIs, so robots stay glued to their bars while you pan, zoom or rescale. Hover a robot for the trigger price, confidence and the reasons it fired. The newest robot bobs.

## Paper trading (`src/hooks/usePaperBroker.ts`)

$100,000 starting cash, market / limit / stop orders, 2 bps slippage, long-only (no shorting). Limit and stop orders trigger off live prices. **Robot auto-trade** (order panel) paper-trades new signals that appear while the app is open: $1,000 per crypto buy, 10 shares per stock buy, and it sells the full position on SELL. State persists in localStorage; Reset in the bottom bar.

## Layout

```
src/
  App.tsx                 wiring: data → strategy → panels
  types.ts
  data/instruments.ts     watchlist symbols
  data/providers.ts       Binance / Alpha Vantage / Finnhub clients
  data/demo.ts            seeded simulated market (fallback)
  hooks/useMarketData.ts  candles for the active symbol + live stream
  hooks/useQuotes.ts      watchlist quotes + sparklines
  hooks/usePaperBroker.ts simulated brokerage
  lib/indicators.ts       EMA, RSI, ATR, MACD, Bollinger, regression
  lib/strategy.ts         prediction engine + backtest
  hooks/useOrderFlow.ts   order book + buy/sell trade flow
  lib/analyst.ts          plain-English BUY / HOLD / SELL analyst
  lib/orderflow.ts        buy/sell volume helpers
  components/             TopBar, Watchlist, ChartPanel, RobotIcon, AnalystPanel, OrderFlowPanel, OrderPanel, BottomPanel, SettingsModal
```

To add a symbol, append it to `src/data/instruments.ts` (crypto `feedId` is the Binance pair, e.g. `XRPUSDT`).
