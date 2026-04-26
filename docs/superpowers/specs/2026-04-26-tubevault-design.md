# TubeVault — Design Spec

**Datum:** 2026-04-26
**Status:** Draft (Brainstorming abgeschlossen, wartet auf User-Review)
**Autor:** Nils + Claude (via superpowers:brainstorming)

---

## 1. Problem & Vision

**Problem:** YouTube-Playlists sind volatil. Wenn ein Channel ein Musikvideo löscht, verschwindet es aus der Playlist und ist für den User unwiederbringlich weg. Bei Channel-Bans, Region-Blocks oder „private"-Schaltungen genauso. Eine kuratierte Playlist degradiert mit der Zeit.

**Vision:** **TubeVault** ist eine lokale App, die YouTube-Playlists (und später SoundCloud / andere Quellen) **proaktiv sichert** — Audio bzw. Video wird heruntergeladen, sobald ein Track in einer beobachteten Playlist auftaucht. Verschwindet der Track später bei der Quelle, bleibt er lokal hörbar und wird in der UI mit einem Status-Badge gekennzeichnet. Eingebauter Audio- + Video-Player macht TubeVault zur primären Hör-Oberfläche.

**Erfolgskriterien:**

- User fügt eine Playlist-URL hinzu → in unter 1 Minute sind die ersten Tracks abspielbar
- User sieht auf einen Blick, welche Tracks bei der Quelle nicht mehr verfügbar sind, kann sie aber lokal weiter abspielen
- Sync läuft automatisch nach konfigurierter Schedule, solange die App-Instanz läuft (kein manuelles Triggern pro Sync nötig)
- App läuft auf einem normalen Windows-/macOS-/Linux-Rechner, keine Cloud-Dependencies

---

## 2. Architektur

### 2.1 Tech-Stack

- **Next.js 15** (App Router, TypeScript) — Frontend + Backend in einem Prozess
- **SQLite** via `better-sqlite3` — embedded, zero-config, einzelne Datei
- **Drizzle ORM** + `drizzle-kit` — typsicher, schlanke Migrations
- **yt-dlp** als externe CLI — ruft via `child_process` auf (`node-yt-dlp-wrap` als Convenience-Wrapper)
- **ffmpeg** als externe CLI — für Audio-Extraction, Thumbnail-Embedding, Loudness-Normalization
- **Tailwind CSS** + **shadcn/ui** als Komponenten-Basis
- **TanStack Query** — Client-State für API-Calls, Caching, Revalidation
- **Zustand** — globaler Player-State (Queue, currentTrack, etc.)
- **`@dnd-kit`** — Queue-Reorder
- **Vitest** + **Playwright** — Tests

### 2.2 Layered Struktur

```
┌─────────────────────────────────────────────┐
│  UI Layer (React Components, App Router)    │  Pages, Player, Library, Settings
├─────────────────────────────────────────────┤
│  API Layer (Route Handlers + Server Actions)│  /api/playlists, /api/sync, /api/stream
├─────────────────────────────────────────────┤
│  Service Layer (Business Logic)              │  PlaylistService, SyncService, DownloadService
├─────────────────────────────────────────────┤
│  Adapter Layer                               │  ProviderAdapters (YouTube, SoundCloud), Ffmpeg, Fs
├─────────────────────────────────────────────┤
│  Data Layer (Drizzle, better-sqlite3)        │  Repositories, Migrations
└─────────────────────────────────────────────┘
```

**Begründung:**

- Service-Layer ist UI-agnostisch → leicht testbar mit Vitest, kein Browser nötig
- Adapter-Layer kapselt yt-dlp/ffmpeg → bei Breaking Changes nur ein Adapter-Tausch nötig
- UI-Layer ist die einzige Schicht die „Browser" annimmt → bei späterer Tauri-/Electron-Verpackung minimaler Aufwand

### 2.3 Deployment-Modi

| Modus                  | Beschreibung                                                     | Phase                                 |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| **Lokal**              | `npm run dev` oder `npm run start`, User öffnet `localhost:3000` | Phase 1 (Start)                       |
| **Dockerized auf NAS** | Docker-Container, mountet Storage-Volume, vom LAN aus erreichbar | Phase 2 (optional, wenn User es will) |
| **Tauri/Electron**     | Native Desktop-App mit System-Tray                               | Phase 3 (optional)                    |

**Architekturentscheidung:** Phase 1 wird so gebaut, dass Phase 2 ein Dockerfile + ein paar Env-Vars ist. Keine Phase-2-Features (Multi-User-Auth, etc.) werden vorab eingebaut (YAGNI).

### 2.4 Background Jobs

- **In-Process Job-Runner** — eine in-memory Queue, die in der `jobs` SQLite-Tabelle persistiert wird
- Bei App-Start: alle Jobs mit Status `running` werden zurück auf `queued` gesetzt (Crash-Recovery)
- Worker-Pool mit konfigurierbarer Concurrency (default 3 parallel Downloads)
- Kein externes Redis/BullMQ in Phase 1 (Single-User, Single-Process — overkill)
- Migration zu BullMQ wenn skaliert wird: 1-Tagesjob, weil Job-Interface bereits abstrahiert

---

## 3. Datenmodell

### 3.1 Multi-Provider-Fähigkeit

**Wichtige Designentscheidung:** Tabellen sind provider-agnostisch ausgelegt, damit später SoundCloud / Bandcamp / Vimeo / etc. ohne Schema-Migration dazukommen können.

- Statt `youtube_id` → `external_id` + `provider` (Enum)
- Unique-Key auf `(provider, external_id)`

### 3.2 Tabellen

#### `playlists`

| Spalte               | Typ            | Beschreibung                                             |
| -------------------- | -------------- | -------------------------------------------------------- |
| `id`                 | INTEGER PK     |                                                          |
| `provider`           | TEXT           | `'youtube' \| 'soundcloud' \| ...`                       |
| `external_id`        | TEXT           | YT Playlist-ID, SC Set-Slug, etc.                        |
| `title`              | TEXT           |                                                          |
| `channel_title`      | TEXT           |                                                          |
| `url`                | TEXT           | Original-URL                                             |
| `default_format`     | TEXT           | `'audio' \| 'video'`                                     |
| `format_overrides`   | JSON           | Optional: `{audio_bitrate: 320, video_quality: '1080p'}` |
| `sync_enabled`       | INTEGER (bool) |                                                          |
| `sync_schedule_cron` | TEXT NULL      | Override für globale Schedule                            |
| `last_synced_at`     | TIMESTAMP NULL |                                                          |
| `created_at`         | TIMESTAMP      |                                                          |

Unique: `(provider, external_id)`

#### `videos`

| Spalte                    | Typ        | Beschreibung                                                                                 |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| `id`                      | INTEGER PK |                                                                                              |
| `provider`                | TEXT       |                                                                                              |
| `external_id`             | TEXT       |                                                                                              |
| `title`                   | TEXT       |                                                                                              |
| `channel_title`           | TEXT       |                                                                                              |
| `channel_id`              | TEXT       |                                                                                              |
| `duration_seconds`        | INTEGER    |                                                                                              |
| `thumbnail_url`           | TEXT       |                                                                                              |
| `availability_status`     | TEXT       | `'available' \| 'private' \| 'removed' \| 'age_restricted' \| 'region_blocked' \| 'unknown'` |
| `availability_reason`     | TEXT NULL  | Original-Message vom Provider                                                                |
| `availability_changed_at` | TIMESTAMP  |                                                                                              |
| `first_seen_at`           | TIMESTAMP  |                                                                                              |
| `last_seen_at`            | TIMESTAMP  |                                                                                              |
| `created_at`              | TIMESTAMP  |                                                                                              |
| `updated_at`              | TIMESTAMP  |                                                                                              |

Unique: `(provider, external_id)`

#### `playlist_items` (Join Playlist ↔ Video)

| Spalte                     | Typ            | Beschreibung                                          |
| -------------------------- | -------------- | ----------------------------------------------------- |
| `id`                       | INTEGER PK     |                                                       |
| `playlist_id`              | INTEGER FK     |                                                       |
| `video_id`                 | INTEGER FK     |                                                       |
| `position`                 | INTEGER        | Reihenfolge in der Playlist                           |
| `in_playlist`              | INTEGER (bool) | true wenn beim letzten Sync drin, false wenn entfernt |
| `removed_from_playlist_at` | TIMESTAMP NULL |                                                       |
| `added_at`                 | TIMESTAMP      |                                                       |

Unique: `(playlist_id, video_id)`

**Trennung wichtig:** „Video gelöscht bei YouTube" (`videos.availability_status`) ist getrennt von „Video aus dieser Playlist entfernt" (`playlist_items.in_playlist`). Ein Video kann aus einer Playlist gekickt werden, aber in einer anderen weiter existieren — und auf YouTube weiter verfügbar sein.

#### `media_files`

| Spalte             | Typ        | Beschreibung                                                     |
| ------------------ | ---------- | ---------------------------------------------------------------- |
| `id`               | INTEGER PK |                                                                  |
| `video_id`         | INTEGER FK |                                                                  |
| `kind`             | TEXT       | `'audio' \| 'video'`                                             |
| `file_path`        | TEXT       | Absoluter Pfad                                                   |
| `format`           | TEXT       | `'mp3' \| 'm4a' \| 'opus' \| 'flac' \| 'mp4' \| 'webm' \| 'mkv'` |
| `quality`          | TEXT       | z.B. `'320kbps'`, `'1080p'`, `'best'`                            |
| `file_size_bytes`  | INTEGER    |                                                                  |
| `duration_seconds` | INTEGER    |                                                                  |
| `checksum`         | TEXT NULL  | sha256 für Integrity-Checks                                      |
| `downloaded_at`    | TIMESTAMP  |                                                                  |

Ein Video kann beides haben (Audio-Rip + Video-Rip). Pro `(video_id, kind)` ist ein File aktiv; ältere Versionen werden überschrieben (kein Versions-History in Phase 1).

#### `sync_runs` (Audit-Log)

| Spalte               | Typ            | Beschreibung                                                 |
| -------------------- | -------------- | ------------------------------------------------------------ |
| `id`                 | INTEGER PK     |                                                              |
| `playlist_id`        | INTEGER FK     |                                                              |
| `started_at`         | TIMESTAMP      |                                                              |
| `finished_at`        | TIMESTAMP NULL |                                                              |
| `status`             | TEXT           | `'running' \| 'success' \| 'partial' \| 'failed'`            |
| `videos_added`       | INTEGER        |                                                              |
| `videos_removed`     | INTEGER        |                                                              |
| `videos_unavailable` | INTEGER        |                                                              |
| `videos_downloaded`  | INTEGER        |                                                              |
| `error_log`          | JSON NULL      | Liste von Errors mit `{video_id?, code, message, timestamp}` |
| `triggered_by`       | TEXT           | `'manual' \| 'schedule' \| 'startup'`                        |

#### `jobs` (Persistente Queue)

| Spalte         | Typ            | Beschreibung                                                      |
| -------------- | -------------- | ----------------------------------------------------------------- |
| `id`           | INTEGER PK     |                                                                   |
| `type`         | TEXT           | `'sync_playlist' \| 'download_video' \| 'check_availability'`     |
| `payload`      | JSON           | Job-spezifisch                                                    |
| `status`       | TEXT           | `'queued' \| 'running' \| 'completed' \| 'failed' \| 'cancelled'` |
| `priority`     | INTEGER        | Default 0, höher = früher                                         |
| `attempts`     | INTEGER        |                                                                   |
| `max_attempts` | INTEGER        | Default 3                                                         |
| `last_error`   | TEXT NULL      |                                                                   |
| `created_at`   | TIMESTAMP      |                                                                   |
| `started_at`   | TIMESTAMP NULL |                                                                   |
| `finished_at`  | TIMESTAMP NULL |                                                                   |

#### `settings` (Key/Value Store)

| Spalte       | Typ                 |
| ------------ | ------------------- |
| `key`        | TEXT PK             |
| `value`      | TEXT (JSON-encoded) |
| `updated_at` | TIMESTAMP           |

Beispiel-Keys: `audio_storage_path`, `video_storage_path`, `use_single_storage_path`, `default_audio_format`, `default_audio_bitrate`, `default_video_quality`, `embed_thumbnails`, `global_sync_cron`, `concurrency_max`, etc.

### 3.3 Migrations

- Drizzle-Kit generiert SQL-Migrations aus Schema-TS-Files in `drizzle/migrations/`
- App-Start applied alle ausstehenden Migrations automatisch
- Pre-Migration-Backup: SQLite-Datei wird vor jedem Migration-Run kopiert (`tubevault.db.backup-<timestamp>`)

---

## 4. Provider-Layer (Multi-Source-fähig)

### 4.1 Adapter-Interface

```ts
interface MediaProviderAdapter {
  readonly provider: ProviderId; // 'youtube' | 'soundcloud' | ...
  matchesUrl(url: string): boolean;
  fetchPlaylist(url: string): Promise<PlaylistMetadata>;
  fetchVideo(url: string): Promise<VideoMetadata>;
  download(externalId: string, opts: DownloadOpts): Promise<MediaFile>;
  checkAvailability(externalId: string): Promise<AvailabilityStatus>;
  mapStatus(rawStatus: string): AvailabilityStatus;
}
```

### 4.2 Provider Registry

```ts
class ProviderRegistry {
  register(adapter: MediaProviderAdapter): void;
  findByUrl(url: string): MediaProviderAdapter | null;
  findById(provider: ProviderId): MediaProviderAdapter | null;
}
```

URL-Matching geschieht zentral: `Add Playlist`-API ruft `registry.findByUrl(url)`, das Result entscheidet Provider + dispatcht an den passenden Adapter.

### 4.3 Phase-1-Implementierung

- **YouTubeAdapter** (yt-dlp-basiert): vollständig implementiert
- **SoundCloudAdapter**: nicht in Phase 1, aber Adapter-Stub als Beispiel/Test-Doppel kann existieren

### 4.4 Status-Enum (provider-agnostisch)

```ts
type AvailabilityStatus =
  | "available"
  | "private"
  | "removed"
  | "age_restricted"
  | "region_blocked"
  | "auth_required"
  | "unknown";
```

Jeder Adapter mappt seine provider-spezifischen Outputs auf dieses Enum.

---

## 5. Sync-Flow

### 5.1 Initial: Playlist hinzufügen

```
User pastes URL → POST /api/playlists
  ├─ ProviderRegistry.findByUrl(url) → adapter
  ├─ adapter.fetchPlaylist(url) → PlaylistMetadata + Liste von VideoStubs
  ├─ DB Transaction:
  │    ├─ INSERT INTO playlists
  │    ├─ For each video: UPSERT INTO videos
  │    ├─ For each video: INSERT INTO playlist_items (in_playlist=true)
  │    └─ INSERT INTO sync_runs (status='running', triggered_by='manual')
  └─ For each video: enqueue 'download_video' job
UI redirect → /playlists/[id] (Live-Progress via Polling oder SSE)
```

**Optional:** Toggle „Add without downloading" überspringt das Enqueuen — User bekommt nur Metadaten.

### 5.2 Re-Sync (manuell oder scheduled)

```
1. adapter.fetchPlaylist(url) → set_current = {external_ids}
2. DB query → set_known = {external_ids in playlist_items where in_playlist=true}
3. Diff:
   ADDED     = set_current - set_known
   REMOVED   = set_known - set_current
   UNCHANGED = set_current ∩ set_known

4. ADDED:    UPSERT videos, INSERT playlist_items, enqueue download
5. REMOVED:  UPDATE playlist_items SET in_playlist=false, removed_from_playlist_at=NOW
             (File bleibt liegen, video.availability bleibt unverändert)
6. UNCHANGED: enqueue 'check_availability' job für jedes (cheap, ohne Download)
```

### 5.3 Status Detection

`check_availability` Job führt aus:

```bash
yt-dlp --skip-download --print "%(availability)s\t%(title)s" <url>
```

Mapping (YouTube):

| yt-dlp output                   | DB status                   |
| ------------------------------- | --------------------------- |
| `public` / `unlisted`           | `available`                 |
| `private`                       | `private`                   |
| `Video unavailable` / `removed` | `removed`                   |
| `Sign in to confirm your age`   | `age_restricted`            |
| `not available in your country` | `region_blocked`            |
| Network/parse error             | `unknown` (retry next time) |

Status-Change wird in `videos.availability_status` + `availability_changed_at` gespeichert.

### 5.4 Concurrency-Modell

- **Pro Playlist:** max 1 aktiver Sync (Lock via `sync_runs.status='running'`-Check vor Start)
- **Global:** max N parallel Downloads (Setting `concurrency_max`, default 3)
- **App-Restart-Resilience:** Beim Boot werden alle Jobs mit `status='running'` zurück auf `queued` gesetzt
- **Retry:** Network-Errors → exponential backoff (1s, 4s, 16s), max 3 Versuche. Permanent-Errors → kein Retry.

### 5.5 Sync-Trigger

| Trigger       | Mechanismus                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- |
| **Manual**    | UI-Button „Sync Now" auf Playlist-Detail oder Library                                       |
| **Schedule**  | In-Process-Cron (z.B. `node-cron`) liest `playlists.sync_schedule_cron` oder Global-Setting |
| **App-Start** | Falls Setting `sync_on_startup=true`                                                        |

---

## 6. UI-Struktur

### 6.1 Routing

```
/                    Dashboard
/library             Alle Tracks/Videos (search + filter)
/playlists           Playlist-Übersicht
/playlists/[id]      Playlist-Detail
/videos/[id]         Video-Detail
/activity            Sync-History, Job-Queue
/settings            Globale Settings
```

### 6.2 Persistent Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Topbar:  [TubeVault]   [Search]              [+ Add ▾] [⚙]  │
├────────────┬─────────────────────────────────────────────────┤
│  Sidebar   │                                                 │
│            │              Main Content Area                  │
│            │                                                 │
├────────────┴─────────────────────────────────────────────────┤
│  Player Bar:  ◄◄ ▶ ►►  ━━●━━ 2:34/4:12   ♫ Title — Artist    │
└──────────────────────────────────────────────────────────────┘
```

- **Topbar:** Logo, Search, Add-Dropdown (Playlist / Video), Settings
- **Sidebar:** Navigation + Playlist-Liste mit Sync-Status-Indikator
- **Player Bar:** persistent, kollabierbar zu Mini

### 6.3 Track-Listen

Editorial-style Tabelle (kein Karten-Grid):

| #   | Track         | Channel | Duration | Added  | Status     | ⋮   |
| --- | ------------- | ------- | -------- | ------ | ---------- | --- |
| 12  | Cover + Titel | Channel | 4:12     | 3d ago | ●available | ⋯   |
| 13  | Cover + Titel | Channel | 3:47     | 2w ago | ⛔removed  | ⋯   |

- Status-Badges: dezente Pills, Farb-codiert (green/amber/red/gray) + Lucide-Icons
- Row-Click: Play sofort. Detail-Link: Video-Detail-Page.
- Filter-Chips: All / Available / Unavailable / Audio / Video + Search
- Provider-Icon-Spalte (vorbereitet für Multi-Provider, in Phase 1 nur YT)

### 6.4 Activity-Page

Timeline, chronologisch, filterbar:

```
2026-04-26 14:23  ✓ Sync 'Lo-Fi Beats'  +3 added, 1 removed, 1 became unavailable
2026-04-26 14:21  ⬇ Downloaded 'Track XY' (4.2 MB, 192kbps mp3)
2026-04-26 14:18  ⛔ 'Old Track' became unavailable (was: available)
```

### 6.5 Standalone Videos

User kann einzelne Videos ohne Playlist hinzufügen via „+ Add ▾ → Video":

- Wird als `videos`-Row angelegt, **kein** `playlist_items`-Eintrag
- Tauchen im `/library`-View auf, gefiltert über „Standalone"-Tab
- Sync-Re-Check geht über `check_availability`-Job (kein Playlist-Diff nötig)

### 6.6 Responsive

| Breakpoint     | Anpassung                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **≥1024px**    | Volle Sidebar + Mainview + Player-Bar                                                                 |
| **768–1023px** | Sidebar → Icon-Rail (40px), Tabelle behält Spalten                                                    |
| **<768px**     | Bottom-Tab-Bar statt Sidebar, Tabelle → kompakte Liste, Player-Fullscreen primär, Touch-Targets ≥44px |

Container-Queries via `@tailwindcss/container-queries` für isolierte Komponenten. PWA-fähig (Manifest + Service-Worker für Phase-2-NAS-Deployment).

### 6.7 Design-Sprache (modern, YouTube-adjacent)

- **Aesthetic:** „Modern app UI" — clean neutral, mainstream-modern (näher an YouTube/Vercel als an Notion/Linear). Kein „editorial"-Look, keine Display-Fonts, keine Slab-Mono in der Marke.
- **Colors:** Schwarz-Weiß-Fundament + EIN dezenter Akzent-Ton (Bronze/Amber-Range, kein Default-Blue, kein YT-Rot — kein Markenkonflikt)
- **Typography:**
  - **Sans:** Inter (UI, Headlines, Body) — neutrale, screen-optimierte Geometrie; nicht Geist (zu eigen)
  - **Mono:** JetBrains Mono — clean, ohne Slab-Serifen; **nur** für technische Inhalte (file paths, IDs, command names, Log-Lines)
  - **Marke / Wordmark / Navigation / Buttons:** ausnahmslos Sans, niemals Mono
- **Spacing:** großzügig auf Page-Level, dichte Track-Listen (iTunes/Foobar-Density, nicht Spotify-Mobile-Padding)
- **Corner-Radius:** subtil (`rounded-md`/`rounded-lg`), nicht `rounded-3xl` Pillen-Look
- **Motion:** sparsam und schnell; kein Lottie-Festival
- **Verboten:** Gradients, Glasmorphism, `rounded-3xl` auf alles, Pill-Hölle in 5 Farben, quirky Display-Fonts, Serif-Headlines, Slab-Mono in primärem UI-Text
- **Status-Badges:** klein, sans (nicht mono), lowercase, dezent gefärbt
- Eine `docs/design-language.md` wird im ersten UI-Implementation-Schritt angelegt und hält die finale Direction (konkrete Farben, Token-Namen, Spacing-Skala) für Implementer fest

---

## 7. Player-Modul

### 7.1 Streaming-API

```
Browser <audio src="/api/stream/[mediaFileId]">
       │
       ▼
[GET /api/stream/[mediaFileId]]
  ├─ Lookup file_path in DB (auth-check optional in Phase 2)
  ├─ Parse Range header
  ├─ fs.createReadStream(file_path, { start, end })
  └─ Response: 206 Partial Content
     Headers: Content-Type, Content-Length, Accept-Ranges: bytes
```

Range-Support essentiell für Seek, Bandwidth-Sparen, Video-Streaming.

### 7.2 State-Architektur (Zustand)

```ts
{
  queue: Track[]
  currentIndex: number
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: 'off' | 'one' | 'all'
  mode: 'mini' | 'expanded' | 'fullscreen'
}
```

Persistent in localStorage: `volume`, `shuffle`, `repeat`, letzte `queue` + `currentIndex` für Resume.

### 7.3 Komponenten-Tree

```
<PlayerProvider>                  // mounted in root layout
  <PlayerCore />                  // hidden <audio> + <video>
  <PlayerBar />                   // persistent unten
  <FullscreenPlayer />            // overlay wenn fullscreen
  <QueueDrawer />                 // side-drawer
</PlayerProvider>
```

### 7.4 Audio vs. Video

- **Audio-Track:** Mini-Player Cover + Controls. Fullscreen Cover-Art XL.
- **Video-Track:** Mini-Player zeigt kleinen Video-Preview. Expanded → zentral. Fullscreen → Browser-Fullscreen-API.
- Video läuft beim Scrollen weiter (Picture-in-Picture-Style im Player-Bar).

### 7.5 Queue-Aktionen

- Play Now / Add to Queue / Play Next / Play Playlist (incl. Shuffle)
- Drag-and-drop Reorder via `@dnd-kit`

### 7.6 Phase-1-Features

- Play / Pause / Skip / Prev / Seek / Volume / Shuffle / Repeat
- Queue mit Reorder
- Resume on restart
- Audio + Video Player
- Fullscreen-Mode
- Keyboard-Shortcuts (Space, ←/→, M)
- MediaSession API (Lockscreen-Controls Mobile)

### 7.7 Phase-2-Features (nicht Phase 1)

- Picture-in-Picture für Video
- Gapless Playback (Crossfade)
- EQ
- Lyrics (LRC-Files)
- Speed-Control

---

## 8. Settings

### 8.1 Tabs

#### General

- App-Name + Version (read-only)
- Theme: Light / Dark / System
- Language: EN only (Phase 1; i18n-ready architecture aber keine zweite Sprache shipped)

#### Storage

- **Audio Storage Path** (z.B. `~/Music/TubeVault/audio/`) mit Browse-Button + Validation
- **Video Storage Path** (z.B. `~/Videos/TubeVault/`) — separat einstellbar (z.B. Audio auf SSD, Video auf HDD)
- **Use single path for both** Toggle — wenn aktiv, wird nur ein Path verwendet (Default für Einsteiger)
- Phase 1: Text-Input mit Validation (existiert? writable?). Phase 2: Tauri-Native-Dialog
- **Naming Pattern** — z.B. `{playlist}/{channel} - {title}.{ext}` (gilt für beide Pfade)
- **Disk-Usage** Anzeige + Aufschlüsselung pro Playlist (zeigt beide Pfade getrennt)
- **Cleanup**: Lösche orphaned Files (in beiden Pfaden)

#### Audio Defaults

- Format: MP3 / M4A / Opus / FLAC / Best-Source
- Bitrate: 128 / 192 / 256 / 320 / VBR-Best
- Embed Thumbnail: on/off
- Embed Metadata: on/off
- Normalize Loudness (ffmpeg `loudnorm`): on/off

#### Video Defaults

- Resolution: 480p / 720p / 1080p / 1440p / 2160p / Best
- Container: MP4 / WebM / MKV
- Codec Preference: avc1 / vp9 / av1

#### Sync

- Global Schedule (cron-Expression mit Presets)
- Sync on App Start: on/off
- Concurrency: 1–10
- Retry: max attempts, backoff factor

#### Advanced

- yt-dlp Path (auto-detect / manual)
- ffmpeg Path (auto-detect / manual)
- yt-dlp Extra Args
- Cookies-File Path (für age-restricted)
- Database Vacuum Button
- Export / Import (JSON-Backup)

#### About

- Version, Lizenz, GitHub-Link

### 8.2 Override-Hierarchie

```
1. Pro-Download Override     → Track-Kontextmenü „Re-download as..."
2. Pro-Playlist Setting      → Playlist-Detail-Page „Format & Quality"-Block
3. Globaler Default          → Settings-Page
```

In der UI: Playlist-Override-Block zeigt „inherits from Settings" wenn nicht gesetzt.

---

## 9. Error-Handling

### 9.1 Klassen

| Klasse                         | Beispiele                            | Strategie                          | UI                                       |
| ------------------------------ | ------------------------------------ | ---------------------------------- | ---------------------------------------- |
| **Recoverable** (transient)    | Network-Timeout, 429                 | Exponential backoff, max 3 retries | Dezenter Indicator („Will retry in 16s") |
| **Permanent** (track-specific) | Private, Removed, Age-restricted     | Status setzen, kein Retry          | Badge auf Track-Row mit Tooltip          |
| **System** (App/Infra)         | yt-dlp missing, DB locked, Disk full | Stop sync, prominenter Banner      | Topbar-Indikator + Settings-Banner       |

### 9.2 Self-Check on Boot

App prüft beim Start:

- yt-dlp installiert + executable
- ffmpeg installiert + executable
- Storage-Path existiert + writable
- DB-Migrationen sauber durchlaufen
- Cookies-File (falls konfiguriert) lesbar

Health-Status auf der Settings-Page + Topbar-Dot (green/amber/red).

### 9.3 Error-Logs

- Strukturiert in `sync_runs.error_log` (JSON)
- Activity-Page filterbar nach Error-Typ
- „Copy Debug-Info" Button kopiert Sync-Run + System-Info als JSON für Issue-Reports

### 9.4 Was NICHT

- Keine Telemetry, kein Sentry, keine externen Crash-Reports — alles bleibt lokal
- Keine Modal-Errors die App blockieren — alles Toasts oder inline

---

## 10. Testing-Strategie

### 10.1 Test-Pyramide

```
   E2E (Playwright)         ~5–10 Tests, kritische User-Flows
   Integration (Vitest)     ~30–50 Tests, Service+DB+Adapter
   Unit (Vitest)            ~100+ Tests, Services/Utils/Adapters
```

### 10.2 Unit-Tests

Pflicht-Coverage für:

- `UrlParser` / `ProviderRegistry`
- `StatusMapper` (alle Mapping-Pfade pro Provider)
- `DiffAlgorithm` (added/removed/unchanged + edge cases)
- `Job-Queue Logic` (backoff, retry, state transitions)
- Adapter-Layer (mit gemocktem `child_process`)

### 10.3 Integration-Tests

- Repository-Layer gegen `:memory:` SQLite
- Sync-Service End-to-End mit Mock-Adapter
- Migrations laufen sauber durch
- Stream-API Range-Requests + 404

### 10.4 yt-dlp-Mocking

- Recorded Fixtures in `tests/fixtures/yt-dlp/` (`flat-playlist-*.json`, `availability-*.txt`, etc.)
- Mock-Adapter via DI in Tests
- Refresh-Script `npm run fixtures:refresh` für manuelles Update gegen echtes yt-dlp

### 10.5 E2E (Playwright, headless)

1. Add Playlist → Sync → Tracks erscheinen
2. Track abspielen → Player startet → Seek
3. Re-Sync → entfernte Videos als removed markiert
4. Settings persistieren + applied
5. yt-dlp missing → Banner

E2E gegen App + gemocktes yt-dlp (Test-Mode).

### 10.6 CI

- Pre-commit: lint + type-check (lefthook)
- CI: lint + type-check + test:unit + test:integration + test:e2e (headless)
- Keine Real-Network-Tests in CI
- Optional manueller „Smoke Test" Job (echtes yt-dlp gegen YT)

### 10.7 Coverage-Targets

- Service-Layer: 90%+
- Adapters: 80%+
- UI-Komponenten: keine Hard-Targets, nur Hooks
- Repo gesamt: ~70% Sanity-Check

### 10.8 Was NICHT

- Kein UI-Snapshot-Testing (Snapshot-Spam)
- Keine Performance-Tests in Phase 1
- Keine Cross-Browser-Tests (Chromium reicht)

---

## 11. Phasen / Out-of-Scope

### Phase 1 (initiale Implementation)

- YouTube-Provider
- Playlists + Standalone-Videos
- Audio + Video Download (yt-dlp)
- Sync (manuell + scheduled)
- Status-Tracking + Badges
- Player (Audio + Video, Queue, Fullscreen)
- Settings (alle Tabs)
- Error-Handling + Self-Check
- Lokales Deployment
- **Public GitHub Repo:** Englische README, LICENSE (MIT), Contributing-Guide, alle UI-Strings, Code-Comments, Commit-Messages auf Englisch

### Phase 2 (folgende Iterationen)

- SoundCloud-Provider
- Docker-Image für NAS-Deployment
- PWA / Installable
- Picture-in-Picture, Gapless, EQ, Lyrics
- Re-download Versions-History
- Advanced Search (Full-Text)

### Phase 3 (vielleicht nie)

- Tauri/Electron Native-Wrapper
- Multi-User Auth (für NAS-Deployment mit Familie)
- Cast / Sonos / Chromecast

### Bewusst NICHT geplant

- Keine Cloud-Synchronisation (privacy-by-design)
- Kein Content-Hosting / Sharing (rechtlich heikel, persönlicher Use)
- Keine YouTube Data API v3 (yt-dlp reicht)
- Keine Channel-Feed-Subscriptions (User will nur Playlists + Videos)

---

## 12. Offene Fragen / Risiken

### 12.1 Risiken

- **yt-dlp Breaking Changes:** YouTube ändert öfter ihre Endpoints, yt-dlp muss aktualisiert werden. **Mitigation:** Auto-Update-Hinweis in der UI wenn yt-dlp älter als 30 Tage; Settings-Toggle für Auto-Update via `pip install -U yt-dlp` (mit User-Consent).
- **Storage-Wachstum:** Audio bei 320kbps ~10 MB/Track, Video bei 1080p ~50–100 MB/Track. 1000 Tracks Audio = 10 GB, 1000 Videos = 50–100 GB. **Mitigation:** Disk-Usage-Anzeige in Settings, Storage-Quota-Warning, Pro-Playlist-Cleanup („nur die letzten X Tage behalten" — Phase 2).
- **YouTube Ratelimits:** Bei vielen parallelen Requests kann YT temporär blocken. **Mitigation:** Concurrency-Limit (default 3), exponential backoff.
- **Rechtlicher Status:** Privater Download für persönlichen Gebrauch ist in DE meistens unproblematisch (§53 UrhG für eigene Privatkopie); kommerzielle Nutzung oder Weitergabe ist es nicht. **Mitigation:** Disclaimer im README, keine Sharing-Features.

### 12.2 Offen für Implementation-Phase

- Concrete Color-Palette (im `taste`-Skill bei UI-Implementation finalisieren)
- Specifics des Naming-Patterns-Engine (Welche Variablen, Sanitization)
- Genaue Cron-UI in Settings (Free-Form vs. Wizard)

---

## 13. Glossar

| Begriff                 | Bedeutung                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| **Provider**            | Externe Quelle für Playlists/Videos (YouTube, SoundCloud, …)     |
| **External ID**         | Provider-spezifische ID (YT Video-ID, SC Track-ID)               |
| **Playlist Item**       | Zuordnung eines Videos zu einer Playlist (Join-Row)              |
| **Availability Status** | Status eines Videos beim Provider (available/private/removed/…)  |
| **In Playlist**         | Boolean: Ist Video aktuell noch in der Quell-Playlist?           |
| **Sync Run**            | Eine Ausführung des Sync-Vorgangs für eine Playlist              |
| **Job**                 | Persistente Task in der Background-Queue (sync, download, check) |
| **Self-Check**          | Boot-Time Health-Check (yt-dlp/ffmpeg/Storage/DB)                |

---

**Ende der Spec.**
