import { Fragment, useMemo, useState } from 'react'
import type { Instrument, Candle, Timeframe } from '../types'
import type { AlpacaDataKeys, ApiKeys } from '../data/providers'
import { candlesFor } from '../data/series'
import { rankPicks, savePicks, SMALL_SAMPLE, sortPicks, type Pick, type PickSort } from '../lib/picks'
import { useLang, useT } from '../lib/i18n'
import { useMarketLists } from '../hooks/useMarketLists'
import type { MarketListRow } from '../data/providers'

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

const asInstrument = (r: MarketListRow): Instrument => ({ symbol: r.symbol, name: r.symbol, assetClass: r.assetClass, feedId: r.assetClass === 'crypto' ? r.symbol.replace('/', '') : r.symbol, demoPrice: r.price, demoVol: 0.4 })

export function AIPicks({ instruments, tf, keys, alpacaKeys, onOpen }: Props) {
  const t = useT()
  const vi = useLang() === 'vi'
  // "the market" = today's live top gainers and most-traded names, stocks and crypto; never a fixed list
  const [mode, setMode] = useState<'market' | 'list'>('market')
  const lists = useMarketLists(mode === 'market', alpacaKeys)
  const market = useMemo(() => {
    const rows = [lists.stocks, lists.crypto].flatMap((l) => (l ? [...l.gainers.slice(0, 6), ...l.volume.slice(0, 6)] : []))
    const seen = new Set<string>()
    return rows.filter((r) => !seen.has(r.symbol) && !!seen.add(r.symbol)).map(asInstrument)
  }, [lists.stocks, lists.crypto])
  const targets = mode === 'market' ? market : instruments
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
    for (const inst of targets) {
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
      <div className="right-tabs">
        <button className={mode === 'market' ? 'on' : ''} onClick={() => setMode('market')}>
          {vi ? 'Toàn thị trường' : 'The market'}
        </button>
        <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>
          {vi ? 'Danh sách của tôi' : 'My list'}
        </button>
      </div>
      {mode === 'market' && (
        <p className="muted small">
          {market.length
            ? vi
              ? `${market.length} mã tăng mạnh và giao dịch nhiều nhất lúc này (Alpaca, Binance).`
              : `${market.length} of today's top gainers and most-traded names (Alpaca, Binance).`
            : lists.loading
              ? vi ? 'Đang tải danh sách thị trường…' : 'Loading the market lists…'
              : vi ? 'Chưa có danh sách thị trường.' : 'No market list yet.'}
          {lists.stocksNeedKey && (vi ? ' Cổ phiếu cần key Alpaca paper.' : ' Stocks need an Alpaca paper key.')}
        </p>
      )}
      <button onClick={scan} disabled={busy || !targets.length}>
        {busy ? t('scanning') : picks ? t('scanAgain') : mode === 'market' ? (vi ? 'Quét thị trường' : 'Scan the market') : t('scanMyList')}
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
