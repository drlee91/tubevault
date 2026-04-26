import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";

describe("migrations", () => {
  it("apply cleanly to a fresh in-memory DB", () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    expect(() => migrate(db, { migrationsFolder: "./drizzle/migrations" })).not.toThrow();
  });

  it("creates jobs.next_attempt_at column", () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: "./drizzle/migrations" });
    const cols = sqlite.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name)).toContain("next_attempt_at");
  });
});
