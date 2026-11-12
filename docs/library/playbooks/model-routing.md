# Playbook: which model combo to use (OmniRoute)

Both machines (Windows, Ubuntu) have the same OmniRoute combos, checked 2026-11-12. Costs nothing unless a paid key is added later; Chanh enters keys himself, never put one in the repo or chat.

| Job | Combo | Why |
|---|---|---|
| Everyday code, small fixes, building apps | `coder-best-free` (or `code-free`) | Free. `laguna-xs-2.1` (99.5% success, about 5 s) and `nemotron-3.5-super` (97%) do most of the work. |
| Hard step: review before merge, a PR touching the Worker, Atlas or `.github/`, or the same step failed twice with the free combo | `review-hard` | Opus 5.5 through Antigravity first (free, about 87% success), then `gpt-6-luna`, then `nemotron-3-ultra`. |

Rules:
1. Start with the free combo. Move to `review-hard` only for the cases in the table. Do not use it for routine edits.
2. Errors you will see: 429 (rate limit, wait or fall to the next model), 404 (model gone), 413 (prompt too long: send less context, not a retry loop).
3. Do not add a model to a combo or reorder one without Chanh's OK. Back up `storage.sqlite` first (copy to `storage.sqlite.bak-<date>`) and keep both machines in the same order.
4. If a model keeps failing, write it to `inbox/` with the error code and count; do not silently change the order.
