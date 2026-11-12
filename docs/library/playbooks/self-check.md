# Playbook: self-check before saying "done"

Answer every line with evidence (command output, a link), not "should be fine". If a line fails, fix it first. Goal: your result matches what Claude would hand over.

1. I read the file I changed, just now, not from memory.
2. `git grep -nE '^(<{7}|={7}|>{7})( |$)'` prints nothing (no conflict markers).
3. `npm test` passes. Paste the pass count.
4. `npm run build` passes. The Worker build can fail while tests pass, so run both. A broken build is the most repeated mistake.
5. After any dependency change, `npm ci` once (lockfile in sync).
6. Version bump done as in `code-change.md`; `npm run t -- versions` passes.
7. No secret, key or KV value in the diff, logs or artifacts. The repo is public.
8. I removed no feature and deleted nothing without Chanh's OK.
9. What I did is what was asked, done the way the playbook says. Would Claude have done it the same way? If not, say why.
10. A job that "succeeds" can still be empty or wrong: open the output (the file, the page, the screenshot) and look at it.
11. I wrote plainly what I could not test (real phone, real board, live site behind Cloudflare Access).
12. The LOG has my `DONE` line. A lesson exists if I hit anything non-obvious.
