# Hackathon Project — PlateWise diet planner

Full-stack demo built on the Vite + Express + SQLite starter.

- **Frontend:** Vite + React + TypeScript (`client/`)
- **Backend:** Express + TypeScript (`server/`)
- **Database:** SQLite via `better-sqlite3`
- **Package manager:** npm (workspaces monorepo)

## What it does

1. Set dietary prefs (vegetarian / vegan / halal)
2. Browse ~8 seeded Dutch recipes (filtered by prefs)
3. Match ingredients to Albert Heijn products (**mock products today** — live AH needs `ah-api-integration`)
4. Start from AH **bonus/offers** and jump into a recipe that uses that item
5. Filter match alternatives (bonus / bio / cheap / AH brand) or add a catalog item with no recipe
6. Review / swap products (bonus & cheap ranked first)
7. Add selections to an in-app shopping list
8. Share/copy the list to iPhone Reminders (paste into a Groceries list)

## Agent tasklist

Open work for any Cursor agent lives in **`TASKS.md`**. Agents pick one unclaimed task (see `AGENTS.md`). Humans can use `/pick-task`.

Current backlog:

| ID | Task |
| --- | --- |
| `frontend-ui` | Polish frontend UI |
| `ah-api-integration` | Live AH API: auth token, valid query params, real product fields |
| `camera-ai-scan` | Camera + AI scan of ingredients/products |

## Quick start

```bash
npm install        # installs all workspaces
npm run dev        # runs API (:3001) and web (:5173) together
```

Open http://localhost:5173. Vite proxies `/api/*` to Express on port 3001.

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

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness |
| GET/PUT | `/api/prefs` | Dietary prefs `{ vegetarian, vegan, halal }` |
| GET | `/api/recipes` | Seeded recipes (filtered by prefs) |
| GET | `/api/offers` | Bonus/offer products + seeded recipes that can use them |
| POST | `/api/recipes/:id/match` | Match ingredients → AH/mock products (`filter`: all/bonus/bio/cheap/storeBrand) |
| GET | `/api/shopping-list` | List items |
| POST | `/api/shopping-list/items` | Add `{ items: [...] }` (recipe optional) |
| DELETE | `/api/shopping-list/items/:id` | Remove one item |
| GET | `/api/products/suggest?q=` | Search a single term (`filter` same as match) |

## Demo checklist / Demochecklist

1. Toggle **Vegetarian / Vegetarisch** — meat recipes disappear / vleesrecepten verdwijnen
2. Open **Linzen dal** → Match — products appear (mock banner OK) / producten verschijnen
3. Filter **Bio** or **Goedkoop** on Match, then add to list / filter Bio of Goedkoop, voeg toe
4. **Aanbiedingen** → pick a bonus item → **Kook dit** → remaining ingredients match
5. List → search `spinazie` → **Voeg toe** (no recipe) / zoek en voeg los artikel toe
6. Swap a product / uncheck one → add to list / wissel of vink uit → voeg toe aan lijst
7. Confirm list shows bonus labels / controleer bonuslabels op de lijst
8. List → **Reminders / Herinneringen** — share sheet or copied text, one product per line / deel of kopieer, één product per regel
