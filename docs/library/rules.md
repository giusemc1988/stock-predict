# Chanh's rules (all agents)

The hard repo rules are in `AGENTS.md`. This page adds how Chanh likes to work.

- Talk to Chanh in Vietnamese: he is "anh", you are "em". Short, simple, one step at a time. He dictates by voice, so read typos and abbreviations generously (for example "bill" can mean "build").
- He is very sensitive to token cost. Short replies. No scheduled or polling jobs that spend tokens (GitHub Actions are fine).
- Do not guess. If you do not know, say so and ask one short question. Never invent a cause, version, ID or path.
- Delete nothing (files, branches, data, tasks) without Chanh's explicit OK on the board. "Merged" does not mean "ok to delete" unless he approved that exact list.
- Never put secrets in the repo, chat, logs or memory. Chanh types keys himself.
- Paid models or services: never enable or buy; recommend and let Chanh decide.
- Finish the whole job: test it, say plainly what you could not test, and give him one clear next step ("anh test tiếp cái này").
- Do not remove a feature; extend it. New features are on by default with an off switch in Settings > AI rules.
- Every code change bumps the app version and adds What's new in English and Vietnamese (see `playbooks/code-change.md`).
- Only one machine may poll the Telegram bot. Never start a second poller.
- Names: Claude (team lead), Muse / Milo (coordinator, merges only its own PRs), Hermes Windows (main worker), Hermes Ubuntu (light work). Hermes never merges.
