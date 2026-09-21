import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ingredientName,
  ingredientUnit,
  recipeSummary,
  recipeTitle,
  type Lang,
} from "./recipeI18n";

type DietTag = "vegetarian" | "vegan" | "halal";
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
  image_url?: string | null;
}

type View = "offers" | "recipes" | "match" | "list";

const emptyPrefs: UserPrefs = { vegetarian: false, vegan: false, halal: false };
const LANG_KEY = "platewise-lang";
const FILTERS: CatalogFilter[] = ["all", "bonus", "bio", "cheap", "storeBrand"];

const copy = {
  en: {
    brandEyebrow: "Healthy eating, planned",
    title: "Eat well. Shop smart.",
    subtitle: "Offers ↔ recipes, match AH products (bonus first), or add a single item to your list.",
    offers: "Offers",
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
    emptyList: "List is empty. Match a recipe or add an item.",
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
    brandEyebrow: "Gezond eten, gepland",
    title: "Eet goed. Koop slim.",
    subtitle: "Aanbiedingen ↔ recepten, match AH-producten (bonus eerst), of voeg één artikel toe.",
    offers: "Aanbiedingen",
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
    emptyList: "Lijst is leeg. Match een recept of voeg een artikel toe.",
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

/** Anthropic-inspired geometric mark: concentric dinner plate. */
function PlateWiseLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#16382c" />
      <g
        transform="translate(20 20)"
        fill="none"
        stroke="#f4faf6"
        strokeLinecap="round"
      >
        {/* Outer edge + rim band + inner well = dinner plate */}
        <circle r="14" strokeWidth="1.5" />
        <circle r="11.15" strokeWidth="1.05" opacity="0.72" />
        <circle r="7" strokeWidth="1.65" />
        <circle r="7" fill="#f4faf6" fillOpacity="0.1" stroke="none" />
        <circle r="1.35" fill="#f4faf6" stroke="none" />
        {/* Short rim ticks — plate accent, not a spark/asterisk */}
        <g strokeWidth="1.25" opacity="0.9">
          <path d="M0 -13.85v2.1" />
          <path d="M0 11.75v2.1" />
          <path d="M-13.85 0h2.1" />
          <path d="M11.75 0h2.1" />
        </g>
      </g>
    </svg>
  );
}

/** Calm wellness / botanical backdrop — spa greens & soft blues, no farmyard cues. */
function WellnessBackdrop() {
  return (
    <div className="wellness-backdrop" aria-hidden="true">
      <div className="wellness-sky" />
      <div className="wellness-mist wellness-mist-top" />
      <div className="wellness-glow wellness-glow-a" />
      <div className="wellness-glow wellness-glow-b" />
      <div className="wellness-glow wellness-glow-c" />
      <svg className="wellness-scene" viewBox="0 0 800 420" preserveAspectRatio="xMidYMax slice">
        <ellipse className="wellness-wash wellness-wash-back" cx="400" cy="400" rx="520" ry="120" />
        <ellipse className="wellness-wash wellness-wash-front" cx="400" cy="430" rx="480" ry="90" />
        <g className="wellness-botanicals">
          <g className="wellness-leaf-cluster wellness-leaf-left" fill="#2a7a5c" opacity="0.38">
            <path d="M90 360 C70 300 95 250 130 220 C145 280 140 330 90 360 Z" />
            <path d="M130 360 C115 295 145 245 185 215 C190 285 175 335 130 360 Z" />
            <path d="M155 365 C150 310 175 265 215 240 C210 305 190 345 155 365 Z" />
            <path
              d="M112 250 C118 280 125 310 120 340"
              fill="none"
              stroke="#1a5c42"
              strokeWidth="2.5"
              opacity="0.5"
            />
          </g>
          <g className="wellness-leaf-cluster wellness-leaf-right" fill="#2f8a68" opacity="0.34">
            <path d="M710 355 C730 295 705 245 670 215 C655 275 660 325 710 355 Z" />
            <path d="M670 358 C685 290 655 240 615 212 C610 285 625 335 670 358 Z" />
            <path d="M645 365 C650 310 625 265 585 242 C590 305 610 345 645 365 Z" />
            <path
              d="M688 245 C682 275 675 305 680 338"
              fill="none"
              stroke="#1a5c42"
              strokeWidth="2.5"
              opacity="0.45"
            />
          </g>
          <g className="wellness-fronds" fill="none" stroke="#3a9a72" strokeWidth="2" opacity="0.28">
            <path d="M320 420 C310 360 280 320 250 290" />
            <path d="M340 420 C345 355 360 310 390 275" />
            <path d="M460 420 C455 355 440 310 410 275" />
            <path d="M480 420 C490 360 520 320 550 290" />
          </g>
        </g>
      </svg>
    </div>
  );
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

  // Smoke: EN → English recipe/ingredient labels; List + Reminders keep Dutch AH titles.
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

  const selectedCount = useMemo(
    () => matches.filter((row) => included[row.ingredient.searchTerm]).length,
    [matches, included],
  );

  return (
    <>
      {/* Outside .app so fixed positioning isn't trapped by the rise-in transform. */}
      <WellnessBackdrop />
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
        <button type="button" className={view === "offers" ? "active" : ""} onClick={() => setView("offers")}>
          {t.offers}
        </button>
        <button type="button" className={view === "recipes" ? "active" : ""} onClick={() => setView("recipes")}>
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
        <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
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
      ) : view === "offers" ? (
        <section>
          <div className="view-header">
            <h2>{t.offers}</h2>
            <span className="view-count">{offers.length}</span>
          </div>
          <p className="hint">{t.offersHint}</p>
          {offersMock && <p className="banner">{t.mockBanner}</p>}
          {offers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                {t.emptyIcon}
              </div>
              <p>{t.noOffers}</p>
            </div>
          ) : (
            <ul className="offer-list">
              {offers.map((offer) => (
                <li key={offer.product.id} className="recipe-card">
                  <div className="recipe-body">
                    <h3>{offer.product.title}</h3>
                    <p className="meta">{formatPrice(offer.product.price)}</p>
                    <div className="badge-row">{renderBadges(offer.product)}</div>
                    {offer.recipes.length > 0 ? (
                      <div className="offer-recipes">
                        <p className="hint">{t.usesThis}</p>
                        {offer.recipes.map((recipe) => (
                          <button
                            key={recipe.id}
                            type="button"
                            className="btn btn-primary btn-block"
                            disabled={matching}
                            onClick={() => cookOffer(offer, recipe)}
                          >
                            {matching && selectedRecipe?.id === recipe.id
                              ? t.matching
                              : `${t.cookThis}: ${recipeTitle(recipe.id, recipe.title, lang)}`}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">{t.noRecipes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
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
                    <h3>{recipeTitle(recipe.id, recipe.title, lang)}</h3>
                    <p className="recipe-summary">{recipeSummary(recipe.id, recipe.summary, lang)}</p>
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
              {t.match}: {recipeTitle(selectedRecipe.id, selectedRecipe.title, lang)}
            </h2>
            <span className="view-count">
              {selectedCount}/{matches.length}
            </span>
          </div>
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
              const selected =
                options.find((product) => product.id === selectedProducts[key]?.id) ?? options[0];
              return (
                <li key={key} className="match-card">
                  <label className="match-head">
                    <input
                      type="checkbox"
                      checked={Boolean(included[key]) && Boolean(selected)}
                      onChange={(e) =>
                        setIncluded((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    <span>
                      {ingredientName(row.ingredient.name, lang)}{" "}
                      <span className="meta">
                        ({row.ingredient.quantity}{" "}
                        {ingredientUnit(row.ingredient.unit, lang)})
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
                          aria-label={`${t.productFor} ${ingredientName(row.ingredient.name, lang)}`}
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
                    </div>
                  ) : (
                    <p className="hint" style={{ paddingLeft: "1.75rem", marginTop: "0.5rem" }}>
                      {options.length === 0 ? t.noFilterMatch : t.noProduct}
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
          <h3>{t.addItem}</h3>
          {renderFilterChips(itemFilter, setItemFilter, t.addItem)}
          <form className="item-search" onSubmit={searchCatalogItems}>
            <input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.addItem}
            />
            <button type="submit" className="btn btn-primary" disabled={itemSearching}>
              {itemSearching ? t.searching : t.search}
            </button>
          </form>
          {itemMessage && <p className="banner">{itemMessage}</p>}
          {itemResults.length > 0 && (
            <ul className="suggest-list">
              {itemResults.map((product) => (
                <li key={product.id} className="shop-card">
                  <div className="shop-main">
                    <ProductThumb
                      imageUrl={product.imageUrl}
                      label={product.title}
                      fallback={t.ah}
                    />
                    <div>
                      <strong>{product.title}</strong>
                      <p className="meta">{formatPrice(product.price)}</p>
                      <div className="badge-row">{renderBadges(product)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={adding}
                    onClick={() => addCatalogItem(product)}
                  >
                    {t.add}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
              {/* Shopping list always keeps original AH/Dutch product titles for store lookup / Reminders. */}
              <ul className="shop-list">
                {shoppingList.map((item) => (
                  <li key={item.id} className="shop-card">
                    <div className="shop-main">
                      <ProductThumb
                        imageUrl={item.image_url ?? null}
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

// Smoke: Offers → pick bonus → Cook this → remaining ingredients match.
// Smoke: Recipe → Match → Bio/Cheap chips change alternatives → add to list.
// Smoke: List → search a Dutch term → Add (no recipe) → item appears.
/*
 * Smoke checklist (frontend-ui):
 * 1. npm run dev → open app at phone width + ~720px; geometric plate logo + wellness backdrop; liquid-glass panels readable.
 * 2. Toggle EN/NL; prefs chips update recipes; empty state if filters too strict.
 * 3. Recipe card → Match at AH → swap/uncheck products (thumbnails when present) → Add selected.
 * 4. List shows items + total; Reminders share/copy; Clear empties list.
 */
