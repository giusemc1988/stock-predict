# Playbook: build and release BayReady

BayReady source lives in the private repo `giusemc1988/bayready` (not this public repo). Zips go to `C:\Users\chanh\milo-shared` and Desktop `BayReady-backups`.

1. Build from the CURRENT source in the private repo `main`. Check the version string and `git log -1` before packaging; never build from an old copy. (Past failure: `lessons/2026-11-12-release-script-stale-source.md`.)
2. Check the browser extension ID used by the helper against the real installed extension (extension page or manifest), never from memory or another machine. (Past failure: `lessons/2026-11-12-bayready-wrong-extension-id.md`.)
3. Bump the BayReady version, run its tests, and read the output.
4. Package the zip and keep a backup of the previous zip. Tell Chanh where the zip is and that he installs it through the updater. Say which machines still run the old version (Ubuntu does not update itself).
5. Do not push to the private repo `main` without Chanh's OK for that release.
6. LOG `DONE` with version, commit and zip path.
