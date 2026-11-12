# Version bump rules
- **Date / who:** 2026-11-12, claude (from AGENTS.md and the handoff README)
- **Problem:** parallel branches that each bump the version conflict, or bump to the wrong number.
- **Cause:** the bump was done early and not rebased on the latest `main`.
- **Fix:** bump once, right before merge, after rebasing on the latest `main`. Change `package.json`, `APP_VERSION` and the top `RELEASES` entry (English and Vietnamese). Hermes does not bump. Agent-owned changes also bump `src/data/agentVersions.ts`.
- **Check:** `npm run t -- versions` passes.
