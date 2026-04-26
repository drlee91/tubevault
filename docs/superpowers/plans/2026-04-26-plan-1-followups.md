# Plan 1 — Deferred Follow-ups from Reviews

Tracked items surfaced during task reviews that were intentionally deferred to a later task on the same plan. Resolve before Plan 1 is considered complete.

## From Task 2 review (commit `799ef13`)

### F1 — Font wiring mismatch (must fix in Task 13)

- **Where:** `app/globals.css` declares `--font-sans: "Geist", "Inter", ...` and `html, body { font-family: var(--font-sans); }`. `app/layout.tsx` (default scaffold) loads Geist via `next/font/google` and exposes the family as `--font-geist-sans`.
- **Effect:** `var(--font-sans)` resolves to the literal string `"Geist"`, not the hashed family name `next/font` generates. Browsers fall back to Inter / system-ui. Geist never actually renders.
- **Fix in Task 13:** When rewriting `app/layout.tsx` for the AppShell, ensure the font-family chain in `globals.css` references the `next/font` CSS variable, e.g.:
  ```css
  --font-sans: var(--font-geist-sans), "Inter", system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), "JetBrains Mono", ui-monospace, monospace;
  ```
  And confirm the layout's `<body>` carries the `next/font` className that defines those variables.

### F2 — Dark mode toggle architecture (relevant in Task 14 / future Settings)

- **Where:** `app/globals.css` uses `@media (prefers-color-scheme: dark) { @theme { ... } }`. The Settings spec (8.1 General) plans a "Theme: Light / Dark / System" control.
- **Effect:** A user-controlled theme toggle cannot override OS-level `prefers-color-scheme` with a media query alone.
- **Fix when Settings theme toggle is implemented:** Switch from `@media (prefers-color-scheme: dark)` to either:
  - A class-based variant: `:root.dark { @theme { ... } }` plus a hydration-safe theme provider that toggles `<html class="dark">`, OR
  - Tailwind v4's `@variant dark (&:is(.dark *))` directive
  - System mode: read `prefers-color-scheme` and apply the class accordingly.
- Plan 1 Task 14 only renders the Settings page shell; the actual theme persistence + toggle UI lands in Plan 5 with the rest of Settings forms. Either:
  - Option A: keep `prefers-color-scheme` for Plan 1, document the rework cost in Plan 5
  - Option B: pre-emptively switch to class-based dark mode in Task 13 layout work

### F3 — Semantic tokens for status surfaces (future improvement, not Plan 1 critical)

- **Where:** `components/ui/badge.tsx` uses raw Tailwind palette classes (`bg-green-100`, `bg-amber-100`, `bg-red-100`) for tones `ok` / `warn` / `error`. Other components in the design system use `var(--color-*)` semantic tokens.
- **Effect:** Status colors aren't centrally tunable. Changing "the green" requires editing Badge directly.
- **Fix (deferred):** Add `--color-ok-bg`, `--color-ok-fg`, `--color-warn-bg`, `--color-warn-fg`, `--color-error-bg`, `--color-error-fg` tokens to `globals.css` and switch Badge to use them. Not Plan 1 critical; can be combined with other token cleanup in Plan 6 (polish).

## From Task 3 review (commit `8a9c0ca`)

### F4 — Swap `next lint` for direct `eslint .` (must fix in Task 16)

- **Where:** `package.json` script `"lint": "next lint"`.
- **Effect:** Next 15.5 prints a deprecation warning on every lint run; `next lint` will be removed in Next 16. Noisy in CI output.
- **Fix in Task 16:** When wiring CI, also flip the script:
  ```jsonc
  "lint": "eslint ."
  ```
  The flat config (`eslint.config.mjs`) is automatically picked up by `eslint .` — no config changes needed. Verify `npm run lint` still passes clean (without the deprecation warning), then commit alongside the CI workflow.

### F5 — Extend `.prettierignore` for generated output (relevant in Task 4)

- **Where:** `.prettierignore` covers source-side ignores but not generated artifacts.
- **Fix in Task 4 (Vitest setup):** Add to `.prettierignore`:
  ```
  coverage/
  test-results/
  playwright-report/
  ```
  Task 4 introduces `vitest run --coverage` which writes to `coverage/`. The `playwright-report/` and `test-results/` lines pre-empt Plan 6's E2E task. Optional but cheap.
- ✅ Resolved in commit `06d223b` (Task 4).

## From Task 8 review (commit `fa7a5c5`)

### F6 — Backup branch is not exercised by tests (must fix in Task 15 or Plan 6)

- **Where:** `lib/db/migrate.test.ts` — all four tests assert that NO backup file is created. The `dbExisted && pendingCount > 0 → copyFileSync` branch in `lib/db/migrate.ts` is uncovered.
- **Effect:** A future refactor that inverts the condition or removes `copyFileSync` would not fail any test. The whole point of the runner ("pre-migration backup") has zero positive coverage.
- **Fix:** Add a fifth test that simulates a pending migration. Either:
  - **Fixture-based:** create a fake `migrations/` folder with two `.sql` files + a hand-written `meta/_journal.json`, run twice with the second migration appended in between. Verify a `*.backup-*` file appears in the temp dir. OR
  - **Refactor:** extract `countPendingMigrations(sqlite, migrationsFolder): number` as a pure function and unit-test it directly without invoking Drizzle's migrator. This also removes the `as Array<{hash: string}>` cast (see F7).
- Schedule: post-Task-15 polish or part of Plan 6 testing pass.

### F7 — Replace unsafe row-cast with `SELECT COUNT(*)` (cosmetic, optional)

- **Where:** `lib/db/migrate.ts` lines 30-32 use `SELECT hash FROM __drizzle_migrations` and cast the result `as Array<{ hash: string }>` even though only the count matters.
- **Fix:** Replace with `SELECT COUNT(*) AS n FROM __drizzle_migrations` and `as { n: number }`. Same cast unsafety but obviously correct, smaller memory footprint when migration count grows.
- Trivial, can land alongside any other migrate.ts touch.

## From Task 11 review (commit `cf45d8c`)

### F8 — Cover untested SettingsService branches (Plan 6 polish)

- **Where:** `lib/services/settings-service.test.ts` — three branches uncovered:
  1. `setGlobalSyncCron(null)`, `setYtdlpPath(null)`, `setFfmpegPath(null)` → `repo.delete(key)` branch
  2. `setYtdlpPath("")`, `setFfmpegPath("")`, `setGlobalSyncCron("")` → `nonEmptyString.parse` should throw
- **Effect:** A future refactor that breaks the null-delete branch or removes the empty-string check would not fail any test.
- **Fix:** Add 6 tests (3 nullable-delete + 3 empty-string-rejection). Trivial.

### F9 — Document nullable getter semantics (must address before Plan 5 settings forms)

- **Where:** `lib/services/settings-service.ts` `getYtdlpPath()`, `getFfmpegPath()`, `getGlobalSyncCron()`.
- **Effect:** Returning `null` is ambiguous between "user explicitly cleared" and "never set." Today self-check (Task 12) treats both as "auto-detect," which is fine. Plan 5 may need to distinguish.
- **Fix:** Add JSDoc `/** Returns null if no override set; caller responsible for fallback. */` on the three getters. Defer the deeper "explicit-null" sentinel design until Plan 5 raises the need.

## From Task 15 review (commit `fa0b1b8`)

### F10 — Cold-start race + silent-success-after-failure in boot module

- **Where:** `lib/boot.ts` uses `let booted = false` flag + fired-and-forgotten `void ensureBooted().catch(...)`.
- **Effect:**
  1. **Cold-start UX papercut:** First request can hit `/api/health` while migrations are still running (the layout import doesn't await), surfacing a brief red banner that disappears on the next refresh.
  2. **Silent-success-after-failure:** The flag is set to `true` *before* `await runMigrations(...)`. If migrations throw, the flag stays `true`, the error is logged once, and the next call to `ensureBooted()` is a no-op that returns success without retrying or surfacing the error.
- **Fix (combined, ~5 lines):**
  ```ts
  let bootPromise: Promise<void> | null = null;
  export function ensureBooted(): Promise<void> {
    if (!bootPromise) {
      bootPromise = runMigrations({ ... });
    }
    return bootPromise;
  }
  ```
  - Failed promises stay rejected on every `await` — failures propagate.
  - Then update `app/api/health/route.ts` to `await ensureBooted()` at the top of `GET()` so requests block until migrations finish (cheap after first run — promise already resolved).
- Schedule: addressing this is "Approved with optional improvements" — not Plan 1 critical, but a UX papercut worth fixing in Plan 6 polish.
