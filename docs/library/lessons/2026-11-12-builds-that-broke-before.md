# Builds that broke before (and what to run)
- **Date / who:** 2026-11-12, claude (collected from AGENTS.md history)
- **Problem:** builds and deploys broke repeatedly: conflict markers committed to main (3 times), out-of-sync `package-lock.json` (22/10), a wrong field name that only failed in the Worker build (30/10), wrong wrangler 4 command syntax (01/11).
- **Cause:** tests passed but the real build was not run, or a check was skipped.
- **Fix:** before "done" run the conflict-marker grep, `npm test`, `npm run build`, and `npm ci` after dependency changes (all in `playbooks/self-check.md`). After merge, check the Deploy Worker run.
- **Check:** `npm run build` output ends without errors and the latest Deploy Worker run is green.
