# Plan 2 — Provider-Layer + Sync-Engine + Downloads

**Datum:** 2026-04-26
**Status:** Draft (Brainstorming abgeschlossen, wartet auf User-Review)
**Autor:** Nils + Claude (via superpowers:brainstorming)
**Vorgänger:** [Plan 1 — Foundation + Data Layer](2026-04-26-plan-1-foundation.md) (gemerged)
**Hauptspec:** [TubeVault Design Spec](2026-04-26-tubevault-design.md)

---

## 1. Scope

Plan 2 baut den End-to-End-Backend-Flow von „URL einfügen" bis „Datei lokal sichtbar":
URL → Provider-Adapter → Sync (Diff) → Job-Queue → Download → `media_files`-Row → Disk.

### 1.1 IN

- `ProviderRegistry` + `MediaProviderAdapter`-Interface
- `YouTubeAdapter` (yt-dlp via `execFile`): `fetchPlaylist`, `fetchVideo`, `download`, `checkAvailability`
- `StatusMapper` (yt-dlp output → `AvailabilityStatus`-Enum, inkl. Inferenz aus flat-playlist-Placeholder-Titeln)
- `JobQueue` + `WorkerPool` (Hybrid: event-driven + 30s-Polling-Safety-Net, Crash-Recovery beim Boot, exponential backoff)
- Drei Job-Handler: `sync_playlist`, `download_video`, `check_availability`
- `SyncService` (Diff added/removed/unchanged, `sync_runs`-Logging, Per-Playlist-Lock)
- `DownloadService` (Pfad-Resolution aus Settings, Filename-Sanitization, Overwrite-Semantik für `media_files`)
- 6 neue Repositories (`PlaylistRepo`, `VideoRepo`, `PlaylistItemRepo`, `MediaFileRepo`, `SyncRunRepo`, `JobRepo`)
- API-Endpoints: `POST/GET /api/playlists`, `GET/DELETE /api/playlists/[id]`, `POST /api/playlists/[id]/sync`, `POST /api/videos`, `GET /api/videos/[id]`
- DI-Container in `lib/boot.ts` (`ensureBooted` liefert `BootContext` mit allen Service-Refs)
- yt-dlp-Fixtures + Mock-Adapter für deterministische Tests
- Auto-Download von ADDED-Videos im Sync (Kern-Vision: proaktive Sicherung)
- Schema-Migration `0001_*.sql`: `jobs.next_attempt_at TIMESTAMP NULL` für Backoff-Aware Claims

### 1.2 OUT (spätere Pläne)

- „Add without downloading"-Toggle → Plan 5
- Manueller Re-Download / Refresh-Status pro Video → Plan 4/5
- Naming-Pattern-Engine → Plan 2 nutzt hardcoded `{title}-{external_id}.{ext}` (sanitized), Pattern-Engine später
- Schedule-Cron (auto-Sync) → Plan 5/6 (Plan 2 hat nur manuelle Trigger via API; das `triggered_by='startup'`-Enum-Value wird vom Service akzeptiert, aber `doBoot()` enqueued in Plan 2 noch keine Startup-Syncs)
- UI-Komponenten (Playlist-Liste, Detail-Page, Activity-Page) → Plan 5/6 (Plan 2 ist API-only, testbar via curl)
- SSE für Live-Progress → Plan 2 nutzt simples Polling auf `GET /api/playlists/[id]`
- Loudness-Normalize, Thumbnail-Embed → Plan 3 oder Plan 5
- Codec-Preference (avc1/vp9/av1) und Bitrate-Override-pro-Track → späterer Plan; Plan 2 nutzt yt-dlp-Defaults für Codec
- Cleanup-Tooling für orphaned `videos`/`media_files` nach `DELETE /api/playlists/[id]` → späterer Plan
- Cookies-File-Support für age-restricted/auth-required Inhalte → späterer Plan

### 1.3 Bewusste Implikation

Plan 2 fertig = funktionsfähige App via API (curl), aber UI bleibt der Plan-1-Stand (Topbar + Settings + SelfCheckBanner). User-sichtbare Interaktion mit dem Backend kommt erst in Plan 5/6.

---

## 2. Modul-Layout

### 2.1 Neue Verzeichnisse + Files

```
lib/
  providers/
    types.ts                      # Adapter-Interface, Metadata-Typen, Errors
    registry.ts                   # ProviderRegistry
    youtube/
      adapter.ts                  # YouTubeAdapter (implements MediaProviderAdapter)
      yt-dlp.ts                   # execFile-Wrapper, JSON-Parsing, Timeouts
      status-mapper.ts            # yt-dlp output → AvailabilityStatus (pure)
      url-parser.ts               # YT-URLs erkennen, Playlist-/Video-ID extrahieren
  jobs/
    types.ts                      # JobType, JobPayload-Union, JobStatus, JobHandler
    queue.ts                      # JobQueue (enqueue, claim, complete, fail, resetStaleRunning)
    worker.ts                     # WorkerPool (event-driven + 30s polling, concurrency)
    handlers/
      sync-playlist.ts
      download-video.ts
      check-availability.ts
  services/
    sync-service.ts               # Diff, sync_runs, per-playlist lock
    download-service.ts           # Path-Resolution, sanitization, media_files overwrite
    playlist-service.ts           # createPlaylist, listPlaylists, getPlaylist, deletePlaylist
    video-service.ts              # addStandaloneVideo, getVideo
  api/
    schemas.ts                    # Zod-Schemas für Request-Bodies
    errors.ts                     # Domain-Error-Klassen + mapErrorToResponse
    helpers.ts                    # parseBody, withBoot, sendJson
  db/
    repositories/
      playlist-repo.ts
      video-repo.ts
      playlist-item-repo.ts
      media-file-repo.ts
      sync-run-repo.ts
      job-repo.ts
  utils/
    sanitize-filename.ts          # pure
    backoff.ts                    # pure: exponential delays
app/
  api/
    playlists/
      route.ts                    # GET (list), POST (create)
      [id]/
        route.ts                  # GET (detail), DELETE
        sync/
          route.ts                # POST (trigger)
    videos/
      route.ts                    # POST (standalone create)
      [id]/
        route.ts                  # GET (detail)
drizzle/
  migrations/
    0001_jobs_next_attempt_at.sql # ADD COLUMN next_attempt_at TIMESTAMP NULL
scripts/
  refresh-fixtures.ts             # manueller yt-dlp-Fixture-Refresh
tests/
  fixtures/
    yt-dlp/
      sources.json                # Definition welche URLs zu welchen Fixture-Files
      flat-playlist-music.json
      flat-playlist-with-deleted.json
      video-public.json
      video-private.json
      video-removed.json
      availability-public.txt
      availability-private.txt
```

### 2.2 Files-Modifizierung in Plan 1-Code

- `lib/boot.ts` — wird DI-Container (`ensureBooted` liefert `BootContext` statt `void`)
- `app/api/health/route.ts` — nutzt `ensureBooted` weiterhin, holt sich aber DB via Context
- `lib/db/schema.ts` — `jobs`-Table um `nextAttemptAt` erweitern (kommt zur Migration)

---

## 3. Provider-Layer

### 3.1 Adapter-Interface

```ts
// lib/providers/types.ts
export type ProviderId = "youtube"; // erweiterbar

export type AvailabilityStatus =
  | "available" | "private" | "removed" | "age_restricted"
  | "region_blocked" | "auth_required" | "unknown";

export interface VideoStub {
  externalId: string;
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  inferredStatus: AvailabilityStatus;  // aus flat-playlist-Titel inferiert
}

export interface PlaylistMetadata {
  externalId: string;
  title: string;
  channelTitle: string | null;
  url: string;
  items: VideoStub[];
}

export interface VideoMetadata extends VideoStub {
  channelId: string | null;
  description: string | null;
  uploadDate: string | null;     // YYYYMMDD
  availabilityReason: string | null;
}

export interface DownloadOpts {
  kind: "audio" | "video";
  audioFormat?: "mp3" | "m4a" | "opus" | "flac";
  audioBitrate?: number;          // kbps
  videoQuality?: "720p" | "1080p" | "1440p" | "2160p" | "best";
  videoContainer?: "mp4" | "webm" | "mkv";
  outputDir: string;              // absolut
  filenameStem: string;           // ohne Extension
}

export interface DownloadResult {
  filePath: string;               // absolut
  format: string;                 // tatsächlich (mp3, mp4, ...)
  quality: string;                // tatsächlich (192kbps, 1080p, ...)
  fileSizeBytes: number;
  durationSeconds: number;
}

export interface MediaProviderAdapter {
  readonly provider: ProviderId;
  matchesUrl(url: string): boolean;
  parseUrl(url: string): { kind: "playlist" | "video"; externalId: string } | null;
  fetchPlaylist(url: string): Promise<PlaylistMetadata>;
  fetchVideo(url: string): Promise<VideoMetadata>;
  download(externalId: string, opts: DownloadOpts): Promise<DownloadResult>;
  checkAvailability(externalId: string): Promise<{ status: AvailabilityStatus; reason: string | null }>;
}
```

### 3.2 ProviderRegistry

```ts
// lib/providers/registry.ts
export class ProviderRegistry {
  private adapters = new Map<ProviderId, MediaProviderAdapter>();
  register(a: MediaProviderAdapter): void;
  findByUrl(url: string): MediaProviderAdapter | null;   // iteriert, ruft matchesUrl
  findById(id: ProviderId): MediaProviderAdapter | null;
  list(): MediaProviderAdapter[];
}
```

### 3.3 YouTubeAdapter — yt-dlp-Strategie

| Operation | yt-dlp-Aufruf |
|---|---|
| `fetchPlaylist` | `yt-dlp --flat-playlist --dump-single-json --no-warnings <url>` |
| `fetchVideo` | `yt-dlp --dump-json --no-warnings --skip-download <url>` |
| `checkAvailability` | `yt-dlp --skip-download --no-warnings --print "%(availability)s\|%(title)s" <url>` |
| `download` (audio) | `yt-dlp -f bestaudio -x --audio-format <fmt> --audio-quality <kbps>K -o <stem>.%(ext)s <url>` |
| `download` (video) | `yt-dlp -f "bestvideo[height<=<h>]+bestaudio/best" --merge-output-format <container> -o <stem>.%(ext)s <url>` |

Alle Aufrufe via `execFile(ytdlpPath, args, { timeout })`. Niemals `exec` (Shell-Parsing-Risiko bei Pfaden mit Leerzeichen).

**Status-Inferenz aus flat-playlist:** Wenn ein Eintrag den Titel `"[Deleted video]"`, `"[Private video]"`, `"[Unavailable]"` hat, mappt der StatusMapper auf das richtige Enum *ohne* zusätzlichen `checkAvailability`-Call. Das spart pro Re-Sync potenziell hunderte yt-dlp-Aufrufe.

### 3.4 StatusMapper — pure function

```ts
export function mapYouTubeAvailability(
  raw: string | null,
  fallbackTitle?: string
): AvailabilityStatus {
  if (raw === "public" || raw === "unlisted") return "available";
  if (raw === "private") return "private";
  if (raw === "needs_auth") return "auth_required";
  if (raw === "subscriber_only") return "auth_required";
  if (raw === "premium_only") return "auth_required";
  if (fallbackTitle === "[Deleted video]") return "removed";
  if (fallbackTitle === "[Private video]") return "private";
  if (fallbackTitle === "[Unavailable]") return "unknown";
  // weitere Mappings basierend auf yt-dlp-Output-Beobachtungen aus Fixtures
  return "unknown";
}
```

Edge-Cases werden via Synthetic-Fixtures + Unit-Tests gegen die Funktion gefahren.

### 3.5 URL-Parser

`url-parser.ts` erkennt:
- Playlist: `youtube.com/playlist?list=PL...`, `youtube.com/watch?v=...&list=PL...` (extrahiert `list`-Param)
- Video: `youtube.com/watch?v=...`, `youtu.be/<id>`, `youtube.com/shorts/<id>`
- Mixed: bei `watch?v=...&list=...` → `kind: 'playlist'` priorisiert (User-Intent „in Playlist hinzufügen")

Zod-validiert URL-Struktur, danach manuelles Parsing für Robustheit.

---

## 4. Job-Queue + Worker

### 4.1 Schema-Migration

```sql
-- drizzle/migrations/0001_jobs_next_attempt_at.sql
ALTER TABLE jobs ADD COLUMN next_attempt_at TIMESTAMP NULL;
CREATE INDEX idx_jobs_claim ON jobs (status, priority DESC, created_at ASC, next_attempt_at);
```

Schema-TS in `lib/db/schema.ts` entsprechend erweitert; Drizzle-Kit generiert die SQL-File automatisch beim `npm run db:generate`.

### 4.2 JobQueue — Surface

```ts
// lib/jobs/queue.ts
export class JobQueue {
  enqueue(
    type: JobType,
    payload: JobPayload,
    opts?: { priority?: number; maxAttempts?: number }
  ): Promise<number>;                  // returns job id

  claim(): Promise<Job | null>;        // atomic, single SQL, null wenn nichts da

  complete(id: number): Promise<void>;
  fail(id: number, error: string, transient: boolean): Promise<void>;
  resetStaleRunning(): Promise<number>; // status='running' → 'queued' (boot)
  countByStatus(): Promise<Record<JobStatus, number>>;

  attachWorker(pool: { signal(): void }): void;  // sodass enqueue() → pool.signal()
}
```

### 4.3 Atomarer Claim (SQL)

```sql
UPDATE jobs
SET status = 'running',
    started_at = CURRENT_TIMESTAMP,
    attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'queued'
    AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
)
RETURNING *;
```

better-sqlite3 unterstützt `RETURNING` ab SQLite 3.35. Verfügbar in unserer Version.

### 4.4 Failure-Logik

```ts
async fail(id: number, error: string, transient: boolean): Promise<void> {
  const job = await this.byId(id);
  const reachedMax = job.attempts >= job.maxAttempts;
  if (!transient || reachedMax) {
    await db.update(jobs).set({
      status: 'failed',
      lastError: error,
      finishedAt: new Date(),
    }).where(eq(jobs.id, id));
  } else {
    const delayMs = backoff(job.attempts);  // [1000, 4000, 16000, 64000, ...]
    const nextAttemptAt = new Date(Date.now() + delayMs);
    await db.update(jobs).set({
      status: 'queued',
      lastError: error,
      nextAttemptAt,
      startedAt: null,                       // wird beim nächsten Claim neu gesetzt
    }).where(eq(jobs.id, id));
  }
}
```

`backoff(n) = 1000 * 4^n` mit Cap bei 1h.

### 4.5 WorkerPool — Lifecycle

```ts
// lib/jobs/worker.ts
export class WorkerPool {
  constructor(
    private queue: JobQueue,
    private handlers: Map<JobType, JobHandler>,
    private opts: { maxConcurrency: number; pollIntervalMs?: number; logger?: Logger }
  ) {}

  start(): void;            // initial drain + setInterval(pollIntervalMs ?? 30_000)
  signal(): void;           // event-driven: triggert sofortigen Claim-Versuch
  stop(): Promise<void>;    // graceful: stop accepting, await running
}
```

**Inner Loop:**
```
while (running.size < maxConcurrency && !stopped) {
  const job = await queue.claim();
  if (!job) break;
  const handler = handlers.get(job.type);
  if (!handler) {
    await queue.fail(job.id, `no handler for type ${job.type}`, false);
    continue;
  }
  const promise = handler.handle(job)
    .then(result => result.success
      ? queue.complete(job.id)
      : queue.fail(job.id, result.error, result.transient))
    .catch(err => queue.fail(job.id, err.message ?? String(err), true))
    .finally(() => { running.delete(promise); this.signal(); });
  running.add(promise);
}
```

`signal()` triggert einen neuen Claim-Versuch nach jedem Job-Ende. Das 30s-Polling ist nur Safety-Net (Hot-Reload-Recovery).

### 4.6 Job-Handler

```ts
export interface JobHandler<T = unknown> {
  handle(job: Job<T>): Promise<{ success: true } | { success: false; error: string; transient: boolean }>;
}
```

| Type | Payload | Handler-Aktion |
|---|---|---|
| `sync_playlist` | `{ playlistId: number }` | `await syncService.sync(playlistId, 'manual')` |
| `download_video` | `{ videoId: number; kind: 'audio'\|'video' }` | `await downloadService.download(videoId, kind)`. Bei Adapter-Error mit `availability=removed/private` → setze `videos.availability_status`, return non-transient failure |
| `check_availability` | `{ videoId: number }` | `await adapter.checkAvailability(...)`, update `videos`-Row |

---

## 5. SyncService

```ts
// lib/services/sync-service.ts
export class SyncService {
  async sync(playlistId: number, triggeredBy: 'manual' | 'startup' | 'schedule'): Promise<SyncRunResult> {
    // 1. Lock-Check
    const conflict = syncRunRepo.findRunning(playlistId);
    if (conflict) throw new PlaylistAlreadySyncingError(playlistId);

    // 2. Sync-Run anlegen
    const syncRunId = syncRunRepo.startRun({ playlistId, triggeredBy });

    let stats = { added: 0, removed: 0, unchanged: 0, unavailable: 0 };
    let runStatus: 'success' | 'partial' | 'failed' = 'success';
    const errors: SyncError[] = [];

    try {
      const playlist = playlistRepo.byId(playlistId);
      const adapter = registry.findById(playlist.provider);

      // 3. Adapter-Call AUSSERHALB der DB-Transaktion (langlaufend)
      const fetched = await adapter.fetchPlaylist(playlist.url);

      // 4. Diff + DB-Schreiben in Transaktion (schnell, atomar)
      const enqueueQueue: Array<{ videoId: number; kind: 'audio' | 'video' }> = [];
      db.transaction(() => {
        const known = new Set(playlistItemRepo.activeExternalIdsByPlaylist(playlistId));
        const current = new Set(fetched.items.map(i => i.externalId));
        const added = [...current].filter(x => !known.has(x));
        const removed = [...known].filter(x => !current.has(x));
        const unchanged = [...current].filter(x => known.has(x));

        for (const [pos, item] of fetched.items.entries()) {
          const videoId = videoRepo.upsert({
            provider: playlist.provider,
            externalId: item.externalId,
            title: item.title,
            channelTitle: item.channelTitle,
            durationSeconds: item.durationSeconds,
            thumbnailUrl: item.thumbnailUrl,
            availabilityStatus: item.inferredStatus,
            // updatedAt = now wenn etwas changed
          });
          playlistItemRepo.upsertActive(playlistId, videoId, pos);
          if (item.inferredStatus === 'available' && added.includes(item.externalId)) {
            enqueueQueue.push({ videoId, kind: playlist.defaultFormat });
          }
          if (item.inferredStatus !== 'available') stats.unavailable++;
        }
        for (const externalId of removed) {
          const videoId = videoRepo.idByProviderExternalId(playlist.provider, externalId);
          if (videoId) playlistItemRepo.markRemoved(playlistId, videoId);
        }
        playlistRepo.touchLastSyncedAt(playlistId);
        stats.added = added.length;
        stats.removed = removed.length;
        stats.unchanged = unchanged.length;
      });

      // 5. Downloads enqueuen (außerhalb Transaktion — JobQueue.enqueue ist eigene Transaktion)
      for (const item of enqueueQueue) {
        await queue.enqueue('download_video', item, { priority: 5 });
      }
    } catch (err) {
      runStatus = 'failed';
      errors.push({ code: errCode(err), message: errMsg(err), timestamp: new Date() });
    }

    // 6. Sync-Run finalisieren
    syncRunRepo.finishRun(syncRunId, { status: runStatus, stats, errorLog: errors });
    return { syncRunId, status: runStatus, stats };
  }
}
```

**Lock-Race-Akzeptanz:** Theoretisch kann zwischen `findRunning` und `startRun` ein zweiter Sync starten. Akzeptiert (single-worker, single-process; Folge-Plan kann partial UNIQUE-Index hinzufügen).

---

## 6. DownloadService

```ts
// lib/services/download-service.ts
export class DownloadService {
  async download(videoId: number, kind: 'audio' | 'video'): Promise<MediaFileRow> {
    const video = videoRepo.byId(videoId);
    const adapter = registry.findById(video.provider);
    const settings = settingsService.getAll();

    const base = this.resolveStorageBase(kind, settings);
    const filenameStem = sanitizeFilename(`${video.title}-${video.externalId}`);
    await fs.mkdir(base, { recursive: true });

    const result = await adapter.download(video.externalId, {
      kind,
      audioFormat: settings.defaultAudioFormat,
      audioBitrate: settings.defaultAudioBitrate,
      videoQuality: settings.defaultVideoQuality,
      videoContainer: 'mp4',
      outputDir: base,
      filenameStem,
    });

    const existing = mediaFileRepo.find(videoId, kind);
    if (existing) {
      await fs.unlink(existing.filePath).catch(() => { /* best effort */ });
      mediaFileRepo.delete(existing.id);
    }
    return mediaFileRepo.insert({
      videoId, kind,
      filePath: result.filePath,
      format: result.format,
      quality: result.quality,
      fileSizeBytes: result.fileSizeBytes,
      durationSeconds: result.durationSeconds,
      downloadedAt: new Date(),
    });
  }

  private resolveStorageBase(kind: 'audio' | 'video', s: AppSettings): string {
    if (s.useSingleStoragePath) return s.audioStoragePath;
    return kind === 'audio' ? s.audioStoragePath : s.videoStoragePath;
  }
}
```

### 6.1 Filename-Sanitization

```ts
// lib/utils/sanitize-filename.ts
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[/\\:<>|?*"]/g, '-')   // path-unsafe chars
    .replace(/\s+/g, ' ')             // collapse whitespace
    .replace(/^[\s.]+|[\s.]+$/g, '')  // strip leading/trailing dots+spaces (Windows-issue)
    .slice(0, 200);                   // cap length
}
```

### 6.2 Error-Behandlung

Wenn `adapter.download` mit „Video unavailable" failt: der `download_video`-Handler fängt das, setzt `videos.availability_status` entsprechend, returnt `{ success: false, transient: false }`. Kein leerer `media_files`-Eintrag, kein Retry.

Bei transienten Errors (Network-Timeout, HTTP 429 von YouTube): `{ success: false, transient: true }` → Queue scheduled Retry mit Backoff.

---

## 7. Boot + DI Container

```ts
// lib/boot.ts
interface BootContext {
  db: Database;
  registry: ProviderRegistry;
  queue: JobQueue;
  workerPool: WorkerPool;
  syncService: SyncService;
  downloadService: DownloadService;
  playlistService: PlaylistService;
  videoService: VideoService;
  settingsService: SettingsService;
  selfCheckService: SelfCheckService;
}

let bootPromise: Promise<BootContext> | null = null;

export function ensureBooted(): Promise<BootContext> {
  if (!bootPromise) bootPromise = doBoot();
  return bootPromise;
}

async function doBoot(): Promise<BootContext> {
  const dbPath = process.env.TUBEVAULT_DB_PATH ?? './data/tubevault.db';
  await runMigrations({ dbPath, migrationsFolder: './drizzle/migrations' });
  const db = getDb(dbPath);

  // Repositories
  const playlistRepo = new PlaylistRepo(db);
  const videoRepo = new VideoRepo(db);
  const playlistItemRepo = new PlaylistItemRepo(db);
  const mediaFileRepo = new MediaFileRepo(db);
  const syncRunRepo = new SyncRunRepo(db);
  const jobRepo = new JobRepo(db);
  const settingsRepo = new SettingsRepo(db);

  const settingsService = new SettingsService(settingsRepo);
  const selfCheckService = new SelfCheckService(settingsService);

  // Provider
  const registry = new ProviderRegistry();
  registry.register(new YouTubeAdapter({
    ytdlpPath: settingsService.getYtdlpPath() ?? 'yt-dlp',
  }));

  // Queue
  const queue = new JobQueue(jobRepo);
  await queue.resetStaleRunning();

  // Services
  const downloadService = new DownloadService(videoRepo, mediaFileRepo, registry, settingsService);
  const syncService = new SyncService(playlistRepo, videoRepo, playlistItemRepo, syncRunRepo, registry, queue);
  const playlistService = new PlaylistService(playlistRepo, queue, registry);
  const videoService = new VideoService(videoRepo, registry, queue);

  // Worker
  const handlers = new Map<JobType, JobHandler>([
    ['sync_playlist', new SyncPlaylistHandler(syncService)],
    ['download_video', new DownloadVideoHandler(downloadService, videoRepo)],
    ['check_availability', new CheckAvailabilityHandler(registry, videoRepo)],
  ]);
  const workerPool = new WorkerPool(queue, handlers, {
    maxConcurrency: settingsService.getConcurrency(),
  });
  queue.attachWorker(workerPool);
  workerPool.start();

  return {
    db, registry, queue, workerPool,
    syncService, downloadService, playlistService, videoService,
    settingsService, selfCheckService,
  };
}
```

API-Routen rufen `const ctx = await ensureBooted()` und arbeiten mit Services aus dem Context. Tests konstruieren ihre eigene minimale Variante mit `FakeAdapter` + `:memory:`-DB; sie nutzen NICHT `ensureBooted`.

---

## 8. API-Endpoints

Alle Routes via Next.js App-Router. Validation via Zod. Error-Format: `{ error: { code: string; message: string; details?: unknown } }`.

### 8.1 `POST /api/playlists`

**Request:**
```ts
{ url: string; defaultFormat?: 'audio' | 'video' }   // default: 'audio'
```
**Flow:**
1. Body validate (Zod)
2. `registry.findByUrl(url)` → adapter; sonst `400 PROVIDER_UNSUPPORTED`
3. `adapter.parseUrl(url)`; sonst `400 URL_NOT_PLAYLIST`
4. `playlistRepo.byProviderExternalId(...)` → wenn existiert: `409 PLAYLIST_ALREADY_TRACKED { playlistId }`
5. INSERT playlist (`title=null`, `channelTitle=null` bis erster Sync)
6. `queue.enqueue('sync_playlist', { playlistId }, { priority: 10 })`
7. `201 { playlist, syncJobId }`

### 8.2 `GET /api/playlists`

```ts
{
  playlists: Array<{
    id, provider, externalId, title, channelTitle, url, defaultFormat,
    syncEnabled, lastSyncedAt, createdAt,
    stats: { totalItems, availableItems, unavailableItems, downloadedItems },
    activeSyncRunId: number | null,
  }>
}
```

### 8.3 `GET /api/playlists/[id]`

Polling-Endpoint für UI:

```ts
{
  playlist: { ... },
  items: Array<{
    position, inPlaylist, addedAt, removedFromPlaylistAt,
    video: { id, externalId, title, channelTitle, durationSeconds, thumbnailUrl, availabilityStatus, availabilityReason },
    audioFile: { id, format, quality, fileSizeBytes, downloadedAt } | null,
    videoFile: { id, format, quality, fileSizeBytes, downloadedAt } | null,
    pendingJob: { type, status, attempts, lastError } | null,
  }>,
  recentSyncRuns: SyncRun[],   // letzte 10
}
```

### 8.4 `POST /api/playlists/[id]/sync`

1. `playlistRepo.byId(id)` → `404` wenn nicht
2. `syncRunRepo.findRunning(id)` → `409 SYNC_ALREADY_RUNNING`
3. `queue.enqueue('sync_playlist', { playlistId: id }, { priority: 20 })`
4. `202 { syncJobId }`

### 8.5 `DELETE /api/playlists/[id]`

Plan-2-Verhalten: löscht `playlists`-Row + `playlist_items`-Rows. **Nicht** gelöscht: `videos`, `media_files`, Files auf Disk. Antwort `204`. Cleanup orphaner `videos`/`media_files` ist ein späterer Plan.

### 8.6 `POST /api/videos` (standalone)

**Request:**
```ts
{ url: string; format?: 'audio' | 'video' }
```
**Flow:**
1. Body validate
2. `registry.findByUrl(url)` → adapter
3. `parseUrl` → erwarte `kind='video'`; sonst `400`
4. `videoRepo.byProviderExternalId(...)` → wenn existiert: `409 VIDEO_ALREADY_TRACKED`
5. **Synchron:** `adapter.fetchVideo(url)` (~1–2s, akzeptabel für Single-Video)
6. INSERT video
7. `queue.enqueue('download_video', { videoId, kind: format ?? 'audio' })`
8. `201 { video, downloadJobId }`

> **Asymmetrie zur Playlist-Route absichtlich:** Single-Video-Fetch ist billig genug für synchrones Feedback; Playlist-Fetch könnte Sekunden dauern und bleibt asynchron via Queue.

### 8.7 `GET /api/videos/[id]`

Detail mit assoziierten `media_files` + pending jobs.

### 8.8 Validation + Errors

```ts
// lib/api/errors.ts
export class PlaylistAlreadySyncingError extends Error { constructor(public playlistId: number) {...} }
export class ProviderNotFoundError extends Error { ... }
export class UrlNotMatchedError extends Error { ... }
// etc.

export function mapErrorToResponse(err: unknown): { status: number; body: ApiError } {
  if (err instanceof ZodError) return { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Invalid request body', details: err.flatten() } } };
  if (err instanceof PlaylistAlreadySyncingError) return { status: 409, body: { error: { code: 'SYNC_ALREADY_RUNNING', message: '...' } } };
  // ...
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Internal server error' } } };
}
```

---

## 9. Testing-Strategie

### 9.1 Test-Schichten

| Schicht | Tooling | Beispiele |
|---|---|---|
| Pure Unit | vitest | StatusMapper, URL-Parser, Filename-Sanitizer, Diff-Algorithm, Backoff-Calc |
| Repository | vitest + `:memory:` SQLite + drizzle migrations | Alle 6 neuen Repos: CRUD + edge cases |
| JobQueue | vitest + `:memory:` | enqueue/claim/complete/fail, atomarer Claim, Retry-Backoff, resetStaleRunning |
| WorkerPool | vitest + Fake-Handlers + Fake-Timers | Concurrency-Limit, signal-vs-poll, graceful stop, error → fail() |
| SyncService | vitest + `:memory:` + `FakeAdapter` | Initial sync, re-sync mit added/removed/unchanged, lock-conflict, transaction-rollback |
| DownloadService | vitest + `:memory:` + `FakeAdapter` + tmp-fs | Path-Resolution, sanitization, overwrite, useSingleStoragePath, errors |
| YouTubeAdapter | vitest + Fixture-Files + mocked execFile | yt-dlp-Output-Parsing, Status-Mapping, Error-Cases |
| API Routes | vitest + direct route-handler invocation | Happy paths + 4xx-Fälle pro Endpoint |
| End-to-End | vitest + tmpdir + `FakeAdapter` | „Add Playlist URL → Tracks in DB → media_files written → re-sync → removed marked" |

UI-Testing kommt erst in Plan 5/6.

### 9.2 yt-dlp-Fixtures

```
tests/fixtures/yt-dlp/sources.json       # { name, args, expectedOutputFile } pro Fixture
tests/fixtures/yt-dlp/<name>.json        # recorded output
scripts/refresh-fixtures.ts              # ruft echtes yt-dlp, schreibt outputs
```

`npm run fixtures:refresh` (manuell, nie in CI). Synthetic Fixtures (handgeschrieben) für Edge-Cases, die echte URLs nicht erzeugen können (alte yt-dlp-Outputs, region-blocked, age-restricted).

### 9.3 Coverage-Ziele

- StatusMapper, URL-Parser, Diff-Algorithm, Filename-Sanitizer, Backoff: **100 %**
- JobQueue, WorkerPool: **90 %+**
- SyncService, DownloadService: **85 %+**
- API Routes: ein Happy-Path und mind. 1 Error-Case pro Endpoint
- Repositories: **80 %+**
- YouTubeAdapter: **70 %+** (yt-dlp-Aufrufe sind dünne Wrapper, JSON-Parsing wird voll getestet)

---

## 10. End-State von Plan 2

Nach Plan 2 funktioniert die App via API end-to-end:

```bash
# Playlist hinzufügen
curl -X POST localhost:3000/api/playlists \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=...","defaultFormat":"audio"}'

# Status prüfen (Polling)
curl localhost:3000/api/playlists/1
# → enthält syncRun-Status, items mit pendingJob-Info, media_file-Info nach Download

# Manuelles Re-Sync
curl -X POST localhost:3000/api/playlists/1/sync

# Standalone Video
curl -X POST localhost:3000/api/videos \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/..."}'
```

Unter `~/Music/TubeVault/audio/` (oder dem in Settings konfigurierten Pfad) liegen MP3-Dateien. UI ist weiterhin der Plan-1-Stand.

---

## 11. Risiken + offene Fragen

### 11.1 Risiken

- **yt-dlp Breaking Changes:** YouTube ändert öfter Endpoints, yt-dlp-Output-Format kann sich ändern. **Mitigation:** Fixtures-Refresh-Script erlaubt schnellen Re-Test gegen echte yt-dlp-Outputs; Status-Mapping ist eine isolierte Funktion mit hoher Test-Coverage.
- **ffmpeg-Pfad-Probleme auf Windows:** yt-dlp ruft ffmpeg intern; wenn ffmpeg nicht im PATH ist, scheitert die Audio-Extraction. **Mitigation:** Self-Check (Plan 1) deckt das ab; `--ffmpeg-location` als CLI-Flag wird in einem späteren Plan unterstützt.
- **Große Playlists (500+ Items):** `fetchPlaylist` mit `--flat-playlist` ist auch dafür schnell, aber die DB-Transaktion mit 500 UPSERTs könnte spürbar werden. **Mitigation:** Drizzle-Batch-Mode + Index auf `(provider, external_id)`. Plan-2-Acceptance: 100-Track-Sync mit `FakeAdapter` in <2s (Standard-Test-Schwelle). 500+-Item-Performance ist Stretch-Goal, kein Hard-Gate.
- **Concurrency vs. SQLite Writes:** Mehrere parallele Downloads schreiben gleichzeitig `media_files`-Rows. SQLite WAL-Mode (in Plan 1 aktiviert) erlaubt parallele Reads + serialisierte Writes; das reicht. **Mitigation:** Keine zusätzlich nötig; Tests mit Concurrency-3 sind im Scope.
- **yt-dlp-Timeouts bei langsamen Verbindungen:** Default-Timeout im `execFile` auf 5 Min für Downloads, 30s für Metadaten. Konfigurierbar per Setting in späterem Plan.

### 11.2 Offene Fragen für Implementation-Phase

- Welche `priority`-Werte konkret? Vorschlag: manual sync = 20, manual download = 15, auto-sync = 10, auto-download = 5, check_availability = 1.
- Soll `DELETE /api/playlists/[id]` einen optionalen Query-Param `?cascade=true` haben, der auch orphane videos/media_files löscht? **Plan-2-Default: nein**, Cleanup ist eigene Operation in einem späteren Plan.
- API-Boundary-Naming: API-Requests verwenden `format`/`defaultFormat` als Feld-Namen, intern (Job-Payload, `media_files.kind`) heißt das Feld `kind`. Beide Werte sind `'audio' | 'video'`. Mapping passiert in der API-Route. Begründung: `defaultFormat` ist die Default-für-spätere-Downloads-Semantik bei Playlists, `kind` ist die Type-of-File-Semantik bei `media_files` — beide Begriffe stammen aus der Hauptspec/dem Schema und werden konsistent dort gehalten.

---

## 12. Glossar (Plan-2-spezifisch)

| Begriff | Bedeutung |
|---|---|
| **Adapter** | Provider-spezifische Implementation des `MediaProviderAdapter`-Interface |
| **Job-Handler** | Klasse die einen Job-Type entgegennimmt und ausführt (z.B. `DownloadVideoHandler`) |
| **BootContext** | Struct mit allen DI-konstruierten Service-Refs, geliefert von `ensureBooted()` |
| **Inferred Status** | Aus flat-playlist-Titel-Placeholder (`[Deleted video]` etc.) abgeleiteter Availability-Status |
| **Transient Error** | Error der wahrscheinlich beim Retry verschwindet (Network, 429); Gegenstück zu Permanent-Error |

---

**Ende der Plan-2-Spec.**
