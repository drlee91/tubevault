import type { Config } from "drizzle-kit";

const dbPath = process.env.TUBEVAULT_DB_PATH ?? "./data/tubevault.db";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: { url: dbPath },
  verbose: true,
  strict: true,
} satisfies Config;
