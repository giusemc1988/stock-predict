/**
 * Atlas control dashboard: one "Check the system" press turns the practice state and the nightly reports
 * into health lights, a to-do list in plain words, the 6-step map, a learner leaderboard and upgrade ideas.
 * Every to-do and idea carries a ready prompt; "Do this" files it as an agent-task issue (src/lib/hubTasks.ts)
 * that Claude works through when Chanh says "làm hàng chờ Atlas". Pure functions, no I/O, nothing trades.
 */
import { dayKey, PRACTICE_START, type PracticeState, type PracticeTrade } from './practice'
import { REVIEW_DAY, whyToday } from './atlasSignals'
import type { FactoryReport } from './ideaFactoryView'
import type { LeadsReport } from './shadowLeads'

type Bi = { en: string; vi: string }
export type Level = 'ok' | 'warn' | 'bad' | 'off'

/** The bar every learner must clear to be called trusted (same as the idea-factory slots). */
export const PASS = { n: 20, winRate: 55 }
const HOUR = 3_600_000

export interface ControlInput {
  s: PracticeState
  now: number
  factory: FactoryReport | null
  leaders: { generated: string; universe: number; leaders?: unknown[] } | null
  leads: LeadsReport | null
  /** the Leaders tight-base paper slot (public/leaders-paper.json) */
  paper?: { score: { graded: number; winRate: number | null; avgPct: number | null; status: string }; watching?: unknown[]; open?: unknown[] } | null
}

export interface Check {
  id: string
  /** the light's name */
  part: Bi
  level: Level
  /** short status under the light */
  status: Bi
  /** to-do title and detail, shown when level is warn or bad */
  title: Bi
  detail: Bi
  /** ready prompt for Claude; null when there is nothing to do */
  prompt: string | null
}

// ---- prompts ----

const RULES = [
  'Repo giusemc1988/stock-predict is PUBLIC: never commit keys or private data.',
  'Paper trading only. Any change to trading logic or thresholds: explain it to Chanh first in plain Vietnamese.',
  'Every change bumps package.json + src/data/releases.ts (What\'s new EN+VI) + the Atlas agent version (src/data/agentVersions.ts).',
  'Follow the Neo theme, one even grid, check screenshots at 360/390/820px.',
  'Run npx tsc -b, npm test, npm run build before the PR; report to Chanh in short Vietnamese.',
]

export function taskPrompt(t: { goal: string; evidence: string[]; scope: string[]; done: string }): string {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n')
  return [`Atlas task: ${t.goal}`, '', `1. Goal\n${t.goal}`, `2. Evidence (from "Kiểm tra hệ thống")\n${list(t.evidence)}`, `3. Scope and rules\n${list([...t.scope, ...RULES])}`, '4. Verify\n- Tests and build pass; screenshots if the UI changed.', `5. Done when\n${t.done}`].join('\n\n')
}

// ---- numbers ----

const r1 = (x: number) => Math.round(x * 10) / 10
const pf = (ts: PracticeTrade[]) => {
  const win = ts.filter((t) => t.pnl > 0).reduce((a, t) => a + t.pnl, 0)
  const loss = -ts.filter((t) => t.pnl < 0).reduce((a, t) => a + t.pnl, 0)
  return loss > 0 ? Math.round((win / loss) * 100) / 100 : null
}
const wr = (ts: PracticeTrade[]) => (ts.length ? Math.round((ts.filter((t) => t.pnl > 0).length / ts.length) * 100) : null)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export interface Kpis {
  equity: number
  returnPct: number
  winRate: number | null
  /** win rate of the last 20 closed trades (the learner pauses under 40%) */
  recentWinRate: number | null
  pf: number | null
  /** PF of the trades before the last 20, to show the direction */
  pfBefore: number | null
  avgWin: number
  avgLoss: number
  today: { n: number; wins: number; pnl: number }
  /** equity at the end of each of the last 7 days with trades */
  spark: number[]
}

export function kpis(s: PracticeState, now: number): Kpis {
  const ts = s.trades
  const equity = PRACTICE_START + s.realized
  const sorted = [...ts].sort((a, b) => a.closedAt - b.closedAt)
  const last20 = sorted.slice(-20)
  const today = ts.filter((t) => dayKey(t.closedAt) === dayKey(now))
  const byDay = new Map<string, number>()
  for (const c of s.curve) byDay.set(dayKey(c.t), c.equity)
  return {
    equity: Math.round(equity * 100) / 100,
    returnPct: r1(((equity - PRACTICE_START) / PRACTICE_START) * 100),
    winRate: wr(ts),
    recentWinRate: wr(last20),
    pf: pf(ts),
    pfBefore: sorted.length > 40 ? pf(sorted.slice(0, -20)) : null,
    avgWin: Math.round(avg(ts.filter((t) => t.pnl > 0).map((t) => t.pnl)) * 100) / 100,
    avgLoss: Math.round(avg(ts.filter((t) => t.pnl < 0).map((t) => t.pnl)) * 100) / 100,
    today: { n: today.length, wins: today.filter((t) => t.pnl > 0).length, pnl: Math.round(today.reduce((a, t) => a + t.pnl, 0) * 100) / 100 },
    spark: [...byDay.values()].slice(-7),
  }
}

// ---- market clock ----

/** US cash session in UTC as the Worker cron runs it: 13:00-21:55, Monday to Friday. */
export function marketOpen(now: number): boolean {
  const d = new Date(now)
  const wd = d.getUTCDay()
  const m = d.getUTCHours() * 60 + d.getUTCMinutes()
  return wd >= 1 && wd <= 5 && m >= 13 * 60 + 30 && m <= 21 * 60 + 55
}

/** Hours a nightly report may be old before it counts as late (the weekend adds two days). */
const nightlyLimit = (now: number) => ([0, 1].includes(new Date(now).getUTCDay()) ? 80 : 32)
const agoVi = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} phút trước` : h < 48 ? `${Math.round(h)} giờ trước` : `${Math.round(h / 24)} ngày trước`)
const agoEn = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`)

// ---- the checks ----

export function systemCheck(x: ControlInput): Check[] {
  const { s, now } = x
  const k = kpis(s, now)
  const out: Check[] = []
  const C = (c: Check) => out.push(c)

  // 1. nightly whole-market scan ("Dẫn đầu" leaders)
  const lh = x.leaders ? (now - Date.parse(x.leaders.generated)) / HOUR : null
  const lOk = lh != null && lh <= nightlyLimit(now)
  C({
    id: 'leaders',
    part: { en: 'Nightly scan', vi: 'Quét tối' },
    level: lh == null ? 'bad' : lOk ? 'ok' : 'warn',
    status: lh == null ? { en: 'no report', vi: 'chưa có báo cáo' } : { en: `${agoEn(lh)} · ${x.leaders!.universe} names`, vi: `${agoVi(lh)} · ${x.leaders!.universe} mã` },
    title: { en: 'The nightly leaders scan is late', vi: 'Quét "Dẫn đầu" mỗi tối bị trễ' },
    detail: { en: lh == null ? 'leaders.json could not be read.' : `Last report ${agoEn(lh)}.`, vi: lh == null ? 'Không đọc được leaders.json.' : `Báo cáo gần nhất ${agoVi(lh)}.` },
    prompt: lOk ? null : taskPrompt({ goal: 'Find why the nightly leaders scan (public/leaders.json) is late or missing and fix it.', evidence: [lh == null ? 'public/leaders.json missing or unreadable' : `public/leaders.json generated ${x.leaders!.generated} (${Math.round(lh)} h ago)`], scope: ['Look at the leaders workflow run logs and scripts that write public/leaders.json.'], done: 'A fresh leaders.json lands and the "Quét tối" light is green.' }),
  })

  // 2. the 5-minute trading cycle (filter + paper trades)
  const last = s.server?.lastRun ?? null
  const rh = last ? (now - last) / HOUR : null
  const open = marketOpen(now)
  const late = rh == null || (open ? rh > 0.5 : rh > 80)
  const failed = s.server?.failed?.length ?? 0
  C({
    id: 'cycle',
    part: { en: 'Filter + trade', vi: 'Lọc + Thử' },
    level: late ? 'bad' : failed > 3 ? 'warn' : 'ok',
    status: rh == null ? { en: 'never ran', vi: 'chưa chạy lần nào' } : { en: `every 5 min · ${agoEn(rh)}${failed ? ` · ${failed} failed` : ''}`, vi: `5 phút/lần · ${agoVi(rh)}${failed ? ` · ${failed} mã lỗi` : ''}` },
    title: late ? { en: 'Atlas has stopped running', vi: 'Atlas đã ngừng chạy' } : { en: `${failed} names failed to load`, vi: `${failed} mã không tải được giá` },
    detail: late ? { en: open ? 'Market is open but the last run is over 30 minutes old.' : 'No run for over 3 days.', vi: open ? 'Thị trường đang mở nhưng lần chạy cuối đã hơn 30 phút.' : 'Hơn 3 ngày không chạy.' } : { en: `Failed: ${(s.server?.failed ?? []).slice(0, 6).join(', ')}`, vi: `Lỗi: ${(s.server?.failed ?? []).slice(0, 6).join(', ')}` },
    prompt: late || failed > 3 ? taskPrompt({ goal: late ? 'Atlas stopped running: find why and fix it.' : 'Several names fail to load in the Atlas cycle: find why and fix it.', evidence: [`server.lastRun ${last ? new Date(last).toISOString() : 'never'}`, `market open now: ${open}`, `failed names: ${(s.server?.failed ?? []).join(', ') || 'none'}`], scope: ['Check https://atlas-status.chanhmn1011.workers.dev/ diag.cronLast first, then src/worker/practiceCycle.ts.', 'Fixing a broken run is pre-approved (PR, tests, merge).'], done: 'diag.lastRun is fresh and the "Lọc + Thử" light is green.' }) : null,
  })

  // 3. learning: the learner pauses when the last 20 trades win under 40%
  const rw = k.recentWinRate
  C({
    id: 'learn',
    part: { en: 'Learning', vi: 'Ghi sổ, học' },
    level: rw == null ? 'off' : rw < 40 ? 'bad' : rw < 45 ? 'warn' : 'ok',
    status: rw == null ? { en: 'no trades yet', vi: 'chưa có lệnh' } : rw < 40 ? { en: `paused · last 20 win ${rw}%`, vi: `tạm dừng · 20 lệnh gần thắng ${rw}%` } : { en: `learning · last 20 win ${rw}%`, vi: `đang học · 20 lệnh gần thắng ${rw}%` },
    title: rw != null && rw < 40 ? { en: 'Learning paused: recent win rate under 40%', vi: 'Bộ học tạm dừng: 20 lệnh gần nhất thắng dưới 40%' } : { en: 'Win rate close to the learning stop line', vi: 'Tỉ lệ thắng sát ngưỡng dừng học' },
    detail: { en: `Last 20 trades win ${rw}%. Under 40% the learner stops to avoid learning from a bad streak.`, vi: `20 lệnh gần nhất thắng ${rw}%. Dưới 40% bộ học tự dừng để không học nhầm từ chuỗi xấu.` },
    prompt: rw != null && rw < 45 ? taskPrompt({ goal: 'Explain why recent Atlas trades lose and propose (not apply) a fix.', evidence: [`last 20 trades win ${rw}%`, `all-time win ${k.winRate}%`, `PF ${k.pf}`], scope: ['Read atlas/LESSONS.md and the practice backup on branch backups.', 'Analysis + proposal only; no trading-logic change without Chanh\'s OK.'], done: 'Chanh gets a short Vietnamese explanation with 1-3 proposed fixes.' }) : null,
  })

  // 4. losers bigger than winners (PF)
  const p = k.pf
  C({
    id: 'pf',
    part: { en: 'Profit factor', vi: 'Lãi/lỗ (PF)' },
    level: p == null ? 'off' : p < 0.8 ? 'bad' : p < 1 ? 'warn' : 'ok',
    status: p == null ? { en: 'no trades yet', vi: 'chưa có lệnh' } : { en: `PF ${p}${k.pfBefore != null ? ` (was ${k.pfBefore})` : ''}`, vi: `PF ${p}${k.pfBefore != null ? ` (trước ${k.pfBefore})` : ''}` },
    title: { en: 'Losing trades are bigger than winning ones', vi: 'Lệnh thua lỗ to hơn lệnh thắng' },
    detail: { en: `Average win $${k.avgWin}, average loss $${Math.abs(k.avgLoss)}. PF under 1 means losing after costs.`, vi: `Thắng TB $${k.avgWin}, thua TB $${Math.abs(k.avgLoss)}. PF dưới 1 là đang lỗ sau phí.` },
    prompt: p != null && p < 1 ? taskPrompt({ goal: 'Find why Atlas losing trades are bigger than winners (PF under 1) and propose a fix.', evidence: [`PF ${p}${k.pfBefore != null ? `, before the last 20 trades ${k.pfBefore}` : ''}`, `avg win $${k.avgWin}, avg loss $${k.avgLoss}`, `${s.trades.length} closed trades`], scope: ['Split losses by exit reason (stop gap, close, signal), kind (day/long), source and entry time; use the backup on branch backups.', 'Proposal only; trading-logic changes need Chanh\'s OK.'], done: 'Chanh gets the main cause with numbers and 1-3 fixes to approve.' }) : null,
  })

  // 5. idea factory nightly run + slots
  const fh = x.factory ? (now - Date.parse(x.factory.generated)) / HOUR : null
  const fOk = fh != null && fh <= nightlyLimit(now)
  C({
    id: 'factory',
    part: { en: 'Idea factory', vi: 'Xưởng ý tưởng' },
    level: fh == null ? 'warn' : fOk ? 'ok' : 'warn',
    status: fh == null ? { en: 'no report', vi: 'chưa có báo cáo' } : { en: `${agoEn(fh)} · ${x.factory!.slots?.length ?? 0} slots`, vi: `${agoVi(fh)} · ${x.factory!.slots?.length ?? 0} ô thử` },
    title: { en: 'The idea factory nightly run is late', vi: 'Xưởng ý tưởng chạy đêm bị trễ' },
    detail: { en: fh == null ? 'idea-factory.json could not be read.' : `Last run ${agoEn(fh)}.`, vi: fh == null ? 'Không đọc được idea-factory.json.' : `Lần chạy cuối ${agoVi(fh)}.` },
    prompt: fOk ? null : taskPrompt({ goal: 'Find why the idea-factory nightly run is late and fix it.', evidence: [fh == null ? 'public/idea-factory.json missing' : `generated ${x.factory!.generated}`], scope: ['Check the idea-factory.yml run logs.'], done: 'A fresh idea-factory.json and a green light.' }),
  })

  // 6. grading: any slot with enough signals?
  const slots = [...(x.factory?.slots ?? []), ...(x.paper ? [{ key: 'leaders-tight-base', ...x.paper.score, waiting: 0 }] : [])]
  const working = slots.filter((sl) => sl.status === 'working')
  const graded = slots.filter((sl) => sl.graded >= PASS.n).length
  C({
    id: 'grade',
    part: { en: 'Grading', vi: 'Chấm điểm' },
    level: working.length ? 'warn' : 'ok',
    status: working.length ? { en: `${working.length} trusted, waiting to be promoted`, vi: `${working.length} đáng tin, chờ lên chức` } : { en: `${graded}/${slots.length} graded, none trusted yet`, vi: `${graded}/${slots.length} đủ bài, chưa ai đáng tin` },
    title: { en: `${working.length} strategy passed: promote it?`, vi: `${working.length} cách chơi đã đậu: cho lên chức?` },
    detail: { en: working.map((w) => `${w.key}: ${w.winRate}% over ${w.graded}`).join(' · '), vi: working.map((w) => `${w.key}: thắng ${w.winRate}% / ${w.graded} bài`).join(' · ') },
    prompt: working.length ? taskPrompt({ goal: 'Promote the trusted idea-factory slots into the main paper book.', evidence: working.map((w) => `${w.key}: ${w.graded} graded, ${w.winRate}% wins, avg ${w.avgPct}%`), scope: ['Pressing "Do this" is Chanh\'s approval for this promotion; keep it paper only and easy to switch off.'], done: 'The slot trades in the main paper book and shows as promoted.' }) : null,
  })

  // 7. shadow tests: due on REVIEW_DAY
  const due = dayKey(now) >= REVIEW_DAY
  C({
    id: 'shadow',
    part: { en: 'Shadow tests', vi: 'Chạy bóng' },
    level: due ? 'warn' : 'ok',
    status: due ? { en: 'due for grading', vi: 'đến hạn chấm' } : { en: `graded ${REVIEW_DAY.slice(8)}/${REVIEW_DAY.slice(5, 7)}`, vi: `chấm ngày ${REVIEW_DAY.slice(8)}/${REVIEW_DAY.slice(5, 7)}` },
    title: { en: 'Shadow tests are due: grade them', vi: 'Đến hạn chấm các luật chạy bóng' },
    detail: { en: 'L1-L4 and Kronos have run in shadow since 2/11 (the volume filter and no-watchlist-day rule went live on 6/11).', vi: 'L1-L4 và Kronos đã chạy bóng từ 2/11 (lọc khối lượng và bỏ lệnh ngày từ danh sách theo dõi đã bật thật ngày 6/11).' },
    prompt: due ? taskPrompt({ goal: 'Grade the shadow tests (L1-L4, Kronos objects) and the 6/11 live changes (volume filter, no watchlist day trades, breakeven stop at +1R, half-size long trades) and tell Chanh which to keep.', evidence: [`review day ${REVIEW_DAY}`, `${s.trades.filter((t) => t.info.shadow).length} live shadow-tagged trades`], scope: ['Use /api/practice/learning and atlas-status shadow; turning a rule on needs Chanh\'s OK.'], done: 'Chanh gets a pass/fail per test with numbers.' }) : null,
  })

  // 8. promotion step: not built yet
  C({ id: 'promote', part: { en: 'Promotion', vi: 'Lên chức' }, level: 'off', status: { en: 'not built', vi: 'chưa xây' }, title: { en: '', vi: '' }, detail: { en: '', vi: '' }, prompt: null })
  return out
}

/** The to-do list: red first, then yellow. */
export const todos = (checks: Check[]) => checks.filter((c) => c.level === 'bad' || c.level === 'warn').sort((a, b) => (a.level === b.level ? 0 : a.level === 'bad' ? -1 : 1))

/** One plain sentence for the top of the dashboard. */
export function headline(checks: Check[]): { level: Level; text: Bi } {
  const bad = checks.filter((c) => c.level === 'bad').length
  const warn = checks.filter((c) => c.level === 'warn').length
  const machineBad = checks.some((c) => (c.id === 'cycle' || c.id === 'leaders') && c.level === 'bad')
  if (machineBad) return { level: 'bad', text: { en: `Something is broken: ${bad} red item${bad > 1 ? 's' : ''} to fix.`, vi: `Có bộ phận hỏng: ${bad} việc đỏ cần sửa.` } }
  if (bad) return { level: 'warn', text: { en: `Machine runs fine. Results not there yet: ${bad} red item${bad > 1 ? 's' : ''}.`, vi: `Máy chạy tốt. Kết quả chưa đạt: ${bad} việc đỏ cần xử lý.` } }
  if (warn) return { level: 'warn', text: { en: `All running. ${warn} item${warn > 1 ? 's' : ''} to look at.`, vi: `Mọi thứ đang chạy. ${warn} việc cần để ý.` } }
  return { level: 'ok', text: { en: 'All green. Nothing to do.', vi: 'Tất cả xanh. Không có việc gì cần làm.' } }
}

// ---- the 6-step map ----

const SHORT_BLOCK: Record<string, string> = { Slots: 'Hết lượt', Volume: 'Volume yếu', Risk: 'Rủi ro', Volatility: 'Biến động', Other: 'Khác' }

export interface Step {
  n: number
  name: Bi
  level: Level
  stats: { label: Bi; value: string }[]
  feeds: Bi
  help: Bi
}

export function steps(x: ControlInput, checks: Check[]): Step[] {
  const lv = (id: string) => checks.find((c) => c.id === id)?.level ?? 'off'
  const why = whyToday(x.s, dayKey)
  const blocked = why.blocked.reduce((a, b) => a + b.n, 0)
  const top = why.blocked[0]
  const slots = x.factory?.slots ?? []
  const worse = (a: Level, b: Level): Level => (['bad', 'warn', 'ok', 'off'].find((l) => l === a || l === b) as Level)
  return [
    { n: 1, name: { en: 'Find', vi: 'Tìm mã' }, level: lv('leaders'), stats: [{ label: { en: 'Market', vi: 'Cả thị trường' }, value: String(x.leaders?.universe ?? '—') }, { label: { en: 'Leaders', vi: 'Dẫn đầu' }, value: String(x.leaders?.leaders?.length ?? '—') }, { label: { en: 'Today', vi: 'Hôm nay' }, value: String(x.s.server?.picks.length ?? 0) }], feeds: { en: '→ names for step 2', vi: '→ danh sách mã cho bước 2' }, help: { en: 'Scans the whole US market every night and keeps the strongest names.', vi: 'Như đi chợ: mỗi tối lướt cả thị trường Mỹ, giữ lại mã mạnh nhất.' } },
    { n: 2, name: { en: 'Filter', vi: 'Lọc' }, level: lv('cycle'), stats: [{ label: { en: 'Checked', vi: 'Xét' }, value: String(why.decisions) }, { label: { en: 'Blocked', vi: 'Chặn' }, value: String(blocked) }, { label: { en: 'Top reason', vi: 'Lý do #1' }, value: top ? (SHORT_BLOCK[top.by] ?? top.by) : '—' }], feeds: { en: `→ ${why.accepted} passed to step 3`, vi: `→ ${why.accepted} mã đạt cho bước 3` }, help: { en: 'Drops cheap, tiny or thinly traded names; only safe-to-try names pass.', vi: 'Bỏ mã rẻ, nhỏ, ít người mua bán. Chỉ giữ mã an toàn để thử.' } },
    { n: 3, name: { en: 'Paper trade', vi: 'Thử mua bán' }, level: lv('cycle'), stats: [{ label: { en: 'Open', vi: 'Đang mở' }, value: String(x.s.open.length) }, { label: { en: 'Slots', vi: 'Ô thử' }, value: String(slots.length + (x.paper ? 1 : 0)) }, { label: { en: 'Closed', vi: 'Đã đóng' }, value: String(x.s.trades.length) }], feeds: { en: '→ each closed trade goes to step 4', vi: '→ lệnh xong ghi sổ cho bước 4' }, help: { en: 'Buys and sells with fake money, with a target and a stop set in advance.', vi: 'Mua bán bằng tiền giả, có sẵn điểm chốt lời và cắt lỗ.' } },
    { n: 4, name: { en: 'Learn', vi: 'Học' }, level: worse(lv('learn'), lv('shadow')), stats: [{ label: { en: 'Shadow', vi: 'Luật bóng' }, value: '5' }, { label: { en: 'Graded', vi: 'Chấm' }, value: `${REVIEW_DAY.slice(8)}/${REVIEW_DAY.slice(5, 7)}` }, { label: { en: 'Last 20', vi: '20 lệnh gần' }, value: `${kpis(x.s, x.now).recentWinRate ?? '—'}%` }], feeds: { en: '→ results to step 5', vi: '→ kết quả cho bước 5' }, help: { en: 'Reads the trade log and tries new rules in shadow (logged, not used).', vi: 'Đọc lại sổ lệnh, thử luật mới "chạy bóng" (chỉ ghi, chưa dùng).' } },
    { n: 5, name: { en: 'Grade', vi: 'Chấm điểm' }, level: lv('grade'), stats: [{ label: { en: 'Enough', vi: 'Đủ bài' }, value: `${slots.filter((s) => s.graded >= PASS.n).length}/${slots.length}` }, { label: { en: 'Passed', vi: 'Đậu' }, value: String(slots.filter((s) => s.status === 'working').length) }, { label: { en: 'Bar', vi: 'Vạch đậu' }, value: `${PASS.winRate}%` }], feeds: { en: '→ winners to step 6', vi: '→ ai đậu lên bước 6' }, help: { en: `Like an exam: ${PASS.n} signals, ${PASS.winRate}%+ wins and a positive average to pass.`, vi: `Như chấm thi: ${PASS.n} bài, thắng từ ${PASS.winRate}% và lãi TB dương thì đậu.` } },
    { n: 6, name: { en: 'Promote', vi: 'Lên chức' }, level: 'off', stats: [{ label: { en: 'Status', vi: 'Trạng thái' }, value: 'Chưa xây' }, { label: { en: 'Needs', vi: 'Cần' }, value: 'Anh OK' }], feeds: { en: '↺ a stronger book, back to step 3', vi: '↺ sổ chính mạnh hơn, về bước 3' }, help: { en: 'A passing strategy joins the main book. Not built yet.', vi: 'Cách chơi đậu được đưa vào sổ chính. Chưa xây.' } },
  ]
}

// ---- leaderboard ----

export interface Learner {
  id: string
  icon: string
  name: Bi
  sub: Bi
  n: number | null
  goal: number
  winRate: number | null
  avgPct: number | null
  verdict: 'pass' | 'fail' | 'testing' | 'advisor'
}

export function learners(x: ControlInput): Learner[] {
  const ts = x.s.trades
  const k = kpis(x.s, x.now)
  const book: Learner = { id: 'book', icon: '📒', name: { en: 'Main book', vi: 'Sổ chính' }, sub: { en: "Atlas's current way", vi: 'Cách chơi hiện tại' }, n: ts.length, goal: PASS.n, winRate: k.winRate, avgPct: ts.length ? r1(avg(ts.map((t) => t.retPct))) : null, verdict: ts.length < PASS.n ? 'testing' : (k.winRate ?? 0) >= PASS.winRate && (k.pf ?? 0) > 1 ? 'pass' : 'fail' }
  const slots: Learner[] = (x.factory?.slots ?? []).map((sl, i) => ({ id: `slot-${sl.key}`, icon: '🧠', name: { en: `Idea slot ${i + 1}`, vi: `Ô ý tưởng ${i + 1}` }, sub: { en: sl.key, vi: sl.key }, n: sl.graded, goal: PASS.n, winRate: sl.winRate, avgPct: sl.avgPct, verdict: sl.status === 'working' ? 'pass' : sl.status === 'failing' ? 'fail' : 'testing' }))
  const lp = x.paper?.score
  if (lp) slots.push({ id: 'leaders-paper', icon: '🚀', name: { en: 'Leaders: tight base', vi: 'Dẫn đầu: nền chặt' }, sub: { en: `breakout, multi-day · ${x.paper?.watching?.length ?? 0} watching`, vi: `phá nền, giữ nhiều ngày · theo dõi ${x.paper?.watching?.length ?? 0} mã` }, n: lp.graded, goal: PASS.n, winRate: lp.winRate, avgPct: lp.avgPct, verdict: lp.status === 'working' ? 'pass' : lp.status === 'failing' ? 'fail' : 'testing' })
  const shadow: Learner = { id: 'shadow', icon: '🧪', name: { en: 'Shadow rules L1-L4', vi: 'Luật chạy bóng L1-L4' }, sub: { en: `graded ${REVIEW_DAY}`, vi: `chấm ngày ${REVIEW_DAY.slice(8)}/${REVIEW_DAY.slice(5, 7)}` }, n: ts.filter((t) => t.info.shadow).length, goal: 50, winRate: null, avgPct: null, verdict: 'testing' }
  const kronos: Learner = { id: 'kronos', icon: '🔮', name: { en: 'Kronos', vi: 'Kronos' }, sub: { en: 'Forecast AI, advice only', vi: 'AI dự báo, chỉ góp ý' }, n: null, goal: 0, winRate: null, avgPct: null, verdict: 'advisor' }
  const rank = (l: Learner) => (l.verdict === 'pass' ? 3000 : 0) + ((l.n ?? 0) > 0 ? 1000 : 0) + (l.winRate ?? 0)
  return [...[book, ...slots].sort((a, b) => rank(b) - rank(a)), shadow, kronos]
}

// ---- upgrades and outside repos ----

export interface Upgrade {
  id: string
  title: Bi
  why: Bi
  /** 1-3 */
  benefit: number
  step: number
  /** how to install / what it takes */
  how: Bi
  url?: string
  prompt: string
}

const up = (u: Omit<Upgrade, 'prompt'> & { goal: string; scope: string[]; done: string }): Upgrade => ({ id: u.id, title: u.title, why: u.why, benefit: u.benefit, step: u.step, how: u.how, url: u.url, prompt: taskPrompt({ goal: u.goal, evidence: [u.why.en], scope: u.scope, done: u.done }) })

/** Hand-picked next steps and outside repos, best first. */
export const UPGRADES: Upgrade[] = [
  up({ id: 'promote', title: { en: 'Build the "Promote" step', vi: 'Xây bước "Lên chức"' }, why: { en: 'Without it, a strategy that passes is never used.', vi: 'Không có bước này thì học xong cũng không dùng.' }, benefit: 3, step: 6, how: { en: 'Code in the Worker cycle + a switch per slot. About one PR.', vi: 'Thêm vào vòng chạy của Worker + công tắc từng ô. Khoảng 1 PR.' }, goal: 'Build step 6: a trusted idea-factory slot (20+ graded, 55%+ wins, avg > 0) can be promoted into the main paper book with one button and switched off again.', scope: ['Paper only; each promotion still needs Chanh\'s press.'], done: 'A "Lên chức" button appears on trusted slots and the promoted slot trades in the main book.' }),
  up({ id: 'daily-why', title: { en: 'Daily "why I did / didn\'t buy"', vi: 'Báo hằng ngày vì sao có/không mua' }, why: { en: 'Easier to follow what Atlas thinks.', vi: 'Dễ theo dõi Atlas đang nghĩ gì.' }, benefit: 1, step: 2, how: { en: 'One extra line in the daily Telegram summary.', vi: 'Thêm 1 dòng vào tổng kết Telegram mỗi ngày.' }, goal: 'Add a one-line "why Atlas did or didn\'t trade today" to the daily Telegram summary, from whyToday().', scope: ['src/worker/practiceCycle.ts sendDailySummary and src/lib/telegramText.ts.'], done: 'The daily summary shows the top block reasons in Vietnamese.' }),
  up({ id: 'quantstats', title: { en: 'quantstats: monthly report card', vi: 'quantstats: phiếu điểm hằng tháng' }, why: { en: 'Standard report (drawdown, Sharpe, monthly returns) vs SPY in one page.', vi: 'Báo cáo chuẩn (sụt giảm, Sharpe, lãi từng tháng) so với SPY trên 1 trang.' }, benefit: 2, step: 5, url: 'https://github.com/ranaroussi/quantstats', how: { en: 'Python, free. Runs in a GitHub Action from the backup; no key.', vi: 'Python, miễn phí. Chạy trong GitHub Action từ bản sao lưu; không cần key.' }, goal: 'Add a quantstats HTML tearsheet of the paper book vs SPY, built in a manual GitHub Action from the practice backup.', scope: ['Pin the package version; output to public/ so the dashboard can link it.'], done: 'A "Phiếu điểm" link opens the latest tearsheet.' }),
  up({ id: 'alphalens', title: { en: 'alphalens: does a signal really predict?', vi: 'alphalens: tín hiệu có thật sự dự đoán đúng?' }, why: { en: 'Measures each signal\'s real predictive power by group, before it trades.', vi: 'Đo sức dự đoán thật của từng tín hiệu theo nhóm, trước khi cho trade.' }, benefit: 2, step: 4, url: 'https://github.com/stefan-jansen/alphalens-reloaded', how: { en: 'Python, free. Lab only (replay scripts).', vi: 'Python, miễn phí. Chỉ dùng trong phòng thí nghiệm (replay).' }, goal: 'Evaluate Atlas Trade Score and the idea-factory signals with alphalens-reloaded in the replay lab.', scope: ['Lab only; record trials in TRIAL_LEDGER.'], done: 'Chanh gets a short report: which signals predict, which don\'t.' }),
  up({ id: 'vectorbt', title: { en: 'vectorbt: test thousands of variants fast', vi: 'vectorbt: thử hàng nghìn biến thể thật nhanh' }, why: { en: 'Much faster backtests for the idea factory.', vi: 'Thử lại quá khứ nhanh hơn nhiều cho xưởng ý tưởng.' }, benefit: 1, step: 4, url: 'https://github.com/polakowo/vectorbt', how: { en: 'Python, free open-source version. Heavier install.', vi: 'Python, bản mã nguồn mở miễn phí. Cài hơi nặng.' }, goal: 'Assess whether vectorbt would speed up the idea factory enough to be worth adding; prototype only.', scope: ['Watch the trial count (Deflated Sharpe).'], done: 'Chanh gets a yes/no with timing numbers.' }),
]

/** Which of the 6 steps a GitHub repo would help, from its name, topics and description. */
export function stepFor(text: string): number {
  const t = text.toLowerCase()
  if (/screen|scanner|scan/.test(t)) return 1
  if (/backtest|evaluat|performance|tearsheet|report/.test(t)) return 5
  if (/learn|machine|ml|reinforce|predict|forecast/.test(t)) return 4
  if (/risk|portfolio|position|order|broker|execution/.test(t)) return 3
  return 2
}

export interface FoundRepo {
  name: string
  url: string
  stars: number
  desc: string
  pushed: string
}

export function repoUpgrade(r: FoundRepo): Upgrade {
  const step = stepFor(`${r.name} ${r.desc}`)
  return {
    id: `gh-${r.name}`,
    title: { en: r.name, vi: r.name },
    why: { en: r.desc || 'No description.', vi: r.desc || 'Chưa có mô tả.' },
    benefit: r.stars >= 5000 ? 2 : 1,
    step,
    url: r.url,
    how: { en: `${r.stars.toLocaleString('en')} stars · updated ${r.pushed.slice(0, 10)}. Claude checks licence and install before adding.`, vi: `${r.stars.toLocaleString('en')} sao · cập nhật ${r.pushed.slice(0, 10)}. Claude kiểm tra giấy phép và cách cài trước khi thêm.` },
    prompt: taskPrompt({ goal: `Evaluate ${r.url} for Atlas step ${step} and, if it is free and worth it, add it.`, evidence: [`${r.stars} stars, last push ${r.pushed}`, r.desc], scope: ['Check licence, cost, maintenance and whether Atlas already does this; prefer free, no-API options.', 'If it changes trading logic, stop at a proposal for Chanh.'], done: 'Chanh gets a yes/no with reasons, and a PR if yes.' }),
  }
}
