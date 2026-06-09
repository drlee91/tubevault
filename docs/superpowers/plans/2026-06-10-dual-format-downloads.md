# Dual-Format Downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every video always gets both an MP3 and an MP4 download; `default_format` becomes a playback-only preference; download state is tracked per kind.

**Architecture:** Pure backend + service-layer change, shippable independently of the visual redesign. Sync, backfill (`downloadMissing`) and standalone-add enqueue one `download_video` job per kind. The playlist-detail repo query gains kind-aware pending-job slots so the UI (current and future) can render per-kind state. Playlist stats count an item as "downloaded" only when both files exist.

**Tech Stack:** Next.js 15 app, better-sqlite3 + drizzle (raw SQL for stats joins), vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-media-first-redesign-design.md` §1, §5 (counting), §7 (guardrails).

**Baseline:** main @ `2b80400`, 550 tests green. Run `npm test` before starting; abort if not green.

---

### Task 1: Kind-aware pending jobs in the playlist detail query

The current `listWithJoinsForDetail` joins ONE latest job per video (`j` join, kind-blind). The download duo and per-kind dedup need one pending-job slot per video×kind. Keep the existing `pendingJob` field untouched (UI still consumes it until the redesign plan replaces it).

**Files:**
- Modify: `lib/db/repositories/playlist-item-repo.ts` (interface ~line 6-25, SQL ~line 95-119, mapper ~line 121-169)
- Test: `lib/db/repositories/__tests__/playlist-item-repo.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the existing describe block in `playlist-item-repo.test.ts` (imports for `JobRepo`/`JobQueue` are needed: `import { JobRepo } from "../job-repo"; import { JobQueue } from "@/lib/jobs/queue";`):

```ts
  it("exposes per-kind pending download jobs", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const playlistRepo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const jobRepo = new JobRepo(db);
      const queue = new JobQueue(db, jobRepo);
      const pid = playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio", title: "p",
      });
      const vid = videoRepo.upsert({
        provider: "youtube", externalId: "v", title: "T", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(pid, vid, 0);
      await queue.enqueue("download_video", { videoId: vid, kind: "audio" }, { priority: 5 });
      // a kind-less job type must not leak into either slot
      await queue.enqueue("check_availability", { videoId: vid }, { priority: 10 });

      const item = itemRepo.listWithJoinsForDetail(pid)[0]!;
      expect(item.pendingJobs.audio?.status).toBe("queued");
      expect(item.pendingJobs.video).toBeNull();
    } finally {
      sqlite.close();
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/repositories/__tests__/playlist-item-repo.test.ts`
Expected: FAIL — `pendingJobs` is undefined (property does not exist).

- [ ] **Step 3: Extend the interface and query**

In `playlist-item-repo.ts`, add to `PlaylistDetailItem` (keep `pendingJob` as-is):

```ts
export interface PendingKindJob {
  id: number;
  status: string;
  attempts: number;
  lastError: string | null;
}

export interface PlaylistDetailItem {
  // ... existing fields unchanged ...
  pendingJob: { id: number; type: string; status: string; attempts: number; lastError: string | null } | null;
  /** Latest non-terminal download job per kind (queued/running/failed). */
  pendingJobs: { audio: PendingKindJob | null; video: PendingKindJob | null };
  availableKinds: Array<"audio" | "video">;
}
```

In the SQL, after the existing `LEFT JOIN jobs j ...` block, add two kind-scoped joins (same shape, filtered to `download_video` + kind):

```sql
      LEFT JOIN jobs ja ON ja.id = (
        SELECT j2.id FROM jobs j2
        WHERE j2.type = 'download_video'
          AND json_extract(j2.payload, '$.videoId') = v.id
          AND json_extract(j2.payload, '$.kind') = 'audio'
          AND j2.status IN ('queued', 'running', 'failed')
        ORDER BY j2.created_at DESC
        LIMIT 1
      )
      LEFT JOIN jobs jv ON jv.id = (
        SELECT j2.id FROM jobs j2
        WHERE j2.type = 'download_video'
          AND json_extract(j2.payload, '$.videoId') = v.id
          AND json_extract(j2.payload, '$.kind') = 'video'
          AND j2.status IN ('queued', 'running', 'failed')
        ORDER BY j2.created_at DESC
        LIMIT 1
      )
```

Add to the SELECT list:

```sql
        ja.id AS ja_id, ja.status AS ja_status, ja.attempts AS ja_attempts, ja.last_error AS ja_last_error,
        jv.id AS jv_id, jv.status AS jv_status, jv.attempts AS jv_attempts, jv.last_error AS jv_last_error
```

Add to the row mapper:

```ts
      pendingJobs: {
        audio: r["ja_id"] != null
          ? { id: Number(r["ja_id"]), status: r["ja_status"] as string, attempts: Number(r["ja_attempts"]), lastError: r["ja_last_error"] as string | null }
          : null,
        video: r["jv_id"] != null
          ? { id: Number(r["jv_id"]), status: r["jv_status"] as string, attempts: Number(r["jv_attempts"]), lastError: r["jv_last_error"] as string | null }
          : null,
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/repositories/__tests__/playlist-item-repo.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck` — expected clean (UI untouched; `pendingJob` still present).

```bash
git add lib/db/repositories/playlist-item-repo.ts lib/db/repositories/__tests__/playlist-item-repo.test.ts
git commit -m "feat(db): per-kind pending download jobs in playlist detail query"
```

---

### Task 2: Sync enqueues both kinds for new items

**Files:**
- Modify: `lib/services/sync-service.ts` (~line 54 `enqueueQueue` type, ~line 80-82 push, ~line 100-103 loop is unchanged)
- Test: `lib/services/sync-service.test.ts`

- [ ] **Step 1: Update the three existing sync tests to expect dual enqueue**

In `sync-service.test.ts`:
- `"initial sync inserts playlist items, enqueues downloads for available added"`: change `expect(ctx.jobRepo.countByStatus().queued).toBe(2);` → `toBe(4);`
- `"re-sync marks removed videos and does not enqueue downloads for them"`: both `toBe(2)` assertions → `toBe(4)`.
- `"does not enqueue downloads for items inferred as removed"`: `toBe(1)` → `toBe(2)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/services/sync-service.test.ts`
Expected: 3 failures (queued counts still single-format).

- [ ] **Step 3: Implement dual enqueue**

In `sync-service.ts`, replace the single push (currently `enqueueQueue.push({ videoId, kind: playlist.defaultFormat });`):

```ts
          if (added.includes(item.externalId) && item.inferredStatus === "available") {
            // Dual-format policy: every item gets both an audio and a video file.
            // playlist.defaultFormat is a playback preference only.
            enqueueQueue.push({ videoId, kind: "audio" });
            enqueueQueue.push({ videoId, kind: "video" });
          }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/services/sync-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/sync-service.ts lib/services/sync-service.test.ts
git commit -m "feat(sync): enqueue both audio and video downloads for new items"
```

---

### Task 3: downloadMissing goes per-kind

**Files:**
- Modify: `lib/services/sync-service.ts` (`downloadMissing`, ~line 117-145)
- Modify: `components/playlists/download-missing-button.tsx` (drop format from toast/tooltip)
- Modify: `components/playlists/playlist-detail-header.tsx` (drop `defaultFormat` prop pass)
- Test: `lib/services/sync-service.test.ts` (`describe("downloadMissing")`)

- [ ] **Step 1: Rewrite the downloadMissing test for per-kind semantics**

Replace the body of the existing `"queues default-format downloads only for items without a file, skipping undownloadable and already-queued"` test (rename it too):

```ts
  it("queues each missing kind per item, skipping undownloadable and already-pending kinds", async () => {
    const ctx = setup();
    try {
      const mediaRepo = new MediaFileRepo(ctx.db);
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio",
      });
      seedVideo(ctx, playlistId, "v-nothing", 0, "available");      // → audio + video
      seedVideo(ctx, playlistId, "v-unknown", 1, "unknown");        // → audio + video
      const withAudio = seedVideo(ctx, playlistId, "v-has-audio", 2, "available"); // → video only
      seedVideo(ctx, playlistId, "v-removed", 3, "removed");        // → nothing
      mediaRepo.insert({
        videoId: withAudio, kind: "audio", filePath: "/x/a.mp3",
        format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
      });

      const svc = new SyncService(ctx);
      const first = await svc.downloadMissing(playlistId);
      expect(first.queued).toBe(5); // 2 + 2 + 1
      expect(ctx.jobRepo.countByStatus().queued).toBe(5);

      // Re-invoking must not duplicate still-queued kinds.
      const second = await svc.downloadMissing(playlistId);
      expect(second.queued).toBe(0);
      expect(ctx.jobRepo.countByStatus().queued).toBe(5);
    } finally {
      ctx.sqlite.close();
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/sync-service.test.ts`
Expected: FAIL — `first.queued` is 3 (per-item default format), not 5.

- [ ] **Step 3: Implement per-kind logic**

Replace the loop body of `downloadMissing` in `sync-service.ts`:

```ts
  /**
   * Queue downloads for every missing kind of every playlist item (dual-format
   * policy: each item should have both an MP3 and an MP4). Sync only
   * auto-downloads items that are NEW since the previous run, so items whose
   * downloads failed (or never ran) would otherwise stay incomplete forever.
   */
  async downloadMissing(playlistId: number): Promise<{ queued: number }> {
    const playlist = this.d.playlistRepo.byId(playlistId);
    if (!playlist) throw new Error(`playlist ${playlistId} not found`);
    const items = this.d.itemRepo.listWithJoinsForDetail(playlistId);
    let queued = 0;
    for (const item of items) {
      if (!item.inPlaylist) continue;
      const status = item.video.availabilityStatus;
      if (status !== "available" && status !== "unknown") continue;
      for (const kind of ["audio", "video"] as const) {
        if (kind === "audio" ? item.audioFile : item.videoFile) continue;
        const job = item.pendingJobs[kind];
        if (job && (job.status === "queued" || job.status === "running")) continue;
        await this.d.queue.enqueue("download_video", { videoId: item.video.id, kind }, { priority: 5 });
        queued++;
      }
    }
    return { queued };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/services/sync-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Drop the format from the button UI**

`download-missing-button.tsx`: remove the `defaultFormat` prop entirely; toast success becomes `` `${r.data.queued} downloads queued` ``; button `title` becomes `"Queue audio + video downloads for every item with missing files"`.

`playlist-detail-header.tsx`: change `<DownloadMissingButton playlistId={playlist.id} defaultFormat={playlist.defaultFormat} />` → `<DownloadMissingButton playlistId={playlist.id} />`.

- [ ] **Step 6: Typecheck, full test run, commit**

Run: `npm run typecheck` then `npm test` — expected green.

```bash
git add lib/services/sync-service.ts lib/services/sync-service.test.ts components/playlists/download-missing-button.tsx components/playlists/playlist-detail-header.tsx
git commit -m "feat(sync): downloadMissing queues every missing kind per item"
```

---

### Task 4: addStandalone downloads both kinds, dialog loses the format picker

**Files:**
- Modify: `lib/services/video-service.ts` (`AddStandaloneInput` ~line 31, `addStandalone` ~line 45)
- Modify: `lib/actions/video-actions.ts` (`addVideoAction` schema + return, lines 14-27)
- Modify: `components/add/add-video-dialog.tsx` (remove format select; inspect file first — it currently submits `{ url, format }`)
- Check: `app/api/videos/route.ts` POST body schema (`lib/api/schemas.ts` `CreateVideoBody`) — make `format` optional/removed there too
- Test: `lib/services/video-service.test.ts`

- [ ] **Step 1: Update the addStandalone test**

In `video-service.test.ts`, test `"addStandalone synchronously fetches metadata, inserts, enqueues download"`: change the call and assertions to:

```ts
      const { video, downloadJobIds } = await svc.addStandalone({ url: "https://youtu.be/vid1" });
      expect(video.externalId).toBe("vid1");
      expect(downloadJobIds).toHaveLength(2);
      const kinds = downloadJobIds
        .map((id) => ctx.jobRepo.byId(id))
        .map((j) => (j!.payload as { kind: string }).kind)
        .sort();
      expect(kinds).toEqual(["audio", "video"]);
```

Also update the two other `addStandalone` calls in this file (`"rejects non-video URLs"`, `"rejects duplicates"`): drop the `format: "audio"` property from the input objects.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/video-service.test.ts`
Expected: FAIL — type error / `downloadJobIds` undefined.

- [ ] **Step 3: Implement**

`video-service.ts`:

```ts
export interface AddStandaloneInput {
  url: string;
}
```

In `addStandalone`, replace the single enqueue + return (the method currently enqueues one job with `input.format` and returns `{ video, downloadJobId }`):

```ts
    const downloadJobIds: number[] = [];
    for (const kind of ["audio", "video"] as const) {
      downloadJobIds.push(
        await this.d.queue.enqueue("download_video", { videoId: video.id, kind }, { priority: 15 }),
      );
    }
    return { video, downloadJobIds };
```

Adjust the method's return type to `Promise<{ video: VideoRow; downloadJobIds: number[] }>`.

`video-actions.ts`: schema drops `format`; return type/payload becomes `{ videoId: number; downloadJobIds: number[] }`.

`add-video-dialog.tsx`: remove the format select field and stop sending `format` (read the file; the dialog mirrors `add-playlist-dialog.tsx` structurally). Keep URL validation as-is.

`lib/api/schemas.ts` `CreateVideoBody` (used by `app/api/videos/route.ts` POST): remove the `format` field; the route handler passes only `{ url }`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run lib/services/video-service.test.ts` then `npm run typecheck`.
Expected: PASS / clean. Typecheck will surface every caller still passing `format` — fix each (they are exactly the files listed above plus any route test fixtures).

- [ ] **Step 5: Full test run and commit**

Run: `npm test` — expected green (update `app/api/videos/route.test.ts` fixtures if they post `format`).

```bash
git add lib/services/video-service.ts lib/services/video-service.test.ts lib/actions/video-actions.ts components/add/add-video-dialog.tsx lib/api/schemas.ts app/api/videos/route.test.ts
git commit -m "feat(videos): standalone add always downloads audio and video"
```

---

### Task 5: downloadedItems counts only complete (both-kind) items

**Files:**
- Modify: `lib/db/repositories/playlist-repo.ts` (`listWithStats` ~line 126-128, `byIdWithStats` ~line 147-149 — the `downloaded_items` subselect appears twice)
- Test: `lib/db/repositories/__tests__/playlist-repo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it("downloadedItems counts only items with BOTH audio and video files", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      const complete = videoRepo.upsert({
        provider: "youtube", externalId: "v-complete", title: "c", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      const half = videoRepo.upsert({
        provider: "youtube", externalId: "v-half", title: "h", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(id, complete, 0);
      itemRepo.upsertActive(id, half, 1);
      for (const kind of ["audio", "video"] as const) {
        mediaRepo.insert({ videoId: complete, kind, filePath: `/x/c.${kind}`, format: kind === "audio" ? "mp3" : "mp4", quality: "q", fileSizeBytes: 1, durationSeconds: 1 });
      }
      mediaRepo.insert({ videoId: half, kind: "audio", filePath: "/x/h.mp3", format: "mp3", quality: "q", fileSizeBytes: 1, durationSeconds: 1 });

      expect(repo.byIdWithStats(id)!.stats.downloadedItems).toBe(1);
      expect(repo.listWithStats()[0]!.stats.downloadedItems).toBe(1);
    } finally {
      sqlite.close();
    }
  });
```

Add imports at the top of the test file: `VideoRepo`, `PlaylistItemRepo`, `MediaFileRepo` from their repo modules.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/repositories/__tests__/playlist-repo.test.ts`
Expected: FAIL — `downloadedItems` is 2 (any-kind counting).

- [ ] **Step 3: Replace the subselect (both occurrences)**

```sql
        (SELECT COUNT(*) FROM playlist_items pi
           WHERE pi.playlist_id = p.id AND pi.in_playlist = 1
             AND EXISTS (SELECT 1 FROM media_files ma WHERE ma.video_id = pi.video_id AND ma.kind = 'audio')
             AND EXISTS (SELECT 1 FROM media_files mv WHERE mv.video_id = pi.video_id AND mv.kind = 'video')) AS downloaded_items,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/db/repositories/__tests__/playlist-repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Full run, browser sanity, commit**

Run: `npm test` — green. Then `npm run build`, start via preview (`tubevault-prod`), open `/playlists/1` with browser-use and confirm the header now reads a lower "downloaded" count (only fully-complete items) — expected with current data: `1 downloaded` (only Lustlord has audio; only complete items count… verify the real number matches `SELECT` by hand if unsure).

```bash
git add lib/db/repositories/playlist-repo.ts lib/db/repositories/__tests__/playlist-repo.test.ts
git commit -m "feat(stats): downloadedItems requires both audio and video files"
```

---

### Task 6: End-to-end verification of the dual-format flow

No new code — runtime verification per the verify discipline (build, run, observe).

- [ ] **Step 1: Build + start**

`npm run build`, then preview-start `tubevault-prod` (port 3000).

- [ ] **Step 2: Drive downloadMissing**

`Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/playlists/1" ...` is NOT the route — use the UI button ("Download missing" on `/playlists/1`) via browser-use, or `downloadMissingAction` path. Confirm the toast reports a plausible count (≈ 2× missing items minus existing kinds) and `/api/jobs/summary` shows the queue draining.

- [ ] **Step 3: Confirm per-kind results**

After a few jobs complete: `node -e` query against `media_files` shows new rows with BOTH kinds for at least one previously-empty video; files exist under `Audios/TubeVault` and `Videos/TubeVault`.

- [ ] **Step 4: Commit nothing; record observations**

If any job class fails systematically (e.g. yt-dlp format errors on audio), stop and fix before the UI plan builds on this.
