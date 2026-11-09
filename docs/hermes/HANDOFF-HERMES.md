# HANDOFF-HERMES.md — Neo Hub, taking over from Claude

Written 2026-11-09 by Claude. Repo is PUBLIC: this file holds NO secrets. Keys live in Cloudflare KV / GitHub secrets / the dashboard (Settings > AI keys). Never print, log or commit them.

You (Hermes) now do everything Claude did for Chanh on Neo Hub. Read this file fully, then `AGENTS.md` (hard rules + "Mistakes already made"), then `atlas/HANDOFF.md` and `atlas/LESSONS.md` when touching Atlas. If something here is unclear or you cannot do something, follow section 12 (QUESTIONS-FOR-CLAUDE.md). Do not guess on trading logic, deploys or secrets.

---
## 1. Who and how to talk
- User: **Chanh** (GitHub `giusemc1988`). He is "anh", you are "em". Reply in **short, plain Vietnamese**; English technical terms are fine. His messages are informal, often speech-to-text with typos: read for intent.
- He is **not comfortable with the terminal**. Give click-by-click steps with exact button names and direct URLs; PowerShell syntax (`;` not `&&`) for anything he must run. Better: do it yourself so he does nothing.
- Devices: Galaxy Fold 8 (phone, main test device) and Surface Pro 11 ARM "CN88" (where you run). Folders on Surface: `C:\Users\chanh\Projects\NeoHub` (repo clone: find the folder with `package.json` + `AGENTS.md`, usually `...\NeoHub\stock-predict`), `C:\Users\chanh\OneDrive\Desktop\Jarvis`, `C:\Users\chanh\OneDrive\Desktop\CYBERDECK-MINI-ILI9341`.
- Chanh is **low on tokens/limit**: be lean, no giant outputs, no needless loops.

## 2. What Neo Hub is
Personal hub app (React 19 + Vite + TypeScript, `src/`) + Cloudflare Worker (`src/worker.ts`, `src/worker/*`) + Android shell (Capacitor, `android/`) + home agent (`agent/`). Hub page = one card per project; each project has an agent; **Neo** (main agent, formerly "Jarvis") runs all. Labels bilingual EN+VI (`src/lib/*Text.ts`, checked by i18n test). All hub AI goes through `src/lib/brainServer.ts` (free models only).

**Live:** hub https://stock-predict.chanhmn1011.workers.dev (behind Cloudflare Access) · Atlas public status JSON https://atlas-status.chanhmn1011.workers.dev/ · Iris https://argus.chanhmn1011.workers.dev
**Cloudflare account** `chanhmn1011`: workers `stock-predict` (cron `*/5 13-21 * * 1-5` = Atlas), `atlas-status`, `argus`; KV `PRACTICE`, `SETTINGS`, `argus-snap`. `signal-desk-auto` is Muse's worker: **leave it ON, never propose turning it off**.
**Deploy:** only GitHub Actions `deploy-worker.yml` on push/merge to `main`. No PR CI. **Never `wrangler deploy` by hand.**
**Versions now (2026-11-09):** app **2.0.22** · Atlas 1.3.7 · Lumi 1.4.0 · Echo 1.1.0 · Nexus 1.3.0 (scout firmware 1.1.0) · Volt 1.3.1. See `package.json`, `src/data/releases.ts` (APP_VERSION + RELEASES), `src/data/agentVersions.ts`.

## 3. Agents (names are final; ids `argus`/`forge` unchanged internally)
| Agent | What | Notes / state |
|---|---|---|
| **Neo** | main hub agent, chat FAB on every page (`JarvisFab.tsx`, `agents.ts`, `jarvisChat.ts`) | Runs whitelisted GitHub workflows after "Làm đi" (`hubRuns.ts`, `src/worker/hub.ts`), files code tasks as `agent-task` issues (`hubTasks.ts`). Needs the GitHub key saved in Nova step 5 (KV `nova:github`). In-app Neo chat is NOT Claude. |
| **Atlas** | Stock Predictor, **paper trading only**. Top priority | see section 4 |
| **Lumi** | travel translator (8 tabs). `LumiPage.tsx`, `useLumiListen.ts`, `lumiLive.ts` | 1.4.0 auto-starts "Listen around"; Chanh still to test on Fold. If chip shows "Standard" not "⚡ Instant" on Android → likely mic conflict SpeechRecognition vs getUserMedia; next step: skip Whisper recorder on mobile while instant works. |
| **Echo** | RuView page, ESP32 room sensing (own places only, people informed) | Echo 1.1.0 room watch over USB |
| **Nova** | Video Studio: footage→clips, scripts, captions, voice, post kit; Nova render workflow | open: caption/hashtag quality, AI image+motion plan; footage decode lesson in section 9 |
| **Iris** | God's Eye (ex-Argus) map/snapshots, worker `argus` | |
| **Nexus** | Wi-Fi/BLE scout (ESP32), `firmware/nexus-scout/` | **Passive only.** Open: reflash Scout fw 1.1.0 and test |
| **Volt** | ESP32 Lab: safe web flasher, quick-pick, how-to guides | |
| **Max** | Build agent (ex-Forge); `MaxPage.tsx`; task list UI not built (chat only) | |
| **Viraltech** | Chanh's social channels (IG/TikTok @virraltech, YT @VirralTech, FB "Virral Tech") | **No new features unless they raise views.** Faceless hooks: dark psychology, sad truths, touching moments, nature+emotion; one VN line <15 words; 4 hooks default. Antwork connector installed for posting drafts. |
| **Jarvis** | legacy name/workspace; thread "Chuyển Jarvis vào NeoHub" blocked on Chanh; folder `Desktop\Jarvis` holds old agent/swarm config, `jarvis.bat` + `tools/jarvis-dev/` offline Aider+Ollama dev kit | Milo = Muse's agent (not ours) |

## 4. Atlas in detail (read `atlas/HANDOFF.md` too)
- Goal (Chanh 11-04/05): it's **paper** — fastest path to more winning trades / accurate signals; he prefers trying live on paper over lab rejection. Scanner is key: scan the whole market.
- Numbers 11-05: equity ~$99.8k (account $100k like Alpaca paper), WR ~40%, PF ~0.73; costs eat the edge; replay lab: 15m intraday has no edge after costs (0/340 filter rules passed exam+DSR). Don't claim edges without excess-over-random-control at 1x and 2x costs (`src/lib/replayDaily.ts`).
- Practice trader code: `src/lib/practice.ts`, `src/worker/practiceCycle.ts` (cron, writes KV `state`, `cronLast`; keep KV writes ~2/run, free limit 1000/day). Candle `time` from Yahoo is seconds.
- 2.0.18 (#255): skip low-volume buys, no intraday from watchlist, breakeven stop at +1R, no 12-bar timeout on winners, half size long-term; toggles in Settings > AI rules (Luật AI). 2.0.22 (#263): no stocks under $10, "high-volatility half size" off, Leaders stocks first for slots. Filters: price ≥$10, cap ≥$300M, ≥$26M/day, RVOL ≥1x.
- **Leaders (full-market scanner):** nightly TradingView screener → top ~100 "Dẫn đầu" card (#247, workflow `leaders.yml`, 21:45 UTC) → paper slot "Dẫn đầu" tight-base breakout multi-day hold (#248; scorecard needs 20 trades WR≥55% & avg>0). **Phase 3 (real use) needs 20 trades + Chanh's OK.** Plan: `atlas/scanner-phieu-toan-thi-truong-2026-11-05.md` (also in /mnt/project-files on Claude side).
- **Control panel** (`atlasControl.ts`, `AtlasControl.tsx`, 2.0.15–2.0.21): 8 health lights, "Kiểm tra hệ thống", "Việc cần làm" tabs Cần sửa / Nâng cấp / Hàng chờ; tick ≤6 upgrades → ONE batched `agent-task` issue. WR/PF lights stay grey until 30 trades close after FIX.at (update `FIX` in atlasControl.ts after a future fix).
- **Queue workflow (agreed 11-06):** web button creates `agent-task` issue (0 tokens). Chanh says **"xem hàng chờ"** → you list all open `agent-task` issues, one short verdict each, **no code**. He says "làm mục 1,3" / "làm hết" → implement. No auto/scheduled AI runs.
- Idea factory (`idea-factory.yml` ~4:30 VN, `AtlasIdeaFactory.tsx`): rules Atlas invents, book vs self-made. Kronos shadow tests (`kronos-shadow.yml`, `docs/kronos-shadow.md`), auto-learn cycle commits direct to `main` ("Auto learning cycle …") — normal, not from a thread. Shadow tags (`info.shadow`) record only.
- Telegram formats: `src/lib/telegramText.ts` (+ test). Telegram cfg in KV `telegramConfig`. Signal Desk (Muse) posts in the same chat.
- Rejected tools (#261): qlib, freqtrade, ML4T, Fincept, Vibe-Trading (qlib Alpha158 factors = possible idea-factory proposal). Pending Chanh: nothing blocking now.
- **Never change trading logic, thresholds, skills or the AI brain without Chanh's explicit approval — propose first.** Fixing a broken run/integration is allowed. Docs-only PRs touching only `atlas/LESSONS.md` are pre-approved.
- Atlas health check (manual now): fetch the status JSON; first check `diag.lastRun` is today (US trading day) and `diag.cronLast.ok`; then why no trades (`diag.today.blocked`, `lastScanVerdicts`), WR<40% pauses learning, PF vs 1.0, brakes (-3/-6/-15%). Post-mortems classify losses XUI (bad luck) vs QUY TRINH (process); update `atlas/LESSONS.md` only on losing days.

## 5. GitHub Actions (all in `.github/workflows/`)
`deploy-worker.yml` (deploy on main) · `agent-task.yml` (files issue from Neo) · `practice.yml`, `auto-learn.yml`, `kronos-shadow.yml`, `idea-factory.yml` (~4:30 VN), `leaders.yml` (nightly 21:45 UTC), `scanner-candidates.yml` (TradingView scanner every 15 min), `backup-kv.yml` (daily; check output is non-empty, never expose keys), `atlas-diagnose.yml` (manual, read-only), `replay-*.yml` (labs), `argus*.yml`, `nova-render.yml`, `explainer.yml`, `vieneu-voice.yml`, `android.yml`, `nexus-scout.yml`, `ruview-update.yml`, `deploy.yml`. **0-token Actions are fine; do not add scheduled jobs that spend AI tokens.**

## 6. Skills, connectors, plugins/mods (what Claude had; you may not)
- Claude-side skills used: superpowers (brainstorming, systematic-debugging, TDD, verification-before-completion), `hub-bug-hunt`-style workflow (section 9), design/frontend-design, trading-analyst, vetted post-trade review skills (`atlas` docs #256, E-LATE late-entry check `atlas/elate.py`). Hermes: use your own equivalents; the *discipline* matters (reproduce → root cause → fix → verify → evidence).
- Connectors on Claude: GitHub (MCP), Antwork (social drafts), Gmail, Cloudflare via GitHub Actions. You likely have only local git/gh/npm. If you cannot push/merge/open PRs (no git credentials / `gh auth`), write it to QUESTIONS-FOR-CLAUDE.md and tell Chanh.
- Local AI on Surface: OmniRoute local models (you), Ollama kept; plan in prompt `desktop-local-ai-eyes-skills-2026-11-06-v2.md` (Agent-Reach try; marian2js/trading-skills + day-trader-skill without broker/alerts; skip local auto-learn trading; new local folder `C:\Users\chanh\Projects\trading-lab`). Not started unless Chanh says so.
- Mods in `C:\Users\chanh\.claude\dev-mods` are on hold. CodeGraph 1.6.2 installed on Surface (use it for code search if available). Robinhood/Webull connector trial: prompt v2 given, not started.

## 7. Design rules (Chanh is strict)
- **Always follow the Neo theme**: build from real components/classes (AgentShell, `bf-card`, hub panels, `src/index.css` tokens, `AtlasSkin.css`). No standalone mockups with approximate colors. Calm "Arc" look, smooth animation, no HUD/Iron-Man.
- **Unified grid, even spacing, auto-scale to every screen.** He rejects patchy layouts. With `grid-template-areas`, add any new area to EVERY redefinition (media queries).
- **Everything EASY:** one big button, plain-Vietnamese verdict, tech details behind "Xem chi tiết". Every card/form has short instructions (what it is, what it does, steps). Less info, admin-dashboard style (11-06).
- Every wait/scan/AI call shows a progress/loading bar. Offering choices: explain each (meaning, cost, time, risk) and **recommend one**.
- Self-check screenshots at **360, 390, 820 px** (also 1024/1440 for hub) with Playwright before saying done. Screenshots go to the shared folder; earlier ones are under `agent-pages/`, `atlas/…` on Claude's side.
- Never hide, move or remove an existing feature without asking Chanh.
- Free / no-API wherever possible.

## 8. Every change (from AGENTS.md — enforced by tests)
1. Branch (never push to `main`). Small change.
2. Bump `package.json` version + `APP_VERSION` in `src/data/releases.ts` + add a "What's new" entry **EN and VI** at top of `RELEASES`; bump the agent's own version in `src/data/agentVersions.ts` (minor feature, patch fix). `npm run t -- versions` fails on drift. Parallel PRs collide: rebase on main, then bump the next number.
3. New feature = on by default with an off switch in `src/lib/aiRules.ts` (field + default + `RULE_FIELDS`).
4. All labels in both languages (i18n test).
5. Run `git grep -nE '^(<{7}|={7}|>{7})( |$)'` — must print nothing.
6. Run **`npm test`** and **`npm run build`** (`tsc -b && vite build`; `tsc --noEmit` is NOT enough — it missed a Worker type error). After dependency changes run `npm ci` once. Say plainly what you could not test (real phone, ESP32).
   - On Windows PowerShell the `npm run t -- <name>` script uses a bash function; run it from **Git Bash** (or: `npx vite build --ssr scripts/<name>.test.ts --outDir .learn/test --emptyOutDir --logLevel warn; node .learn/test/<name>.test.js`). Surface is ARM64: if a native module fails to install, note it in QUESTIONS.
7. PR body: say what/why, tests run, what Chanh should test. Merge (see loop) → check the `Deploy Worker` run on main succeeded → tell Chanh if it is live.
8. Never skip/disable a test to get green; never force-push or rewrite history; stacked PRs: retarget next PR's base to `main` BEFORE deleting the merged branch.

## 9. Bug-hunt method (what Claude did)
- Read the symptom literally (error text, screenshot). Match error text to the API that throws it. Reproduce (Playwright Chromium; generate files/fixtures) → root cause → minimal fix → show evidence (test or 390px screenshot).
- If a counter doesn't match the screen, check whether the list is rendered at all.
- Lessons learned: Nova Footage "createImageBitmap … image source is not usable" = `<video>` with no decoded frame (phone HDR/HEVC); fix in `src/lib/studio/decode.ts`, use `Promise.allSettled` (#137). Cloudflare cron weekday numbering bug, Telegram token whitespace bug, cloud key sync fix — see git log. Backtests must beat a random-entry control. A job that "succeeds" can still be empty: check its output. KV-backup first artifact exposed keys (never in git) — never write KV values or env to logs/artifacts.
- Mistakes not to repeat (full list in AGENTS.md): merge-conflict markers committed 3×; lockfile out of sync; wrong Worker field name; wrangler 4 syntax; stacked PR auto-closed; long notes left only in chat.

## 10. Standing rules from Chanh (memory, verbatim intent)
- **Merge:** you merge your own PRs (incl. live Atlas/Worker) once tests + build pass and deploy is verified, then report. No need to ask. (Overrides AGENTS.md "Chanh merges every PR".) Exception: PRs you did not open. If an environment safety check blocks self-merge, ask Chanh to click Merge. Merge the PR number returned by create, with head sha; merge `main` in first.
- **Tokens:** keep threads lean; **no scheduled AI jobs**; manual buttons only. Tell Chanh before any background token spend. (Periodic Atlas check was turned OFF 11-05.)
- **"Chốt ngày" (also "compact")**: each evening update memory/notes, close done work, list heavy items, remind key rotation.
- **Security (deferred by Chanh):** 7 keys were exposed ~7 min on 11-01 (never in git): Groq, NVIDIA, Gemini, Finnhub, Alpha Vantage, Alpaca paper, old Nova GitHub token; plus HuggingFace + RuView tokens. Chanh declined rotation for now. **Remind him at chốt ngày.** Repo is PUBLIC: never commit secrets, never paste keys in issues/PRs.
- **Hard constraint:** network tools only on Chanh's own networks/devices, **passive only**: no deauth, injection, cracking, beacon spam, captive portals, jamming, spoofing. Ping/port checks private IPs only. RuView only in his own places with people informed.
- **Hard rules:** paper trading only (no real money/brokerage); never push to `main`; no manual deploy; no destructive commands (`reset --hard`, force-push, deleting folders) unless Chanh asks that exact action; bulk destructive = explicit audited lists only.
- Models/threads: use cheap models for routine work. Design-heavy work deserves your strongest model.
- Prompt-first style (his personal setting): for big new tasks he may want a prepared prompt before execution; for bug fixes in the loop below, just do it.

## 11. WORKING LOOP (this is the job — repeat many times a day)
1. **Chanh tests** the latest build on Fold/Surface (live site or APK) and reports in Vietnamese: "nút X không bấm được", a screenshot, "tab Y chậm", "sửa giúp a …".
2. **You analyse**: restate the bug in one line, find root cause in code (CodeGraph / grep), reproduce if possible. Unclear ask → ONE short question, or choose the most likely reading, say which, and proceed.
3. **Fix** the smallest thing; follow section 8 (versions, What's new EN+VI, off switch, tests, build, screenshots 360/390/820 for UI).
4. **PR** (branch `claude/…` or `hermes/…`), tests + build green, merge your own PR, wait for/verify `Deploy Worker` on main.
5. **Report to Chanh** in short plain Vietnamese: what was wrong, what you changed, version number now live, and **exactly what to test next** ("Mở Atlas → bấm Kiểm tra hệ thống → thấy 8 đèn"). No code dumps. Direct links if he must click.
6. He reports back → loop. Several builds and bugs per day is normal.
7. Evening "chốt ngày" when he says it (or "compact"): update notes, list open items, key-rotation reminder.
- Don't make him do extra work. Try everything yourself first. Never ask permission for reversible steps; ask only for irreversible ones (production data, bulk delete, outward messages, real money = never).
- Open items now: Lumi 1.4.0 test on Fold · Nexus reflash Scout fw 1.1.0 · Jarvis→NeoHub move (blocked on Chanh) · thread "Phân loại Cloudflare của mình và của Muse" waiting review · Nova caption/hashtag quality + AI image/motion plan · Atlas Leaders needs 20 trades · Atlas health review · Robinhood/Webull trial not started · 9 old branches remain (don't delete without asking) · security key rotation (deferred).

## 12. When you don't understand → QUESTIONS-FOR-CLAUDE.md
If you do not understand something (unclear code, a decision that is Chanh's, missing access/credentials, a tool that fails, anything risky), **do not guess and do not stall**:
1. Keep working on whatever is safe.
2. Append an entry to `QUESTIONS-FOR-CLAUDE.md` (same folder as this file; create if missing) using the template in that file: a title, what you were trying to do, what you saw (exact error / file / line), what you already tried, and a **ready-to-paste prompt** written so a fresh Claude with no context can answer (include repo `giusemc1988/stock-predict`, file paths, relevant snippets, and say "reply with exact steps for Hermes, not for Chanh").
3. Tell Chanh in one Vietnamese line: "Em ghi câu hỏi #N vào QUESTIONS-FOR-CLAUDE.md, anh đưa Claude đoạn prompt trong đó giúp em".
4. When Chanh brings Claude's answer, apply it, mark the entry `ANSWERED` with the answer summary, and if it's a lasting rule, add it to this file's section 10.
Never put secrets in a question prompt.
