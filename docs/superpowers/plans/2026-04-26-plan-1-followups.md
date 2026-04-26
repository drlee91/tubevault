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
