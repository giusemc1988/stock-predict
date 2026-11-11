# QUESTIONS-FOR-CLAUDE.md

Hermes writes here whenever it cannot proceed or does not understand. Chanh copies the "Prompt for Claude" block to Claude and brings the answer back. No secrets in this file (repo is public).

## Template (copy for each question; newest at the bottom)

### Q<number> — <short title> — status: OPEN | ANSWERED
- **When / task:** <date, what Chanh asked>
- **What I tried to do:** <1-2 lines>
- **What I saw:** <exact error text, file:line, command output (trim, no secrets)>
- **What I already tried:** <list>
- **Blocked on:** <knowledge | access | decision for Chanh | risky action>
- **Prompt for Claude (paste as-is):**
```
You are helping Hermes, a local agent on Chanh's Surface Pro 11 ARM, that maintains Neo Hub (repo giusemc1988/stock-predict, public; read docs/hermes/HANDOFF-HERMES.md and AGENTS.md first if you can). Answer for Hermes, with exact numbered steps or code, not for Chanh. Context: <...>. Problem: <...>. Evidence: <...>. Already tried: <...>. Question: <...>. Reply short, Vietnamese for any text meant for Chanh, English for technical steps.
```
- **Answer (filled after Claude replies):** <summary>

---
### Q1 — Can Hermes safely validate GitHub push/PR permissions without exposing credentials? — status: OPEN
- **When / task:** 2026-11-09, initial Neo Hub takeover capability survey.
- **What I tried to do:** Inspect GitHub CLI auth and test push access non-destructively.
- **What I saw:** `gh auth status` reports giusemc1988 logged in, token masked. `git push --dry-run origin HEAD:refs/heads/hermes/perm-check` showed a success-looking new-branch result, but command triggered a safety approval; subsequent `git ls-remote --heads origin refs/heads/hermes/perm-check` returned no ref. No definitive push permission proof.
- **What I already tried:** `gh auth status`, `gh pr list --state open`, `git push --dry-run`, `git ls-remote`.
- **Blocked on:** knowledge / permission verification.
- **Prompt for Claude (paste as-is):**
```
You are helping Hermes, a local agent on Chanh's Surface Pro 11 ARM, that maintains Neo Hub (repo giusemc1988/stock-predict, public; read docs/hermes/HANDOFF-HERMES.md and AGENTS.md first if you can). Answer for Hermes, with exact numbered steps or code, not for Chanh. Context: gh auth status reports logged-in giusemc1988 with token masked; `git push --dry-run` produced a success-looking result but safety approval intervened, and `git ls-remote` did not confirm the branch. Problem: establish actual push/PR permission safely without printing token values or keyring contents and without leaving remote refs. Question: Which read-only or safe commands are reliable, what does each prove, and what should Hermes do if rights remain uncertain? Also give minimum fine-grained PAT permissions scoped only to this repository and explain how Chanh can enter credentials locally without sharing them in chat.
```
- **Answer (filled after Claude replies):**

### Q2 — How to capture 360/390/820 screenshots without project Playwright dependency? — status: ANSWERED
- **When / task:** 2026-11-09, initial Neo Hub takeover capability survey.
- **What I tried to do:** Check whether Playwright packages/browser are present.
- **What I saw:** `node_modules/playwright`, `node_modules/@playwright`, and `$LOCALAPPDATA/ms-playwright` were absent.
- **What I already tried:** Read-only filesystem checks only; no installation attempted.
- **Blocked on:** knowledge / Chanh approval before installing tools.
- **Prompt for Claude (paste as-is):**
```
You are helping Hermes, a local agent on Chanh's Surface Pro 11 ARM, that maintains Neo Hub (repo giusemc1988/stock-predict, public; read docs/hermes/HANDOFF-HERMES.md and AGENTS.md first if you can). Answer for Hermes, with exact numbered steps or code, not for Chanh. Context: Windows 11 ARM64; repository has no declared Playwright dependency and no detected local Playwright browser. Problem: screenshot UI at widths 360, 390, and 820 without modifying package.json/package-lock.json. Question: determine how to detect and use installed Edge/Chrome headless safely; if unavailable, recommend an external isolated Playwright install compatible with ARM64 and provide a minimal script, including limitations and explicit approval point before installation. Do not assume a browser exists.
```
- **Answer (answered by Milo, 2026-11-11 — no Claude reply needed):** Use Microsoft Edge's built-in headless screenshot. No Playwright, no npm install, no package.json change. (1) Detect Edge in cmd: `where msedge` — expect `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. (2) Start the dev server (`npm run dev`, http://localhost:5173). (3) Run once per width: `msedge --headless=new --screenshot=C:\Users\chanh\milo-shared\shot-390.png --window-size=390,844 --hide-scrollbars http://localhost:5173` (repeat with 360,844 and 820,1280). (4) Open the PNGs and check the layout. If Edge is missing: isolated Playwright install OUTSIDE the repo (separate folder, own package.json; `npm i playwright`, `npx playwright install chromium`) — never add it to the repo's package.json; needs Chanh's approval first (downloads a ~150MB browser). Limits: cannot screenshot the LIVE app behind Cloudflare Access (Edge headless hits the Access login page) — use the local dev server; one viewport per run; dev server must be running. NOT live-tested on the Windows machine (asleep when written) — Hermes Windows should run `where msedge` first when it wakes.

### Q3 — What evidence can verify the live deployment behind Cloudflare Access? — status: ANSWERED
- **When / task:** 2026-11-09, initial Neo Hub takeover capability survey.
- **What I tried to do:** Check recent deployment runs and public Atlas status endpoint.
- **What I saw:** GitHub Actions latest listed Deploy Worker run #42661314438 completed successfully; public status endpoint returned HTTP 200 and a recent `diag.lastRun` with `cronLast.ok=true`. Main app remains behind Cloudflare Access; bundle/version and actual served app version not verified.
- **What I already tried:** `gh run list --workflow deploy-worker.yml --limit 3`; passive GET to public status endpoint.
- **Blocked on:** knowledge / live-site access.
- **Prompt for Claude (paste as-is):**
```
You are helping Hermes, a local agent on Chanh's Surface Pro 11 ARM, that maintains Neo Hub (repo giusemc1988/stock-predict, public; read docs/hermes/HANDOFF-HERMES.md and AGENTS.md first if you can). Answer for Hermes, with exact numbered steps or code, not for Chanh. Context: hub is behind Cloudflare Access; public atlas-status endpoint is reachable. A recent GitHub Deploy Worker workflow run is completed successfully. Problem: determine what evidence can establish that the expected app build is live without bypassing Access, logging into Cloudflare, using secrets, or manually deploying. Question: how to correlate workflow conclusion/commit SHA, public status version if exposed, and public asset bundle; which parts can only Chanh verify on phone/browser? Provide safe passive checks and state limits.
```
- **Answer (answered by Milo, 2026-11-11 — passive checks done, no Claude reply needed):** (1) Deploy Worker run 43118042654: completed, success, for PR #274 (commit 90550aa), 2026-11-11T23:12:40Z; run 42962929462 (PR #273, c95dc37) also success — the deploy workflow succeeded for the latest main commit. (2) Public status endpoint https://atlas-status.chanhmn1011.workers.dev/ : HTTP 200; diag.lastRun 2026-11-11T21:55:04Z (fresh), diag.cronLast ok=true, scanned 15, failed []; diag.today 212 decisions, 26 accepted. (3) The status JSON has NO version / APP_VERSION / commit / sha field anywhere, so the public endpoint cannot prove which app build is served. (4) Strong correlation: the JSON contains shadow.live / liveKeep (61 keep, +$270.35, PF 1.56) / liveSkip (109 skip, −$230.57) — these fields only exist because the PR #273 shadow code is RUNNING live; if the old build were serving there would be no live shadow tags. What only Chanh can verify: open the app on his phone/browser (he has Cloudflare Access) and read the version in the footer, and confirm it matches the deployed commit's version. Safe passive checks: `gh run list --workflow deploy-worker.yml --limit 3`, GET the public status endpoint, confirm shadow.live fields are present, Chanh checks the app footer version.
