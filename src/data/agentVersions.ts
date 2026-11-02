/**
 * Each agent's own version, shown next to its name on its page (AgentShell). The app version in releases.ts
 * counts every change to the whole hub; these count only that agent's own changes. When you change an
 * agent, bump its entry here too (minor for a feature, patch for a fix) — scripts/versions.test.ts checks the format.
 */
import type { ProjectId } from '../lib/projects'

export const AGENT_VERSIONS: Partial<Record<ProjectId, string>> = {
  atlas: '1.2.9', // 1.0 practice trader + labs + shadow tests, 1.1 signal board (verdict, learning progress, signals with TP/SL and real win rate), 1.2 idea factory (rules Atlas invents itself, book vs self-made win rate), 1.2.1 nightly jobs fixed and deploy after saving, 1.2.2 Hub card split in two (Kronos | learning + book vs Opus with each side's picks), 1.2.3 Hub card: learning tests shown, Kronos as chips, card grows to fit, 1.2.4 lab audit (Deflated Sharpe fixed), 1.2.6 Opus signals only from rules holding ≤5 days, 1.2.5 Hub card redesigned on one grid (tiles, two equal lists, book vs Opus box), 1.2.7 trade size never below half (no more $5 trades), 1.2.8 size by risk + entry quality gate (volume, flat chart, penny/shell) + notification Show me, 1.2.9 scanner starts from the TradingView screener list (RVOL 1.5x, cap $300M, real exchanges) with Yahoo fallback
  volt: '1.3.1', // 1.0 safe flasher, 1.1 quick-pick, 1.2 chip-id fix + manifest, 1.3 "What's new" feed, 1.3.1 how-to guides on every card
  nexus: '1.3.0', // 1.0 pocket scout (BLE), 1.1 USB serial, 1.2 Nexus/Echo mode switch, 1.3 room check, trackers, hot/cold finder
  echo: '1.1.0', // 1.0 RuView page, 1.1 room watch over USB
  lumi: '1.4.0', // 1.0 travel translator, 1.1 new look + travel tools (two-way, phrases), 1.2 menu photo, scam alerts, trip notes, 1.2.1 live Vietnamese captions fix, 1.3 instant captions (~1 s), VAD, gist + reply ideas, 1.4 auto-start on open, early commit on stalled words
}
