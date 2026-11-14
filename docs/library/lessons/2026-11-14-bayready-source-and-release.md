# BayReady: find the newest version first, source is the repo, release carefully
- **Date / who:** 2026-11-14, claude
- **Problem:** `milo-shared\stage74\src` was v2.80 while the live build was 3.21 and Milo was on 3.22. BayReady 3.21 then opened dozens of Xtime tabs and Settings/TIS stopped working; it was rolled back to 3.21.1 (the 3.19 code), later 3.21.2 (3.19 code + hidden-page limit).
- **Cause:** more than one place held "the source" and two workers used the same version numbers (3.21, 3.22). Nobody compared versions before syncing or building.
- **Fix / rules:**
  1. Before any BayReady work compare the version in: repo `giusemc1988/bayready` main, `stage74\src`, the newest `bayready-v*.zip`, the installed Desktop copy. Highest confirmed-stable wins; the repo must be brought up to it first (an import PR, gate green).
  2. The repo `giusemc1988/bayready` is the source of truth. It holds **3.21.2** (confirmed stable by Chanh). `stage74\src` is only a working copy.
  3. Never build or release a number another thread is using. 3.21.x belongs to the redesign thread; do not release anything on top of the broken 3.21.
  4. After an auto-update, tabs that were already open (Scheduling, TIS, Inspect) keep the OLD code: press F5 on them, then Reload the extension.
  5. Device rule: CN88 (Windows) is the always-on machine. A cloud thread bound to the Ubuntu Surface cannot see CN88; use a Remote Control session on the CN88 folder, never assume "not connected" means CN88 is off. Anything Chanh must click has to work from the machine he is at.
  6. Release only when Chanh says "phát hành X". A merge never updates a machine.
  7. After an auto-update, tabs that were already open keep the old content script and every call to them fails with "message channel closed". Recover by reloading the agent / Scheduling tabs once. Never reload a tab the user may be typing in.
  8. Mock tests never caught the blank Chat or the dozens of hidden Inspect tabs on the real shop pages. After a release, look at the real page and watch the tab count.
  9. Release small: one change per version, so a rollback is cheap.
  10. The updater installs only a HIGHER version (tuple compare). A rollback is the old code under a higher number (3.19 code released as 3.21.1, then 3.21.2). `bayready-check-latest.py` FAILs on purpose in that case: that is expected, not a bug.
  11. Never run unbounded hidden-tab opens. Caps now: 6 per 2 minutes, 8 hidden pages in total.
  12. 3.21.3 (live, repo = 3.21.3): the quick-bar needs a solid background (no see-through over the page); chips wrap instead of being cut; a call that gets no answer shows a message after 5 s instead of failing silently; on "message channel closed" the stale tab is reloaded ONCE automatically, and never a Reservation/RO tab the user may be typing in.
- **Check:** `node scripts/bayready-gate.mjs <folder>` prints `GATE: green`, and `manifest.json` version matches what Chanh confirmed.
