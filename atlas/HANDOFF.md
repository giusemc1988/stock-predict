# Atlas handoff (30/10/2026, 09:30 UTC)

This note is for the thread that takes over Atlas from "Atlas: kiểm tra định kỳ Stock Predictor". Earlier summary: `atlas/tom-tat-atlas-2026-10-25.md`.

## 1. Live state (checked 30/10 09:30 UTC)
- **App:** https://stock-predict.chanhmn1011.workers.dev. It sits behind Cloudflare Access. Version on main is 1.64.0.
- **Public status:** https://atlas-status.chanhmn1011.workers.dev/ (JSON, no auth).
- **Numbers:**
  - Equity $9,947.11 (−0.53%), 307 closed trades, 1 open.
  - WR 41.4%, PF 0.87.
  - learning "active (WR 41%)", brakes normal, Kelly n/a.
- **Last scan:** lastRun 2026-10-29T21:55Z. `cronLast` ok: 29 markets, 0 failed.
- **Cron since 26/10:** the Atlas cron has run normally every trading day.
- **Workers (Cloudflare):**

  | Worker | What it is | Cron | KV / bindings |
  |---|---|---|---|
  | stock-predict | Atlas + hub | `*/5 13-21 * * 1-5` | PRACTICE <kv-id>, SETTINGS <kv-id> |
  | atlas-status | Public status page | none | reads PRACTICE (`state`, `cronLast`) |
  | argus | Iris | none | KV argus-snap, binding HUB → stock-predict |
  | signal-desk-auto | Muse's | `*/30 12-22 * * 1-5` | own KV sd_auto_log, own Telegram secrets |

- **signal-desk-auto:** Chanh keeps it running on purpose. He compares it with Atlas in the same Telegram chat. **Never propose turning it off.**
- **Deploys:** `.github/workflows/deploy-worker.yml` deploys on every push to main (stock-predict, then atlas-status). There is no CI on PRs. Verify locally with `npx tsc -b`, `npm test`, `npm run build`, `npx wrangler deploy --dry-run`.
- **Direct commits to main:** other automation commits straight to main, e.g. "Auto learning cycle" and "Kronos shadow test". These are not from this thread.
- **`atlas-diagnose.yml`:** manual workflow_dispatch, read-only. Shows Cloudflare schedules, invocations per hour and deployments.

## 2. PRs from this thread (all merged)
- **#96:** fixed the lock file (mp4-muxer) and added the atlas-status deploy step.
- **#100:** short Vietnamese Telegram messages, plus a daily summary after close (section 6).
- **#127:** atlas-status `diag` (lastRun, verdicts, today's decisions, recentEvents, recentDecisions).
- **#129:** each cron run writes KV `cronLast`, shown at `diag.cronLast`.
  - Format: `{at, phase:'started'}`, then `{phase:'done', ok, ms, message}`, or `{ok:false, error}` with message + stack (≤2000 chars).
  - Workers observability is on in wrangler.jsonc.
- **#130 (v1.56.2):** removed the Studio/Devices cards from the Atlas page.
- **#131 (v1.56.3):** `onBars` in `src/lib/practice.ts`.
  - A bar that opens below the stop exits at the open (`Math.min(b.open, p.stop)`), not at the stop.
  - Target fills are unchanged.
  - If one bar hits both stop and target, it counts as the stop.
  - Test is in scripts/practice.test.ts (stop 95, open 92 → exit 92).
  - Chanh approved this ("Ok sửa cho a altas").
- **Vega check:** Muse's Vega bug (stop/target never executed) does **not** affect Atlas.

## 3. Task list (6/8 done)
1. ✓ Status page shows the last scan, verdicts and decision log (#127)
2. ✓ Confirmed Atlas never ran on 23/10 while the cron was still scheduled
3. ✓ Cycle runs fine locally in Node and workerd
4. ✓ Every cron run records its outcome; Workers Logs is on (#129)
5. ✓ Daily check looks at "did Atlas run today" first
6. ✓ 26/10 20:40 VN: Atlas runs normally again (30 markets, 0 failed, 2 trades opened)
7. ○ **Atlas reports every day why it did or didn't trade.**
   - Asked Chanh on 26/10: "Anh OK thì em làm tiếp task 7". **No answer yet.**
   - Partly covered by the new check 2/5 in the health check (section 4).
8. ○ Plan to upgrade Atlas's pro-trader knowledge, skills and memory (technicals, news, charts). Plan only; changes need Chanh's approval.

## 4. Atlas Daily Health Check (scheduled task)
- **Trigger id:** `<trigger-id>`
- **Schedule:** cron `0 21 * * 1-5` (21:00 UTC Mon–Fri = 04:00 VN the next day).
- **Status:** **enabled**. Next run 2026-10-30T21:01Z.
- **Bound session:** persistent, `<session-id>`, i.e. **this old thread**. It must be rebound to the new thread.
- **Prompt:** updated 30/10 09:23 UTC as Chanh asked. Full text:

```
Run Atlas (Stock Predictor) health check after US market close.

Fetch https://atlas-status.chanhmn1011.workers.dev/ (public, no auth). Fields: equity, trades, open, wr, pf, return, learning, brakes, kelly, and diag {lastRun, minutesAgo, scanned, failed, lastScanVerdicts, today{decisions, accepted, blocked}, recentEvents, recentDecisions, cronLast}.

Check in this order:
1. Did Atlas run today? diag.lastRun must be today (US trading day). If not, or diag.cronLast.ok is false, that is the top problem: quote cronLast.error, find the cause in the repo (src/worker.ts scheduled, src/worker/practiceCycle.ts), fix it via PR (test + merge allowed, Chanh's standing approval for fixing a broken run/integration), and report.
2. If it ran but closed no trades: explain why from diag.today.blocked and lastScanVerdicts (e.g. all HOLD, blocked by Slots/Risk gate).
3. WR < 40% (learning paused), PF trend vs 1.0 (target 0.85-1.15), brakes (-3/-6/-15%), Kelly status.
4. One line "learning": active or paused, and why (from the `learning` field and WR; paused when WR < 40%).
5. If trades closed today, a short post-mortem in Vietnamese:
   - wins/losses count and total result.
   - For each losing trade: ticker, main cause, classified XUI (bad luck, process correct) or QUY TRINH (process problem). Use only evidence from diag.recentEvents / diag.recentDecisions; if the cause is not there, write UNKNOWN. Never invent a cause.
   - Read atlas/LESSONS.md in repo giusemc1988/stock-predict (main branch) and count how often each QUY TRINH cause has occurred, including today. Say plainly when there is not enough data to call it a pattern.
   - Tier per cause: Log (1st time) / Watch (2 times) / Propose skill-or-rule (3+ times, with a concrete fix for Chanh to approve). Proposals are text in the report only; do not implement them.
6. Update atlas/LESSONS.md ONLY on days with a losing trade. Keep it under ~60 lines: one table (cause, count, last seen, tier) plus the 10 most recent losing trades, one line each (date, ticker, P&L, cause, XUI/QUY TRINH); fold older trades into the counts. Create the file if it does not exist. Branch from latest main (e.g. atlas-lessons-YYYY-MM-DD), open a PR that changes ONLY this file, verify the PR diff touches only atlas/LESSONS.md, then merge it using the PR number the create call returned. Chanh pre-approved docs-only PRs for this one file.

Report in Vietnamese, short, in this thread. If no trades closed and all is fine: one line "✓ Atlas on track (WR X%, PF Y, hôm nay N lệnh, ±Z)".

Hard rules: never change trading logic, thresholds, skills or the AI brain without Chanh's explicit approval; any lesson for a skill goes to Chanh as a proposal only. No secrets, no manual deploys, no real-money trading, never push to main.
```

- **atlas/LESSONS.md:** does not exist on main yet. The first losing day will create it.
- **Limit of the post-mortem data:** `diag.recentEvents` and `recentDecisions` only hold the last 8 entries. A day with many trades will produce some UNKNOWN causes. Widening that is a change to atlas-status (not trading logic), but ask Chanh first.

## 5. Open issue: no health-check runs 26–29/10
- **Cause:** on 26/10 Chanh asked to stop every background task except the Monday 20:25 Atlas check, and the coordinator disabled this check then. It was re-enabled around 30/10 07:59 UTC.
- **Atlas itself was unaffected:** cron runs on 26–29/10 were OK.
- **Still to confirm:** that tonight's 21:00 UTC run actually fires.
- **Backup check:** a one-time task `<trigger-id>` fires 2026-10-30T21:45Z into this old session. It checks `last_fired_at` and runs the check by hand if it didn't fire.

## 6. Telegram formats (src/lib/telegramText.ts, tests in scripts/telegram-text.test.ts)
- **Buy:**
  `🟢 MUA X (trong ngày)` / `SL q @ $p` / `🎯 Chốt lời $t (+x%)` / `🛑 Cắt lỗ $s (−x%)` / `💬 lý do` (≤90 characters, from `pick.vi`) / `🕐 HH:MM VN`
- **Sell:**
  `✅ THẮNG X +$ (+%)` or `❌ THUA X −$ (−%)` / `$entry → $exit · SL q` / `💬 chạm chốt lời|chạm cắt lỗ|…` / time
- **Daily summary:** `sendDailySummary` in src/worker/practiceCycle.ts, ≥10 minutes after close.
  - Deduped on KV `telegramSummaryDay`; skipped when there were no trades and no openings.
  - Content: `📊 TỔNG KẾT dd/mm · lệnh tập` / net + wins/losses + WR / equity / up to 10 trades ("… và N lệnh khác") / lessons / `⚙️ AI tự học: … · Phanh: …`
- **Telegram config:** KV `telegramConfig`. Signal Desk posts to the same chat with its own bot.

## 7. Known incident: 23/10
- Atlas never ran all trading day. lastRun was stuck at 22/10 21:55 UTC while the cron was still scheduled. There were about 20 deploys that day (other hub work).
- **Unproven hypothesis:** the runs failed early and the `catch` in `scheduled` swallowed the error, or the cron did not fire. There was no recorder at the time, so the **root cause is unknown**.
- **Now:** `cronLast` and Workers Logs will catch it if it happens again. Always check `diag.lastRun` first.

## 8. Chanh's hard rules and preferences
- **Phone only:** no terminal or desktop steps for him. Try everything Claude can do before asking him.
- **Trading changes:** never change trading logic, thresholds, skills or the AI brain without his explicit approval; propose first.
- **Fixes and merges:** fixing a broken run or integration is allowed: PR, local tests, merge.
  - Merge using the PR number the create call returned, with expectedHeadSha.
  - Bump the version in package.json and add an entry in `src/data/releases.ts`.
  - Many threads push in parallel, so merge main first.
- **LESSONS.md:** docs-only PRs that touch ONLY `atlas/LESSONS.md` are pre-approved to merge.
- **Never:** secrets, manual deploys, real-money trading, or pushing to main.
- **Free APIs:** prefer free / no-API options.
- **Loading bars:** every wait in a hub app shows a loading/progress bar.
- **Choices:** when offering choices, explain each one and recommend one.
- **Language:** reports to Chanh in Vietnamese, short.
- **Atlas is the top priority.** Chanh wants it to explain why it trades or doesn't, learn from losses, and keep being upgraded like a veteran Wall Street trader.

## 9. Questions waiting on Chanh
- **Task 7:** go ahead with having Atlas report every day why it did or didn't trade? Asked 26/10, no answer yet. Part of it is now in the health check.
- **Task 8:** the pro-trader knowledge upgrade plan. Not started; it needs a plan and his approval.
- **Health-check scope (not asked yet):** widen `recentEvents` / `recentDecisions` in atlas-status beyond 8 so the post-mortem has enough evidence.

## 10. Audit + replay lab (01/11, thread "Review Atlas learning and find trusted sources")
- **All merged and deployed:** #209/#210 KV backup fixed, with a broad secret filter; daily snapshot on branch `backups`. #211 shadow filters (v1.91.0). #213 replay lab (v1.93.0). #214 strategy variants (v1.94.0). Nothing is left uncommitted.
- **Report:** https://claude.ai/artifact/SziQJVJftoXkNsayo268VD
- **Live results:**
  - 314 trades, WR 41%, PF 0.87, −$53. The loss is basically costs: −$3 gross, $50 in costs.
  - The server learner never ran. Since #211 it reads /auto-learning.json, but it still only labels trades.
- **Shadow mode (#211):**
  - Every new position gets an `info.shadow` tag. Rule 1 is volume ≥1x; rule 2 is no watchlist picks for day trades.
  - The tags are recorded only and block nothing.
  - Results appear in the atlas-status `shadow` field and in the Telegram line "🧪 Chạy bóng".
- **Replay lab:**
  - `npm run replay`, or the manual Action "Atlas replay lab", writes public/replay-lab.json.
  - 0 of 340 filter rules passed the exam + DSR test.
  - Strategies S1–S4 (hold to close, ATR exits, last-half-hour momentum, bounce) all failed the exam.
  - Conclusion: 15m intraday has no edge after costs.
- **Chanh's decision (01/11 22:21):**
  - Keep Atlas unchanged and wait for the live shadow results.
  - No live change. (A daily-bar swing lab was declined here, then approved later the same night; see section 11.)
  - A one-shot reminder is set for 16/11 in the old thread. If ≥50 live-tagged trades exist by then, ask Chanh whether to turn rules 1 and 2 on.
- **Security:**
  - The first backup artifact exposed keys for about 7 minutes; it was deleted, and the keys never reached git.
  - Chanh declined rotation. The suggestion to rotate at least the Nova GitHub token stands.

## 11. Daily-bar lab (01/11 night, Desktop session)
- **Chanh's decision:** "Làm những gì em nghĩ sẽ làm Atlas ready to trade soon". This overrides "no daily-bar swing lab" in section 10. Live trading is still unchanged.
- **What:** `npm run replay:daily`, or the manual Action "Atlas daily replay lab", writes public/replay-daily.json.
  - Yahoo daily bars from 2010 (free, adjusted), 97 liquid US names.
  - Signal on day t's close, entry at t+1 open. A stop is checked before a target, and costs are the same as in the 15m lab.
  - Strategies: D1 weekly reversal, D2 52-week high, D3 RSI(2) pullback, D4 gap/volume event proxy.
- **Result:**
  - Raw returns are positive, but the exam (2021-03 to 2026-10) was a bull run on survivor names.
  - Each strategy was compared with a random-entry control: same symbols, same count, same exits, 200 seeded draws. **None passed.**
  - D1 is the only one with a real-looking excess (+0.21%/trade, p=0.03), but it fails DSR.
  - D4's excess disappears without MARA, SMCI, RIOT, PLTR and ARM.
- **Next ideas, not started:**
  - A point-in-time universe, to remove survivorship.
  - D1 with more data, or a cross-check on another universe.
  - Market-neutral versions (long the strategy, short SPY), so drift cancels out.
- **Skills added to the repo:** `.claude/skills/backtest-expert` and `.claude/skills/strategy-pivot-designer`.
  - Source: tradermonty/claude-trading-skills, MIT, vetted. Read them before changing any lab.
