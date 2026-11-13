# Task queue (rendered from team.json, branch `handoff-log`)

Do not edit by hand. Add, approve or cancel tasks on the Neo Hub Max page (Đội card), or in team.json through scripts/team-apply.mjs.
Driver: **claude**.

| id | task | project | owner | status | updated (UTC) | result |
|---|---|---|---|---|---|---|
| T1 | Decide: reset or drop stuck TASKs cyberdeck-v2-screen-info and ro-verify-work-done-here (old Q-002) | other | milo | done | 2026-11-12 05:45 | Both TASKs have RESULTs (Ubuntu: cyberdeck + ro-verify; Windows: cyberdeck). Archived: none. |
| T2 | Delete 19 merged remote branches (list: neo/branches-merged-to-delete-2026-11-11.txt) (old Q-003) | neohub | milo | done | 2026-11-12 05:45 | Deleted 19 merged branches, skipped: none. |
| T3 | Flip Atlas #271 shadow filters live after >= 30 live-tagged trades (old Q-004) | atlas | claude | todo | 2026-11-12 02:19 |  |
| T4 | BayReady v2.63 (TRANG NGUYEN fix): package and move into private repo giusemc1988/bayready (old Q-006; Chanh: no shop test needed) | bayready | claude | done | 2026-11-12 05:13 | BayReady v2.64 pushed to private repo giusemc1988/bayready main (eedbcd6), see LOG 03:53 |
| T5 | Call scripts/team-bridge.mjs from watcher.ps1 / watcher.sh so machines show On and run scripts | neohub | claude | done | 2026-11-12 03:44 | Windows + Ubuntu bridges live: both machines send heartbeats (Ubuntu first beat 03:43 UTC). BayReady Desktop backups run each pass. |
| T6 | job: status | neohub | windows | done | 2026-11-12 00:44 | node v24.14.1, disk free 1649.9 GB, git 2.53.0.windows.2 |
| T7 | Flow test: write the RESULT file only | other | milo | done | 2026-11-12 16:37 | DONE picked up 2026-11-12T16:34:36Z on muse Flow test only: wrote this RESULT file, changed nothing else. Version: n/a (no code change). Checks: read TASK-board-T7.md on CN88; hook dry-run detected it pending and returned wake for board-T7. |
| T8 | Yêu cầu từ trang Max (Neo Hub): Ở trong cái phần Appointment status mấy cái chỗ mà show total date not arrived servicing, inspecting gì đó không mấy cái như là ad dealer với whole for part nó lúc nào show zero hết á nếu mà nó show zero always thì bỏ lượt bỏ cái đó đi rồi sắp xếp lại mấy cái ô nhìn | neohub | milo | done | 2026-11-12 20:54 | Claude did it (BayReady 2.80): status tiles that show 0 are hidden, the 5 main stages always stay, tiles share the row, a small line names the hidden ones. Not run in Chrome yet. |

## New since Claude last looked

Claude: read this first when back, check each one against real files, then run the `seen` action (team-update.yml, who=claude).

- T3 **todo** by claude at 2026-11-12 02:19: Flip Atlas #271 shadow filters live after >= 30 live-tagged trades (old Q-004)
