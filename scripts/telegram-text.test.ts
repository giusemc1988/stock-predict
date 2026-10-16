import assert from 'node:assert/strict'
import { buyText, sellText } from '../src/lib/telegramText'

// 2026-10-16 15:30 UTC = 11:30 ET (EDT) = 22:30 Vietnam
const at = Date.UTC(2026, 9, 16, 15, 30)

const buy = buyText({ symbol: 'NVDA', qty: 10, entry: 180.5, stop: 175, target: 190, reason: 'Breakout_on *volume*', at })
assert.equal(buy, ['Jarvis · PAPER TRADE', '🟢 BUY NVDA', 'Qty: 10 @ $180.50', 'Stop $175.00 · Target $190.00', 'Why: Breakout_on *volume*', '11:30 ET · 22:30 VN'].join('\n'))

const win = sellText({ symbol: 'NVDA', qty: 10, entry: 180.5, exit: 190, pnl: 95, retPct: 5.26, reason: 'Target hit', at })
assert.ok(win.includes('🟢 SELL NVDA') && win.includes('P&L: +$95.00 (+5.26%)') && win.includes('11:30 ET · 22:30 VN'))

const loss = sellText({ symbol: 'BTC/USDT', qty: 0.25, entry: 100, exit: 90, pnl: -2.5, retPct: -10, reason: 'Stop hit', at })
assert.ok(loss.includes('🔴 SELL BTC/USDT') && loss.includes('Qty: 0.25 @ $90.00') && loss.includes('P&L: -$2.50 (-10.00%)'))

assert.ok(buy.split('\n').length <= 6 && buy.length < 200)
console.log('telegram-text ok')
