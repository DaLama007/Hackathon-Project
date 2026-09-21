// Minimal end-to-end smoke test against the running API.
// Usage: node scripts/smoke-test.mjs  (API must be running, defaults to PORT 3001)

const base = `http://localhost:${process.env.PORT ?? 3001}`;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`ok: ${message}`);
}

const health = await fetch(`${base}/api/health`).then((r) => r.json());
assert(health.status === "ok", "health endpoint returns ok");

const prefs = await fetch(`${base}/api/prefs`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ vegetarian: true, vegan: false, halal: false }),
}).then((r) => r.json());
assert(prefs.vegetarian === true, "PUT /api/prefs updates vegetarian");

const recipes = await fetch(`${base}/api/recipes`).then((r) => r.json());
assert(Array.isArray(recipes) && recipes.length >= 1, "GET /api/recipes returns recipes");
assert(
  recipes.every((r) => r.dietTags.includes("vegetarian") || r.dietTags.includes("vegan")),
  "vegetarian pref filters out non-veg recipes",
);

const recipeId = recipes[0].id;
const match = await fetch(`${base}/api/recipes/${recipeId}/match`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ includeOptional: false }),
}).then((r) => r.json());
assert(Array.isArray(match.matches) && match.matches.length > 0, "POST match returns matches");
assert(match.matches[0].product?.id, "first match has a product");
assert(Array.isArray(match.matches[0].products), "match rows include ranked products for filters");

const offers = await fetch(`${base}/api/offers`).then((r) => r.json());
assert(Array.isArray(offers.offers) && offers.offers.length >= 1, "GET /api/offers returns bonus items");
const offerWithRecipe = offers.offers.find((row) => row.recipes?.length >= 1);
assert(offerWithRecipe?.product?.id, "an offer has a matching seeded recipe");
assert(offerWithRecipe.product.isBonus === true, "offers are bonus products");

const linzenMatch = await fetch(`${base}/api/recipes/linzen-dal/match`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ includeOptional: false }),
}).then((r) => r.json());
const linzenRow = linzenMatch.matches.find((row) => row.ingredient.searchTerm === "rode linzen");
assert(linzenRow, "linzen-dal match includes rode linzen");
assert(
  linzenRow.products.some((p) => p.isBio),
  "linzen alternatives include a bio product",
);
assert(
  linzenRow.products.some((p) => p.isBonus),
  "linzen alternatives include a bonus product",
);

const bioSuggest = await fetch(`${base}/api/products/suggest?q=${encodeURIComponent("rode linzen")}&filter=bio`).then(
  (r) => r.json(),
);
assert(
  Array.isArray(bioSuggest.products) && bioSuggest.products.length >= 1 && bioSuggest.products.every((p) => p.isBio),
  "suggest filter=bio returns only organic products",
);

const product = match.matches[0].product;
const added = await fetch(`${base}/api/shopping-list/items`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: [
      {
        productId: product.id,
        title: product.title,
        price: product.price,
        isBonus: product.isBonus,
        bonusLabel: product.bonusLabel,
        searchTerm: match.matches[0].ingredient.searchTerm,
        recipeId,
      },
    ],
  }),
}).then((r) => r.json());
assert(Array.isArray(added) && added[0].product_id === product.id, "POST shopping-list adds item");

const looseProduct = bioSuggest.products[0];
const looseAdded = await fetch(`${base}/api/shopping-list/items`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: [
      {
        productId: `loose-${looseProduct.id}`,
        title: looseProduct.title,
        price: looseProduct.price,
        isBonus: looseProduct.isBonus,
        bonusLabel: looseProduct.bonusLabel,
        searchTerm: "rode linzen",
      },
    ],
  }),
}).then((r) => r.json());
assert(
  Array.isArray(looseAdded) && looseAdded[0].product_id === `loose-${looseProduct.id}` && !looseAdded[0].recipe_id,
  "POST shopping-list adds a non-recipe catalog item",
);

const list = await fetch(`${base}/api/shopping-list`).then((r) => r.json());
assert(
  list.some((item) => item.product_id === product.id),
  "GET shopping-list contains added item",
);

const del = await fetch(`${base}/api/shopping-list/items/${added[0].id}`, { method: "DELETE" });
assert(del.status === 204, "DELETE shopping-list item removes it");
const delLoose = await fetch(`${base}/api/shopping-list/items/${looseAdded[0].id}`, { method: "DELETE" });
assert(delLoose.status === 204, "DELETE non-recipe catalog item removes it");

// Plate meal scan stub (no OPENAI_API_KEY) + weekly review from saved texts
const mealUser = "smoke-meal-user";
const mealScan = await fetch(`${base}/api/meals/scan`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-User-Id": mealUser },
  body: JSON.stringify({
    imageBase64: "dGVzdA==",
    mimeType: "image/jpeg",
    lang: "nl",
    userId: mealUser,
  }),
}).then((r) => r.json());
assert(mealScan.analysis?.description, "meal scan returns a description");
assert(Array.isArray(mealScan.analysis?.missing) && mealScan.analysis.missing.length >= 1, "meal scan lists gaps");
assert(mealScan.meal?.id, "meal scan saves a meal log row");
assert(typeof mealScan.analysis.usedStub === "boolean", "meal scan reports stub/live flag");
// Without a key → stub; with OpenRouter/OpenAI the flag may be false (or true if the live call failed).
if (!process.env.OPENROUTER_API_KEY && !process.env["AI-KEY"] && !process.env.OPENAI_API_KEY) {
  assert(mealScan.analysis.usedStub === true, "meal scan without AI key uses stub");
}

const mealsList = await fetch(`${base}/api/meals?userId=${encodeURIComponent(mealUser)}`, {
  headers: { "X-User-Id": mealUser },
}).then((r) => r.json());
assert(
  Array.isArray(mealsList.meals) && mealsList.meals.some((m) => m.id === mealScan.meal.id),
  "GET /api/meals returns saved plate meals",
);

const weekly = await fetch(`${base}/api/meals/weekly-review?userId=${encodeURIComponent(mealUser)}&lang=nl&refresh=1`, {
  headers: { "X-User-Id": mealUser },
}).then((r) => r.json());
assert(weekly.review?.summary, "weekly review returns a summary");
assert(weekly.review?.meal_count >= 1, "weekly review counts saved meals");

// reset prefs
await fetch(`${base}/api/prefs`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ vegetarian: false, vegan: false, halal: false }),
});

console.log("\nAll smoke checks passed.");
