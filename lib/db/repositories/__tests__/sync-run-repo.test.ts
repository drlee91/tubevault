import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "../playlist-repo";
import { SyncRunRepo } from "../sync-run-repo";

describe("SyncRunRepo", () => {
  it("starts a run and finishes it with stats", () => {
    const { db, sqlite } = createTestDb();
    try {
      const pid = new PlaylistRepo(db).create({
        provider: "youtube",
        externalId: "PL",
        url: "u",
        defaultFormat: "audio",
      });
      const repo = new SyncRunRepo(db);
      const id = repo.startRun({ playlistId: pid, triggeredBy: "manual" });
      repo.finishRun(id, {
        status: "success",
        stats: { added: 1, removed: 0, unchanged: 0, unavailable: 0 },
        errorLog: [],
      });
      const row = repo.byId(id)!;
      expect(row.status).toBe("success");
      expect(row.videosAdded).toBe(1);
      expect(row.finishedAt).not.toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("findRunning returns the active run if any", () => {
    const { db, sqlite } = createTestDb();
    try {
      const pid = new PlaylistRepo(db).create({
        provider: "youtube",
        externalId: "PL",
        url: "u",
        defaultFormat: "audio",
      });
      const repo = new SyncRunRepo(db);
      const id = repo.startRun({ playlistId: pid, triggeredBy: "manual" });
      expect(repo.findRunning(pid)?.id).toBe(id);
      repo.finishRun(id, {
        status: "success",
        stats: { added: 0, removed: 0, unchanged: 0, unavailable: 0 },
        errorLog: [],
      });
      expect(repo.findRunning(pid)).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
