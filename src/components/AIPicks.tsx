import { useState } from 'react'
import type { Instrument, Candle, Timeframe } from '../types'
import { binanceKlines, alphaVantageCandlesCached, alpacaStockCandles, hasAlpacaData, type AlpacaDataKeys, type ApiKeys } from '../data/providers'
import { rankPicks, SMALL_SAMPLE, sortPicks, type Pick, type PickSort } from '../lib/picks'

interface Props {
  instruments: Instrument[]
  tf: Timeframe
  keys: ApiKeys
  alpacaKeys: AlpacaDataKeys
  onOpen: (symbol: string) => void
}

/** Crypto from Binance (no key); stocks from Alpaca data if connected, else Alpha Vantage. */
async function candlesFor(inst: Instrument, tf: Timeframe, keys: ApiKeys, alpaca: AlpacaDataKeys): Promise<Candle[]> {
  if (inst.assetClass === 'crypto') return binanceKlines(inst.feedId, tf, 500)
  if (hasAlpacaData(alpaca)) return alpacaStockCandles(inst.feedId, tf, alpaca)
  if (keys.alphaVantage) return (await alphaVantageCandlesCached(inst.feedId, tf, keys.alphaVantage)).candles
  throw new Error(`${inst.symbol}: no data key`)
}

export function AIPicks({ instruments, tf, keys, alpacaKeys, onOpen }: Props) {
  const [picks, setPicks] = useState<Pick[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [by, setBy] = useState<PickSort>('call')

  const scan = async () => {
    setBusy(true)
    const series: { symbol: string; candles: Candle[] }[] = []
    const failed: string[] = []
    // one at a time, so free-tier data keys are not hit all at once
    for (const inst of instruments) {
      try {
        series.push({ symbol: inst.symbol, candles: await candlesFor(inst, tf, keys, alpacaKeys) })
      } catch {
        failed.push(inst.symbol)
      }
    }
    setSkipped(failed)
    setPicks(rankPicks(series))
    setBusy(false)
  }

  return (
    <div className="picks">
      <p className="muted">
        The analyst's call on each stock in your list, best first. Confidence is capped when the track record is weak. Not financial advice; paper trading only.
      </p>
      <button onClick={scan} disabled={busy}>
        {busy ? 'Scanning…' : picks ? 'Scan again' : 'Scan my list'}
      </button>
      <div className="right-tabs">
        <button className={by === 'call' ? 'on' : ''} onClick={() => setBy('call')}>
          Top AI call
        </button>
        <button className={by === 'success' ? 'on' : ''} onClick={() => setBy('success')}>
          Top AI signal success
        </button>
      </div>
      {skipped.length > 0 && <p className="muted">No data for: {skipped.join(', ')}</p>}
      {picks && picks.length === 0 && <p className="muted">Not enough history to analyse yet.</p>}
      {by === 'success' && <p className="muted">Win rate is from the app's backtest of past signals on each stock. Under {SMALL_SAMPLE} trades it is noise, not a track record.</p>}
      {picks && picks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Call</th>
              <th>Confidence</th>
              <th>Past win rate</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {sortPicks(picks, by).map((p) => (
              <tr key={p.symbol} onClick={() => onOpen(p.symbol)} className="pick-row">
                <td>{p.symbol}</td>
                <td>{p.verdict}</td>
                <td>{p.confidenceLabel} ({Math.round(p.confidence * 100)}%)</td>
                <td>
                  {p.trades ? `${Math.round(p.winRate * 100)}% of ${p.trades} trades` : 'no trades'}
                  {p.trades > 0 && p.trades < SMALL_SAMPLE ? ' (small sample)' : ''}
                </td>
                <td>{p.headline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
