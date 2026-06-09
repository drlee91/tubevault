# TubeVault Media-first Redesign — Design Spec

**Date:** 2026-06-10
**Status:** Approved by Nils (direction A media-first, red accent, full-app scope, dual-format downloads)

## Context

The current UI is a functional prototype: default shadcn-style components, colored status pills dominating track rows, a permanently visible (mostly empty) queue sidebar, a 2px seek slider, no content max-width on ultrawide displays, and download state that was invisible (sr-only) until 2026-06-10. Downloads were also blocked behind a per-track "Refresh availability" ritual and there was no bulk backfill; both fixed in `001dba2`.

Nils picked direction **A — media-first** (YouTube-Music-like player feel) over library-dense and hybrid alternatives, with a **red accent** and **full-app scope**, plus two functional mandates:

1. Downloading must be trivially easy, and a *missing* download must be obvious at a glance.
2. **Every item always gets both formats: MP3 and MP4.** No more choosing.

## Goals

- Media-first look and feel across the whole app (dashboard, library, playlist detail, activity, settings, player).
- Download state readable at a glance and fixable with one click, everywhere tracks are listed.
- Dual-format downloads as the only download model.
- Kill the prototype smells: pills overload, empty queue sidebar, hairline slider, unbounded layout width.

## Non-goals

- No new providers, no auth, no mobile app. Mobile-responsive layout stays at the current breakpoint quality bar.
- No light-mode redesign work beyond keeping tokens functional (dark is the design target; light must merely remain usable).
- No playlist editing features beyond what exists.

## 1. Download model (behavior change, independent of visuals)

- **Dual-format always.** Wherever the system enqueues downloads, it enqueues *both* kinds per video:
  - `SyncService.sync`: new available items → one `download_video` job per kind (audio + video).
  - `SyncService.downloadMissing`: per item, enqueue each kind that has no media file (so an item with only the MP3 gets just the MP4 job). Dedup must become **kind-aware**: today's `pendingJob` lookup (latest job per video) is kind-blind, so a queued audio job would wrongly suppress the video job — the lookup needs the job payload's `kind` (one pending-job slot per video×kind).
  - `VideoService.addStandalone`: enqueue both kinds.
- `playlists.default_format` is reinterpreted as **playback preference** only (which kind the player picks via `pickKind`). UI copy changes from "Default format" to "Playback preference" / "Bevorzugte Wiedergabe". No schema migration needed.
- Storage stays split: audio → `audioStoragePath`, video → `videoStoragePath` (existing settings).
- The track-row download indicator reflects both kinds independently (see §5).
- Disk cost is accepted and explicit (Nils' call): the dashboard disk-usage card already reports actuals.

## 2. Design system

Tokens in `app/globals.css` (CSS custom properties), consumed via Tailwind arbitrary values as today. Replace the current palette wholesale:

| Token | Dark (default) | Usage |
|---|---|---|
| `--color-bg` | `#0E0F12` | app background |
| `--color-surface` | `#17181C` | cards, rows hover, player bar |
| `--color-surface-2` | `#1C1D22` | elevated surfaces (menus, popovers) |
| `--color-border` | `#26272C` | hairlines |
| `--color-fg` | `#EDEDEF` | primary text |
| `--color-muted` | `#8E9095` | secondary text |
| `--color-faint` | `#5F6166` | tertiary text, disabled |
| `--color-accent` | `#E5484D` | play, primary actions, active nav, progress |
| `--color-accent-fg` | `#FCEBEB` | text/icons on accent |
| `--color-ok` | `#46A758` | downloaded/local, success |
| `--color-warn` | `#F0A030` | transient problems (queued retries) |
| `--color-danger` | `#E5484D` | failed, removed (shares accent hue; context disambiguates) |

Light-mode values mirror these semantically (token swap via `.light`/`prefers-color-scheme`, exact values picked during implementation; only bar: readable, not redesigned).

Rules:
- Red accent is rationed: play controls, one primary action per view, active nav item, progress fills. Never for decoration.
- Status communication: **icons + tooltips, not pills**, inside dense lists. Pills survive only on the Activity page where status IS the content.
- Typography: Inter (existing), `tabular-nums` + mono only for durations/counters. Weights 400/500/600 max.
- Radii: 8px standard, 12px cards, full for play buttons. Borders 1px `--color-border`.

## 3. App shell

- **Topbar:** logo, global search (existing scope), Add button (accent, icon+label), jobs indicator as a small dot/spinner cluster (red dot + count only when failures exist; subtle spinner while jobs run), settings icon. No more red "3 failed" text shouting in the corner — same information, one calm indicator.
- **Sidebar:** Home, Library, Activity. Active item gets accent text + 2px accent left-edge marker. Width 220px, collapses to icons under `lg`.
- **Queue sidebar is removed.** Queue becomes a right-side overlay panel (360px, slide-in) toggled from the player bar's queue button. Same QueueList internals (drag reorder, remove, broken badge).
- **Content column:** `max-width: 1400px`, centered, 24px gutters. Pages no longer smear across 5120px.
- BottomNav (mobile) unchanged structurally, restyled.

## 4. Pages

### Dashboard
- Stat cards: surface bg, 13px muted label (readable contrast — current cards are illegible), 24px value, no borders. Disk usage card keeps actual bytes.
- **"Continue listening"** strip: horizontally scrolling cards (thumbnail, title, resume position) sourced from the persisted player state (`localStorage` queue) — client-side only, no new backend.
- Recent activity: compact rows, icon + playlist + delta counts + relative time. Pills replaced by status icons.

### Library (`/playlists`)
- Playlist card grid (`repeat(auto-fill, minmax(240px, 1fr))`): cover mosaic (first 4 item thumbnails, 2×2), title, channel, item count, **download progress bar** (`downloadedItems/totalItems`, but see §5 for dual-format counting), sync-state glyph. Card click → detail; play button overlay on mosaic hover → queues playlist.
- Standalone tab: same row treatment as playlist detail rows.

### Playlist detail
- **Hero:** 160px cover mosaic, "PLAYLIST" eyebrow, large title, meta line (channel · n items · total duration), **download progress bar with label "x von n vollständig"** and an inline accent **"Fehlende laden"** action (= downloadMissing, now dual-format). Primary actions: accent play circle (Play All), shuffle outline circle, "···" overflow menu containing Sync now, Playback preference, Delete (with confirm). Delete leaves the main surface.
- **Track rows** (64px): index/play-on-hover, 96×54 thumbnail with hover play overlay, two-line title+channel, then the **download duo** (§5), duration (mono), context menu. Availability problems (removed/private) dim the row and annotate via the duo's tooltip + context menu; no pill.
- Filter chips (all/available/unavailable) and search stay, restyled as quiet segmented controls.

### Activity
- Keeps History/Jobs tabs and the expandable error panel (from `53ecfd1`). Restyled: cards → flat rows on surface, JobTypeBadge/JobStatusPill redrawn in the new palette (pills are legitimate here).

### Settings
- Existing sections restyled (cards on surface, consistent field rows). "Default format" copy → "Playback preference". System health stays.

## 5. Download duo (the central affordance)

Every track row (playlist detail, standalone list, search results) renders two fixed-position glyph slots: **MP3** and **MP4** (audio/video). Each slot has exactly four states:

| State | Visual | Click |
|---|---|---|
| present | solid `--color-ok` icon (music/film) | nothing (tooltip: format, size) |
| missing | dimmed outline icon with small down-arrow on hover | **one click → enqueue that kind's download** |
| in flight | spinner replacing the icon | nothing (tooltip: queued/running) |
| failed | `--color-danger` icon | one click → retry job |

- This is the *only* place download state lives in a row; it doubles as the action. No "Refresh availability" prerequisite (already removed in `001dba2`).
- Playlist-level progress counts an item as complete only when **both** files exist (`downloadedItems` semantics change accordingly in the stats SQL).
- Context menu keeps explicit Download/Re-download entries as the verbose path; row duo is the fast path.

## 6. Player

- **Bar (72px):** artwork 48px (click → fullscreen), title/channel two-line, transport center (prev, accent play 40px, next, shuffle, repeat), **seek slider as 6px track with hover-grow thumb** + time labels (mono), right cluster: volume slider (pop-up), queue toggle (opens overlay panel), fullscreen.
- **Fullscreen audio:** large artwork (≤480px), title block, full-width slider, transport, Now Playing/Queue tabs — restyled, structure kept.
- **Fullscreen video:** PlayerCore overlay mechanism stays (from `fc11cc3`); controls layer redrawn in the new style (top-right expand/close, auto-hide).
- Mini/mobile sheet restyled to match.

## 7. Guardrails

- No functionality removed; every existing test keeps passing or is updated alongside its component (550 tests at time of writing).
- All aria-labels/sr-only structures preserved or improved; the download duo gets proper `aria-label`s per state.
- No hardcoded colors in components — tokens only.
- Visual changes verified in the running app (browser) per page before commit, on both 1280px and ultrawide widths.
- Backend changes (§1) land first with service tests (sync dual-enqueue, downloadMissing per-kind, addStandalone dual), independent of the visual layer.

## Open questions (resolved)

- ~~One format or both?~~ → Both, always (Nils).
- ~~Where does Delete live?~~ → Overflow menu with confirm.
- ~~Queue sidebar?~~ → Removed in favor of overlay panel.
