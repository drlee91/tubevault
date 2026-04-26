import { describe, it, expect, vi } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { JobQueue } from "./queue";

function buildQueue() {
  const { db, sqlite } = createTestDb();
  const repo = new JobRepo(db);
  const queue = new JobQueue(db, repo);
  return { db, sqlite, repo, queue };
}

describe("JobQueue", () => {
  it("enqueue inserts and signals attached worker", async () => {
    const { queue, sqlite } = buildQueue();
    try {
      const signal = vi.fn();
      queue.attachWorker({ signal });
      await queue.enqueue("sync_playlist", { playlistId: 1 });
      expect(signal).toHaveBeenCalled();
    } finally {
      sqlite.close();
    }
  });

  it("claim returns the highest-priority queued job and marks it running", async () => {
    const { queue, repo, sqlite } = buildQueue();
    try {
      await queue.enqueue("sync_playlist", { playlistId: 1 }, { priority: 1 });
      const hi = await queue.enqueue("sync_playlist", { playlistId: 2 }, { priority: 10 });
      const job = await queue.claim();
      expect(job?.id).toBe(hi);
      expect(repo.byId(hi)!.status).toBe("running");
      expect(repo.byId(hi)!.attempts).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it("claim returns null when nothing is queued", async () => {
    const { queue, sqlite } = buildQueue();
    try {
      expect(await queue.claim()).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("complete marks the job completed", async () => {
    const { queue, repo, sqlite } = buildQueue();
    try {
      const id = await queue.enqueue("sync_playlist", { playlistId: 1 });
      await queue.claim();
      await queue.complete(id);
      expect(repo.byId(id)!.status).toBe("completed");
      expect(repo.byId(id)!.finishedAt).not.toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("fail with transient + remaining attempts re-queues with backoff", async () => {
    const { queue, repo, sqlite } = buildQueue();
    try {
      const id = await queue.enqueue("sync_playlist", { playlistId: 1 });
      await queue.claim();
      await queue.fail(id, "network", true);
      const row = repo.byId(id)!;
      expect(row.status).toBe("queued");
      expect(row.lastError).toBe("network");
      expect(row.nextAttemptAt).not.toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("fail with non-transient marks failed permanently", async () => {
    const { queue, repo, sqlite } = buildQueue();
    try {
      const id = await queue.enqueue("sync_playlist", { playlistId: 1 });
      await queue.claim();
      await queue.fail(id, "removed", false);
      expect(repo.byId(id)!.status).toBe("failed");
    } finally {
      sqlite.close();
    }
  });

  it("fail after max_attempts marks failed", async () => {
    const { queue, repo, sqlite } = buildQueue();
    try {
      const id = await queue.enqueue("sync_playlist", { playlistId: 1 }, { maxAttempts: 1 });
      await queue.claim();
      await queue.fail(id, "boom", true);
      expect(repo.byId(id)!.status).toBe("failed");
    } finally {
      sqlite.close();
    }
  });

  it("resetStaleRunning flips running→queued for crash recovery", async () => {
    const { queue, repo, sqlite } = buildQueue();
    try {
      const id = await queue.enqueue("sync_playlist", { playlistId: 1 });
      await queue.claim();
      expect(repo.byId(id)!.status).toBe("running");
      await queue.resetStaleRunning();
      expect(repo.byId(id)!.status).toBe("queued");
    } finally {
      sqlite.close();
    }
  });

  it("claim skips jobs whose nextAttemptAt is in the future", async () => {
    const { queue, sqlite } = buildQueue();
    try {
      const id = await queue.enqueue("sync_playlist", { playlistId: 1 });
      sqlite.prepare("UPDATE jobs SET next_attempt_at = ? WHERE id = ?")
        .run(Math.floor((Date.now() + 60_000) / 1000), id);
      expect(await queue.claim()).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
