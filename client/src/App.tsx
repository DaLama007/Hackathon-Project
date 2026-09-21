import { useEffect, useMemo, useState } from "react";

type DietTag = "vegetarian" | "vegan" | "halal";
type Lang = "en" | "nl";

interface UserPrefs {
  vegetarian: boolean;
  vegan: boolean;
  halal: boolean;
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  searchTerm: string;
  optional: boolean;
}

interface Recipe {
  id: string;
  title: string;
  servings: number;
  timeMinutes: number;
  dietTags: DietTag[];
  summary: string;
  steps: string[];
  ingredients: Ingredient[];
}

interface Product {
  id: string;
  title: string;
  price: number | null;
  isBonus: boolean;
  bonusLabel: string | null;
  imageUrl: string | null;
  source: "ah" | "mock";
}

interface MatchRow {
  ingredient: Ingredient;
  product: Product | null;
  alternatives: Product[];
  usedMock: boolean;
}

interface ShoppingItem {
  id: number;
  product_id: string;
  title: string;
  price: number | null;
  is_bonus: boolean;
  bonus_label: string | null;
  quantity: number;
}

type View = "recipes" | "match" | "list";

const emptyPrefs: UserPrefs = { vegetarian: false, vegan: false, halal: false };
const LANG_KEY = "platewise-lang";

const copy = {
  en: {
    title: "Diet planner",
    subtitle: "Prefs → recipe → Albert Heijn products (bonus first) → shopping list",
    recipes: "Recipes",
    match: "Match",
    list: "List",
    prefs: "Preferences",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    halal: "Halal",
    hint: "Recipes are filtered by store tags — not medical/religious advice.",
    loading: "Loading…",
    noRecipes: "No recipes for these prefs — turn a filter off.",
    servings: "servings",
    matching: "Matching…",
    addViaAh: "Add via AH",
    mockBanner: "AH API unreachable — using mock products (demo still works).",
    noProduct: "No product found",
    adding: "Adding…",
    addSelected: "Add selected to list",
    shoppingList: "Shopping list",
    clear: "Clear",
    emptyList: "List is empty. Match a recipe to start.",
    remove: "Remove",
    total: "Estimated total",
    selectOne: "Select at least one product",
    reminders: "Reminders",
    remindersCopied: "Copied — paste into a Groceries list in Reminders.",
    remindersHint:
      "On iPhone: share and pick Reminders, or paste into a Groceries list (one item per line).",
    remindersFailed: "Could not copy the list. Select and copy the items manually.",
    switchTo: "NL",
    switchAria: "Switch to Dutch",
  },
  nl: {
    title: "Dieetplanner",
    subtitle: "Voorkeuren → recept → AH-producten (bonus eerst) → boodschappenlijst",
    recipes: "Recepten",
    match: "Match",
    list: "Lijst",
    prefs: "Voorkeuren",
    vegetarian: "Vegetarisch",
    vegan: "Vegan",
    halal: "Halal",
    hint: "Recepten worden gefilterd op store-tags; geen medische/religieuze garantie.",
    loading: "Laden…",
    noRecipes: "Geen recepten voor deze voorkeuren. Zet een filter uit.",
    servings: "pers",
    matching: "Matchen…",
    addViaAh: "Voeg toe via AH",
    mockBanner: "AH API onbereikbaar — mock producten gebruikt (demo blijft werken).",
    noProduct: "Geen product gevonden",
    adding: "Toevoegen…",
    addSelected: "Geselecteerde producten naar lijst",
    shoppingList: "Boodschappenlijst",
    clear: "Leegmaken",
    emptyList: "Lijst is leeg. Match een recept om te beginnen.",
    remove: "Verwijderen",
    total: "Geschat totaal",
    selectOne: "Selecteer minstens één product",
    reminders: "Herinneringen",
    remindersCopied: "Gekopieerd — plak in een Boodschappen-lijst in Herinneringen.",
    remindersHint:
      "Op iPhone: deel en kies Herinneringen, of plak in een Boodschappen-lijst (één regel per product).",
    remindersFailed: "Lijst kopiëren mislukt. Kopieer de items handmatig.",
    switchTo: "EN",
    switchAria: "Schakel naar Engels",
  },
} as const;

function readStoredLang(): Lang {
  const stored = localStorage.getItem(LANG_KEY);
  return stored === "en" || stored === "nl" ? stored : "nl";
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  return `€${price.toFixed(2)}`;
}

function formatGroceryLine(item: ShoppingItem): string {
  return item.quantity > 1 ? `${item.title} ×${item.quantity}` : item.title;
}

function formatGroceryText(items: ShoppingItem[]): string {
  return items.map(formatGroceryLine).join("\n");
}

function copyTextWithFallback(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch (err) {
    console.error("Copy fallback failed", err);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => readStoredLang());
  const t = copy[lang];

  const [view, setView] = useState<View>("recipes");
  const [prefs, setPrefs] = useState<UserPrefs>(emptyPrefs);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Product>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [usedMock, setUsedMock] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  function setLanguage(next: Lang) {
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
    document.documentElement.lang = next;
  }

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  async function loadPrefs() {
    const res = await fetch("/api/prefs");
    if (!res.ok) throw new Error(`GET /api/prefs failed: ${res.status}`);
    setPrefs(await res.json());
  }

  async function loadRecipes() {
    const res = await fetch("/api/recipes");
    if (!res.ok) throw new Error(`GET /api/recipes failed: ${res.status}`);
    setRecipes(await res.json());
  }

  async function loadShoppingList() {
    const res = await fetch("/api/shopping-list");
    if (!res.ok) throw new Error(`GET /api/shopping-list failed: ${res.status}`);
    setShoppingList(await res.json());
  }

  async function bootstrap() {
    try {
      setLoading(true);
      await Promise.all([loadPrefs(), loadRecipes(), loadShoppingList()]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function updatePref(key: keyof UserPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    if (key === "vegan" && value) next.vegetarian = true;
    setPrefs(next);
    try {
      const res = await fetch("/api/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`PUT /api/prefs failed: ${res.status}`);
      setPrefs(await res.json());
      await loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prefs");
    }
  }

  async function matchRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setMatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeOptional: false }),
      });
      if (!res.ok) throw new Error(`Match failed: ${res.status}`);
      const data = await res.json();
      const rows = data.matches as MatchRow[];
      setMatches(rows);
      setUsedMock(Boolean(data.usedMock));

      const products: Record<string, Product> = {};
      const includedMap: Record<string, boolean> = {};
      for (const row of rows) {
        const key = row.ingredient.searchTerm;
        if (row.product) products[key] = row.product;
        includedMap[key] = Boolean(row.product);
      }
      setSelectedProducts(products);
      setIncluded(includedMap);
      setView("match");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to match products");
    } finally {
      setMatching(false);
    }
  }

  function swapProduct(searchTerm: string, productId: string, row: MatchRow) {
    const all = [row.product, ...row.alternatives].filter(Boolean) as Product[];
    const found = all.find((p) => p.id === productId);
    if (found) {
      setSelectedProducts((prev) => ({ ...prev, [searchTerm]: found }));
    }
  }

  async function addSelectedToList() {
    if (!selectedRecipe) return;
    const items = matches
      .filter((row) => included[row.ingredient.searchTerm] && selectedProducts[row.ingredient.searchTerm])
      .map((row) => {
        const product = selectedProducts[row.ingredient.searchTerm];
        return {
          productId: product.id,
          title: product.title,
          price: product.price,
          isBonus: product.isBonus,
          bonusLabel: product.bonusLabel,
          searchTerm: row.ingredient.searchTerm,
          recipeId: selectedRecipe.id,
          quantity: 1,
        };
      });

    if (items.length === 0) {
      setError(t.selectOne);
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/shopping-list/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(`Add to list failed: ${res.status}`);
      await loadShoppingList();
      setView("list");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add items");
    } finally {
      setAdding(false);
    }
  }

  async function removeItem(id: number) {
    try {
      const res = await fetch(`/api/shopping-list/items/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
      await loadShoppingList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  }

  async function clearList() {
    try {
      const res = await fetch("/api/shopping-list", { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Clear failed: ${res.status}`);
      await loadShoppingList();
      setShareStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear list");
    }
  }

  async function copyGroceryText(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.error("Clipboard write failed", err);
    }
    return copyTextWithFallback(text);
  }

  // Smoke: List tab → Reminders → share sheet or "Copied" banner; text is one product per line.
  async function shareToReminders() {
    if (shoppingList.length === 0) return;
    const text = formatGroceryText(shoppingList);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t.shoppingList, text });
        setShareStatus(null);
        setError(null);
        return;
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        if (aborted) return;
        console.error("Share failed", err);
      }
    }
    const copied = await copyGroceryText(text);
    if (copied) {
      setShareStatus(t.remindersCopied);
      setError(null);
    } else {
      setShareStatus(null);
      setError(t.remindersFailed);
    }
  }

  const listTotal = useMemo(
    () => shoppingList.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
    [shoppingList],
  );

  return (
    <main className="app">
      <header className="hero">
        <div className="hero-top">
          <p className="brand">PlateWise</p>
          <div className="lang-switch" role="group" aria-label="Language / Taal">
            <button
              type="button"
              className={lang === "en" ? "lang active" : "lang"}
              onClick={() => setLanguage("en")}
              aria-pressed={lang === "en"}
            >
              EN
            </button>
            <button
              type="button"
              className={lang === "nl" ? "lang active" : "lang"}
              onClick={() => setLanguage("nl")}
              aria-pressed={lang === "nl"}
            >
              NL
            </button>
          </div>
        </div>
        <h1>{t.title}</h1>
        <p className="subtitle">{t.subtitle}</p>
      </header>

      <nav className="tabs" aria-label={lang === "en" ? "Views" : "Weergaven"}>
        <button className={view === "recipes" ? "active" : ""} onClick={() => setView("recipes")}>
          {t.recipes}
        </button>
        <button
          className={view === "match" ? "active" : ""}
          onClick={() => selectedRecipe && setView("match")}
          disabled={!selectedRecipe}
        >
          {t.match}
        </button>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
          {t.list} ({shoppingList.length})
        </button>
      </nav>

      <section className="prefs" aria-label={t.prefs}>
        <h2>{t.prefs}</h2>
        <div className="pref-toggles">
          {(
            [
              ["vegetarian", t.vegetarian],
              ["vegan", t.vegan],
              ["halal", t.halal],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="pref">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => updatePref(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="hint">{t.hint}</p>
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">{t.loading}</p>
      ) : view === "recipes" ? (
        <section>
          <h2>
            {t.recipes} ({recipes.length})
          </h2>
          {recipes.length === 0 ? (
            <p className="empty">{t.noRecipes}</p>
          ) : (
            <ul className="recipe-list">
              {recipes.map((recipe) => (
                <li key={recipe.id}>
                  <div>
                    <h3>{recipe.title}</h3>
                    <p>{recipe.summary}</p>
                    <p className="meta">
                      {recipe.timeMinutes} min · {recipe.servings} {t.servings} ·{" "}
                      {recipe.dietTags.join(", ")}
                    </p>
                  </div>
                  <button disabled={matching} onClick={() => matchRecipe(recipe)}>
                    {matching && selectedRecipe?.id === recipe.id ? t.matching : t.addViaAh}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : view === "match" && selectedRecipe ? (
        <section>
          <h2>
            {t.match}: {selectedRecipe.title}
          </h2>
          {usedMock && <p className="banner">{t.mockBanner}</p>}
          <ul className="match-list">
            {matches.map((row) => {
              const key = row.ingredient.searchTerm;
              const selected = selectedProducts[key];
              const options = [row.product, ...row.alternatives].filter(Boolean) as Product[];
              return (
                <li key={key}>
                  <label className="match-head">
                    <input
                      type="checkbox"
                      checked={Boolean(included[key])}
                      onChange={(e) =>
                        setIncluded((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    <span>
                      {row.ingredient.name}{" "}
                      <span className="meta">
                        ({row.ingredient.quantity} {row.ingredient.unit})
                      </span>
                    </span>
                  </label>
                  {selected ? (
                    <div className="match-body">
                      <select
                        value={selected.id}
                        onChange={(e) => swapProduct(key, e.target.value, row)}
                        aria-label={`Product for ${row.ingredient.name}`}
                      >
                        {options.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.title} · {formatPrice(product.price)}
                            {product.isBonus ? " · BONUS" : ""}
                          </option>
                        ))}
                      </select>
                      {selected.isBonus && (
                        <span className="bonus">{selected.bonusLabel ?? "Bonus"}</span>
                      )}
                    </div>
                  ) : (
                    <p className="empty">{t.noProduct}</p>
                  )}
                </li>
              );
            })}
          </ul>
          <button className="primary" disabled={adding} onClick={addSelectedToList}>
            {adding ? t.adding : t.addSelected}
          </button>
        </section>
      ) : (
        <section>
          <div className="list-header">
            <h2>{t.shoppingList}</h2>
            {shoppingList.length > 0 && (
              <div className="list-actions">
                <button className="ghost" onClick={shareToReminders}>
                  {t.reminders}
                </button>
                <button className="ghost" onClick={clearList}>
                  {t.clear}
                </button>
              </div>
            )}
          </div>
          {shoppingList.length === 0 ? (
            <p className="empty">{t.emptyList}</p>
          ) : (
            <>
              <p className="hint">{t.remindersHint}</p>
              {shareStatus && <p className="banner">{shareStatus}</p>}
              <ul className="shop-list">
                {shoppingList.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="meta">
                        ×{item.quantity} · {formatPrice(item.price)}
                        {item.is_bonus ? ` · ${item.bonus_label ?? "Bonus"}` : ""}
                      </p>
                    </div>
                    <button className="delete" onClick={() => removeItem(item.id)} aria-label={t.remove}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <p className="total">
                {t.total}: {formatPrice(listTotal)}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
