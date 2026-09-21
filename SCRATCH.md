# Scratch / smoke notes

## camera-ai-scan (plate + weekly)

1. **Bord / Plate** → Upload any plate photo → preview must show the image (not a blank black box).
2. With `OPENROUTER_API_KEY` or `AI-KEY` in repo-root `.env`, stub banner should disappear and analysis comes from OpenRouter (`usedStub: false`). Without a key, stub banner is OK.
3. **Week / Weekly** → Refresh review → summary uses this week’s saved texts + common gaps.
4. Meals are keyed to the signed-in account; logging in as another user shows that user's meals.
5. Restart `npm run dev` after editing `.env` (loader reads repo-root `.env` and `server/.env`).

## frontend-ui (liquid glass + arc atmosphere)

1. `npm run dev` — open client; PlateWise plate logo + frosted glass panels on soft animated arc background.
2. Toggle prefs (Vegetarisch / Vegan / Halal); recipe list updates.
3. Tap **Match** on a recipe → thumbs, swap select, uncheck rows → add to list.
4. List tab: total, Reminders, Clear. Switch EN/NL; resize to phone width (~375).

## More recipes + mock products (2026-09)

1. `AH_FORCE_MOCK=1 npm run dev` — open Recipes tab; expect ~16 recipes (fewer with vegan prefs).
2. Open **Pompoensoep** or **Falafel wrap** → Match — every ingredient should resolve to named mock products (not only `AH <term>` fallback).
3. Switch lang to EN — new recipe titles/summaries/ingredients show English.
4. `curl -s localhost:3001/api/recipes | jq length` → 16; `curl -s 'localhost:3001/api/products/suggest?q=pompoen'` returns mock pompoen rows with bonus/bio options.

## offers-recipes-loop

1. Offers tab → pick a bonus item → **Kook dit** / **Cook this** → Match shows remaining ingredients with the bonus product selected.
2. Recipes → Linzen dal → Match → tap **Bio** then **Goedkoop** / **Cheap** → alternatives change → add selected to list.
3. List → search `spinazie` (or `rode linzen`) → Add → item appears without a recipe.
4. `AH_FORCE_MOCK=1` still serves mock bonus/products if AH is down.

## ah-api-integration — live AH probe (2026-09-21)

Why this task exists: live calls currently **always** fail, so the app silently serves mock
products. Reproduce with `curl` (no account or secret needed).

```bash
# 1. Search exactly as server/src/ah.ts builds it today -> 401
curl -s -H 'Accept: application/json' -H 'x-application: AHWEBSHOP' \
  'https://api.ah.nl/mobile-services/product/search/v2?query=spinazie&page=0&size=8&sortOn=PRICE_ASC'
# {"error":"unauthorized","error_description":"Missing valid security token"}

# 2. Anonymous token -> 200 {access_token, refresh_token, expires_in}
TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' \
  -H 'User-Agent: Appie/8.22.3' -H 'x-application: AHWEBSHOP' \
  -d '{"clientId":"appie"}' \
  'https://api.ah.nl/mobile-auth/v1/auth/token/anonymous' | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')

# 3. Same search WITH the token, minus the bad sortOn -> 200 with real products
curl -s -H 'Accept: application/json' -H 'User-Agent: Appie/8.22.3' \
  -H 'x-application: AHWEBSHOP' -H "Authorization: Bearer $TOKEN" \
  'https://api.ah.nl/mobile-services/product/search/v2?query=spinazie&page=0&size=5'
```

Findings:

- No `Authorization` header → **401**. Anonymous bearer token fixes it; `expires_in` was ~604800s.
- `sortOn=PRICE_ASC` (hardcoded today) → **400** `Failed to convert 'sortOn' with value: 'PRICE_ASC'`.
  `PRICELOWHIGH` and `RELEVANCE` → 200. `PRICE`, `PRICE_LOW_HIGH`, `PRICEASC` → 400.
- `filters[]=sp_include_dieet_vegetarisch` (from `prefsFacetParams`) → **400**, breaks the request.
- Real diet/property signal is `propertyIcons`, e.g. `["biologisch"]`, `["vegan","biologisch"]`,
  `["goedkoopje","vega","biologisch"]` — better than matching `biologisch` in the title.
- Bonus items: `currentPrice` is the discounted price, `priceBeforeBonus` is higher
  (e.g. 13.64 vs 15.16). `mapAhProduct` reads `priceBeforeBonus` first, so bonus ranking is wrong on live data.
- Unused but available: `images[].url`, `unitPriceDescription`, `brand`, `discountLabels`, `nutriscore`.

## ah-api-integration — smoke

1. `AH_FORCE_MOCK` unset → `GET /api/products/suggest?q=spinazie` has `usedMock: false` and `source: "ah"`; no mock banner; server log shows one `[ah] fetched anonymous token` then searches reuse it.
2. Same suggest after a second request: no extra anonymous-token log (token reused).
3. `filter=bio` on `rode linzen` returns only `isBio: true` (live `propertyIcons` includes `biologisch`).
4. Bonus items use discounted `currentPrice` when AH sends it (not the higher `priceBeforeBonus`).
5. `AH_FORCE_MOCK=1 npm run dev:server` → suggest returns `source: "mock"` and the mock banner still shows.
