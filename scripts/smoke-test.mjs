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

/**
 * A browser-ish client: keeps its own cookie jar so each account gets an
 * independent session, which is what makes the isolation checks meaningful.
 */
function createClient() {
  const cookies = new Map();

  return async function request(path, init = {}) {
    const headers = { ...(init.headers ?? {}) };
    if (cookies.size > 0) {
      headers.cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    }
    const res = await fetch(`${base}${path}`, { ...init, headers });
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (value === "") cookies.delete(name);
      else cookies.set(name, value);
    }
    return res;
  };
}

function postJson(body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function putJson(body) {
  return { ...postJson(body), method: "PUT" };
}

// Unique per run so the test can be re-run against an existing database file.
const runId = Date.now().toString(36);
const alice = { username: `smoke_a_${runId}`, password: "smoke-pass-alice" };
const bob = { username: `smoke_b_${runId}`, password: "smoke-pass-bob" };

const anonymous = createClient();
const health = await anonymous("/api/health").then((r) => r.json());
assert(health.status === "ok", "health endpoint returns ok");

// --- auth guard ---------------------------------------------------------

assert((await anonymous("/api/prefs")).status === 401, "GET /api/prefs is 401 without a session");
assert(
  (await anonymous("/api/shopping-list")).status === 401,
  "GET /api/shopping-list is 401 without a session",
);
assert((await anonymous("/api/auth/me")).status === 401, "GET /api/auth/me is 401 without a session");

assert(
  (await anonymous("/api/auth/register", postJson({ username: alice.username, password: "short" })))
    .status === 400,
  "register rejects a password under 8 characters",
);
assert(
  (await anonymous("/api/auth/register", postJson({ username: "a b", password: "smoke-pass-alice" })))
    .status === 400,
  "register rejects an invalid username",
);

// --- register + session -------------------------------------------------

const aliceClient = createClient();
const registerRes = await aliceClient("/api/auth/register", postJson(alice));
assert(registerRes.status === 201, "POST /api/auth/register creates an account");
const aliceUser = await registerRes.json();
assert(aliceUser.username === alice.username, "register returns the new account");

const me = await aliceClient("/api/auth/me").then((r) => r.json());
assert(me.username === alice.username, "GET /api/auth/me identifies the session owner");

assert(
  (await aliceClient("/api/auth/register", postJson(alice))).status === 409,
  "register rejects a duplicate username",
);
assert(
  (await createClient()("/api/auth/login", postJson({ ...alice, password: "wrong-password" })))
    .status === 401,
  "login rejects a wrong password",
);

// --- core flow, now account-scoped -------------------------------------

const prefs = await aliceClient(
  "/api/prefs",
  putJson({ vegetarian: true, vegan: false, halal: false }),
).then((r) => r.json());
assert(prefs.vegetarian === true, "PUT /api/prefs updates vegetarian");

const recipes = await aliceClient("/api/recipes").then((r) => r.json());
assert(Array.isArray(recipes) && recipes.length >= 1, "GET /api/recipes returns recipes");
assert(
  recipes.every((r) => r.dietTags.includes("vegetarian") || r.dietTags.includes("vegan")),
  "vegetarian pref filters out non-veg recipes",
);

const recipeId = recipes[0].id;
const match = await aliceClient(
  `/api/recipes/${recipeId}/match`,
  postJson({ includeOptional: false }),
).then((r) => r.json());
assert(Array.isArray(match.matches) && match.matches.length > 0, "POST match returns matches");
assert(match.matches[0].product?.id, "first match has a product");
assert(Array.isArray(match.matches[0].products), "match rows include ranked products for filters");

const offers = await aliceClient("/api/offers").then((r) => r.json());
assert(Array.isArray(offers.offers) && offers.offers.length >= 1, "GET /api/offers returns bonus items");
const offerWithRecipe = offers.offers.find((row) => row.recipes?.length >= 1);
assert(offerWithRecipe?.product?.id, "an offer has a matching seeded recipe");
assert(offerWithRecipe.product.isBonus === true, "offers are bonus products");

const linzenMatch = await aliceClient(
  "/api/recipes/linzen-dal/match",
  postJson({ includeOptional: false }),
).then((r) => r.json());
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

const bioSuggest = await aliceClient(
  `/api/products/suggest?q=${encodeURIComponent("rode linzen")}&filter=bio`,
).then((r) => r.json());
assert(
  Array.isArray(bioSuggest.products) && bioSuggest.products.length >= 1 && bioSuggest.products.every((p) => p.isBio),
  "suggest filter=bio returns only organic products",
);

const product = match.matches[0].product;
const added = await aliceClient(
  "/api/shopping-list/items",
  postJson({
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
).then((r) => r.json());
assert(Array.isArray(added) && added[0].product_id === product.id, "POST shopping-list adds item");

const looseProduct = bioSuggest.products[0];
const looseAdded = await aliceClient(
  "/api/shopping-list/items",
  postJson({
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
).then((r) => r.json());
assert(
  Array.isArray(looseAdded) && looseAdded[0].product_id === `loose-${looseProduct.id}` && !looseAdded[0].recipe_id,
  "POST shopping-list adds a non-recipe catalog item",
);

const list = await aliceClient("/api/shopping-list").then((r) => r.json());
assert(
  list.some((item) => item.product_id === product.id),
  "GET shopping-list contains added item",
);

// --- a second account gets a clean slate -------------------------------

const bobClient = createClient();
assert(
  (await bobClient("/api/auth/register", postJson(bob))).status === 201,
  "a second account can register",
);

const bobPrefs = await bobClient("/api/prefs").then((r) => r.json());
assert(
  bobPrefs.vegetarian === false && bobPrefs.vegan === false && bobPrefs.halal === false,
  "a new account starts with default prefs, not the first account's",
);

const bobList = await bobClient("/api/shopping-list").then((r) => r.json());
assert(bobList.length === 0, "a new account starts with an empty shopping list");

const bobAdded = await bobClient(
  "/api/shopping-list/items",
  postJson({ items: [{ productId: product.id, title: product.title, price: product.price }] }),
).then((r) => r.json());
assert(bobAdded[0].product_id === product.id, "two accounts can hold the same product id");
assert(
  (await bobClient(`/api/shopping-list/items/${added[0].id}`, { method: "DELETE" })).status === 404,
  "one account cannot delete another account's list item",
);

const aliceListAfterBob = await aliceClient("/api/shopping-list").then((r) => r.json());
assert(aliceListAfterBob.length === 2, "the first account's list is untouched by the second");

// --- logout, then log back in: the save/load proof ---------------------

assert((await aliceClient("/api/auth/logout", { method: "POST" })).status === 204, "POST /api/auth/logout ends the session");
assert((await aliceClient("/api/prefs")).status === 401, "the session is rejected after logout");

const returningAlice = createClient();
assert((await returningAlice("/api/auth/login", postJson(alice))).status === 200, "login with the right password succeeds");

const reloadedPrefs = await returningAlice("/api/prefs").then((r) => r.json());
assert(reloadedPrefs.vegetarian === true, "prefs are restored on the next login");

const reloadedList = await returningAlice("/api/shopping-list").then((r) => r.json());
assert(
  reloadedList.some((item) => item.product_id === product.id),
  "the shopping list is restored on the next login",
);
assert(
  reloadedList.some((item) => item.product_id === `loose-${looseProduct.id}`),
  "non-recipe items are restored on the next login too",
);

// --- cleanup ------------------------------------------------------------

for (const item of reloadedList) {
  const res = await returningAlice(`/api/shopping-list/items/${item.id}`, { method: "DELETE" });
  assert(res.status === 204, `DELETE shopping-list item ${item.id} removes it`);
}
await returningAlice("/api/prefs", putJson({ vegetarian: false, vegan: false, halal: false }));
await bobClient("/api/shopping-list", { method: "DELETE" });

console.log("\nAll smoke checks passed.");
