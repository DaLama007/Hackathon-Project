import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/app.sqlite");

// Ensure the parent directory exists before opening the DB file.
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export interface Note {
  id: number;
  text: string;
  created_at: string;
}

export function listNotes(): Note[] {
  return db.prepare("SELECT id, text, created_at FROM notes ORDER BY id DESC").all() as Note[];
}

export function createNote(text: string): Note {
  const info = db.prepare("INSERT INTO notes (text) VALUES (?)").run(text);
  return db
    .prepare("SELECT id, text, created_at FROM notes WHERE id = ?")
    .get(info.lastInsertRowid) as Note;
}

export function deleteNote(id: number): boolean {
  const info = db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  return info.changes > 0;
}
