/**
 * Atlas entry quality gate (v2.0.8): a BUY is only taken on a stock that is liquid, actually moving and
 * not a penny or shell company. Added after Chanh saw trades on flat, thin charts that closed with
 * "giá không chạy". The audit of 314 trades pointed the same way: volume below 1x normal won 34% (-$89),
 * volume 2x or more won 51% (+$34).
 *
 * Checks use only data the scanner already has (15-minute bars) plus, for stocks from the market-wide
 * movers lists, the market cap Yahoo reports. A missing market cap passes (watchlist names are chosen by
 * Chanh), but missing volume never does.
 */
import type { AssetClass, Candle } from '../types'

/** Stocks under this price are not traded at all: penny stocks are where thin, halted and shell companies live. */
export const MIN_PRICE = 5
/** Average dollar volume per 15-minute bar, about $26M a day. */
export const MIN_DOLLAR_VOL = 1_000_000
/** Volume of the last hour against the average of the 20 bars before it (1 = normal). */
export const MIN_VOL_RATIO = 1
/** Average 15-minute bar range (ATR) as a % of price: below this the chart is flat and price rarely reaches a target. */
export const MIN_ATR_PCT = 0.3
/** Smallest company allowed when the market cap is known, in dollars. */
export const MIN_MARKET_CAP = 300_000_000

/** Average true range over the last `n` closed bars, as a % of the last close. */
export function atrPercent(closedBars: Candle[], n = 14): number | null {
  const xs = closedBars.slice(-(n + 1))
  if (xs.length < n + 1) return null
  let sum = 0
  for (let i = 1; i < xs.length; i++) sum += Math.max(xs[i].high - xs[i].low, Math.abs(xs[i].high - xs[i - 1].close), Math.abs(xs[i].low - xs[i - 1].close))
  const last = xs[xs.length - 1].close
  return last > 0 ? (sum / n / last) * 100 : null
}

export interface QualityInput {
  asset: AssetClass
  price: number
  dollarVol: number | null
  volVsAvg: number | null
  atrPct: number | null
  marketCap?: number | null
}

export interface QualityBlock {
  check: string
  en: string
  vi: string
}

const m = (x: number) => `$${(x / 1e6).toFixed(x < 1e7 ? 1 : 0)}M`

/** The first reason a BUY should not be taken, or null when the stock passes. */
export function qualityBlock(c: QualityInput): QualityBlock | null {
  if (c.asset === 'stock') {
    if (c.price < MIN_PRICE) return { check: 'Penny stock', en: `price $${c.price.toFixed(2)} is under $${MIN_PRICE}: penny and shell-company risk`, vi: `giá $${c.price.toFixed(2)} dưới $${MIN_PRICE}: dễ là cổ phiếu penny hoặc công ty ma` }
    if (c.marketCap != null && c.marketCap < MIN_MARKET_CAP) return { check: 'Company size', en: `market cap ${m(c.marketCap)} is under ${m(MIN_MARKET_CAP)}: too small to trust`, vi: `vốn hóa ${m(c.marketCap)} dưới ${m(MIN_MARKET_CAP)}: công ty quá nhỏ` }
    if (c.dollarVol == null || c.dollarVol < MIN_DOLLAR_VOL)
      return { check: 'Liquidity', en: `too thinly traded (${c.dollarVol == null ? 'no data' : `$${Math.round(c.dollarVol / 1000)}k`} per 15 min, need $${MIN_DOLLAR_VOL / 1000}k)`, vi: `giao dịch quá ít (${c.dollarVol == null ? 'không có dữ liệu' : `$${Math.round(c.dollarVol / 1000)}k`} mỗi 15 phút, cần $${MIN_DOLLAR_VOL / 1000}k)` }
  }
  if (c.volVsAvg == null || c.volVsAvg < MIN_VOL_RATIO)
    return { check: 'Volume', en: `volume ${c.volVsAvg == null ? 'unknown' : `${c.volVsAvg.toFixed(1)}x`} is below normal: nobody is buying`, vi: `khối lượng ${c.volVsAvg == null ? 'không rõ' : `${c.volVsAvg.toFixed(1)}x`} dưới mức bình thường: chưa ai mua mạnh` }
  if (c.atrPct == null || c.atrPct < MIN_ATR_PCT) return { check: 'Flat chart', en: `chart is flat (${c.atrPct == null ? 'no data' : `${c.atrPct.toFixed(2)}%`} per bar, need ${MIN_ATR_PCT}%)`, vi: `biểu đồ đi ngang (${c.atrPct == null ? 'không có dữ liệu' : `${c.atrPct.toFixed(2)}%`} mỗi nến, cần ${MIN_ATR_PCT}%)` }
  return null
}
