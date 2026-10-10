/**
 * Skill registry: each part of the AI that feeds a trading decision is a skill with an
 * id, version, source, inputs, outputs, permissions and a status. Only approved skills
 * feed signals; a quarantined or revoked skill is switched off. Every skill runs a
 * functional self-test on simulated bars, and a skill that fails it is quarantined.
 *
 * Skills are built into the app. Nothing is downloaded from GitHub or written by an AI
 * at run time, so no outside code can run.
 */
import { useSyncExternalStore } from 'react'
import type { AiRules } from './aiRules'

export type SkillStatus = 'approved' | 'quarantine' | 'revoked'

export interface SkillVersion {
  version: number
  date: string
  en: string
  vi: string
}

export interface SkillInfo {
  id: string
  category: string
  en: { name: string; does: string }
  vi: { name: string; does: string }
  source: string
  inputs: string[]
  outputs: string[]
  permissions: string[]
  /** Hard limits on what it can do. */
  limits: string
  history: SkillVersion[]
  /** What switching it off does to the trading rules. */
  off: (r: AiRules) => AiRules
}

export const READ_ONLY = ['read price bars']

export const SKILLS: SkillInfo[] = [
  {
    id: 'analyst',
    category: 'Trend, momentum and indicators',
    en: { name: 'Technical analyst', does: 'Reads trend, momentum and indicators and calls BUY, SELL or HOLD.' },
    vi: { name: 'Phân tích kỹ thuật', does: 'Đọc xu hướng, động lượng và chỉ báo để gọi MUA, BÁN hoặc GIỮ.' },
    source: 'Arc Analyst (built in), rules from the trading-analyst skill',
    inputs: ['OHLCV bars', 'backtest of the strategy'],
    outputs: ['verdict BUY | SELL | HOLD', 'score -1..1', 'reasons'],
    permissions: READ_ONLY,
    limits: 'No orders. Off = practice opens no trades.',
    history: [
      { version: 1, date: '2026-10-05', en: 'First version.', vi: 'Phiên bản đầu.' },
      { version: 2, date: '2026-10-08', en: 'Rules editable in AI rules.', vi: 'Quy tắc chỉnh được trong Quy tắc AI.' },
    ],
    off: (r) => ({ ...r, practiceMode: false }),
  },
  {
    id: 'trade-score',
    category: 'Entry evaluation',
    en: { name: 'Trade Score', does: 'Grades a setup 0-100 from trend, risk/reward and track record.' },
    vi: { name: 'Điểm Giao dịch', does: 'Chấm điểm 0-100 từ xu hướng, lợi nhuận/rủi ro và lịch sử.' },
    source: 'Arc Analyst (built in)',
    inputs: ['OHLCV bars', 'backtest stats', 'order flow'],
    outputs: ['score 0..100', 'grade A-F'],
    permissions: READ_ONLY,
    limits: 'No orders.',
    history: [{ version: 1, date: '2026-10-07', en: 'First version.', vi: 'Phiên bản đầu.' }],
    off: (r) => ({ ...r, tradeScoreOn: false }),
  },
  {
    id: 'volatility',
    category: 'Volatility and market regime',
    en: { name: 'Volatility regime', does: 'Halves size in high swings and stops buys in extreme ones.' },
    vi: { name: 'Chế độ biến động', does: 'Giảm nửa khối lượng khi dao động mạnh và dừng mua khi quá mạnh.' },
    source: 'Arc Analyst (built in)',
    inputs: ['OHLCV bars'],
    outputs: ['regime calm | normal | high | extreme'],
    permissions: READ_ONLY,
    limits: 'Can only shrink or stop a trade.',
    history: [{ version: 1, date: '2026-10-07', en: 'First version.', vi: 'Phiên bản đầu.' }],
    off: (r) => ({ ...r, volatilityOn: false }),
  },
  {
    id: 'exit-plan',
    category: 'Entry and exit evaluation',
    en: { name: 'Exit plan', does: 'Sets the stop and target from recent swings and ATR.' },
    vi: { name: 'Kế hoạch thoát', does: 'Đặt cắt lỗ và chốt lời theo đỉnh đáy gần và ATR.' },
    source: 'Arc Analyst (built in)',
    inputs: ['OHLCV bars', 'ATR'],
    outputs: ['stop', 'target'],
    permissions: READ_ONLY,
    limits: 'No orders. Off = practice opens no trades (no stop, no trade).',
    history: [{ version: 1, date: '2026-10-07', en: 'First version.', vi: 'Phiên bản đầu.' }],
    off: (r) => ({ ...r, practiceMode: false }),
  },
  {
    id: 'risk-sizing',
    category: 'Risk and position sizing',
    en: { name: 'Risk sizing', does: 'Sizes positions from the stop distance and the risk score.' },
    vi: { name: 'Khối lượng theo rủi ro', does: 'Tính khối lượng theo khoảng cắt lỗ và điểm rủi ro.' },
    source: 'Arc Analyst (built in)',
    inputs: ['entry', 'stop', 'track record'],
    outputs: ['position size'],
    permissions: READ_ONLY,
    limits: 'Capped by Max position size and the hard risk limits.',
    history: [{ version: 1, date: '2026-10-07', en: 'First version.', vi: 'Phiên bản đầu.' }],
    off: (r) => ({ ...r, riskScoreSizing: false }),
  },
  {
    id: 'learner',
    category: 'Trade journal analysis',
    en: { name: 'Learner', does: 'Learns from closed paper trades whether a model score has paid off.' },
    vi: { name: 'Bộ học', does: 'Học từ lệnh thử nghiệm đã đóng xem điểm mô hình có hiệu quả không.' },
    source: 'Arc Analyst (built in)',
    inputs: ['trade journal'],
    outputs: ['BUY | HOLD', 'calibrated win chance'],
    permissions: ['read trade journal'],
    limits: 'Opinion only; never places orders. Off = auto learning stops.',
    history: [{ version: 1, date: '2026-10-08', en: 'First version.', vi: 'Phiên bản đầu.' }],
    off: (r) => ({ ...r, autoLearn: false }),
  },
  {
    id: 'stock-picker',
    category: 'Momentum and relative volume',
    en: { name: 'Stock picker', does: "Ranks BUY calls by Trade Score, volume and today's gain, including today's movers." },
    vi: { name: 'Chọn mã', does: 'Xếp hạng lệnh MUA theo Điểm GD, khối lượng và mức tăng hôm nay, gồm cả mã biến động.' },
    source: 'Arc Analyst (built in)',
    inputs: ['15-minute bars', 'top gainers and most-traded lists'],
    outputs: ['ranked picks'],
    permissions: READ_ONLY,
    limits: 'Picks only; trades go through every risk check.',
    history: [{ version: 1, date: '2026-10-09', en: 'First version.', vi: 'Phiên bản đầu.' }],
    off: (r) => ({ ...r, practiceAutoPick: false, practiceMovers: false }),
  },
  {
    id: 'playbook',
    category: 'Trading checklist (Trader Brain)',
    en: { name: 'Trader Brain playbook', does: 'Checks each practice trade against 14 rules experienced traders use, and tracks which rules pay on paper trades.' },
    vi: { name: 'Sổ tay Trader Brain', does: 'Kiểm tra mỗi lệnh luyện tập theo 14 quy tắc của trader kinh nghiệm và theo dõi quy tắc nào hiệu quả trên lệnh thử.' },
    source: 'Arc Analyst (built in), common trading rules',
    inputs: ['practice trades', 'trade reviews'],
    outputs: ['followed / broken per rule', 'proven | unproven | no edge | harmful'],
    permissions: ['read practice trades'],
    limits: 'Can only block a practice buy, and only with its gate on and a rule proven on paper trades.',
    history: [{ version: 1, date: '2026-10-10', en: 'First version.', vi: 'Phiên bản đầu.' }],
    off: (r) => ({ ...r, brainGate: false, brainStory: false }),
  },
]

export const skillVersion = (s: SkillInfo) => s.history[s.history.length - 1].version
export const skillTag = (s: SkillInfo) => `${s.id}@${skillVersion(s)}`

// ---------- statuses (this browser only) ----------

const KEY = 'arc.skills.v1'
const EVENT = 'arc:skills'
type Statuses = Record<string, SkillStatus>
const VALID: SkillStatus[] = ['approved', 'quarantine', 'revoked']

function load(): Statuses {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => VALID.includes(v as SkillStatus))) as Statuses
  } catch {
    return {}
  }
}

let current: Statuses | null = null
const get = () => (current ??= load())

export function setSkillStatus(id: string, status: SkillStatus) {
  current = { ...get(), [id]: status }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* storage blocked: applies for this visit */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useSkillStatuses(): Statuses {
  return useSyncExternalStore((cb) => {
    window.addEventListener(EVENT, cb)
    return () => window.removeEventListener(EVENT, cb)
  }, get)
}

/** Status of a skill: what you set, else quarantined when its self-test failed, else approved. */
export function statusOf(id: string, statuses: Statuses, failed: ReadonlySet<string> = new Set()): SkillStatus {
  return statuses[id] ?? (failed.has(id) ? 'quarantine' : 'approved')
}

/** The rules with every skill that is not approved switched off. With the registry off, rules are unchanged. */
export function effectiveRules(rules: AiRules, statuses: Statuses, failed: ReadonlySet<string> = new Set()): AiRules {
  if (!rules.skillRegistryOn) return rules
  return SKILLS.reduce((r, s) => (statusOf(s.id, statuses, failed) === 'approved' ? r : s.off(r)), rules)
}

/** Tags of the approved skills, recorded on each decision. */
export function approvedTags(rules: AiRules, statuses: Statuses, failed: ReadonlySet<string> = new Set()): string[] {
  return SKILLS.filter((s) => !rules.skillRegistryOn || statusOf(s.id, statuses, failed) === 'approved').map(skillTag)
}
