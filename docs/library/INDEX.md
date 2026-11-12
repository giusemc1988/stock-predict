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
| Write or receive a prompt for Muse / Hermes | `playbooks/prompt-handoff.md` |
| Build and release BayReady | `playbooks/bayready-release.md` |

## Lessons (problem, cause, fix)
In `lessons/`, one file each, date in the filename. Seeded 2026-11-12.

## Owners
Claude is team lead: writes and reviews playbooks, answers the inbox. Others propose changes through the inbox, not by editing a playbook directly.
