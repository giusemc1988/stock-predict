# Task queue (LIVE copy, branch `handoff-log`)

Only the current driver (see top line of LOG.md) adds, assigns or closes tasks. Hermes agents claim and report.
Status: todo, claimed, done, blocked. Colour: green = agents may do it; red = needs Chanh's OK first
(Atlas live trading rules, cron, secrets, Cloudflare, `.github/`, removing a feature, turning a shadow filter live).
Lease: a claimed task has `lease_until` (UTC). Silent past it = Milo sets it back to todo and gives it to the other machine.
Default machine for repo work: windows. Fallback: ubuntu.

| id | task | machine | status | lease_until | branch | touches | colour |
|---|---|---|---|---|---|---|---|
| Q-001 | Open PR for branch milo/answer-q2-q3 (docs: Q2/Q3 answers) | milo | done (PR #275) | | milo/answer-q2-q3 | docs/hermes/, docs/handoff/ | green |
| Q-002 | Decide: reset or drop stuck TASKs cyberdeck-v2-screen-info and ro-verify-work-done-here | milo | todo | | | milo-shared | green |
| Q-003 | Delete 19 merged remote branches (list: neo/branches-merged-to-delete-2026-11-11.txt) | milo | blocked | | | git branches | red (Chanh OK) |
| Q-004 | Flip shadow filters (#271) live | - | blocked | | | src/lib/practice.ts | red (Chanh OK, wait for >= 30 live-tagged trades) |
