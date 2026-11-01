/**
 * Lumi money helper: pulls prices out of overheard/typed text ("ten euros", "$5", "1,500 yen") and
 * converts them to VND with free rates (open.er-api.com, no key). Pure parsing + maths; the Worker
 * fetches the rates and the page caches them in localStorage so it keeps working offline.
 */

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'KRW', 'CNY', 'THB', 'SGD', 'AUD', 'CAD', 'CHF', 'HKD', 'TWD', 'MYR', 'IDR', 'INR', 'AED', 'VND'] as const
export type Currency = (typeof CURRENCIES)[number]

export interface Rates {
  /** units of each currency per 1 USD */
  perUsd: Record<string, number>
  /** when the source updated, ms epoch */
  at: number
}

export interface Money {
  amount: number
  cur: Currency
}

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

/** word / symbol -> currency code */
const NAMES: [RegExp, Currency][] = [
  [/(?:\$|usd|dollars?|bucks?)/, 'USD'],
  [/(?:€|eur|euros?)/, 'EUR'],
  [/(?:£|gbp|pounds?|quid)/, 'GBP'],
  [/(?:¥|jpy|yen|円)/, 'JPY'],
  [/(?:₩|krw|won)/, 'KRW'],
  [/(?:cny|rmb|yuan|元)/, 'CNY'],
  [/(?:฿|thb|baht)/, 'THB'],
  [/(?:sgd)/, 'SGD'],
  [/(?:aud)/, 'AUD'],
  [/(?:cad)/, 'CAD'],
  [/(?:chf|francs?)/, 'CHF'],
  [/(?:vnd|dong|đồng|₫)/, 'VND'],
]

function curOf(token: string): Currency | null {
  const t = token.toLowerCase()
  for (const [re, c] of NAMES) if (new RegExp(`^${re.source}$`).test(t)) return c
  return null
}

/** "1,500" / "1.500,50" / "12.5" -> number; null when it is not a plain amount. */
export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/[.,]+$/, '')
  if (!/^\d[\d.,]*$/.test(t)) return null
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  let norm = t
  if (lastComma >= 0 && lastDot >= 0) norm = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (lastComma >= 0) norm = /,\d{3}(?!\d)/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.')
  else if (lastDot >= 0 && /\.\d{3}(?!\d)/.test(t) && t.split('.').length > 2) norm = t.replace(/\./g, '')
  const n = Number(norm)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** English number words ("twenty five", "a hundred") -> number; null if none. */
function wordsToNumber(words: string[]): number | null {
  let total = 0
  let any = false
  for (const w of words) {
    if (w in WORD_NUM) { total += WORD_NUM[w]; any = true }
    else if (w === 'hundred') { total = (total || 1) * 100; any = true }
    else if (w === 'a' || w === 'and') continue
    else return null
  }
  return any ? total : null
}

const CUR_RE = '(?:\\$|€|£|¥|₩|฿|₫|usd|eur|gbp|jpy|krw|cny|rmb|thb|sgd|aud|cad|chf|hkd|vnd|dollars?|bucks?|euros?|pounds?|yen|won|yuan|baht|francs?|dong|đồng|円|元)'
const NUM_RE = '\\d(?:[\\d.,]*\\d)?'
const WORDNUM_RE = `(?:(?:a|${Object.keys(WORD_NUM).join('|')}|hundred|and)\\s+){0,3}(?:${Object.keys(WORD_NUM).join('|')}|hundred)`

/** All prices found in a line of text, in order. Digits and simple English number words only. */
export function findMoney(text: string): Money[] {
  const out: Money[] = []
  const src = text.toLowerCase()
  const forms: RegExp[] = [
    new RegExp(`(${CUR_RE})\\s?(${NUM_RE})`, 'g'), // $5, €12.50
    new RegExp(`(${NUM_RE})\\s?(${CUR_RE})`, 'g'), // 20 euros, 1,500yen
    new RegExp(`\\b(${WORDNUM_RE})\\s+(${CUR_RE})`, 'g'), // ten euros
  ]
  const seen = new Set<number>()
  forms.forEach((re, idx) => {
    for (const m of src.matchAll(re)) {
      if (seen.has(m.index!)) continue
      const cur = curOf(idx === 0 ? m[1] : m[2])
      const amount = idx === 0 ? parseAmount(m[2]) : idx === 1 ? parseAmount(m[1]) : wordsToNumber(m[1].split(/\s+/))
      if (cur && amount) {
        seen.add(m.index!)
        out.push({ amount, cur })
      }
    }
  })
  return out
}

/** `Rates` from the open.er-api.com USD payload; null when it is not a success answer. */
export function parseRates(raw: unknown, now = Date.now()): Rates | null {
  const j = raw as { result?: unknown; rates?: unknown; time_last_update_unix?: unknown } | null
  if (!j || j.result !== 'success' || !j.rates || typeof j.rates !== 'object') return null
  const perUsd: Record<string, number> = {}
  for (const c of CURRENCIES) {
    const v = (j.rates as Record<string, unknown>)[c]
    if (typeof v === 'number' && v > 0) perUsd[c] = v
  }
  if (!perUsd.VND) return null
  perUsd.USD = 1
  const at = typeof j.time_last_update_unix === 'number' ? j.time_last_update_unix * 1000 : now
  return { perUsd, at }
}

/** Convert an amount between two currencies; null if a rate is missing. */
export function convert(amount: number, from: string, to: string, rates: Rates): number | null {
  const a = rates.perUsd[from]
  const b = rates.perUsd[to]
  if (!a || !b) return null
  return (amount / a) * b
}

/** Friendly VND text: "≈ 275.000 ₫" (rounded to the nearest 1.000 above 10.000). */
export function formatVnd(v: number): string {
  const r = v >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v)
  return `≈ ${r.toLocaleString('vi-VN')} ₫`
}

export const RATES_KEY = 'lumi:rates'
const FRESH_MS = 12 * 3600_000

export function ratesFresh(r: Rates | null, now = Date.now()): boolean {
  return !!r && now - r.at < FRESH_MS
}

export function parseStoredRates(raw: string | null): Rates | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as Rates
    return j && typeof j.at === 'number' && j.perUsd && typeof j.perUsd.VND === 'number' ? j : null
  } catch {
    return null
  }
}
