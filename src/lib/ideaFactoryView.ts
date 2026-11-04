/**
 * What the app reads from public/idea-factory.json (written by scripts/idea-factory.ts) and the side-by-side
 * score: Atlas's own real trades ("book") vs the factory's graded signals ("Opus, self-made"). Pure, no I/O.
 */
import type { PracticeTrade } from './practice'

type Bi = { en: string; vi: string }

export interface FactorySignalView extends Bi {
  day: string
  symbol: string
  key: string
  close: number
  sl: number | null
  hold: number
  why?: Bi | null
  retPct?: number | null
}

export interface FactoryReport {
  generated: string
  seconds: number
  run: number
  mode?: 'full' | 'signals'
  trials: { labs: number; thisRun: number; factoryTotal: number; total: number; holdout?: number; vaultTotal?: number }
  funnel: { tried: number; discovery: number; validation: number; vault: number }
  pass: Bi
  top: (Bi & { key: string; stage: string; family: string })[]
  today: { day: string; signals: FactorySignalView[] }
  score: { graded: number; wins: number; winRate: number | null; avgPct: number | null; waiting: number }
  /** v2.0.11: one live scoreboard row per strategy slot */
  slots?: { key: string; graded: number; wins: number; winRate: number | null; avgPct: number | null; waiting: number; status: 'testing' | 'working' | 'failing' }[]
  rules: (Bi & { key: string; family: string; why: Bi | null; passed: boolean; vault: { n: number; winRate: number; excessPct: number; dsr: number } | null })[]
}

/** Graded factory signals needed before its win rate is worth comparing (same bar as the board's TRUST_MIN). */
export const DUEL_MIN = 30

export interface Duel {
  book: { n: number; winRate: number | null }
  opus: { graded: number; winRate: number | null; waiting: number }
  /** the factory rules' combined vault record (old data), shown only as a hint */
  vault: { n: number; winRate: number } | null
  /** the higher win rate, null when the factory has nothing graded */
  winner: 'book' | 'opus' | null
  trusted: boolean
  need: number
}

export function duel(trades: PracticeTrade[], rep: FactoryReport | null): Duel {
  const n = trades.length
  const book = { n, winRate: n ? Math.round((trades.filter((t) => t.pnl > 0).length / n) * 100) : null }
  const opus = { graded: rep?.score.graded ?? 0, winRate: rep?.score.winRate ?? null, waiting: rep?.score.waiting ?? 0 }
  const vs = (rep?.rules ?? []).map((r) => r.vault).filter((v): v is NonNullable<typeof v> => !!v && v.n > 0)
  const vn = vs.reduce((a, v) => a + v.n, 0)
  const vault = vn ? { n: vn, winRate: Math.round(vs.reduce((a, v) => a + v.winRate * v.n, 0) / vn) } : null
  let winner: Duel['winner'] = null
  if (opus.winRate != null && opus.graded > 0) winner = book.winRate == null || opus.winRate > book.winRate ? 'opus' : opus.winRate < book.winRate ? 'book' : null
  return { book, opus, vault, winner, trusted: opus.graded >= DUEL_MIN && book.n >= DUEL_MIN, need: DUEL_MIN }
}
