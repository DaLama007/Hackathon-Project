import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getCachedSearch, setCachedSearch } from "./db.js";
import type { UserPrefs } from "./recipes.js";

export interface Product {
  id: string;
  title: string;
  price: number | null;
  unitPrice: number | null;
  isBonus: boolean;
  bonusLabel: string | null;
  isBio: boolean;
  imageUrl: string | null;
  source: "ah" | "mock";
}

/** Filters already expressible from catalog fields — not extra AH query params. */
export type CatalogFilter = "all" | "bonus" | "bio" | "cheap" | "storeBrand";

type MockCatalog = Record<string, Array<Omit<Product, "source" | "isBio">>>;

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const mockCatalog = JSON.parse(
  readFileSync(resolve(dataDir, "mock-products.json"), "utf8"),
) as MockCatalog;

const AH_SEARCH_URL = "https://api.ah.nl/mobile-services/product/search/v2";
const OFFER_SEARCH_BATCH = 8;

function prefsFacetParams(prefs: UserPrefs): string {
  const filters: string[] = [];
  // AH diet property filters (unofficial). Safe to omit if API ignores them.
  if (prefs.vegan) filters.push("filters[]=sp_include_dieet_veganistisch");
  else if (prefs.vegetarian) filters.push("filters[]=sp_include_dieet_vegetarisch");
  if (prefs.halal) filters.push("filters[]=sp_include_dieet_halal");
  return filters.length ? `&${filters.join("&")}` : "";
}

export function titleLooksBio(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes("biologisch") ||
    lower.includes("organic") ||
    /(^|\s)bio(\s|$|-)/.test(lower)
  );
}

function rawLooksBio(raw: Record<string, unknown>): boolean {
  const blob = JSON.stringify(raw.properties ?? raw.diet ?? "").toLowerCase();
  return blob.includes("biologisch") || blob.includes("organic");
}

function withBioFlags(
  product: Omit<Product, "isBio">,
  extraBio = false,
): Product {
  return {
    ...product,
    isBio: extraBio || titleLooksBio(product.title),
  };
}

function scoreProduct(product: Product, searchTerm: string): number {
  let score = 0;
  if (product.isBonus) score += 100;
  if (product.isBio) score += 10;
  const tokens = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
  const title = product.title.toLowerCase();
  for (const token of tokens) {
    if (title.includes(token)) score += 20;
  }
  // Lower price wins (up to 50 points)
  if (product.price != null) {
    score += Math.max(0, 50 - product.price * 5);
  }
  return score;
}

export function rankProducts(products: Product[], searchTerm: string): Product[] {
  return [...products].sort(
    (a, b) => scoreProduct(b, searchTerm) - scoreProduct(a, searchTerm),
  );
}

export function parseCatalogFilter(value: unknown): CatalogFilter {
  if (value === "bonus" || value === "bio" || value === "cheap" || value === "storeBrand") {
    return value;
  }
  return "all";
}

export function isStoreBrand(product: Product): boolean {
  return /^AH\s/i.test(product.title);
}

/** Subset ranked products; does not replace bonus-then-cheap order. */
export function applyCatalogFilter(products: Product[], filter: CatalogFilter): Product[] {
  if (filter === "all") return products;
  if (filter === "bonus") return products.filter((product) => product.isBonus);
  if (filter === "bio") return products.filter((product) => product.isBio);
  if (filter === "storeBrand") return products.filter(isStoreBrand);
  if (filter === "cheap") {
    const priced = products.filter((product) => product.price != null);
    if (priced.length === 0) return [];
    const min = Math.min(...priced.map((product) => product.price as number));
    return products.filter((product) => product.price != null && product.price <= min + 0.4);
  }
  return products;
}

function toMockProduct(product: Omit<Product, "source" | "isBio">): Product {
  return withBioFlags({ ...product, source: "mock" });
}

function mockProductsFor(searchTerm: string): Product[] {
  const exact = mockCatalog[searchTerm];
  if (exact?.length) {
    return exact.map(toMockProduct);
  }
  // Fuzzy: find catalog key contained in search term or vice versa
  const lower = searchTerm.toLowerCase();
  for (const [key, products] of Object.entries(mockCatalog)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return products.map(toMockProduct);
    }
  }
  return [
    withBioFlags({
      id: `mock-fallback-${encodeURIComponent(searchTerm)}`,
      title: `AH ${searchTerm}`,
      price: 1.99,
      unitPrice: null,
      isBonus: false,
      bonusLabel: null,
      imageUrl: null,
      source: "mock",
    }),
  ];
}

function mockBonusProducts(): Product[] {
  const bonus: Product[] = [];
  for (const products of Object.values(mockCatalog)) {
    for (const product of products) {
      if (product.isBonus) bonus.push(toMockProduct(product));
    }
  }
  return dedupeById(bonus);
}

function dedupeById(products: Product[]): Product[] {
  const seen = new Set<string>();
  const unique: Product[] = [];
  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    unique.push(product);
  }
  return unique;
}

function mapAhProduct(raw: Record<string, unknown>): Product | null {
  const id = String(raw.webshopId ?? raw.id ?? raw.niceness ?? "");
  const title = String(raw.title ?? raw.name ?? "");
  if (!id || !title) return null;

  const priceObj = raw.priceBeforeBonus ?? raw.price ?? raw.salesPrice;
  let price: number | null = null;
  if (typeof priceObj === "number") price = priceObj;
  else if (priceObj && typeof priceObj === "object") {
    const cents = (priceObj as { now?: number; amount?: number }).now
      ?? (priceObj as { amount?: number }).amount;
    if (typeof cents === "number") price = cents > 100 ? cents / 100 : cents;
  }

  const isBonus = Boolean(raw.isBonus ?? raw.bonusMechanism ?? raw.discount);
  const bonusLabel =
    typeof raw.bonusMechanism === "string"
      ? raw.bonusMechanism
      : typeof raw.discountType === "string"
        ? raw.discountType
        : isBonus
          ? "Bonus"
          : null;

  const images = raw.images as Array<{ url?: string }> | undefined;
  const imageUrl = images?.[0]?.url ?? null;

  return withBioFlags(
    {
      id,
      title,
      price,
      unitPrice: null,
      isBonus,
      bonusLabel,
      imageUrl,
      source: "ah",
    },
    rawLooksBio(raw),
  );
}

async function fetchAhProducts(searchTerm: string, prefs: UserPrefs): Promise<Product[]> {
  const forceMock = process.env.AH_FORCE_MOCK === "1";
  if (forceMock) return mockProductsFor(searchTerm);

  const cacheKey = `ah:${searchTerm}:${prefs.vegetarian}:${prefs.vegan}:${prefs.halal}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as Product[];
    return parsed.map((product) =>
      typeof product.isBio === "boolean"
        ? product
        : { ...product, isBio: titleLooksBio(product.title) },
    );
  }

  const url =
    `${AH_SEARCH_URL}?query=${encodeURIComponent(searchTerm)}` +
    `&page=0&size=8&sortOn=PRICE_ASC${prefsFacetParams(prefs)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "HackathonDietPlanner/0.1",
        "x-application": "AHWEBSHOP",
      },
    });
    if (!res.ok) {
      throw new Error(`AH search HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      products?: Record<string, unknown>[];
      cards?: Array<{ products?: Record<string, unknown>[] }>;
    };

    let rawProducts: Record<string, unknown>[] = [];
    if (Array.isArray(data.products)) rawProducts = data.products;
    else if (Array.isArray(data.cards)) {
      rawProducts = data.cards.flatMap((card) => card.products ?? []);
    }

    const products = rawProducts
      .map(mapAhProduct)
      .filter((p): p is Product => p != null);

    if (products.length === 0) {
      throw new Error("AH returned no products");
    }

    setCachedSearch(cacheKey, JSON.stringify(products));
    return products;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchProducts(
  searchTerm: string,
  prefs: UserPrefs,
): Promise<{ products: Product[]; usedMock: boolean }> {
  try {
    const products = await fetchAhProducts(searchTerm, prefs);
    return { products: rankProducts(products, searchTerm), usedMock: products[0]?.source === "mock" };
  } catch (err) {
    console.warn(`[ah] search failed for "${searchTerm}", using mock:`, err);
    const products = rankProducts(mockProductsFor(searchTerm), searchTerm);
    return { products, usedMock: true };
  }
}

function mockBonusSearchTerms(): string[] {
  return Object.entries(mockCatalog)
    .filter(([, products]) => products.some((product) => product.isBonus))
    .map(([term]) => term);
}

/** Current bonus/offers via existing search (no new AH query params). Mock if AH is down. */
export async function listBonusOffers(
  prefs: UserPrefs,
  searchTerms: string[],
): Promise<{ products: Product[]; usedMock: boolean }> {
  if (process.env.AH_FORCE_MOCK === "1") {
    return { products: rankProducts(mockBonusProducts(), ""), usedMock: true };
  }

  const bonusTerms = mockBonusSearchTerms();
  const overlapping = searchTerms.filter((term) => bonusTerms.includes(term));
  const terms = (overlapping.length ? overlapping : bonusTerms).slice(0, 16);
  const found: Product[] = [];
  let usedMock = false;

  try {
    for (let index = 0; index < terms.length; index += OFFER_SEARCH_BATCH) {
      const chunk = terms.slice(index, index + OFFER_SEARCH_BATCH);
      const results = await Promise.all(chunk.map((term) => searchProducts(term, prefs)));
      for (const result of results) {
        if (result.usedMock) usedMock = true;
        found.push(...result.products.filter((product) => product.isBonus));
      }
    }
  } catch (err) {
    console.warn("[ah] offers search failed, using mock:", err);
    return { products: rankProducts(mockBonusProducts(), ""), usedMock: true };
  }

  const bonus = rankProducts(dedupeById(found), "");
  if (bonus.length === 0) {
    return { products: rankProducts(mockBonusProducts(), ""), usedMock: true };
  }
  return { products: bonus, usedMock };
}
