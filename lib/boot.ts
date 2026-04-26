import { runMigrations } from "@/lib/db/migrate";

let booted = false;

export async function ensureBooted(): Promise<void> {
  if (booted) return;
  booted = true;

  const dbPath = process.env.TUBEVAULT_DB_PATH ?? "./data/tubevault.db";
  await runMigrations({
    dbPath,
    migrationsFolder: "./drizzle/migrations",
  });
}

// Auto-invoke on module import (server-side only).
// We swallow the promise here; failures will surface via /api/health.
if (typeof window === "undefined") {
  void ensureBooted().catch((err) => {
    console.error("[tubevault:boot] migration failed:", err);
  });
}
