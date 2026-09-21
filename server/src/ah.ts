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
  imageUrl: string | null;
  source: "ah" | "mock";
}

type MockCatalog = Record<string, Array<Omit<Product, "source">>>;

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const mockCatalog = JSON.parse(
  readFileSync(resolve(dataDir, "mock-products.json"), "utf8"),
) as MockCatalog;

const AH_SEARCH_URL = "https://api.ah.nl/mobile-services/product/search/v2";

function prefsFacetParams(prefs: UserPrefs): string {
  const filters: string[] = [];
  // AH diet property filters (unofficial). Safe to omit if API ignores them.
  if (prefs.vegan) filters.push("filters[]=sp_include_dieet_veganistisch");
  else if (prefs.vegetarian) filters.push("filters[]=sp_include_dieet_vegetarisch");
  if (prefs.halal) filters.push("filters[]=sp_include_dieet_halal");
  return filters.length ? `&${filters.join("&")}` : "";
}

function scoreProduct(product: Product, searchTerm: string): number {
  let score = 0;
  if (product.isBonus) score += 100;
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

function mockProductsFor(searchTerm: string): Product[] {
  const exact = mockCatalog[searchTerm];
  if (exact?.length) {
    return exact.map((p) => ({ ...p, source: "mock" as const }));
  }
  // Fuzzy: find catalog key contained in search term or vice versa
  const lower = searchTerm.toLowerCase();
  for (const [key, products] of Object.entries(mockCatalog)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return products.map((p) => ({ ...p, source: "mock" as const }));
    }
  }
  return [
    {
      id: `mock-fallback-${encodeURIComponent(searchTerm)}`,
      title: `AH ${searchTerm}`,
      price: 1.99,
      unitPrice: null,
      isBonus: false,
      bonusLabel: null,
      imageUrl: null,
      source: "mock",
    },
  ];
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

  return {
    id,
    title,
    price,
    unitPrice: null,
    isBonus,
    bonusLabel,
    imageUrl,
    source: "ah",
  };
}

async function fetchAhProducts(searchTerm: string, prefs: UserPrefs): Promise<Product[]> {
  const forceMock = process.env.AH_FORCE_MOCK === "1";
  if (forceMock) return mockProductsFor(searchTerm);

  const cacheKey = `ah:${searchTerm}:${prefs.vegetarian}:${prefs.vegan}:${prefs.halal}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) {
    return JSON.parse(cached) as Product[];
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
