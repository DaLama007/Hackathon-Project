# Hackathon Project — PlateWise diet planner

Full-stack demo built on the Vite + Express + SQLite starter.

- **Frontend:** Vite + React + TypeScript (`client/`)
- **Backend:** Express + TypeScript (`server/`)
- **Database:** SQLite via `better-sqlite3`
- **Package manager:** npm (workspaces monorepo)

## What it does

1. Set dietary prefs (vegetarian / vegan / halal)
2. Browse ~8 seeded Dutch recipes (filtered by prefs)
3. Match ingredients to Albert Heijn products (live search, **mock fallback** if AH is down)
4. Review / swap products (bonus & cheap ranked first)
5. Add selections to an in-app shopping list

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
| POST | `/api/recipes/:id/match` | Match ingredients → AH/mock products |
| GET | `/api/shopping-list` | List items |
| POST | `/api/shopping-list/items` | Add `{ items: [...] }` |
| DELETE | `/api/shopping-list/items/:id` | Remove one item |
| GET | `/api/products/suggest?q=` | Search a single term |

## Demo checklist / Demochecklist

1. Toggle **Vegetarian / Vegetarisch** — meat recipes disappear / vleesrecepten verdwijnen
2. Open **Linzen dal** → Match — products appear (mock banner OK) / producten verschijnen
3. Swap a product / uncheck one → add to list / wissel of vink uit → voeg toe aan lijst
4. Confirm list shows bonus labels / controleer bonuslabels op de lijst
