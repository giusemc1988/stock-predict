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
