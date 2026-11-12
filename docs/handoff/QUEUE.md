# Task queue (rendered from team.json, branch `handoff-log`)

Do not edit by hand. Add, approve or cancel tasks on the Neo Hub Max page (Đội card), or in team.json through scripts/team-apply.mjs.
Driver: **claude**.

| id | task | project | owner | status | updated (UTC) | result |
|---|---|---|---|---|---|---|
| T1 | Decide: reset or drop stuck TASKs cyberdeck-v2-screen-info and ro-verify-work-done-here (old Q-002) | other | milo | todo | 2026-11-12 00:29 |  |
| T2 | Delete 19 merged remote branches (list: neo/branches-merged-to-delete-2026-11-11.txt) (old Q-003) | neohub | milo | todo | 2026-11-12 02:19 |  |
| T3 | Flip Atlas #271 shadow filters live after >= 30 live-tagged trades (old Q-004) | atlas | claude | todo | 2026-11-12 02:19 |  |
| T4 | BayReady v2.63 (TRANG NGUYEN fix): package and move into private repo giusemc1988/bayready (old Q-006; Chanh: no shop test needed) | bayready | claude | done | 2026-11-12 03:50 | v2.64 packaged: carsEnrichAll now picks cars with no RO first (6 slots kept for re-checks), v2.63 name retry kept. Node test with 175 cars (TRANG at index 169) passes: TRANG processed on first run. Zip: Windows C:\Users\chanh\milo-shared\bayready-v2.64.zip + Desktop\BayReady-backups. Pushed to private repo giusemc1988/bayready main (eedbcd6), Ubuntu ~/Downloads/bayready still v2.63. |
| T5 | Call scripts/team-bridge.mjs from watcher.ps1 / watcher.sh so machines show On and run scripts | neohub | claude | done | 2026-11-12 03:44 | Windows + Ubuntu bridges live: both machines send heartbeats (Ubuntu first beat 03:43 UTC). BayReady Desktop backups run each pass. |
| T6 | job: status | neohub | windows | done | 2026-11-12 00:44 | node v24.14.1, disk free 1649.9 GB, git 2.53.0.windows.2 |
