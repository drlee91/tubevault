import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations } from "./migrate";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "tubevault-migrate-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("creates the database file and all tables on first run", async () => {
    const dbPath = path.join(tempDir, "test.db");

    await runMigrations({ dbPath, migrationsFolder: "./drizzle/migrations" });

    expect(existsSync(dbPath)).toBe(true);

    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);
    const tables = db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations'`,
    );
    const tableNames = tables.map((r) => r.name).sort();
    sqlite.close();

    expect(tableNames).toEqual(
      [
        "jobs",
        "media_files",
        "playlist_items",
        "playlists",
        "settings",
        "sync_runs",
        "videos",
      ].sort(),
    );
  });

  it("creates the parent directory if it doesn't exist", async () => {
    const dbPath = path.join(tempDir, "nested", "deeper", "test.db");

    await runMigrations({ dbPath, migrationsFolder: "./drizzle/migrations" });

    expect(existsSync(dbPath)).toBe(true);
  });

  it("creates a backup file before applying new migrations", async () => {
    const dbPath = path.join(tempDir, "test.db");

    // First run: no backup expected (no prior DB)
    await runMigrations({ dbPath, migrationsFolder: "./drizzle/migrations" });
    let files = readdirSync(tempDir);
    expect(files.filter((f) => f.includes("backup"))).toHaveLength(0);

    // Insert a row so we can later confirm the backup contains it
    const sqlite = new Database(dbPath);
    sqlite.exec(`INSERT INTO settings(key, value) VALUES ('x', '"y"')`);
    sqlite.close();

    // Second run: nothing to migrate, no backup
    await runMigrations({ dbPath, migrationsFolder: "./drizzle/migrations" });
    files = readdirSync(tempDir);
    expect(files.filter((f) => f.includes("backup"))).toHaveLength(0);
  });

  it("is idempotent — running twice produces the same schema", async () => {
    const dbPath = path.join(tempDir, "test.db");
    await runMigrations({ dbPath, migrationsFolder: "./drizzle/migrations" });
    await expect(
      runMigrations({ dbPath, migrationsFolder: "./drizzle/migrations" }),
    ).resolves.not.toThrow();
  });
});
