import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { settings } from "../schema";
import type * as schema from "../schema";

export class SettingsRepository {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  get<T = unknown>(key: string): T | null {
    const row = this.db.select().from(settings).where(eq(settings.key, key)).get();
    if (!row) return null;
    return JSON.parse(row.value) as T;
  }

  getWithMeta<T = unknown>(key: string): { value: T; updatedAt: Date } | null {
    const row = this.db.select().from(settings).where(eq(settings.key, key)).get();
    if (!row) return null;
    return { value: JSON.parse(row.value) as T, updatedAt: row.updatedAt };
  }

  set(key: string, value: unknown): void {
    const encoded = JSON.stringify(value);
    this.db
      .insert(settings)
      .values({ key, value: encoded })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: encoded, updatedAt: new Date() },
      })
      .run();
  }

  delete(key: string): void {
    this.db.delete(settings).where(eq(settings.key, key)).run();
  }

  getAll(): Record<string, unknown> {
    const rows = this.db.select().from(settings).all();
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      out[row.key] = JSON.parse(row.value);
    }
    return out;
  }
}
