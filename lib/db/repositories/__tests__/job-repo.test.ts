import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { JobRepo } from "../job-repo";

describe("JobRepo", () => {
  it("inserts a job with default priority and max_attempts", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new JobRepo(db);
      const id = repo.insert({ type: "sync_playlist", payload: { playlistId: 1 } });
      const row = repo.byId(id)!;
      expect(row.type).toBe("sync_playlist");
      expect(row.status).toBe("queued");
      expect(row.priority).toBe(0);
      expect(row.maxAttempts).toBe(3);
      expect(row.attempts).toBe(0);
    } finally {
      sqlite.close();
    }
  });

  it("countByStatus groups counts per status", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new JobRepo(db);
      repo.insert({ type: "sync_playlist", payload: {} });
      repo.insert({ type: "sync_playlist", payload: {} });
      expect(repo.countByStatus()).toMatchObject({ queued: 2 });
    } finally {
      sqlite.close();
    }
  });
});
