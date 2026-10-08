import type { Instrument } from '../types'

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', assetClass: 'crypto', feedId: 'BTCUSDT', demoPrice: 64250, demoVol: 0.55 },
  { symbol: 'ETH/USDT', name: 'Ethereum', assetClass: 'crypto', feedId: 'ETHUSDT', demoPrice: 3120, demoVol: 0.65 },
  { symbol: 'SOL/USDT', name: 'Solana', assetClass: 'crypto', feedId: 'SOLUSDT', demoPrice: 148, demoVol: 0.85 },
  { symbol: 'BNB/USDT', name: 'BNB', assetClass: 'crypto', feedId: 'BNBUSDT', demoPrice: 585, demoVol: 0.5 },
  { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'stock', feedId: 'AAPL', demoPrice: 228, demoVol: 0.25 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'stock', feedId: 'NVDA', demoPrice: 131, demoVol: 0.5 },
  { symbol: 'TSLA', name: 'Tesla Inc.', assetClass: 'stock', feedId: 'TSLA', demoPrice: 248, demoVol: 0.6 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetClass: 'stock', feedId: 'MSFT', demoPrice: 418, demoVol: 0.22 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', assetClass: 'stock', feedId: 'AMZN', demoPrice: 186, demoVol: 0.32 },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'stock', feedId: 'SPY', demoPrice: 571, demoVol: 0.15 },
]

export const findInstrument = (symbol: string) => INSTRUMENTS.find((i) => i.symbol === symbol) ?? INSTRUMENTS[0]
