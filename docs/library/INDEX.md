# Team library: read this first (one page)

For Claude, Muse (Milo), Hermes Windows and Hermes Ubuntu. Goal: anyone can do a job the way Claude would, without Chanh repeating himself. Repo is public: no secrets, ever.

## Before a job (2 minutes, almost no tokens)
1. Read `rules.md` (Chanh's rules, short).
2. Open the ONE playbook below that matches the job. If none matches, use `playbooks/any-job.md`.
3. Skim the filenames in `lessons/`; open any whose title matches your job or the thing you touch.
4. Do the job. Run `playbooks/self-check.md` before you say "done".

## After a job
- Something went wrong, or you debugged something non-obvious: add `lessons/YYYY-MM-DD-short-name.md` (template in `lessons/README.md`). Put it in your task PR; if there is no PR, push it to branch `handoff-log`.
- You are unsure, blocked, or have feedback on a playbook: add a file in `inbox/` (see `inbox/README.md`). Claude reads the inbox first when back.

## Playbooks
| Job | File |
|---|---|
| Any job (default order of work) | `playbooks/any-job.md` |
| Self-check before saying done | `playbooks/self-check.md` |
| Change code in stock-predict (branch, test, version, PR, merge) | `playbooks/code-change.md` |
| Fix a bug (find the cause before editing) | `playbooks/fix-a-bug.md` |
| Find the fault the way Claude does (worked cases) | `playbooks/find-the-fault.md` |
| A task from the Max board (PROGRESS, NEED, RESULT, LESSON files) | `playbooks/board-task.md` |
| Write or receive a prompt for Muse / Hermes | `playbooks/prompt-handoff.md` |
| Build and release BayReady | `playbooks/bayready-release.md` |
| Which model combo to use (free vs `review-hard`) | `playbooks/model-routing.md` |

## Lessons (problem, cause, fix)
In `lessons/`, one file each, date in the filename. Seeded 2026-11-12.

Short lessons write themselves and every board task must end with one (`LESSON: none` if nothing new): a line starting `LESSON:` in a board task's RESULT file is added to `docs/handoff/LESSONS.md` on branch `handoff-log` (no AI). Read that file before a job on the same project. When Claude gives or checks a task, Claude adds the lesson the same way, so each task teaches the next one.

## Team name
**Max Team** = Claude + Muse (Milo) + Hermes Windows + Hermes Ubuntu, working with Chanh. Claude plans, checks and writes hard code; Milo does machine work on both PCs; Hermes only runs fixed scripts; Chanh decides and presses Update/Reload. Some days Chanh has only one machine (for example only the Ubuntu shop PC): every step for him must work from that machine or his phone. A change is done only when it is on BOTH machines and he just has to Reload (see `lessons/2026-11-12-bayready-update-path-two-machines.md`).

## Owners
Claude is team lead: writes and reviews playbooks, answers the inbox. Others propose changes through the inbox, not by editing a playbook directly.
