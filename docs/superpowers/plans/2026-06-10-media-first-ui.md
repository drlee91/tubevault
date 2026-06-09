# Media-first UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild TubeVault's visual layer as a media-first app (direction A): dark red-accent design system, hero playlist pages, per-kind one-click download duo, queue overlay instead of a permanent sidebar, real player bar.

**Architecture:** Token swap first (all components already consume `var(--color-*)`), then one shared new component (`DownloadDuo`), then shell → player → pages, each task independently committable and browser-verified. No backend changes here — depends on plan `2026-06-10-dual-format-downloads.md` being done (per-kind `pendingJobs`, dual-format counting).

**Tech Stack:** Next.js 15, Tailwind v4 (`@theme` tokens in `app/globals.css`), Base UI primitives in `components/ui/*`, lucide-react, vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-06-10-media-first-redesign-design.md` §2–§7.

**Verification rule for every task:** `npm run typecheck` + affected vitest files + browser check via preview server (`tubevault-prod`, port 3000) with browser-use (`$env:PYTHONIOENCODING = "utf-8"` per call). Screenshot at default width AND `--window-size` ultrawide is covered by the user's 5120px display; check 1280px via `browser-use eval` viewport resize is not supported — instead verify the `max-w` container visually at full width (content must be centered, not smeared).

---

### Task 1: New design tokens

**Files:**
- Modify: `app/globals.css` (lines 7-40 `@theme` blocks; leave the shadcn `@theme inline`/`:root`/`.dark` blocks at lines 50-160 untouched — `components/ui/*` consume those)

- [ ] **Step 1: Replace the custom token blocks**

Replace lines 7-40 (`@theme` + `prefers-color-scheme` block) with — dark is now the design default, light kept usable via `.light` class (next-themes `attribute="class"`; check `components/theme-provider.tsx` and set `attribute="class"` if it is not already):

```css
@theme {
  /* dark — design default */
  --color-bg: #0e0f12;
  --color-fg: #ededef;
  --color-muted: #8e9095;
  --color-faint: #5f6166;
  --color-muted-bg: #17181c;       /* surface */
  --color-surface-2: #1c1d22;      /* menus, popovers */
  --color-border: #26272c;
  --color-accent: #e5484d;
  --color-accent-fg: #fcebeb;
  --color-ok: #46a758;
  --color-warn: #f0a030;
  --color-danger: #e5484d;

  --color-status-available: #46a758;
  --color-status-private: #f0a030;
  --color-status-removed: #e5484d;
  --color-status-unknown: #8e9095;
  --color-status-bg-available: color-mix(in oklch, #46a758 14%, transparent);
  --color-status-bg-private: color-mix(in oklch, #f0a030 14%, transparent);
  --color-status-bg-removed: color-mix(in oklch, #e5484d 14%, transparent);
  --color-status-bg-unknown: color-mix(in oklch, #8e9095 14%, transparent);

  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

.light {
  --color-bg: #fafafa;
  --color-fg: #1a1a1f;
  --color-muted: #6b6d73;
  --color-faint: #9a9ca1;
  --color-muted-bg: #f0f0f2;
  --color-surface-2: #ffffff;
  --color-border: #e2e2e6;
  --color-accent: #d93036;
  --color-accent-fg: #ffffff;
  --color-ok: #2f8a45;
  --color-warn: #b06a10;
  --color-danger: #d93036;
  --color-status-available: #2f8a45;
  --color-status-private: #b06a10;
  --color-status-removed: #d93036;
  --color-status-unknown: #6b6d73;
}
```

Note: `.light` overrides must come AFTER the `@theme` block; Tailwind v4 emits `@theme` vars on `:root`, so a plain `.light { … }` class block wins by specificity when next-themes puts `light` on `<html>`.

- [ ] **Step 2: Verify in browser**

`npm run build` + preview-start. Whole app shifts to the new dark palette (existing class names already reference these vars). Expect rough edges (old accent was orange-ish, pills recolored) — fine; later tasks fix composition. Check Settings → theme switch to light still renders readable text.

- [ ] **Step 3: Run full tests, commit**

Run: `npm test` — components don't assert colors; expected green.

```bash
git add app/globals.css components/theme-provider.tsx
git commit -m "feat(ui): media-first token palette, dark by default"
```

---

### Task 2: DownloadDuo component (the central affordance)

**Files:**
- Create: `components/playlists/download-duo.tsx`
- Test: `components/playlists/download-duo.test.tsx`
- Modify (consume): `components/playlists/track-row.tsx` (replace the icon column from commit `001dba2`)

Per spec §5: two slots (audio, video), four states each — present (green icon, tooltip), missing (dim icon, click = enqueue), in-flight (spinner), failed (red icon, click = retry).

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as videoActions from "@/lib/actions/video-actions";
import * as jobActions from "@/lib/actions/job-actions";
import { DownloadDuo } from "./download-duo";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const base = { videoId: 7, canDownload: true, onMutate: vi.fn() };

describe("<DownloadDuo>", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders green present state with format tooltip", () => {
    render(<DownloadDuo {...base} audio={{ state: "present", format: "mp3", sizeBytes: 5_000_000 }} video={{ state: "missing" }} />);
    expect(screen.getByLabelText(/audio downloaded \(mp3/i)).toBeInTheDocument();
  });

  it("missing slot is a button that enqueues that kind", async () => {
    const spy = vi.spyOn(videoActions, "downloadVideoAction").mockResolvedValue({ ok: true, data: { jobId: 1 } });
    render(<DownloadDuo {...base} audio={{ state: "missing" }} video={{ state: "present", format: "mp4" }} />);
    await userEvent.click(screen.getByRole("button", { name: /download audio/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(7, "audio"));
  });

  it("in-flight slot shows progress and is inert", () => {
    render(<DownloadDuo {...base} audio={{ state: "pending", status: "running" }} video={{ state: "missing" }} />);
    expect(screen.getByLabelText(/audio download running/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download audio/i })).toBeNull();
  });

  it("failed slot retries the job", async () => {
    const spy = vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({ ok: true, data: { retried: true } });
    render(<DownloadDuo {...base} audio={{ state: "failed", jobId: 42 }} video={{ state: "missing" }} />);
    await userEvent.click(screen.getByRole("button", { name: /retry audio download/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(42));
  });

  it("missing slot is disabled when canDownload is false", () => {
    render(<DownloadDuo {...base} canDownload={false} audio={{ state: "missing" }} video={{ state: "missing" }} />);
    expect(screen.getByRole("button", { name: /download audio/i })).toBeDisabled();
  });
});
```

Pre-check: `lib/actions/job-actions.ts` — confirm `retryJobAction(jobId)` exists (the Activity page retry button uses one; reuse it. If it lives elsewhere, e.g. `components/activity/retry-job-button.tsx` calls a route, extract/reuse that action and adjust the import in both test and component).

- [ ] **Step 2: Run tests → fail (module missing)**

- [ ] **Step 3: Implement `download-duo.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { Music, Film, Loader2, AlertCircle, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { downloadVideoAction } from "@/lib/actions/video-actions";
import { retryJobAction } from "@/lib/actions/job-actions";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FormattedBytes } from "@/components/shared/formatted-bytes";

export type DuoSlot =
  | { state: "present"; format: string; sizeBytes?: number }
  | { state: "missing" }
  | { state: "pending"; status: "queued" | "running" }
  | { state: "failed"; jobId: number };

interface Props {
  videoId: number;
  canDownload: boolean;
  audio: DuoSlot;
  video: DuoSlot;
  onMutate?: () => void;
}

function Slot({ kind, slot, videoId, canDownload, onMutate }: { kind: "audio" | "video"; slot: DuoSlot; videoId: number; canDownload: boolean; onMutate?: () => void }) {
  const [pending, start] = useTransition();
  const Icon = kind === "audio" ? Music : Film;
  const label = kind === "audio" ? "Audio" : "Video";

  if (slot.state === "present") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex" aria-label={`${kind} downloaded (${slot.format})`} />}
        >
          <Icon className="h-4 w-4 text-[var(--color-ok)]" />
        </TooltipTrigger>
        <TooltipContent>
          {label} · {slot.format}{slot.sizeBytes ? <> · <FormattedBytes bytes={slot.sizeBytes} /></> : null}
        </TooltipContent>
      </Tooltip>
    );
  }
  if (slot.state === "pending" || pending) {
    const status = slot.state === "pending" ? slot.status : "queued";
    return (
      <span className="inline-flex" aria-label={`${kind} download ${status}`}>
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-muted)]" />
      </span>
    );
  }
  if (slot.state === "failed") {
    return (
      <button
        type="button"
        aria-label={`retry ${kind} download`}
        title={`${label} download failed — click to retry`}
        onClick={() => start(async () => {
          const r = await retryJobAction(slot.jobId);
          if (!r.ok) toast.error("Retry failed", { description: r.error.message });
          else onMutate?.();
        })}
        className="inline-flex rounded p-0.5 text-[var(--color-danger)] hover:bg-[var(--color-muted-bg)]"
      >
        <AlertCircle className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={`download ${kind}`}
      title={canDownload ? `Download ${label.toLowerCase()}` : "Not downloadable"}
      disabled={!canDownload}
      onClick={() => start(async () => {
        const r = await downloadVideoAction(videoId, kind);
        if (!r.ok) toast.error("Download failed", { description: r.error.message });
        else onMutate?.();
      })}
      className={cn(
        "group/slot inline-flex rounded p-0.5 text-[var(--color-faint)]",
        canDownload && "hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-fg)]",
        !canDownload && "opacity-40",
      )}
    >
      <Icon className="h-4 w-4 group-hover/slot:hidden" />
      <ArrowDownToLine className="hidden h-4 w-4 group-hover/slot:block" />
    </button>
  );
}

export function DownloadDuo(props: Props) {
  return (
    <div className="flex w-14 shrink-0 items-center justify-end gap-1.5">
      <Slot kind="audio" slot={props.audio} {...props} />
      <Slot kind="video" slot={props.video} {...props} />
    </div>
  );
}
```

(Adjust `TooltipTrigger`/`render` usage to match the existing Base-UI tooltip API used in `components/activity/job-row.tsx`.)

- [ ] **Step 4: Map item → slots in `track-row.tsx`**

Replace the static icon column from `001dba2` with:

```tsx
function slotFor(file: { format: string; fileSizeBytes: number } | null, job: { status: string; id: number } | null): DuoSlot {
  if (file) return { state: "present", format: file.format, sizeBytes: file.fileSizeBytes };
  if (job && (job.status === "queued" || job.status === "running")) return { state: "pending", status: job.status as "queued" | "running" };
  if (job && job.status === "failed") return { state: "failed", jobId: job.id };
  return { state: "missing" };
}
```

```tsx
<DownloadDuo
  videoId={item.video.id}
  canDownload={status === "available" || status === "unknown"}
  audio={slotFor(item.audioFile, item.pendingJobs.audio)}
  video={slotFor(item.videoFile, item.pendingJobs.video)}
  onMutate={onMutate}
/>
```

`TrackRow` gains an optional `onMutate?: () => void` prop; `playlist-detail-items.tsx` passes its existing SWR `mutate` down (read that file to find the revalidation handle — the detail page polls/mutates after actions already).

- [ ] **Step 5: Tests + typecheck + browser**

Run: `npx vitest run components/playlists/` + `npm run typecheck`.
Browser: row of a missing-audio item shows dim icon → click → spinner → after job completes (poll) green icon. Verify with Lustlord-like fixture or live item.

- [ ] **Step 6: Commit**

```bash
git add components/playlists/download-duo.tsx components/playlists/download-duo.test.tsx components/playlists/track-row.tsx components/playlists/playlist-detail-items.tsx
git commit -m "feat(ui): one-click per-kind download duo in track rows"
```

---

### Task 3: App shell — content width, sidebar accent, calm topbar

**Files:**
- Modify: `components/app-shell.tsx` (max-width wrapper around `<main>` content, drop `<QueueSidebar />`)
- Modify: `components/sidebar.tsx` (active accent marker, 220px)
- Modify: `components/topbar.tsx` + `components/topbar/topbar-job-badge.tsx` (dot indicator)
- Delete usage (file stays until Task 4): `components/player/queue-sidebar.tsx`

- [ ] **Step 1: Shell layout**

In `app-shell.tsx` replace the main flex block:

```tsx
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 overflow-auto pb-32 md:pb-24">
            <div className="mx-auto w-full max-w-[1400px] px-6">{children}</div>
          </main>
        </div>
```

(`<QueueSidebar />` import + element removed.)

- [ ] **Step 2: Sidebar active state**

In `sidebar.tsx`, the active link classes become: `relative text-[var(--color-fg)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--color-accent)]` — inactive: `text-[var(--color-muted)] hover:text-[var(--color-fg)]`. Read the file for the exact active-detection logic (usePathname) and keep it.

- [ ] **Step 3: Topbar job indicator**

`topbar-job-badge.tsx` currently renders "N failed" text. Replace with: spinner glyph (`Loader2 animate-spin`, muted) while `running > 0`; red dot + count chip (`bg-[var(--color-danger)] text-[var(--color-accent-fg)] rounded-full px-1.5 text-xs`) only when `failed > 0`; otherwise nothing. Keep the link to `/activity` and the aria-label "Active jobs". Keep the SWR polling exactly as-is.

- [ ] **Step 4: Tests, typecheck, browser, commit**

`npm test` (queue-sidebar tests still pass — component exists, just unmounted; topbar badge tests may assert old text → update them). Browser: content centered at 1400px, queue gone, sidebar accent on active item.

```bash
git add components/app-shell.tsx components/sidebar.tsx components/topbar.tsx components/topbar/topbar-job-badge.tsx
git commit -m "feat(ui): centered content shell, accent sidebar, calm job indicator"
```

---

### Task 4: Queue overlay panel

**Files:**
- Create: `components/player/queue-panel.tsx` (slide-over wrapper hosting existing `<QueueList />`)
- Modify: `lib/player/store.ts` — mode gains nothing new; reuse existing `mode: "queue-open"` semantics (openQueue/closeOverlays already exist)
- Modify: `components/player/player-bar.tsx` (queue button toggles `openQueue`/`closeOverlays`)
- Delete: `components/player/queue-sidebar.tsx` + its test; `components/player/queue-drawer.tsx` stays for mobile (read it first — if it already implements a sheet, the panel can wrap the same pattern for desktop)
- Modify: `components/app-shell.tsx` (mount `<QueuePanel />`)

- [ ] **Step 1: Implement panel**

```tsx
"use client";
import { X } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { QueueList } from "./queue-list";

export function QueuePanel() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "queue-open");
  if (!open) return null;
  return (
    <aside className="fixed bottom-[72px] right-4 top-16 z-20 hidden w-[360px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-xl md:flex" aria-label="Queue">
      <div className="flex items-center justify-end border-b border-[var(--color-border)] px-2 py-1">
        <button type="button" aria-label="Close queue" onClick={() => store.getState().closeOverlays()} className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto"><QueueList /></div>
    </aside>
  );
}
```

- [ ] **Step 2: Wire toggle in player bar**

The existing "Open queue" button calls `openQueue()`; make it a toggle: `mode === "queue-open" ? closeOverlays() : openQueue()` with `aria-pressed`.

- [ ] **Step 3: Remove queue-sidebar**

Delete `queue-sidebar.tsx` + `queue-sidebar.test.tsx`. Mount `<QueuePanel />` in `app-shell.tsx` next to the other overlays. Add a small panel test mirroring the old sidebar test (renders QueueList when mode is queue-open, null otherwise).

- [ ] **Step 4: Tests, browser (open/close/drag-reorder inside panel), commit**

```bash
git add components/player/queue-panel.tsx components/player/queue-panel.test.tsx components/app-shell.tsx components/player/player-bar.tsx
git rm components/player/queue-sidebar.tsx components/player/queue-sidebar.test.tsx
git commit -m "feat(player): queue becomes a toggleable overlay panel"
```

---

### Task 5: Player bar

**Files:**
- Modify: `components/player/player-bar.tsx` (full restyle, structure preserved: artwork, title block, transport, seek, right cluster)
- Test: `components/player/player-bar.test.tsx` (selectors by aria-label — keep labels stable)

- [ ] **Step 1: Restyle**

Target structure (keep ALL existing handlers, store wiring, aria-labels):

- Bar: `fixed inset-x-0 bottom-0 z-20 h-[72px] border-t border-[var(--color-border)] bg-[var(--color-muted-bg)]`, inner grid `grid-cols-[1fr_auto_1fr]` with `max-w-[1400px] mx-auto px-4`.
- Left: 48px artwork (`rounded-md object-cover`, click → `openFullscreen()`, `aria-label="Open fullscreen"` moves here as well — keep the existing right-cluster fullscreen button too), two-line title/channel.
- Center: transport row (shuffle, prev, play, next, repeat). Play button: `h-10 w-10 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] grid place-items-center hover:scale-105 transition-transform`.
- Seek: replace the 2px top-edge slider with an in-bar row under the transport: time (mono, 11px) — slider — duration. Slider track `h-1.5 rounded-full bg-[var(--color-border)]`, fill `bg-[var(--color-accent)]`, thumb appears on hover (`group-hover:opacity-100 opacity-0 h-3 w-3 rounded-full bg-[var(--color-fg)]`). Keep the existing `role="slider"` keyboard/pointer logic — restyle only.
- Right: volume (existing), queue toggle (Task 4), fullscreen.

- [ ] **Step 2: Tests + browser (seek by click still lands within ±1s — repeat the click-at-50% check), commit**

```bash
git add components/player/player-bar.tsx components/player/player-bar.test.tsx
git commit -m "feat(player): 72px media bar with real seek slider"
```

---

### Task 6: Playlist detail hero

**Files:**
- Create: `components/playlists/cover-mosaic.tsx` (2×2 thumbnail grid, `size` prop)
- Modify: `components/playlists/playlist-detail-header.tsx` (hero layout, overflow menu)
- Modify: `app/playlists/[id]/page.tsx` (pass first 4 item thumbnails to the header — read the page to see how `items` flow; they already reach the header via props)
- Test: `components/playlists/playlist-detail-header.test.tsx` (exists? if not, create: renders title, play calls setQueue, overflow contains Sync/Delete)

- [ ] **Step 1: CoverMosaic**

```tsx
export function CoverMosaic({ thumbs, className }: { thumbs: Array<string | null>; className?: string }) {
  const four = [...thumbs.filter(Boolean), null, null, null, null].slice(0, 4);
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 overflow-hidden rounded-lg bg-[var(--color-muted-bg)]", className)}>
      {four.map((t, i) =>
        t ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={t} alt="" className="h-full w-full object-cover" />
        ) : (
          <div key={i} className="h-full w-full bg-[var(--color-surface-2)]" />
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 2: Hero layout**

Header becomes: flex row, `CoverMosaic` at `h-40 w-40`, right column with eyebrow `PLAYLIST` (11px, tracking-wide, muted), `text-3xl font-semibold` title, meta line, then progress block:

```tsx
<div className="mt-3 max-w-md">
  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
    <div className="h-full bg-[var(--color-ok)]" style={{ width: `${pct}%` }} />
  </div>
  <p className="mt-1.5 text-xs text-[var(--color-muted)]">
    {playlist.stats.downloadedItems} von {playlist.stats.totalItems} vollständig
    {missing > 0 && (
      <> · <DownloadMissingButton playlistId={playlist.id} variant="link" /></>
    )}
  </p>
</div>
```

`DownloadMissingButton` gains a `variant?: "button" | "link"` prop — link variant renders `<button className="text-[var(--color-accent)] hover:underline">Fehlende laden</button>` with the same action/toast logic.

Actions row: accent play circle (`h-12 w-12 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)]`, aria-label "Play all"), outline shuffle circle, then a `DropdownMenu` ("···", aria-label "Playlist actions") containing: Sync now (reuses `syncPlaylistAction` logic from `sync-now-button.tsx` — move the handler into the menu item, delete the standalone button from the header), Playback preference (submenu or dialog later — for now a disabled informational item showing current preference), Delete (opens the existing `DeletePlaylistButton` confirm flow — read that file; if it already wraps a confirm dialog, trigger it from the menu item).

- [ ] **Step 3: Tests + typecheck + browser (hero renders, play works, sync/delete reachable via menu), commit**

```bash
git add components/playlists/cover-mosaic.tsx components/playlists/playlist-detail-header.tsx components/playlists/download-missing-button.tsx components/playlists/sync-now-button.tsx app/playlists/[id]/page.tsx
git commit -m "feat(ui): playlist hero with mosaic, progress and overflow actions"
```

---

### Task 7: Track rows, media-first

**Files:**
- Modify: `components/playlists/track-row.tsx`
- Modify: `components/playlists/track-table.tsx` (row spacing/zebra removal if any)
- Modify: `components/playlists/item-filter-chips.tsx` (quiet segmented control restyle)
- Tests: existing row/table tests

- [ ] **Step 1: Restyle row**

64px row (`h-16`), structure: index/now-playing (w-8) → thumbnail `h-12 w-[85px] rounded-md object-cover` wrapped in a relative group with hover play overlay (`absolute inset-0 grid place-items-center bg-black/50 opacity-0 group-hover:opacity-100`, `Play` icon) wired to the existing `onPlay` → title block (`text-sm font-medium` + muted channel, two-line clamp) → `DownloadDuo` (Task 2, already mounted) → duration (`font-mono text-xs text-[var(--color-muted)]`) → context menu.

**Remove `StatusPill` from the row entirely** (spec §4/§5): availability problems render as: row content at `opacity-60` when `status` is removed/private/etc. (not for unknown), and the duo tooltip/context menu carry the explanation. `JobStatusPill` usage in the row is also superseded by the duo's pending state — delete both imports. `RelativeTime` (addedAt) drops out of the row (lives in context menu as a line item or nowhere — YAGNI: drop it).

- [ ] **Step 2: Update row tests**

`track-row` tests asserting pill text/addedAt change to assert: dimmed class for removed items, duo presence (by aria-labels), duration rendering.

- [ ] **Step 3: Tests + browser (hover play overlay works, duo clickable, removed rows dimmed), commit**

```bash
git add components/playlists/track-row.tsx components/playlists/track-table.tsx components/playlists/item-filter-chips.tsx
git commit -m "feat(ui): media-first track rows with hover play and duo"
```

---

### Task 8: Library grid + standalone rows

**Files:**
- Modify: `components/playlists/playlist-card.tsx` (mosaic card)
- Modify: `components/playlists/playlist-list.tsx` (grid: `grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]`)
- Modify: `components/playlists/standalone-list.tsx` (adopt Task 7 row style; it has its own row markup — port the same classes + DownloadDuo with `videoFile`/`audioFile` data it already loads; read the file first, it uses `VideoWithKinds` which may need media-file detail — if size/format aren't available there, duo renders present-state without size tooltip via `format: "mp3"|"mp4"` fallback from kind)
- Test: existing card/list tests

- [ ] **Step 1: Card**

```tsx
export function PlaylistCard({ p }: { p: PlaylistStatsRow }) {
  const syncing = p.activeSyncRunId !== null;
  const pct = p.stats.totalItems > 0 ? Math.round((p.stats.downloadedItems / p.stats.totalItems) * 100) : 0;
  return (
    <Link href={`/playlists/${p.id}`} className="group block overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted-bg)] transition-colors hover:border-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
      <div className="relative aspect-square">
        <CoverMosaic thumbs={p.coverThumbs ?? []} className="h-full w-full rounded-none" />
        <span className="absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] opacity-0 transition-opacity group-hover:opacity-100"><Play className="h-5 w-5" /></span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{p.title ?? p.url}</h3>
          {syncing && <RefreshCw className="h-3 w-3 animate-spin text-[var(--color-accent)]" aria-label="syncing" />}
        </div>
        <p className="truncate text-xs text-[var(--color-muted)]">{p.channelTitle ?? "—"} · {p.stats.totalItems} Titel</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-border)]"><div className="h-full bg-[var(--color-ok)]" style={{ width: `${pct}%` }} /></div>
      </div>
    </Link>
  );
}
```

`coverThumbs`: extend `PlaylistStatsRow` + `mapStatsRow`/queries with a `cover_thumbs` subselect (`SELECT json_group_array(thumbnail_url) FROM (SELECT v.thumbnail_url FROM playlist_items pi JOIN videos v ON v.id = pi.video_id WHERE pi.playlist_id = p.id AND pi.in_playlist = 1 AND v.thumbnail_url IS NOT NULL ORDER BY pi.position LIMIT 4)`), parsed via `JSON.parse` in the mapper with `string[]` type + repo test. The hover play overlay on the card is visual-only in this task (navigates on click); wiring card-level play is YAGNI until asked.

- [ ] **Step 2: Tests (repo test for coverThumbs, card test updated) + browser + commit**

```bash
git add components/playlists/playlist-card.tsx components/playlists/playlist-list.tsx components/playlists/standalone-list.tsx lib/db/repositories/playlist-repo.ts lib/db/repositories/__tests__/playlist-repo.test.ts
git commit -m "feat(ui): library card grid with mosaics and progress"
```

---

### Task 9: Dashboard

**Files:**
- Modify: `components/dashboard/stats-cards.tsx` (readable labels: `text-[13px] text-[var(--color-muted)]` label, `text-2xl font-semibold` value, `bg-[var(--color-muted-bg)] rounded-xl p-4`, no border)
- Modify: `components/dashboard/recent-activity.tsx` (rows: status icon (`Check`/`X`/`Loader2` colored by `--color-ok/--color-danger/--color-muted`) + playlist link + "+n / −n" deltas + `RelativeTime`; drop pills)
- Create: `components/dashboard/continue-listening.tsx` (client component: reads persisted player slice from `localStorage["tubevault.player"]` after mount, renders horizontally scrolling cards (thumbnail, title, position/duration); clicking a card `setQueue(queue, index)` + `seek(position)` + `play()` via the player store; renders nothing when no persisted queue)
- Modify: `app/page.tsx` (mount the strip between stats and activity — read the page for its server/client boundary; the strip must be inside `PlayerStoreProvider`, which wraps everything via `AppShell`, so a client component on the page is fine)
- Test: `components/dashboard/continue-listening.test.tsx` (renders cards from a stubbed localStorage payload; click restores queue — assert store state)

- [ ] **Step 1: Implement + tests (failing → passing)**

Persisted shape comes from `lib/player/persist.ts` (`PersistedSlice`: `queue`, `currentIndex`, `position`, …) — import the type, parse defensively (try/catch → null → render nothing).

- [ ] **Step 2: Browser check (dashboard shows strip after playing something; stat labels readable), commit**

```bash
git add components/dashboard/ app/page.tsx
git commit -m "feat(ui): readable dashboard with continue-listening strip"
```

---

### Task 10: Activity + Settings restyle

**Files:**
- Modify: `components/activity/job-row.tsx`, `history-row.tsx` (surface rows: `bg-[var(--color-muted-bg)] border-[var(--color-border)]`; keep expandable error panel + copy button exactly as-is)
- Modify: `components/shared/job-status-pill.tsx`, `job-type-badge.tsx`, `status-pill.tsx` (palette only: map to `--color-ok/-warn/-danger/-muted` token usage; pills legitimately live on these pages)
- Modify: `components/settings/*-section.tsx` copy: "Default format" → "Playback preference" (grep `Default format` across `components/settings/` and `components/add/add-playlist-dialog.tsx` — the add dialog keeps the picker but relabels it; it now only steers playback)
- Tests: existing

- [ ] **Step 1: Restyle + relabel, update any text-asserting tests**
- [ ] **Step 2: `npm test` + browser sweep of `/activity` (tabs, expand error, retry) and `/settings` (all tabs render, theme switch works), commit**

```bash
git add components/activity/ components/shared/ components/settings/ components/add/add-playlist-dialog.tsx
git commit -m "feat(ui): activity and settings in the new palette, playback-preference copy"
```

---

### Task 11: Fullscreen player views + mobile

**Files:**
- Modify: `components/player/fullscreen-audio.tsx` (artwork ≤480px `rounded-xl`, title block, slider matching Task 5 styling, transport with accent play; structure/handlers/tests unchanged)
- Modify: `components/player/fullscreen-video.tsx` (controls restyle only: `bg-black/60 backdrop-blur rounded-lg` buttons; mechanism from `fc11cc3` untouched)
- Modify: `components/player/mobile-sheet.tsx`, `components/bottom-nav.tsx` (palette + accent active state)
- Tests: existing player tests

- [ ] **Step 1: Restyle, keep all aria-labels/handlers**
- [ ] **Step 2: Browser: fullscreen audio (tabs Now Playing/Queue), fullscreen video (controls overlay video, Esc closes), commit**

```bash
git add components/player/fullscreen-audio.tsx components/player/fullscreen-video.tsx components/player/mobile-sheet.tsx components/bottom-nav.tsx
git commit -m "feat(ui): fullscreen and mobile player views in the new style"
```

---

### Task 12: Cleanup + final sweep

**Files:**
- Modify: `lib/db/repositories/playlist-item-repo.ts` (remove the now-unconsumed legacy `pendingJob` field + its `j` join IF no component references it — grep first)
- Modify: `components/shared/status-pill.tsx` (delete only if Activity stopped using it — it did not; keep)
- Verify: no `--color-status-bg-*` orphans, no hardcoded hex in components (`grep -rn "#[0-9a-fA-F]\{6\}" components/ --include="*.tsx"` → expect zero outside svg fills)

- [ ] **Step 1: Grep-driven cleanup, typecheck, full `npm test`**
- [ ] **Step 2: Full browser sweep**: dashboard → library → playlist detail (play, seek, fullscreen, duo download, download missing, queue panel) → activity (expand error, retry) → settings (theme light/dark) — all at production build.
- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(ui): remove legacy pending-job plumbing and final polish"
```

---

## Self-review notes (spec → tasks)

- §1 download model → backend plan (separate). §2 tokens → Task 1. §3 shell/queue → Tasks 3-4. §4 dashboard/library/detail/activity/settings → Tasks 9/8/6-7/10/10. §5 duo → Task 2 (+7 mounting). §6 player → Tasks 5/11. §7 guardrails → embedded in every task (tests, aria, tokens, browser verify).
- "Continue listening" uses only client-side persisted state — no backend (spec §4 dashboard).
- `coverThumbs` is the single new repo surface in this plan; tested in Task 8.
- Playback-preference editing UI is intentionally a stub menu item (spec lists copy change only; YAGNI).
