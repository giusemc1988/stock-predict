# Playbook: write or receive a prompt for Muse / Hermes

Lesson behind this: prompts handed over without being checked sent agents the wrong way (see `lessons/2026-11-12-check-prompt-before-handing-to-muse.md`).

Writing a prompt (Claude, or Chanh through the voice box):
1. State the goal in one sentence, then the exact files, machine and branch.
2. Say what "done" means and name the checks to run (`playbooks/self-check.md`).
3. Say what NOT to do (no merge for Hermes, no delete, no secrets, no live trading changes).
4. Say where to read first: `docs/library/INDEX.md` and `AGENTS.md`.
5. Re-read it once as if you knew nothing. Check that every path, ID and command in it exists. Never paste a guessed ID: look it up.

Receiving a prompt (Muse, Hermes):
1. Before starting, check every file, ID, path and command the prompt names. If one is missing or does not match, STOP and write to `inbox/` instead of improvising.
2. If the prompt conflicts with `rules.md` or `AGENTS.md`, the rules win. Say so in the inbox.
3. Report back in the LOG with evidence, not just "done".
