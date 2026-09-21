import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearStoredAhAuth,
  getCachedSearch,
  getStoredAhAuth,
  setCachedSearch,
  setStoredAhAuth,
  type StoredAhAuth,
} from "./db.js";
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
  brand: string | null;
  unitPriceDescription: string | null;
  nutriscore: string | null;
  propertyIcons: string[];
}

/** Filters already expressible from catalog fields — not extra AH query params. */
export type CatalogFilter = "all" | "bonus" | "bio" | "cheap" | "storeBrand";

type MockCatalog = Record<string, Array<Partial<Product> & { id: string; title: string }>>;

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const mockCatalog = JSON.parse(
  readFileSync(resolve(dataDir, "mock-products.json"), "utf8"),
) as MockCatalog;

const OFFER_SEARCH_BATCH = 8;
const FETCH_TIMEOUT_MS = 4000;
const TOKEN_REFRESH_SKEW_MS = 60_000;

function ahBaseUrl(): string {
  return (process.env.AH_BASE_URL ?? "https://api.ah.nl").replace(/\/$/, "");
}

function ahClientId(): string {
  return process.env.AH_CLIENT_ID ?? "appie";
}

function ahHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    // Same UA as the working 2026-09-21 probe in SCRATCH.md
    "User-Agent": "Appie/8.22.3",
    "x-application": "AHWEBSHOP",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export function titleLooksBio(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes("biologisch") ||
    lower.includes("organic") ||
    /(^|\s)bio(\s|$|-)/.test(lower)
  );
}

function hasPropertyIcon(product: Product, icon: string): boolean {
  return product.propertyIcons.some((value) => value === icon);
}

function withCatalogDefaults(
  product: Omit<Product, "isBio" | "source"> & { source: Product["source"]; isBio?: boolean },
  extraBio = false,
): Product {
  const propertyIcons = (product.propertyIcons ?? []).map((icon) => icon.toLowerCase());
  const isBio =
    extraBio ||
    product.isBio === true ||
    propertyIcons.includes("biologisch") ||
    propertyIcons.includes("organic") ||
    titleLooksBio(product.title);
  return {
    ...product,
    brand: product.brand ?? null,
    unitPriceDescription: product.unitPriceDescription ?? null,
    nutriscore: product.nutriscore ?? null,
    propertyIcons,
    isBio,
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
  return /^AH(\s|$)/i.test(product.title) || /^AH(\s|$)/i.test(product.brand ?? "");
}

/** Subset ranked products; does not replace bonus-then-cheap order. */
export function applyCatalogFilter(products: Product[], filter: CatalogFilter): Product[] {
  if (filter === "all") return products;
  if (filter === "bonus") return products.filter((product) => product.isBonus);
  if (filter === "bio") return products.filter((product) => product.isBio);
  if (filter === "storeBrand") return products.filter(isStoreBrand);
  if (filter === "cheap") {
    const byIcon = products.filter((product) => hasPropertyIcon(product, "goedkoopje"));
    const priced = products.filter((product) => product.price != null);
    if (priced.length === 0) return byIcon;
    const min = Math.min(...priced.map((product) => product.price as number));
    const byPrice = products.filter((product) => product.price != null && product.price <= min + 0.4);
    return byIcon.length ? dedupeById([...byIcon, ...byPrice]) : byPrice;
  }
  return products;
}

function toMockProduct(product: MockCatalog[string][number]): Product {
  return withCatalogDefaults({
    id: product.id,
    title: product.title,
    price: product.price ?? null,
    unitPrice: product.unitPrice ?? null,
    isBonus: Boolean(product.isBonus),
    bonusLabel: product.bonusLabel ?? null,
    imageUrl: product.imageUrl ?? null,
    brand: product.brand ?? null,
    unitPriceDescription: product.unitPriceDescription ?? null,
    nutriscore: product.nutriscore ?? null,
    propertyIcons: product.propertyIcons ?? [],
    source: "mock",
  });
}

function mockProductsFor(searchTerm: string): Product[] {
  const exact = mockCatalog[searchTerm];
  if (exact?.length) {
    return exact.map(toMockProduct);
  }
  const lower = searchTerm.toLowerCase();
  for (const [key, products] of Object.entries(mockCatalog)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return products.map(toMockProduct);
    }
  }
  return [
    withCatalogDefaults({
      id: `mock-fallback-${encodeURIComponent(searchTerm)}`,
      title: `AH ${searchTerm}`,
      price: 1.99,
      unitPrice: null,
      isBonus: false,
      bonusLabel: null,
      imageUrl: null,
      brand: "AH",
      unitPriceDescription: null,
      nutriscore: null,
      propertyIcons: [],
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

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseEuroAmount(text: string | null): number | null {
  if (!text) return null;
  const match = /€\s*(\d+(?:[.,]\d+)?)/.exec(text);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

function pickImageUrl(raw: Record<string, unknown>): string | null {
  const images = raw.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const withUrl = images.filter(
    (image): image is { url: string; width?: number } =>
      Boolean(image) && typeof image === "object" && typeof (image as { url?: unknown }).url === "string",
  );
  if (withUrl.length === 0) return null;
  const ranked = [...withUrl].sort(
    (a, b) => Math.abs((a.width ?? 999) - 200) - Math.abs((b.width ?? 999) - 200),
  );
  return ranked[0].url;
}

function readPropertyIcons(raw: Record<string, unknown>): string[] {
  if (!Array.isArray(raw.propertyIcons)) return [];
  return raw.propertyIcons
    .filter((icon): icon is string => typeof icon === "string" && icon.trim().length > 0)
    .map((icon) => icon.toLowerCase());
}

function bonusLabelFrom(raw: Record<string, unknown>, isBonus: boolean): string | null {
  if (typeof raw.bonusMechanism === "string" && raw.bonusMechanism.trim()) {
    return raw.bonusMechanism;
  }
  const labels = raw.discountLabels;
  if (Array.isArray(labels)) {
    for (const label of labels) {
      if (label && typeof label === "object") {
        const description = (label as { defaultDescription?: unknown }).defaultDescription;
        if (typeof description === "string" && description.trim()) return description;
      } else if (typeof label === "string" && label.trim()) {
        return label;
      }
    }
  }
  if (typeof raw.discountType === "string" && raw.discountType.trim()) return raw.discountType;
  return isBonus ? "Bonus" : null;
}

/** currentPrice is the discounted amount when on bonus; priceBeforeBonus is the regular/list price. */
function readAhPrice(raw: Record<string, unknown>): number | null {
  const current = readNumber(raw.currentPrice);
  if (current != null) return current;
  const beforeBonus = readNumber(raw.priceBeforeBonus);
  if (beforeBonus != null) return beforeBonus;
  const price = raw.price ?? raw.salesPrice;
  if (typeof price === "number") return price;
  if (price && typeof price === "object") {
    const cents =
      readNumber((price as { now?: unknown }).now) ?? readNumber((price as { amount?: unknown }).amount);
    if (cents != null) return cents > 100 ? cents / 100 : cents;
  }
  return null;
}

function mapAhProduct(raw: Record<string, unknown>): Product | null {
  const id = String(raw.webshopId ?? raw.id ?? "");
  const title = String(raw.title ?? raw.name ?? "");
  if (!id || !title) return null;

  const propertyIcons = readPropertyIcons(raw);
  const isBonus = Boolean(raw.isBonus ?? raw.isBonusPrice ?? raw.bonusMechanism ?? raw.discount);
  const unitPriceDescription =
    typeof raw.unitPriceDescription === "string" ? raw.unitPriceDescription : null;

  return withCatalogDefaults(
    {
      id,
      title,
      price: readAhPrice(raw),
      unitPrice: parseEuroAmount(unitPriceDescription),
      isBonus,
      bonusLabel: bonusLabelFrom(raw, isBonus),
      imageUrl: pickImageUrl(raw),
      brand: typeof raw.brand === "string" ? raw.brand : null,
      unitPriceDescription,
      nutriscore: typeof raw.nutriscore === "string" ? raw.nutriscore : null,
      propertyIcons,
      source: "ah",
    },
    propertyIcons.includes("biologisch") || propertyIcons.includes("organic"),
  );
}

let memoryAuth: StoredAhAuth | null = null;
let tokenInFlight: Promise<string> | null = null;

function accessStillValid(auth: StoredAhAuth | null): boolean {
  return Boolean(auth && Date.now() < auth.expiresAtMs - TOKEN_REFRESH_SKEW_MS);
}

function rememberAuth(auth: StoredAhAuth): void {
  memoryAuth = auth;
  setStoredAhAuth(auth);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestAhToken(
  path: "/mobile-auth/v1/auth/token/anonymous" | "/mobile-auth/v1/auth/token/refresh",
  body: Record<string, string>,
): Promise<StoredAhAuth> {
  const res = await fetchWithTimeout(`${ahBaseUrl()}${path}`, {
    method: "POST",
    headers: ahHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`AH auth HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error("AH auth missing token fields");
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
  };
}

async function loadOrRefreshToken(): Promise<string> {
  if (memoryAuth && accessStillValid(memoryAuth)) return memoryAuth.accessToken;

  const stored = getStoredAhAuth();
  if (stored && accessStillValid(stored)) {
    memoryAuth = stored;
    return stored.accessToken;
  }

  const refreshToken = memoryAuth?.refreshToken ?? stored?.refreshToken;
  if (refreshToken) {
    try {
      const refreshed = await requestAhToken("/mobile-auth/v1/auth/token/refresh", {
        clientId: ahClientId(),
        refreshToken,
      });
      rememberAuth(refreshed);
      return refreshed.accessToken;
    } catch (err) {
      console.warn("[ah] token refresh failed, requesting anonymous token:", err);
      clearStoredAhAuth();
      memoryAuth = null;
    }
  }

  const anonymous = await requestAhToken("/mobile-auth/v1/auth/token/anonymous", {
    clientId: ahClientId(),
  });
  rememberAuth(anonymous);
  console.info("[ah] fetched anonymous token");
  return anonymous.accessToken;
}

async function getAccessToken(): Promise<string> {
  if (memoryAuth && accessStillValid(memoryAuth)) return memoryAuth.accessToken;
  if (!tokenInFlight) {
    tokenInFlight = loadOrRefreshToken().finally(() => {
      tokenInFlight = null;
    });
  }
  return tokenInFlight;
}

function invalidateAuth(): void {
  memoryAuth = null;
  clearStoredAhAuth();
}

function extractRawProducts(data: {
  products?: Record<string, unknown>[];
  cards?: Array<{ products?: Record<string, unknown>[]; product?: Record<string, unknown> }>;
}): Record<string, unknown>[] {
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.cards)) {
    return data.cards.flatMap((card) => {
      if (Array.isArray(card.products)) return card.products;
      return card.product ? [card.product] : [];
    });
  }
  return [];
}

async function searchAhOnce(searchTerm: string, accessToken: string): Promise<Response> {
  const url =
    `${ahBaseUrl()}/mobile-services/product/search/v2` +
    `?query=${encodeURIComponent(searchTerm)}` +
    `&page=0&size=8&sortOn=PRICELOWHIGH`;
  return fetchWithTimeout(url, { headers: ahHeaders(accessToken) });
}

async function fetchAhProducts(searchTerm: string, _prefs: UserPrefs): Promise<Product[]> {
  const forceMock = process.env.AH_FORCE_MOCK === "1";
  if (forceMock) return mockProductsFor(searchTerm);

  const cacheKey = `ah:${searchTerm}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as Product[];
    return parsed.map((product) =>
      withCatalogDefaults({ ...product, source: product.source ?? "ah" }),
    );
  }

  let accessToken = await getAccessToken();
  let res = await searchAhOnce(searchTerm, accessToken);
  if (res.status === 401) {
    invalidateAuth();
    accessToken = await getAccessToken();
    res = await searchAhOnce(searchTerm, accessToken);
  }
  if (!res.ok) {
    throw new Error(`AH search HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    products?: Record<string, unknown>[];
    cards?: Array<{ products?: Record<string, unknown>[]; product?: Record<string, unknown> }>;
  };
  const products = extractRawProducts(data)
    .map(mapAhProduct)
    .filter((product): product is Product => product != null);

  if (products.length === 0) {
    throw new Error("AH returned no products");
  }

  setCachedSearch(cacheKey, JSON.stringify(products));
  return products;
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
