import type { DailyReport } from './dailyReport'

export type ExitCode = 'target' | 'stop' | 'signal' | 'time' | 'close' | 'hold'

export interface BuyInfo {
  symbol: string
  qty: number
  entry: number
  stop: number
  target: number
  /** Why it was picked, in plain words. */
  reason: string
  at: number
  kind?: 'day' | 'long'
}

export interface SellInfo {
  symbol: string
  qty: number
  entry: number
  exit: number
  pnl: number
  retPct: number
  reason: ExitCode | string
  at: number
}

export interface SummaryTrade {
  symbol: string
  pnl: number
  retPct: number
  exitReason: ExitCode | string
}

export interface SummaryInfo {
  day: string
  report: DailyReport
  trades: SummaryTrade[]
  equity: number
  /** Return since the account started, percent. */
  totalRetPct: number
  learning: string
  brakes: string
}

const EXIT_VI: Record<ExitCode, string> = {
  target: 'chạm chốt lời',
  stop: 'chạm cắt lỗ',
  signal: 'AI chuyển sang BÁN',
  time: 'giá không chạy, đóng sớm',
  close: 'đóng trước giờ đóng cửa',
  hold: 'hết thời gian giữ',
}
export const exitVi = (r: string) => EXIT_VI[r as ExitCode] ?? r

const vnTime = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)
const usd = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${usd(n)}`
const pct = (n: number, d = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}%`
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, ''))
const clip = (s: string, max = 90) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

export const buyText = (b: BuyInfo) =>
  [
    `🟢 MUA ${b.symbol}${b.kind === 'long' ? ' (dài hạn)' : ' (trong ngày)'}`,
    `SL ${qty(b.qty)} @ ${usd(b.entry)}`,
    `🎯 Chốt lời ${usd(b.target)} (${pct(((b.target - b.entry) / b.entry) * 100)})`,
    `🛑 Cắt lỗ ${usd(b.stop)} (${pct(((b.stop - b.entry) / b.entry) * 100)})`,
    `💬 ${clip(b.reason)}`,
    `🕐 ${vnTime(b.at)} VN`,
  ].join('\n')

export const sellText = (s: SellInfo) =>
  [
    `${s.pnl > 0 ? '✅ THẮNG' : '❌ THUA'} ${s.symbol} ${signed(s.pnl)} (${pct(s.retPct, 2)})`,
    `${usd(s.entry)} → ${usd(s.exit)} · SL ${qty(s.qty)}`,
    `💬 ${exitVi(s.reason)}`,
    `🕐 ${vnTime(s.at)} VN`,
  ].join('\n')

const MAX_ROWS = 10

export function summaryText(x: SummaryInfo): string {
  const r = x.report
  const [, m, d] = x.day.split('-')
  const losses = r.trades - r.wins
  const lines = [
    `📊 TỔNG KẾT ${d}/${m} · lệnh tập`,
    r.trades ? `Ròng ${signed(r.net)} · ${r.wins} thắng / ${losses} thua (${Math.round((r.wins / r.trades) * 100)}%)` : 'Hôm nay không có lệnh nào đóng.',
    `Vốn ${usd(x.equity)} (${pct(x.totalRetPct, 2)} từ đầu)`,
  ]
  if (x.trades.length) {
    const sorted = [...x.trades].sort((a, b) => b.pnl - a.pnl)
    lines.push('', 'Các lệnh:')
    for (const t of sorted.slice(0, MAX_ROWS)) lines.push(`${t.pnl > 0 ? '✅' : '❌'} ${t.symbol} ${signed(t.pnl)} · ${exitVi(t.exitReason)}`)
    if (sorted.length > MAX_ROWS) lines.push(`… và ${sorted.length - MAX_ROWS} lệnh khác`)
  }
  // the first lesson repeats the totals above
  const lessons = r.trades ? r.lessons.slice(1) : r.lessons.filter((l) => !l.vi.startsWith('Hôm nay không'))
  if (lessons.length) lines.push('', '💡 Bài học:', ...lessons.map((l) => `• ${l.vi}`))
  lines.push('', `⚙️ AI tự học: ${x.learning} · Phanh: ${x.brakes}`)
  return lines.join('\n')
}
