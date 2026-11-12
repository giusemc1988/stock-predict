# Check a prompt before handing it to Muse
- **Date / who:** 2026-11-12, claude (from Chanh's feedback)
- **Problem:** a prompt given to Muse was not checked first, so Muse started from a wrong or unverified detail.
- **Cause:** nobody re-read the prompt against the real files, IDs and paths. Details of the exact prompt: unconfirmed.
- **Fix:** follow `playbooks/prompt-handoff.md`: verify every path, ID and command before sending, and have the receiver verify them again before starting.
- **Check:** each path, ID and command named in the prompt was looked up and exists.
