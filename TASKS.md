# Tasks

<!-- policy: This is the shared hackathon backlog. Every agent (Cloud or local) picks from here unless the user named a specific task.
     policy: Claim before you write code: add `(@your-branch)` on the task line, commit + push that claim immediately, then implement.
     policy: One agent, one open task. If a task is already claimed, pick another or help only where files do not overlap.
     policy: When done: check the box, set **Status**: done, add a CHANGELOG bullet, unclaim. Do not delete the task block.
     policy: Happy path + demoable over architecture. EN+NL UI copy. Dutch AH search terms. No hardcoded secrets. -->

Open tasks are available to any agent. Claimed tasks show `(@branch-name)` on the title line.

## P0

- [ ] Polish frontend UI
  - **ID**: frontend-ui
  - **Status**: open
  - **Tags**: frontend, ui
  - **Files**: `client/src/App.tsx`, `client/src/index.css`
  - **Details**: Make the existing PlateWise demo look and feel demo-ready. Today the app is a single-page three-tab flow (recipes / match / list) with functional but sparse layout. Improve visual hierarchy, recipe cards, product images, match-review (swap/uncheck), shopping list, empty/error/loading states, and mobile + ~720px desktop. Keep EN/NL via the existing `copy.en` / `copy.nl` map (default NL, persist `platewise-lang`). Do not rebuild the stack or add an i18n library.
  - **Acceptance**: A teammate can run `npm run dev`, click through prefs → recipe → match → list, and the UI looks intentional on phone-width and desktop. New strings exist in both locales. Smoke checklist added (comment or SCRATCH.md).

- [ ] Live AH API integration (auth token, real query params, real product fields)
  - **ID**: ah-api-integration
  - **Status**: open
  - **Tags**: backend, ah, api
  - **Files**: `server/src/ah.ts`, `server/src/db.ts`, `.env.example`, `scripts/smoke-test.mjs`
  - **Details**: Today **every** live call fails and we silently serve mock products, so the README claim "live search, mock fallback if AH is down" is not true yet. Verified against `api.ah.nl` on 2026-09-21 (probe commands + raw output in `SCRATCH.md`): (1) `GET /mobile-services/product/search/v2` without an `Authorization` header returns **401** `{"error":"unauthorized","error_description":"Missing valid security token"}`. Get a token from `POST https://api.ah.nl/mobile-auth/v1/auth/token/anonymous` with body `{"clientId":"appie"}` (returns `access_token`, `refresh_token`, `expires_in`), then send `Authorization: Bearer <access_token>`; no account or secret is needed. Cache the token (the existing `search_cache` table or an in-memory value) and refresh via `POST /mobile-auth/v1/auth/token/refresh` with `{"clientId":"appie","refreshToken":"…"}` — do not fetch a token per search. (2) `sortOn=PRICE_ASC`, which `ah.ts` hardcodes, returns **400** `Failed to convert 'sortOn' with value: 'PRICE_ASC'`; `sortOn=PRICELOWHIGH` and `sortOn=RELEVANCE` both return 200. (3) The `filters[]=sp_include_dieet_*` values in `prefsFacetParams` return **400** and break the whole request — drop them. The real diet/property signal is `propertyIcons` on each product, e.g. `["biologisch"]`, `["vegan","biologisch"]`, `["goedkoopje","vega","biologisch"]`; use it for the existing bio / vega / vegan / cheap filters instead of matching `biologisch` in the title. (4) For bonus items `currentPrice` is the discounted price and `priceBeforeBonus` is the higher pre-bonus price, but `mapAhProduct` reads `priceBeforeBonus` first, so live bonus items rank on the wrong price. Also available and unused: `images[].url` (product thumbnails), `unitPriceDescription`, `brand`, `discountLabels`, `nutriscore`. Keep the mock fallback and `AH_FORCE_MOCK=1` working, keep the 4s timeout, and keep `scoreProduct` ranking bonus-first then cheaper. Put the base URL / client id in `.env.example` (no secrets — the anonymous token needs none). Backend-only: does not touch `client/src/App.tsx`, so it does not overlap `frontend-ui`.
  - **Acceptance**: With no `AH_FORCE_MOCK`, a search returns `source: "ah"` products and the mock banner stays hidden; server logs show no 401/400. `AH_FORCE_MOCK=1` still returns mock products. Bonus items show the discounted price. The bio filter matches on `propertyIcons`. Token is fetched once and reused across searches. Smoke test asserts a live (non-mock) search when AH is reachable, and still passes in mock mode. CHANGELOG bullet.

- [x] Bidirectional AH offers ↔ recipes, plus item filters (@cursor/offers-recipes-loop-c87b)
  - **ID**: offers-recipes-loop
  - **Status**: done
  - **Tags**: frontend, backend, ah, recipes
  - **Files**: `server/src/ah.ts`, `server/src/index.ts`, `server/src/recipes.ts`, `client/src/App.tsx`
  - **Details**: Support both directions, not only recipe → products. (1) **Offers → recipes**: start from current AH bonus/offers (mock fallback if AH is down) and suggest seeded recipes that can use those items. (2) **Recipes → offers**: keep matching ingredients to AH products, ranking bonus/cheap as today, but surface offer/bonus products more clearly. (3) **Just items**: let the user add catalog items that are not tied to a recipe. (4) **Selection filters** on products: cheap, bio/organic (`biologisch` in title or AH diet/property if present), bonus, and “whatever” other cheap filters that are already in the catalog (do not invent AH query params — check `server/src/ah.ts` first). Ranking today is bonus-first then cheaper (`scoreProduct` in `ah.ts`); extend that rather than replacing it.
  - **Acceptance**: Demo path A: open offers, pick a bonus item, see at least one matching recipe, match remaining ingredients. Demo path B: open a recipe, filter alternatives to bio or cheapest, add to list. Demo path C: add a non-recipe item to the list. Mock fallback still works with `AH_FORCE_MOCK=1`. EN/NL copy for new UI. CHANGELOG bullet.

## P1

- [x] Login with per-account save/load of prefs and shopping list (@cursor/login-save-load-3111)
  - **ID**: auth-save-load
  - **Status**: done
  - **Tags**: backend, frontend, auth
  - **Files**: `server/src/auth.ts`, `server/src/db.ts`, `server/src/index.ts`, `client/src/Login.tsx`, `client/src/App.tsx`, `client/src/index.css`, `scripts/smoke-test.mjs`, `.env.example`
  - **Details**: Requested directly by the user, not picked from this backlog. Username/password accounts with `bcryptjs` hashes and an httpOnly signed session cookie; sessions live in a SQLite `sessions` table. `prefs` became per-account `user_prefs` and `shopping_list` gained a `user_id` with `UNIQUE (user_id, product_id)`. Save is implicit on every write, load is implicit on login — no named snapshots. Pre-accounts rows are adopted by the seeded demo account (`DEMO_USERNAME` / `DEMO_PASSWORD`) behind a `PRAGMA user_version` gate; old tables stay as `prefs_legacy` / `shopping_list_legacy`.
  - **Acceptance**: Planner is unreachable without a session; register/login/logout work; prefs and list survive logout and return on the next login; a second account starts clean. Auth copy is EN/NL.
  - **Smoke**: (1) load the app → login screen, no tabs. (2) Registreer a new user → tabs appear, header shows `Ingelogd als <name>`. (3) Tick Vegetarisch, match a recipe, add products to the list. (4) Uitloggen → back to the login screen. (5) Log back in → Vegetarisch still ticked and the same list/total. (6) Register a second account → default prefs, empty list.

- [x] Translate recipe/ingredient names in EN mode (@cursor/translate-names-en-078b)
  - **ID**: translate-names-en
  - **Status**: done
  - **Tags**: frontend, i18n
  - **Files**: `client/src/App.tsx`, `client/src/recipeI18n.ts`
  - **Details**: When UI lang is EN, show English recipe titles, summaries, ingredient names, and units. Keep Dutch AH product titles on the shopping list (and share/Reminders text) so store names stay searchable.
  - **Acceptance**: Switch to EN → recipe cards and match rows show English names; List tab still shows original Dutch product titles. NL mode unchanged. Smoke checklist + CHANGELOG.
  - **Smoke**: EN → recipe titles English; Match → ingredient names English, product dropdowns still Dutch AH titles; add to list → List shows Dutch titles; NL → Dutch recipe names again.

- [x] Share shopping list to iPhone Reminders (@cursor/reminders-grocery-share-30e4)
  - **ID**: reminders-grocery-share
  - **Status**: done
  - **Tags**: frontend, shopping-list, ios
  - **Files**: `client/src/App.tsx`, `client/src/index.css`, `CHANGELOG.md`
  - **Details**: Web apps cannot write into a named Reminders grocery list. Add a List-tab Share/Copy action that sends newline-separated product titles (quantity suffix when > 1) via `navigator.share` (iPhone share sheet) with clipboard fallback. Hint copy: paste into a Groceries list, or pick Reminders in the share sheet. EN/NL. Overlaps `frontend-ui` on App.tsx / index.css — do not edit those files in parallel.
  - **Acceptance**: List tab shows Reminders / Herinneringen when the list is not empty. Share or copy produces one item per line. Demo checklist + CHANGELOG bullet.

- [ ] Camera feature with AI scan
  - **ID**: camera-ai-scan
  - **Status**: open
  - **Tags**: frontend, camera, ai
  - **Files**: `client/src/`, `server/src/`
  - **Details**: Let the user capture or upload a photo (fridge, receipt, product, ingredients) and run an AI scan that extracts item names, then match those names to AH/mock products and/or seeded recipes and offer add-to-list. Use the device camera via `getUserMedia` / file input (HTTPS or localhost). Any vision/LLM call must use an env var from `.env.example` (dummy value only) — never hardcode keys. If no key is configured, keep a clearly marked `// TODO(demo):` stub that still returns plausible Dutch ingredient names so the demo path works.
  - **Acceptance**: From the UI, take/upload a photo → see scanned item names → confirm/edit → products or a recipe suggestion → add selected to the shopping list. Works without a live AI key (stub). EN/NL copy. Smoke checklist. CHANGELOG bullet.
