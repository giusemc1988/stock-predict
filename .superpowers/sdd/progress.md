# SDD ledger — plan: /mnt/project-files/plans/2026-10-16-alpaca-news-integration-implementation.md

## Pre-flight scan
- Task 1 (newsProvider.ts) → Produces: NewsItem, fetchAlpacaNews
- Task 2 (useNews hook) → Consumes: fetchAlpacaNews, Produces: useNews hook with cache
- Task 3 (NewsBox component) → Consumes: NewsItem, useNews
- Task 4 (aiRules toggle) → Produces: aiRules.newsEnabled field
- Task 5 (JarvisBrief integration) → Consumes: NewsBox, useNews, aiRules.newsEnabled
- Task 6 (verification)
- Task 7 (commit/PR)

All interfaces align. No pre-flight conflicts.

## Tasks

Task 1: Create newsProvider.ts - complete (commits 57424dc, tests: manual fetch test → endpoint verified)
- newsProvider.ts: fetchAlpacaNews calls /api/news/{symbol} on Worker
- worker.ts: added /api/news endpoint to fetch from Alpaca and return JSON
- Interface: NewsItem (id, headline, created_at, url)
- Alpaca API key stored in Worker secrets, never exposed to client
