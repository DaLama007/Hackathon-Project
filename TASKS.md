# Tasks

<!-- policy: This is the shared hackathon backlog. Every agent (Cloud or local) picks from here unless the user named a specific task.
     policy: Claim before you write code: add `(@your-branch)` on the task line, commit + push that claim immediately, then implement.
     policy: One agent, one open task. If a task is already claimed, pick another or help only where files do not overlap.
     policy: When done: check the box, set **Status**: done, add a CHANGELOG bullet, unclaim. Do not delete the task block.
     policy: Happy path + demoable over architecture. EN+NL UI copy. Dutch AH search terms. No hardcoded secrets. -->

Open tasks are available to any agent. Claimed tasks show `(@branch-name)` on the title line.

## P0

- [ ] Polish frontend UI (@cursor/frontend-ui-ad72)
  - **ID**: frontend-ui
  - **Status**: claimed
  - **Tags**: frontend, ui
  - **Files**: `client/src/App.tsx`, `client/src/index.css`
  - **Details**: Make the existing PlateWise demo look and feel demo-ready. Today the app is a single-page three-tab flow (recipes / match / list) with functional but sparse layout. Improve visual hierarchy, recipe cards, product images, match-review (swap/uncheck), shopping list, empty/error/loading states, and mobile + ~720px desktop. Keep EN/NL via the existing `copy.en` / `copy.nl` map (default NL, persist `platewise-lang`). Do not rebuild the stack or add an i18n library.
  - **Acceptance**: A teammate can run `npm run dev`, click through prefs → recipe → match → list, and the UI looks intentional on phone-width and desktop. New strings exist in both locales. Smoke checklist added (comment or SCRATCH.md).

- [ ] Bidirectional AH offers ↔ recipes, plus item filters
  - **ID**: offers-recipes-loop
  - **Status**: open
  - **Tags**: frontend, backend, ah, recipes
  - **Files**: `server/src/ah.ts`, `server/src/index.ts`, `server/src/recipes.ts`, `client/src/App.tsx`
  - **Details**: Support both directions, not only recipe → products. (1) **Offers → recipes**: start from current AH bonus/offers (mock fallback if AH is down) and suggest seeded recipes that can use those items. (2) **Recipes → offers**: keep matching ingredients to AH products, ranking bonus/cheap as today, but surface offer/bonus products more clearly. (3) **Just items**: let the user add catalog items that are not tied to a recipe. (4) **Selection filters** on products: cheap, bio/organic (`biologisch` in title or AH diet/property if present), bonus, and “whatever” other cheap filters that are already in the catalog (do not invent AH query params — check `server/src/ah.ts` first). Ranking today is bonus-first then cheaper (`scoreProduct` in `ah.ts`); extend that rather than replacing it.
  - **Acceptance**: Demo path A: open offers, pick a bonus item, see at least one matching recipe, match remaining ingredients. Demo path B: open a recipe, filter alternatives to bio or cheapest, add to list. Demo path C: add a non-recipe item to the list. Mock fallback still works with `AH_FORCE_MOCK=1`. EN/NL copy for new UI. CHANGELOG bullet.

## P1

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
