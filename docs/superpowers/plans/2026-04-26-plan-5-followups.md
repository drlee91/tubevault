# Plan 5 — Follow-ups

**Date:** 2026-04-28
**Status:** Plan 5 complete (47/47 tasks). 60 commits on `plan-5-ui`. Lint, typecheck, and tests all green (95 files / 405 tests).

This document records items that surfaced during Plan 5 execution and were intentionally deferred. None block the merge.

## Production fix surfaced during Task 45 (E2E)

A latent bug in `JobQueue.claim()` was discovered when wiring real handlers in the E2E drain helper. The raw-SQL `RETURNING *` path returned `payload` as a JSON string instead of a parsed object — `mode: "json"` only applies to Drizzle's typed query builder, not `db.all(sql\`...\`)`. Fixed in `lib/jobs/queue.ts:107` by adding a `JSON.parse` guard. **Without this fix, every production job handler would have crashed on first claim** because payload-field access (e.g. `payload.playlistId`) returns `undefined` on a string. No tests previously caught it because all repo-level claim tests went through the Drizzle query builder, which already parses JSON.

This is a follow-up trace-line, not an open follow-up.

## Open follow-ups

### A. Apply the `VideoSerialized` pattern to other SWR hooks

Task 27 established a `VideoSerialized` type at the SWR boundary (in `lib/client/use-standalone-videos.ts`) so `Date` fields are typed as `string` (matching the JSON-over-wire reality). Other hooks that return entities with Date fields still type them as Date:

- `usePlaylistDetail` returns `PlaylistDetailDto`. Inside, `PlaylistDetailItem.addedAt` is already a `string` (good), but `audioFile`/`videoFile` (`MediaFile` rows) and the playlist-stats row contain Date fields typed as Date. They flow through JSON serialization the same way and should be typed as `string` at the boundary.
- `useJobs` returns `JobsList`. Job rows have `createdAt`/`startedAt`/`finishedAt` typed as Date.

**Why deferred:** Did not bite during Plan 5 because the consuming components either render via `<RelativeTime iso={...} />` (which accepts both via runtime coercion — though that masks the type lie) or never touch the Date fields. Worth tightening before any consumer needs date arithmetic on these fields. A general rule: every SWR hook returning DB-shaped data should expose a `*Serialized` type.

### B. `app/error.tsx` and route error boundaries — sketch only

Task 25 introduced `app/error.tsx` (route-level) and Task 33 added `app/playlists/[id]/error.tsx`. Both render `<ErrorCard>` with the raw `error.message`. There is no global error boundary (`app/global-error.tsx`) for failures in the root layout itself. If `ensureBooted()` ever fails before the layout renders (e.g. corrupt DB, file-system error), the user sees Next's default error chrome.

**Why deferred:** Adding `app/global-error.tsx` is straightforward but requires copying the layout's `<html>`/`<body>` + the ThemeProvider, which couples it to the app shell. Out of scope for Plan 5. Add when a real boot-failure path is exercised.

### C. `searchParams` schema validation in `app/activity/page.tsx`

`ActivityPage({ searchParams })` reads `sp.tab` and `sp.status` and forwards them to `HistoryTab` / `JobsTab`. There is no Zod parse step. Out-of-range values like `?status=carrots` fall through to the service layer, which returns `[]` because no run/job has that status. The user sees an empty state with no error feedback.

**Why deferred:** The empty state is a graceful degradation, not a crash. A real fix is a small `searchParamsSchema.safeParse` at the page entry that strips unknown values. Apply when adding any new query param to the page.

### D. SkeletonRow on tabs pages doesn't match the underlying layout

`app/playlists/loading.tsx`, `app/activity/loading.tsx`, `app/settings/loading.tsx`, and `app/playlists/[id]/loading.tsx` all render a single `<SkeletonRow />` inside a `max-w-Nxl` wrapper. None mirror the actual page shape (header, tab bar, list of items). Users see a shape that pops to a different layout the moment hydration completes.

**Why deferred:** Plan 5's focus was correctness, not skeleton fidelity. Build per-page skeletons (e.g. `<DashboardSkeleton />`, `<PlaylistsSkeleton />`) when the visual mismatch becomes a complaint.

### E. Search input in TrackTable is not debounced

`components/playlists/track-table.tsx` re-filters on every keystroke. For the current playlist sizes this is irrelevant, but a 1000-item playlist on a slow device would feel laggy. A 150-ms `useDeferredValue` or manual debounce would smooth it.

**Why deferred:** No real-world large-playlist test data exists yet. Address when someone reports it.

### F. Cancel button on running jobs is a stub

`components/activity/job-row.tsx` renders a "Cancel" button for jobs in `running` state, but the button is `disabled` and tooltipped with "Cancel coming soon". The plan didn't include a cancel-job action.

**Why deferred:** Cancel-job is a Plan 6+ feature. The stub button signals to the user that the team is aware. Decision needed: cooperative cancellation (handler checks a flag) vs. process-kill (signal-based, harder).

### G. `DialogDescription` on Add dialogs

`AddPlaylistDialog` and `AddVideoDialog` both render a form directly inside `DialogContent` without a `DialogDescription`. Screen readers will announce the dialog title but not provide an `aria-describedby` association for the form context. `DeletePlaylistButton` was retrofitted with `DialogDescription` in Task 29 cleanup; the Add dialogs were not.

**Why deferred:** The Add dialogs' form semantics (URL field, format radio group with `<legend>`) are largely self-describing. A short `<DialogDescription>` would still improve the screen-reader pause cadence. Apply when an a11y audit lands.

### H. Plan 2 follow-up F3 (`ProviderRegistry.unregister`) still open

The handoff (Plan 5 mid-execution) noted that the registry's missing `unregister` method is de-facto resolved by the test boot context's worker-pool detachment. The actual `unregister` method is still absent on `ProviderRegistry`. No new code in Plan 5 needed it. Close or implement before Plan 6 introduces dynamic provider swapping.

### I. `.gitignore` — `storage/` glob change

The handoff noted that `storage/` (un-anchored) collides with `app/api/storage/`. Plan 5 worked around it with `git add -f` for `app/api/storage/usage/route.ts`. The cleaner fix is to change `.gitignore` `storage/` → `/storage/`. Not done yet — apply when convenient (one-line change with no consequences).

## Test count history

| Phase | End commit | Tests |
|---|---|---|
| 6 (handoff) | `f9bce43` | 251 |
| 7 | `c0bc9e4` | 261 |
| 8 | `85adf1a` | 283 |
| 9 | `8b42219` | 297 |
| 10 | `022f917` | 324 |
| 11 | `be05388` | 354 |
| 12 | `c769c09` | 394 |
| 13 | `8450e40` | 404 |
| 14 (final) | `f7a7a14` | 405 |

Increase of 154 tests across 27 task commits.

## Branch state

- Branch: `plan-5-ui`
- Last commit: `f7a7a14`
- 60 commits ahead of `main` (from `a472d58`)
- Lint clean, typecheck clean, 405/405 tests passing
- Ready to merge via `superpowers:finishing-a-development-branch` or PR
