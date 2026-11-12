# Playbook: fix a bug (no repeat debugging)

1. Search `lessons/` for the symptom words first. If a lesson matches, apply its fix and stop.
2. Reproduce it. Write down the exact error text or wrong output.
3. Find the root cause by reading code, not guessing. One hypothesis at a time: change one thing, test, repeat. After 3 failed tries, stop and write to `inbox/` with what you saw and tried.
4. Fix the cause, not the symptom. Add or extend a test that fails before and passes after.
5. Run `playbooks/self-check.md`.
6. Add a lesson (problem, cause, fix) so nobody debugs it again.
