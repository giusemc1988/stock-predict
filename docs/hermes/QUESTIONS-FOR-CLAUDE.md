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

### Q2 — How to capture 360/390/820 screenshots without project Playwright dependency? — status: OPEN
- **When / task:** 2026-11-09, initial Neo Hub takeover capability survey.
- **What I tried to do:** Check whether Playwright packages/browser are present.
- **What I saw:** `node_modules/playwright`, `node_modules/@playwright`, and `$LOCALAPPDATA/ms-playwright` were absent.
- **What I already tried:** Read-only filesystem checks only; no installation attempted.
- **Blocked on:** knowledge / Chanh approval before installing tools.
- **Prompt for Claude (paste as-is):**
```
You are helping Hermes, a local agent on Chanh's Surface Pro 11 ARM, that maintains Neo Hub (repo giusemc1988/stock-predict, public; read docs/hermes/HANDOFF-HERMES.md and AGENTS.md first if you can). Answer for Hermes, with exact numbered steps or code, not for Chanh. Context: Windows 11 ARM64; repository has no declared Playwright dependency and no detected local Playwright browser. Problem: screenshot UI at widths 360, 390, and 820 without modifying package.json/package-lock.json. Question: determine how to detect and use installed Edge/Chrome headless safely; if unavailable, recommend an external isolated Playwright install compatible with ARM64 and provide a minimal script, including limitations and explicit approval point before installation. Do not assume a browser exists.
```
- **Answer (filled after Claude replies):**

### Q3 — What evidence can verify the live deployment behind Cloudflare Access? — status: OPEN
- **When / task:** 2026-11-09, initial Neo Hub takeover capability survey.
- **What I tried to do:** Check recent deployment runs and public Atlas status endpoint.
- **What I saw:** GitHub Actions latest listed Deploy Worker run #42661314438 completed successfully; public status endpoint returned HTTP 200 and a recent `diag.lastRun` with `cronLast.ok=true`. Main app remains behind Cloudflare Access; bundle/version and actual served app version not verified.
- **What I already tried:** `gh run list --workflow deploy-worker.yml --limit 3`; passive GET to public status endpoint.
- **Blocked on:** knowledge / live-site access.
- **Prompt for Claude (paste as-is):**
```
You are helping Hermes, a local agent on Chanh's Surface Pro 11 ARM, that maintains Neo Hub (repo giusemc1988/stock-predict, public; read docs/hermes/HANDOFF-HERMES.md and AGENTS.md first if you can). Answer for Hermes, with exact numbered steps or code, not for Chanh. Context: hub is behind Cloudflare Access; public atlas-status endpoint is reachable. A recent GitHub Deploy Worker workflow run is completed successfully. Problem: determine what evidence can establish that the expected app build is live without bypassing Access, logging into Cloudflare, using secrets, or manually deploying. Question: how to correlate workflow conclusion/commit SHA, public status version if exposed, and public asset bundle; which parts can only Chanh verify on phone/browser? Provide safe passive checks and state limits.
```
- **Answer (filled after Claude replies):**
