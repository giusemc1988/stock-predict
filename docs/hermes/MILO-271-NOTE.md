# Atlas #271 — Milo's decision note (for Claude)

**Date:** 2026-11-10 (US Central), decision approved by Chanh 22:01 CST
**Author:** Milo (Muse) — Neo Hub manager since 2026-11-10
**Issue:** giusemc1988/stock-predict #271 — "Explain why recent Atlas trades lose and propose (not apply) a fix"
**Status:** APPROVED TO SHADOW-TEST. Nothing applied to live trading yet.

## Who Milo is (read this first, Claude)

- I am Milo, Chanh's Muse assistant. Since 2026-11-10 Chanh moved Neo Hub maintenance from Claude/Hermes to me.
- My job on Neo Hub only: (1) light system/UI edits, (2) watch/manage how Atlas works, (3) research trading problems/algorithms. I do NOT touch Vega or anything else.
- I manage both Hermes agents (Ubuntu work Surface, Windows home Surface) via TASK files + SSH. I verify their work before anything is called done.
- Chanh's rule for me: I may self-merge my own PRs only when test + build are green, no conflict, deploy verified — and I ask 1 question before my first merge.
- Paper trading only. Real money only after sustained paper profit + readiness checklist + Chanh's explicit order. Never wire anything to a broker without a new explicit order from Chanh in the main chat.

## What Chanh approved (his words, 2026-11-10 22:01 CST)

"Do what u think is the best" — in reply to my Atlas #271 report — "but make sure notes it down somewhere when claude looks into this, he will know u."

So: I choose the best option, I implement it as a SHADOW test first, and I leave this note where Claude will see it.

## My best pick: Proposal (1) + (2) together, shadow-first

From the read-only investigation (433 closed trades, Oct 19 – Nov 6, backup 2026-11-08; full report: `atlas-271-new-direction-report.md`):

- **(1) Raise the volume floor 1.0x → 1.5x.** `src/lib/practice.ts:391`, `MIN_VOL_MULT = 1` → `1.5`. Keep `SHADOW_MIN_VOL` in `shadowFilters.ts:16` in sync. Kept-group in-sample: WR 41.1% → 48.4%, PF 0.94 → 1.29. Cost: ~15 trades/day instead of ~33.
- **(2) Reject entries whose planned stop is under 2.0% away.** New entry check alongside the volume check in `practice.ts:455` area: skip BUY if `(entry − stop) / entry < 2%`. Alone in-sample: WR 47.1%, PF 1.23. Combined with (1): kept 88/433, **WR 52.3%, PF 2.19**, net +$229.76 (in-sample).
- **Why together, not (1) alone first:** shadow testing costs nothing and touches no live trade. Testing the combined filter first gives the fastest read on the best combination. If the combined shadow fails out-of-sample, split it and test (1) alone next. If it passes, we already have the best pair.
- **Why shadow-first, not live:** all thresholds (1.5x, 2.0%) were picked from the same 433 trades used to measure them. The quoted win rates are IN-SAMPLE and will shrink out of sample. Forward-test in shadow first. Do NOT flip the live gates until the shadow verdict is in and Chanh approves it.

## What NOT to do (verified negatives — do not re-propose)

- Do NOT raise grade / score / tradeScore thresholds. They show NO separation (Grade A 38.8% / B 42.1% / C 40.0% WR). The scoring system does not rank winners.
- Do NOT "fix" the 12-bar time exit. Time-outs win 61.7% (+$123) — they are NOT a failure mode.
- Do NOT bring back proposal #1 from my first analysis ("pause on money"). Chanh corrected me 2026-11-10 21:37: paper trading → money does NOT matter; live data, information, speed, and high success-rate signals matter. A hard pause FREEZES learning, and learning is what improves win rate.
- Do NOT touch Proposal (3) (no entries 10:00–10:59 / 12:00–12:59 ET) yet. Weakest causal story, most optional. Shadow-test it separately later if (1)+(2) passes.
- Do NOT change the pause enforcement to fix the "active vs paused" label yet. That is display/information cleanup, lowest priority, and needs its own approval.

## Facts the decision rests on (so Claude can check, not trust)

- Pause barely does anything: enforced only at `src/worker/practiceCycle.ts:311-312` → learner signal `'n/a'` in `practiceScan.ts:57,194`. No entry gate reads it. Trading, shadow trials, and the idea factory all keep running while "paused". The endpoints use all-trades WR while enforcement uses last-20 WR — that is the "active vs paused" contradiction.
- Volume at entry is the strongest separator: vol <0.8x wins 31% (TP 2.8%); vol ≥1.5x wins ~48–50% (TP 15–24%).
- Stops are 144/433 exits (33%, all losses, −$735); targets 45/433 (100% wins, +$434).
- LESSONS.md updater is a Claude scheduled task ("Atlas Daily Health Check", cron `0 21 * * 1-5`, defined in `atlas/HANDOFF.md` §4). It stopped after Nov 5. Fixing it needs Chanh's OK for an exception to the "no auto/scheduled AI runs" rule, or a 0-token GitHub Actions job instead. That decision is still open — it is NOT part of this shadow test.

## What happens next (for Claude, if you pick this up)

1. Implement (1)+(2) as SHADOW filters only. Log what they would have blocked / kept per trade, with WR / PF of the kept group vs live. No live gate change.
2. Run `npx tsc -b`, `npm test`, `npm run build` before any PR. Bump `package.json` + `releases.ts` (EN+VI) + `agentVersions.ts` per issue #271's rule, only if a versioned change ships.
3. Report the shadow verdict to Chanh in short Vietnamese. Live flip needs Chanh's explicit OK after that.
4. If you touch this issue, do not close #271 until Chanh says the shadow verdict is in.

## Sources

- Full investigation: `~/workspace/atlas-271-new-direction-report.md` (Milo, 2026-11-10) — also at https://muse.ai/files/1336869626176427/894580357014806/kwrs4xhj187gpzifgm6arfzm/atlas-271-new-direction-report.md (expires 2026-11-13)
- First analysis: `~/workspace/atlas-271-analysis-2026-11-10.md`
- Data: `~/workspace/atlas-practice-20261108.json` (433 trades, to Nov 6)
- Repo HEAD checked: `9d6ebfa` (2026-11-11 01:30 UTC), public `giusemc1988/stock-predict`

— Milo, 2026-11-10