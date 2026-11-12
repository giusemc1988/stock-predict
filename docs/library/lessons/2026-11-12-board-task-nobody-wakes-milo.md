# A board task can be handed over and still be picked up by nobody
- **Date / who:** 2026-11-12, claude
- **Problem:** tasks on the Max board showed "handed to Milo" and then nothing. Chanh could not tell if anyone had them.
- **Cause:** the bridge only writes a file. No script can start Milo (`milo-pickup.log`: `NO Milo CLI on this machine`), and a bridge on a machine Milo does not watch (Ubuntu) also wrote TASK files.
- **Fix:** board 2.0.35 builds the full prompt for Chanh to paste; 2.0.36 shows "nobody picked it up" until Milo writes `PROGRESS-board-<id>.md`. Run `--milo-dir` only on the machine Milo watches.
- **Check:** the task on the board shows "Picked up: Milo" with a time within minutes of pasting the prompt.
