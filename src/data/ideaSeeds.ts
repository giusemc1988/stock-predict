/**
 * Seed ideas for the Atlas idea factory (src/lib/ideaFactory.ts): hypotheses written by Claude (Opus) on
 * 2026-11-02 after reading what already failed in the labs (textbook reversal, 52-week high, RSI(2), gaps,
 * FOMC, turn of month, news, insiders, 12-1 momentum). They lean on crowd behaviour rather than books:
 * exhausted sellers, quiet accumulation, strength while the market is weak. Each is only a starting point:
 * the search mutates and crosses them, and every rule is judged the same way.
 *
 * To add ideas later: ask Claude "nghĩ thêm ý tưởng". It reads public/idea-factory.json (what died and why)
 * and appends new seeds here with a new id. Thresholds are quantile LEVEL indexes:
 * 0=5% 1=10% 2=20% 3=30% 4=50% 5=70% 6=80% 7=90% 8=95% of the discovery years.
 */
import type { Rule } from '../lib/ideaFactory'

export interface Seed {
  id: string
  rule: Omit<Rule, 'origin'>
  /** why it might work, in plain words */
  why: { en: string; vi: string }
}

const c = (f: Rule['conds'][number]['f'], op: '<' | '>', q: number) => ({ f, op, q })

export const SEEDS: Seed[] = [
  { id: 'O1', rule: { conds: [c('r1', '<', 0), c('vol', '>', 8), c('clv', '>', 5)], hold: 3, stop: null }, why: { en: 'Panic selling on huge volume, but the close is well off the low: the last sellers are out.', vi: 'Bán tháo với khối lượng rất lớn nhưng đóng cửa xa đáy: người bán cuối cùng đã ra hết.' } },
  { id: 'O2', rule: { conds: [c('atrp', '<', 2), c('d52', '>', 7)], hold: 10, stop: 3 }, why: { en: 'Near the yearly high while moving very little: a coiled spring, nobody wants to sell.', vi: 'Sát đỉnh năm mà dao động rất ít: như lò xo bị nén, không ai muốn bán.' } },
  { id: 'O3', rule: { conds: [c('spy5', '<', 1), c('rel5', '>', 7)], hold: 5, stop: null }, why: { en: 'Up while the market sinks: someone big is buying through the fear.', vi: 'Thị trường chìm mà mã này vẫn tăng: có tay to đang gom bất chấp nỗi sợ.' } },
  { id: 'O4', rule: { conds: [c('gap', '<', 0), c('clv', '>', 6)], hold: 2, stop: null }, why: { en: 'Opened with a big gap down, then closed near the high: the bad news was already priced in.', vi: 'Mở cửa gap giảm mạnh rồi đóng cửa gần đỉnh: tin xấu đã được tính vào giá.' } },
  { id: 'O5', rule: { conds: [c('d200', '>', 5), c('r5', '<', 1)], hold: 5, stop: null }, why: { en: 'A sharp week drop inside a strong uptrend: a dip that trend followers buy.', vi: 'Giảm mạnh trong tuần nhưng vẫn trong xu hướng tăng: nhịp chỉnh mà người theo xu hướng sẽ mua.' } },
  { id: 'O6', rule: { conds: [c('down', '>', 8), c('spyTrend', '>', 3)], hold: 3, stop: null }, why: { en: 'Down many days in a row while the market is healthy: the streak is tired.', vi: 'Giảm nhiều ngày liên tiếp trong khi thị trường khỏe: chuỗi giảm đã mệt.' } },
  { id: 'O7', rule: { conds: [c('rng', '<', 1), c('d200', '>', 4)], hold: 5, stop: 2 }, why: { en: 'The narrowest day in an uptrend: calm before the next leg.', vi: 'Nến hẹp nhất trong xu hướng tăng: yên lặng trước chặng tăng tiếp.' } },
  { id: 'O8', rule: { conds: [c('vol', '<', 1), c('r5', '<', 2), c('d200', '>', 4)], hold: 5, stop: null }, why: { en: 'Pulling back on almost no volume: nobody is really selling, it just drifts.', vi: 'Giá lùi mà gần như không có khối lượng: không ai thật sự bán, chỉ trôi nhẹ.' } },
  { id: 'O9', rule: { conds: [c('spy5', '<', 0), c('r5', '<', 1)], hold: 10, stop: null }, why: { en: 'A market-wide flush: everything is sold together, good or bad.', vi: 'Thị trường xả hàng đồng loạt: tốt xấu đều bị bán cùng lúc.' } },
  { id: 'O10', rule: { conds: [c('d52', '>', 8), c('vol', '>', 7), c('clv', '>', 6)], hold: 20, stop: 3 }, why: { en: 'A new high on heavy volume and a strong close: real demand, not a drift.', vi: 'Lên đỉnh mới với khối lượng lớn và đóng cửa mạnh: cầu thật, không phải trôi.' } },
  { id: 'O11', rule: { conds: [c('rel5', '<', 0), c('spyTrend', '>', 5)], hold: 5, stop: null }, why: { en: 'The week’s worst laggard in a strong market: money rotates back to it.', vi: 'Mã tụt lại xa nhất tuần trong thị trường mạnh: tiền sẽ xoay vòng quay lại.' } },
  { id: 'O12', rule: { conds: [c('clv', '>', 8), c('r1', '>', 6), c('vol', '>', 5)], hold: 1, stop: null }, why: { en: 'Closed at the very top on volume: buyers were still chasing at the bell.', vi: 'Đóng cửa sát đỉnh với khối lượng: người mua vẫn đuổi tới phút cuối.' } },
  { id: 'O13', rule: { conds: [c('gap', '>', 8), c('clv', '>', 5)], hold: 10, stop: 3 }, why: { en: 'A big gap up that held all day: news the market believes.', vi: 'Gap tăng mạnh và giữ được cả ngày: tin mà thị trường tin là thật.' } },
  { id: 'O14', rule: { conds: [c('atrp', '<', 1), c('spyTrend', '>', 4)], hold: 20, stop: null }, why: { en: 'Very calm names in a calm market: slow, steady climbers.', vi: 'Mã rất êm trong thị trường êm: leo chậm mà chắc.' } },
  { id: 'O15', rule: { conds: [c('rsi2', '<', 0), c('spyTrend', '>', 4)], hold: 3, stop: null }, why: { en: 'Extremely oversold for two days while the market trend is up.', vi: 'Quá bán cực độ hai ngày trong khi thị trường đang tăng.' } },
  { id: 'O16', rule: { conds: [c('clv', '>', 7), c('r1', '<', 3), c('rng', '>', 6)], hold: 3, stop: null }, why: { en: 'A long tail under the candle: sellers pushed hard and lost.', vi: 'Nến có râu dưới dài: phe bán đẩy mạnh nhưng thua.' } },
  { id: 'O17', rule: { conds: [c('d200', '<', 1), c('r5', '>', 7)], hold: 10, stop: 3 }, why: { en: 'Far below its long average but the best week in a while: an early turn.', vi: 'Còn xa dưới MA200 nhưng có tuần tăng mạnh: dấu hiệu quay đầu sớm.' } },
  { id: 'O18', rule: { conds: [c('r20', '<', 0), c('r1', '>', 7)], hold: 5, stop: null }, why: { en: 'A big monthly loser with a strong day: the first buyers are back.', vi: 'Mã giảm mạnh cả tháng có một ngày tăng mạnh: người mua đầu tiên đã quay lại.' } },
  { id: 'O19', rule: { conds: [c('r20', '>', 6), c('atrp', '<', 3)], hold: 10, stop: 2 }, why: { en: 'A good month without wild swings: quality momentum.', vi: 'Một tháng tăng tốt mà không giật mạnh: động lượng chất lượng.' } },
  { id: 'O20', rule: { conds: [c('vol', '>', 8), c('r1', '>', 3), c('r1', '<', 5)], hold: 10, stop: null }, why: { en: 'Huge volume but the price barely moved: someone absorbs every sale (quiet accumulation).', vi: 'Khối lượng khổng lồ mà giá gần như đứng yên: có người hấp thụ mọi lệnh bán (gom âm thầm).' } },
  { id: 'O21', rule: { conds: [c('spy1', '<', 1), c('r1', '>', 6)], hold: 5, stop: null }, why: { en: 'Green on a red market day: it has its own buyers.', vi: 'Tăng trong ngày thị trường đỏ: mã có người mua riêng.' } },
  { id: 'O22', rule: { conds: [c('rng', '<', 2), c('d52', '>', 6), c('atrp', '<', 3)], hold: 10, stop: 2 }, why: { en: 'Tightening near the high: the classic squeeze before a breakout, judged without the textbook.', vi: 'Co hẹp sát đỉnh: kiểu nén trước khi bứt phá, nhưng để máy tự chấm.' } },
  { id: 'O23', rule: { conds: [c('r20', '<', 1), c('atrp', '<', 4)], hold: 20, stop: 3 }, why: { en: 'Fell a lot over a month but is now calm: the storm passed.', vi: 'Giảm nhiều cả tháng nhưng giờ đã êm: cơn bão đã qua.' } },
  { id: 'O24', rule: { conds: [c('spy1', '<', 0), c('d200', '>', 5)], hold: 3, stop: null }, why: { en: 'A sharp market drop day hits strong names too: buy the strong ones cheap.', vi: 'Ngày thị trường rơi mạnh kéo cả mã khỏe xuống: mua mã khỏe giá rẻ.' } },
  { id: 'O25', rule: { conds: [c('clv', '>', 6), c('rng', '>', 7), c('vol', '>', 6)], hold: 2, stop: null }, why: { en: 'A wide day on volume that closes high: the fight ended with buyers on top.', vi: 'Nến dài, khối lượng lớn và đóng cửa cao: trận chiến kết thúc với phe mua thắng.' } },
  { id: 'O26', rule: { conds: [c('gap', '>', 7), c('vol', '<', 4)], hold: 3, stop: null }, why: { en: 'A gap up nobody traded: thin and easy to push higher.', vi: 'Gap tăng mà ít người giao dịch: hàng mỏng, dễ đẩy lên tiếp.' } },
  { id: 'O27', rule: { conds: [c('d52', '>', 6), c('r5', '<', 1)], hold: 5, stop: 2 }, why: { en: 'A leader near its high that had a bad week: the leaders get bought back first.', vi: 'Mã dẫn đầu sát đỉnh vừa có tuần xấu: mã dẫn đầu thường được mua lại trước.' } },
  { id: 'O28', rule: { conds: [c('d200', '>', 8), c('rsi2', '<', 3)], hold: 5, stop: null }, why: { en: 'Far above its long average and resting for two days: a breather, not the end.', vi: 'Cao xa trên MA200 và nghỉ hai ngày: chỉ là lấy hơi, chưa phải kết thúc.' } },
  { id: 'O29', rule: { conds: [c('r5', '<', 0), c('vol', '>', 7)], hold: 10, stop: 3 }, why: { en: 'A capitulation week on heavy volume: the weak hands are flushed out.', vi: 'Tuần đầu hàng với khối lượng lớn: tay yếu đã bị rũ ra hết.' } },
  { id: 'O30', rule: { conds: [c('down', '>', 7), c('gap', '>', 6)], hold: 3, stop: null }, why: { en: 'A losing streak broken by a gap up: the mood just flipped.', vi: 'Chuỗi giảm bị phá bởi gap tăng: tâm lý vừa đổi chiều.' } },
]
