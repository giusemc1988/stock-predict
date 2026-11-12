# Two PRs bumped the same version
- **Date / who:** 2026-11-12, claude
- **Problem:** the team library PR and an Atlas PR both used v2.0.28, so `releases.ts` had two 2.0.28 entries on main. `npm run t -- versions` still passed, so nothing warned.
- **Cause:** both branches took "latest version + 1" before the other merged. The bump was not redone after rebasing on the latest `main`.
- **Fix:** do the bump as the very last step, after `git fetch` and a rebase on `origin/main`, and look at the top of `RELEASES` for your number before you merge. After merging, check `git show origin/main:src/data/releases.ts | grep "version:" | head` for duplicates.
- **Check:** each version appears once in `RELEASES`.
