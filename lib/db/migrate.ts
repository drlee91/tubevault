import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { mkdirSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface RunMigrationsOptions {
  dbPath: string;
  migrationsFolder: string;
}

export async function runMigrations(opts: RunMigrationsOptions): Promise<void> {
  const dir = path.dirname(opts.dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const dbExisted = existsSync(opts.dbPath);
  const sqlite = new Database(opts.dbPath);

  // Determine if any migrations are pending. We compare files in
  // migrationsFolder against the __drizzle_migrations table.
  let pendingCount = 0;
  if (dbExisted) {
    const files = readdirSync(opts.migrationsFolder).filter((f) => f.endsWith(".sql"));
    const tableExists = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`)
      .get();
    if (tableExists) {
      const applied = sqlite.prepare(`SELECT hash FROM __drizzle_migrations`).all() as Array<{
        hash: string;
      }>;
      pendingCount = Math.max(0, files.length - applied.length);
    } else {
      pendingCount = files.length;
    }
  }

  if (dbExisted && pendingCount > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${opts.dbPath}.backup-${ts}`;
    copyFileSync(opts.dbPath, backupPath);
  }

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: opts.migrationsFolder });
  sqlite.close();
}
