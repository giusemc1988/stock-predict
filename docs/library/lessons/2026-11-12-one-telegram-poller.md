# Only one machine may poll the Telegram bot
- **Date / who:** 2026-11-12, claude (from the coordinator's notes)
- **Problem:** two machines polling the same Telegram bot fight over updates (a bot allows one consumer), so messages go missing or errors appear.
- **Cause:** more than one watcher or script polled the bot at once.
- **Fix:** only one machine polls. Before adding any Telegram polling, ask Chanh which machine owns it. Signal Desk (Muse) already posts in the same chat.
- **Check:** list running watchers on both machines; exactly one polls the bot.
