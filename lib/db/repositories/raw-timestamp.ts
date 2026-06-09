/**
 * Convert a timestamp column read via a raw SQL query into an ISO-8601 string.
 *
 * Drizzle's `integer({ mode: "timestamp" })` stores Unix seconds and maps them
 * back to `Date` in schema-based queries — but `db.all(sql\`...\`)` bypasses
 * that mapping and hands us the raw integer. `String(1777508001)` is not a
 * parseable date, so anything feeding `new Date(...)` (e.g. <RelativeTime>)
 * rendered "NaNy ago".
 */
export function rawTimestampToIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return new Date(Number(value) * 1000).toISOString();
  }
  return String(value);
}

export function rawTimestampToIsoOrNull(value: unknown): string | null {
  return value != null ? rawTimestampToIso(value) : null;
}
