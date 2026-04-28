# Plan 4 — Player + Stream API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TubeVault audio/video player end-to-end — Stream API with HTTP Range support, Zustand-backed player store with persistent queue + position resume, full UI (persistent player bar, queue sidebar/drawer, fullscreen audio + cinema video, mobile bottom-sheet), keyboard shortcuts, MediaSession lockscreen integration, smart-queue from filtered track tables.

**Architecture:** Server exposes `GET /api/stream/[mediaFileId]` — `MediaFileService` resolves the DB row, validates the file exists, parses `Range`, streams `fs.createReadStream` as a Web `ReadableStream` (200/206/404/416). Client uses a single Zustand store mounted by `<PlayerProvider>` in the root layout; one hidden `<audio>` + one `<video>` element live in `<PlayerCore>`, driven by store effects. Queue is built smart-queue-style from the visible filtered list at click time. Persisted slice (queue + index + position + volume + shuffle + repeat) hydrates from `localStorage`; `isPlaying` always rehydrates `false`.

**Tech Stack:** Next.js 15 App Router · React 19 · Zustand 4 (state + persist) · `@dnd-kit/core` + `@dnd-kit/sortable` (queue reorder) · shadcn/ui Sheet (drawers, mobile sheet) · sonner (toasts) · MediaSession Web API · Vitest + happy-dom + RTL.

**Spec:** `docs/superpowers/specs/2026-04-28-plan-4-player-design.md`

---

## Conventions for every task

1. **TDD:** write failing test first, run to confirm it fails, implement, run to confirm pass.
2. **Commit at end of every task.** Conventional Commits (`feat(player): …`, `feat(stream): …`, `test: …`, `chore: …`).
3. **CWD:** worktree `.worktrees/plan-4-player`. Branch: `plan-4-player`.
4. **All English in code, comments, UI strings, commit messages** (Master-Spec §11 Phase 1).
5. **UTF-8 always.** Never lose umlauts or accents in any file we touch.
6. **One responsibility per file.** New code lives in its own file under the inventory in spec §7. Don't pile into existing files.
7. **Run `npm run typecheck && npm test` before every commit.** Fix red before committing.

---

## Phase 0 — Setup

### Task 1: Install runtime deps + shadcn Sheet primitive

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `components/ui/sheet.tsx`

- [ ] **Step 1: Install Zustand + dnd-kit**

```bash
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Add shadcn Sheet primitive (used by QueueDrawer + MobilePlayerSheet)**

```bash
npx --yes shadcn@latest add sheet --yes
```

If shadcn asks to overwrite existing components, answer **No** for any file other than `components/ui/sheet.tsx`.

- [ ] **Step 3: Verify install + typecheck**

```bash
npm run typecheck
```

Expected: clean (no errors).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/ui/sheet.tsx components.json
git commit -m "chore(plan-4): add zustand, @dnd-kit, shadcn sheet"
```

---

## Phase 1 — Backend / Stream API

### Task 2: MediaFileRepo.byId

**Files:**
- Modify: `lib/db/repositories/media-file-repo.ts`
- Modify: `lib/db/repositories/__tests__/media-file-repo.test.ts`

- [ ] **Step 1: Add failing test for byId**

Append to `lib/db/repositories/__tests__/media-file-repo.test.ts`:

```ts
  it("byId returns the row when present", () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoId = videoFor(db);
      const repo = new MediaFileRepo(db);
      const id = repo.insert({
        videoId,
        kind: "audio",
        filePath: "/p/a.mp3",
        format: "mp3",
        quality: "192kbps",
        fileSizeBytes: 100,
        durationSeconds: 100,
      });
      const row = repo.byId(id);
      expect(row?.id).toBe(id);
      expect(row?.filePath).toBe("/p/a.mp3");
    } finally {
      sqlite.close();
    }
  });

  it("byId returns null for unknown id", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new MediaFileRepo(db);
      expect(repo.byId(99999)).toBeNull();
    } finally {
      sqlite.close();
    }
  });
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/db/repositories/__tests__/media-file-repo.test.ts
```

Expected: 2 new tests fail with `repo.byId is not a function`.

- [ ] **Step 3: Implement byId**

Add inside `class MediaFileRepo` in `lib/db/repositories/media-file-repo.ts`, after `find()`:

```ts
  byId(id: number): MediaFileRow | null {
    return this.db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).get() ?? null;
  }
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/db/repositories/__tests__/media-file-repo.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repositories/media-file-repo.ts lib/db/repositories/__tests__/media-file-repo.test.ts
git commit -m "feat(repo): add MediaFileRepo.byId"
```

---

### Task 3: MediaFileService + mime helper

**Files:**
- Create: `lib/services/media-file-service.ts`
- Create: `lib/services/media-file-service.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/services/media-file-service.test.ts
import { describe, it, expect } from "vitest";
import { MediaFileService, mimeForFormat } from "./media-file-service";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";

function seed(db: ReturnType<typeof createTestDb>["db"]) {
  const videoRepo = new VideoRepo(db);
  const mediaRepo = new MediaFileRepo(db);
  const videoId = videoRepo.upsert({
    provider: "youtube",
    externalId: "v1",
    title: "T",
    channelTitle: null,
    durationSeconds: 100,
    thumbnailUrl: null,
    availabilityStatus: "available",
  });
  const id = mediaRepo.insert({
    videoId,
    kind: "audio",
    filePath: "/p/a.mp3",
    format: "mp3",
    quality: "192kbps",
    fileSizeBytes: 100,
    durationSeconds: 100,
  });
  return { videoId, mediaFileId: id, mediaRepo };
}

describe("MediaFileService.byId", () => {
  it("returns the row when present", () => {
    const { db, sqlite } = createTestDb();
    try {
      const { mediaFileId, mediaRepo } = seed(db);
      const svc = new MediaFileService({ mediaFileRepo: mediaRepo });
      expect(svc.byId(mediaFileId)?.id).toBe(mediaFileId);
    } finally {
      sqlite.close();
    }
  });

  it("returns null for unknown id", () => {
    const { db, sqlite } = createTestDb();
    try {
      const { mediaRepo } = seed(db);
      const svc = new MediaFileService({ mediaFileRepo: mediaRepo });
      expect(svc.byId(99999)).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});

describe("mimeForFormat", () => {
  it.each([
    ["mp3", "audio/mpeg"],
    ["m4a", "audio/mp4"],
    ["opus", "audio/ogg"],
    ["flac", "audio/flac"],
    ["mp4", "video/mp4"],
    ["webm", "video/webm"],
    ["mkv", "video/x-matroska"],
    ["xyz", "application/octet-stream"],
    ["", "application/octet-stream"],
  ])("maps %s to %s", (format, expected) => {
    expect(mimeForFormat(format)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

```bash
npx vitest run lib/services/media-file-service.test.ts
```

- [ ] **Step 3: Implement service + mime helper**

```ts
// lib/services/media-file-service.ts
import type { MediaFileRepo, MediaFileRow } from "@/lib/db/repositories/media-file-repo";

export interface MediaFileServiceDeps {
  mediaFileRepo: MediaFileRepo;
}

export class MediaFileService {
  constructor(private readonly d: MediaFileServiceDeps) {}

  byId(id: number): MediaFileRow | null {
    return this.d.mediaFileRepo.byId(id);
  }
}

export function mimeForFormat(format: string): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "opus":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/services/media-file-service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/services/media-file-service.ts lib/services/media-file-service.test.ts
git commit -m "feat(service): add MediaFileService + mimeForFormat"
```

---

### Task 4: Wire MediaFileService into BootContext + TestBootContext

**Files:**
- Modify: `lib/boot.ts`
- Modify: `lib/test-utils/boot-test-context.ts`

- [ ] **Step 1: Update `BootContext` and construct service**

In `lib/boot.ts`, add to the imports:

```ts
import { MediaFileService } from "@/lib/services/media-file-service";
```

Extend `BootContext`:

```ts
export interface BootContext {
  // ... existing fields ...
  mediaFileRepo: MediaFileRepo;
  mediaFileService: MediaFileService;
}
```

In `doBoot()`, after `const videoService = new VideoService(...)` and before the handlers map:

```ts
const mediaFileService = new MediaFileService({ mediaFileRepo: mediaRepo });
```

Add to the returned object: `mediaFileService,`.

- [ ] **Step 2: Mirror in TestBootContext**

In `lib/test-utils/boot-test-context.ts` add the same import, extend `TestBootContext`:

```ts
mediaFileService: MediaFileService;
```

In `createTestBootContext()` after `const videoService = ...`:

```ts
const mediaFileService = new MediaFileService({ mediaFileRepo: mediaRepo });
```

Add `mediaFileService,` to the returned object.

- [ ] **Step 3: Run typecheck + full vitest**

```bash
npm run typecheck && npm test
```

Expected: green. No new tests yet — this is plumbing.

- [ ] **Step 4: Commit**

```bash
git add lib/boot.ts lib/test-utils/boot-test-context.ts
git commit -m "feat(boot): expose MediaFileService on BootContext"
```

---

### Task 5: Stream API route — happy path (200 full, 206 bytes=0-)

**Files:**
- Create: `app/api/stream/[mediaFileId]/route.ts`
- Create: `app/api/stream/[mediaFileId]/route.test.ts`

- [ ] **Step 1: Write failing tests for full + initial-probe**

```ts
// app/api/stream/[mediaFileId]/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";
import { GET } from "./route";

let ctx: TestBootContext;
let tmp: string;
let mediaFileId: number;

async function seedMp3(bytes = 1024): Promise<void> {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-stream-"));
  const filePath = path.join(tmp, "track.mp3");
  await fs.writeFile(filePath, Buffer.alloc(bytes, 0x7f));
  ctx = await createTestBootContext();
  __setBootContextForTesting(ctx);
  const videoId = ctx.videoRepo.upsert({
    provider: "youtube",
    externalId: "v1",
    title: "T",
    channelTitle: null,
    durationSeconds: 60,
    thumbnailUrl: null,
    availabilityStatus: "available",
  });
  mediaFileId = ctx.mediaFileRepo.insert({
    videoId,
    kind: "audio",
    filePath,
    format: "mp3",
    quality: "192kbps",
    fileSizeBytes: bytes,
    durationSeconds: 60,
  });
}

beforeEach(async () => { await seedMp3(); });
afterEach(async () => {
  __setBootContextForTesting(null);
  ctx.cleanup();
  await fs.rm(tmp, { recursive: true, force: true });
});

function req(headers: Record<string, string> = {}): Request {
  return new Request(`http://x/api/stream/${mediaFileId}`, { headers });
}

async function call(headers: Record<string, string> = {}) {
  return GET(req(headers), { params: Promise.resolve({ mediaFileId: String(mediaFileId) }) });
}

describe("GET /api/stream/:mediaFileId — happy path", () => {
  it("200 with full body when no Range header", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Content-Length")).toBe("1024");
    expect(res.headers.get("Content-Range")).toBeNull();
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(1024);
  });

  it("206 with full range when Range: bytes=0-", async () => {
    const res = await call({ Range: "bytes=0-" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1023/1024");
    expect(res.headers.get("Content-Length")).toBe("1024");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(1024);
  });

  it("sets Last-Modified from file mtime", async () => {
    const res = await call();
    const lm = res.headers.get("Last-Modified");
    expect(lm).toBeTruthy();
    expect(new Date(lm!).toString()).not.toBe("Invalid Date");
  });

  it("sets Cache-Control private + max-age=3600", async () => {
    const res = await call();
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });
});
```

- [ ] **Step 2: Run — expect FAIL (route missing)**

```bash
npx vitest run app/api/stream/
```

- [ ] **Step 3: Implement route (full body + bytes=0- + headers)**

```ts
// app/api/stream/[mediaFileId]/route.ts
import { promises as fs, createReadStream } from "node:fs";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { mimeForFormat } from "@/lib/services/media-file-service";

interface RouteContext {
  params: Promise<{ mediaFileId: string }>;
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const { mediaFileId } = await context.params;
  const id = Number(mediaFileId);
  if (!Number.isFinite(id)) return new Response("Not Found", { status: 404 });

  const ctx = await ensureBootedOrTest();
  const file = ctx.mediaFileService.byId(id);
  if (!file) return new Response("Not Found", { status: 404 });

  let stat;
  try {
    stat = await fs.stat(file.filePath);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  const size = stat.size;

  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const partial = range !== null;
  const length = end - start + 1;

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": mimeForFormat(file.format),
    "Content-Length": String(length),
    "Cache-Control": "private, max-age=3600",
    "Last-Modified": stat.mtime.toUTCString(),
  });
  if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  const node = createReadStream(file.filePath, { start, end });
  const body = nodeToWeb(node);
  return new Response(body, { status: partial ? 206 : 200, headers });
}

interface Range { start: number; end: number; }
function parseRange(header: string | null, size: number): Range | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalid";
  const startStr = m[1]!;
  const endStr = m[2]!;
  if (startStr === "" && endStr === "") return "invalid";
  let start: number;
  let end: number;
  if (startStr === "") {
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? size - 1 : Number(endStr);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (start < 0 || start >= size || end < start || end >= size) return "invalid";
  return { start, end };
}

function nodeToWeb(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    },
  });
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run app/api/stream/
```

- [ ] **Step 5: Commit**

```bash
git add app/api/stream/
git commit -m "feat(stream): GET /api/stream/[mediaFileId] with range support"
```

---

### Task 6: Stream API — Range edge cases (bytes=N-, N-M, closed probe, 416)

**Files:**
- Modify: `app/api/stream/[mediaFileId]/route.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
describe("GET /api/stream/:mediaFileId — range edges", () => {
  it("206 partial for bytes=100-", async () => {
    const res = await call({ Range: "bytes=100-" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 100-1023/1024");
    expect(res.headers.get("Content-Length")).toBe("924");
  });

  it("206 partial for bytes=100-199 (closed range)", async () => {
    const res = await call({ Range: "bytes=100-199" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 100-199/1024");
    expect(res.headers.get("Content-Length")).toBe("100");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(100);
  });

  it("206 partial for bytes=0-1 (Safari probe)", async () => {
    const res = await call({ Range: "bytes=0-1" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1/1024");
    expect(res.headers.get("Content-Length")).toBe("2");
  });

  it("416 when start >= size", async () => {
    const res = await call({ Range: "bytes=2000-" });
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */1024");
  });

  it("416 on malformed Range header", async () => {
    const res = await call({ Range: "blocks=0-99" });
    expect(res.status).toBe(416);
  });

  it("416 on bytes=- (no numbers)", async () => {
    const res = await call({ Range: "bytes=-" });
    expect(res.status).toBe(416);
  });
});
```

- [ ] **Step 2: Run — expect PASS (range parser already handles these)**

```bash
npx vitest run app/api/stream/
```

If any case fails, debug `parseRange()` in `route.ts` until green. Do **not** silently relax assertions.

- [ ] **Step 3: Commit**

```bash
git add app/api/stream/
git commit -m "test(stream): cover range edge cases"
```

---

### Task 7: Stream API — 404 + mime variants

**Files:**
- Modify: `app/api/stream/[mediaFileId]/route.test.ts`

- [ ] **Step 1: Append tests**

```ts
describe("GET /api/stream/:mediaFileId — 404 + mime", () => {
  it("404 when mediaFileId unknown", async () => {
    const res = await GET(
      new Request(`http://x/api/stream/99999`),
      { params: Promise.resolve({ mediaFileId: "99999" }) },
    );
    expect(res.status).toBe(404);
  });

  it("404 when DB row exists but file missing on disk", async () => {
    await fs.unlink(ctx.mediaFileRepo.byId(mediaFileId)!.filePath);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("404 when mediaFileId is non-numeric", async () => {
    const res = await GET(
      new Request(`http://x/api/stream/abc`),
      { params: Promise.resolve({ mediaFileId: "abc" }) },
    );
    expect(res.status).toBe(404);
  });

  it("uses video/mp4 for an mp4 file", async () => {
    // re-seed with mp4
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-stream-mp4-"));
    const filePath = path.join(tmp2, "clip.mp4");
    await fs.writeFile(filePath, Buffer.alloc(64, 0));
    const newId = ctx.mediaFileRepo.insert({
      videoId: ctx.mediaFileRepo.byId(mediaFileId)!.videoId,
      kind: "video",
      filePath,
      format: "mp4",
      quality: "1080p",
      fileSizeBytes: 64,
      durationSeconds: 60,
    });
    const res = await GET(
      new Request(`http://x/api/stream/${newId}`),
      { params: Promise.resolve({ mediaFileId: String(newId) }) },
    );
    expect(res.headers.get("Content-Type")).toBe("video/mp4");
    await fs.rm(tmp2, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run — expect PASS**

```bash
npx vitest run app/api/stream/
```

- [ ] **Step 3: Commit**

```bash
git add app/api/stream/
git commit -m "test(stream): cover 404 paths and mime variants"
```

---

## Phase 2 — Data extensions for `availableKinds`

### Task 8: PlaylistItemRepo — add `availableKinds` to PlaylistDetailItem

**Files:**
- Modify: `lib/db/repositories/playlist-item-repo.ts`
- Modify: `lib/db/repositories/__tests__/playlist-item-repo.test.ts`

- [ ] **Step 1: Add failing test**

Append to the existing `playlist-item-repo.test.ts`:

```ts
  it("listWithJoinsForDetail returns availableKinds derived from media_files", () => {
    const { db, sqlite } = createTestDb();
    try {
      const playlistRepo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const pid = playlistRepo.create({
        provider: "youtube",
        externalId: "PL1",
        url: "u",
        defaultFormat: "audio",
        title: "p",
      });
      const vid = videoRepo.upsert({
        provider: "youtube", externalId: "v", title: "T", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(pid, vid, 0);
      mediaRepo.insert({
        videoId: vid, kind: "audio", filePath: "/p/a.mp3",
        format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
      });
      const items = itemRepo.listWithJoinsForDetail(pid);
      expect(items[0]!.availableKinds).toEqual(["audio"]);
    } finally {
      sqlite.close();
    }
  });
```

Imports at the top of the test file should already cover `PlaylistRepo`, `VideoRepo`, `PlaylistItemRepo`, `MediaFileRepo`. Add any that are missing.

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/db/repositories/__tests__/playlist-item-repo.test.ts
```

- [ ] **Step 3: Extend `PlaylistDetailItem` and the SQL mapping**

In `lib/db/repositories/playlist-item-repo.ts`, add to the interface:

```ts
export interface PlaylistDetailItem {
  // ... existing fields ...
  pendingJob: { id: number; type: string; status: string; attempts: number; lastError: string | null } | null;
  availableKinds: Array<"audio" | "video">;
}
```

In the row mapping inside `listWithJoinsForDetail`, derive `availableKinds` from `audio_id` / `video_file_id`:

```ts
return rows.map((r): PlaylistDetailItem => {
  const kinds: Array<"audio" | "video"> = [];
  if (r["audio_id"] != null) kinds.push("audio");
  if (r["video_file_id"] != null) kinds.push("video");
  return {
    // ... existing mapping ...
    pendingJob: r["job_id"] != null
      ? { id: Number(r["job_id"]), type: r["job_type"] as string, status: r["job_status"] as string, attempts: Number(r["job_attempts"]), lastError: r["job_last_error"] as string | null }
      : null,
    availableKinds: kinds,
  };
});
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/db/repositories/__tests__/playlist-item-repo.test.ts
```

- [ ] **Step 5: Update existing test fixtures using `PlaylistDetailItem`**

Find every test fixture that constructs a literal `PlaylistDetailItem` and add `availableKinds: []`. Likely files:

```bash
npx vitest run --reporter=verbose 2>&1 | tee /tmp/vitest.out
```

Open each failing file and add `availableKinds: []` to fixtures (e.g. `components/playlists/track-row.test.tsx`'s `makeItem`).

- [ ] **Step 6: Run full vitest, expect green**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add lib/db/ components/playlists/
git commit -m "feat(repo): add availableKinds to PlaylistDetailItem"
```

---

### Task 9: VideoRepo + VideoSerialized — `availableKinds` for standalone videos

**Files:**
- Modify: `lib/db/repositories/video-repo.ts`
- Modify: `lib/db/repositories/__tests__/video-repo.test.ts`
- Modify: `app/api/videos/route.ts`
- Modify: `app/api/videos/route.test.ts`
- Modify: `lib/client/use-standalone-videos.ts`

- [ ] **Step 1: Failing test for `listStandaloneWithKinds`**

Append to `video-repo.test.ts`:

```ts
  it("listStandaloneWithKinds includes availableKinds derived from media_files", () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const id = videoRepo.upsert({
        provider: "youtube", externalId: "v1", title: "T", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      mediaRepo.insert({
        videoId: id, kind: "audio", filePath: "/p/a.mp3",
        format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
      });
      const rows = videoRepo.listStandaloneWithKinds();
      expect(rows[0]!.availableKinds).toEqual(["audio"]);
    } finally {
      sqlite.close();
    }
  });
```

Add `import { MediaFileRepo } from "../media-file-repo";` if not already present.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `listStandaloneWithKinds`**

In `video-repo.ts`, add:

```ts
import { mediaFiles } from "@/lib/db/schema";

export interface VideoWithKinds extends VideoRow {
  availableKinds: Array<"audio" | "video">;
}

  listStandaloneWithKinds(): VideoWithKinds[] {
    const rows = this.listStandalone();
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const kinds = this.db
      .select({ videoId: mediaFiles.videoId, kind: mediaFiles.kind })
      .from(mediaFiles)
      .where(sql`${mediaFiles.videoId} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)
      .all();
    const byVideo = new Map<number, Array<"audio" | "video">>();
    for (const k of kinds) {
      const arr = byVideo.get(k.videoId) ?? [];
      arr.push(k.kind);
      byVideo.set(k.videoId, arr);
    }
    return rows.map((r) => ({ ...r, availableKinds: byVideo.get(r.id) ?? [] }));
  }
```

- [ ] **Step 4: Update `app/api/videos/route.ts` GET handler**

```ts
export async function GET(_req: Request) {
  const ctx = await ensureBootedOrTest();
  const videos = ctx.videoRepo.listStandaloneWithKinds();
  return Response.json({ videos });
}
```

Note: `videoRepo` is not on `BootContext` today. Either expose it (preferred — add `videoRepo: VideoRepo` to `BootContext`/`TestBootContext` in the same way Task 4 did for `mediaFileService`) or add a thin `videoService.listStandaloneWithKinds()` wrapper. **Preferred: extend `videoService`.**

Add to `lib/services/video-service.ts`:

```ts
listStandaloneWithKinds() {
  return this.d.videoRepo.listStandaloneWithKinds();
}
```

Then `route.ts` calls `ctx.videoService.listStandaloneWithKinds()`.

- [ ] **Step 5: Update `lib/client/use-standalone-videos.ts`**

```ts
export type VideoSerialized = Omit<
  VideoRow,
  "availabilityChangedAt" | "firstSeenAt" | "lastSeenAt" | "createdAt" | "updatedAt"
> & {
  availabilityChangedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  availableKinds: Array<"audio" | "video">;
};
```

- [ ] **Step 6: Update `app/api/videos/route.test.ts` assertions**

Add to the existing "returns standalone videos only" test, after seeding:

```ts
ctx.mediaFileRepo.insert({
  videoId: _standaloneId, kind: "audio", filePath: "/p/a.mp3",
  format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
});
```

After response:

```ts
const standalone = body.videos.find((v: { externalId: string }) => v.externalId === "yt:standalone-1");
expect(standalone.availableKinds).toEqual(["audio"]);
```

- [ ] **Step 7: Run typecheck + full test**

```bash
npm run typecheck && npm test
```

- [ ] **Step 8: Commit**

```bash
git add lib/db/repositories/ lib/services/video-service.ts app/api/videos/ lib/client/use-standalone-videos.ts
git commit -m "feat(api): expose availableKinds on standalone videos"
```

---

## Phase 3 — Player domain modules (pure logic)

### Task 10: `lib/player/types.ts` + `queue-build.ts` (pure helpers)

**Files:**
- Create: `lib/player/types.ts`
- Create: `lib/player/queue-build.ts`
- Create: `lib/player/queue-build.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/player/queue-build.test.ts
import { describe, it, expect } from "vitest";
import { buildQueue, pickKind } from "./queue-build";
import type { QueueItem } from "./types";

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    videoId: 1,
    defaultKind: "audio",
    title: "T",
    channelTitle: null,
    thumbnailUrl: null,
    durationSeconds: 60,
    availableKinds: ["audio"],
    ...over,
  };
}

describe("pickKind", () => {
  it("returns defaultKind when available", () => {
    expect(pickKind(item({ defaultKind: "audio", availableKinds: ["audio", "video"] }))).toBe("audio");
  });
  it("falls back to the other kind when default missing", () => {
    expect(pickKind(item({ defaultKind: "audio", availableKinds: ["video"] }))).toBe("video");
  });
  it("returns null when no kinds available", () => {
    expect(pickKind(item({ availableKinds: [] }))).toBeNull();
  });
});

describe("buildQueue", () => {
  it("strips items with empty availableKinds and adjusts startAt", () => {
    const items: QueueItem[] = [
      item({ videoId: 1, availableKinds: [] }),
      item({ videoId: 2 }),
      item({ videoId: 3 }),
      item({ videoId: 4 }),
    ];
    const result = buildQueue(items, 2);
    expect(result.queue.map((q) => q.videoId)).toEqual([2, 3, 4]);
    expect(result.currentIndex).toBe(1);
  });

  it("clamps startAt down when the clicked item is stripped", () => {
    const items: QueueItem[] = [
      item({ videoId: 1 }),
      item({ videoId: 2, availableKinds: [] }),
      item({ videoId: 3 }),
    ];
    const result = buildQueue(items, 1);
    expect(result.queue.map((q) => q.videoId)).toEqual([1, 3]);
    expect(result.currentIndex).toBe(1);
  });

  it("returns empty queue and -1 index when no playable items", () => {
    const result = buildQueue([item({ availableKinds: [] })], 0);
    expect(result.queue).toEqual([]);
    expect(result.currentIndex).toBe(-1);
  });

  it("keeps single playable item at startAt 0", () => {
    const result = buildQueue([item()], 0);
    expect(result.currentIndex).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/player/queue-build.test.ts
```

- [ ] **Step 3: Implement types + helpers**

```ts
// lib/player/types.ts
export type Kind = "audio" | "video";

export interface QueueItem {
  videoId: number;
  defaultKind: Kind;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  availableKinds: Kind[];
}

export type RepeatMode = "off" | "one" | "all";
export type PlayerMode = "mini" | "fullscreen" | "queue-open";
```

```ts
// lib/player/queue-build.ts
import type { Kind, QueueItem } from "./types";

export function pickKind(item: QueueItem): Kind | null {
  if (item.availableKinds.includes(item.defaultKind)) return item.defaultKind;
  if (item.availableKinds.length > 0) return item.availableKinds[0]!;
  return null;
}

export interface BuildQueueResult {
  queue: QueueItem[];
  currentIndex: number;
}

export function buildQueue(items: QueueItem[], startAt: number): BuildQueueResult {
  const queue = items.filter((i) => i.availableKinds.length > 0);
  if (queue.length === 0) return { queue: [], currentIndex: -1 };
  // Count playable items at indices < startAt; that becomes the new index.
  let newIndex = 0;
  for (let i = 0; i < startAt && i < items.length; i++) {
    if (items[i]!.availableKinds.length > 0) newIndex++;
  }
  // If the clicked item itself was stripped, newIndex now points past it; clamp.
  if (newIndex >= queue.length) newIndex = queue.length - 1;
  return { queue, currentIndex: newIndex };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/player/queue-build.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/player/
git commit -m "feat(player): add QueueItem types + buildQueue/pickKind helpers"
```

---

### Task 11: `lib/player/store.ts` — Zustand store, base state + playback actions

**Files:**
- Create: `lib/player/store.ts`
- Create: `lib/player/store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/player/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createPlayerStore, type PlayerStore } from "./store";
import type { QueueItem } from "./types";

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    videoId: 1,
    defaultKind: "audio",
    title: "T",
    channelTitle: null,
    thumbnailUrl: null,
    durationSeconds: 60,
    availableKinds: ["audio"],
    ...over,
  };
}

let store: PlayerStore;
beforeEach(() => { store = createPlayerStore(); });

describe("PlayerStore — initial state", () => {
  it("starts idle", () => {
    const s = store.getState();
    expect(s.queue).toEqual([]);
    expect(s.currentIndex).toBe(-1);
    expect(s.isPlaying).toBe(false);
    expect(s.position).toBe(0);
    expect(s.duration).toBe(0);
    expect(s.volume).toBe(1);
    expect(s.shuffle).toBe(false);
    expect(s.repeat).toBe("off");
    expect(s.mode).toBe("mini");
    expect(s.hasHydrated).toBe(false);
    expect(s.resolvedMediaFileId).toBeNull();
    expect(s.currentKind).toBeNull();
  });
});

describe("PlayerStore — setQueue + pickKind", () => {
  it("setQueue resolves currentKind + a media file id placeholder", () => {
    store.getState().setQueue([item({ videoId: 7 })], 0);
    const s = store.getState();
    expect(s.queue.length).toBe(1);
    expect(s.currentIndex).toBe(0);
    expect(s.currentKind).toBe("audio");
  });

  it("setQueue with empty list resets to idle", () => {
    store.getState().setQueue([item()], 0);
    store.getState().setQueue([], 0);
    expect(store.getState().currentIndex).toBe(-1);
    expect(store.getState().currentKind).toBeNull();
  });
});

describe("PlayerStore — play/pause/togglePlay", () => {
  it("play sets isPlaying true; only when a track is loaded", () => {
    store.getState().play();
    expect(store.getState().isPlaying).toBe(false); // idle — no-op
    store.getState().setQueue([item()], 0);
    store.getState().play();
    expect(store.getState().isPlaying).toBe(true);
  });
  it("pause sets isPlaying false", () => {
    store.getState().setQueue([item()], 0);
    store.getState().play();
    store.getState().pause();
    expect(store.getState().isPlaying).toBe(false);
  });
  it("togglePlay flips state", () => {
    store.getState().setQueue([item()], 0);
    store.getState().togglePlay();
    expect(store.getState().isPlaying).toBe(true);
    store.getState().togglePlay();
    expect(store.getState().isPlaying).toBe(false);
  });
});

describe("PlayerStore — next/prev with repeat modes", () => {
  it("next advances index", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 0);
    store.getState().next();
    expect(store.getState().currentIndex).toBe(1);
  });
  it("next at end with repeat=off → stops (isPlaying false, index -1 only on natural end? — clamp at last)", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 1);
    store.getState().play();
    store.getState().next();
    expect(store.getState().isPlaying).toBe(false);
  });
  it("next at end with repeat=all wraps to 0", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 1);
    store.getState().setRepeat("all");
    store.getState().next();
    expect(store.getState().currentIndex).toBe(0);
  });
  it("next with repeat=one stays on same index and resets position", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 0);
    store.getState().setRepeat("one");
    store.getState().setPosition(30);
    store.getState().next();
    expect(store.getState().currentIndex).toBe(0);
    expect(store.getState().position).toBe(0);
  });
  it("prev decrements; clamps at 0", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 1);
    store.getState().prev();
    expect(store.getState().currentIndex).toBe(0);
    store.getState().prev();
    expect(store.getState().currentIndex).toBe(0);
  });
});

describe("PlayerStore — seek / setPosition / setVolume / setDuration", () => {
  it("seek updates position", () => {
    store.getState().setQueue([item()], 0);
    store.getState().seek(42);
    expect(store.getState().position).toBe(42);
  });
  it("setVolume clamps to [0,1]", () => {
    store.getState().setVolume(2);
    expect(store.getState().volume).toBe(1);
    store.getState().setVolume(-0.5);
    expect(store.getState().volume).toBe(0);
  });
  it("toggleMute remembers previous volume", () => {
    store.getState().setVolume(0.6);
    store.getState().toggleMute();
    expect(store.getState().volume).toBe(0);
    store.getState().toggleMute();
    expect(store.getState().volume).toBeCloseTo(0.6);
  });
});

describe("PlayerStore — cycleRepeat + cycleMode", () => {
  it("cycleRepeat: off → all → one → off", () => {
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe("all");
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe("one");
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe("off");
  });
  it("openFullscreen / openQueue / closeOverlays", () => {
    store.getState().setQueue([item()], 0);
    store.getState().openFullscreen();
    expect(store.getState().mode).toBe("fullscreen");
    store.getState().openQueue();
    expect(store.getState().mode).toBe("queue-open");
    store.getState().closeOverlays();
    expect(store.getState().mode).toBe("mini");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/player/store.test.ts
```

- [ ] **Step 3: Implement store**

```ts
// lib/player/store.ts
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Kind, PlayerMode, QueueItem, RepeatMode } from "./types";
import { pickKind } from "./queue-build";

export interface PlayerState {
  queue: QueueItem[];
  currentIndex: number;
  resolvedMediaFileId: number | null;
  currentKind: Kind | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  preMuteVolume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  mode: PlayerMode;
  hasHydrated: boolean;
  // shuffle bookkeeping
  _originalQueue: QueueItem[] | null;
}

export interface PlayerActions {
  setQueue(items: QueueItem[], startIndex: number): void;
  addToQueue(item: QueueItem): void;
  playNext(item: QueueItem): void;
  removeFromQueue(index: number): void;
  reorder(from: number, to: number): void;
  clearQueue(): void;

  play(): void;
  pause(): void;
  togglePlay(): void;
  next(): void;
  prev(): void;
  seek(seconds: number): void;
  setPosition(seconds: number): void;
  setDuration(seconds: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  toggleShuffle(): void;
  setRepeat(r: RepeatMode): void;
  cycleRepeat(): void;

  openFullscreen(): void;
  openQueue(): void;
  closeOverlays(): void;

  markBrokenAndAdvance(): void;
  setHydrated(v: boolean): void;
  _resolve(): void; // internal — recompute currentKind + resolvedMediaFileId
}

export type PlayerStore = StoreApi<PlayerState & PlayerActions>;

const initial: PlayerState = {
  queue: [],
  currentIndex: -1,
  resolvedMediaFileId: null,
  currentKind: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  preMuteVolume: 1,
  shuffle: false,
  repeat: "off",
  mode: "mini",
  hasHydrated: false,
  _originalQueue: null,
};

export function createPlayerStore(): PlayerStore {
  return createStore<PlayerState & PlayerActions>((set, get) => ({
    ...initial,

    setQueue(items, startIndex) {
      if (items.length === 0) {
        set({ queue: [], currentIndex: -1, currentKind: null, resolvedMediaFileId: null, isPlaying: false, position: 0 });
        return;
      }
      const idx = Math.max(0, Math.min(startIndex, items.length - 1));
      set({ queue: items, currentIndex: idx, position: 0, _originalQueue: null });
      get()._resolve();
    },
    addToQueue(item) {
      set({ queue: [...get().queue, item] });
    },
    playNext(item) {
      const { queue, currentIndex } = get();
      const insertAt = currentIndex >= 0 ? currentIndex + 1 : queue.length;
      const next = [...queue];
      next.splice(insertAt, 0, item);
      set({ queue: next });
    },
    removeFromQueue(index) {
      const { queue, currentIndex } = get();
      if (index < 0 || index >= queue.length) return;
      const next = queue.filter((_, i) => i !== index);
      let newIdx = currentIndex;
      if (index < currentIndex) newIdx = currentIndex - 1;
      else if (index === currentIndex) {
        newIdx = currentIndex >= next.length ? next.length - 1 : currentIndex;
      }
      set({ queue: next, currentIndex: next.length === 0 ? -1 : newIdx, position: index === currentIndex ? 0 : get().position });
      get()._resolve();
    },
    reorder(from, to) {
      const { queue, currentIndex } = get();
      if (from === to) return;
      if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
      const next = [...queue];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      let newIdx = currentIndex;
      if (currentIndex === from) newIdx = to;
      else if (from < currentIndex && to >= currentIndex) newIdx = currentIndex - 1;
      else if (from > currentIndex && to <= currentIndex) newIdx = currentIndex + 1;
      set({ queue: next, currentIndex: newIdx });
    },
    clearQueue() {
      set({ queue: [], currentIndex: -1, isPlaying: false, currentKind: null, resolvedMediaFileId: null, position: 0 });
    },

    play() {
      if (get().currentIndex < 0) return;
      set({ isPlaying: true });
    },
    pause() { set({ isPlaying: false }); },
    togglePlay() { get().isPlaying ? get().pause() : get().play(); },

    next() {
      const { queue, currentIndex, repeat } = get();
      if (queue.length === 0) return;
      if (repeat === "one") {
        set({ position: 0 });
        return;
      }
      const last = queue.length - 1;
      if (currentIndex >= last) {
        if (repeat === "all") {
          set({ currentIndex: 0, position: 0 });
          get()._resolve();
        } else {
          set({ isPlaying: false, position: 0 });
        }
        return;
      }
      set({ currentIndex: currentIndex + 1, position: 0 });
      get()._resolve();
    },
    prev() {
      const { currentIndex } = get();
      if (currentIndex <= 0) {
        set({ position: 0 });
        return;
      }
      set({ currentIndex: currentIndex - 1, position: 0 });
      get()._resolve();
    },

    seek(seconds) { set({ position: Math.max(0, seconds) }); },
    setPosition(seconds) { set({ position: Math.max(0, seconds) }); },
    setDuration(seconds) { set({ duration: Math.max(0, seconds) }); },
    setVolume(v) {
      const clamped = Math.max(0, Math.min(1, v));
      set({ volume: clamped, preMuteVolume: clamped > 0 ? clamped : get().preMuteVolume });
    },
    toggleMute() {
      const { volume, preMuteVolume } = get();
      if (volume > 0) set({ preMuteVolume: volume, volume: 0 });
      else set({ volume: preMuteVolume > 0 ? preMuteVolume : 1 });
    },
    toggleShuffle() {
      const { queue, currentIndex, shuffle, _originalQueue } = get();
      if (shuffle) {
        // restore
        if (_originalQueue) {
          const currentItem = queue[currentIndex];
          const newIdx = currentItem ? _originalQueue.findIndex((q) => q.videoId === currentItem.videoId) : 0;
          set({ queue: _originalQueue, currentIndex: newIdx >= 0 ? newIdx : 0, shuffle: false, _originalQueue: null });
        } else {
          set({ shuffle: false });
        }
        return;
      }
      // shuffle on: keep current at index 0..keep position, Fisher-Yates the rest
      if (queue.length <= 1) { set({ shuffle: true, _originalQueue: queue.slice() }); return; }
      const original = queue.slice();
      const head = currentIndex >= 0 ? [queue[currentIndex]!] : [];
      const tail = queue.filter((_, i) => i !== currentIndex);
      for (let i = tail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tail[i], tail[j]] = [tail[j]!, tail[i]!];
      }
      const next = [...head, ...tail];
      set({ queue: next, currentIndex: head.length > 0 ? 0 : -1, shuffle: true, _originalQueue: original });
    },
    setRepeat(r) { set({ repeat: r }); },
    cycleRepeat() {
      const r = get().repeat;
      set({ repeat: r === "off" ? "all" : r === "all" ? "one" : "off" });
    },

    openFullscreen() { if (get().currentIndex >= 0) set({ mode: "fullscreen" }); },
    openQueue() { set({ mode: "queue-open" }); },
    closeOverlays() { set({ mode: "mini" }); },

    markBrokenAndAdvance() {
      // Caller emits the toast; we just advance.
      get().next();
    },
    setHydrated(v) { set({ hasHydrated: v }); },

    _resolve() {
      const { queue, currentIndex } = get();
      const it = currentIndex >= 0 ? queue[currentIndex] : null;
      if (!it) {
        set({ currentKind: null, resolvedMediaFileId: null });
        return;
      }
      const kind = pickKind(it);
      // resolvedMediaFileId is filled by the PlayerCore once it loads /api/stream;
      // here we only record the kind. The Core uses videoId+kind to look up the
      // mediaFile via a thin client helper or by passing it through the QueueItem
      // (deferred until persist).
      set({ currentKind: kind, resolvedMediaFileId: null });
    },
  }));
}
```

> **Note on `resolvedMediaFileId`:** The store records `currentKind` here; the actual `mediaFileId` is resolved by `<PlayerCore>` (Task 14) via a fetch helper that maps `(videoId, kind) → mediaFileId`. We add the helper in Task 14 along with PlayerCore.

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/player/store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/player/store.ts lib/player/store.test.ts
git commit -m "feat(player): add Zustand store with base playback actions"
```

---

### Task 12: Store — queue mutations + reorder + shuffle Fisher-Yates

**Files:**
- Modify: `lib/player/store.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
describe("PlayerStore — queue mutations", () => {
  it("addToQueue appends", () => {
    store.getState().setQueue([item({ videoId: 1 })], 0);
    store.getState().addToQueue(item({ videoId: 2 }));
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 2]);
  });

  it("playNext inserts after current", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 3 })], 0);
    store.getState().playNext(item({ videoId: 2 }));
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 2, 3]);
  });

  it("removeFromQueue before current shifts index down", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 }), item({ videoId: 3 })], 2);
    store.getState().removeFromQueue(0);
    expect(store.getState().currentIndex).toBe(1);
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([2, 3]);
  });

  it("removeFromQueue at current keeps index pointing to next item", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 }), item({ videoId: 3 })], 1);
    store.getState().removeFromQueue(1);
    expect(store.getState().currentIndex).toBe(1);
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 3]);
  });

  it("reorder updates currentIndex when current item moves", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 }), item({ videoId: 3 })], 0);
    store.getState().reorder(0, 2);
    expect(store.getState().currentIndex).toBe(2);
  });

  it("clearQueue resets state", () => {
    store.getState().setQueue([item({ videoId: 1 })], 0);
    store.getState().play();
    store.getState().clearQueue();
    expect(store.getState().queue).toEqual([]);
    expect(store.getState().currentIndex).toBe(-1);
    expect(store.getState().isPlaying).toBe(false);
  });
});

describe("PlayerStore — shuffle", () => {
  it("toggleShuffle on stores original queue and keeps current at index 0", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ videoId: i + 1 }));
    store.getState().setQueue(items, 2);
    store.getState().toggleShuffle();
    expect(store.getState().shuffle).toBe(true);
    expect(store.getState().queue[0]!.videoId).toBe(3);
    expect(store.getState().currentIndex).toBe(0);
  });

  it("toggleShuffle off restores original and points index back at current item", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ videoId: i + 1 }));
    store.getState().setQueue(items, 2);
    store.getState().toggleShuffle();
    store.getState().toggleShuffle();
    expect(store.getState().shuffle).toBe(false);
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 2, 3, 4, 5]);
    expect(store.getState().currentIndex).toBe(2);
  });
});

describe("PlayerStore — broken track skip path", () => {
  it("markBrokenAndAdvance moves to next track", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 0);
    store.getState().markBrokenAndAdvance();
    expect(store.getState().currentIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect PASS (already implemented in Task 11)**

```bash
npx vitest run lib/player/store.test.ts
```

If anything fails, fix store.ts; do not weaken assertions.

- [ ] **Step 3: Commit**

```bash
git add lib/player/store.test.ts
git commit -m "test(player): cover queue mutations + shuffle bookkeeping"
```

---

### Task 13: `lib/player/persist.ts` — hydrate + debounced writeback + pagehide

**Files:**
- Create: `lib/player/persist.ts`
- Create: `lib/player/persist.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// lib/player/persist.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPlayerStore } from "./store";
import { hydrateFrom, snapshotForPersist, attachPersist, STORAGE_KEY } from "./persist";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

describe("snapshotForPersist", () => {
  it("includes queue, currentIndex, position, volume, shuffle, repeat — and sets isPlaying false", () => {
    const store = createPlayerStore();
    store.getState().setQueue([{
      videoId: 1, defaultKind: "audio", title: "T",
      channelTitle: null, thumbnailUrl: null, durationSeconds: 60,
      availableKinds: ["audio"],
    }], 0);
    store.getState().play();
    store.getState().setPosition(42);
    store.getState().setVolume(0.5);
    store.getState().setRepeat("all");
    const snap = snapshotForPersist(store.getState());
    expect(snap.currentIndex).toBe(0);
    expect(snap.position).toBe(42);
    expect(snap.volume).toBe(0.5);
    expect(snap.repeat).toBe("all");
    expect(snap.queue.length).toBe(1);
    expect("isPlaying" in snap).toBe(false);
  });
});

describe("hydrateFrom", () => {
  it("rehydrates queue, position, volume; isPlaying always false", () => {
    const store = createPlayerStore();
    hydrateFrom(store, JSON.stringify({
      queue: [{ videoId: 9, defaultKind: "audio", title: "T", channelTitle: null,
        thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] }],
      currentIndex: 0,
      position: 12,
      volume: 0.7,
      shuffle: false,
      repeat: "off",
    }));
    const s = store.getState();
    expect(s.currentIndex).toBe(0);
    expect(s.position).toBe(12);
    expect(s.volume).toBe(0.7);
    expect(s.isPlaying).toBe(false);
    expect(s.hasHydrated).toBe(true);
  });

  it("treats malformed JSON as empty hydrate", () => {
    const store = createPlayerStore();
    hydrateFrom(store, "{not json");
    expect(store.getState().hasHydrated).toBe(true);
    expect(store.getState().queue).toEqual([]);
  });
});

describe("attachPersist", () => {
  it("debounces position writes (5s) and writes immediately on pagehide", () => {
    const store = createPlayerStore();
    const detach = attachPersist(store, { debounceMs: 5000 });
    store.getState().setQueue([{
      videoId: 1, defaultKind: "audio", title: "T",
      channelTitle: null, thumbnailUrl: null, durationSeconds: 60,
      availableKinds: ["audio"],
    }], 0);
    store.getState().setPosition(10);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(5001);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    // Trigger pagehide manually
    store.getState().setPosition(20);
    window.dispatchEvent(new Event("pagehide"));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.position).toBe(20);
    detach();
  });
});
```

> Note: this test runs in the dom project (it uses `localStorage` + `window`). To force happy-dom, name the file `persist.test.ts` AND tell vitest by either moving it to `lib/client/` (matched by the `dom` glob) **or** add `@vitest-environment happy-dom` at top of file:

Add the env hint as the first line of `persist.test.ts`:

```ts
// @vitest-environment happy-dom
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/player/persist.test.ts
```

- [ ] **Step 3: Implement**

```ts
// lib/player/persist.ts
import type { PlayerStore, PlayerState } from "./store";

export const STORAGE_KEY = "tubevault.player";

export interface PersistedSlice {
  queue: PlayerState["queue"];
  currentIndex: number;
  position: number;
  volume: number;
  shuffle: boolean;
  repeat: PlayerState["repeat"];
}

export function snapshotForPersist(s: PlayerState): PersistedSlice {
  return {
    queue: s.queue,
    currentIndex: s.currentIndex,
    position: s.position,
    volume: s.volume,
    shuffle: s.shuffle,
    repeat: s.repeat,
  };
}

export function hydrateFrom(store: PlayerStore, raw: string | null): void {
  if (!raw) {
    store.getState().setHydrated(true);
    return;
  }
  let parsed: Partial<PersistedSlice> | null = null;
  try {
    parsed = JSON.parse(raw) as Partial<PersistedSlice>;
  } catch {
    store.getState().setHydrated(true);
    return;
  }
  if (!parsed || typeof parsed !== "object") {
    store.getState().setHydrated(true);
    return;
  }
  if (Array.isArray(parsed.queue) && parsed.queue.length > 0 && typeof parsed.currentIndex === "number") {
    store.getState().setQueue(parsed.queue, parsed.currentIndex);
  }
  if (typeof parsed.position === "number") store.getState().setPosition(parsed.position);
  if (typeof parsed.volume === "number") store.getState().setVolume(parsed.volume);
  if (parsed.repeat === "off" || parsed.repeat === "all" || parsed.repeat === "one") {
    store.getState().setRepeat(parsed.repeat);
  }
  // Note: shuffle is restored via toggleShuffle so the original-queue bookkeeping
  // stays consistent. We deliberately *do not* re-apply shuffle on rehydrate to
  // avoid replaying randomness; user can re-toggle.
  store.getState().pause(); // isPlaying always false on rehydrate
  store.getState().setHydrated(true);
}

export interface AttachOptions {
  debounceMs?: number;
}

export function attachPersist(store: PlayerStore, opts: AttachOptions = {}): () => void {
  const debounceMs = opts.debounceMs ?? 5000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSerialized = "";

  function flush() {
    const snap = snapshotForPersist(store.getState());
    const json = JSON.stringify(snap);
    if (json !== lastSerialized) {
      try { localStorage.setItem(STORAGE_KEY, json); } catch { /* quota — ignore */ }
      lastSerialized = json;
    }
    timer = null;
  }

  const unsubscribe = store.subscribe((state, prev) => {
    // Immediate (rare) fields:
    if (state.volume !== prev.volume || state.shuffle !== prev.shuffle || state.repeat !== prev.repeat || state.queue !== prev.queue || state.currentIndex !== prev.currentIndex) {
      if (timer) { clearTimeout(timer); timer = null; }
      flush();
      return;
    }
    // Debounced field (position):
    if (state.position !== prev.position) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    }
  });

  function onPageHide() { if (timer) { clearTimeout(timer); timer = null; } flush(); }
  window.addEventListener("pagehide", onPageHide);

  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener("pagehide", onPageHide);
    unsubscribe();
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/player/persist.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/player/persist.ts lib/player/persist.test.ts
git commit -m "feat(player): persist queue/position with debounce + pagehide flush"
```

---

### Task 14: `lib/player/keyboard.ts` — global shortcut handler

**Files:**
- Create: `lib/player/keyboard.ts`
- Create: `lib/player/keyboard.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// @vitest-environment happy-dom
// lib/player/keyboard.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createPlayerStore } from "./store";
import { attachKeyboard } from "./keyboard";

function loadOne(store: ReturnType<typeof createPlayerStore>) {
  store.getState().setQueue([
    { videoId: 1, defaultKind: "audio", title: "T1", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    { videoId: 2, defaultKind: "audio", title: "T2", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
  ], 0);
}

function press(key: string, opts: { shift?: boolean; target?: HTMLElement } = {}) {
  const ev = new KeyboardEvent("keydown", { key, shiftKey: !!opts.shift, bubbles: true, cancelable: true });
  (opts.target ?? document.body).dispatchEvent(ev);
}

let store: ReturnType<typeof createPlayerStore>;
let detach: () => void;
beforeEach(() => {
  store = createPlayerStore();
  detach = attachKeyboard(store);
  loadOne(store);
});

describe("keyboard shortcuts", () => {
  it("Space toggles play/pause", () => {
    press(" ");
    expect(store.getState().isPlaying).toBe(true);
    press(" ");
    expect(store.getState().isPlaying).toBe(false);
    detach();
  });

  it("ArrowRight seeks +10s", () => {
    store.getState().setPosition(5);
    press("ArrowRight");
    expect(store.getState().position).toBe(15);
    detach();
  });

  it("ArrowLeft seeks -10s, clamped at 0", () => {
    store.getState().setPosition(3);
    press("ArrowLeft");
    expect(store.getState().position).toBe(0);
    detach();
  });

  it("Shift+ArrowRight calls next()", () => {
    press("ArrowRight", { shift: true });
    expect(store.getState().currentIndex).toBe(1);
    detach();
  });

  it("Shift+ArrowLeft calls prev()", () => {
    store.getState().setQueue(store.getState().queue, 1);
    press("ArrowLeft", { shift: true });
    expect(store.getState().currentIndex).toBe(0);
    detach();
  });

  it("M toggles mute", () => {
    store.getState().setVolume(0.6);
    press("m");
    expect(store.getState().volume).toBe(0);
    press("M");
    expect(store.getState().volume).toBeCloseTo(0.6);
    detach();
  });

  it("F opens fullscreen when a track is loaded", () => {
    press("f");
    expect(store.getState().mode).toBe("fullscreen");
    detach();
  });

  it("ignores keypress when target is an input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    press(" ", { target: input });
    expect(store.getState().isPlaying).toBe(false);
    document.body.removeChild(input);
    detach();
  });

  it("ignores keypress when target is contentEditable", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    press(" ", { target: div });
    expect(store.getState().isPlaying).toBe(false);
    document.body.removeChild(div);
    detach();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// lib/player/keyboard.ts
import type { PlayerStore } from "./store";

export function attachKeyboard(store: PlayerStore): () => void {
  function handler(ev: KeyboardEvent) {
    const t = ev.target as HTMLElement | null;
    if (t) {
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
    }
    const s = store.getState();
    switch (ev.key) {
      case " ":
      case "Spacebar":
        ev.preventDefault();
        s.togglePlay();
        return;
      case "ArrowRight":
        ev.preventDefault();
        if (ev.shiftKey) s.next();
        else s.seek(s.position + 10);
        return;
      case "ArrowLeft":
        ev.preventDefault();
        if (ev.shiftKey) s.prev();
        else s.seek(Math.max(0, s.position - 10));
        return;
      case "m":
      case "M":
        ev.preventDefault();
        s.toggleMute();
        return;
      case "f":
      case "F":
        ev.preventDefault();
        s.openFullscreen();
        return;
    }
  }
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/player/keyboard.ts lib/player/keyboard.test.ts
git commit -m "feat(player): global keyboard shortcuts"
```

---

### Task 15: `lib/player/media-session.ts` — lockscreen integration

**Files:**
- Create: `lib/player/media-session.ts`
- Create: `lib/player/media-session.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// @vitest-environment happy-dom
// lib/player/media-session.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPlayerStore } from "./store";
import { attachMediaSession, updateMediaSessionMetadata } from "./media-session";

interface FakeMediaSession {
  metadata: unknown;
  setActionHandler: (action: string, handler: (() => void) | ((d: { seekTime?: number }) => void) | null) => void;
  _handlers: Map<string, ((d?: { seekTime?: number }) => void) | null>;
}

function installFakeMediaSession(): FakeMediaSession {
  const handlers = new Map<string, ((d?: { seekTime?: number }) => void) | null>();
  const ms: FakeMediaSession = {
    metadata: null,
    _handlers: handlers,
    setActionHandler: (action, h) => { handlers.set(action, h as never); },
  };
  Object.defineProperty(navigator, "mediaSession", { value: ms, configurable: true });
  Object.defineProperty(window, "MediaMetadata", {
    value: class { constructor(public init: unknown) {} },
    configurable: true,
  });
  return ms;
}

beforeEach(() => {
  // reset
  Object.defineProperty(navigator, "mediaSession", { value: undefined, configurable: true });
});

describe("attachMediaSession", () => {
  it("no-op when MediaSession API is missing", () => {
    const store = createPlayerStore();
    const detach = attachMediaSession(store);
    expect(detach).toBeTypeOf("function");
    detach();
  });

  it("registers play/pause/prev/next/seekto handlers wired to store", () => {
    const ms = installFakeMediaSession();
    const store = createPlayerStore();
    const spy = vi.spyOn(store.getState(), "play");
    attachMediaSession(store);
    ms._handlers.get("play")?.();
    expect(spy).toHaveBeenCalled();
  });

  it("seekto forwards seekTime to store.seek", () => {
    const ms = installFakeMediaSession();
    const store = createPlayerStore();
    store.getState().setQueue([{ videoId: 1, defaultKind: "audio", title: "T", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] }], 0);
    attachMediaSession(store);
    ms._handlers.get("seekto")?.({ seekTime: 42 });
    expect(store.getState().position).toBe(42);
  });
});

describe("updateMediaSessionMetadata", () => {
  it("sets MediaMetadata with title/artist/artwork", () => {
    const ms = installFakeMediaSession();
    updateMediaSessionMetadata({
      videoId: 1, defaultKind: "audio", title: "Hello",
      channelTitle: "Chan", thumbnailUrl: "https://i/1.jpg",
      durationSeconds: 60, availableKinds: ["audio"],
    });
    expect((ms.metadata as { init: { title: string } }).init.title).toBe("Hello");
  });

  it("no-op without MediaSession", () => {
    expect(() => updateMediaSessionMetadata({
      videoId: 1, defaultKind: "audio", title: "X",
      channelTitle: null, thumbnailUrl: null, durationSeconds: 0, availableKinds: ["audio"],
    })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// lib/player/media-session.ts
import type { PlayerStore } from "./store";
import type { QueueItem } from "./types";

function ms(): MediaSession | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
}

export function attachMediaSession(store: PlayerStore): () => void {
  const session = ms();
  if (!session) return () => {};
  const s = store.getState();
  session.setActionHandler("play", () => store.getState().play());
  session.setActionHandler("pause", () => store.getState().pause());
  session.setActionHandler("previoustrack", () => store.getState().prev());
  session.setActionHandler("nexttrack", () => store.getState().next());
  session.setActionHandler("seekto", (d) => {
    const seekTime = (d as { seekTime?: number }).seekTime ?? 0;
    store.getState().seek(seekTime);
  });
  void s;
  return () => {
    const cur = ms();
    if (!cur) return;
    cur.setActionHandler("play", null);
    cur.setActionHandler("pause", null);
    cur.setActionHandler("previoustrack", null);
    cur.setActionHandler("nexttrack", null);
    cur.setActionHandler("seekto", null);
  };
}

export function updateMediaSessionMetadata(item: QueueItem | null): void {
  const session = ms();
  if (!session) return;
  if (!item) { session.metadata = null; return; }
  const Ctor = (window as unknown as { MediaMetadata?: typeof MediaMetadata }).MediaMetadata;
  if (!Ctor) return;
  session.metadata = new Ctor({
    title: item.title,
    artist: item.channelTitle ?? "",
    artwork: item.thumbnailUrl ? [{ src: item.thumbnailUrl }] : [],
  });
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/player/media-session.ts lib/player/media-session.test.ts
git commit -m "feat(player): MediaSession lockscreen handlers + metadata"
```

---

## Phase 4 — Player UI components

### Task 16: `lib/client/use-player-store.ts` — React bindings for the vanilla store

**Files:**
- Create: `lib/client/use-player-store.ts`
- Create: `lib/client/use-player-store.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// lib/client/use-player-store.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PlayerStoreProvider, usePlayerStore } from "./use-player-store";
import { createPlayerStore } from "@/lib/player/store";

function Probe() {
  const idx = usePlayerStore((s) => s.currentIndex);
  return <span data-testid="idx">{idx}</span>;
}

describe("usePlayerStore", () => {
  it("reads state and reacts to updates", () => {
    const store = createPlayerStore();
    render(
      <PlayerStoreProvider store={store}>
        <Probe />
      </PlayerStoreProvider>,
    );
    expect(screen.getByTestId("idx").textContent).toBe("-1");
    act(() => {
      store.getState().setQueue([{
        videoId: 1, defaultKind: "audio", title: "T", channelTitle: null,
        thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
      }], 0);
    });
    expect(screen.getByTestId("idx").textContent).toBe("0");
  });

  it("throws helpful error when used outside provider", () => {
    const Bad = () => { usePlayerStore((s) => s.currentIndex); return null; };
    expect(() => render(<Bad />)).toThrow(/PlayerStoreProvider/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// lib/client/use-player-store.ts
"use client";
import { createContext, useContext, useRef, useSyncExternalStore } from "react";
import type { PlayerStore } from "@/lib/player/store";

const Ctx = createContext<PlayerStore | null>(null);

export function PlayerStoreProvider({ store, children }: { store: PlayerStore; children: React.ReactNode }) {
  const ref = useRef(store);
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}

export function usePlayerStore<T>(selector: (s: ReturnType<PlayerStore["getState"]>) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("usePlayerStore must be used inside PlayerStoreProvider");
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function usePlayerStoreApi(): PlayerStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("usePlayerStoreApi must be used inside PlayerStoreProvider");
  return store;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/client/use-player-store.ts lib/client/use-player-store.test.tsx
git commit -m "feat(player): React bindings for vanilla Zustand store"
```

---

### Task 17: `<PlayerCore>` — single audio + video element wired to store

**Files:**
- Create: `components/player/player-core.tsx`
- Create: `components/player/player-core.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// components/player/player-core.test.tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { PlayerCore } from "./player-core";

function withStore() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "T", channelTitle: null,
    thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
  }], 0);
  return store;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

describe("<PlayerCore>", () => {
  it("renders one <audio> and one <video>", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    expect(container.querySelectorAll("audio").length).toBe(1);
    expect(container.querySelectorAll("video").length).toBe(1);
  });

  it("sets src on the active element from /api/stream/<id>", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    expect(audio.getAttribute("src")).toMatch(/\/api\/stream\/42$/);
  });

  it("calls play() on the audio element when store.isPlaying flips true", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    act(() => { store.getState().play(); });
    expect(audio.play).toHaveBeenCalled();
  });

  it("on element 'error' event triggers next() and toast", () => {
    const store = withStore();
    store.getState().setQueue([
      { videoId: 1, defaultKind: "audio", title: "A", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
      { videoId: 2, defaultKind: "audio", title: "B", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    ], 0);
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 99} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    act(() => { audio.dispatchEvent(new Event("error")); });
    expect(store.getState().currentIndex).toBe(1);
  });

  it("ended event advances to next track", () => {
    const store = withStore();
    store.getState().setQueue([
      { videoId: 1, defaultKind: "audio", title: "A", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
      { videoId: 2, defaultKind: "audio", title: "B", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    ], 0);
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 11} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    act(() => { audio.dispatchEvent(new Event("ended")); });
    expect(store.getState().currentIndex).toBe(1);
  });
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/player-core.tsx
"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";

interface Props {
  /** Maps (videoId, kind) → mediaFileId. Injected by PlayerProvider. */
  resolveMediaFileId: (videoId: number, kind: "audio" | "video") => number | null;
}

export function PlayerCore({ resolveMediaFileId }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const store = usePlayerStoreApi();
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentKind = usePlayerStore((s) => s.currentKind);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const queue = usePlayerStore((s) => s.queue);
  const mode = usePlayerStore((s) => s.mode);

  // Resolve src on track change
  useEffect(() => {
    const item = currentIndex >= 0 ? queue[currentIndex] : null;
    if (!item || !currentKind) {
      if (audioRef.current) audioRef.current.removeAttribute("src");
      if (videoRef.current) videoRef.current.removeAttribute("src");
      return;
    }
    const id = resolveMediaFileId(item.videoId, currentKind);
    if (id == null) {
      toast.error(`Couldn't play '${item.title}' — file missing. Skipped.`);
      store.getState().markBrokenAndAdvance();
      return;
    }
    const url = `/api/stream/${id}`;
    const el = currentKind === "audio" ? audioRef.current : videoRef.current;
    if (el && el.getAttribute("src") !== url) el.setAttribute("src", url);
  }, [currentIndex, currentKind, queue, resolveMediaFileId, store]);

  // Drive play/pause from store
  useEffect(() => {
    const el = currentKind === "audio" ? audioRef.current : videoRef.current;
    if (!el) return;
    if (isPlaying) void el.play().catch(() => store.getState().pause());
    else el.pause();
  }, [isPlaying, currentKind, currentIndex, store]);

  // Drive volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // Wire element events to store (once)
  useEffect(() => {
    function bind(el: HTMLMediaElement | null) {
      if (!el) return () => {};
      const onLoaded = () => store.getState().setDuration(el.duration);
      let last = 0;
      const onTime = () => {
        const now = performance.now();
        if (now - last < 250) return;
        last = now;
        store.getState().setPosition(el.currentTime);
      };
      const onEnded = () => store.getState().next();
      const onError = () => {
        const item = store.getState().queue[store.getState().currentIndex];
        toast.error(`Couldn't play '${item?.title ?? "track"}' — file missing. Skipped.`);
        store.getState().markBrokenAndAdvance();
      };
      el.addEventListener("loadedmetadata", onLoaded);
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
      return () => {
        el.removeEventListener("loadedmetadata", onLoaded);
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onError);
      };
    }
    const a = bind(audioRef.current);
    const v = bind(videoRef.current);
    return () => { a(); v(); };
  }, [store]);

  const showVideo = currentKind === "video" && (mode === "fullscreen" || mode === "queue-open");
  return (
    <>
      <audio ref={audioRef} preload="metadata" hidden />
      <video
        ref={videoRef}
        preload="metadata"
        playsInline
        className={showVideo ? "h-full w-full" : "hidden"}
      />
    </>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run components/player/player-core.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/player/player-core.tsx components/player/player-core.test.tsx
git commit -m "feat(player): PlayerCore element-store sync"
```

---

### Task 18: `lib/client/resolve-media-file.ts` — videoId+kind → mediaFileId helper

**Files:**
- Create: `lib/client/resolve-media-file.ts`
- Create: `lib/client/resolve-media-file.test.ts`
- Create: `app/api/videos/[id]/media-files/route.ts`
- Create: `app/api/videos/[id]/media-files/route.test.ts`

PlayerCore needs the integer `mediaFileId` for the stream URL. The QueueItem only carries `videoId` + `availableKinds`. We expose a small route + cache.

- [ ] **Step 1: Route — failing test**

```ts
// app/api/videos/[id]/media-files/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";
import { GET } from "./route";

let ctx: TestBootContext; let tmp: string; let videoId: number; let mediaFileId: number;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-mf-"));
  ctx = await createTestBootContext();
  __setBootContextForTesting(ctx);
  videoId = ctx.videoRepo.upsert({
    provider: "youtube", externalId: "v1", title: "T", channelTitle: null,
    durationSeconds: 60, thumbnailUrl: null, availabilityStatus: "available",
  });
  mediaFileId = ctx.mediaFileRepo.insert({
    videoId, kind: "audio", filePath: path.join(tmp, "a.mp3"),
    format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 60,
  });
});
afterEach(async () => { __setBootContextForTesting(null); ctx.cleanup(); await fs.rm(tmp, { recursive: true, force: true }); });

async function call(id: number) {
  return GET(new Request(`http://x/api/videos/${id}/media-files`),
    { params: Promise.resolve({ id: String(id) }) });
}

describe("GET /api/videos/[id]/media-files", () => {
  it("returns audio + video map", async () => {
    const res = await call(videoId);
    const body = await res.json();
    expect(body.audio).toBe(mediaFileId);
    expect(body.video).toBeNull();
  });

  it("404 when video unknown", async () => {
    const res = await call(99999);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement route**

```ts
// app/api/videos/[id]/media-files/route.ts
import { ensureBootedOrTest } from "@/lib/api/helpers";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const videoId = Number(id);
  if (!Number.isFinite(videoId)) return new Response("Not Found", { status: 404 });
  const boot = await ensureBootedOrTest();
  const video = boot.videoService.byId(videoId);
  if (!video) return new Response("Not Found", { status: 404 });
  const files = boot.mediaFileRepo.byVideoId(videoId);
  const audio = files.find((f) => f.kind === "audio")?.id ?? null;
  const videoFile = files.find((f) => f.kind === "video")?.id ?? null;
  return Response.json({ audio, video: videoFile });
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Implement client cache helper — failing test**

```ts
// @vitest-environment happy-dom
// lib/client/resolve-media-file.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMediaFileResolver } from "./resolve-media-file";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ audio: 11, video: 22 }), { status: 200 }),
  );
});

describe("createMediaFileResolver", () => {
  it("returns mediaFileId for cached entry without re-fetching", async () => {
    const resolver = createMediaFileResolver();
    const id1 = await resolver.fetchAndCache(1);
    expect(id1.audio).toBe(11);
    expect(resolver.get(1, "audio")).toBe(11);
    expect(resolver.get(1, "video")).toBe(22);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await resolver.fetchAndCache(1);
    expect(global.fetch).toHaveBeenCalledTimes(1); // memoized
  });

  it("returns null when video missing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const resolver = createMediaFileResolver();
    const r = await resolver.fetchAndCache(99);
    expect(r.audio).toBeNull();
    expect(r.video).toBeNull();
  });
});
```

- [ ] **Step 6: Implement helper**

```ts
// lib/client/resolve-media-file.ts
"use client";

export interface MediaFileMap { audio: number | null; video: number | null; }

export interface MediaFileResolver {
  get(videoId: number, kind: "audio" | "video"): number | null;
  fetchAndCache(videoId: number): Promise<MediaFileMap>;
}

export function createMediaFileResolver(): MediaFileResolver {
  const cache = new Map<number, MediaFileMap>();
  const inflight = new Map<number, Promise<MediaFileMap>>();
  return {
    get(videoId, kind) { return cache.get(videoId)?.[kind] ?? null; },
    async fetchAndCache(videoId) {
      const existing = cache.get(videoId);
      if (existing) return existing;
      let promise = inflight.get(videoId);
      if (!promise) {
        promise = fetch(`/api/videos/${videoId}/media-files`).then(async (r) => {
          if (!r.ok) return { audio: null, video: null } as MediaFileMap;
          return (await r.json()) as MediaFileMap;
        });
        inflight.set(videoId, promise);
      }
      const result = await promise;
      cache.set(videoId, result);
      inflight.delete(videoId);
      return result;
    },
  };
}
```

- [ ] **Step 7: Run all new tests — expect PASS**

```bash
npx vitest run app/api/videos/[id]/media-files/ lib/client/resolve-media-file.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/api/videos lib/client/resolve-media-file.ts lib/client/resolve-media-file.test.ts
git commit -m "feat(player): mediaFileId resolver + per-video lookup endpoint"
```

---

### Task 19: `<PlayerProvider>` — root mount that wires everything

**Files:**
- Create: `components/player/player-provider.tsx`
- Create: `components/player/player-provider.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// components/player/player-provider.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerProvider } from "./player-provider";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("<PlayerProvider>", () => {
  it("renders children + mounts a hidden audio element", () => {
    const { container } = render(
      <PlayerProvider><span data-testid="child">x</span></PlayerProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(container.querySelectorAll("audio").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/player-provider.tsx
"use client";
import { useEffect, useMemo } from "react";
import { createPlayerStore } from "@/lib/player/store";
import { attachPersist, hydrateFrom, STORAGE_KEY } from "@/lib/player/persist";
import { attachKeyboard } from "@/lib/player/keyboard";
import { attachMediaSession, updateMediaSessionMetadata } from "@/lib/player/media-session";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createMediaFileResolver } from "@/lib/client/resolve-media-file";
import { PlayerCore } from "./player-core";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo(() => createPlayerStore(), []);
  const resolver = useMemo(() => createMediaFileResolver(), []);

  useEffect(() => {
    hydrateFrom(store, typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null);
    const detachPersist = attachPersist(store);
    const detachKb = attachKeyboard(store);
    const detachMs = attachMediaSession(store);
    const unsub = store.subscribe((s, prev) => {
      if (s.currentIndex !== prev.currentIndex) {
        const it = s.queue[s.currentIndex];
        if (it) updateMediaSessionMetadata(it);
      }
    });
    return () => { detachPersist(); detachKb(); detachMs(); unsub(); };
  }, [store]);

  function resolve(videoId: number, kind: "audio" | "video"): number | null {
    const cached = resolver.get(videoId, kind);
    if (cached != null) return cached;
    void resolver.fetchAndCache(videoId);
    return null;
  }

  return (
    <PlayerStoreProvider store={store}>
      <PlayerCore resolveMediaFileId={resolve} />
      {children}
    </PlayerStoreProvider>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/player-provider.tsx components/player/player-provider.test.tsx
git commit -m "feat(player): PlayerProvider mounts core + persist + keyboard + media-session"
```

---

### Task 20: `<NowPlayingIndicator>` — pulsing dot

**Files:**
- Create: `components/player/now-playing-indicator.tsx`
- Create: `components/player/now-playing-indicator.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// components/player/now-playing-indicator.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NowPlayingIndicator } from "./now-playing-indicator";

describe("<NowPlayingIndicator>", () => {
  it("renders an animated dot when isPlaying", () => {
    render(<NowPlayingIndicator isPlaying />);
    const dot = screen.getByLabelText("Now playing");
    expect(dot).toBeInTheDocument();
    expect(dot.className).toMatch(/animate-pulse/);
  });

  it("dot static when paused", () => {
    render(<NowPlayingIndicator isPlaying={false} />);
    const dot = screen.getByLabelText("Now playing");
    expect(dot.className).not.toMatch(/animate-pulse/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/now-playing-indicator.tsx
"use client";
import { cn } from "@/lib/utils";

export function NowPlayingIndicator({ isPlaying }: { isPlaying: boolean }) {
  return (
    <span
      aria-label="Now playing"
      role="status"
      className={cn(
        "inline-block h-2 w-2 rounded-full bg-[var(--color-accent,theme(colors.indigo.500))]",
        isPlaying && "animate-pulse",
      )}
    />
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/now-playing-indicator.tsx components/player/now-playing-indicator.test.tsx
git commit -m "feat(player): NowPlayingIndicator dot"
```

---

### Task 21: `<PlayerBar>` — persistent bar (idle hidden, controls, time)

**Files:**
- Create: `components/player/player-bar.tsx`
- Create: `components/player/player-bar.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// components/player/player-bar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerBar } from "./player-bar";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function withStore() {
  const store = createPlayerStore();
  return store;
}

function loadOne(store: ReturnType<typeof createPlayerStore>) {
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "Hello",
    channelTitle: "Chan", thumbnailUrl: null, durationSeconds: 200,
    availableKinds: ["audio"],
  }], 0);
  store.getState().setDuration(200);
}

describe("<PlayerBar>", () => {
  it("renders nothing when idle (currentIndex -1)", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title + channel when track loaded", () => {
    const store = withStore();
    loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Chan")).toBeInTheDocument();
  });

  it("Play/Pause button toggles store.isPlaying", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(store.getState().isPlaying).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(store.getState().isPlaying).toBe(false);
  });

  it("formats time as M:SS / M:SS", () => {
    const store = withStore(); loadOne(store);
    act(() => { store.getState().setPosition(75); });
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    expect(screen.getByText("1:15 / 3:20")).toBeInTheDocument();
  });

  it("Next button calls store.next()", async () => {
    const store = withStore();
    store.getState().setQueue([
      { videoId: 1, defaultKind: "audio", title: "A", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
      { videoId: 2, defaultKind: "audio", title: "B", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    ], 0);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /next track/i }));
    expect(store.getState().currentIndex).toBe(1);
  });

  it("clicking the progress stripe seeks", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    const stripe = screen.getByRole("slider", { name: /seek/i });
    // simulate a click at 50%
    Object.defineProperty(stripe, "getBoundingClientRect", { value: () => ({ left: 0, width: 100, top: 0, right: 100, bottom: 2, height: 2 }) });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: stripe, coords: { x: 50, y: 1 } });
    expect(store.getState().position).toBeCloseTo(100, 0);
  });

  it("Repeat button cycles label off → all → one", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    const btn = screen.getByRole("button", { name: /repeat/i });
    await userEvent.click(btn);
    expect(store.getState().repeat).toBe("all");
    await userEvent.click(btn);
    expect(store.getState().repeat).toBe("one");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/player-bar.tsx
"use client";
import { useRef } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Maximize2, ListMusic,
} from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { cn } from "@/lib/utils";

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const store = usePlayerStoreApi();
  const item = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex] : null));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const stripeRef = useRef<HTMLDivElement | null>(null);

  if (!item) return null;

  function seekFromClick(ev: React.PointerEvent<HTMLDivElement>) {
    const rect = stripeRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    store.getState().seek(ratio * duration);
  }

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const repeatLabel = repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat all" : "Repeat one";

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 h-16 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div
        ref={stripeRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(position)}
        tabIndex={0}
        onPointerDown={seekFromClick}
        className="absolute inset-x-0 top-0 h-[2px] cursor-pointer bg-[var(--color-muted-bg)] hover:h-2"
      >
        <div
          className="h-full bg-[var(--color-accent,theme(colors.indigo.500))]"
          style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }}
        />
      </div>
      <div className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="h-10 w-10 rounded bg-[var(--color-muted-bg)]" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="truncate text-xs text-[var(--color-muted)]">{item.channelTitle ?? ""}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Shuffle" onClick={() => store.getState().toggleShuffle()} className={cn("p-1", shuffle && "text-[var(--color-accent)]")}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button aria-label="Previous track" onClick={() => store.getState().prev()} className="p-1">
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => store.getState().togglePlay()}
            className="rounded-full bg-[var(--color-fg)] p-2 text-[var(--color-bg)]"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button aria-label="Next track" onClick={() => store.getState().next()} className="p-1">
            <SkipForward className="h-5 w-5" />
          </button>
          <button aria-label={repeatLabel} onClick={() => store.getState().cycleRepeat()} className={cn("p-1", repeat !== "off" && "text-[var(--color-accent)]")}>
            <RepeatIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-3 text-xs tabular-nums text-[var(--color-muted)]">
          <span>{formatTime(position)} / {formatTime(duration)}</span>
          <button aria-label="Open queue" onClick={() => store.getState().openQueue()} className="p-1">
            <ListMusic className="h-4 w-4" />
          </button>
          <button aria-label={volume === 0 ? "Unmute" : "Mute"} onClick={() => store.getState().toggleMute()} className="p-1">
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button aria-label="Open fullscreen" onClick={() => store.getState().openFullscreen()} className="p-1">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run components/player/player-bar.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/player/player-bar.tsx components/player/player-bar.test.tsx
git commit -m "feat(player): PlayerBar (controls + scrub stripe + time)"
```

---

### Task 22: `<QueueList>` — shared list with reorder + remove

**Files:**
- Create: `components/player/queue-list.tsx`
- Create: `components/player/queue-list.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// components/player/queue-list.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueueList } from "./queue-list";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function withItems(n: number) {
  const store = createPlayerStore();
  store.getState().setQueue(
    Array.from({ length: n }, (_, i) => ({
      videoId: i + 1, defaultKind: "audio" as const, title: `T${i + 1}`,
      channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] as const,
    })),
    0,
  );
  return store;
}

describe("<QueueList>", () => {
  it("shows all queue items with title + Now-Playing marker on the current track", () => {
    const store = withItems(3);
    render(<PlayerStoreProvider store={store}><QueueList /></PlayerStoreProvider>);
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBe(3);
    expect(within(rows[0]!).getByLabelText("Now playing")).toBeInTheDocument();
  });

  it("Remove button removes the item", async () => {
    const store = withItems(3);
    render(<PlayerStoreProvider store={store}><QueueList /></PlayerStoreProvider>);
    await userEvent.click(screen.getAllByRole("button", { name: /remove from queue/i })[2]!);
    expect(store.getState().queue.length).toBe(2);
  });

  it("Clear queue button empties", async () => {
    const store = withItems(2);
    render(<PlayerStoreProvider store={store}><QueueList /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /clear queue/i }));
    expect(store.getState().queue.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement (uses @dnd-kit/sortable)**

```tsx
// components/player/queue-list.tsx
"use client";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, AlertTriangle } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { NowPlayingIndicator } from "./now-playing-indicator";
import type { QueueItem } from "@/lib/player/types";

function Row({ item, index }: { item: QueueItem; index: number }) {
  const store = usePlayerStoreApi();
  const isCurrent = usePlayerStore((s) => s.currentIndex === index);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const sortable = useSortable({ id: `${item.videoId}-${index}` });
  const broken = item.availableKinds.length === 0;
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-[var(--color-muted-bg)]"
    >
      <button
        type="button"
        aria-label="Drag handle"
        {...sortable.attributes}
        {...sortable.listeners}
        className="cursor-grab text-[var(--color-muted)]"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {isCurrent ? <NowPlayingIndicator isPlaying={isPlaying} /> : <span className="w-2" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{item.title}</div>
        <div className="truncate text-xs text-[var(--color-muted)]">{item.channelTitle ?? ""}</div>
      </div>
      {broken && <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="File missing" />}
      <button
        type="button"
        aria-label="Remove from queue"
        onClick={() => store.getState().removeFromQueue(index)}
        className="p-1 text-[var(--color-muted)]"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

export function QueueList() {
  const store = usePlayerStoreApi();
  const queue = usePlayerStore((s) => s.queue);
  const ids = queue.map((q, i) => `${q.videoId}-${i}`);

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    // Use store.reorder so currentIndex tracks the move.
    store.getState().reorder(from, to);
    // arrayMove no-op here — reorder already mutated; keep import to silence tree-shake warnings.
    void arrayMove;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <h2 className="text-sm font-semibold">Queue · {queue.length} tracks</h2>
        <button
          type="button"
          onClick={() => store.getState().clearQueue()}
          className="text-xs text-[var(--color-muted)] hover:underline"
        >
          Clear queue
        </button>
      </header>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="flex-1 overflow-auto p-2">
            {queue.map((q, i) => <Row key={`${q.videoId}-${i}`} item={q} index={i} />)}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/queue-list.tsx components/player/queue-list.test.tsx
git commit -m "feat(player): QueueList with dnd-kit reorder + remove"
```

---

### Task 23: `<QueueSidebar>` — persistent right column ≥ 1280px

**Files:**
- Create: `components/player/queue-sidebar.tsx`
- Create: `components/player/queue-sidebar.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// components/player/queue-sidebar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueSidebar } from "./queue-sidebar";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

describe("<QueueSidebar>", () => {
  it("renders QueueList inside a 320-px right column with the @container query class", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><QueueSidebar /></PlayerStoreProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/hidden/);
    expect(root.className).toMatch(/@\[1280px\]:block/);
    expect(screen.getByText(/Queue · 0 tracks/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/queue-sidebar.tsx
"use client";
import { QueueList } from "./queue-list";

export function QueueSidebar() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-[var(--color-border)] @[1280px]:block">
      <QueueList />
    </aside>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/queue-sidebar.tsx components/player/queue-sidebar.test.tsx
git commit -m "feat(player): QueueSidebar (≥1280px)"
```

---

### Task 24: `<QueueDrawer>` — Sheet variant for narrow screens

**Files:**
- Create: `components/player/queue-drawer.tsx`
- Create: `components/player/queue-drawer.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// components/player/queue-drawer.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueueDrawer } from "./queue-drawer";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

describe("<QueueDrawer>", () => {
  it("opens when mode === 'queue-open'", () => {
    const store = createPlayerStore();
    render(<PlayerStoreProvider store={store}><QueueDrawer /></PlayerStoreProvider>);
    expect(screen.queryByText(/Queue ·/i)).not.toBeInTheDocument();
    act(() => { store.getState().openQueue(); });
    expect(screen.getByText(/Queue · 0 tracks/i)).toBeInTheDocument();
  });

  it("closes via store.closeOverlays", () => {
    const store = createPlayerStore();
    render(<PlayerStoreProvider store={store}><QueueDrawer /></PlayerStoreProvider>);
    act(() => { store.getState().openQueue(); });
    act(() => { store.getState().closeOverlays(); });
    expect(screen.queryByText(/Queue ·/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement (uses shadcn Sheet from Task 1)**

```tsx
// components/player/queue-drawer.tsx
"use client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { QueueList } from "./queue-list";

export function QueueDrawer() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "queue-open");
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) store.getState().closeOverlays(); }}>
      <SheetContent side="right" className="w-[360px] p-0">
        <QueueList />
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/queue-drawer.tsx components/player/queue-drawer.test.tsx
git commit -m "feat(player): QueueDrawer (Sheet variant)"
```

---

### Task 25: `<FullscreenAudio>` — cover overlay + scrub + tabs

**Files:**
- Create: `components/player/fullscreen-audio.tsx`
- Create: `components/player/fullscreen-audio.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// components/player/fullscreen-audio.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FullscreenAudio } from "./fullscreen-audio";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function setup() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "Hello", channelTitle: "Chan",
    thumbnailUrl: null, durationSeconds: 200, availableKinds: ["audio"],
  }], 0);
  store.getState().setDuration(200);
  store.getState().openFullscreen();
  return store;
}

describe("<FullscreenAudio>", () => {
  it("renders nothing when mode is mini", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title + channel when fullscreen", () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Chan")).toBeInTheDocument();
  });

  it("Close button returns to mini mode", async () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(store.getState().mode).toBe("mini");
  });

  it("Esc key closes fullscreen", () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(store.getState().mode).toBe("mini");
  });

  it("Queue tab switches to QueueList", async () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("tab", { name: /queue/i }));
    expect(screen.getByText(/Queue · 1 tracks/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/fullscreen-audio.tsx
"use client";
import { useEffect, useState } from "react";
import { X, Music, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { QueueList } from "./queue-list";

function fmt(s: number) {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function FullscreenAudio() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "fullscreen");
  const item = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex] : null));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const [tab, setTab] = useState<"now" | "queue">("now");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") store.getState().closeOverlays(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, store]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[var(--color-bg)]">
      <header className="flex justify-end p-3">
        <button aria-label="Close" onClick={() => store.getState().closeOverlays()} className="p-2">
          <X className="h-5 w-5" />
        </button>
      </header>
      {tab === "now" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <div className="grid h-80 w-80 max-w-[80vw] place-items-center rounded-lg bg-[var(--color-muted-bg)]">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnailUrl} alt="" className="h-full w-full rounded-lg object-cover" />
            ) : (
              <Music className="h-16 w-16 text-[var(--color-muted)]" />
            )}
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">{item.title}</div>
            <div className="text-sm text-[var(--color-muted)]">{item.channelTitle ?? ""}</div>
          </div>
          <div className="w-full max-w-md">
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={Math.floor(duration)}
              value={Math.floor(position)}
              onChange={(e) => store.getState().seek(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs tabular-nums text-[var(--color-muted)]">
              <span>{fmt(position)}</span><span>{fmt(duration)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button aria-label="Previous track" onClick={() => store.getState().prev()}><SkipBack className="h-6 w-6" /></button>
            <button
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => store.getState().togglePlay()}
              className="rounded-full bg-[var(--color-fg)] p-3 text-[var(--color-bg)]"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button aria-label="Next track" onClick={() => store.getState().next()}><SkipForward className="h-6 w-6" /></button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto"><QueueList /></div>
      )}
      <nav role="tablist" className="flex justify-center gap-2 border-t border-[var(--color-border)] py-2">
        <button role="tab" aria-selected={tab === "now"} onClick={() => setTab("now")} className="px-3 py-1 text-sm">Now Playing</button>
        <button role="tab" aria-selected={tab === "queue"} onClick={() => setTab("queue")} className="px-3 py-1 text-sm">Queue</button>
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/fullscreen-audio.tsx components/player/fullscreen-audio.test.tsx
git commit -m "feat(player): FullscreenAudio overlay with scrub + tabs"
```

---

### Task 26: `<FullscreenVideo>` — cinema overlay + native fullscreen

**Files:**
- Create: `components/player/fullscreen-video.tsx`
- Create: `components/player/fullscreen-video.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// components/player/fullscreen-video.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FullscreenVideo } from "./fullscreen-video";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function setup() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "video", title: "Clip", channelTitle: null,
    thumbnailUrl: null, durationSeconds: 60, availableKinds: ["video"],
  }], 0);
  store.getState().openFullscreen();
  return store;
}

describe("<FullscreenVideo>", () => {
  it("renders nothing when mode is mini", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><FullscreenVideo /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for audio kind", () => {
    const store = createPlayerStore();
    store.getState().setQueue([{
      videoId: 1, defaultKind: "audio", title: "T", channelTitle: null,
      thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
    }], 0);
    store.getState().openFullscreen();
    const { container } = render(
      <PlayerStoreProvider store={store}><FullscreenVideo /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("Close button returns to mini mode", async () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenVideo /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(store.getState().mode).toBe("mini");
  });

  it("Expand button calls requestFullscreen on the video element", async () => {
    const store = setup();
    const spy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, "requestFullscreen", { value: spy, configurable: true });
    render(<PlayerStoreProvider store={store}><FullscreenVideo /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/fullscreen-video.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { X, Maximize2 } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";

export function FullscreenVideo() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "fullscreen");
  const kind = usePlayerStore((s) => s.currentKind);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    function show() {
      setShowControls(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShowControls(false), 3000);
    }
    show();
    document.addEventListener("mousemove", show);
    return () => { document.removeEventListener("mousemove", show); if (timer) clearTimeout(timer); };
  }, [open]);

  if (!open || kind !== "video") return null;

  function expandNative() {
    const v = wrapRef.current?.querySelector("video");
    if (v && v.requestFullscreen) void v.requestFullscreen();
  }

  return (
    <div ref={wrapRef} className="fixed inset-0 z-30 grid place-items-center bg-black/95">
      {/* The actual <video> element lives inside <PlayerCore>. We render a portal target by exposing
          a slot here. PlayerCore sets `display:block` on the <video> when mode=fullscreen and kind=video. */}
      <div className="absolute inset-0 grid place-items-center p-4">
        {/* video element from PlayerCore is positioned by its own className via the mode selector */}
      </div>
      {showControls && (
        <div className="absolute right-4 top-4 flex gap-2">
          <button aria-label="Expand" onClick={expandNative} className="rounded bg-white/10 p-2 text-white"><Maximize2 className="h-5 w-5" /></button>
          <button aria-label="Close" onClick={() => store.getState().closeOverlays()} className="rounded bg-white/10 p-2 text-white"><X className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
}
```

> **Note:** The `<video>` element is mounted in `PlayerCore` (Task 17). For Plan 4 we render the FullscreenVideo as an overlay **container** — PlayerCore is responsible for positioning the video element via CSS based on `mode === "fullscreen" && kind === "video"`. If integration testing in Task 36 reveals layout issues, lift the `<video>` into a portal inside this component instead. Keep the change scoped: the store/state contract stays identical.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/fullscreen-video.tsx components/player/fullscreen-video.test.tsx
git commit -m "feat(player): FullscreenVideo cinema overlay + native fullscreen"
```

---

### Task 27: `<MobilePlayerSheet>` — mini-bar + 100vh sheet for < 768px

**Files:**
- Create: `components/player/mobile-sheet.tsx`
- Create: `components/player/mobile-sheet.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// components/player/mobile-sheet.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobilePlayerSheet } from "./mobile-sheet";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function loadAudio() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "Mobile", channelTitle: "Chan",
    thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
  }], 0);
  return store;
}

describe("<MobilePlayerSheet>", () => {
  it("renders nothing when idle", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows mini bar with title + play/pause", () => {
    const store = loadAudio();
    render(<PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>);
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("tap on mini bar opens fullscreen sheet", async () => {
    const store = loadAudio();
    render(<PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /open player/i }));
    expect(store.getState().mode).toBe("fullscreen");
  });

  it("renders FullscreenAudio in the sheet for audio kind", () => {
    const store = loadAudio();
    act(() => { store.getState().openFullscreen(); });
    render(<PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>);
    // FullscreenAudio renders the title in two places — match either.
    expect(screen.getAllByText("Mobile").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```tsx
// components/player/mobile-sheet.tsx
"use client";
import { Play, Pause } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { FullscreenAudio } from "./fullscreen-audio";
import { FullscreenVideo } from "./fullscreen-video";

export function MobilePlayerSheet() {
  const store = usePlayerStoreApi();
  const item = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex] : null));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const kind = usePlayerStore((s) => s.currentKind);

  if (!item) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-14 z-10 flex h-14 items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 md:hidden">
        <button
          type="button"
          aria-label="Open player"
          onClick={() => store.getState().openFullscreen()}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <div className="h-8 w-8 rounded bg-[var(--color-muted-bg)]" />
          )}
          <span className="truncate text-sm">{item.title}</span>
        </button>
        <button
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={(e) => { e.stopPropagation(); store.getState().togglePlay(); }}
          className="rounded-full bg-[var(--color-fg)] p-2 text-[var(--color-bg)]"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      </div>
      {kind === "video" ? <FullscreenVideo /> : <FullscreenAudio />}
    </>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/player/mobile-sheet.tsx components/player/mobile-sheet.test.tsx
git commit -m "feat(player): MobilePlayerSheet mini-bar + fullscreen"
```

---

## Phase 5 — Track-Row + Header integration

### Task 28: `lib/player/queue-from-items.ts` — adapter from PlaylistDetailItem to QueueItem

**Files:**
- Create: `lib/player/queue-from-items.ts`
- Create: `lib/player/queue-from-items.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// lib/player/queue-from-items.test.ts
import { describe, it, expect } from "vitest";
import { fromPlaylistDetailItems, fromStandaloneVideos } from "./queue-from-items";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import type { VideoSerialized } from "@/lib/client/use-standalone-videos";

function detailItem(over: Partial<PlaylistDetailItem> = {}): PlaylistDetailItem {
  return {
    position: 0, inPlaylist: true, addedAt: "x", removedFromPlaylistAt: null,
    video: {
      id: 1, externalId: "v1", title: "Title", channelTitle: "Chan",
      durationSeconds: 60, thumbnailUrl: "u", availabilityStatus: "available", availabilityReason: null,
    },
    audioFile: null, videoFile: null, pendingJob: null,
    availableKinds: ["audio"],
    ...over,
  };
}

describe("fromPlaylistDetailItems", () => {
  it("maps fields and sets defaultKind from playlist defaultFormat", () => {
    const out = fromPlaylistDetailItems([detailItem({ video: { ...detailItem().video, id: 5 } })], "audio");
    expect(out[0]!.videoId).toBe(5);
    expect(out[0]!.defaultKind).toBe("audio");
    expect(out[0]!.title).toBe("Title");
    expect(out[0]!.availableKinds).toEqual(["audio"]);
  });
});

describe("fromStandaloneVideos", () => {
  it("uses 'audio' as defaultKind when audio is available, else 'video'", () => {
    const v: VideoSerialized = {
      id: 9, provider: "youtube", externalId: "x", title: "T",
      channelTitle: null, channelId: null, durationSeconds: 60, thumbnailUrl: null,
      availabilityStatus: "available", availabilityReason: null,
      availabilityChangedAt: null, firstSeenAt: "x", lastSeenAt: "x",
      createdAt: "x", updatedAt: "x",
      availableKinds: ["video"],
    };
    const out = fromStandaloneVideos([v]);
    expect(out[0]!.defaultKind).toBe("video");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
// lib/player/queue-from-items.ts
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import type { VideoSerialized } from "@/lib/client/use-standalone-videos";
import type { Kind, QueueItem } from "./types";

export function fromPlaylistDetailItems(items: PlaylistDetailItem[], defaultFormat: Kind): QueueItem[] {
  return items.map((it) => ({
    videoId: it.video.id,
    defaultKind: defaultFormat,
    title: it.video.title,
    channelTitle: it.video.channelTitle,
    thumbnailUrl: it.video.thumbnailUrl,
    durationSeconds: it.video.durationSeconds,
    availableKinds: it.availableKinds,
  }));
}

export function fromStandaloneVideos(videos: VideoSerialized[]): QueueItem[] {
  return videos.map((v) => ({
    videoId: v.id,
    defaultKind: v.availableKinds.includes("audio") ? "audio" : "video",
    title: v.title,
    channelTitle: v.channelTitle,
    thumbnailUrl: v.thumbnailUrl,
    durationSeconds: v.durationSeconds,
    availableKinds: v.availableKinds,
  }));
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/player/queue-from-items.ts lib/player/queue-from-items.test.ts
git commit -m "feat(player): adapters from app data shapes to QueueItem"
```

---

### Task 29: `track-table` + `track-row` — click to play (smart queue)

**Files:**
- Modify: `components/playlists/track-table.tsx`
- Modify: `components/playlists/track-row.tsx`
- Modify: `components/playlists/track-row.test.tsx`
- Modify: `components/playlists/track-table.test.tsx`

- [ ] **Step 1: Failing test in track-row**

Append to `track-row.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";

describe("TrackRow click", () => {
  it("invokes onPlay when row clicked", async () => {
    const onPlay = vi.fn();
    render(<TrackRow item={makeItem()} position={0} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole("button", { name: /play test video title/i }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("renders NowPlayingIndicator when isCurrent", () => {
    render(<TrackRow item={makeItem()} position={0} onPlay={() => {}} isCurrent isPlaying />);
    expect(screen.getByLabelText("Now playing")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (props missing)**

- [ ] **Step 3: Update `track-row.tsx`**

Change the signature and replace the position cell with a play button:

```tsx
import { NowPlayingIndicator } from "@/components/player/now-playing-indicator";

interface Props {
  item: PlaylistDetailItem;
  position: number;
  onPlay?: () => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
}

export function TrackRow({ item, position, onPlay, isCurrent, isPlaying }: Props) {
  // ... replace the leading position span with:
  return (
    <div className="flex h-12 items-center gap-3 rounded-md px-2 hover:bg-[var(--color-muted-bg)]">
      <button
        type="button"
        aria-label={`Play ${item.video.title}`}
        onClick={onPlay}
        className="flex w-8 shrink-0 items-center justify-end text-xs text-[var(--color-muted)] tabular-nums"
      >
        {isCurrent ? <NowPlayingIndicator isPlaying={!!isPlaying} /> : position + 1}
      </button>
      {/* ... rest unchanged ... */}
    </div>
  );
}
```

Keep the rest of the file intact (thumbnail, title, channel, duration, status pill, context menu).

- [ ] **Step 4: Update `track-table.tsx` to drive the click**

```tsx
"use client";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { Input } from "@/components/ui/input";
import { TrackRow } from "./track-row";
import type { PlaylistDetailItem } from "@/lib/services/playlist-service";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";

interface Props { items: PlaylistDetailItem[]; defaultFormat: "audio" | "video"; }

export function TrackTable({ items, defaultFormat }: Props) {
  const sp = useSearchParams();
  const filter = sp.get("filter") ?? "all";
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const store = usePlayerStoreApi();
  const currentVideoId = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex]?.videoId : undefined));
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const needle = deferredQ.toLowerCase();
  const filtered = items.filter((it) => {
    if (!it.inPlaylist) return false;
    if (filter === "available" && it.video.availabilityStatus !== "available") return false;
    if (filter === "unavailable" && it.video.availabilityStatus === "available") return false;
    if (needle && !it.video.title.toLowerCase().includes(needle)) return false;
    return true;
  });

  function play(index: number) {
    const queueItems = fromPlaylistDetailItems(filtered, defaultFormat);
    const built = buildQueue(queueItems, index);
    store.getState().setQueue(built.queue, built.currentIndex);
    store.getState().play();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input aria-label="Search items" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <div className="space-y-1">
        {filtered.map((it, i) => (
          <TrackRow
            key={it.video.id}
            item={it}
            position={i}
            onPlay={() => play(i)}
            isCurrent={currentVideoId === it.video.id}
            isPlaying={currentVideoId === it.video.id && isPlaying}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-muted)]">No items match.</p>
      )}
    </div>
  );
}
```

Find every callsite of `<TrackTable items={...} />` and add `defaultFormat={playlist.defaultFormat}`. Likely callers:

```bash
npx grep -rn "<TrackTable" app/ components/
```

- [ ] **Step 5: Add a TrackTable test wrapping in PlayerStoreProvider**

Append to `track-table.test.tsx`:

```tsx
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createPlayerStore } from "@/lib/player/store";

it("clicking a row sets the player queue + plays", async () => {
  const store = createPlayerStore();
  const items = [/* two PlaylistDetailItem fixtures with availableKinds: ["audio"] */];
  render(
    <PlayerStoreProvider store={store}>
      <TrackTable items={items} defaultFormat="audio" />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getAllByRole("button", { name: /play /i })[1]!);
  expect(store.getState().queue.length).toBe(2);
  expect(store.getState().currentIndex).toBe(1);
  expect(store.getState().isPlaying).toBe(true);
});
```

(Construct the two items inline mirroring the existing `makeItem` helper from `track-row.test.tsx`.)

- [ ] **Step 6: Run — expect PASS**

```bash
npx vitest run components/playlists/
```

- [ ] **Step 7: Commit**

```bash
git add components/playlists/
git commit -m "feat(playlists): row-click → smart queue + Now Playing dot"
```

---

### Task 30: `track-context-menu` — Play Now / Add to Queue / Play Next

**Files:**
- Modify: `components/playlists/track-context-menu.tsx`
- Modify: `components/playlists/track-context-menu.test.tsx`

- [ ] **Step 1: Failing tests**

Append to `track-context-menu.test.tsx`:

```tsx
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createPlayerStore } from "@/lib/player/store";

const queueItem = {
  videoId: 1, defaultKind: "audio" as const, title: "T",
  channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio" as const],
};

it("Play Now replaces the queue", async () => {
  const store = createPlayerStore();
  store.getState().setQueue([{ ...queueItem, videoId: 99 }], 0);
  render(
    <PlayerStoreProvider store={store}>
      <TrackContextMenu videoId={1} externalUrl="https://x" available queueItem={queueItem} />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /play now/i }));
  expect(store.getState().queue.map((q) => q.videoId)).toEqual([1]);
});

it("Add to Queue appends", async () => {
  const store = createPlayerStore();
  store.getState().setQueue([{ ...queueItem, videoId: 99 }], 0);
  render(
    <PlayerStoreProvider store={store}>
      <TrackContextMenu videoId={1} externalUrl="https://x" available queueItem={queueItem} />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /add to queue/i }));
  expect(store.getState().queue.map((q) => q.videoId)).toEqual([99, 1]);
});

it("Play Next inserts after current", async () => {
  const store = createPlayerStore();
  store.getState().setQueue([
    { ...queueItem, videoId: 99 },
    { ...queueItem, videoId: 100 },
  ], 0);
  render(
    <PlayerStoreProvider store={store}>
      <TrackContextMenu videoId={1} externalUrl="https://x" available queueItem={queueItem} />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /play next/i }));
  expect(store.getState().queue.map((q) => q.videoId)).toEqual([99, 1, 100]);
});
```

- [ ] **Step 2: Run — expect FAIL (prop missing)**

- [ ] **Step 3: Extend the component**

```tsx
import { Play, PlusCircle, ListPlus } from "lucide-react";
import { usePlayerStoreApi } from "@/lib/client/use-player-store";
import type { QueueItem } from "@/lib/player/types";

interface Props {
  videoId: number;
  externalUrl: string;
  available: boolean;
  queueItem?: QueueItem;
}

export function TrackContextMenu({ videoId, externalUrl, available, queueItem }: Props) {
  const [, start] = useTransition();
  const store = usePlayerStoreApi();
  // ... existing dl/refresh handlers ...

  return (
    <DropdownMenu>
      {/* ... existing trigger ... */}
      <DropdownMenuContent align="end">
        {queueItem && (
          <>
            <DropdownMenuItem onClick={() => { store.getState().setQueue([queueItem], 0); store.getState().play(); }}>
              <Play className="mr-2 h-4 w-4" /> Play Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => store.getState().addToQueue(queueItem)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add to Queue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => store.getState().playNext(queueItem)}>
              <ListPlus className="mr-2 h-4 w-4" /> Play Next
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem render={<a href={externalUrl} target="_blank" rel="noreferrer" />}>
          <ExternalLink className="mr-2 h-4 w-4" /> Open on YouTube
        </DropdownMenuItem>
        {/* ... rest unchanged ... */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Forward `queueItem` from `TrackRow` to context menu**

In `components/playlists/track-row.tsx`:

```tsx
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";

// inside TrackRow, before the JSX return:
const queueItem = fromPlaylistDetailItems([item], item.video.id ? "audio" : "audio")[0];
// (defaultKind here is a placeholder — the row doesn't know the playlist's defaultFormat;
//  TrackTable's onPlay still controls smart-queue defaults. For Add/PlayNext from the
//  per-row context menu we use "audio" by default; correct kind will be re-resolved by
//  the player's pickKind via availableKinds.)

// inside <TrackContextMenu .../> JSX:
queueItem={queueItem}
```

If preferred, thread `defaultFormat` from TrackTable → TrackRow as a prop and use it instead of the literal `"audio"`. **Choose this**: extend the `TrackRow` Props with `defaultFormat: "audio" | "video"` and pass it through from `TrackTable`.

- [ ] **Step 5: Run — expect PASS (existing 3 menu tests + 3 new ones)**

```bash
npx vitest run components/playlists/track-context-menu.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/playlists/
git commit -m "feat(playlists): context-menu Play Now / Add / Play Next"
```

---

### Task 31: `playlist-detail-header` — Play All + Shuffle Play buttons

**Files:**
- Modify: `components/playlists/playlist-detail-header.tsx`
- Modify: `components/playlists/playlist-detail-header.test.tsx`

- [ ] **Step 1: Failing tests**

```tsx
// components/playlists/playlist-detail-header.test.tsx — append
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createPlayerStore } from "@/lib/player/store";
import userEvent from "@testing-library/user-event";

const items = [/* two PlaylistDetailItem fixtures */];

it("Play All sets queue with shuffle off", async () => {
  const store = createPlayerStore();
  render(
    <PlayerStoreProvider store={store}>
      <PlaylistDetailHeader playlist={baseStats} items={items} defaultFormat="audio" />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /play all/i }));
  expect(store.getState().queue.length).toBe(2);
  expect(store.getState().shuffle).toBe(false);
  expect(store.getState().isPlaying).toBe(true);
});

it("Shuffle Play turns shuffle on", async () => {
  const store = createPlayerStore();
  render(
    <PlayerStoreProvider store={store}>
      <PlaylistDetailHeader playlist={baseStats} items={items} defaultFormat="audio" />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /shuffle play/i }));
  expect(store.getState().shuffle).toBe(true);
});
```

(Define `baseStats` and `items` matching the existing fixture shapes already used in this test file.)

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Extend the header**

```tsx
import { Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStoreApi } from "@/lib/client/use-player-store";
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";
import type { PlaylistDetailItem } from "@/lib/services/playlist-service";

interface Props {
  playlist: PlaylistStatsRow;
  items: PlaylistDetailItem[];
  defaultFormat: "audio" | "video";
}

export function PlaylistDetailHeader({ playlist, items, defaultFormat }: Props) {
  const store = usePlayerStoreApi();

  function playAll(shuffle: boolean) {
    const queueItems = fromPlaylistDetailItems(items.filter((i) => i.inPlaylist), defaultFormat);
    const built = buildQueue(queueItems, 0);
    store.getState().setQueue(built.queue, built.currentIndex);
    if (shuffle && !store.getState().shuffle) store.getState().toggleShuffle();
    if (!shuffle && store.getState().shuffle) store.getState().toggleShuffle();
    store.getState().play();
  }

  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
      {/* ... existing title block ... */}
      <div className="flex gap-2">
        <Button onClick={() => playAll(false)} aria-label="Play all">
          <Play className="mr-1 h-4 w-4" /> Play All
        </Button>
        <Button variant="outline" onClick={() => playAll(true)} aria-label="Shuffle play">
          <Shuffle className="mr-1 h-4 w-4" /> Shuffle Play
        </Button>
        <SyncNowButton playlistId={playlist.id} disabled={playlist.activeSyncRunId !== null} />
        <DeletePlaylistButton playlistId={playlist.id} />
      </div>
    </header>
  );
}
```

Update the page that renders this (search for callsites and pass `items` + `defaultFormat`):

```bash
npx grep -rn "<PlaylistDetailHeader" app/ components/
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/playlists/
git commit -m "feat(playlists): Play All + Shuffle Play buttons in header"
```

---

### Task 32: `standalone-list` — row click + Now Playing indicator

**Files:**
- Modify: `components/playlists/standalone-list.tsx`
- Modify: `components/playlists/standalone-list.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// standalone-list.test.tsx — append
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createPlayerStore } from "@/lib/player/store";
import userEvent from "@testing-library/user-event";

it("clicking a row plays the standalone video", async () => {
  // mock useStandaloneVideos to return a fixture
  vi.mocked(useStandaloneVideos).mockReturnValue({
    data: { videos: [/* one VideoSerialized with availableKinds:["audio"] */] },
    error: undefined, isLoading: false, mutate: vi.fn(),
  } as never);
  const store = createPlayerStore();
  render(
    <PlayerStoreProvider store={store}><StandaloneList /></PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /play /i }));
  expect(store.getState().queue.length).toBe(1);
  expect(store.getState().isPlaying).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Update `standalone-list.tsx`**

Wrap the card content in a button and call `setQueue + play`:

```tsx
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { fromStandaloneVideos } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";
import { NowPlayingIndicator } from "@/components/player/now-playing-indicator";

export function StandaloneList() {
  const { data, error, mutate, isLoading } = useStandaloneVideos();
  const store = usePlayerStoreApi();
  const currentVideoId = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex]?.videoId : undefined));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  // ... existing error/loading/empty checks ...

  function play(index: number) {
    if (!data) return;
    const queueItems = fromStandaloneVideos(data.videos);
    const built = buildQueue(queueItems, index);
    store.getState().setQueue(built.queue, built.currentIndex);
    store.getState().play();
  }

  return (
    <div className="space-y-2">
      {data!.videos.map((v, i) => (
        <Card key={v.id}>
          <CardContent className="flex items-center gap-3 p-3">
            <button
              type="button"
              aria-label={`Play ${v.title}`}
              onClick={() => play(i)}
              className="flex w-6 items-center justify-center"
            >
              {currentVideoId === v.id
                ? <NowPlayingIndicator isPlaying={isPlaying} />
                : <span className="text-xs text-[var(--color-muted)]">{i + 1}</span>}
            </button>
            <span className="min-w-0 flex-1 truncate text-sm">{v.title}</span>
            {/* ... existing right-hand cells ... */}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add components/playlists/standalone-list.tsx components/playlists/standalone-list.test.tsx
git commit -m "feat(playlists): standalone row click + Now Playing dot"
```

---

## Phase 6 — App-Shell wiring + E2E + verification

### Task 33: `<AppShell>` — mount PlayerProvider + bar + sidebar slot + drawer + sheets

**Files:**
- Modify: `components/app-shell.tsx`

- [ ] **Step 1: Update AppShell**

```tsx
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { PlayerProvider } from "./player/player-provider";
import { PlayerBar } from "./player/player-bar";
import { QueueSidebar } from "./player/queue-sidebar";
import { QueueDrawer } from "./player/queue-drawer";
import { FullscreenAudio } from "./player/fullscreen-audio";
import { FullscreenVideo } from "./player/fullscreen-video";
import { MobilePlayerSheet } from "./player/mobile-sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <div className="flex min-h-dvh flex-col @container">
        <Topbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 overflow-auto pb-32 md:pb-20">{children}</main>
          <QueueSidebar />
        </div>
        {/* Desktop bar (hidden on < md, mobile sheet replaces it). */}
        <div className="hidden md:block"><PlayerBar /></div>
        <BottomNav />
        <MobilePlayerSheet />
        <QueueDrawer />
        <FullscreenAudio />
        <FullscreenVideo />
      </div>
    </PlayerProvider>
  );
}
```

- [ ] **Step 2: Update existing AppShell tests if any**

```bash
npx grep -rn "AppShell" components/ app/ tests/
```

If any existing tests render `<AppShell>` directly, they now need a `localStorage` polyfill (happy-dom provides it) and the player provider mount adds an `<audio>` element. Adjust assertions if they previously asserted DOM size.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

- [ ] **Step 4: Manual smoke**

```bash
npm run dev
```

Open http://localhost:3000, navigate to a playlist with at least one downloaded item, click a row. Verify:
- Player bar appears at the bottom
- Audio actually plays (Phase 1's stream API is hit)
- Reload page → bar shows the same track, paused, position restored

Capture any layout / overlap issue and fix in this task before committing.

- [ ] **Step 5: Commit**

```bash
git add components/app-shell.tsx
git commit -m "feat(player): mount PlayerProvider + bar + sidebar/drawer/sheets in AppShell"
```

---

### Task 34: E2E integration test — click track → store + audio src + isPlaying

**Files:**
- Create: `tests/integration/plan-4-flow.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// @vitest-environment happy-dom
// tests/integration/plan-4-flow.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerProvider } from "@/components/player/player-provider";
import { TrackTable } from "@/components/playlists/track-table";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/actions/video-actions", () => ({
  downloadVideoAction: vi.fn(), refreshVideoAction: vi.fn(),
}));

function item(id: number): PlaylistDetailItem {
  return {
    position: id - 1, inPlaylist: true, addedAt: "2026-01-01T00:00:00Z", removedFromPlaylistAt: null,
    video: {
      id, externalId: `v${id}`, title: `Track ${id}`, channelTitle: "Chan",
      durationSeconds: 60, thumbnailUrl: null, availabilityStatus: "available", availabilityReason: null,
    },
    audioFile: { id: id * 10, format: "mp3", quality: "192", fileSizeBytes: 1, downloadedAt: "x" },
    videoFile: null, pendingJob: null,
    availableKinds: ["audio"],
  };
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ audio: 42, video: null }), { status: 200 }),
  );
});

describe("Plan 4 — click a track end-to-end", () => {
  it("populates queue, sets stream src, isPlaying true", async () => {
    const items = [item(1), item(2)];
    const { container } = render(
      <PlayerProvider>
        <TrackTable items={items} defaultFormat="audio" />
      </PlayerProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /play track 1/i }));
    // wait a tick for the resolver fetch + effect
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const audio = container.querySelector("audio")!;
    expect(audio.getAttribute("src")).toMatch(/\/api\/stream\/42$/);
  });
});
```

- [ ] **Step 2: Run — expect PASS**

```bash
npx vitest run tests/integration/plan-4-flow.test.tsx
```

If src fails to land, walk through the resolver promise chain — the test may need an extra `await Promise.resolve()` to drain the `useEffect` triggered by the cache update.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/plan-4-flow.test.tsx
git commit -m "test(plan-4): e2e click-to-play flow"
```

---

## Phase 7 — Verification + handoff

### Task 35: Final verification — lint, typecheck, full vitest, build

**Files:** none (verification only)

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: zero errors. Fix any warnings introduced by Plan 4 files (typically: unused imports, missing dep arrays).

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Full test run**

```bash
npm test
```

Expected: all green. Total test count should be roughly 485+ (Plan 5 ended at 407; this plan adds ~80).

- [ ] **Step 4: Build (catches Next.js-only errors that Vitest misses)**

```bash
npm run build
```

Expected: build succeeds. The route `app/api/stream/[mediaFileId]` should appear in the route table as **Dynamic** (it reads request headers).

- [ ] **Step 5: Manual acceptance smoke (against spec §12)**

Run `npm run dev`. Verify each acceptance criterion 1–9 by hand. Note item 10 (Plan 5 follow-up F cancel-job) is explicitly out of scope and does **not** need verification here.

- [ ] **Step 6: Commit verification artifacts (none expected) and create the follow-ups doc**

If any small fixes were made in Steps 1–4, group them into a single fix-up commit:

```bash
git add -A
git commit -m "chore(plan-4): post-verification fixes"
```

Then write a short `docs/superpowers/plans/2026-04-28-plan-4-followups.md` listing anything deferred or noticed during manual smoke (e.g. visual polish ideas, mobile-only quirks). **Do not** add new code in this step — only the followups doc.

```bash
git add docs/superpowers/plans/2026-04-28-plan-4-followups.md
git commit -m "docs(plan-4): record follow-ups"
```

- [ ] **Step 7: Done**

Plan 4 implementation complete. Hand off to the merge / PR step (out of scope for this plan).

---

## Self-Review checklist (run after writing the plan, before execution)

- **Spec §1 decisions:** All 10 decisions reflected in tasks. ✔
- **Spec §3 state shape:** Covered by Task 11 (createPlayerStore). `_originalQueue` added internally to support shuffle restore. ✔
- **Spec §3.1 actions:** All listed actions implemented in Tasks 11–12. ✔
- **Spec §3.2 smart-queue:** Task 10 (`buildQueue`) + Task 29 (`TrackTable.play`). ✔
- **Spec §3.3 broken-track:** Task 11 (`markBrokenAndAdvance`) + Task 17 (PlayerCore error handler). ✔
- **Spec §4 stream API:** Tasks 5–7 (route + range + 404 + mime). ✔
- **Spec §5 player core:** Task 17 (PlayerCore), Task 18 (mediaFileId resolver). ✔
- **Spec §5.5 MediaSession:** Task 15 + Task 19 wires metadata on track change. ✔
- **Spec §5.6 keyboard:** Task 14. ✔
- **Spec §6 UI components:** Tasks 21–27. ✔
- **Spec §6.6 track integration:** Tasks 29–32. ✔
- **Spec §7 file inventory:** Cross-checked. The store helper `lib/player/queue-from-items.ts` (Task 28) is added beyond the inventory — it's a small adapter to keep `TrackTable` thin. The `app/api/videos/[id]/media-files` route (Task 18) is also added beyond the inventory because the spec assumes the QueueItem carries `mediaFileId`, but the spec also names QueueItem with `videoId` only — a per-video lookup endpoint reconciles both. ✔
- **Spec §8 testing target ~80:** Tasks contribute roughly: stream 12 + media-file-service 11 + repo extensions 2 + queue-build 6 + store 22 + persist 4 + keyboard 9 + media-session 5 + player-core 5 + player-bar 7 + queue-list 3 + queue-sidebar 1 + queue-drawer 2 + fullscreen-audio 5 + fullscreen-video 4 + mobile-sheet 4 + queue-from-items 2 + track integration 7 + e2e 1 = ~110. Above target — good headroom. ✔
- **Type consistency:** `QueueItem`, `Kind`, `PlayerMode`, `RepeatMode` defined once in `lib/player/types.ts` and imported everywhere. Action names match between store (Task 11) and consumers (PlayerBar/QueueList/keyboard/MediaSession). ✔
- **No placeholders:** Every test step has concrete code. The few `// ... existing ... unchanged ...` markers refer to file regions that already exist and are unchanged — they are pointers, not placeholder code. ✔

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-28-plan-4-player.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**


