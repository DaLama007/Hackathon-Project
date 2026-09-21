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
    brandEyebrow: "Farm-fresh planning",
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
    brandEyebrow: "Vers van de boer",
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

/** Cartoon plate + sprout mark for the brand lockup. */
function PlateWiseLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <radialGradient id="pwPlateShine" cx="32%" cy="28%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f4faf6" />
          <stop offset="100%" stopColor="#d7ebe0" />
        </radialGradient>
        <linearGradient id="pwLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7adf9a" />
          <stop offset="100%" stopColor="#1f8a5b" />
        </linearGradient>
        <linearGradient id="pwCarrot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#f07820" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="38" r="26" fill="#2f9a66" />
      <circle cx="36" cy="38" r="22" fill="url(#pwPlateShine)" stroke="#1f8a5b" strokeWidth="2.2" />
      <ellipse cx="36" cy="40" rx="14" ry="9" fill="#e7f6ee" stroke="#9dceb4" strokeWidth="1.4" />
      <path
        d="M36 18c1.2 4.2 1.5 8.2 0 13.2-1.5-5-1.2-9 0-13.2z"
        fill="url(#pwLeaf)"
      />
      <path
        d="M36 20c4.8 2.2 8.2 1.6 10.8-1.2-3.8.6-7.4-.4-10.8 1.2z"
        fill="#5ecf8e"
      />
      <path
        d="M36 20c-4.8 2.2-8.2 1.6-10.8-1.2 3.8.6 7.4-.4 10.8 1.2z"
        fill="#3db87a"
      />
      <path d="M44 34l6 14c.4 1-.2 1.8-1.2 1.8h-1.4c-.8 0-1.3-.5-1.5-1.2L42 34.4z" fill="url(#pwCarrot)" />
      <path d="M44 34c2.2-.2 3.6-1.4 4.2-3.2-1.6.8-3 .6-4.2 3.2z" fill="#3db87a" />
      <circle cx="28" cy="36" r="3.2" fill="#ff6b6b" />
      <circle cx="27.2" cy="35.2" r="1" fill="#ffc9c9" />
    </svg>
  );
}

function FarmBackdrop() {
  return (
    <div className="farm-backdrop" aria-hidden="true">
      <div className="farm-sky" />
      <div className="farm-sun" />
      <div className="farm-cloud farm-cloud-a" />
      <div className="farm-cloud farm-cloud-b" />
      <div className="farm-cloud farm-cloud-c" />
      <svg className="farm-scene" viewBox="0 0 800 420" preserveAspectRatio="xMidYMax slice">
        <path
          className="farm-hill farm-hill-back"
          d="M0 260 C120 210 220 230 340 250 C480 275 560 200 800 230 L800 420 L0 420 Z"
        />
        <path
          className="farm-hill farm-hill-mid"
          d="M0 300 C140 250 260 280 400 295 C560 315 650 255 800 285 L800 420 L0 420 Z"
        />
        <path
          className="farm-hill farm-hill-front"
          d="M0 345 C180 310 300 335 460 340 C620 346 700 315 800 330 L800 420 L0 420 Z"
        />
        {/* Cartoon barn */}
        <g className="farm-barn" transform="translate(590 238)">
          <rect x="18" y="36" width="88" height="70" rx="4" fill="#e4574d" />
          <path d="M12 40 L62 4 L112 40 Z" fill="#c73f38" />
          <rect x="48" y="58" width="28" height="48" rx="3" fill="#ffe8a3" />
          <rect x="28" y="48" width="18" height="16" rx="2" fill="#7ec8e3" />
          <rect x="78" y="48" width="18" height="16" rx="2" fill="#7ec8e3" />
          <rect x="8" y="100" width="108" height="10" rx="2" fill="#8b5a2b" />
        </g>
        {/* Fence posts */}
        <g className="farm-fence" fill="none" stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round">
          <path d="M40 360 V318 M70 360 V318 M100 360 V318 M130 360 V318 M160 360 V318" />
          <path d="M36 328 H164 M36 348 H164" />
        </g>
        {/* Cartoon crops */}
        <g className="farm-crops">
          <ellipse cx="220" cy="352" rx="10" ry="16" fill="#4caf50" />
          <ellipse cx="246" cy="348" rx="11" ry="18" fill="#66bb6a" />
          <ellipse cx="272" cy="354" rx="9" ry="15" fill="#43a047" />
          <ellipse cx="300" cy="350" rx="12" ry="19" fill="#57b85d" />
          <rect x="216" y="360" width="90" height="8" rx="3" fill="#7a5a2b" opacity="0.35" />
        </g>
        {/* Path */}
        <path
          d="M310 420 C360 380 420 370 480 360 C540 350 580 355 640 420"
          fill="#e6d2a0"
          opacity="0.85"
        />
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
    <main className="app">
      <FarmBackdrop />
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
  );
}

/*
 * Smoke checklist (frontend-ui):
 * 1. npm run dev → open app at phone width + ~720px; PlateWise brand reads first, liquid-glass meadow atmosphere.
 * 2. Toggle EN/NL; prefs chips update recipes; empty state if filters too strict.
 * 3. Recipe card → Match at AH → swap/uncheck products (thumbnails when present) → Add selected.
 * 4. List shows items + total; Reminders share/copy; Clear empties list.
 */
