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
  image_url?: string | null;
}

type View = "recipes" | "match" | "list";

const emptyPrefs: UserPrefs = { vegetarian: false, vegan: false, halal: false };
const LANG_KEY = "platewise-lang";

const copy = {
  en: {
    brandEyebrow: "Healthy eating, planned",
    title: "Eat well. Shop smart.",
    subtitle: "Pick a recipe, match Albert Heijn products (bonus first), fill your list.",
    recipes: "Recipes",
    match: "Match",
    list: "List",
    prefs: "Diet preferences",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    halal: "Halal",
    hint: "Recipes are filtered by store tags — not medical or religious advice.",
    loading: "Gathering fresh recipes…",
    noRecipes: "No recipes for these prefs — turn a filter off.",
    servings: "servings",
    minutes: "min",
    matching: "Matching…",
    addViaAh: "Match at AH",
    mockBanner: "AH API unreachable — using mock products (demo still works).",
    noProduct: "No product found",
    adding: "Adding…",
    addSelected: "Add selected to list",
    shoppingList: "Shopping list",
    clear: "Clear",
    emptyList: "Your basket is empty. Match a recipe to start.",
    emptyIcon: "◇",
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
    viewsAria: "Views",
    productFor: "Product for",
    recipeCount: "fresh picks",
    ah: "AH",
  },
  nl: {
    brandEyebrow: "Gezond eten, gepland",
    title: "Eet goed. Koop slim.",
    subtitle: "Kies een recept, match AH-producten (bonus eerst), vul je lijst.",
    recipes: "Recepten",
    match: "Match",
    list: "Lijst",
    prefs: "Dieetvoorkeuren",
    vegetarian: "Vegetarisch",
    vegan: "Vegan",
    halal: "Halal",
    hint: "Recepten worden gefilterd op store-tags; geen medische of religieuze garantie.",
    loading: "Verse recepten laden…",
    noRecipes: "Geen recepten voor deze voorkeuren. Zet een filter uit.",
    servings: "pers",
    minutes: "min",
    matching: "Matchen…",
    addViaAh: "Match bij AH",
    mockBanner: "AH API onbereikbaar — mock producten gebruikt (demo blijft werken).",
    noProduct: "Geen product gevonden",
    adding: "Toevoegen…",
    addSelected: "Geselecteerde producten naar lijst",
    shoppingList: "Boodschappenlijst",
    clear: "Leegmaken",
    emptyList: "Je mandje is leeg. Match een recept om te beginnen.",
    emptyIcon: "◇",
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
    viewsAria: "Weergaven",
    productFor: "Product voor",
    recipeCount: "verse keuzes",
    ah: "AH",
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

function primaryDiet(tags: DietTag[]): DietTag | "any" {
  if (tags.includes("vegan")) return "vegan";
  if (tags.includes("vegetarian")) return "vegetarian";
  if (tags.includes("halal")) return "halal";
  return "any";
}

function ProductThumb({
  imageUrl,
  label,
  fallback,
}: {
  imageUrl: string | null | undefined;
  label: string;
  fallback: string;
}) {
  if (imageUrl) {
    return <img className="product-thumb" src={imageUrl} alt={label} loading="lazy" />;
  }
  return (
    <div className="product-thumb-fallback" aria-hidden="true">
      {fallback}
    </div>
  );
}

/** Anthropic-inspired geometric mark: radial spark + plate core. */
function PlateWiseLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#16382c" />
      <g transform="translate(20 20)" fill="#f4faf6">
        <ellipse rx="2.6" ry="12.2" />
        <ellipse rx="2.6" ry="12.2" transform="rotate(45)" />
        <ellipse rx="2.6" ry="12.2" transform="rotate(90)" />
        <ellipse rx="2.6" ry="12.2" transform="rotate(135)" />
        <circle r="5.4" fill="#16382c" />
        <circle r="3.2" fill="none" stroke="#f4faf6" strokeWidth="1.6" />
        <circle r="1.15" fill="#f4faf6" />
      </g>
    </svg>
  );
}

/** Soft wellness / botanical backdrop (health-oriented, not cartoon farmyard). */
function FarmBackdrop() {
  return (
    <div className="farm-backdrop" aria-hidden="true">
      <div className="farm-sky" />
      <div className="health-glow health-glow-a" />
      <div className="health-glow health-glow-b" />
      <svg className="farm-scene" viewBox="0 0 800 420" preserveAspectRatio="xMidYMax slice">
        <path
          className="farm-hill farm-hill-back"
          d="M0 250 C160 200 280 220 420 240 C580 265 680 210 800 235 L800 420 L0 420 Z"
        />
        <path
          className="farm-hill farm-hill-mid"
          d="M0 295 C150 255 290 275 450 290 C600 305 700 270 800 288 L800 420 L0 420 Z"
        />
        <path
          className="farm-hill farm-hill-front"
          d="M0 340 C200 315 340 330 500 338 C640 345 720 325 800 335 L800 420 L0 420 Z"
        />
        {/* Abstract botanical leaves — wellness cue, not barn/crops */}
        <g className="health-botanicals" fill="#2f7a55" opacity="0.45">
          <path d="M120 310 C150 250 190 250 210 310 C175 295 145 295 120 310 Z" />
          <path d="M165 300 C175 270 195 270 205 300" fill="none" stroke="#1f5c3d" strokeWidth="3" />
          <path d="M680 300 C710 240 755 245 770 305 C735 288 705 288 680 300 Z" />
          <path d="M725 292 C735 260 755 262 765 292" fill="none" stroke="#1f5c3d" strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
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
  const [productImages, setProductImages] = useState<Record<string, string>>({});

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
      const images: Record<string, string> = {};
      for (const row of rows) {
        const key = row.ingredient.searchTerm;
        if (row.product) products[key] = row.product;
        includedMap[key] = Boolean(row.product);
        for (const product of [row.product, ...row.alternatives]) {
          if (product?.imageUrl) images[product.id] = product.imageUrl;
        }
      }
      setSelectedProducts(products);
      setIncluded(includedMap);
      setProductImages((prev) => ({ ...prev, ...images }));
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

  const selectedCount = useMemo(
    () => matches.filter((row) => included[row.ingredient.searchTerm]).length,
    [matches, included],
  );

  return (
    <>
      {/* Outside .app so fixed positioning isn't trapped by the rise-in transform. */}
      <FarmBackdrop />
      <main className="app">
      <header className="hero">
        <div className="hero-top">
          <div className="brand-block">
            <p className="eyebrow">{t.brandEyebrow}</p>
            <div className="brand-lockup">
              <PlateWiseLogo />
              <p className="brand">PlateWise</p>
            </div>
          </div>
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

      <nav className="tabs" aria-label={t.viewsAria}>
        <button
          type="button"
          className={view === "recipes" ? "active" : ""}
          onClick={() => setView("recipes")}
        >
          {t.recipes}
        </button>
        <button
          type="button"
          className={view === "match" ? "active" : ""}
          onClick={() => selectedRecipe && setView("match")}
          disabled={!selectedRecipe}
        >
          {t.match}
        </button>
        <button
          type="button"
          className={view === "list" ? "active" : ""}
          onClick={() => setView("list")}
        >
          {t.list}
          {shoppingList.length > 0 && <span className="tab-count">({shoppingList.length})</span>}
        </button>
      </nav>

      <section className="prefs" aria-label={t.prefs}>
        <p className="section-label">{t.prefs}</p>
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

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="loading-block" aria-busy="true" aria-label={t.loading}>
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton short" />
          <p className="hint" style={{ textAlign: "center", marginTop: "0.25rem" }}>
            {t.loading}
          </p>
        </div>
      ) : view === "recipes" ? (
        <section>
          <div className="view-header">
            <h2>{t.recipes}</h2>
            <span className="view-count">
              {recipes.length} {t.recipeCount}
            </span>
          </div>
          {recipes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                {t.emptyIcon}
              </div>
              <p>{t.noRecipes}</p>
            </div>
          ) : (
            <ul className="recipe-list">
              {recipes.map((recipe) => (
                <li key={recipe.id} className="recipe-card">
                  <div
                    className="recipe-visual"
                    data-diet={primaryDiet(recipe.dietTags)}
                    aria-hidden="true"
                  />
                  <div className="recipe-body">
                    <h3>{recipe.title}</h3>
                    <p className="recipe-summary">{recipe.summary}</p>
                    <div className="recipe-meta-row">
                      <span className="chip chip-muted">
                        {recipe.timeMinutes} {t.minutes}
                      </span>
                      <span className="chip chip-muted">
                        {recipe.servings} {t.servings}
                      </span>
                      {recipe.dietTags.map((tag) => (
                        <span key={tag} className="chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="recipe-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        disabled={matching}
                        onClick={() => matchRecipe(recipe)}
                      >
                        {matching && selectedRecipe?.id === recipe.id ? t.matching : t.addViaAh}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : view === "match" && selectedRecipe ? (
        <section>
          <div className="view-header">
            <h2>
              {t.match}: {selectedRecipe.title}
            </h2>
            <span className="view-count">
              {selectedCount}/{matches.length}
            </span>
          </div>
          {usedMock && <p className="banner">{t.mockBanner}</p>}
          <ul className="match-list">
            {matches.map((row) => {
              const key = row.ingredient.searchTerm;
              const selected = selectedProducts[key];
              const options = [row.product, ...row.alternatives].filter(Boolean) as Product[];
              return (
                <li key={key} className="match-card">
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
                      <ProductThumb
                        imageUrl={selected.imageUrl}
                        label={selected.title}
                        fallback={t.ah}
                      />
                      <div className="match-select-wrap">
                        <select
                          value={selected.id}
                          onChange={(e) => swapProduct(key, e.target.value, row)}
                          aria-label={`${t.productFor} ${row.ingredient.name}`}
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
                    </div>
                  ) : (
                    <p className="hint" style={{ paddingLeft: "1.75rem", marginTop: "0.5rem" }}>
                      {t.noProduct}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="match-sticky">
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={adding}
              onClick={addSelectedToList}
            >
              {adding ? t.adding : t.addSelected}
            </button>
          </div>
        </section>
      ) : (
        <section>
          <div className="list-header">
            <h2>{t.shoppingList}</h2>
            {shoppingList.length > 0 && (
              <div className="list-actions">
                <button type="button" className="btn btn-ghost" onClick={shareToReminders}>
                  {t.reminders}
                </button>
                <button type="button" className="btn btn-ghost" onClick={clearList}>
                  {t.clear}
                </button>
              </div>
            )}
          </div>
          {shoppingList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                {t.emptyIcon}
              </div>
              <p>{t.emptyList}</p>
            </div>
          ) : (
            <>
              <p className="hint">{t.remindersHint}</p>
              {shareStatus && <p className="banner">{shareStatus}</p>}
              <ul className="shop-list">
                {shoppingList.map((item) => (
                  <li key={item.id} className="shop-card">
                    <div className="shop-main">
                      <ProductThumb
                        imageUrl={item.image_url ?? productImages[item.product_id] ?? null}
                        label={item.title}
                        fallback={t.ah}
                      />
                      <div>
                        <strong>{item.title}</strong>
                        <p className="meta">
                          ×{item.quantity} · {formatPrice(item.price)}
                          {item.is_bonus ? ` · ${item.bonus_label ?? "Bonus"}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger-ghost"
                      onClick={() => removeItem(item.id)}
                      aria-label={t.remove}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="total-bar">
                <span className="label">{t.total}</span>
                <span className="amount">{formatPrice(listTotal)}</span>
              </div>
            </>
          )}
        </section>
      )}
    </main>
    </>
  );
}

/*
 * Smoke checklist (frontend-ui):
 * 1. npm run dev → open app at phone width + ~720px; PlateWise brand reads first, liquid-glass meadow atmosphere.
 * 2. Toggle EN/NL; prefs chips update recipes; empty state if filters too strict.
 * 3. Recipe card → Match at AH → swap/uncheck products (thumbnails when present) → Add selected.
 * 4. List shows items + total; Reminders share/copy; Clear empties list.
 */
