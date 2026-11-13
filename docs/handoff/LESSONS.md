# Lessons from finished board tasks

Written by itself when a RESULT has a line starting `LESSON:`. Read before a job on the same project. Longer write-ups live in docs/library/lessons/ on main.

| date | task | project | who | lesson |
|---|---|---|---|---|
| 2026-11-13 | T9 | neohub | hermes-win | A board TASK file can arrive cut off mid-sentence (T9 lost error 2 + all requirements at creation); check the TASK text is complete against team.json before starting, and stop on NEED instead of guessing the missing half. |
| 2026-11-13 | T10 | other | hermes-win | Milo must not write PROGRESS-board-T10.md himself - that would fake Claude's flow test. Only Claude writes the PROGRESS file. |
| 2026-11-13 | T9 | neohub | hermes-win | A probe 2s after a click can report "no movement" while the page is still transitioning — the Next click worked (photo proves it) but the bot gave up too early. Wait 5s after a navigation click and re-probe before declaring failure. A JS click (b.click) and a real mouse click (debugger click at coordinates) are not the same: the Next button ignores the JS click but advances on the real click. When |
