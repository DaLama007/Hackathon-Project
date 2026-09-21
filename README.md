# Hackathon Project

A minimal, demoable full-stack starter.

- **Frontend:** Vite + React + TypeScript (`client/`)
- **Backend:** Express + TypeScript (`server/`)
- **Database:** SQLite via `better-sqlite3`
- **Package manager:** npm (workspaces monorepo)

The demo app is a tiny "Notes" board: create, list, and delete notes. Notes are
persisted in SQLite, served by the Express API, and rendered by the React UI.

## Quick start

```bash
npm install        # installs all workspaces
npm run dev        # runs API (:3001) and web (:5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the
Express server on port 3001.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run API + web concurrently |
| `npm run dev:server` | Run only the Express API (:3001) |
| `npm run dev:client` | Run only the Vite dev server (:5173) |
| `npm run build` | Type-check + build server and client |
| `npm run smoke` | End-to-end API smoke test (API must be running) |

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| GET | `/api/notes` | List notes (newest first) |
| POST | `/api/notes` | Create a note `{ "text": "..." }` |
| DELETE | `/api/notes/:id` | Delete a note |

## Configuration

Copy `.env.example` to `.env` to override defaults:

- `PORT` — API port (default `3001`)
- `DATABASE_PATH` — SQLite file path (default `./data/app.sqlite`)

## Smoke test

With the app running (`npm run dev`), in another terminal:

```bash
npm run smoke
```

This creates, lists, and deletes a note through the API to confirm the
frontend → API → SQLite path works end to end.
