# Lessons from finished board tasks

Written by itself when a RESULT has a line starting `LESSON:`. Read before a job on the same project. Longer write-ups live in docs/library/lessons/ on main.

| date | task | project | who | lesson |
|---|---|---|---|---|
| 2026-11-13 | T9 | neohub | hermes-win | A board TASK file can arrive cut off mid-sentence (T9 lost error 2 + all requirements at creation); check the TASK text is complete against team.json before starting, and stop on NEED instead of guessing the missing half. |
| 2026-11-13 | T10 | other | hermes-win | Milo must not write PROGRESS-board-T10.md himself - that would fake Claude's flow test. Only Claude writes the PROGRESS file. |
| 2026-11-13 | T9 | neohub | hermes-win | A probe 2s after a click can report "no movement" while the page is still transitioning — the Next click worked (photo proves it) but the bot gave up too early. Wait 5s after a navigation click and re-probe before declaring failure. A JS click (b.click) and a real mouse click (debugger click at coordinates) are not the same: the Next button ignores the JS click but advances on the real click. When |
| 2026-11-13 | T11 | neohub | hermes-win | Anh tren board chi nam tren may anh, khong tu den Milo — task login khong co anh thi khong chan doan duoc, phai hoi anh dan anh truoc khi sua. |
| 2026-11-14 | T18 | bayready | hermes-win | A "did not start" safety timer must check only whether anything was logged, never whether the panel already looks busy — a background read sets running=true, so a timer gated on !running never fires and the tap stays silent. |
| 2026-11-14 | T19 | bayready | hermes-win | A test that cannot even load the code it tests is worse than no test — it silently lets every change go in untested. When a repo is flattened, fix the test's path in the same change, or the only test stays broken. |
| 2026-11-14 | T21 | bayready | hermes-win | A "did not start" safety timer must check only whether anything was logged, never whether the panel already looks busy — a background read sets running=true, so a timer gated on !running never fires and the tap stays silent. |
