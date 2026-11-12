# Release script pointed at stale source
- **Date / who:** 2026-11-12, claude (from the coordinator's notes)
- **Problem:** a release script packaged an old copy of the source instead of the current one.
- **Cause:** the script's source path was not updated when the source moved (BayReady source is now the private repo `giusemc1988/bayready`). Exact script: unconfirmed.
- **Fix:** before packaging, check the version string and `git log -1` of the folder the script reads. See `playbooks/bayready-release.md`.
- **Check:** the version inside the finished zip equals the version just bumped.
