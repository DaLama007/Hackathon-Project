# Scratch / smoke checklists

## More recipes + mock products (2026-09)

1. `AH_FORCE_MOCK=1 npm run dev` — open Recipes tab; expect ~16 recipes (fewer with vegan prefs).
2. Open **Pompoensoep** or **Falafel wrap** → Match — every ingredient should resolve to named mock products (not only `AH <term>` fallback).
3. Switch lang to EN — new recipe titles/summaries/ingredients show English.
4. `curl -s localhost:3001/api/recipes | jq length` → 16; `curl -s 'localhost:3001/api/products?q=pompoen'` returns mock pompoen rows with bonus/bio options.
