import { useEffect, useMemo, useState, type FormEvent } from "react";

type DietTag = "vegetarian" | "vegan" | "halal";
type Lang = "en" | "nl";
type CatalogFilter = "all" | "bonus" | "bio" | "cheap" | "storeBrand";

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
  isBio?: boolean;
  imageUrl: string | null;
  source: "ah" | "mock";
}

interface MatchRow {
  ingredient: Ingredient;
  product: Product | null;
  alternatives: Product[];
  products?: Product[];
  usedMock: boolean;
}

interface OfferRecipe {
  id: string;
  title: string;
  summary: string;
  matchedIngredient: string;
}

interface Offer {
  product: Product;
  recipes: OfferRecipe[];
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

type View = "offers" | "recipes" | "match" | "list";

const emptyPrefs: UserPrefs = { vegetarian: false, vegan: false, halal: false };
const LANG_KEY = "platewise-lang";
const FILTERS: CatalogFilter[] = ["all", "bonus", "bio", "cheap", "storeBrand"];

const copy = {
  en: {
    title: "Diet planner",
    subtitle: "Offers ↔ recipes, or add a single AH item, then shopping list",
    offers: "Offers",
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
    emptyList: "List is empty. Match a recipe or add an item.",
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
    offersHint: "Bonus items first. Pick one and open a recipe that uses it.",
    noOffers: "No bonus offers right now — try mock mode or another pref.",
    usesThis: "Uses this",
    cookThis: "Cook this",
    fromOffer: "Starting from bonus",
    filterAll: "All",
    filterBonus: "Bonus",
    filterBio: "Organic",
    filterCheap: "Cheap",
    filterStoreBrand: "AH brand",
    noFilterMatch: "No product for this filter",
    addItem: "Add item",
    searchPlaceholder: "e.g. spinazie, tofu…",
    search: "Search",
    add: "Add",
    searching: "Searching…",
    noItemResults: "No products for that search.",
    itemAdded: "Added to list",
  },
  nl: {
    title: "Dieetplanner",
    subtitle: "Aanbiedingen ↔ recepten, of één AH-artikel, daarna boodschappenlijst",
    offers: "Aanbiedingen",
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
    emptyList: "Lijst is leeg. Match een recept of voeg een artikel toe.",
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
    offersHint: "Bonus eerst. Kies een item en open een recept dat het gebruikt.",
    noOffers: "Geen bonusaanbiedingen — probeer mock of andere voorkeuren.",
    usesThis: "Gebruikt dit",
    cookThis: "Kook dit",
    fromOffer: "Start vanaf bonus",
    filterAll: "Alles",
    filterBonus: "Bonus",
    filterBio: "Bio",
    filterCheap: "Goedkoop",
    filterStoreBrand: "Huismerk",
    noFilterMatch: "Geen product voor dit filter",
    addItem: "Artikel toevoegen",
    searchPlaceholder: "bijv. spinazie, tofu…",
    search: "Zoeken",
    add: "Voeg toe",
    searching: "Zoeken…",
    noItemResults: "Geen producten voor deze zoekterm.",
    itemAdded: "Toegevoegd aan lijst",
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

function isBioProduct(product: Product): boolean {
  if (typeof product.isBio === "boolean") return product.isBio;
  const lower = product.title.toLowerCase();
  return lower.includes("biologisch") || lower.includes("organic") || /(^|\s)bio(\s|$|-)/.test(lower);
}

function rowProducts(row: MatchRow): Product[] {
  if (row.products?.length) return row.products;
  return [row.product, ...row.alternatives].filter(Boolean) as Product[];
}

function applyFilter(products: Product[], filter: CatalogFilter): Product[] {
  if (filter === "all") return products;
  if (filter === "bonus") return products.filter((product) => product.isBonus);
  if (filter === "bio") return products.filter(isBioProduct);
  if (filter === "storeBrand") return products.filter((product) => /^AH\s/i.test(product.title));
  const priced = products.filter((product) => product.price != null);
  if (priced.length === 0) return [];
  const min = Math.min(...priced.map((product) => product.price as number));
  return products.filter((product) => product.price != null && product.price <= min + 0.4);
}

function productMatchesIngredient(product: Product, ingredient: Ingredient): boolean {
  const title = product.title.toLowerCase();
  const needles = [ingredient.searchTerm, ingredient.name].map((value) => value.toLowerCase());
  return needles.some((needle) => title.includes(needle));
}

function pickPreferred(
  rows: MatchRow[],
  preferred: Product | undefined,
): Record<string, Product> {
  const products: Record<string, Product> = {};
  for (const row of rows) {
    const key = row.ingredient.searchTerm;
    const options = rowProducts(row);
    const fromOffer =
      preferred &&
      (options.find((product) => product.id === preferred.id) ||
        (productMatchesIngredient(preferred, row.ingredient) ? preferred : null));
    if (fromOffer) products[key] = fromOffer;
    else if (row.product) products[key] = row.product;
  }
  return products;
}

function productToListItem(product: Product, extras: { searchTerm?: string; recipeId?: string | null }) {
  return {
    productId: product.id,
    title: product.title,
    price: product.price,
    isBonus: product.isBonus,
    bonusLabel: product.bonusLabel,
    quantity: 1,
    searchTerm: extras.searchTerm ?? null,
    recipeId: extras.recipeId ?? null,
  };
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => readStoredLang());
  const t = copy[lang];

  const [view, setView] = useState<View>("recipes");
  const [prefs, setPrefs] = useState<UserPrefs>(emptyPrefs);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersMock, setOffersMock] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [pinnedOffer, setPinnedOffer] = useState<Product | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Product>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [matchFilter, setMatchFilter] = useState<CatalogFilter>("all");
  const [usedMock, setUsedMock] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [itemQuery, setItemQuery] = useState("");
  const [itemFilter, setItemFilter] = useState<CatalogFilter>("all");
  const [itemResults, setItemResults] = useState<Product[]>([]);
  const [itemSearching, setItemSearching] = useState(false);
  const [itemMessage, setItemMessage] = useState<string | null>(null);

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

  async function loadOffers() {
    const res = await fetch("/api/offers");
    if (!res.ok) throw new Error(`GET /api/offers failed: ${res.status}`);
    const data = await res.json();
    setOffers(Array.isArray(data.offers) ? data.offers : []);
    setOffersMock(Boolean(data.usedMock));
  }

  async function loadShoppingList() {
    const res = await fetch("/api/shopping-list");
    if (!res.ok) throw new Error(`GET /api/shopping-list failed: ${res.status}`);
    setShoppingList(await res.json());
  }

  async function bootstrap() {
    try {
      setLoading(true);
      await Promise.all([loadPrefs(), loadRecipes(), loadShoppingList(), loadOffers()]);
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

  useEffect(() => {
    if (matches.length === 0) return;
    setSelectedProducts((prev) => {
      const next = { ...prev };
      for (const row of matches) {
        const key = row.ingredient.searchTerm;
        const options = applyFilter(rowProducts(row), matchFilter);
        if (options.length === 0) continue;
        const current = prev[key];
        if (!current || !options.some((product) => product.id === current.id)) {
          next[key] = options[0];
        }
      }
      return next;
    });
  }, [matchFilter, matches]);

  useEffect(() => {
    if (!itemQuery.trim()) return;
    void searchCatalogItems();
    // Re-run catalog search when the list-tab filter chip changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemFilter]);

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
      await Promise.all([loadRecipes(), loadOffers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prefs");
    }
  }

  async function resolveRecipe(id: string): Promise<Recipe | null> {
    const local = recipes.find((recipe) => recipe.id === id);
    if (local) return local;
    const res = await fetch(`/api/recipes/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as Recipe;
  }

  async function matchRecipe(recipe: Recipe, preferredProduct?: Product) {
    setSelectedRecipe(recipe);
    setPinnedOffer(preferredProduct ?? null);
    setMatchFilter("all");
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
      const products = pickPreferred(rows, preferredProduct);
      const includedMap: Record<string, boolean> = {};
      for (const row of rows) {
        includedMap[row.ingredient.searchTerm] = Boolean(products[row.ingredient.searchTerm]);
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

  async function cookOffer(offer: Offer, offerRecipe: OfferRecipe) {
    const recipe = await resolveRecipe(offerRecipe.id);
    if (!recipe) {
      setError("recipe not found");
      return;
    }
    await matchRecipe(recipe, offer.product);
  }

  function swapProduct(searchTerm: string, productId: string, row: MatchRow) {
    const found = applyFilter(rowProducts(row), matchFilter).find((product) => product.id === productId);
    if (found) {
      setSelectedProducts((prev) => ({ ...prev, [searchTerm]: found }));
    }
  }

  async function postListItems(items: ReturnType<typeof productToListItem>[]) {
    const res = await fetch("/api/shopping-list/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`Add to list failed: ${res.status}`);
    await loadShoppingList();
  }

  async function addSelectedToList() {
    if (!selectedRecipe) return;
    const items = matches
      .filter((row) => {
        const key = row.ingredient.searchTerm;
        const product = selectedProducts[key];
        if (!included[key] || !product) return false;
        return applyFilter(rowProducts(row), matchFilter).some((option) => option.id === product.id);
      })
      .map((row) =>
        productToListItem(selectedProducts[row.ingredient.searchTerm], {
          searchTerm: row.ingredient.searchTerm,
          recipeId: selectedRecipe.id,
        }),
      );

    if (items.length === 0) {
      setError(t.selectOne);
      return;
    }

    setAdding(true);
    try {
      await postListItems(items);
      setView("list");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add items");
    } finally {
      setAdding(false);
    }
  }

  async function searchCatalogItems(event?: FormEvent) {
    event?.preventDefault();
    const query = itemQuery.trim();
    if (!query) return;
    setItemSearching(true);
    setItemMessage(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/products/suggest?q=${encodeURIComponent(query)}&filter=${itemFilter}`,
      );
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      const products = Array.isArray(data.products) ? (data.products as Product[]) : [];
      setItemResults(products);
      if (products.length === 0) setItemMessage(t.noItemResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search products");
    } finally {
      setItemSearching(false);
    }
  }

  async function addCatalogItem(product: Product) {
    setAdding(true);
    try {
      await postListItems([productToListItem(product, { searchTerm: itemQuery.trim() || product.title })]);
      setItemMessage(t.itemAdded);
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

  const filterLabel: Record<CatalogFilter, string> = {
    all: t.filterAll,
    bonus: t.filterBonus,
    bio: t.filterBio,
    cheap: t.filterCheap,
    storeBrand: t.filterStoreBrand,
  };

  function renderFilterChips(
    value: CatalogFilter,
    onChange: (next: CatalogFilter) => void,
    ariaLabel: string,
  ) {
    return (
      <div className="chips" role="group" aria-label={ariaLabel}>
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={value === filter ? "chip active" : "chip"}
            onClick={() => onChange(filter)}
            aria-pressed={value === filter}
          >
            {filterLabel[filter]}
          </button>
        ))}
      </div>
    );
  }

  function renderBadges(product: Product) {
    return (
      <>
        {product.isBonus && <span className="bonus">{product.bonusLabel ?? "Bonus"}</span>}
        {isBioProduct(product) && <span className="bio">Bio</span>}
      </>
    );
  }

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
        <button className={view === "offers" ? "active" : ""} onClick={() => setView("offers")}>
          {t.offers}
        </button>
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
      ) : view === "offers" ? (
        <section>
          <h2>
            {t.offers} ({offers.length})
          </h2>
          <p className="hint">{t.offersHint}</p>
          {offersMock && <p className="banner">{t.mockBanner}</p>}
          {offers.length === 0 ? (
            <p className="empty">{t.noOffers}</p>
          ) : (
            <ul className="offer-list">
              {offers.map((offer) => (
                <li key={offer.product.id}>
                  <div>
                    <h3>{offer.product.title}</h3>
                    <p className="meta">
                      {formatPrice(offer.product.price)}
                    </p>
                    <div className="badge-row">{renderBadges(offer.product)}</div>
                    {offer.recipes.length > 0 ? (
                      <div className="offer-recipes">
                        <p className="hint">{t.usesThis}</p>
                        {offer.recipes.map((recipe) => (
                          <button
                            key={recipe.id}
                            type="button"
                            disabled={matching}
                            onClick={() => cookOffer(offer, recipe)}
                          >
                            {matching && selectedRecipe?.id === recipe.id
                              ? t.matching
                              : `${t.cookThis}: ${recipe.title}`}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="empty">{t.noRecipes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
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
          {pinnedOffer && (
            <p className="banner">
              {t.fromOffer}: {pinnedOffer.title}
            </p>
          )}
          {usedMock && <p className="banner">{t.mockBanner}</p>}
          {renderFilterChips(matchFilter, setMatchFilter, t.filterAll)}
          <ul className="match-list">
            {matches.map((row) => {
              const key = row.ingredient.searchTerm;
              const options = applyFilter(rowProducts(row), matchFilter);
              const selected = options.find((product) => product.id === selectedProducts[key]?.id) ?? options[0];
              return (
                <li key={key}>
                  <label className="match-head">
                    <input
                      type="checkbox"
                      checked={Boolean(included[key]) && Boolean(selected)}
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
                            {isBioProduct(product) ? " · BIO" : ""}
                          </option>
                        ))}
                      </select>
                      <div className="badge-row">{renderBadges(selected)}</div>
                    </div>
                  ) : (
                    <p className="empty">{options.length === 0 ? t.noFilterMatch : t.noProduct}</p>
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
          <h3>{t.addItem}</h3>
          {renderFilterChips(itemFilter, setItemFilter, t.addItem)}
          <form className="item-search" onSubmit={searchCatalogItems}>
            <input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.addItem}
            />
            <button type="submit" disabled={itemSearching}>
              {itemSearching ? t.searching : t.search}
            </button>
          </form>
          {itemMessage && <p className="banner">{itemMessage}</p>}
          {itemResults.length > 0 && (
            <ul className="suggest-list">
              {itemResults.map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>{product.title}</strong>
                    <p className="meta">{formatPrice(product.price)}</p>
                    <div className="badge-row">{renderBadges(product)}</div>
                  </div>
                  <button type="button" disabled={adding} onClick={() => addCatalogItem(product)}>
                    {t.add}
                  </button>
                </li>
              ))}
            </ul>
          )}
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

// Smoke: Offers → pick bonus → Cook this → remaining ingredients match.
// Smoke: Recipe → Match → Bio/Cheap chips change alternatives → add to list.
// Smoke: List → search a Dutch term → Add (no recipe) → item appears.
