# Playbook: a task from the Max board (TASK-board-<id>.md)

The board is how Chanh gives work when Claude is out of limit. He can only see what you write in these files, so write them.

0. A board task is already Chanh's order to act (his "Do this prompt"). Start working. Never answer it with another prompt for him to paste, and never wait for him to type a go word. A real question goes in a `NEED:` line.
1. Read the TASK file. Then read `docs/handoff/LESSONS.md` (branch `handoff-log`) and the one playbook here that fits the job.
2. Write `PROGRESS-board-<id>.md` in milo-shared **before you touch anything**: one line, what you are doing now. The board then shows "picked up". No file = Chanh sees "nobody picked it up".
3. At each new step add a line to that file (the board shows the last line). Keep lines short and plain: `reading content.js`, `testing in Chrome`, `building zip 2.91`.
4. Blocked, or a choice is Chanh's to make: add a line starting `NEED:` with ONE question he can answer in a few words. The board shows it in red. Do not guess, do not keep going past it.
5. When done write `RESULT-board-<id>.md`: first line `DONE` or `FAILED`, then what changed, the version, and the exact checks you ran with their real output. If it failed, say what you saw and what you tried.
6. End every RESULT with ONE last line `LESSON: ...` (the cause, or what to do next time, under 400 characters). If nothing new was learned write `LESSON: none`. It is saved in `LESSONS.md` by itself and shown on the Max board, so the whole team learns, also when Claude is out of limit. A longer write-up goes in `lessons/` with your PR.

Never: mark DONE without a real check, merge or deploy, delete anything, put a secret or a shop picture in any of these files (the repo is public).
