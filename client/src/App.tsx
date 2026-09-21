import { useEffect, useMemo, useState } from "react";

type DietTag = "vegetarian" | "vegan" | "halal";

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

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  return `€${price.toFixed(2)}`;
}

export default function App() {
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
      setError("Select at least one product / Selecteer minstens één product");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear list");
    }
  }

  const listTotal = useMemo(
    () => shoppingList.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
    [shoppingList],
  );

  return (
    <main className="app">
      <header className="hero">
        <p className="brand">PlateWise</p>
        <h1>Diet planner / Dieetplanner</h1>
        <p className="subtitle">
          Prefs → recipe → Albert Heijn products (bonus first) → shopping list
          {" · "}
          Voorkeuren → recept → AH-producten (bonus eerst) → boodschappenlijst
        </p>
      </header>

      <nav className="tabs" aria-label="Views / Weergaven">
        <button className={view === "recipes" ? "active" : ""} onClick={() => setView("recipes")}>
          Recipes / Recepten
        </button>
        <button
          className={view === "match" ? "active" : ""}
          onClick={() => selectedRecipe && setView("match")}
          disabled={!selectedRecipe}
        >
          Match
        </button>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
          List / Lijst ({shoppingList.length})
        </button>
      </nav>

      <section className="prefs" aria-label="Dietary preferences / Dieetvoorkeuren">
        <h2>Preferences / Voorkeuren</h2>
        <div className="pref-toggles">
          {(
            [
              ["vegetarian", "Vegetarian / Vegetarisch"],
              ["vegan", "Vegan"],
              ["halal", "Halal"],
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
        <p className="hint">
          Recipes are filtered by store tags — not medical/religious advice.
          {" "}
          Recepten worden gefilterd op store-tags; geen medische/religieuze garantie.
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading… / Laden…</p>
      ) : view === "recipes" ? (
        <section>
          <h2>Recipes / Recepten ({recipes.length})</h2>
          {recipes.length === 0 ? (
            <p className="empty">
              No recipes for these prefs — turn a filter off.
              {" "}
              Geen recepten voor deze voorkeuren. Zet een filter uit.
            </p>
          ) : (
            <ul className="recipe-list">
              {recipes.map((recipe) => (
                <li key={recipe.id}>
                  <div>
                    <h3>{recipe.title}</h3>
                    <p>{recipe.summary}</p>
                    <p className="meta">
                      {recipe.timeMinutes} min · {recipe.servings} servings / pers ·{" "}
                      {recipe.dietTags.join(", ")}
                    </p>
                  </div>
                  <button disabled={matching} onClick={() => matchRecipe(recipe)}>
                    {matching && selectedRecipe?.id === recipe.id
                      ? "Matching… / Matchen…"
                      : "Add via AH / Voeg toe via AH"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : view === "match" && selectedRecipe ? (
        <section>
          <h2>Match: {selectedRecipe.title}</h2>
          {usedMock && (
            <p className="banner">
              AH API unreachable — using mock products (demo still works).
              {" "}
              AH API onbereikbaar — mock producten gebruikt (demo blijft werken).
            </p>
          )}
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
                    <p className="empty">No product found / Geen product gevonden</p>
                  )}
                </li>
              );
            })}
          </ul>
          <button className="primary" disabled={adding} onClick={addSelectedToList}>
            {adding
              ? "Adding… / Toevoegen…"
              : "Add selected to list / Geselecteerde producten naar lijst"}
          </button>
        </section>
      ) : (
        <section>
          <div className="list-header">
            <h2>Shopping list / Boodschappenlijst</h2>
            {shoppingList.length > 0 && (
              <button className="ghost" onClick={clearList}>
                Clear / Leegmaken
              </button>
            )}
          </div>
          {shoppingList.length === 0 ? (
            <p className="empty">
              List is empty. Match a recipe to start.
              {" "}
              Lijst is leeg. Match een recept om te beginnen.
            </p>
          ) : (
            <>
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
                    <button
                      className="delete"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove / Verwijderen"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <p className="total">
                Estimated total / Geschat totaal: {formatPrice(listTotal)}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
