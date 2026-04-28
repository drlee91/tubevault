# Plan 4 — Player + Stream API · Design

**Date:** 2026-04-28
**Phase:** Phase 1 (per Master-Spec §11)
**Predecessors:** Plan 1 (Foundation), Plan 2 (Provider Sync), Plan 5 (UI Implementation)
**Successor:** Plan 6 (Mobile-Polish, Docker, NAS-Deployment)

This spec freezes the design for the TubeVault audio/video player module — the last
big functional gap before the app is end-to-end usable. Master-Spec §7 has the
Phase-1 player blueprint; this document fills in the choices that section leaves
open and adapts the layout to the post-Plan-5 codebase.

---

## 1. Decisions Captured

| # | Topic | Decision | Note |
|---|---|---|---|
| 1 | Plan scope | Full §7 in one plan | Stream API + Audio + Video + Queue + Reorder + Fullscreen + Keyboard + MediaSession + Resume |
| 2 | Queue-Item shape | `videoId + playlist context`, player resolves `mediaFile` at load | Survives re-downloads (mediaFileId can change); supports a future audio↔video toggle without queue mutation |
| 3 | Row-click behavior | Smart-queue (Spotify/YT-Music style) — replaces queue with the *currently visible, filtered* list, starts at clicked track | "Play Playlist" / "Shuffle Play" become explicit buttons on the playlist header |
| 4 | Resume scope | Full position persistence + auto-pause on reload | Position written every 5 s + on `pagehide`. After reload the player is paused and ready; user must press Play (avoids browser autoplay-block surprises) |
| 5 | Broken-track behavior | Skip + toast | `Couldn't play 'X' — file missing. Skipped.` Track stays in queue with a warn icon; user removes manually |
| 6 | Player Bar layout | Top-Bar Progress (YT-Music-style) — 64 px high, 2 px progress stripe at the top of the bar, no in-bar scrubber | Click on stripe = scrub; richer scrubbing happens in the fullscreen overlay |
| 7 | Desktop queue placement | `@container (min-width: 1280px)` → persistent right sidebar (320 px); below 1280 px → right side-drawer (overlay) | Same component renders into both contexts |
| 8 | Mobile player (<768 px) | Mini-Bar above `BottomNav` (56 px); tap → bottom-sheet that fills 100 vh, Drag-handle / swipe-down closes | YouTube-Music-style |
| 9 | State management library | Zustand + `persist` middleware | Spec already chose it; 1.5 kB, no Provider boilerplate, Hooks-native |
| 10 | Stream API auth | None (Phase 1, single-user local) | Lookup by `mediaFileId` from DB; never trust client-supplied paths |

---

## 2. Architecture

```
Browser
├─ <PlayerProvider>                 (Zustand store + media-element refs + hydrate)
│   ├─ <PlayerCore>                 (single hidden <audio> + single <video>)
│   ├─ <PlayerBar>                  (persistent, 64 px, top-progress)
│   ├─ <QueueSidebar>               (≥ 1280 px persistent; else <QueueDrawer>)
│   ├─ <FullscreenAudio>            (overlay: cover XL + scrub + queue-tab)
│   ├─ <FullscreenVideo>            (cinema mode: video centered, dim bg)
│   └─ <MobilePlayerSheet>          (< 768 px: bottom-sheet, replaces fullscreen)
└─ MediaSession API                 (lockscreen controls, artwork from thumbnailUrl)

Server
└─ GET /api/stream/[mediaFileId]
    ├─ ensureBooted() → ctx.mediaFileService.byId(id)
    ├─ 404 if null or !fs.existsSync(filePath)
    ├─ Parse Range header
    ├─ fs.createReadStream(filePath, { start, end })
    └─ 206 Partial Content + Content-Type derived from format
```

### 2.1 Why Zustand (and not Context+Reducer or Jotai)

- Player state is a single coherent slice with many consumers; Zustand's selector-
  hooks avoid the prop-drill / `useContext`-rerender problem out of the box.
- `persist` middleware handles the localStorage rehydrate flow with a `hasHydrated`
  flag — required because Next App-Router renders the root layout server-side and
  `localStorage` is client-only.
- 1.5 kB. No Provider needed for the store itself; the `<PlayerProvider>`
  component still exists to mount media elements and wire effects.

---

## 3. State Shape

```ts
type Kind = "audio" | "video";

interface QueueItem {
  videoId: number;
  defaultKind: Kind;        // playlist.defaultFormat or "audio" for standalone
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  availableKinds: Kind[];   // which media_files exist on disk
}

interface PlayerState {
  // Queue
  queue: QueueItem[];
  currentIndex: number;             // -1 = idle (no track loaded)
  // Per-track resolved
  resolvedMediaFileId: number | null;
  currentKind: Kind | null;
  // Playback
  isPlaying: boolean;
  position: number;                 // seconds, debounced 5 s → localStorage
  duration: number;                 // from media element on loadedmetadata
  volume: number;                   // 0..1
  // Modes
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  mode: "mini" | "fullscreen" | "queue-open";
  // Hydrate
  hasHydrated: boolean;
}
```

**Persisted slice** (`localStorage["tubevault.player"]`): `queue`, `currentIndex`,
`position`, `volume`, `shuffle`, `repeat`. **`isPlaying` always rehydrates as
`false`** (auto-pause on reload).

### 3.1 Store Actions

Explicit method surface exposed by the Zustand store (consumed by UI components,
keyboard handler, MediaSession bindings):

| Method | Effect |
|---|---|
| `play()` / `pause()` / `togglePlay()` | Sets `isPlaying`; effect propagates to media element |
| `next()` / `prev()` | Advances `currentIndex` per `repeat` mode; cycles on `repeat: "all"`; restarts on `"one"` |
| `seek(seconds)` | Updates store `position` AND writes to media element |
| `setVolume(0..1)` / `toggleMute()` | |
| `toggleShuffle()` | Reorders queue tail (Fisher-Yates once) when turning on; restores original order on off |
| `cycleRepeat()` | off → all → one → off |
| `setQueue(items, startIndex)` | Replace; `playFromList` calls this |
| `addToQueue(item)` / `playNext(item)` / `removeFromQueue(index)` / `reorder(from, to)` | Queue mutations |
| `openFullscreen()` / `openQueue()` / `closeOverlays()` | Mode transitions |
| `_hydrate(persistedSlice)` | Internal — called once by `<PlayerProvider>` after mount |

### 3.2 Queue Resolution — Smart-Queue Build

1. UI holds the locally filtered + sorted list (e.g. `TrackTable.props.items`
   already mirrors the user's filter chips).
2. Click on row N → helper `buildQueue(items, startAt)`:
   - Map every `PlaylistDetailItem` (or `VideoSerialized`) to `QueueItem`.
   - Strip items where `availableKinds.length === 0` (no media file → cannot play).
   - Compute `currentIndex = adjustedStartAt` (start position after stripping).
3. `setQueue(queueItems, currentIndex)` → `pickKind(queueItems[currentIndex])`
   computes `resolvedMediaFileId`.
4. `pickKind(item)` returns `defaultKind` if available, else the other kind, else
   `null`.

### 3.3 Broken-Track Handling

- On track-load error (`<audio>.error`, or `pickKind` returns `null`):
  → `toast.error("Couldn't play 'TITLE' — file missing. Skipped.")`
  → `next()` (advance via the same path as natural end-of-track).
- The broken `QueueItem` stays in the queue with a `warn`-icon decoration in the
  queue list. User removes manually.
- After hydrate (page reload with stored queue), no eager validation — first track
  load triggers the same skip path if broken. Avoids slow startup.

---

## 4. Stream API

### 4.1 Route

`app/api/stream/[mediaFileId]/route.ts`

```ts
GET /api/stream/:mediaFileId
  ├─ const { mediaFileId } = params; ensureBooted();
  ├─ const file = ctx.mediaFileService.byId(Number(mediaFileId));
  ├─ if (!file) → 404
  ├─ const stat = await fs.promises.stat(file.filePath); // 404 on ENOENT
  ├─ Parse Range header:
  │     none           → 200, [0, size-1], full stream
  │     "bytes=0-"     → 206, [0, size-1]
  │     "bytes=N-"     → 206, [N, size-1]
  │     "bytes=N-M"    → 206, [N, M]
  │     "bytes=N-" with N >= size  → 416 Range Not Satisfiable
  │     malformed       → 416
  ├─ Headers:
  │     Accept-Ranges: bytes
  │     Content-Type: <mimeForFormat(file.format)>
  │     Content-Length: <range size>
  │     Content-Range: bytes N-M/<full>     (only on 206)
  │     Cache-Control: private, max-age=3600
  │     Last-Modified: <stat.mtime.toUTCString()>
  └─ Body: Web ReadableStream wrapping fs.createReadStream(...)
```

### 4.2 Mime Mapping

| `format` value | Content-Type |
|---|---|
| `mp3` | `audio/mpeg` |
| `m4a` | `audio/mp4` |
| `opus` | `audio/ogg` |
| `flac` | `audio/flac` |
| `mp4` | `video/mp4` |
| `webm` | `video/webm` |
| `mkv` | `video/x-matroska` |
| anything else | `application/octet-stream` |

### 4.3 Security Considerations

- Phase 1, single-user local: no auth.
- `mediaFileId` lookup is hard-bound to the `media_files` table; the client never
  supplies a path — the only attack surface is the integer ID, and a non-existent
  ID returns 404.
- No path traversal possible: `filePath` comes exclusively from a validated DB row
  written by the download pipeline.
- A future Phase 2 with multi-user deployment would add an auth check before the
  DB lookup — the route shape stays identical.

### 4.4 Edge Cases & Test Targets

- Browser sends `bytes=0-` as initial probe → 206 with full range.
- Seek triggers `bytes=N-` for arbitrary N → 206 with partial range.
- Some browsers (older Safari) probe with closed range `bytes=0-1` → must work.
- `<video>.preload="metadata"` requires correct 206 responses; a 200-only server
  breaks video seeking → range support is mandatory from day 1.

---

## 5. Player Core

### 5.1 Element Mounting

```tsx
function PlayerCore() {
  return (
    <>
      <audio ref={audioRef} preload="metadata" hidden />
      <video ref={videoRef} preload="metadata" playsInline className={...} />
    </>
  );
}
```

- One `<audio>`, one `<video>`. Active element follows `currentKind`.
- `<video>` is hidden (`display:none`) outside fullscreen / mobile-sheet. The
  player bar shows only the thumbnail when current kind is video.

### 5.2 Source & Position Management

- On track change: `el.src = "/api/stream/" + resolvedMediaFileId`.
- After `loadedmetadata` and only if a `persistedPosition > 0` exists for *this*
  `currentIndex`: `el.currentTime = persistedPosition`. Subsequent track switches
  start at 0.
- The "this index" check uses `currentIndex` written next to position in the
  persisted slice — prevents seeking into the wrong track after the queue
  changes.

### 5.3 Element-Side Effect Plumbing

| Source | Listener / Effect | Action |
|---|---|---|
| `loadedmetadata` | event | `setDuration(el.duration)` |
| `timeupdate` | event, throttled 250 ms | `setPosition(el.currentTime)` |
| `ended` | event | `next()` |
| `error` | event | toast + `next()` |
| `play`/`pause` | event | `setIsPlaying` |
| store `isPlaying` | effect | `el.play()` / `el.pause()` |
| store `volume` | effect | `el.volume = v` |
| user scrub | action | `el.currentTime = newPos` |

### 5.4 Position Writeback

- 5-second `setInterval` while `isPlaying`. Cleared on pause.
- `pagehide` event → final flush.
- `volume`, `shuffle`, `repeat` write immediately (rare changes).

### 5.5 MediaSession API

```ts
navigator.mediaSession.metadata = new MediaMetadata({
  title: queueItem.title,
  artist: queueItem.channelTitle ?? "",
  artwork: queueItem.thumbnailUrl ? [{ src: queueItem.thumbnailUrl }] : [],
});
navigator.mediaSession.setActionHandler("play", () => store.play());
navigator.mediaSession.setActionHandler("pause", () => store.pause());
navigator.mediaSession.setActionHandler("previoustrack", () => store.prev());
navigator.mediaSession.setActionHandler("nexttrack", () => store.next());
navigator.mediaSession.setActionHandler("seekto", (d) =>
  store.seek(d.seekTime ?? 0),
);
```

Skipped in tests via `navigator.mediaSession === undefined` guard.

### 5.6 Keyboard Shortcuts

Mounted via `document.addEventListener("keydown")` inside `<PlayerProvider>`. Each
handler skips when `event.target` is an `<input>`, `<textarea>`, or has
`contentEditable`.

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` / `→` | Seek -10 s / +10 s |
| `Shift+←` / `Shift+→` | Prev / Next track |
| `M` | Mute toggle |
| `F` | Fullscreen toggle (only if a track is loaded) |

---

## 6. UI Components

### 6.1 `<PlayerBar>` (64 px, persistent)

```
┌─ 2 px progress stripe (clickable to scrub) ──────────────────────────────┐
│  ┌──┐ Title — sub                ⤺ ⏮ ▶ ⏭ ↻       2:34/7:21  ♫ 🔊 ⛶  │
│  │🖼│ Channel · format                                                    │
│  └──┘                                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

- Left zone: 42×42 thumbnail + truncated title/channel. Click → scrolls to track
  in current view, or opens fullscreen if user is on an unrelated route.
- Center: shuffle toggle · prev · play/pause (28 px circle, fg/bg inverted) ·
  next · repeat (off → all → one).
- Right: time `M:SS / M:SS` · queue ♫ button (toggles `mode === "queue-open"`) ·
  volume (hover-popover slider) · fullscreen ⛶.
- Hidden when `currentIndex === -1` — the AppShell renders without the bar in
  idle state.
- Progress stripe: 2 px tall, full width, hover expands hit-area to 8 px. Click
  emits a `seek` action.

### 6.2 `<QueueSidebar>` / `<QueueDrawer>` / `<QueueList>`

- `<QueueList>` is the shared inner content (Now Playing · upcoming · DnD reorder
  via `@dnd-kit/sortable`).
- `<QueueSidebar>` mounts the list inside a 320-px right column, lives in
  `AppShell` under a `@container (min-width: 1280px)` query.
- `<QueueDrawer>` mounts the same list inside a Radix Sheet, opened by `mode ===
  "queue-open"` when the container query fails.
- Per-item context menu: Play Now · Remove · Move to top.
- Header: "Queue · N tracks" · "Clear queue" button.

### 6.3 `<FullscreenAudio>`

```
┌──────────────────────────────────────────┐
│  ✕ Close                                  │
│                                           │
│         ┌──────────────────┐              │
│         │   COVER ART      │              │
│         │   (max 320 px)   │              │
│         └──────────────────┘              │
│                                           │
│         Track Title                       │
│         Channel · Playlist                │
│                                           │
│  ━━━━━━━━━●━━━━━━━━━━  2:34 / 7:21        │
│                                           │
│        ⤺  ⏮  ▶  ⏭  ↻  ♫                   │
│                                           │
│  Tab: [ Now Playing ] [ Queue (12) ]      │
└──────────────────────────────────────────┘
```

- Square cover art. If `thumbnailUrl` is missing → placeholder with
  `lucide-music` icon.
- Bottom tab bar switches between "Now Playing" (large cover) and "Queue" (the
  same `<QueueList>`).
- Esc / click on `✕` closes (`mode = "mini"`).

### 6.4 `<FullscreenVideo>` (cinema)

Two stacked levels, opt-in by user:

1. **Cinema overlay (default).** Triggered by clicking ⛶ on the player bar when
   current kind is video. Full-viewport overlay (`fixed inset-0`) with
   `bg-black`, `<video>` centered with `object-contain`, max 90 vh. App chrome
   (URL bar etc.) still visible. Custom controls auto-hide after 3 s without
   mouse-move. Esc / click outside the video closes the overlay (`mode = "mini"`).
2. **True browser-fullscreen (optional).** Inside the cinema overlay an
   additional "Expand" button calls `videoRef.requestFullscreen()` to enter the
   browser's chrome-less fullscreen mode. Esc inside browser-fullscreen returns
   to the cinema overlay; the cinema overlay is still active.

Audio tracks never enter `<FullscreenVideo>` — the ⛶ button on audio opens
`<FullscreenAudio>` instead.

### 6.5 `<MobilePlayerSheet>` (< 768 px)

- Mini-Bar lives **above** `<BottomNav>`: 56 px, cover (32 px) + title +
  play/pause only.
- Tap mini-bar → Radix Sheet slides up to 100 vh.
- Sheet content = `<FullscreenAudio>` for audio, `<FullscreenVideo>` for video,
  with a drag-handle at the top (swipe-down dismisses).
- A11y: full sheet has `aria-label="Player"` and traps focus while open.

### 6.6 Track-Row Integration

| File | Change |
|---|---|
| `components/playlists/track-row.tsx` | Click on row → `playFromList(items, index)`. Now-playing pulsing dot replaces position-number when `currentIndex` matches |
| `components/playlists/standalone-list.tsx` | Same row-click pattern with the standalone item list |
| `components/playlists/track-context-menu.tsx` | New items: **Play Now** (replace queue) · **Add to Queue** (append) · **Play Next** (insert after current) |
| `components/playlists/playlist-detail-header.tsx` | New buttons: **Play All** (queue = visible items, shuffle off) · **Shuffle Play** (queue = visible items, shuffle on) |
| `components/playlists/track-table.tsx` | Already holds the filtered `items`; just exposes them to row callbacks |

---

## 7. File Inventory

### 7.1 New Files

```
app/api/stream/[mediaFileId]/route.ts                + .test.ts
lib/services/media-file-service.ts                   + .test.ts
lib/player/store.ts                                  + .test.ts
lib/player/queue-build.ts                            + .test.ts
lib/player/persist.ts                                + .test.ts
lib/player/keyboard.ts                               + .test.ts
lib/player/media-session.ts                          + .test.ts
components/player/player-provider.tsx                + .test.tsx
components/player/player-core.tsx                    + .test.tsx
components/player/player-bar.tsx                     + .test.tsx
components/player/queue-list.tsx                     + .test.tsx
components/player/queue-sidebar.tsx                  + .test.tsx
components/player/queue-drawer.tsx                   + .test.tsx
components/player/fullscreen-audio.tsx               + .test.tsx
components/player/fullscreen-video.tsx               + .test.tsx
components/player/mobile-sheet.tsx                   + .test.tsx
components/player/now-playing-indicator.tsx          + .test.tsx
```

### 7.2 Modified Files

```
components/app-shell.tsx                  (mount PlayerProvider + Bar + Sidebar slot)
components/playlists/track-row.tsx        (Play-Click + now-playing dot)
components/playlists/track-context-menu.tsx
                                          (Play Now / Add / Next entries)
components/playlists/playlist-detail-header.tsx
                                          (Play All + Shuffle Play buttons)
components/playlists/standalone-list.tsx  (Play-Click)
components/playlists/track-table.tsx      (forward filtered items to row callbacks)
lib/db/repositories/media-file-repo.ts    (byId — if not present)
lib/db/repositories/video-repo.ts         (extend list result with availableKinds)
lib/client/use-standalone-videos.ts       (availableKinds in serialized type)
package.json                              (zustand, @dnd-kit/core, @dnd-kit/sortable)
```

### 7.3 Migrations

None — `media_files` schema already covers everything (filePath, format,
fileSizeBytes, durationSeconds).

---

## 8. Testing

| Layer | Coverage focus | Approx. tests |
|---|---|---|
| Stream API route | Range parsing (none / `bytes=0-` / `bytes=N-` / closed / 416), 404, mime mapping | 8 |
| `media-file-service` | byId, mime helper | 3 |
| Player store | Smart-queue build, pickKind, repeat-modes, shuffle (Fisher-Yates once at toggle), persist/hydrate, broken-track skip, idle state transitions | 15 |
| Queue-build helper (pure) | Filter availableKinds, startAt adjustment, edge cases (empty, single item) | 5 |
| Persist module | Hydrate flag, write-debounce, pagehide-flush | 4 |
| Keyboard module | Each shortcut, input-focus skip | 6 |
| MediaSession | Action handlers, metadata update, missing API guard | 3 |
| `PlayerCore` | Element-store sync (play/pause/volume/scrub), event binding, error → next | 6 |
| `PlayerBar` | Render states (idle / playing / paused / error), click handlers, ARIA labels, hidden-when-idle | 6 |
| `QueueList` (shared) | Reorder via dnd-kit, remove, now-playing highlight | 5 |
| `QueueSidebar` / `QueueDrawer` | Container-query switching (smoke), open/close on `mode` change | 3 |
| `FullscreenAudio` | Open/close, Esc listener, tab switch | 4 |
| `FullscreenVideo` | Open/close, controls auto-hide, native-fullscreen request | 3 |
| `MobilePlayerSheet` | Open via tap, sheet content variant by kind | 3 |
| Track-row integration | playFromList passes correct filtered items, now-playing dot, context menu actions | 6 |
| E2E smoke | `tests/integration/plan-4-flow.test.ts`: click track → store has queue, audio src is `/api/stream/<id>`, isPlaying=true | 1 |

**Total target:** ~80 new tests. Plan 5 ended at 407 → Plan 4 target is roughly
485+, give or take refactor offsets.

---

## 9. Loose Ends — Explicitly Out of Scope

| # | Topic | Where it lives |
|---|---|---|
| 1 | Audio↔Video toggle UI | State supports it (`currentKind`); no UI control. Add when a user asks |
| 2 | Gapless / Crossfade | Master-Spec §7.7 — Phase 2 |
| 3 | Picture-in-Picture | Phase 2 |
| 4 | Speed control / EQ / Lyrics | Phase 2 |
| 5 | `/api/stream` auth | Phase 2 (multi-user / NAS deployment) |
| 6 | Loudness normalization at playback | Already in download pipeline (ffmpeg `loudnorm`); not a streaming concern |
| 7 | Service-Worker cache for stream ranges | Phase 2 (PWA-offline) |
| 8 | Cancel-job button (Plan 5 follow-up F) | Plan 6 — design decision pending |

---

## 10. Risks

- **Zustand SSR / hydrate mismatch:** Next App-Router renders `<PlayerProvider>`
  on the server first (it's mounted in the root layout). The store's persisted
  slice is client-only. Mitigation: `hasHydrated` flag + a `useSyncExternalStore`
  pattern; rendering returns idle state until `hasHydrated === true`. Player Bar
  is hidden until then anyway (idle = `currentIndex === -1`), so visual flicker
  is bounded.
- **Range header edge cases:** Browsers vary. Mitigation: dedicated test matrix
  (none / `bytes=0-` / `bytes=N-` / `bytes=N-M` / out-of-range).
- **`<video preload="metadata">` requires 206:** A 200-only server breaks seek.
  Mitigation: range support is implemented from day 1, not retrofitted.
- **MediaSession HTTPS-only:** OK on `localhost`, OK behind TLS reverse-proxy on
  NAS deployment. No mitigation needed — feature degrades gracefully (the API
  guard hides the bind on insecure contexts).
- **Container queries in JSDOM tests:** `@container` doesn't exist in JSDOM.
  Mitigation: test the sidebar/drawer separately rather than as a single
  responsive unit; the container-query switching is a pure CSS behavior.
- **localStorage quota:** A queue of 10 000 items theoretically eats kilobytes,
  not megabytes. No mitigation needed for Phase 1.

---

## 11. Branch & Workflow

- Worktree: `.worktrees/plan-4-player`
- Branch: `plan-4-player`
- Cuts from `main` after the Plan 5 merge (`a64956b`).
- Workflow: `superpowers:writing-plans` → `superpowers:executing-plans` (subagent
  driven for parallelizable tasks, à la Plan 5).

---

## 12. Acceptance Criteria

The plan is "done" when:

1. Clicking any track row in `/playlists/[id]` or in the Standalone list starts
   playback within 1 s on a local-disk file.
2. The persistent player bar shows current track info, a working scrub stripe,
   and time display.
3. Closing and reopening the tab restores the queue + position; the user must
   click Play to resume.
4. Audio + video playback both work; video seeking via the scrubber works.
5. Mobile (`< 768 px`): tapping the mini-bar opens the bottom-sheet fullscreen
   player.
6. Desktop (`≥ 1280 px`): the queue sidebar is persistently visible.
7. Lockscreen controls (MediaSession) work on a real mobile device.
8. Lint, typecheck, and `vitest run` are all green; ~80 new tests added.
9. A new `tests/integration/plan-4-flow.test.ts` covers click-to-play end-to-end.
10. Plan 5 follow-up F (cancel-job) explicitly carries forward to Plan 6 — no
    Plan 4 task touches it.
