# Playbook: find the fault the way Claude does (worked cases)

Use with `fix-a-bug.md`. The rule behind every case: **look at the real thing, then decide.** A guess that sounds right costs more than a 2-minute check.

## The order of work
1. Write the symptom in the user's words and where it happens (which machine, which version).
2. Ask "what changed last?" and "does it fail everywhere or in one place?". One place = look at what is different there.
3. Find the smallest check that splits the problem in two (works by hand? works on the other machine? works with the newest file?).
4. Reproduce it with a tool before editing: a test, a browser script, a command. If you cannot reproduce it, you have not found it.
5. Fix the cause. Run the same check again and paste its real output.
6. Say what you did not test.

## Cases from 2026-11-12
| Symptom | First guess (wrong) | Real cause, how it was found | Fix |
|---|---|---|---|
| A settings switch could not be clicked | The panel fade covered it | A browser test clicked it and showed the click landing on the small (i) button: a `<button>` inside a `<label>` takes the label's click | Use `<span role="button">` inside a label |
| Ubuntu stayed on an old BayReady while Windows updated | The update timer was not created | Ran the helper by hand on Ubuntu: permission denied. Unzipping by hand had removed the run permission from the helper script | Never unzip a release by hand; run the helper or `chmod +x` |
| Emoji showed as `ðŸ›¢` | A font problem | The same bytes read as cp1252 instead of UTF-8 gave exactly that text | Repair saved text once per version (`moji.js`); save files as UTF-8 |
| Board task sat at "handed" forever | The bridge was broken | The log on the machine said `NO Milo CLI`: the file was written, nothing woke Milo | Board builds a prompt to paste; Milo writes a PROGRESS file |
| Online release stayed on an old version | The auto-push was broken | The push lives inside `release-bayready.sh`; builds that skipped the script never pushed | A plain watcher compares versions every 5 min |
| A browser test saw no data | The page was broken | Two mock routes matched; the one registered last wins | Register the catch-all route first |

## Signs you are guessing
- You are about to change code and have not seen the error yourself.
- Your fix "should" work but you have no check to run after it.
- The second fix is for the same symptom. Stop: go back to step 3.
