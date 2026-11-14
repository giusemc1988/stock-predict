# Task queue (rendered from team.json, branch `handoff-log`)

Do not edit by hand. Add, approve or cancel tasks on the Neo Hub Max page (Đội card), or in team.json through scripts/team-apply.mjs.
Driver: **claude** since 2026-11-14 00:25 UTC.

| id | task | project | owner | status | updated (UTC) | result |
|---|---|---|---|---|---|---|
| T18 | BayReady: Chat home tiles Appointment status and Today's services show nothing when tapped | bayready | milo | done | 2026-11-14 11:57 | DONE PR: https://github.com/giusemc1988/bayready/pull/5 GATE: green Suspect: 3 (wait before first log) BayReady 3.21.5 (from main 3.21.4, branch tiles-fix). Tapping Appointment status or Today's services showed nothing: runRouteTaskInner waited in waitQuiet (silent up to 7.5s for a background TIS read) before the first user line, and the content.js 5s safety net never fired because state.running was already true from that TIS read. Changed only content.js, routes.js (+ manifest/changelog version bump). routes.js: route lookup and the user line now run before waitQuiet, so a tap shows its line at once; a missing route errors at once too. content.js: the 5s runJob timer now fires on no-log alone, even when state.running is already true. Checks (real output): node --check OK on content.js, routes.js, background.js. Verification test (vm harness, ~/workspace/bayready-work/v3215-test/test-tiles-fix.js): 7/7 pass — user line before waitQuiet for both tiles, missing route errors at once without waiting, 5s alert fires even when state.running is true. node bayready-gate.mjs (stock-predict, --prev 3.21.4 manifest): GATE: green. Not released, bayready-latest.zip untouched, not merged (reviewer merges per pipeline). LESSON: A "did not start" safety timer must check only whether anything was logged, never whether the panel already looks busy — a background read sets running=true, so a timer gated on !running never fires and the tap stays silent. |
| T19 | BayReady repo: tests/enrich-pick.test.js cannot run (looks for src/routes.js, repo is flat) | bayready | milo | todo | 2026-11-14 07:17 |  |
| T20 | BayReady: page timers keep running and throwing after the extension is updated (stale tab) | bayready | milo | proposed | 2026-11-14 07:12 |  |
| T21 | Review: BayReady: Chat home tiles Appointment status and Today's services show nothing when tapped | bayready | milo | todo | 2026-11-14 11:57 |  |

## New since Claude last looked (2026-11-14 07:12 UTC)

Claude: read this first when back, check each one against real files, then run the `seen` action (team-update.yml, who=claude).

- T18 **done** by hermes-win at 2026-11-14 11:57: BayReady: Chat home tiles Appointment status and Today's services show nothing when tapped | at: picked up T18 (bayready tiles show nothing when tapped); reading the tile path in content.js/background.js/routes.js from main v3.21.4 | result: DONE PR: https://github.com/giusemc1988/bayready/pull/5 GATE: green Suspect: 3 (wait before first log) BayReady 3.21.5 (from main 3.21.4, branch tiles-fix). Tapping Appointment status or Today's servi
- T19 **todo** by hermes-win at 2026-11-14 07:17: BayReady repo: tests/enrich-pick.test.js cannot run (looks for src/routes.js, repo is flat)
- T21 **todo** by hermes-win at 2026-11-14 11:57: Review: BayReady: Chat home tiles Appointment status and Today's services show nothing when tapped
