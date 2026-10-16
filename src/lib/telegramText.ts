export interface BuyInfo {
  symbol: string
  qty: number
  entry: number
  stop: number
  target: number
  reason: string
  at: number
}

export interface SellInfo {
  symbol: string
  qty: number
  entry: number
  exit: number
  pnl: number
  retPct: number
  reason: string
  at: number
}

const stamp = (ms: number) => {
  const f = (tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)
  return `${f('America/New_York')} ET · ${f('Asia/Ho_Chi_Minh')} VN`
}

const usd = (n: number) => `$${n.toFixed(2)}`
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${usd(Math.abs(n))}`
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, ''))

export const buyText = (b: BuyInfo) =>
  [`Jarvis · PAPER TRADE`, `🟢 BUY ${b.symbol}`, `Qty: ${qty(b.qty)} @ ${usd(b.entry)}`, `Stop ${usd(b.stop)} · Target ${usd(b.target)}`, `Why: ${b.reason}`, stamp(b.at)].join('\n')

export const sellText = (s: SellInfo) =>
  [`Jarvis · PAPER TRADE`, `${s.pnl >= 0 ? '🟢' : '🔴'} SELL ${s.symbol}`, `Qty: ${qty(s.qty)} @ ${usd(s.exit)} (entry ${usd(s.entry)})`, `P&L: ${signed(s.pnl)} (${s.retPct >= 0 ? '+' : ''}${s.retPct.toFixed(2)}%)`, `Why: ${s.reason}`, stamp(s.at)].join('\n')
