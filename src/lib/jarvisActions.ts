/**
 * What Jarvis may change, and only after you tap "Do it". Jarvis reads everything in the app,
 * but it can only propose this short list: switch an AI rule on or off (practice mode included),
 * the kill switch, and adding a market to the watchlist. Nothing here places, sizes or closes a
 * trade, and nothing touches real money. Every proposal, done or cancelled, is logged.
 */
import { RULE_FIELDS, type AiRules } from './aiRules'
import type { Bi } from './jarvis'

type BoolKey = { [K in keyof AiRules]: AiRules[K] extends boolean ? K : never }[keyof AiRules]

export type JarvisAction = { kind: 'rule'; key: BoolKey; value: boolean } | { kind: 'killSwitch'; value: boolean } | { kind: 'watch'; symbol: string }

const BOOL_FIELDS = RULE_FIELDS.filter((f) => f.min == null)

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9À-ỹ ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
const STOP = new Set(['jarvis', 'with', 'from', 'when', 'what', 'that', 'this', 'your', 'into', 'trong', 'của'])

/** The boolean AI rule whose label best matches the words, if one clearly wins. */
function findRule(text: string): BoolKey | null {
  const asked = new Set(words(text))
  let best: { key: BoolKey; n: number } | null = null
  let tie = false
  for (const f of BOOL_FIELDS) {
    const n = new Set([...words(f.en), ...words(f.vi)].filter((w) => asked.has(w))).size
    if (!n) continue
    if (!best || n > best.n) {
      best = { key: f.key as BoolKey, n }
      tie = false
    } else if (n === best.n) tie = true
  }
  return best && !tie ? best.key : null
}

/** A command Jarvis can propose, from a typed or spoken sentence (English or Vietnamese). */
export function parseCommand(text: string, known: { symbol: string; name: string }[]): JarvisAction | null {
  const t = text.toLowerCase()
  if (/kill switch|dừng khẩn cấp|stop all buy/.test(t)) return { kind: 'killSwitch', value: !/\b(off|disable)\b|tắt/.test(t) }
  if (/(pause|stop|turn off|switch off|disable) (the )?practice|tạm dừng luyện tập|tắt luyện tập|dừng luyện tập/.test(t)) return { kind: 'rule', key: 'practiceMode', value: false }
  if (/(resume|start|turn on|switch on|enable) (the )?practice|tiếp tục luyện tập|bật luyện tập/.test(t)) return { kind: 'rule', key: 'practiceMode', value: true }
  const watch = /(add|put) (.+?) (to|on|in) (my |the )?watch ?list|^watch (.+)$|thêm (.+?) vào (danh sách|watchlist)/.exec(t)
  if (watch) {
    const raw = (watch[2] ?? watch[5] ?? watch[6] ?? '').trim()
    const k = known.find((x) => x.symbol.toLowerCase() === raw || x.symbol.split('/')[0].toLowerCase() === raw || x.name.toLowerCase().startsWith(raw))
    const sym = k?.symbol ?? (/^[a-z]{1,5}$/.test(raw) ? raw.toUpperCase() : null)
    return sym ? { kind: 'watch', symbol: sym } : null
  }
  const sw = /\b(turn|switch) (on|off)\b|\b(enable|disable)\b|\b(bật|tắt)\b/.exec(t)
  if (sw) {
    const on = sw[2] ? sw[2] === 'on' : sw[3] ? sw[3] === 'enable' : sw[4] === 'bật'
    const rest = t.replace(sw[0], ' ')
    const key = /^\s*(the\s+)?jarvis\s*$/.test(rest) ? 'jarvisOn' : findRule(rest)
    if (key) return { kind: 'rule', key, value: on }
  }
  return null
}

const ruleLabel = (key: string) => RULE_FIELDS.find((f) => f.key === key)

/** What the action does, in plain words, for the confirm card and the log. */
export function describeAction(a: JarvisAction): Bi {
  if (a.kind === 'killSwitch') return a.value ? { en: 'Turn the kill switch ON (no new buys anywhere)', vi: 'BẬT công tắc dừng khẩn cấp (không mua mới)' } : { en: 'Turn the kill switch off', vi: 'Tắt công tắc dừng khẩn cấp' }
  if (a.kind === 'watch') return { en: `Add ${a.symbol} to your watchlist`, vi: `Thêm ${a.symbol} vào danh sách theo dõi` }
  if (a.key === 'practiceMode') return a.value ? { en: 'Resume practice trading', vi: 'Tiếp tục giao dịch luyện tập' } : { en: 'Pause practice trading', vi: 'Tạm dừng giao dịch luyện tập' }
  const f = ruleLabel(a.key)
  return { en: `Turn ${a.value ? 'on' : 'off'}: ${f?.en ?? a.key}`, vi: `${a.value ? 'Bật' : 'Tắt'}: ${f?.vi ?? a.key}` }
}

/** True when the action would change nothing (already in that state). */
export function alreadySo(a: JarvisAction, rules: AiRules, killSwitch: boolean, watchlist: string[]) {
  if (a.kind === 'killSwitch') return killSwitch === a.value
  if (a.kind === 'watch') return watchlist.includes(a.symbol)
  return rules[a.key] === a.value
}

export interface ActionLogEntry {
  time: number
  label: Bi
  result: 'done' | 'cancelled'
}

const LOG_KEY = 'arc.jarvisActions.v1'
export const MAX_ACTION_LOG = 50

export function loadActionLog(): ActionLogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function logAction(e: ActionLogEntry): ActionLogEntry[] {
  const next = [...loadActionLog(), e].slice(-MAX_ACTION_LOG)
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    /* storage blocked: the log lasts for this visit only */
  }
  return next
}
