# Muse's Windows BayReady helper used the wrong extension ID
- **Date / who:** 2026-11-12, claude (from the coordinator's notes)
- **Problem:** the BayReady helper that Muse made on Windows pointed at the wrong browser extension ID.
- **Cause:** the ID was not read from the real installed extension. Which ID was used and where it came from: unconfirmed.
- **Fix:** take the ID from the installed extension (extension page or its manifest) on that same machine. Never copy it from memory or another machine.
- **Check:** open the extension page on the machine and compare the ID character by character.
