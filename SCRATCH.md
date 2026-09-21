# Scratch / smoke notes

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
