# BayReady pipeline (coder, reviewer, gate)

For Milo, Hermes and Claude. New flow from 2026-11-14 (Chanh): the team takes care of BayReady itself. Chanh only checks, assigns work and grants permissions.

## Where things live
- **Source of truth = the private repo `giusemc1988/bayready`** (branch + pull request) once it holds the NEWEST version. `milo-shared\stage74\src` is NOT guaranteed to be the newest: on 2026-11-14 it was v2.80 while the live build was v3.21 (built by the glass-style thread, zips `bayready-vX.zip`) and Milo was on 3.22.
- **Before any BayReady work, find the newest version:** compare `manifest.json` version in the repo main, in `stage74\src`, in the newest `bayready-v*.zip` in `milo-shared` (and `/mnt/project-files/bayready-glass/release/` for the glass thread), and the installed Desktop copy. The highest version wins. Bring the repo up to it first (an "import" PR from that zip or folder, gate green) and tell Claude which one you used.
- Never edit `stage74\src` for a new change once the repo is current: branch in the repo instead.
- Two people building the same version number is a conflict: ask Chanh or Claude before you bump.

## The line
1. **Scout** (script, no AI) or Chanh writes a proposal on the Max board ("Đề xuất"). Chanh taps Duyệt or Huỷ.
2. **Coder** (you, default free OmniRoute combo): task file `TASK-board-<id>.md`. Branch off main, make the smallest change, add a check that proves it. Run `node bayready-gate.mjs <checkout>` (syntax, JSON, manifest files, version bump). Result file, one per line: `PR: <url>`, `GATE: green|red`, what changed, `LESSON: ...`.
3. **Reviewer** (a separate task, OmniRoute combo `review-hard`, never the coder's own combo): read the diff, rerun the gate. Result file: `VERDICT: APPROVE|CHANGES`, `NOTES:`, `GATE:`, `MERGED: yes|no`.
4. **Merge**: only if risk is `low`, VERDICT is APPROVE and the gate is green, the reviewer merges (squash) and writes `MERGED: yes`. High risk: do NOT merge; Chanh taps Merge on the board.
5. Max 3 rounds (coder, reviewer, coder...). After that the task waits for Chanh with the reason.
6. **Undo**: Chanh taps Hoàn tác; the board gives you a revert task.

## Release is separate
Merging does NOT update any machine. Only when Chanh says "phát hành X": build from the repo main into `milo-shared\bayready-latest.zip` (run `bayready-check-latest.py` first), sync `stage74\src`, and both shop machines pick it up within a minute (their usual check). Never release without those words.

## Always
No secrets, delete nothing, never remove a feature. Anything touching TIS/Xtime sign-in logic is high risk. A task with no automatic check: write the check first.
