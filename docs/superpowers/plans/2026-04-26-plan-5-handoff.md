# Plan 5 — Handoff (Mid-Execution)

**Date:** 2026-04-27
**Status:** 20/47 tasks complete (~43%). Phases 1–6 done. Phase 7 (UI) ahead.
**Worktree:** `C:/Users/stein/RiderProjects/TubeVault/.worktrees/plan-5-ui`
**Branch:** `plan-5-ui`
**Last commit:** `f4f3e74` — `feat(ui): SWR fetcher + polling hooks (detail, jobs, summary, standalone, usage)`
**Tests:** 251/251 passing across 56 test files

## Resuming in a new session

```
Read HANDOFF: docs/superpowers/plans/2026-04-26-plan-5-handoff.md
Read PLAN:    docs/superpowers/plans/2026-04-26-plan-5-ui-implementation.md
Read SPEC:    docs/superpowers/specs/2026-04-26-plan-5-ui-design.md

Resume Plan 5 execution at Task 21 using superpowers:subagent-driven-development.
Worktree is .worktrees/plan-5-ui, branch plan-5-ui. Last commit f4f3e74.
```

The next task is **Task 21 — TopbarJobBadge**. The plan is structured as 14 phases / 47 tasks. Phases 1–6 are complete (Setup, Shared building blocks, Service-Layer extensions + test helpers, API extensions, Server Actions, SWR hooks). Phases 7–14 are pure UI work (Topbar, Dashboard, Playlists list, Detail page, Activity, Settings, Mobile, Integration).

## Commits to date (chronological)

| # | SHA | Subject |
|---|---|---|
| 1 | `92717f2` | chore(plan-5): add swr, next-themes, react-hook-form, sonner, shadcn |
| 2 | `ec76772` | feat(ui): add shadcn primitives (dialog, input, select, tabs, …) |
| 3 | `03b81e4` | feat(ui): theme provider, toaster, status color tokens |
| 4 | `f454993` | feat(ui): status + job pills, job-type badge |
| 5 | `cf6e1ec` | feat(ui): duration, formatted-bytes, relative-time helpers |
| 6 | `a076414` | feat(ui): empty-state, error-card, skeleton-row primitives |
| 7 | `9a2c114` | test(ui): boot-test-context helper + server-action override hook |
| 8 | `157915f` | feat(api): PlaylistService.listWithStats + getDetailFull |
| 9 | `e43362a` | feat(api): VideoService.listStandalone, forceDownload, enqueueRefresh |
| 10 | `b12e14f` | feat(api): JobService — summary, list-with-subjects, retry |
| 11 | `6a658f1` | feat(api): GET /api/playlists/[id] full shape (closes F1) |
| 12 | `535c6e2` | feat(api): /api/jobs (list, summary, retry) endpoints |
| 13 | `8423bce` | feat(api): /api/videos (list standalone, download, refresh) |
| 14 | `df6b5cf` | feat(api): GET /api/storage/usage |
| 15 | `104251b` | feat(ui): ActionResult type + service-error mapper |
| 16 | `c9da0a6` | feat(ui): playlist server actions (add, sync, delete) |
| 17 | `2e57580` | feat(ui): video server actions (add, download, refresh) |
| 18 | `e0aef0a` | feat(ui): job retry server action |
| 19 | `c9b36a7` | feat(ui): updateSettingsAction (partial patch) |
| 20 | `f4f3e74` | feat(ui): SWR fetcher + polling hooks (detail, jobs, summary, standalone, usage) |

## Lessons-Learned — apply to remaining tasks

These were discovered during execution and are NOT in the original plan. The next session must respect them.

### 1. shadcn `add` overwrite hazard

`shadcn init` and `shadcn add` will overwrite existing components without asking under `--yes`. The TubeVault project has hand-written `components/ui/{badge,button,card}.tsx` that use TubeVault tokens (`var(--color-fg)`, sizes `sm | md | lg`). **NEVER let shadcn touch them.**

If a future task runs `shadcn add <new-primitive>`:

- Use the explicit list in the task — do NOT pass `badge`/`button`/`card`.
- After `shadcn add`, run `git diff components/ui/{button,badge,card}.tsx` — should show no changes. If anything shows, restore from main: `git checkout main -- components/ui/<file>.tsx`.

### 2. Canonical `cn` helper is `@/lib/utils` (not `@/lib/utils/cn`)

`lib/utils/cn.ts` was deleted in Task 1 fix. All UI components import from `@/lib/utils`. Existing repos check has confirmed no `@/lib/utils/cn` references remain in non-doc files.

### 3. Component overrides we made

- `components/ui/dialog.tsx` — close-button uses `size="sm"` (TubeVault button has no `icon-sm` size). Stay with `size="sm"`.
- `components/ui/form.tsx` — adapted from shadcn without `@radix-ui/react-slot` (project uses base-ui). `FormControl` wraps `<div>` instead of `Slot`. **Known small bug:** `FormControl` sets `id={formItemId}` on the wrapper-div, so `<FormLabel htmlFor>` points to the div, not the input. `aria-describedby` for error/description is correct. Click-on-Label does not focus the input. **Fix this before Task 22 (AddPlaylistDialog) lands.** Cleanest fix: install `@radix-ui/react-slot` (~1 KB) and use the original Slot pattern. Or apply id via `cloneElement` to the single child.

### 4. `BootContext` and `TestBootContext` shapes (current)

`lib/boot.ts` `BootContext`:

```ts
{
  dbPath: string;
  settingsService: SettingsService;
  selfCheckService: SelfCheckService;
  registry: ProviderRegistry;
  queue: JobQueue;
  workerPool: WorkerPool;
  syncService: SyncService;
  downloadService: DownloadService;
  playlistService: PlaylistService;
  videoService: VideoService;
  jobRepo: JobRepo;            // added in Task 12
  mediaFileRepo: MediaFileRepo; // added in Task 14
}
```

`lib/test-utils/boot-test-context.ts` `TestBootContext` mirrors `BootContext` plus exposes:

```ts
{
  db: drizzle instance,
  playlistRepo, videoRepo, itemRepo, mediaFileRepo, syncRunRepo, jobRepo,
  cleanup(): void,
}
```

### 5. `FakeYouTubeAdapter` lives inline in `boot-test-context.ts`

Plan 2 didn't extract it. Task 7 created a minimal inline fake. If a future test needs different fake behavior (e.g. seeded playlist items), either extend the inline fake's defaults or refactor it out to `tests/fixtures/fake-youtube-adapter.ts` — that's an acceptable scope-grow.

### 6. WorkerPool must NOT auto-attach in tests

Task 12 fix: `lib/test-utils/boot-test-context.ts` does **not** call `queue.attachWorker(workerPool)`. The pool's `signal()` triggers `dispatch()` regardless of whether `start()` was called, and queued jobs would get claimed-and-failed (no handlers in tests). All Phase 4+ tests rely on this fix. Don't add `attachWorker` back without good reason.

### 7. `revalidatePath` must be mocked in server-action tests

```ts
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
```

at the top of every `*-actions.test.ts` file. Without this, calls inside server actions throw `"Invariant: static generation store missing"` (caught by the action's `try/catch` and surfaced as `INTERNAL` error).

### 8. `VideoService.addStandalone({url, format})` — not `create`

Task 17 confirmed the actual method name. Plan §8.6 spec called it `create`/`add`. The implementation is `addStandalone`. Returns `{video: VideoRow, downloadJobId: number}`.

### 9. `mapServiceError` — current full mapping

`lib/actions/map-error.ts` covers:

- `PlaylistAlreadyTrackedError` → `PLAYLIST_ALREADY_TRACKED`
- `UrlNotPlaylistError` → `URL_NOT_PLAYLIST`
- `ProviderUnsupportedError` → `PROVIDER_UNSUPPORTED`
- `VideoNotAvailableError` → `VIDEO_NOT_AVAILABLE`
- `VideoNotFoundError` → `VIDEO_NOT_FOUND`
- `JobNotFoundError` → `JOB_NOT_FOUND`
- `NotRetryableError` → `NOT_RETRYABLE`
- `UrlNotVideoError` → `URL_NOT_VIDEO`              (added in Task 17)
- `VideoAlreadyTrackedError` → `VIDEO_ALREADY_TRACKED` (added in Task 17)
- (fallback) → `INTERNAL`

If future tasks add new domain errors, extend this map AND add a unit test in `map-error.test.ts`.

### 10. `.gitignore` `storage/` glob hits `app/api/storage/`

Task 14 used `git add -f` to add `app/api/storage/usage/route.ts`. Followup: change `.gitignore` from `storage/` to `/storage/` (root-anchored) so user-data dir stays ignored but app routes don't get blocked. Not done yet — apply when convenient.

### 11. Vitest config: `lib/client/**/*.test.tsx` was added to dom project

Task 20 extended `vitest.config.ts` (or wherever the project config lives) so JSX hook tests in `lib/client/` use the happy-dom environment. If future hooks tests are added in other dirs, similar inclusion may be needed.

### 12. JobsList / JobSummary canonical export

Defined in `lib/db/repositories/job-repo.ts`. Re-exported from `lib/services/job-service.ts`. UI hooks (`use-jobs.ts`, `use-job-summary.ts`) import from the **service**, not the repo. Stick to that.

## Followups to record (not yet done)

These are not blockers but should land before Plan 5 closes (Task 47 cleanup):

1. **`form.tsx` Slot fix** (urgent — fix before Task 22)
2. **`.gitignore`** change `storage/` → `/storage/`
3. **Optional refactor:** extract `FakeYouTubeAdapter` from `boot-test-context.ts` into `tests/fixtures/fake-youtube-adapter.ts`
4. **Plan 2 followup F3** (registry.unregister) — F3 is now de-facto resolved by the worker-pool detachment in TestBootContext, but the original `unregister` method is still missing on `ProviderRegistry`. Decide if it's still needed.

## What's next (Phase 7+)

| Phase | Tasks | Subject |
|---|---|---|
| 7 | 21–24 | TopbarJobBadge, AddPlaylistDialog, AddVideoDialog, AddDropdown |
| 8 | 25 | Dashboard (StatsCards + RecentActivity + page) |
| 9 | 26–28 | PlaylistCard + PlaylistList, StandaloneList, PlaylistsTabs + /playlists page |
| 10 | 29–33 | SyncNowButton, DeletePlaylistButton, TrackContextMenu, TrackRow, TrackTable, ItemFilterChips, PlaylistDetailItems, /playlists/[id] page |
| 11 | 34–36 | HistoryRow, HistoryTab, JobsTab, RetryJobButton, JobRow, ActivityTabs + /activity |
| 12 | 37–41 | cron-presets, GeneralSection, StorageSection (+ usage display), AudioSection, VideoSection, SyncSection, AdvancedSection, SettingsTabs + /settings |
| 13 | 42–44 | BottomNav (mobile), Self-Check banner deep-links, Sheet variant for Add dialogs |
| 14 | 45–47 | E2E integration test, browser-use smoke + screenshots, final cleanup |

The plan file has full task text + code blocks. The next session should re-read it (don't trust memory of how it was structured).

## Run-state

Before starting Task 21, run:

```bash
cd C:/Users/stein/RiderProjects/TubeVault/.worktrees/plan-5-ui
git status                # should be clean
git log --oneline a472d58..HEAD | head -22   # 20 task commits + 1 plan commit
npm test -- --run | tail -5                  # 251 passing
```

If anything diverges, investigate before proceeding.
