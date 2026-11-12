# Playbook: change code in stock-predict

Hard rules are in `AGENTS.md`; this is the order Claude follows.

1. `git fetch`; branch from the latest `origin/main`, named `agent/short-topic`. One task = one branch = one agent. Never push `main`.
2. Read `AGENTS.md`. For Atlas also read `atlas/HANDOFF.md` and `atlas/LESSONS.md`. Live trading rules, cron, secrets, Cloudflare, `.github/` workflows and removing a feature need Chanh's OK first.
3. Make the smallest change. Match nearby code. Labels in English and Vietnamese (`scripts/i18n.test.ts` checks). A new feature is on by default, with a switch in `src/lib/aiRules.ts`.
4. Version bump, once, right before merge and after rebasing on the latest `main` (Hermes does not bump; whoever merges does): `package.json` version, `APP_VERSION`, and a top entry in `RELEASES` in `src/data/releases.ts` (English `changes` and Vietnamese `changesVi`). If the change belongs to one agent, also bump `src/data/agentVersions.ts`. `npm run t -- versions` must pass.
5. Run `playbooks/self-check.md`.
6. Commit message starts with the agent: `agent: claude|milo|hermes-win|hermes-ubuntu`. Open a PR whose first line says what and why.
7. Merge: Claude merges PRs Claude opened, Milo only its own, Hermes never merges; nobody merges another agent's PR without asking Chanh. Merge only when test and build are green and there is no conflict.
8. After the merge, check the Deploy Worker run succeeded (`gh run list --workflow deploy-worker.yml --limit 3`). The site deploys only through Actions; never deploy by hand.
9. Stacked PRs: retarget the next PR to `main` BEFORE deleting the merged branch.
10. Delete branches only with Chanh's OK for that list.
11. Add the `DONE` line to `docs/handoff/LOG.md` with the PR link and deploy result.
