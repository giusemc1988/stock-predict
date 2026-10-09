import { Fragment, useState } from 'react'
import type { Instrument, Candle, Timeframe } from '../types'
import { binanceKlines, alphaVantageCandlesCached, alpacaStockCandles, hasAlpacaData, type AlpacaDataKeys, type ApiKeys } from '../data/providers'
import { rankPicks, savePicks, SMALL_SAMPLE, sortPicks, type Pick, type PickSort } from '../lib/picks'
import { useT } from '../lib/i18n'

const pct = (x: number) => `${x.toFixed(1)}%`

/** Every input the analyst used for one stock, plus the baseline check. */
function Inputs({ pick: p }: { pick: Pick }) {
  const t = useT()
  const i = p.inputs
  return (
    <div className="pick-inputs">
      <ul>
        <li>{t('rsi')}: {i.rsi == null ? t('notEnoughData') : i.rsi.toFixed(0)}</li>
        <li>{t('volVsAvg')}: {i.volumeVsAvg == null ? t('notEnoughData') : `${i.volumeVsAvg.toFixed(2)}x`}</li>
        <li>
          {t('buyShare')}: {(i.buyShare * 100).toFixed(0)}%{i.buyShareEstimated ? ` ${t('estimated')}` : ` ${t('reported')}`}
        </li>
        <li>{t('newsItems')}</li>
        <li>
          {t('backtestLine')}: {t('strategyVsHold')} {pct(i.strategyReturnPct)} vs {pct(i.buyHoldReturnPct)}. {t('result')}:{' '}
          <strong>{i.versusBaseline === 'edge' ? t('edge') : t('noEdge')}</strong>
        </li>
      </ul>
      <p className="muted">{t('analystReasons')}</p>
      <ul>
        {i.reasons.map((r) => (
          <li key={r.label}>
            <strong>{r.label}</strong> ({r.stance}): {r.detail}
          </li>
        ))}
      </ul>
      <p className="muted">
        {t('inputsNote')}
      </p>
    </div>
  )
}

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
  const t = useT()
  const [picks, setPicks] = useState<Pick[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [by, setBy] = useState<PickSort>('call')
  const [open, setOpen] = useState<string | null>(null)

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
    const ranked = rankPicks(series)
    savePicks(ranked)
    setPicks(ranked)
    setBusy(false)
  }

  return (
    <div className="picks">
      <p className="muted">
        {t('picksIntro')}
      </p>
      <button onClick={scan} disabled={busy}>
        {busy ? t('scanning') : picks ? t('scanAgain') : t('scanMyList')}
      </button>
      <div className="right-tabs">
        <button className={by === 'call' ? 'on' : ''} onClick={() => setBy('call')}>
          {t('topAiCall')}
        </button>
        <button className={by === 'success' ? 'on' : ''} onClick={() => setBy('success')}>
          {t('topAiSuccess')}
        </button>
      </div>
      {skipped.length > 0 && <p className="muted">{t('noData')}: {skipped.join(', ')}</p>}
      {picks && picks.length === 0 && <p className="muted">{t('notEnoughHistory')}</p>}
      {by === 'success' && <p className="muted">{t('successNote')}</p>}
      {picks && picks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t('symbol')}</th>
              <th>{t('call')}</th>
              <th>{t('confidence')}</th>
              <th>{t('pastWinRate')}</th>
              <th>{t('why')}</th>
            </tr>
          </thead>
          <tbody>
            {sortPicks(picks, by).map((p) => (
              <Fragment key={p.symbol}>
                <tr onClick={() => setOpen(open === p.symbol ? null : p.symbol)} className="pick-row">
                  <td>
                    {p.symbol}{' '}
                    <button
                      className="link"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpen(p.symbol)
                      }}
                    >
                      {t('open')}
                    </button>
                  </td>
                  <td>{p.verdict}</td>
                  <td>{p.confidenceLabel} ({Math.round(p.confidence * 100)}%)</td>
                  <td>
                    {p.trades ? `${Math.round(p.winRate * 100)}% ${t('of')} ${p.trades} ${t('trades')}` : t('noTrades')}
                    {p.trades > 0 && p.trades < SMALL_SAMPLE ? ` (${t('smallSample')})` : ''}
                  </td>
                  <td>{p.headline}</td>
                </tr>
                {open === p.symbol && (
                  <tr>
                    <td colSpan={5}>
                      <Inputs pick={p} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
