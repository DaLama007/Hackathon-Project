import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import type { UserPrefs } from "./recipes.js";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/app.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/**
 * Schema versions:
 *  0 - pre-accounts: single global `prefs` row + one shared `shopping_list`
 *  1 - accounts added; pre-accounts tables renamed to *_legacy, awaiting adoption
 *  2 - legacy rows adopted by (or written off to) the demo user
 */
const SCHEMA_VERSION_ACCOUNTS = 1;
const SCHEMA_VERSION_LEGACY_ADOPTED = 2;

function currentSchemaVersion(): number {
  const [row] = db.pragma("user_version") as Array<{ user_version: number }>;
  return row?.user_version ?? 0;
}

function setSchemaVersion(version: number): void {
  db.pragma(`user_version = ${version}`);
}

function tableExists(name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name);
  return Boolean(row);
}

/** Pre-accounts data is kept in *_legacy tables so the first account can adopt it. */
function renameLegacyTables(): void {
  if (tableExists("prefs") && !tableExists("prefs_legacy")) {
    db.exec(`ALTER TABLE prefs RENAME TO prefs_legacy`);
  }
  if (tableExists("shopping_list") && !tableExists("shopping_list_legacy")) {
    db.exec(`ALTER TABLE shopping_list RENAME TO shopping_list_legacy`);
  }
}

if (currentSchemaVersion() < SCHEMA_VERSION_ACCOUNTS) {
  const hadPreAccountData = tableExists("prefs") || tableExists("shopping_list");
  renameLegacyTables();
  setSchemaVersion(
    hadPreAccountData ? SCHEMA_VERSION_ACCOUNTS : SCHEMA_VERSION_LEGACY_ADOPTED,
  );
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_prefs (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    vegetarian INTEGER NOT NULL DEFAULT 0,
    vegan INTEGER NOT NULL DEFAULT 0,
    halal INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price REAL,
    is_bonus INTEGER NOT NULL DEFAULT 0,
    bonus_label TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    search_term TEXT,
    recipe_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS search_cache (
    cache_key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meal_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    description TEXT NOT NULL,
    foods_json TEXT NOT NULL,
    nutrition_json TEXT NOT NULL,
    missing_json TEXT NOT NULL,
    tips TEXT,
    used_stub INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weekly_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    summary TEXT NOT NULL,
    missing_json TEXT NOT NULL,
    meal_count INTEGER NOT NULL DEFAULT 0,
    used_stub INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, week_start)
  );
`);

/**
 * Hand pre-accounts prefs/list rows to the first seeded account instead of
 * dropping them. Idempotent: the schema version gate makes it run at most once.
 */
export function adoptLegacyData(userId: number): void {
  if (currentSchemaVersion() >= SCHEMA_VERSION_LEGACY_ADOPTED) return;

  db.transaction(() => {
    if (tableExists("prefs_legacy")) {
      db.prepare(
        `INSERT OR REPLACE INTO user_prefs (user_id, vegetarian, vegan, halal)
         SELECT ?, vegetarian, vegan, halal FROM prefs_legacy WHERE id = 1`,
      ).run(userId);
    }
    if (tableExists("shopping_list_legacy")) {
      db.prepare(
        `INSERT OR IGNORE INTO shopping_list
           (user_id, product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id, created_at)
         SELECT ?, product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id, created_at
         FROM shopping_list_legacy`,
      ).run(userId);
    }
    setSchemaVersion(SCHEMA_VERSION_LEGACY_ADOPTED);
  })();
}

export interface User {
  id: number;
  username: string;
  created_at: string;
}

interface UserRow extends User {
  password_hash: string;
}

export function createUser(username: string, passwordHash: string): User {
  const info = db
    .prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`)
    .run(username, passwordHash);
  return findUserById(Number(info.lastInsertRowid))!;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare(`SELECT id, username, password_hash, created_at FROM users WHERE username = ?`)
    .get(username) as UserRow | undefined;
}

export function findUserById(id: number): User | undefined {
  return db.prepare(`SELECT id, username, created_at FROM users WHERE id = ?`).get(id) as
    | User
    | undefined;
}

export function createSession(token: string, userId: number, expiresAt: Date): void {
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(
    token,
    userId,
    expiresAt.toISOString(),
  );
}

/** Returns the session's user, or undefined when the token is unknown or expired. */
export function findUserBySessionToken(token: string): User | undefined {
  const row = db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.username, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as
    | { user_id: number; expires_at: string; username: string; created_at: string }
    | undefined;
  if (!row) return undefined;

  if (Date.parse(row.expires_at) <= Date.now()) {
    deleteSession(token);
    return undefined;
  }
  return { id: row.user_id, username: row.username, created_at: row.created_at };
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function deleteExpiredSessions(): void {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(new Date().toISOString());
}

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

export function getPrefs(userId: number): UserPrefs {
  db.prepare(`INSERT OR IGNORE INTO user_prefs (user_id) VALUES (?)`).run(userId);
  const row = db
    .prepare(`SELECT vegetarian, vegan, halal FROM user_prefs WHERE user_id = ?`)
    .get(userId) as PrefsRow;
  return {
    vegetarian: Boolean(row.vegetarian),
    vegan: Boolean(row.vegan),
    halal: Boolean(row.halal),
  };
}

export function setPrefs(userId: number, prefs: UserPrefs): UserPrefs {
  db.prepare(
    `INSERT INTO user_prefs (user_id, vegetarian, vegan, halal) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       vegetarian = excluded.vegetarian, vegan = excluded.vegan, halal = excluded.halal`,
  ).run(userId, prefs.vegetarian ? 1 : 0, prefs.vegan ? 1 : 0, prefs.halal ? 1 : 0);
  return getPrefs(userId);
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

export function listShoppingItems(userId: number): ShoppingListItem[] {
  const rows = db
    .prepare(
      `SELECT id, product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id, created_at
       FROM shopping_list WHERE user_id = ? ORDER BY id DESC`,
    )
    .all(userId) as ShoppingListRow[];

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

export function addShoppingItem(userId: number, input: AddShoppingItemInput): ShoppingListItem {
  const existing = db
    .prepare(`SELECT id, quantity FROM shopping_list WHERE user_id = ? AND product_id = ?`)
    .get(userId, input.productId) as { id: number; quantity: number } | undefined;

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
      `INSERT INTO shopping_list (user_id, product_id, title, price, is_bonus, bonus_label, quantity, search_term, recipe_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
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

export function removeShoppingItem(userId: number, id: number): boolean {
  const info = db
    .prepare(`DELETE FROM shopping_list WHERE user_id = ? AND id = ?`)
    .run(userId, id);
  return info.changes > 0;
}

export function clearShoppingList(userId: number): void {
  db.prepare(`DELETE FROM shopping_list WHERE user_id = ?`).run(userId);
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

export interface MealNutrition {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface MealLog {
  id: number;
  user_id: string;
  description: string;
  foods: string[];
  nutrition: MealNutrition;
  missing: string[];
  tips: string;
  used_stub: boolean;
  created_at: string;
}

export interface WeeklyReview {
  id: number;
  user_id: string;
  week_start: string;
  summary: string;
  missing: string[];
  meal_count: number;
  used_stub: boolean;
  created_at: string;
}

interface MealLogRow {
  id: number;
  user_id: string;
  description: string;
  foods_json: string;
  nutrition_json: string;
  missing_json: string;
  tips: string | null;
  used_stub: number;
  created_at: string;
}

interface WeeklyReviewRow {
  id: number;
  user_id: string;
  week_start: string;
  summary: string;
  missing_json: string;
  meal_count: number;
  used_stub: number;
  created_at: string;
}

function mapMealRow(row: MealLogRow): MealLog {
  return {
    id: row.id,
    user_id: row.user_id,
    description: row.description,
    foods: JSON.parse(row.foods_json) as string[],
    nutrition: JSON.parse(row.nutrition_json) as MealNutrition,
    missing: JSON.parse(row.missing_json) as string[],
    tips: row.tips ?? "",
    used_stub: Boolean(row.used_stub),
    created_at: row.created_at,
  };
}

function mapWeeklyRow(row: WeeklyReviewRow): WeeklyReview {
  return {
    id: row.id,
    user_id: row.user_id,
    week_start: row.week_start,
    summary: row.summary,
    missing: JSON.parse(row.missing_json) as string[],
    meal_count: row.meal_count,
    used_stub: Boolean(row.used_stub),
    created_at: row.created_at,
  };
}

export function insertMealLog(input: {
  userId: string;
  description: string;
  foods: string[];
  nutrition: MealNutrition;
  missing: string[];
  tips: string;
  usedStub: boolean;
}): MealLog {
  const info = db
    .prepare(
      `INSERT INTO meal_logs (user_id, description, foods_json, nutrition_json, missing_json, tips, used_stub)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      input.description,
      JSON.stringify(input.foods),
      JSON.stringify(input.nutrition),
      JSON.stringify(input.missing),
      input.tips,
      input.usedStub ? 1 : 0,
    );

  const row = db
    .prepare(
      `SELECT id, user_id, description, foods_json, nutrition_json, missing_json, tips, used_stub, created_at
       FROM meal_logs WHERE id = ?`,
    )
    .get(info.lastInsertRowid) as MealLogRow;
  return mapMealRow(row);
}

export function listMealLogs(userId: string, sinceIso?: string): MealLog[] {
  if (sinceIso) {
    const rows = db
      .prepare(
        `SELECT id, user_id, description, foods_json, nutrition_json, missing_json, tips, used_stub, created_at
         FROM meal_logs
         WHERE user_id = ? AND created_at >= ?
         ORDER BY created_at DESC`,
      )
      .all(userId, sinceIso) as MealLogRow[];
    return rows.map(mapMealRow);
  }
  const rows = db
    .prepare(
      `SELECT id, user_id, description, foods_json, nutrition_json, missing_json, tips, used_stub, created_at
       FROM meal_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(userId) as MealLogRow[];
  return rows.map(mapMealRow);
}

export function upsertWeeklyReview(input: {
  userId: string;
  weekStart: string;
  summary: string;
  missing: string[];
  mealCount: number;
  usedStub: boolean;
}): WeeklyReview {
  db.prepare(
    `INSERT INTO weekly_reviews (user_id, week_start, summary, missing_json, meal_count, used_stub)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, week_start) DO UPDATE SET
       summary = excluded.summary,
       missing_json = excluded.missing_json,
       meal_count = excluded.meal_count,
       used_stub = excluded.used_stub,
       created_at = datetime('now')`,
  ).run(
    input.userId,
    input.weekStart,
    input.summary,
    JSON.stringify(input.missing),
    input.mealCount,
    input.usedStub ? 1 : 0,
  );

  const row = db
    .prepare(
      `SELECT id, user_id, week_start, summary, missing_json, meal_count, used_stub, created_at
       FROM weekly_reviews WHERE user_id = ? AND week_start = ?`,
    )
    .get(input.userId, input.weekStart) as WeeklyReviewRow;
  return mapWeeklyRow(row);
}

export function getWeeklyReview(userId: string, weekStart: string): WeeklyReview | null {
  const row = db
    .prepare(
      `SELECT id, user_id, week_start, summary, missing_json, meal_count, used_stub, created_at
       FROM weekly_reviews WHERE user_id = ? AND week_start = ?`,
    )
    .get(userId, weekStart) as WeeklyReviewRow | undefined;
  return row ? mapWeeklyRow(row) : null;
}

export function listWeeklyReviews(userId: string, limit = 8): WeeklyReview[] {
  const rows = db
    .prepare(
      `SELECT id, user_id, week_start, summary, missing_json, meal_count, used_stub, created_at
       FROM weekly_reviews WHERE user_id = ? ORDER BY week_start DESC LIMIT ?`,
    )
    .all(userId, limit) as WeeklyReviewRow[];
  return rows.map(mapWeeklyRow);
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
