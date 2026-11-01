/**
 * Each agent's own version, shown next to its name on its page (AgentShell). The app version in releases.ts
 * counts every change to the whole hub; these count only that agent's own changes. When you change an
 * agent, bump its entry here too (minor for a feature, patch for a fix) — scripts/versions.test.ts checks the format.
 */
import type { ProjectId } from '../lib/projects'

export const AGENT_VERSIONS: Partial<Record<ProjectId, string>> = {
  volt: '1.3.1', // 1.0 safe flasher, 1.1 quick-pick, 1.2 chip-id fix + manifest, 1.3 "What's new" feed, 1.3.1 how-to guides on every card
  nexus: '1.3.0', // 1.0 pocket scout (BLE), 1.1 USB serial, 1.2 Nexus/Echo mode switch, 1.3 room check, trackers, hot/cold finder
  echo: '1.1.0', // 1.0 RuView page, 1.1 room watch over USB
  lumi: '1.3.0', // 1.0 travel translator, 1.1 new look + travel tools (two-way, phrases), 1.2 menu photo, scam alerts, trip notes, 1.2.1 live Vietnamese captions fix, 1.3 instant captions (~1 s), VAD, gist + reply ideas
}
