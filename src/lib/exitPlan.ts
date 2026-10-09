/**
 * AI stop loss and scale-in / scale-out plan, each step with a plain-language reason
 * in English and Vietnamese. Stops use the recent swing when it is a sensible
 * distance away (1-3 ATR), otherwise 1.5 ATR. Scale-outs are in R, the distance from
 * entry to stop. Educational only, not financial advice. Paper trading only.
 */
import type { Candle, ExitPlan, PlanStep } from '../types'
import { ema } from './indicators'
import { fmtPrice } from './format'

const f = fmtPrice

export function exitPlan(candles: Candle[], side: 'BUY' | 'SELL', atr: number): ExitPlan | null {
  if (candles.length < 30 || !(atr > 0)) return null
  const close = candles.map((c) => c.close)
  const n = close.length - 1
  const entry = close[n]
  const e21 = ema(close, 21)[n] ?? entry
  const recent = candles.slice(-10)

  if (side === 'BUY') {
    const swingLow = Math.min(...recent.map((c) => c.low))
    const swingStop = swingLow - 0.25 * atr
    const swingDist = (entry - swingStop) / atr
    const useSwing = swingDist >= 1 && swingDist <= 3
    const stop = useSwing ? swingStop : entry - 1.5 * atr
    const r = entry - stop
    const dip = Math.max(e21, entry - 0.5 * r)
    const addOnDip = dip < entry - 0.1 * atr && dip > stop + 0.3 * r
    const steps: PlanStep[] = [
      {
        kind: 'in',
        label: { en: addOnDip ? 'Buy half now' : 'Buy now', vi: addOnDip ? 'Mua một nửa bây giờ' : 'Mua bây giờ' },
        price: entry,
        sharePct: addOnDip ? 50 : 100,
        why: {
          en: addOnDip ? 'Start with half so a quick dip costs less and gives you a better price for the rest.' : 'No sensible dip level above the stop, so the whole position goes in at once.',
          vi: addOnDip ? 'Bắt đầu với một nửa để nếu giá giảm nhanh thì thiệt hại ít hơn và mua phần còn lại với giá tốt hơn.' : 'Không có mức giảm hợp lý nào trên điểm cắt lỗ, nên vào toàn bộ một lần.',
        },
      },
      ...(addOnDip
        ? [
            {
              kind: 'in' as const,
              label: { en: 'Add the other half on a dip', vi: 'Mua nửa còn lại khi giá giảm' },
              price: dip,
              sharePct: 50,
              why: {
                en: `${f(dip)} is ${dip === e21 ? 'the 21-bar average, where pullbacks in an uptrend often stop' : 'halfway to the stop'}. Only add if price holds above it; never add below the stop.`,
                vi: `${f(dip)} là ${dip === e21 ? 'đường trung bình 21 nến, nơi các nhịp điều chỉnh trong xu hướng tăng thường dừng lại' : 'điểm giữa giá vào và điểm cắt lỗ'}. Chỉ mua thêm nếu giá giữ được trên mức này; không bao giờ mua thêm dưới điểm cắt lỗ.`,
              },
            },
          ]
        : []),
      {
        kind: 'out',
        label: { en: 'Sell 1/3 at 1R, move stop to entry', vi: 'Bán 1/3 tại 1R, dời cắt lỗ về giá vào' },
        price: entry + r,
        sharePct: 33,
        why: {
          en: `At ${f(entry + r)} you have made what you risked. Banking a third and moving the stop to ${f(entry)} makes the rest a free trade.`,
          vi: `Tại ${f(entry + r)} bạn đã lãi bằng số tiền chấp nhận rủi ro. Chốt 1/3 và dời cắt lỗ về ${f(entry)} giúp phần còn lại không còn rủi ro lỗ.`,
        },
      },
      {
        kind: 'out',
        label: { en: 'Sell 1/3 at 2R', vi: 'Bán 1/3 tại 2R' },
        price: entry + 2 * r,
        sharePct: 33,
        why: {
          en: `Twice the risk. This is the order ticket's take-profit, so the bracket can handle it for you.`,
          vi: `Gấp đôi mức rủi ro. Đây là mức chốt lời trong phiếu lệnh, nên lệnh kèm có thể tự xử lý.`,
        },
      },
      {
        kind: 'out',
        label: { en: 'Let the last 1/3 run', vi: 'Để 1/3 cuối tiếp tục chạy' },
        price: null,
        sharePct: 34,
        why: {
          en: `Trail it: exit if a bar closes below the 21-bar average (now ${f(e21)}) or 2 ATR under the highest close since entry. Big winners pay for the small losers.`,
          vi: `Dời cắt lỗ theo giá: thoát nếu nến đóng dưới đường trung bình 21 nến (hiện ${f(e21)}) hoặc thấp hơn 2 ATR so với giá đóng cao nhất kể từ khi vào. Các lệnh thắng lớn bù cho các lệnh thua nhỏ.`,
        },
      },
    ]
    return {
      entry,
      stop,
      target: entry + 2 * r,
      stopWhy: useSwing
        ? {
            en: `Just under the recent swing low of ${f(swingLow)}. If price breaks it, the buyers who held that level are gone and the idea is wrong.`,
            vi: `Ngay dưới đáy gần nhất ${f(swingLow)}. Nếu giá phá mức này, lực mua giữ giá đã mất và nhận định sai.`,
          }
        : {
            en: `1.5 ATR (${f(1.5 * atr)}) below entry: far enough that normal noise does not stop you out. The recent low at ${f(swingLow)} was ${swingDist < 1 ? 'too close' : 'too far'} to use.`,
            vi: `Thấp hơn giá vào 1.5 ATR (${f(1.5 * atr)}): đủ xa để dao động bình thường không kích hoạt cắt lỗ. Đáy gần nhất ${f(swingLow)} ${swingDist < 1 ? 'quá gần' : 'quá xa'} nên không dùng.`,
          },
      steps,
    }
  }

  // SELL: short selling is off, so this is a plan for reducing a position you hold.
  const swingHigh = Math.max(...recent.map((c) => c.high))
  const swingLow = Math.min(...recent.map((c) => c.low))
  const swingStop = swingHigh + 0.25 * atr
  const dist = (swingStop - entry) / atr
  const useSwing = dist >= 1 && dist <= 3
  const stop = useSwing ? swingStop : entry + 1.5 * atr
  const r = stop - entry
  return {
    entry,
    stop,
    target: entry - 2 * r,
    stopWhy: useSwing
      ? {
          en: `A close back above the recent swing high of ${f(swingHigh)} would mean sellers lost control, so the sell view is wrong.`,
          vi: `Nếu giá đóng cửa trở lại trên đỉnh gần nhất ${f(swingHigh)}, phe bán đã mất kiểm soát và nhận định bán là sai.`,
        }
      : {
          en: `1.5 ATR above the price (${f(stop)}). A move that far up would cancel the sell view.`,
          vi: `Cao hơn giá 1.5 ATR (${f(stop)}). Giá tăng đến mức đó sẽ hủy nhận định bán.`,
        },
    steps: [
      {
        kind: 'out',
        label: { en: 'If you hold it, sell half now', vi: 'Nếu đang giữ, bán một nửa bây giờ' },
        price: entry,
        sharePct: 50,
        why: {
          en: 'Cuts the risk in half while the signals point down, without betting everything on being right.',
          vi: 'Giảm một nửa rủi ro khi tín hiệu đi xuống, mà không đặt cược toàn bộ vào việc mình đúng.',
        },
      },
      {
        kind: 'out',
        label: { en: 'Sell the rest below the recent low', vi: 'Bán phần còn lại khi thủng đáy gần nhất' },
        price: swingLow,
        sharePct: 50,
        why: {
          en: `A break of ${f(swingLow)} confirms the downtrend. Selling there avoids holding through a bigger drop.`,
          vi: `Thủng ${f(swingLow)} xác nhận xu hướng giảm. Bán tại đó để tránh giữ qua đợt giảm sâu hơn.`,
        },
      },
    ],
  }
}
