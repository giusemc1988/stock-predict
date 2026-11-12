# Never delete without Chanh's approval on the board
- **Date / who:** 2026-11-12, claude (from the coordinator's notes)
- **Problem:** deleting files, branches or tasks on an agent's own judgment is hard to undo.
- **Cause:** "it looks merged or unused" was treated as permission.
- **Fix:** put the exact list on the board (task in `team.json`), wait for Chanh's OK, then delete only that list and report what was skipped. Example: T2 (19 merged branches) was approved first, then Milo deleted exactly those.
- **Check:** an OK line from Chanh exists in `docs/handoff/LOG.md` for this exact list.
