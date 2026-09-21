import "dotenv/config";
import cors from "cors";
import express from "express";
import {
  applyCatalogFilter,
  listBonusOffers,
  parseCatalogFilter,
  searchProducts,
  type Product,
} from "./ah.js";
import {
  addShoppingItem,
  clearShoppingList,
  getPrefs,
  listShoppingItems,
  removeShoppingItem,
  setPrefs,
} from "./db.js";
import {
  getRecipe,
  listRecipes,
  recipesUsingProduct,
  uniqueIngredientSearchTerms,
  type UserPrefs,
} from "./recipes.js";

const app = express();
app.use(cors());
app.use(express.json());

function parsePrefsBody(body: unknown): UserPrefs | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  return {
    vegetarian: Boolean(b.vegetarian),
    vegan: Boolean(b.vegan),
    halal: Boolean(b.halal),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/prefs", (_req, res) => {
  res.json(getPrefs());
});

app.put("/api/prefs", (req, res) => {
  const prefs = parsePrefsBody(req.body);
  if (!prefs) {
    return res.status(400).json({ error: "invalid prefs body" });
  }
  res.json(setPrefs(prefs));
});

app.get("/api/recipes", (req, res) => {
  const prefs = getPrefs();
  const filter = req.query.filter !== "0";
  res.json(filter ? listRecipes(prefs) : listRecipes());
});

app.get("/api/recipes/:id", (req, res) => {
  const recipe = getRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: "recipe not found" });
  res.json(recipe);
});

app.post("/api/recipes/:id/match", async (req, res) => {
  const recipe = getRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: "recipe not found" });

  const prefs = getPrefs();
  const includeOptional = Boolean(req.body?.includeOptional);

  const ingredients = recipe.ingredients.filter((ing) => includeOptional || !ing.optional);

  const catalogFilter = parseCatalogFilter(req.body?.filter);

  const matches = await Promise.all(
    ingredients.map(async (ingredient) => {
      const { products, usedMock } = await searchProducts(ingredient.searchTerm, prefs);
      const filtered = applyCatalogFilter(products, catalogFilter);
      const ranked = filtered.length > 0 ? filtered : products;
      const product = ranked[0] ?? null;
      const alternatives = ranked.slice(1, 8);
      return {
        ingredient,
        product,
        alternatives,
        products: ranked.slice(0, 8),
        usedMock,
      };
    }),
  );

  res.json({
    recipeId: recipe.id,
    title: recipe.title,
    matches,
    usedMock: matches.some((m) => m.usedMock),
  });
});

app.get("/api/shopping-list", (_req, res) => {
  res.json(listShoppingItems());
});

app.post("/api/shopping-list/items", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
  const added = [];

  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId : item?.id;
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (!productId || !title) {
      return res.status(400).json({ error: "each item needs productId and title" });
    }
    added.push(
      addShoppingItem({
        productId: String(productId),
        title,
        price: typeof item.price === "number" ? item.price : null,
        isBonus: Boolean(item.isBonus ?? item.is_bonus),
        bonusLabel: item.bonusLabel ?? item.bonus_label ?? null,
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        searchTerm: item.searchTerm ?? item.search_term ?? null,
        recipeId: item.recipeId ?? item.recipe_id ?? null,
      }),
    );
  }

  res.status(201).json(added);
});

app.delete("/api/shopping-list/items/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }
  if (!removeShoppingItem(id)) {
    return res.status(404).json({ error: "not found" });
  }
  res.status(204).end();
});

app.delete("/api/shopping-list", (_req, res) => {
  clearShoppingList();
  res.status(204).end();
});

/** Current AH bonus/offers with seeded recipes that can use each item. */
app.get("/api/offers", async (_req, res) => {
  const prefs = getPrefs();
  const { products, usedMock } = await listBonusOffers(prefs, uniqueIngredientSearchTerms());
  const offers = products
    .map((product) => ({
      product,
      recipes: recipesUsingProduct(product.title, prefs).map(({ recipe, matchedIngredient }) => ({
        id: recipe.id,
        title: recipe.title,
        summary: recipe.summary,
        matchedIngredient: matchedIngredient.name,
      })),
    }))
    .filter((offer) => offer.recipes.length > 0)
    .slice(0, 16);
  res.json({ usedMock, offers });
});

/** Quick product search for a single gap/term (meal stretch / add-item). */
app.get("/api/products/suggest", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) return res.status(400).json({ error: "q is required" });
  const prefs = getPrefs();
  const catalogFilter = parseCatalogFilter(req.query.filter);
  const { products, usedMock } = await searchProducts(query, prefs);
  const filtered = applyCatalogFilter(products, catalogFilter);
  res.json({ query, filter: catalogFilter, products: filtered.slice(0, 8), usedMock });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

export type { Product };
