import assert from 'node:assert/strict'
import { buyText, sellText, summaryText } from '../src/lib/telegramText'
import type { DailyReport } from '../src/lib/dailyReport'

// 2026-10-16 15:30 UTC = 11:30 ET (EDT) = 22:30 Vietnam
const at = Date.UTC(2026, 9, 16, 15, 30)

const buy = buyText({ symbol: 'NVDA', qty: 10, entry: 180.5, stop: 175, target: 190, reason: 'hạng 1/4 lệnh MUA, +3.2% hôm nay, khối lượng 2.1x bình thường', at })
assert.equal(
  buy,
  ['🟢 MUA NVDA (trong ngày)', 'SL 10 @ $180.50', '🎯 Chốt lời $190.00 (+5.3%)', '🛑 Cắt lỗ $175.00 (−3.0%)', '💬 hạng 1/4 lệnh MUA, +3.2% hôm nay, khối lượng 2.1x bình thường', '🕐 22:30 VN'].join('\n'),
)
assert.ok(buyText({ symbol: 'X', qty: 1, entry: 1, stop: 0.9, target: 1.2, reason: 'a'.repeat(300), at }).length < 220)

const win = sellText({ symbol: 'NVDA', qty: 10, entry: 180.5, exit: 190, pnl: 95, retPct: 5.26, reason: 'target', at })
assert.equal(win, ['✅ THẮNG NVDA +$95.00 (+5.26%)', '$180.50 → $190.00 · SL 10', '💬 chạm chốt lời', '🕐 22:30 VN'].join('\n'))

const loss = sellText({ symbol: 'BTC/USDT', qty: 0.25, entry: 100, exit: 90, pnl: -2.5, retPct: -10, reason: 'stop', at })
assert.ok(loss.startsWith('❌ THUA BTC/USDT −$2.50 (−10.00%)') && loss.includes('SL 0.25') && loss.includes('chạm cắt lỗ'))

const report: DailyReport = {
  day: '2026-10-22',
  trades: 3,
  wins: 1,
  net: -12.4,
  gross: -8,
  costs: 4.4,
  opened: 3,
  rejected: 14,
  topRejects: [{ check: 'Risk gate', n: 9 }],
  review: { skill: 1, lucky: 0, unlucky: 2, mistake: 0 },
  best: null,
  worst: null,
  lessons: [
    { en: '', vi: '3 lệnh đã đóng, 1 lệnh thắng. Ròng −$12.40 sau $4.40 chi phí.' },
    { en: '', vi: '2 lệnh thua đúng quy tắc: chi phí bình thường của giao dịch.' },
    { en: '', vi: 'Bị từ chối nhiều nhất bởi: Risk gate (9).' },
  ],
}
const trades = [
  { symbol: 'AAPL', pnl: -20.1, retPct: -1.9, exitReason: 'stop' },
  { symbol: 'NVDA', pnl: 15.2, retPct: 1.4, exitReason: 'target' },
  { symbol: 'TSLA', pnl: -7.5, retPct: -0.6, exitReason: 'close' },
]
const sum = summaryText({ day: '2026-10-22', report, trades, equity: 9868.7, totalRetPct: -1.31, learning: 'tạm dừng (WR 34%)', brakes: 'bình thường' })
const lines = sum.split('\n')
assert.equal(lines[0], '📊 TỔNG KẾT 22/10 · lệnh tập')
assert.equal(lines[1], 'Ròng −$12.40 · 1 thắng / 2 thua (33%)')
assert.equal(lines[2], 'Vốn $9,868.70 (−1.31% từ đầu)')
assert.equal(lines[5], '✅ NVDA +$15.20 · chạm chốt lời')
assert.ok(!sum.includes('3 lệnh đã đóng'))
assert.ok(sum.includes('• Bị từ chối nhiều nhất bởi: Risk gate (9).'))
assert.ok(sum.endsWith('⚙️ AI tự học: tạm dừng (WR 34%) · Phanh: bình thường'))

const many = Array.from({ length: 14 }, (_, i) => ({ symbol: `S${i}`, pnl: i - 7, retPct: 0, exitReason: 'stop' }))
assert.ok(summaryText({ day: '2026-10-22', report, trades: many, equity: 1, totalRetPct: 0, learning: '', brakes: '' }).includes('… và 4 lệnh khác'))

if (process.env.SHOW) console.log([buy, win, loss, sum].join('\n\n-----\n\n'))
console.log('telegram-text ok')
