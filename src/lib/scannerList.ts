/**
 * Candidate list from the TradingView screener (scripts/tv-scanner.py, GitHub Actions, saved on the
 * `scanner-data` branch every 15 minutes in market hours). The Worker prefers it to its own Yahoo movers
 * lists because it already knows relative volume, market cap and the exchange; a missing, broken or
 * stale file returns null so the old scanner keeps working.
 */
import type { Mover } from './practiceScan'

export const SCANNER_URL = 'https://raw.githubusercontent.com/giusemc1988/stock-predict/scanner-data/candidates.json'
export const SCANNER_MAX_AGE_MS = 45 * 60_000
export const SCANNER_TOP = 15

/** Movers from the file's rows, or null when the file is unusable (so the caller falls back). */
export function parseScannerFile(raw: unknown, now: number): Mover[] | null {
  const f = raw as { generatedAt?: unknown; rows?: unknown } | null
  if (!f || typeof f.generatedAt !== 'number' || !Array.isArray(f.rows)) return null
  if (now - f.generatedAt > SCANNER_MAX_AGE_MS || f.generatedAt > now + 5 * 60_000) return null
  const out: Mover[] = []
  for (const r of f.rows as { symbol?: unknown; marketCap?: unknown }[]) {
    if (typeof r?.symbol !== 'string' || !/^[A-Z]{1,5}$/.test(r.symbol) || out.some((m) => m.symbol === r.symbol)) continue
    out.push({ symbol: r.symbol, source: 'gainer', marketCap: typeof r.marketCap === 'number' ? r.marketCap : null })
    if (out.length >= SCANNER_TOP) break
  }
  return out.length ? out : null
}
