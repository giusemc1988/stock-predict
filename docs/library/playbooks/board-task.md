# Playbook: a task from the Max board (TASK-board-<id>.md)

The board is how Chanh gives work when Claude is out of limit. He can only see what you write in these files, so write them.

0. A board task is already Chanh's order to act (his "Do this prompt"). Start working. Never answer it with another prompt for him to paste, and never wait for him to type a go word. A real question goes in a `NEED:` line.
1. Read the TASK file. Then read `docs/handoff/LESSONS.md` (branch `handoff-log`) and the one playbook here that fits the job.
2. Write `PROGRESS-board-<id>.md` in milo-shared **before you touch anything**: one line, what you are doing now. The board then shows "picked up". No file = Chanh sees "nobody picked it up".
3. At each new step add a line to that file (the board shows the last line). Keep lines short and plain: `reading content.js`, `testing in Chrome`, `building zip 2.91`.
4. Blocked, or a choice is Chanh's to make: add a line starting `NEED:` with ONE question he can answer in a few words. The board shows it in red. Do not guess, do not keep going past it.
5. When done write `RESULT-board-<id>.md`: first line `DONE` or `FAILED`, then what changed, the version, and the exact checks you ran with their real output. If it failed, say what you saw and what you tried.
6. Learned something the next worker should know: add ONE line starting `LESSON:` (cause and what to do, under 400 characters). It is saved in `LESSONS.md` by itself. A longer write-up goes in `lessons/`.

Never: mark DONE without a real check, merge or deploy, delete anything, put a secret or a shop picture in any of these files (the repo is public).
