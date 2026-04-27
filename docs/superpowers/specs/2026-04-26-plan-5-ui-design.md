# Plan 5 — UI Design Spec

**Datum:** 2026-04-26
**Status:** Draft (Brainstorming abgeschlossen, wartet auf User-Review)
**Autor:** Nils + Claude (via superpowers:brainstorming)
**Vorgänger:** [Plan 2 — Provider Layer + Sync + Downloads](2026-04-26-plan-2-provider-sync.md) (gemerged)
**Hauptspec:** [TubeVault Design Spec](2026-04-26-tubevault-design.md)

---

## 1. Scope

Plan 5 baut die User-Facing UI für TubeVault: Playlists-Liste mit Standalone-Tab, Playlist-Detail mit live-pollender Items-Tabelle, Add-Dialoge, Activity-Page (History + Jobs) und vollständige Settings. Der Player + die Library-Seite kommen separat in Plan 6.

### 1.1 IN

- **Routes:** `/` (Dashboard), `/playlists` (Tabs Playlists + Standalone), `/playlists/[id]` (Detail), `/activity` (Tabs History + Jobs), `/settings` (Tabs General + Storage + Audio + Video + Sync + Advanced)
- **Add-Flows:** Add-Playlist-Dialog, Add-Video-Dialog (Topbar `+ Add ▾`-Dropdown)
- **Pro-Item-Aktionen:** Re-Download (audio/video), Refresh availability, Open on YouTube — via Track-Row-Kontextmenü (`⋮`)
- **Polling:** Detail-Items 5 s, Jobs-Tab 10 s, Topbar-Job-Badge 30 s; alle pausieren bei `document.hidden`
- **Server-Actions** in `lib/actions/*.ts` für alle Mutationen (Add-Playlist, Add-Video, Sync-Now, Re-Download, Refresh-Video, Retry-Job, Delete-Playlist, Update-Settings)
- **API-Erweiterungen:** vollständiger `GET /api/playlists/[id]`-Shape (F1-Followup), `GET /api/jobs?status=`, `GET /api/jobs/summary`, `POST /api/jobs/[id]/retry`, `GET /api/videos`, `POST /api/videos/[id]/download`, `POST /api/videos/[id]/refresh`, `GET /api/storage/usage`
- **Visual-Style:** shadcn/ui-Components, Inter Sans, JetBrains Mono nur für Pfade/IDs/Cron-Strings, Status-Pills (klein, sans, lowercase), `next-themes` Light/Dark/System
- **Toast/Sonner** für transient System-Errors + Success-Confirmations
- **Empty-States + Loading-States + Error-States** für alle Pages
- **Storage-Disk-Usage-Anzeige** (DB-aggregiert, kein Disk-Scan)
- **Self-Check-Banner-Verlinkung** zu jeweiliger Settings-Section
- **Mobile-Layout** (<768 px): Sidebar → Bottom-Tab-Bar, Track-Table → kompakte Liste, Add-Dialoge → Full-Screen-Sheet
- **Tests:** Pure Unit + Server-Actions + neue API-Routes + Component-Tests (RTL/happy-dom) + Polling-Hooks (fake-timers + msw) + Integration „Add → Sync → Detail-Page sieht Items + Audio-File"
- **browser-use-Smoke** als Done-Gate (Add Playlist → Detail → Re-Sync → Settings → Add Video → Activity → Topbar-Badge → Light/Dark/Mobile-Screenshots)

### 1.2 OUT (spätere Pläne)

- **Player** — Audio/Video, Queue, Streaming-API, MediaSession, Fullscreen, Resume → Plan 6
- **`/library`** + **`/videos/[id]`** Detail-Routes → Plan 6
- **Playlist-Quick-Liste in Sidebar** mit Live-Sync-Indicator → Plan 6
- **Cancel laufender Jobs** → späterer Plan; UI-Button gerendert, aber disabled mit Tooltip
- **Bulk-Actions** auf Track-Liste → späterer Plan
- **Drag-and-drop Queue-Reorder** → Plan 6 mit Player
- **Naming-Pattern-Engine** + Settings-Feld → späterer Plan
- **Cookies-File-Settings** → späterer Plan
- **Database Vacuum + JSON Export/Import-Buttons** → späterer Plan
- **Keyboard-Shortcuts** außer Dialog-Esc + Form-Submit → Plan 6 mit Player
- **i18n** → Phase 2
- **PWA-Manifest + Service-Worker** → Phase 2
- **E2E-Tests via Playwright** → Plan 6 (zu wenig Mehrwert ohne Player-Page)

### 1.3 Bewusste Implikation

Plan 5 fertig = User kann TubeVault bedienen wie eine fertige App, ABER kann lokale Files (noch) nicht abspielen. Download passiert, File ist auf der Disk, aber zum Hören muss der User aktuell selbst zur Datei navigieren. Plan 6 schließt das mit dem Player.

---

## 2. Architektur-Wahl

### 2.1 Datenfluss

```
┌──────────────────────────────────────────────────────────────────┐
│  Initial Page-Load (RSC, max RSC-Anteil)                         │
│    Page → ensureBooted() → Service-Methoden direkt → JSX         │
│    z.B. /playlists  → playlistService.listWithStats()            │
│         /activity (history) → syncRunRepo.recent(50)             │
│         /settings → settingsService.getAll()                     │
│                                                                  │
│  Mutationen (Server Actions in lib/actions/*.ts)                 │
│    Form/Button → Action(input) → Service → revalidatePath/redirect│
│    Result-Pattern: { ok: true; data } | { ok: false; error }     │
│    z.B. addPlaylistAction, syncPlaylistAction, retryJobAction    │
│                                                                  │
│  Live-Updates (Client-Component + SWR)                           │
│    use("/api/...") → REST-Route → Service → JSON                 │
│    z.B. /playlists/[id] Items, /activity Jobs-Tab, Topbar-Badge  │
└──────────────────────────────────────────────────────────────────┘
```

**Begründung:** RSC-Pages sprechen Services direkt (in-process Node, kein HTTP-Hop, End-to-End-Type-Safety). Server-Actions sind dünne Wrapper um die selben Services, die auch von REST-Routes genutzt werden — kein Code-Duplikat. Polling-Komponenten brauchen Live-Daten, die über REST kommen, weil sie sonst pro Refresh den ganzen Page-Tree ungenutzt re-rendern müssten.

### 2.2 Lib-Stack-Erweiterung

| Lib | Zweck | Bundle (gz) |
|---|---|---|
| `swr` | Client-Polling, `fallbackData`, `revalidateOnFocus`, `refreshWhenHidden:false` | ~12 KB |
| `next-themes` | Theme-Provider Light/Dark/System | ~3 KB |
| `react-hook-form` | Form-State + Validation für Add-Dialoge + Settings-Forms | ~25 KB |
| `@hookform/resolvers` | RHF + Zod | <1 KB |
| `sonner` | Toast (kommt mit shadcn) | ~5 KB |
| shadcn/ui Components (kopiert): `dialog`, `input`, `label`, `select`, `tabs`, `switch`, `dropdown-menu`, `form`, `tooltip`, `separator`, `skeleton` | UI-Primitives (Radix-basiert) | im Code |

Keine TanStack Query (Hauptspec listet sie auf, aber SWR ist leichter und reicht für Plan-5-Polling-Cases). Keine zustand/jotai (Plan 6 mit Player).

### 2.3 RSC vs. Client — Aufteilung

| Komponente | Rendering | Begründung |
|---|---|---|
| `<AppShell>`, `<Sidebar>`, `<SelfCheckBanner>` | RSC | bestehen bereits |
| `<Topbar>` | RSC | bestehend |
| `<TopbarJobBadge>` | Client (SWR) | live-pollend |
| `<AddDropdown>`, `<AddPlaylistDialog>`, `<AddVideoDialog>` | Client | Dialog-State + Form-State |
| `/page.tsx` (Dashboard) | RSC | Stats + Recent-Activity, kein Polling |
| `/playlists/page.tsx` (Liste + Standalone-Tab) | RSC mit Client-Tab-Wrapper | URL-Tab-State client, Daten initial RSC |
| `/playlists/[id]/page.tsx` (Detail) | RSC-Skeleton | Header + Sync-Now-Button + initialDataProp |
| `<PlaylistDetailItems>` | Client (SWR + initial fallbackData) | live-pollend |
| `/activity/page.tsx` | RSC mit Client-Tab-Wrapper | History RSC, Jobs Client |
| `<JobsTab>` | Client (SWR) | live-pollend |
| `/settings/page.tsx` | RSC mit Client-Form-Sections | Initial-Werte server-rendered, Forms sind Client (RHF) |

---

## 3. Routing + Page-Layout

### 3.1 Route-Übersicht

```
/                         Dashboard (RSC)
/playlists                Tabs „Playlists" | „Standalone" (RSC + Client-Tab)
/playlists/[id]           Detail (RSC-Skeleton + Client-Items)
/playlists/[id]/not-found.tsx  404
/activity                 Tabs „History" | „Jobs" (RSC + Client-Tab)
/settings                 Tabs General/Storage/Audio/Video/Sync/Advanced (RSC + Client-Forms)
```

URL-State für Tabs: `?tab=playlists` / `?tab=standalone` auf `/playlists`, `?tab=history` / `?tab=jobs` auf `/activity`, `?tab=storage` / etc. auf `/settings`. Default-Tab wenn kein Param.

### 3.2 Persistent-Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Topbar:  TubeVault              [+ Add ▾]  [● 2]  [⚙]       │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │                                                  │
│  Home    │                                                  │
│  Playl.  │             Main Content (Page)                  │
│  Activ.  │                                                  │
│  Settgs. │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

Topbar bekommt zwei neue Elemente:
- **`+ Add ▾`-Dropdown:** rechts neben Suche-Platzhalter; öffnet Add-Playlist-Dialog oder Add-Video-Dialog
- **`● 2` Job-Badge:** Pulsing-Dot mit aktiver Jobs-Anzahl, Klick → `/activity?tab=jobs`. Nur sichtbar wenn `running > 0` oder `failed > 0`.

Mobile (<768 px): Sidebar wird Bottom-Tab-Bar (4 Items: Home, Playlists, Activity, Settings). Player-Bar fehlt komplett (Plan 6).

### 3.3 Dashboard `/`

RSC-Page. Vier Stats-Cards (CSS-Grid, 2×2 oder 4×1 je Breakpoint):
- Playlists count
- Tracked Videos count
- Available % (= `count(availability_status='available') / total`)
- Disk Usage (sum aller `media_files.file_size_bytes`, formatted GB)

Plus „Recent Activity"-Liste (letzte 10 sync_runs, abgeschlossen). Klick auf einen Run → expand error_log inline.

Empty-State (keine Playlists): großes Icon + „Welcome to TubeVault" + primary Button „Add your first playlist".

---

## 4. Komponenten-Tree

### 4.1 Datei-Struktur (neue Files)

```
app/
  layout.tsx                          erweitert: + ThemeProvider, + Toaster
  page.tsx                            Dashboard (RSC)
  loading.tsx                         globaler Loading-Skeleton
  error.tsx                           globaler Error-Boundary
  playlists/
    page.tsx                          Liste (RSC + Client-Tab)
    loading.tsx
    [id]/
      page.tsx                        Detail (RSC + Client-Items)
      loading.tsx
      not-found.tsx
      error.tsx
  activity/
    page.tsx                          Tabs (RSC + Client-Jobs-Tab)
    loading.tsx
  settings/
    page.tsx                          Tabs (RSC + Client-Forms)
    loading.tsx

components/
  app-shell.tsx                       (existiert)
  topbar.tsx                          erweitert: + AddDropdown, + TopbarJobBadge
  sidebar.tsx                         (existiert, leichte Stil-Anpassungen)
  bottom-nav.tsx                      neu, mobile only
  self-check-banner.tsx               (existiert)
  ui/                                 shadcn (badge, button, card existieren; dialog, input, label, select, tabs, switch, dropdown-menu, form, tooltip, separator, skeleton, sonner neu)
  add/
    add-dropdown.tsx                  Topbar `+ Add ▾`
    add-playlist-dialog.tsx
    add-video-dialog.tsx
  topbar/
    topbar-job-badge.tsx              Client, useJobSummary
  dashboard/
    stats-cards.tsx                   RSC
    recent-activity.tsx               RSC
  playlists/
    playlists-tabs.tsx                Client, URL-Tab-Sync
    playlist-list.tsx                 RSC, rendert Cards
    playlist-card.tsx                 RSC, eine Card mit Cover/Title/Stats/Sync-Indicator
    standalone-list.tsx               Client (SWR auf /api/videos), eigener Tab
    playlist-detail-header.tsx        RSC + Client-Sync-Button
    sync-now-button.tsx               Client (Server-Action)
    delete-playlist-button.tsx        Client (confirm-dialog + Server-Action)
    playlist-detail-items.tsx         Client (SWR + initial fallbackData)
    track-table.tsx                   Client, sortable + Filter-Chips + Search
    track-row.tsx                     Client, Kontextmenü via DropdownMenu
    track-context-menu.tsx            Client, Re-Download/Refresh/Open-on-YT
    item-filter-chips.tsx             Client, URL-Filter-State
  activity/
    activity-tabs.tsx                 Client, URL-Tab-Sync
    history-tab.tsx                   RSC
    history-row.tsx                   Client (Expand-State)
    jobs-tab.tsx                      Client (SWR)
    job-row.tsx                       Client
    retry-job-button.tsx              Client (Server-Action)
  settings/
    settings-tabs.tsx                 Client, URL-Tab-Sync
    general-section.tsx               Client (Theme-Toggle)
    storage-section.tsx               Client (RHF + DiskUsage-Display)
    audio-section.tsx                 Client (RHF)
    video-section.tsx                 Client (RHF)
    sync-section.tsx                  Client (RHF + Cron-Preset-Dropdown)
    advanced-section.tsx              Client (RHF + Test-Buttons für yt-dlp/ffmpeg)
    storage-usage-display.tsx         Client (SWR)
  shared/
    status-pill.tsx                   Pure (status → color/icon/label)
    job-status-pill.tsx               Pure (job-status → variant)
    job-type-badge.tsx                Pure
    duration.tsx                      Pure (seconds → "4:12")
    relative-time.tsx                 Client (mounting-safe)
    formatted-bytes.tsx               Pure
    empty-state.tsx                   Pure
    error-card.tsx                    Pure
    skeleton-row.tsx                  Pure

lib/
  actions/
    playlist-actions.ts               addPlaylistAction, syncPlaylistAction, deletePlaylistAction
    video-actions.ts                  addVideoAction, downloadVideoAction, refreshVideoAction
    job-actions.ts                    retryJobAction
    settings-actions.ts               updateSettingsAction (partial)
  client/
    swr-fetcher.ts                    typed fetcher
    use-playlist-detail.ts            usePlaylistDetail(id, opts)
    use-jobs.ts                       useJobs({status, limit, intervalMs})
    use-job-summary.ts                useJobSummary({intervalMs})
    use-standalone-videos.ts          useStandaloneVideos({intervalMs})
    use-storage-usage.ts              useStorageUsage()
  test-utils/
    boot-test-context.ts              :memory:-DB + FakeAdapter + tmp-storage helper
    server-action-overrides.ts        __setBootContextForTesting(ctx) hook (NODE_ENV=test gated)

app/api/
  jobs/
    route.ts                          GET /api/jobs?status=&limit=&offset=
    summary/route.ts                  GET /api/jobs/summary
    [id]/retry/route.ts               POST /api/jobs/[id]/retry
  videos/
    route.ts                          erweitert: GET (list standalone) + POST (existiert)
    [id]/
      download/route.ts               POST /api/videos/[id]/download
      refresh/route.ts                POST /api/videos/[id]/refresh
  storage/
    usage/route.ts                    GET /api/storage/usage
  playlists/
    [id]/route.ts                     erweitert: GET liefert vollen Shape (F1)
```

### 4.2 Bestehende Files modifizieren

- `app/layout.tsx` — `<ThemeProvider>` + `<Toaster>` einwickeln
- `app/page.tsx` — Dashboard-Inhalt (statt Hello-Placeholder)
- `app/settings/page.tsx` — Tabs einbauen, Placeholders ersetzen
- `components/topbar.tsx` — AddDropdown + TopbarJobBadge einfügen
- `app/api/playlists/[id]/route.ts` — F1: vollen Shape liefern (`items` mit video-join + audioFile + videoFile + pendingJob, `recentSyncRuns`)
- `app/api/videos/route.ts` — `GET` (list `playlist_items=null`-Videos) hinzu
- `lib/services/playlist-service.ts` — `listWithStats()`, `getDetailFull(id)` hinzu
- `lib/services/video-service.ts` — `listStandalone()`, `forceDownload(id, kind)`, `enqueueRefresh(id)` hinzu
- `lib/services/job-service.ts` — neue Datei mit `summary()`, `list({status,limit,offset})`, `retry(id)`

---

## 5. Add-Flows

### 5.1 Add-Playlist-Dialog

**Form:**
- `url`: text input, RHF + zod (`url().refine(isPlausibleProviderUrl)`)
- `defaultFormat`: radio audio/video, default „audio"
- Submit-Button, Cancel-Button (Esc + Click-Outside schließt auch)

**Submit-Flow:**
1. Client validates → Server-Action `addPlaylistAction({url, defaultFormat})`
2. Server-Action ruft `playlistService.create(...)`, fängt Domain-Errors, returns Result
3. Success: `revalidatePath('/playlists')`, Result enthält `{playlistId}`. Client schließt Dialog, zeigt Toast „Playlist queued for sync", `router.push('/playlists/${playlistId}')`.
4. Detail-Page rendert mit Empty-Items + Banner „Syncing… first tracks appear shortly". Polling übernimmt nach 5 s.

**Error-Treatment:**
| Code | UI |
|---|---|
| `URL_NOT_PLAYLIST` | inline unter URL-Feld: „This doesn't look like a playlist URL. Did you mean to add a single video? <button>Add Video instead</button>" |
| `PLAYLIST_ALREADY_TRACKED` | inline mit Action-Button „Already tracked — open it" → `router.push('/playlists/' + existingId)` |
| `PROVIDER_UNSUPPORTED` | inline: „Only YouTube playlists are supported in Phase 1." |
| `VALIDATION_FAILED` (zod) | RHF setzt field error |
| Network/Internal | Sonner-Toast destructive |

### 5.2 Add-Video-Dialog

**Form:**
- `url`: text input
- `format`: radio audio/video, default „audio"

**Submit-Flow:**
1. Server-Action `addVideoAction({url, format})`
2. Service ruft `adapter.fetchVideo(url)` *synchron* (~1–2 s, Plan 2 §8.6)
3. Loading-State im Dialog: Submit-Button-Spinner + Inputs disabled + „Fetching video metadata…"-Text
4. Success: Dialog schließt, Toast „Video queued for download", `router.push('/playlists?tab=standalone')`. Standalone-Tab pollt SWR, neuer Eintrag erscheint nach Refresh-Tick.
5. `URL_NOT_VIDEO` (URL ist Playlist) → inline mit Action-Button „Did you mean to add this playlist?"

### 5.3 Add-Dropdown (Topbar)

shadcn `DropdownMenu`, gerendert in `<Topbar>`. Items „Add Playlist", „Add Video", jeweils mit Icon (`ListMusic`, `Video`). Klick öffnet entsprechenden Dialog. Tastatur: `D` + `P` für Add-Playlist (Plan 6 — in Plan 5 nur Click-Trigger).

---

## 6. Pro-Item-Aktionen (Track-Row-Kontextmenü)

shadcn `DropdownMenu` triggered durch `⋮`-Icon in Track-Row.

| Item | Bedingung | Aktion |
|---|---|---|
| Open on YouTube | immer aktiv | `<a href={video.url} target="_blank">` |
| Re-download as Audio | `availabilityStatus === 'available'` | `downloadVideoAction(videoId, 'audio')` → Toast + Row-Status zu „queued" |
| Re-download as Video | `availabilityStatus === 'available'` | `downloadVideoAction(videoId, 'video')` |
| Refresh availability | immer aktiv | `refreshVideoAction(videoId)` → Toast „Refreshing…" |

Disabled-Items zeigen Tooltip mit Begründung („Video is not available on YouTube").

Polling fängt den Status-Wechsel auf — Row aktualisiert sich automatisch nach max. `intervalMs` (5 s).

---

## 7. Polling-Architektur

### 7.1 Drei zentrale SWR-Hooks

```ts
// lib/client/use-playlist-detail.ts
export function usePlaylistDetail(
  id: number,
  opts: { intervalMs?: number; fallbackData?: PlaylistDetailDto } = {}
) {
  return useSWR<PlaylistDetailDto>(
    `/api/playlists/${id}`,
    fetcher,
    {
      refreshInterval: opts.intervalMs ?? 5_000,
      revalidateOnFocus: true,
      refreshWhenHidden: false,
      fallbackData: opts.fallbackData,
    }
  );
}

// lib/client/use-jobs.ts
export function useJobs(p: { status?: JobStatus; limit?: number; intervalMs?: number }) {
  const url = `/api/jobs?${new URLSearchParams({ status: p.status ?? '', limit: String(p.limit ?? 50) })}`;
  return useSWR<JobsListDto>(url, fetcher, {
    refreshInterval: p.intervalMs ?? 10_000,
    refreshWhenHidden: false,
  });
}

// lib/client/use-job-summary.ts
export function useJobSummary(opts: { intervalMs?: number } = {}) {
  return useSWR<JobSummaryDto>('/api/jobs/summary', fetcher, {
    refreshInterval: opts.intervalMs ?? 30_000,
    refreshWhenHidden: false,
  });
}
```

### 7.2 Initial-Daten ohne Doppel-Fetch

`/playlists/[id]/page.tsx` (RSC):

```tsx
export default async function PlaylistDetailPage({ params }) {
  const ctx = await ensureBooted();
  const detail = await ctx.playlistService.getDetailFull(Number(params.id));
  if (!detail) notFound();
  return (
    <>
      <PlaylistDetailHeader detail={detail} />
      <PlaylistDetailItems initialData={detail} playlistId={detail.playlist.id} />
    </>
  );
}
```

`<PlaylistDetailItems>` (Client) initialisiert SWR mit `fallbackData: initialData` — kein Layout-Shift, kein doppelter Fetch.

### 7.3 Visibility-Pause

SWR hat `refreshWhenHidden: false` built-in. Plus: Browser pausiert `setInterval` von selbst in Background-Tabs (modern), aber SWR's Visibility-Detection ist reaktiver. Damit nichts Polling-Spam macht.

### 7.4 Topbar-Job-Badge

`<TopbarJobBadge>` rendert nur wenn `summary.running > 0 || summary.queued > 0 || summary.failed > 0`. Klick → `router.push('/activity?tab=jobs')`. Visual: kleiner Pulsing-Dot in Akzent-Farbe + count.

---

## 8. API-Erweiterungen

### 8.1 `GET /api/playlists/[id]` — F1-Followup

Vollständiger Shape laut Hauptspec §8.3:

```ts
{
  playlist: {
    id, provider, externalId, title, channelTitle, url,
    defaultFormat, syncEnabled, lastSyncedAt, createdAt,
    activeSyncRunId: number | null,
    stats: { totalItems, availableItems, unavailableItems, downloadedItems },
  },
  items: Array<{
    position: number,
    inPlaylist: boolean,
    addedAt: string,
    removedFromPlaylistAt: string | null,
    video: {
      id, externalId, title, channelTitle, durationSeconds, thumbnailUrl,
      availabilityStatus, availabilityReason,
    },
    audioFile: { id, format, quality, fileSizeBytes, downloadedAt } | null,
    videoFile: { id, format, quality, fileSizeBytes, downloadedAt } | null,
    pendingJob: { id, type, status, attempts, lastError } | null,
  }>,
  recentSyncRuns: SyncRun[],   // letzte 10
}
```

Implementation in `playlistService.getDetailFull(id)` — eine SQL-Query mit `LEFT JOIN`-en (videos + media_files split per kind + pending jobs filtered by `payload->>'videoId'`). Performance-Ziel: <50 ms für 100-Item-Playlist.

### 8.2 `GET /api/jobs?status=&limit=&offset=`

```ts
{
  total: number,
  jobs: Array<{
    id, type, status, attempts, maxAttempts, priority,
    payload: unknown,
    lastError: string | null,
    createdAt, startedAt, finishedAt, nextAttemptAt,
    subject: { kind: 'video' | 'playlist'; id: number; title: string } | null,
  }>
}
```

`subject` ist resolved server-side (joined zu `videos` resp. `playlists` basierend auf `payload`-Inhalt). Sortierung: `createdAt DESC`. `?status=` ist Single-Value oder fehlend.

### 8.3 `GET /api/jobs/summary`

```ts
{ queued: number, running: number, failed: number, completed24h: number }
```

Aggregation via `SELECT status, COUNT(*) FROM jobs WHERE ... GROUP BY status`. Cache nicht nötig (SQLite ist schnell).

### 8.4 `POST /api/jobs/[id]/retry`

- Lookup Job; muss `status='failed'` sein, sonst `409 NOT_RETRYABLE`
- `UPDATE jobs SET status='queued', attempts=0, lastError=NULL, nextAttemptAt=NULL, startedAt=NULL, finishedAt=NULL`
- Signal Worker (`queue.signal()`)
- 200 OK

### 8.5 `GET /api/videos`

Nur Standalone (Videos ohne aktive `playlist_items`-Zuordnung):

```sql
SELECT v.* FROM videos v
WHERE NOT EXISTS (SELECT 1 FROM playlist_items pi WHERE pi.video_id = v.id AND pi.in_playlist = 1)
ORDER BY v.created_at DESC
```

Plus joined `media_files` und `pendingJob` (selbe Logik wie Playlist-Detail-Items).

### 8.6 `POST /api/videos/[id]/download`

**Body:** `{ kind: 'audio' | 'video' }`
**Flow:**
- Lookup Video; 404 wenn nicht
- 409 wenn `availabilityStatus !== 'available'`
- `queue.enqueue('download_video', { videoId, kind }, { priority: 15 })` — manueller Re-Download hat höhere Priority als auto-download (priority 5)
- 202 `{ jobId }`

### 8.7 `POST /api/videos/[id]/refresh`

Body leer. `queue.enqueue('check_availability', { videoId }, { priority: 10 })`. 202 `{ jobId }`.

### 8.8 `GET /api/storage/usage`

```ts
{
  audio: { totalBytes: number, fileCount: number },
  video: { totalBytes: number, fileCount: number }
}
```

`SELECT kind, SUM(file_size_bytes) AS total, COUNT(*) AS count FROM media_files GROUP BY kind`. Keine Disk-Calls — DB-Sicht reicht für Plan 5.

---

## 9. Server-Actions

### 9.1 Result-Pattern

```ts
// lib/actions/types.ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } };
```

### 9.2 Action-Liste

```ts
// lib/actions/playlist-actions.ts
"use server";
export async function addPlaylistAction(input: {
  url: string;
  defaultFormat: "audio" | "video";
}): Promise<ActionResult<{ playlistId: number; syncJobId: number }>>;

export async function syncPlaylistAction(
  playlistId: number
): Promise<ActionResult<{ syncJobId: number }>>;

export async function deletePlaylistAction(
  playlistId: number
): Promise<ActionResult<{ deleted: true }>>;

// lib/actions/video-actions.ts
"use server";
export async function addVideoAction(input: {
  url: string;
  format: "audio" | "video";
}): Promise<ActionResult<{ videoId: number; downloadJobId: number }>>;

export async function downloadVideoAction(
  videoId: number,
  kind: "audio" | "video"
): Promise<ActionResult<{ jobId: number }>>;

export async function refreshVideoAction(
  videoId: number
): Promise<ActionResult<{ jobId: number }>>;

// lib/actions/job-actions.ts
"use server";
export async function retryJobAction(
  jobId: number
): Promise<ActionResult<{ retried: true }>>;

// lib/actions/settings-actions.ts
"use server";
export async function updateSettingsAction(
  patch: Partial<AppSettingsDto>
): Promise<ActionResult<{ updated: true }>>;
```

Jede Action ruft `await ensureBooted()`, dispatcht zum entsprechenden Service, fängt Domain-Errors via `mapServiceError(err)`, gibt Result zurück. Niemals throw aus einer Server-Action — Errors sind Daten.

### 9.3 Cache-Invalidation

| Action | revalidatePath |
|---|---|
| `addPlaylistAction` | `/playlists` |
| `deletePlaylistAction` | `/playlists` |
| `syncPlaylistAction` | `/playlists/${id}`, `/playlists` |
| `addVideoAction` | `/playlists` (Standalone-Tab) |
| `downloadVideoAction` | (keine — SWR pollt) |
| `refreshVideoAction` | (keine — SWR pollt) |
| `retryJobAction` | (keine — SWR pollt) |
| `updateSettingsAction` | `/settings` |

---

## 10. Settings — konkrete Felder

shadcn `<Tabs>` mit 6 Tabs. URL-State via `?tab=`. Jede Section ist eine eigene Client-Component mit eigenem Form + Save-Button (kein global Save).

### 10.1 General

- **Theme:** Select Light / Dark / System (writes via `next-themes`-Provider)
- **App Version + GitHub-Link:** read-only, gerendert aus `package.json`-Version

### 10.2 Storage

- **Use single path for both:** `<Switch>`
- **Audio Storage Path:** `<Input type="text">` mit Hint „Path must exist and be writable"; bei Save validate via `selfCheckService.checkPath(path)` server-side, return `error.code='STORAGE_PATH_INVALID'` wenn nicht gut
- **Video Storage Path:** `<Input>` (disabled wenn Single-Path-Switch an)
- **Disk Usage Display:** zwei Progress-Bars + GB / Track-Count pro Pfad (data von `useStorageUsage()`-Hook). Refresh manuell via Button.
- Cleanup-Button: **nicht** in Plan 5

### 10.3 Audio Defaults

- **Default Format:** `<Select>` mp3 / m4a / opus / flac / best
- **Default Bitrate:** `<Select>` 128 / 192 / 256 / 320 / vbr
- **Embed Thumbnail:** `<Switch>`

### 10.4 Video Defaults

- **Default Quality:** `<Select>` 480p / 720p / 1080p / 1440p / 2160p / best
- (Container/Codec lassen wir weg — yt-dlp-Defaults reichen)

### 10.5 Sync

- **Global Schedule:** `<Select>` Presets `Off` / `Every hour` / `Every 6 hours` / `Daily 03:00` / `Weekly Sun 03:00`. Mapping zu Cron-Strings server-side. Keine Free-Form. (`Off` schreibt `null`.)
- **Sync on App Start:** `<Switch>`
- **Concurrency:** `<Input type="number" min=1 max=10>`, default 3

### 10.6 Advanced

- **yt-dlp Path:** `<Input>` (leer = auto-detect via PATH); **„Test"-Button** ruft `selfCheckService.checkYtdlp(path?)` und zeigt OK/Fail inline
- **ffmpeg Path:** analog
- **Notice unter dem Block:** „Restart app after changing these"

### 10.7 Persistierung

`updateSettingsAction(patch)` schreibt nur die in `patch` enthaltenen Felder. Jede Section gibt nur den eigenen Slice ab. Result-Treatment: bei `STORAGE_PATH_INVALID` inline-Error im Path-Feld, alles andere → Toast „Settings saved" / „Failed to save".

---

## 11. Activity — konkrete Felder

shadcn `<Tabs>`. URL-State `?tab=history|jobs`. Default `history`.

### 11.1 History-Tab (RSC, kein Polling)

- Liste der letzten 50 sync_runs descending
- Pro Row: `[● success]  Lo-Fi Beats  •  3 added, 1 removed, 0 unavailable  •  2026-04-26 14:23  •  triggered manual`
  - Status-Pill (success/partial/failed)
  - Playlist-Title (Link → `/playlists/[id]`)
  - Stats inline
  - Relative-Time + Trigger
- Klick auf Row → expand `error_log` als Code-Block (JetBrains Mono)
- Filter-Chips oben: All / Success / Partial / Failed (URL-State `?status=`)

Empty-State: „No syncs yet"

### 11.2 Jobs-Tab (Client, SWR `useJobs({ status, intervalMs: 10_000 })`)

- Filter-Chips: All / Running / Queued / Failed / Completed (24h) (URL-State `?status=`)
- Tabelle Spalten: `Type | Subject | Status | Attempts | Started | Last Error | Action`
  - **Type:** Badge mit Icon — `Download` ⬇ (download_video), `RefreshCw` ↻ (sync_playlist), `Search` 🔍 (check_availability)
  - **Subject:** Resolved Display-Name (server-side joined). Bei `download_video`: Video-Title. Bei `sync_playlist`: Playlist-Title. Bei `check_availability`: Video-Title. Klickbar → `/playlists/[id]` resp. `/videos/[id]` (Plan 6, in Plan 5 nur bei `sync_playlist` clickable, sonst plain text).
  - **Status:** Pill
  - **Attempts:** `2/3` Format
  - **Started:** Relative-Time oder „—" wenn `queued`
  - **Last Error:** Truncated 60 chars + Tooltip mit Full-Text
  - **Action:** bei `failed` → „Retry"-Button → `retryJobAction(id)` + Toast; bei `running` → kleiner Cancel-Button **disabled** mit Tooltip „Cancel coming soon"

Empty-State: „No active jobs"

---

## 12. Visual-Style

### 12.1 Tokens (erweitert in `globals.css`)

```css
@theme {
  /* Bestehend */
  --color-bg, --color-fg, --color-muted, --color-muted-bg, --color-border, --color-accent;
  --font-sans: Inter, ...;
  --font-mono: JetBrains Mono, ...;

  /* Neu in Plan 5 */
  --color-status-available: oklch(0.7 0.13 145);
  --color-status-private:   oklch(0.7 0.12 60);
  --color-status-removed:   oklch(0.6 0.15 25);
  --color-status-unknown:   oklch(0.55 0 0);

  --color-status-bg-available: color-mix(in oklch, var(--color-status-available) 12%, transparent);
  /* analog für die anderen */
}
```

### 12.2 Status-Pill

- Höhe `h-5`, Padding `px-2`, Radius `rounded-md`, Text `text-xs font-medium lowercase tracking-tight`
- Sans-Font (NICHT Mono — Mono ist nur für Pfade/IDs/Cron)
- Hintergrund: `--color-status-bg-*`, Text + Icon: `--color-status-*`
- Icons via `lucide-react`: Check / Lock / Ban / EyeOff / Globe / HelpCircle / Clock (queued) / Loader2 (running, animated) / AlertCircle (failed)

### 12.3 Track-Table-Density

- Row-Höhe `h-12`, Padding-Y `py-2`
- Title `text-sm font-medium`, Channel `text-xs text-muted`
- Cover-Thumbnail `h-9 w-12 rounded` (16:9)
- Hover: `bg-muted-bg/40`, kein zoom/scale
- Spalten: # | Cover+Title | Channel | Duration | Added | Status | Actions
- Mobile: nur Cover+Title (mit Channel + Duration als 2nd line) + Status + Actions

### 12.4 Mobile (<768 px)

- Sidebar ersetzt durch Bottom-Tab-Bar (4 Items: Home, Playlists, Activity, Settings) — sticky-bottom
- Topbar bleibt, AddDropdown wird Icon-only (`Plus`-Icon)
- Track-Table → 2-line-Layout, Touch-Targets `min-h-12`
- Add-Dialoge → shadcn `Sheet` (full-screen-bottom statt Modal)
- Settings-Tabs vertikal stackbar via shadcn `Tabs orientation="vertical"`

### 12.5 Empty + Loading + Error

- **EmptyState** (`shared/empty-state.tsx`): zentriert, Icon (`lucide-react`, gross), Headline `text-base font-medium`, Sublabel `text-sm text-muted`, optional CTA-Button
- **SkeletonRow** (`shared/skeleton-row.tsx`): grau pulsierende Boxen in Track-Row-Layout, 8 Rows als Default
- **ErrorCard** (`shared/error-card.tsx`): rot-tönierte Card, Icon, Headline „Couldn't load", Message, „Try again"-Button (calls `router.refresh()` resp. SWR `mutate()`)
- Next 15 `loading.tsx` in jeder Route mit Page-Layout-Skeleton
- Next 15 `error.tsx` Boundary in jeder Route → ErrorCard

---

## 13. Error-Handling-Pattern

Drei Klassen von Errors mit unterschiedlichen UI-Behandlungen:

| Klasse | Beispiele | UI-Treatment |
|---|---|---|
| **Form-Validation** | Leeres URL-Feld, Bitrate negativ | Inline unter Field (red-text), Submit-Button disabled bis valid |
| **Domain-Error** | `URL_NOT_PLAYLIST`, `PLAYLIST_ALREADY_TRACKED`, `PROVIDER_UNSUPPORTED`, `SYNC_ALREADY_RUNNING`, `STORAGE_PATH_INVALID`, `NOT_RETRYABLE` | Inline im Form/Dialog/Section. Mit Action-Link wenn Recovery offensichtlich (z.B. „Already tracked — open it") |
| **System-Error** | Network-Fehler, `INTERNAL`, `DB_LOCKED`, unhandled | Sonner-Toast destructive. `description: error.message`. Console-Error für Debug. |

**Server-Action-Result-Pattern** (siehe §9.1): Status-Code als `error.code`, user-visible Message als `error.message`, Field-Hint als `error.field` (RHF setzt Field-Error darauf).

**Page-Level-Errors:**
- RSC-Page schmeißt → Next 15 `error.tsx`-Boundary fängt → ErrorCard mit Reset-Button
- RSC-Page nutzt `try/catch` um Service-Calls und rendert ErrorCard inline für erwartete Service-Fehler

**Self-Check-Banner-Verlinkung:**
- yt-dlp missing → Banner-Link „Configure" → `/settings?tab=advanced`
- ffmpeg missing → analog
- Storage-Path missing → `/settings?tab=storage`
- DB-Migrations failed → Banner persistent, Service-Layer-Error in Dashboard

---

## 14. Testing-Strategie

| Schicht | Tooling | Beispiele |
|---|---|---|
| Pure Unit | vitest | StatusPill-Variant-Mapping, FormattedBytes, Duration-Format, Cron-Preset-Map (label↔cron), `mapServiceError` |
| Server-Action | vitest + `:memory:` + boot-test-context | `addPlaylistAction` happy + URL_NOT_PLAYLIST + PLAYLIST_ALREADY_TRACKED + PROVIDER_UNSUPPORTED, `retryJobAction` happy + NOT_RETRYABLE, `updateSettingsAction` partial-update |
| API-Route (neu) | vitest + direct route-handler | `GET /api/jobs/summary`, `GET /api/jobs?status=`, `POST /api/jobs/[id]/retry`, `GET /api/playlists/[id]` (full shape), `POST /api/videos/[id]/download` (200 + 404 + 409), `POST /api/videos/[id]/refresh`, `GET /api/storage/usage`, `GET /api/videos` (standalone) |
| Component | vitest + RTL + happy-dom | `<StatusPill>` (alle Status), `<TrackRow>` (Pending-Job-State, Disabled-Logik im Kontextmenü), `<AddPlaylistDialog>` (Form-Validation, Mock-Server-Action) |
| RSC-Page | vitest + happy-dom + service-mocks | Render `/playlists/page.tsx` mit gemockten Services + Daten — assert Strukturen, Empty-States, Filter-Chips |
| Polling-Hook | vitest + fake-timers + msw | `usePlaylistDetail` initial fallback, refetch nach interval, Stop bei `document.hidden`, Resume bei `visibilitychange` |
| Integration | vitest + `:memory:` + FakeAdapter + tmpdir | „addPlaylistAction → sync_playlist Job läuft → FakeAdapter liefert items → DB-State → GET /api/playlists/[id] zeigt items mit pendingJob → nach Download-Job läuft erscheint audioFile" |

**Test-Helpers** (neu):
- `lib/test-utils/boot-test-context.ts` — baut `BootContext` aus `:memory:`-DB + FakeAdapter + tmpdir-Storage
- `lib/test-utils/server-action-overrides.ts` — `__setBootContextForTesting(ctx)` Hook, gated `process.env.NODE_ENV === 'test'`. Server-Actions checken den Override, sonst `ensureBooted()`.

**Coverage-Ziele:**
- Server-Actions: 90 %+
- Neue API-Routes: ein Happy + alle dokumentierten 4xx pro Endpoint
- Components mit Logik (TrackRow, AddPlaylistDialog, JobsTab, Sections): 80 %+
- Pure Components (StatusPill, EmptyState, ErrorCard, Skeleton): 100 %
- Polling-Hooks: 90 %+
- RSC-Pages: ein Happy + ein Error-Render pro Page

**UI-Smoke (Done-Gate via browser-use-Skill):**
- `npm run dev`, browser-use Skill steuert:
  1. Add Playlist Dialog → URL paste → Submit → Detail-Page zeigt Items → Pending-Job-Indicator → Audio-File erscheint
  2. Re-Sync-Button → Sync-Run startet → Activity zeigt running Job
  3. Add Video Dialog → Standalone-Tab zeigt Video
  4. Settings → Storage-Path ändern → Save → Toast → Reload zeigt persistiert
  5. Topbar-Job-Badge erscheint während Job → Klick → Activity Jobs-Tab
- Screenshots: Light + Dark + Mobile (375 px) für jede Page (Dashboard, Playlists, Detail, Activity, Settings)
- **Was NICHT** in Plan 5: Playwright-E2E (Plan 6 mit Player); Visual-Regression-Snapshots (verboten laut Spec §10.8); Cross-Browser-Tests

---

## 15. End-State von Plan 5

Nach Plan 5 funktioniert die App vollständig in der UI:

```
Browser http://localhost:3000

→ Dashboard zeigt Stats + Recent Activity
→ + Add ▾ → Add Playlist → Dialog → URL → Submit → Redirect /playlists/[id]
  → Items erscheinen live, Pending-Job-Spinner pro Row, dann Audio-File
→ Sidebar: Playlists / Activity / Settings funktionieren
→ Activity → History (sync_runs) + Jobs (Live-polling, Retry-Button für failed)
→ Settings → 6 Tabs, alle Felder schreiben + persistieren
→ Track-Row-Kontextmenü: Re-Download / Refresh / Open-on-YT
→ Topbar-Job-Badge zeigt aktive Jobs während Background-Operations
→ Light / Dark / Mobile alle responsive
```

Was **nicht** funktioniert in Plan 5:
- Audio/Video abspielen (kein Player → Plan 6)
- Library-Search (kein /library → Plan 6)
- Video-Detail-Page (kein /videos/[id] → Plan 6)
- Cancel laufender Jobs (UI da, disabled → späterer Plan)

---

## 16. Risiken + Offene Fragen

### 16.1 Risiken

- **Service-Direct-Calls aus RSC schmeißen:** Wenn `ensureBooted()` failt (z.B. DB-Migration crash), crasht die ganze App. **Mitigation:** Next 15 `error.tsx`-Boundary fängt; `ensureBooted` wirft sauber strukturierte `BootError`-Klassen, die das Boundary in sinnvolle UI mappt.
- **Server-Action-Test-Override-Hook:** Das Pattern `__setBootContextForTesting` ist test-only und muss strikt gegated sein. **Mitigation:** Compile-time-Constant-Check (`process.env.NODE_ENV === 'test'`) + Lint-Rule (oder TypeScript `assert(process.env.NODE_ENV === 'test')` zur Runtime).
- **SWR-Stale-Data nach Server-Action:** Server-Actions invalidieren `revalidatePath`, aber SWR-Cache ist Client-State und wird davon nicht direkt refreshed. **Mitigation:** Nach erfolgreichen Server-Actions in den Client-Components zusätzlich `mutate(swrKey)` triggern (oder simpler: Server-Action gibt Result, Client-Component called `mutate()`).
- **Polling-Cost auf großen Detail-Pages:** 100-Item-Playlist alle 5 s vollen Shape zu liefern (mit JOINs) könnte spürbar werden. **Mitigation:** Performance-Ziel <50 ms in Tests; bei größeren Playlists kann der Refresh-Interval langsamer werden (auf 10 s adaptiv?). Plan-5-Default 5 s reicht für Phase 1.
- **shadcn-Component-Updates:** shadcn ist „copy-paste, owns the code" — keine automatischen Updates. **Mitigation:** Akzeptiert. Hauptspec stand fest.
- **Mobile-Bottom-Tab-Bar überlappt mit Player-Bar (Plan 6):** Plan 5 hat keinen Player, aber Plan 6 wird beide stacken müssen. **Mitigation:** Wir designen die Bottom-Bar so, dass Plan 6 darüber den Player-Bar einfügen kann ohne Layout-Shift.

### 16.2 Offene Fragen für Implementation-Phase

- Konkrete `next-themes`-Provider-Konfiguration (`attribute=class` vs. `attribute=data-theme`) — entscheiden wir bei Setup; default ist `class`.
- Genaue Cron-Preset-Strings (z.B. `"0 3 * * *"` für „Daily 03:00") — finalisieren in `lib/utils/cron-presets.ts`.
- Ob Detail-Page-Items-Tabelle Virtual-Scrolling braucht (>500 Items) — Plan-5-Default: nein, Plan 6 evaluieren.
- Genaue Toast-Lifetime und Position (Sonner-Defaults reichen wahrscheinlich) — finalisieren bei Setup.

---

## 17. Glossar (Plan-5-spezifisch)

| Begriff | Bedeutung |
|---|---|
| **RSC** | React Server Component; rendert auf Server, kein JS im Bundle |
| **Server Action** | Next 15 Pattern: `"use server"`-marked async function, callable from Client without manual API |
| **fallbackData** | SWR-Pattern für initial Data ohne ersten Fetch (RSC liefert, SWR übernimmt) |
| **Pending Job** | Job mit `status='queued' | 'running'`, der zu einem Video/Playlist gehört (in Detail-View pro-Item ausgelesen) |
| **Topbar-Job-Badge** | Polling-Indicator rechts in der Topbar mit aktiver Jobs-Anzahl |
| **Subject (Job)** | Server-resolved Display-Name eines Jobs (Video-Title oder Playlist-Title basierend auf payload) |
| **Action-Result** | Discriminated-Union `{ok:true; data} | {ok:false; error}` für Server-Actions |

---

**Ende der Plan-5-Spec.**
