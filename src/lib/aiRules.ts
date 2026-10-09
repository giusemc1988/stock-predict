/**
 * The AI analyst's rules, editable in Settings > AI rules. Saved in this browser
 * only; every value is clamped on load so a bad saved value cannot break the app.
 */
import { useSyncExternalStore } from 'react'

export interface AiRules {
  verdictThreshold: number // % of the -100..100 analyst score needed for BUY or SELL
  noEdgeRule: boolean // size nothing when buy-and-hold beat the robot
  riskPerTradePct: number
  positionCapPct: number
  thinRecordCapPct: number
  minSample: number
  tradeScoreOn: boolean
  riskScoreSizing: boolean
  volatilityOn: boolean
  gatesOn: boolean
  maxDrawdownPct: number
  maxPositionPct: number
  maxTradesPerDay: number
  minScoreWarn: number
  autoLearn: boolean // 24/7 auto learning: replay old bars and test new ones as simulated paper trades
  learnEdgeMarginPct: number // learner needs this many points over always-buy before it says BUY
  practiceMode: boolean // AI paper-trades small on live data in its own practice account
  practiceSizePct: number // % of the practice account per trade
  practiceOnChart: boolean // show practice orders on the chart, with animation
  practiceFeed: boolean // pop-up notices for practice orders
  practiceDayOn: boolean // quick day trades, all closed before market close
  practiceDayTrades: number // day trades per day
  practiceLongOn: boolean // a longer-term trade held for days
  practiceLongTrades: number // long-term trades opened per day
  practiceHoldDays: number // longest a long-term trade is held
}

export const DEFAULT_AI_RULES: AiRules = {
  verdictThreshold: 20,
  noEdgeRule: true,
  riskPerTradePct: 1,
  positionCapPct: 10,
  thinRecordCapPct: 5,
  minSample: 30,
  tradeScoreOn: true,
  riskScoreSizing: true,
  volatilityOn: true,
  gatesOn: true,
  maxDrawdownPct: 20,
  maxPositionPct: 25,
  maxTradesPerDay: 50,
  minScoreWarn: 40,
  autoLearn: false,
  learnEdgeMarginPct: 3,
  practiceMode: true,
  practiceSizePct: 2,
  practiceOnChart: true,
  practiceFeed: true,
  practiceDayOn: true,
  practiceDayTrades: 4,
  practiceLongOn: true,
  practiceLongTrades: 1,
  practiceHoldDays: 5,
}

type NumKey = { [K in keyof AiRules]: AiRules[K] extends number ? K : never }[keyof AiRules]
type BoolKey = { [K in keyof AiRules]: AiRules[K] extends boolean ? K : never }[keyof AiRules]

export interface RuleField {
  group: 'call' | 'sizing' | 'gates' | 'modules'
  key: keyof AiRules
  en: string
  vi: string
  /** Numbers only: allowed range and step. */
  min?: number
  max?: number
  step?: number
  unit?: string
}

export const RULE_FIELDS: RuleField[] = [
  { group: 'call', key: 'verdictThreshold', en: 'Signal strength needed for BUY / SELL', vi: 'Độ mạnh tín hiệu cần để MUA / BÁN', min: 5, max: 80, step: 1, unit: '%' },
  { group: 'call', key: 'noEdgeRule', en: 'No position when just holding beat the robot', vi: 'Không vào lệnh khi mua và giữ tốt hơn robot' },
  { group: 'call', key: 'learnEdgeMarginPct', en: 'Learner must beat always-buy by', vi: 'Bộ học phải hơn luôn-mua ít nhất', min: 0, max: 20, step: 0.5, unit: '%' },
  { group: 'sizing', key: 'riskPerTradePct', en: 'Risk per trade', vi: 'Rủi ro mỗi giao dịch', min: 0.1, max: 5, step: 0.1, unit: '%' },
  { group: 'sizing', key: 'positionCapPct', en: 'Max position size', vi: 'Khối lượng vị thế tối đa', min: 1, max: 100, step: 1, unit: '%' },
  { group: 'sizing', key: 'thinRecordCapPct', en: 'Max size while the track record is short', vi: 'Khối lượng tối đa khi lịch sử còn ngắn', min: 0.5, max: 100, step: 0.5, unit: '%' },
  { group: 'sizing', key: 'practiceDayTrades', en: 'Practice day trades per day', vi: 'Số lệnh luyện tập trong ngày mỗi ngày', min: 1, max: 20, step: 1 },
  { group: 'sizing', key: 'practiceLongTrades', en: 'Practice long-term trades per day', vi: 'Số lệnh luyện tập dài hạn mỗi ngày', min: 1, max: 5, step: 1 },
  { group: 'sizing', key: 'practiceHoldDays', en: 'Practice long-term trade: hold up to', vi: 'Lệnh luyện tập dài hạn: giữ tối đa', min: 1, max: 60, step: 1, unit: 'days' },
  { group: 'sizing', key: 'practiceSizePct', en: 'Practice mode trade size (of practice account)', vi: 'Khối lượng mỗi lệnh luyện tập (của tài khoản luyện tập)', min: 0.5, max: 10, step: 0.5, unit: '%' },
  { group: 'sizing', key: 'minSample', en: 'Trades needed for a full track record', vi: 'Số giao dịch cần cho lịch sử đầy đủ', min: 1, max: 500, step: 1 },
  { group: 'gates', key: 'maxDrawdownPct', en: 'Pause buys after account drop of', vi: 'Dừng mua khi tài khoản giảm', min: 1, max: 100, step: 1, unit: '%' },
  { group: 'gates', key: 'maxPositionPct', en: 'Max share of account in one symbol', vi: 'Tỷ trọng tối đa của một mã', min: 1, max: 100, step: 1, unit: '%' },
  { group: 'gates', key: 'maxTradesPerDay', en: 'Max orders per day', vi: 'Số lệnh tối đa mỗi ngày', min: 1, max: 1000, step: 1 },
  { group: 'gates', key: 'minScoreWarn', en: 'Warn when Trade Score is below', vi: 'Cảnh báo khi Điểm Giao dịch dưới', min: 0, max: 100, step: 1 },
  { group: 'modules', key: 'tradeScoreOn', en: 'Trade Score (0-100)', vi: 'Điểm Giao dịch (0-100)' },
  { group: 'modules', key: 'riskScoreSizing', en: 'Size by risk score', vi: 'Khối lượng theo điểm rủi ro' },
  { group: 'modules', key: 'volatilityOn', en: 'Volatility rules (halve or stop in wild swings)', vi: 'Quy tắc biến động (giảm nửa hoặc dừng khi dao động mạnh)' },
  { group: 'modules', key: 'autoLearn', en: '24/7 auto learning (tests old and new bars as paper trades)', vi: 'Tự học 24/7 (kiểm thử nến cũ và mới bằng giao dịch thử nghiệm)' },
  { group: 'modules', key: 'practiceMode', en: 'Practice mode (AI paper-trades small on live data)', vi: 'Chế độ luyện tập (AI giao dịch thử nhỏ trên dữ liệu trực tiếp)' },
  { group: 'modules', key: 'practiceDayOn', en: 'Practice day trades (in and out the same day)', vi: 'Lệnh luyện tập trong ngày (vào và ra cùng ngày)' },
  { group: 'modules', key: 'practiceLongOn', en: 'Practice long-term trade (held for days)', vi: 'Lệnh luyện tập dài hạn (giữ nhiều ngày)' },
  { group: 'modules', key: 'practiceOnChart', en: 'Show practice orders on the chart (animated)', vi: 'Hiện lệnh luyện tập trên biểu đồ (có hiệu ứng)' },
  { group: 'modules', key: 'practiceFeed', en: 'Pop-up notices for practice orders', vi: 'Thông báo bật lên cho lệnh luyện tập' },
  { group: 'modules', key: 'gatesOn', en: 'Risk gates (kill switch always works)', vi: 'Cổng rủi ro (công tắc dừng khẩn cấp luôn hoạt động)' },
]

const KEY = 'arc.aiRules.v1'
const EVENT = 'arc:aiRules'

export function sanitize(raw: unknown): AiRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...DEFAULT_AI_RULES }
  for (const f of RULE_FIELDS) {
    const v = r[f.key]
    if (f.min != null && f.max != null) {
      const n = Number(v)
      if (v !== '' && v != null && Number.isFinite(n)) out[f.key as NumKey] = Math.min(f.max, Math.max(f.min, n))
    } else if (typeof v === 'boolean') {
      out[f.key as BoolKey] = v
    }
  }
  return out
}

function load(): AiRules {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return DEFAULT_AI_RULES
  }
}

let current: AiRules | null = null

export function getAiRules(): AiRules {
  if (!current) current = load()
  return current
}

export function setAiRules(r: AiRules) {
  current = sanitize(r)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* storage blocked: the rules still apply for this visit */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useAiRules(): AiRules {
  return useSyncExternalStore((cb) => {
    window.addEventListener(EVENT, cb)
    return () => window.removeEventListener(EVENT, cb)
  }, getAiRules)
}
