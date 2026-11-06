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

## 12. Rounds 2-3, shadow leads, open work (01/11 night, Desktop session)
- **Merged:**
  - #218 lab rounds 2+3. Results are in public/replay-daily.json (`round2`) and public/replay-intraday.json.
  - #219 shadow leads, record only. It shows up in the atlas-status `shadowLeads` field and the Telegram 🧪 lines. Off switch: AI rule `shadowLeads`.
- **Leads (all fail DSR after 28 trials, so shadow only):**
  - L1, D1 reversal only when VIX ≥ its 252-day median: excess +0.375%/trade, p≈0.
  - L2, intraday winners held overnight instead of closed: +0.26%/trade, p=0.03.
  - L3, ETF time-series momentum: maxDD −8% vs SPY −23% on the exam, and −18% vs −47% on the book.
- **Dead ends (do not retry):** 15m scalping, opening-range breakout, SPY/QQQ intraday momentum, pyramiding, and averaging down (it doubles the worst-trade size).
- **Running:** Action "Atlas intraday replay lab" with Alpaca data from 2018 (run 41375695627). Read public/replay-intraday.json when it finishes.
- **Unfinished branches (WIP commits, tests not run):**
  - `claude/atlas-news-lab`: news vs no-news split (Chan 2003). Alpaca news API, using only headline timestamps, with no LLM on past news.
  - `claude/atlas-edge-sweep`: FOMC, turn-of-month, OPEX, the VIX/VIX3M switch, HYG, pairs, insider clusters (EDGAR), PUT/BXM, plus a risk-parity ensemble of every surviving edge.
- **Chanh's standing rule (01/11):**
  - Research-only lab PRs may be merged by Claude.
  - Anything that changes live Atlas or the deployed Worker needs his OK first.
  - Heavy work runs in the cloud session, because local runs flood his PC with console windows.
- **Goal:** a Vietnamese summary before the Monday 09:30 ET open: which edges are real, and what Atlas should shadow or switch on.

## 13. Round 4: news lab, edge sweep, Alpaca intraday (02/11, cloud thread "Find real Atlas edges before Monday open")
- **Merged:** #221 news lab (`replay-news.yml`, public/replay-news.json), #222 edge sweep (`replay-edges.yml`, public/replay-edges.json, `npm run replay:edges`). Both lab only.
- **Summary for Chanh (Vietnamese):** https://claude.ai/artifact/15kZdq3H9yLtjtPcGATGft
- **Trial count:** the Deflated Sharpe now counts every trial of every round (`TRIAL_LEDGER` in src/lib/replayEdges.ts, 398 = 340 filter rules + 4 + 14 + 14 + 14 news + 10 edges + 2 portfolios). Add new rounds to the ledger. The edge sweep computes DSR on daily return streams (per-trade Sharpes of different holding periods are not one unit).
- **Results, nothing passed:**
  - Alpaca 5m from 2018 (run 41375695627): ORB +0.05%/trade at 1x but −0.03% at 2x. Dead.
  - News (Alpaca timestamps only, 461k items from 2018-01): almost every name has news every week, so the "no news" buckets have 7-83 trades. The test is underpowered for these large names. Post-hoc: big drops (≤−4%) WITH news bounce (+0.56%/trade over random, p<0.01), opposite to Chan. Hypothesis only.
  - Edge sweep (2007-2026, exam from 2020-03-20): FOMC, turn of month, OPEX, VIX/VIX3M, HYG, PUT, BXM all fail. Pairs: excess +0.38%, p=0.015, DSR 0.01. Overnight winners (buy the close of a +3%/2x-volume day, sell the next open): +0.37%/trade, p<0.01, sleeve Sharpe 1.4, DSR 0.39. Without 14 high-vol names (`HIGH_VOL`): +0.06%, negative at 2x. The daily version decides on the close (slight look-ahead).
  - Risk-parity portfolio of all sleeves + L1: exam Sharpe 1.39 vs SPY 1.13, maxDD −4.6%, DSR 0.38.
- **Insider (EDGAR):** run 2026-11-02 from a Claude session with Chanh's OK (his contact passed only as the env var `SEC_USER_AGENT`, never committed). 81 quarters, 221 trades. Exam: 63 trades, +6.0% per 60-day hold vs +2.7% for random entry (excess +3.3%), p=0.07, DSR 0.03. Not passed. As a sleeve: exam Sharpe 0.70 vs SPY 1.13. The other ideas reproduced the same verdicts.
- **Recommendation given:** no live change. Keep L1-L3. Proposed L4 shadow "overnight winners" decided at 15:50 ET (record only), with the high-vol names reported separately. Stop new intraday rounds.
- **Standing rule (02/11):** Chanh: merge PRs yourself, including live Atlas/Worker ones, once `npm test` + `npm run build` pass and the deploy is verified, then report.

## 14. Round 5: momentum lab (02/11, cloud thread "Find 5 changes to improve Atlas", v1.98.1)
- **What:** `npm run replay:momentum` or the manual Action "Atlas momentum lab" writes public/replay-momentum.json. 12-1 month cross-sectional momentum, monthly, long only, on 96 stocks (survivor-biased) and 41 ETFs, with and without SPY > 200-day average. Control = 200 random-pick draws on the same dates/costs. Four trials added to `TRIAL_LEDGER` (`momentumRound5`), total 402. A stock idea only counts when its ETF twin passes.
- **Result (exam from 2020-08, 75 months): nothing passed.**
  - M1 stocks top-10: Sharpe 1.32 vs SPY 1.07, DSR 0.99, would pass alone, but the survivor-biased list explains much of it (without the 14 high-vol names Sharpe 0.97, DSR 0.90) and its ETF twin failed.
  - M3 ETFs top-5: Sharpe 1.15, maxDD −17% vs SPY −23%, beats random picks (p<0.01), DSR 0.94, a near miss (rule needs 0.95). The BOOK (2008-2020) Sharpe was only 0.32 (CAGR 4%), so the result lives in the exam years. Not tuned afterwards.
  - Trend filter (M2, M4) made both worse.
- **Also checked (same thread):** the proposed "cost gate" is useless: median planned target 3.2% vs round-trip cost ~0.1%; gross P&L is −$3, so fees are only the toll on a system without edge. Insider cluster buys (PR #226) failed.
- **Not started:** vol-managed sizing + Kelly fix (live logic, needs Chanh's OK), meta-labeling (lowest expected value).

## 14. Round 6: short lab (02/11, cloud thread "Test short selling ideas for Atlas")
- **Question (Chanh):** besides buying low, can Atlas short? Alpaca paper allows short stock (margin account); Atlas has only ever gone long.
- **Lab only (PR, v1.99.1):** `npm run replay:short` or the manual Action "Atlas short lab" writes public/replay-short.json. Code: src/lib/replayShort.ts, scripts/replay-short.ts, scripts/replayshort.test.ts. TRIAL_LEDGER `shortRound6` = 4, total now 406.
- **Model:** Yahoo daily 2007+, 94 names (no ETFs), exam = newest 1/3 (from 2020-03-20). Per-name costs + borrow fee (1%/yr, 8%/yr for the 14 HIGH_VOL names, doubled at 2x). Hard stop above entry; a gap through it fills at the open. Control = 200 seeded random shorts of the same names, years and halves, same exits and borrow. Pass rule = the same as the other trade-based ideas (avg > 0 net at 1x and 2x, excess over random p <= 0.05, book excess > 0, DSR >= 0.95 over all trials).
- **Ideas:** S1 fade +7%/2x-volume spike (hold 5, stop +8%), S2 new 20-day low while SPY < 200-day average (hold 10, stop +8%), S3 10 worst 12-1 names monthly (stop +15%), S4 overnight short of -3%/2x-volume days. Kronos "forecast down" is not testable (no forecast history): the live Kronos shadow log would have to collect it first.
- **Result: nothing passed.** Exam average per trade at 1x: S1 -0.75%, S2 -1.87%, S3 -1.76%, S4 -0.17% (random shorts -0.99, -1.14, -2.14, -0.19). Only S1 and S3 beat random shorts slightly (+0.24%, +0.37%; p 0.20 and 0.12), and both lose money absolutely. Hedged with a long SPY they still lose. 33-40% of stops hit; worst single trades -31% (S1) and -47% (S3), i.e. stops do not cap the loss when a stock gaps. Same verdicts without the 14 high-vol names.
- **Recommendation:** no live short, no shadow line. The 2020-2026 market rose, a random short lost about 1-2% per trade, and none of the ideas earned that back. Revisit only if a new, different idea appears (for example a bear-market-only sleeve once there is a bear market to test on, or Kronos forecasts after enough shadow history).

## 15. Idea factory (02/11, cloud thread "Let Atlas invent its own trading ideas", v2.0.0, Atlas 1.2)
- **Chanh's ask:** Atlas should come up with its own rules ("sách vở thì ai cũng giống ai"), with Opus thinking in it, and show them like the signal board: 📚 Book vs 🧠 Opus self-made win rates side by side, on the Atlas Hub card too.
- **Code:** src/lib/ideaFactory.ts (features, rule grammar, genetic search, vault exam, signals + grading), src/data/ideaSeeds.ts (30 seeds O1-O30 written by Claude Opus, each with a "why"), scripts/idea-factory.ts (`npm run ideas`, `--signals-only`), public/idea-factory.json, workflow idea-factory.yml, src/lib/ideaFactoryView.ts (duel), src/components/AtlasIdeaFactory.tsx (board card), Hub card duel row. AI rule `ideaFactory`.
- **Opus thinking is free:** brainServer has no paid Anthropic provider. Instead Claude writes seeds in the repo. When Chanh says "nghĩ thêm ý tưởng": read public/idea-factory.json (what died and why), then append seeds O31+.
- **Tests:** discovery 2008-2017 (fitness = t-stat of the DAILY excess over the symbol's average same-hold trade, times the share of 3 eras that are positive; at least 300 trades and 60 days), validation 2018-2022 at 2x costs (finalists: at most 5, one per feature set), vault 2023-now with the full lab rule (200-draw random-entry control at 1x and 2x, p <= 0.05, at least 100 trades on at least 30 days, still positive without HIGH_VOL, DSR >= 0.95 on one return per entry day, with trials = ALL_ROUNDS_TRIALS + cumulative factory trials). Same-day clustering matters: an early version ranked "market crash" rules first (thousands of trades on 3-29 days).
- **Runs:** "Chạy xưởng" (button on the board, or Neo "chạy xưởng ý tưởng") = full search, about 1-2 min plus setup, adds about 800 trials. **Chanh approved (02/11 09:05Z) a daily SIGNALS-ONLY run** (cron 21:30 UTC Mon-Fri): no new rules and no new trials. It only logs today's signals from the saved rules and grades the old ones (next open → close after hold, stop, 1x costs).
- **Run #1 (local, committed):** 800 rules; 3 finalists (O28/O6 "sharp week drop far above the 200-day average, hold 20"), all FAILED the vault (excess about -2.8%, DSR 0.05). 0 passed. Their signals are logged as a live test with an honest note on the card.
- **Next:** a rule that passes → shadow line only with Chanh's OK. Compare the duel after 30 or more graded signals.

## 16. Lab audit (02/11, cloud thread "Audit why every Atlas lab fails", v2.0.4, Atlas 1.2.4)
Chanh suspected the lab itself was broken because ~400 lab ideas + 800 factory rules all failed. Checked with controls (`npm run lab:audit`, public/lab-audit.json).
- **Real bug, fixed:** the Deflated Sharpe measured "luck" with the spread of the Sharpes of the few ideas in the same round. Wrong unit (per-trade Sharpe of other holds, discovery years) and random by round: far too strict in the factory and edge sweep (a planted +1%-per-5-day-trade edge failed 5/5; SPY 2023-26, Sharpe 1.37, scored 0.000), too lenient in momentum (4 near-identical ideas, tiny spread: ETF momentum 0.94). Now `deflatedSharpe(rets, trials)` uses `nullSharpeVar(n)` = 1/n (the spread of a zero-edge Sharpe over the same number of returns). Planted edge now: +0% 0/5, +0.5% 1/5, +1% 5/5.
- **Trial count, fixed:** `HOLDOUT_TRIALS` = every ledger round except the 340 15m filter rules (other data) = 66. The factory adds only rules that reached the vault (`trials.vaultTotal`), not the ~800 discovery-only rules. The bar still rises with every idea judged on the recent years. `ALL_ROUNDS_TRIALS` (406) is still recorded.
- **Checked, OK:** costs (1.5-11 bps a side, not double-counted), next-open entry, random control matched by symbol + year, p-values, annualization. Known and left: universe is today's survivors (helps longs, does not cause failures); daily overnight idea decides on the close (slight look-ahead, already noted).
- **Re-scored (nothing passes, now for real reasons):** overnight winners DSR 0.89 but only +0.06%/trade (negative at 2x) without the 14 high-vol names; ETF momentum 0.68, stock momentum 0.84 (needs ETF twin); insider DSR 0.28, p 0.07 (63 trades); pairs p 0.015, DSR 0.22; PUT-write 0.83 (book fails); all-sleeve portfolio 0.87; factory finalists lose to random in the vault (excess about -2.8%, p 1); shorts all lose.
- **Next:** no new idea rounds; wait for the L1-L4 shadow review on 16/11.

## 17. Review skills + E-LATE check (05/11, Desktop session in C:\Users\chanh\Projects\trading-lab)
- **Skills added (docs only, no app code):** `.claude/skills/post-trade-debrief`, `post-trade-review`, `journal-pattern-analyzer`, `risk-reward-sanity-check`. Source: marian2js/trading-skills, MIT (`.claude/skills/LICENSE-marian2js`), commit f1ae7d4, vetted: Markdown only, no network, no orders. Its `live-trade/etoro` skill (real orders, broker keys) was rejected. Use them for the post-mortem in the Daily Health Check: debrief a closed trade, find repeated QUY TRINH causes across trades, and check whether a plan's stop/target fits its holding time.
- **E-LATE (lab only, read-only on backups/backup-2026-11-06/practice.json):** question: are day-trade entries at or after 15:30 ET (forced exit 15:55) worse? Trigger: ARDT bought 15:35 ET on 05/11 with target +7.2% and 20 minutes left.
  - LATE (>=15:30 ET): n=9, mean -0.90%/trade (95% bootstrap CI -1.85 to -0.08), WR 11%, 8 of 9 exited at the close, -$16.10.
  - EARLY: n=398, mean -0.16%/trade (CI -0.37 to +0.06), WR 41%, PF 0.77.
  - **Verdict: FAIL on sample size (needs n>=30), not a dead end.** Direction supports the idea. Re-run when LATE reaches 30 trades: `python3 atlas/elate.py <backup>/practice.json` (standard library only). No live change.
  - By entry hour, only 09:xx ET had PF > 1 (1.19, n=86). Post-hoc, 8 hours looked at: hypothesis only, do not act on it.
- Count E-LATE as 1 trial if it is ever added to `TRIAL_LEDGER`.
