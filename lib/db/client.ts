import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

let cached: BetterSQLite3Database<typeof schema> | null = null;
let cachedSqlite: Database.Database | null = null;
let cachedPath: string | null = null;

export function getDb(dbPath: string): BetterSQLite3Database<typeof schema> {
  if (cached && cachedPath === dbPath) return cached;
  if (cachedSqlite) cachedSqlite.close();
  cachedSqlite = new Database(dbPath);
  cachedSqlite.pragma("journal_mode = WAL");
  cachedSqlite.pragma("foreign_keys = ON");
  cached = drizzle(cachedSqlite, { schema });
  cachedPath = dbPath;
  return cached;
}

export function closeDb(): void {
  if (cachedSqlite) {
    cachedSqlite.close();
    cachedSqlite = null;
    cached = null;
    cachedPath = null;
  }
}
