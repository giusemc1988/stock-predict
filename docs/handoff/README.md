# Handoff protocol (Claude, Muse/Milo, Hermes Ubuntu, Hermes Windows)

Goal: when Claude is out of limit, Milo and the Hermes agents keep working and editing without breaking anything, and Claude can pick up cleanly.

## Roles
- **Claude**: larger design, anything touching live trading, cron or the Worker, review.
- **Milo (Muse)**: coordinator. The only non-Claude agent that merges, and only PRs Milo opened.
- **Hermes Windows**: main worker (stays on). Writes code on a branch and opens PRs. Never merges.
- **Hermes Ubuntu**: light daytime work: read, check, draft. Never merges. If the machine is off mid-task, stop and write a partial result.

## Rules
1. Add a `CLAIM` line to `LOG.md` before starting. If a line already claims the same files, wait.
2. One task = one branch = one agent. A TASK file names `machine:`, `branch:`, `touches:` and `version-bump:`; a watcher only picks a TASK for its own machine.
3. Everything goes through a PR. No push to `main`.
4. Version bump (`package.json`, `src/data/releases.ts`, EN + VI entry) happens once, right before merge, after rebasing on `main`.
5. No local-only commits. Delete the branch after the merge. Add a `DONE` line with the PR and the Deploy Worker result.
6. Needs Chanh's OK first: Atlas live trading rules (for example `practice.ts`, `MIN_VOL_MULT`), cron, secrets, Cloudflare, `.github/` workflows, removing a feature, turning a shadow filter live.
7. Commit messages name the agent (`agent: milo|hermes-win|hermes-ubuntu|claude`) because merges all show as the same GitHub account.

## When Claude comes back
1. Read `LOG.md` from the last Claude line.
2. `git log` since that commit; list open branches and PRs.
3. Run `npm test` and `npm run build` on `main`; check the latest Deploy Worker run.
4. Add `CLAUDE-BACK` and take back any open task.

## Failover (added 2026-11-11)
**Command and work are separate.** The driver commands and is the only one who merges: Claude while it has limit, otherwise Milo. Hermes (Windows first, Ubuntu as fallback) only works under the driver and never commands or merges. If both Claude and Milo are away, Hermes may do green tasks only, no merges; red tasks wait for Chanh.

**Live files** are on the branch `handoff-log` (append-only, one small commit per line, never merged into `main`): `docs/handoff/LOG.md` (first line `driver: X since T`) and `docs/handoff/QUEUE.md`. The `LOG.md` on `main` is frozen history.

**Handover**
- Claude to Milo: Claude writes `OUT` and sets `driver: Milo`. If Claude stops suddenly, Chanh tells Milo "Claude hết limit". Milo also asks Chanh after 3 hours of Claude silence in the LOG. Milo writes a `DRIVER` line.
- Milo to Claude: Claude writes `CLAUDE-BACK` and `driver: Claude`. Milo finishes the task in progress, then yields.

**Queue and lease**
- A claimed task carries `lease_until` (claim time + 30 min). Hermes extends it while alive (heartbeat kept in `milo-shared`, read by Milo).
- Silent past the lease: the driver sets the task back to `todo` and gives it to the other machine. Half-done work stays on its own branch.
- Both machines off: the task waits and Milo tells Chanh.
- One task = one branch = one machine. Tasks with the same `touches` run one after another.
- Green tasks: agents may do them. Red tasks (live Atlas rules, cron, secrets, Cloudflare, `.github/`, removing a feature, turning a shadow filter live) need Chanh's OK.

