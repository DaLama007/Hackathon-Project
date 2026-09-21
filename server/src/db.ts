import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import type { UserPrefs } from "./recipes.js";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/app.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS prefs (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    vegetarian INTEGER NOT NULL DEFAULT 0,
    vegan INTEGER NOT NULL DEFAULT 0,
    halal INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    price REAL,
    is_bonus INTEGER NOT NULL DEFAULT 0,
    bonus_label TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    search_term TEXT,
    recipe_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS search_cache (
    cache_key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.prepare(
  `INSERT OR IGNORE INTO prefs (id, vegetarian, vegan, halal) VALUES (1, 0, 0, 0)`,
).run();

export interface ShoppingListItem {
  id: number;
  product_id: string;
  title: string;
  price: number | null;
  is_bonus: boolean;
  bonus_label: string | null;
  quantity: number;
  search_term: string | null;
  recipe_id: string | null;
  created_at: string;
}

interface PrefsRow {
  vegetarian: number;
  vegan: number;
  halal: number;
}

export function getPrefs(): UserPrefs {
  const row = db.prepare(`SELECT vegetarian, vegan, halal FROM prefs WHERE id = 1`).get() as PrefsRow;
  return {
    vegetarian: Boolean(row.vegetarian),
    vegan: Boolean(row.vegan),
    halal: Boolean(row.halal),
  };
}

export function setPrefs(prefs: UserPrefs): UserPrefs {
  db.prepare(
    `UPDATE prefs SET vegetarian = ?, vegan = ?, halal = ? WHERE id = 1`,
  ).run(prefs.vegetarian ? 1 : 0, prefs.vegan ? 1 : 0, prefs.halal ? 1 : 0);
  return getPrefs();
}

interface ShoppingListRow {
  id: number;
  product_id: string;
  title: string;
  price: number | null;
  is_bonus: number;
  bonus_label: string | null;
  quantity: number;
  search_term: string | null;
  recipe_id: string | null;
  created_at: string;
}

function mapShoppingRow(row: ShoppingListRow): ShoppingListItem {
  return {
    ...row,
    is_bonus: Boolean(row.is_bonus),
  };
}

export function listShoppingItems(): ShoppingListItem[] {
  const rows = db
    .prepare(
      `SELECT id, product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id, created_at
       FROM shopping_list ORDER BY id DESC`,
    )
    .all() as ShoppingListRow[];

  return rows.map(mapShoppingRow);
}

export interface AddShoppingItemInput {
  productId: string;
  title: string;
  price?: number | null;
  isBonus?: boolean;
  bonusLabel?: string | null;
  quantity?: number;
  searchTerm?: string | null;
  recipeId?: string | null;
}

export function addShoppingItem(input: AddShoppingItemInput): ShoppingListItem {
  const existing = db
    .prepare(`SELECT id, quantity FROM shopping_list WHERE product_id = ?`)
    .get(input.productId) as { id: number; quantity: number } | undefined;

  if (existing) {
    const nextQty = existing.quantity + (input.quantity ?? 1);
    db.prepare(`UPDATE shopping_list SET quantity = ? WHERE id = ?`).run(nextQty, existing.id);
    const row = db
      .prepare(
        `SELECT id, product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id, created_at
         FROM shopping_list WHERE id = ?`,
      )
      .get(existing.id) as ShoppingListRow;
    return mapShoppingRow(row);
  }

  const info = db
    .prepare(
      `INSERT INTO shopping_list (product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.productId,
      input.title,
      input.price ?? null,
      input.isBonus ? 1 : 0,
      input.bonusLabel ?? null,
      input.quantity ?? 1,
      input.searchTerm ?? null,
      input.recipeId ?? null,
    );

  const row = db
    .prepare(
      `SELECT id, product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id, created_at
       FROM shopping_list WHERE id = ?`,
    )
    .get(info.lastInsertRowid) as ShoppingListRow;

  return mapShoppingRow(row);
}

export function removeShoppingItem(id: number): boolean {
  const info = db.prepare(`DELETE FROM shopping_list WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function clearShoppingList(): void {
  db.prepare(`DELETE FROM shopping_list`).run();
}

export function getCachedSearch(cacheKey: string): string | null {
  const row = db
    .prepare(`SELECT payload, created_at FROM search_cache WHERE cache_key = ?`)
    .get(cacheKey) as { payload: string; created_at: string } | undefined;
  if (!row) return null;
  // SQLite datetime('now') is UTC-ish "YYYY-MM-DD HH:MM:SS"
  const createdMs = Date.parse(row.created_at.replace(" ", "T") + "Z");
  if (Number.isFinite(createdMs) && Date.now() - createdMs > 30 * 60 * 1000) {
    db.prepare(`DELETE FROM search_cache WHERE cache_key = ?`).run(cacheKey);
    return null;
  }
  return row.payload;
}

export function setCachedSearch(cacheKey: string, payload: string): void {
  db.prepare(
    `INSERT INTO search_cache (cache_key, payload, created_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, created_at = datetime('now')`,
  ).run(cacheKey, payload);
}

const AH_AUTH_CACHE_KEY = "ah:auth:token";

export interface StoredAhAuth {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
}

/** Persist the anonymous AH token; expiry is on the token itself, not the 30min search TTL. */
export function getStoredAhAuth(): StoredAhAuth | null {
  const row = db
    .prepare(`SELECT payload FROM search_cache WHERE cache_key = ?`)
    .get(AH_AUTH_CACHE_KEY) as { payload: string } | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload) as Partial<StoredAhAuth>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.expiresAtMs !== "number"
    ) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAtMs: parsed.expiresAtMs,
    };
  } catch (err) {
    console.warn("[db] failed to parse stored AH auth:", err);
    return null;
  }
}

export function setStoredAhAuth(auth: StoredAhAuth): void {
  setCachedSearch(AH_AUTH_CACHE_KEY, JSON.stringify(auth));
}

export function clearStoredAhAuth(): void {
  db.prepare(`DELETE FROM search_cache WHERE cache_key = ?`).run(AH_AUTH_CACHE_KEY);
}
