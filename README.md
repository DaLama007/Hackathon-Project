# Hackathon Project — PlateWise diet planner

Full-stack demo built on the Vite + Express + SQLite starter.

- **Frontend:** Vite + React + TypeScript (`client/`)
- **Backend:** Express + TypeScript (`server/`)
- **Database:** SQLite via `better-sqlite3`
- **Package manager:** npm (workspaces monorepo)

## What it does

1. Log in or sign up — prefs and the shopping list are saved per account and reloaded next login
2. Set dietary prefs (vegetarian / vegan / halal)
3. Browse ~8 seeded Dutch recipes (filtered by prefs)
4. Match ingredients to Albert Heijn products (**mock products today** — live AH needs `ah-api-integration`)
5. Start from AH **bonus/offers** and jump into a recipe that uses that item
6. Filter match alternatives (bonus / bio / cheap / AH brand) or add a catalog item with no recipe
7. Review / swap products (bonus & cheap ranked first)
8. Add selections to an in-app shopping list
9. Share/copy the list to iPhone Reminders (paste into a Groceries list)

## Agent tasklist

Open work for any Cursor agent lives in **`TASKS.md`**. Agents pick one unclaimed task (see `AGENTS.md`). Humans can use `/pick-task`.

Current backlog:

| ID | Task |
| --- | --- |
| `frontend-ui` | Polish frontend UI |
| `ah-api-integration` | Live AH API: auth token, valid query params, real product fields |
| `camera-ai-scan` | Camera + AI scan of ingredients/products |

Accounts are handled by `auth-save-load` (done) — see `TASKS.md` for its smoke checklist.

## Quick start

```bash
npm install        # installs all workspaces
npm run dev        # runs API (:3001) and web (:5173) together
```

Open http://localhost:5173. Vite proxies `/api/*` to Express on port 3001.

Copy `.env.example` to `server/.env` before the first run — `SESSION_SECRET` signs the session cookie, and the optional `DEMO_USERNAME` / `DEMO_PASSWORD` pre-seed an account so demo day does not start on a signup form. Any prefs and shopping-list rows from before accounts existed are handed to that demo account on first boot (the old tables are kept as `prefs_legacy` / `shopping_list_legacy`).

Force mock products (skip live AH):

```bash
AH_FORCE_MOCK=1 npm run dev:server
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run API + web concurrently |
| `npm run smoke` | End-to-end API smoke test (API must be running) |

## API

Everything except `/api/health` and `/api/auth/*` requires a session cookie and answers `401` without one.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness |
| POST | `/api/auth/register` | Create an account `{ username, password }` and start a session |
| POST | `/api/auth/login` | Start a session `{ username, password }` |
| POST | `/api/auth/logout` | End the current session |
| GET | `/api/auth/me` | Current account, or `401` |
| GET/PUT | `/api/prefs` | Dietary prefs `{ vegetarian, vegan, halal }` (per account) |
| GET | `/api/recipes` | Seeded recipes (filtered by prefs) |
| GET | `/api/offers` | Bonus/offer products + seeded recipes that can use them |
| POST | `/api/recipes/:id/match` | Match ingredients → AH/mock products (`filter`: all/bonus/bio/cheap/storeBrand) |
| GET | `/api/shopping-list` | List items (per account) |
| POST | `/api/shopping-list/items` | Add `{ items: [...] }` (recipe optional) |
| DELETE | `/api/shopping-list/items/:id` | Remove one item |
| GET | `/api/products/suggest?q=` | Search a single term (`filter` same as match) |

## Demo checklist / Demochecklist

1. **Sign up / Registreer** — the planner only appears once you are signed in / de planner verschijnt pas na inloggen
2. Toggle **Vegetarian / Vegetarisch** — meat recipes disappear / vleesrecepten verdwijnen
3. Open **Linzen dal** → Match — products appear (mock banner OK) / producten verschijnen
4. Filter **Bio** or **Goedkoop** on Match, then add to list / filter Bio of Goedkoop, voeg toe
5. **Aanbiedingen** → pick a bonus item → **Kook dit** → remaining ingredients match
6. List → search `spinazie` → **Voeg toe** (no recipe) / zoek en voeg los artikel toe
7. Swap a product / uncheck one → add to list / wissel of vink uit → voeg toe aan lijst
8. Confirm list shows bonus labels / controleer bonuslabels op de lijst
9. List → **Reminders / Herinneringen** — share sheet or copied text, one product per line / deel of kopieer, één product per regel
10. **Log out / Uitloggen**, log back in — prefs and the list are exactly as you left them / voorkeuren en lijst staan er weer
11. Sign up a second account — clean prefs and an empty list / tweede account start leeg
