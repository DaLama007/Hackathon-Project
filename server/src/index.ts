import "./env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import {
  applyCatalogFilter,
  listBonusOffers,
  parseCatalogFilter,
  searchProducts,
  type Product,
} from "./ah.js";
import { authRouter, requireUser, seedDemoUser, sessionSecret } from "./auth.js";
import {
  addShoppingItem,
  clearShoppingList,
  getPrefs,
  getWeeklyReview,
  listMealLogs,
  listShoppingItems,
  listWeeklyReviews,
  removeShoppingItem,
  setPrefs,
} from "./db.js";
import {
  analyzePlate,
  buildWeeklyReview,
  savePlateMeal,
  weekStartMonday,
  type MealLang,
} from "./meals.js";
import {
  getRecipe,
  listRecipes,
  recipesUsingProduct,
  uniqueIngredientSearchTerms,
  type UserPrefs,
} from "./recipes.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
// Plate photos arrive as base64; the default body limit is too small.
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser(sessionSecret));

function parsePrefsBody(body: unknown): UserPrefs | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  return {
    vegetarian: Boolean(b.vegetarian),
    vegan: Boolean(b.vegan),
    halal: Boolean(b.halal),
  };
}

/** Safe on any route mounted behind `requireUser`. */
function userIdOf(req: express.Request): number {
  if (req.userId === undefined) throw new Error("route is missing requireUser");
  return req.userId;
}

/** Meal tables key on TEXT, so scope them by the signed-in account id. */
function mealUserIdOf(req: express.Request): string {
  return String(userIdOf(req));
}

function parseLang(value: unknown): MealLang {
  return value === "en" ? "en" : "nl";
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);

// Everything below is account-scoped: prefs, pref-filtered recipes, the list, and meals.
app.use(
  [
    "/api/prefs",
    "/api/recipes",
    "/api/shopping-list",
    "/api/offers",
    "/api/products",
    "/api/meals",
  ],
  requireUser,
);

app.get("/api/prefs", (req, res) => {
  res.json(getPrefs(userIdOf(req)));
});

app.put("/api/prefs", (req, res) => {
  const prefs = parsePrefsBody(req.body);
  if (!prefs) {
    return res.status(400).json({ error: "invalid prefs body" });
  }
  res.json(setPrefs(userIdOf(req), prefs));
});

app.get("/api/recipes", (req, res) => {
  const prefs = getPrefs(userIdOf(req));
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

  const prefs = getPrefs(userIdOf(req));
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

app.get("/api/shopping-list", (req, res) => {
  res.json(listShoppingItems(userIdOf(req)));
});

app.post("/api/shopping-list/items", (req, res) => {
  const userId = userIdOf(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
  const added = [];

  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId : item?.id;
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (!productId || !title) {
      return res.status(400).json({ error: "each item needs productId and title" });
    }
    added.push(
      addShoppingItem(userId, {
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
  if (!removeShoppingItem(userIdOf(req), id)) {
    return res.status(404).json({ error: "not found" });
  }
  res.status(204).end();
});

app.delete("/api/shopping-list", (req, res) => {
  clearShoppingList(userIdOf(req));
  res.status(204).end();
});

/** Current AH bonus/offers with seeded recipes that can use each item. */
app.get("/api/offers", async (req, res) => {
  const prefs = getPrefs(userIdOf(req));
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
  const prefs = getPrefs(userIdOf(req));
  const catalogFilter = parseCatalogFilter(req.query.filter);
  const { products, usedMock } = await searchProducts(query, prefs);
  const filtered = applyCatalogFilter(products, catalogFilter);
  res.json({ query, filter: catalogFilter, products: filtered.slice(0, 8), usedMock });
});

/** Plate photo → description + nutrition + gaps, saved for the soft user id. */
app.post("/api/meals/scan", async (req, res) => {
  const imageBase64 =
    typeof req.body?.imageBase64 === "string"
      ? req.body.imageBase64.replace(/^data:[^;]+;base64,/, "")
      : "";
  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 required" });
  }
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "image/jpeg";
  const lang = parseLang(req.body?.lang);
  const userId = mealUserIdOf(req);
  const save = req.body?.save !== false;

  try {
    const analysis = await analyzePlate({ imageBase64, mimeType, lang });
    const meal = save ? savePlateMeal({ userId, analysis }) : null;
    res.status(save ? 201 : 200).json({ analysis, meal, userId });
  } catch (err) {
    console.error("[meals] scan failed:", err);
    res.status(500).json({ error: "meal scan failed" });
  }
});

app.get("/api/meals", (req, res) => {
  const userId = mealUserIdOf(req);
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  res.json({ userId, meals: listMealLogs(userId, since) });
});

/** Build or refresh this week's review from saved meal texts. */
app.post("/api/meals/weekly-review", async (req, res) => {
  const userId = mealUserIdOf(req);
  const lang = parseLang(req.body?.lang ?? req.query.lang);
  const weekStart =
    typeof req.body?.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.weekStart)
      ? req.body.weekStart
      : weekStartMonday();

  try {
    const review = await buildWeeklyReview({ userId, lang, weekStart });
    res.json({ review, meals: listMealLogs(userId, `${weekStart} 00:00:00`) });
  } catch (err) {
    console.error("[meals] weekly review failed:", err);
    res.status(500).json({ error: "weekly review failed" });
  }
});

app.get("/api/meals/weekly-review", async (req, res) => {
  const userId = mealUserIdOf(req);
  const lang = parseLang(req.query.lang);
  const weekStart =
    typeof req.query.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.weekStart)
      ? req.query.weekStart
      : weekStartMonday();
  const refresh = req.query.refresh === "1";

  try {
    let review = getWeeklyReview(userId, weekStart);
    if (!review || refresh) {
      review = await buildWeeklyReview({ userId, lang, weekStart });
    }
    res.json({
      review,
      history: listWeeklyReviews(userId),
      meals: listMealLogs(userId, `${weekStart} 00:00:00`),
    });
  } catch (err) {
    console.error("[meals] weekly review get failed:", err);
    res.status(500).json({ error: "weekly review failed" });
  }
});

const port = Number(process.env.PORT ?? 3001);
seedDemoUser().finally(() => {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
});

export type { Product };
