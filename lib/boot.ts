import { runMigrations } from "@/lib/db/migrate";

// Cache the boot promise rather than a boolean. A failed migration leaves the
// promise rejected, so subsequent awaiters see the real error instead of a
// silent successful resolve. See plan-1-followups.md F10 for context.
let bootPromise: Promise<void> | null = null;

export function ensureBooted(): Promise<void> {
  if (!bootPromise) {
    const dbPath = process.env.TUBEVAULT_DB_PATH ?? "./data/tubevault.db";
    bootPromise = runMigrations({
      dbPath,
      migrationsFolder: "./drizzle/migrations",
    });
  }
  return bootPromise;
}

// Auto-invoke on module import (server-side only).
// Failures will surface via /api/health, which awaits ensureBooted() too.
if (typeof window === "undefined") {
  void ensureBooted().catch((err) => {
    console.error("[tubevault:boot] migration failed:", err);
  });
}
