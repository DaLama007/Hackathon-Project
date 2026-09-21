# Changelog

## Unreleased

- Add accounts: username/password login (bcrypt + httpOnly session cookie). Prefs and the shopping list are saved per account and reloaded on the next login. / Inloggen met account: voorkeuren en boodschappenlijst worden per account bewaard en staan er bij de volgende login weer.
- Translate recipe titles, summaries, ingredient names, and units to English when UI lang is EN; shopping list keeps original Dutch AH product titles.
- Add `ah-api-integration` backlog task: live AH needs an anonymous bearer token; documented that today's request params return 401/400 so the app always falls back to mock.
- Add bidirectional AH offers ↔ recipes, plus bonus/bio/cheap/huismerk product filters and add-item search.
- Add List-tab Share/Copy to iPhone Reminders (newline grocery text, clipboard fallback).
- Add shared agent tasklist (`TASKS.md`) so any agent can pick/claim: frontend UI, camera AI scan, AH offers ↔ recipes with item filters.
- Add EN/NL language switch (persisted); UI shows one language at a time.
- UI copy bilingual EN/NL (e.g. Recipes / Recepten); .cursorrules language rule for agents.
- Replace Notes demo with PlateWise diet planner (prefs, recipes, AH match, shopping list).
- Seed 8 Dutch recipes with dietTags + searchTerms; filter list by user prefs.
- Add Albert Heijn product search with ranking (bonus/price) and mock fallback.
- Add match review UI and in-app shopping list with merge-by-product-id.
- Retarget smoke test to prefs / recipes / match / shopping-list endpoints.

## Earlier

- Scaffold full-stack starter: Vite + React (TS) client, Express (TS) API, SQLite storage.
- Add Notes demo feature: create, list, and delete notes persisted in SQLite.
- Add npm workspaces monorepo with `dev`, `build`, and `smoke` scripts.
- Add Cloud Agent environment config (`.cursor/environment.json`) running API + web terminals.
