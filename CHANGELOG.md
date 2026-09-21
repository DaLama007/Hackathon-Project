# Changelog

## Unreleased

- Refine PlateWise mark into a geometric dinner plate (concentric rim + well; Anthropic-precise, no cartoon food / no logo wobble).
- Polish PlateWise UI: cartoon farm backdrop + plate/sprout logo, liquid-glass panels, recipe cards, product thumbs, empty/loading states (EN/NL).
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
