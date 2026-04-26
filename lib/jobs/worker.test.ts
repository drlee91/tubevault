import { describe, it, expect, vi } from "vitest";
import { WorkerPool } from "./worker";
import type { JobHandler, JobRow, JobType } from "./types";

function makeQueue(jobs: Array<Partial<JobRow> & { type: JobType }>) {
  const q = [...jobs].map((j, i) => ({ ...j, id: i + 1 } as JobRow));
  return {
    claim: vi.fn(async () => q.shift() ?? null),
    complete: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
  };
}

describe("WorkerPool", () => {
  it("dispatches a job to the matching handler and calls complete on success", async () => {
    const queue = makeQueue([{ type: "sync_playlist", payload: {} }]);
    const handle = vi.fn(async () => ({ success: true }));
    const handlers = new Map<JobType, JobHandler>([["sync_playlist", { handle }]]);
    const pool = new WorkerPool(queue, handlers, { maxConcurrency: 1, pollIntervalMs: 60_000 });
    pool.start();
    pool.signal();
    await new Promise((r) => setTimeout(r, 10));
    await pool.stop();
    expect(handle).toHaveBeenCalledTimes(1);
    expect(queue.complete).toHaveBeenCalledWith(1);
  });

  it("calls fail with handler-provided transient flag when handler reports failure", async () => {
    const queue = makeQueue([{ type: "sync_playlist", payload: {} }]);
    const handle = vi.fn(async () => ({ success: false, error: "boom", transient: true }));
    const handlers = new Map<JobType, JobHandler>([["sync_playlist", { handle }]]);
    const pool = new WorkerPool(queue, handlers, { maxConcurrency: 1, pollIntervalMs: 60_000 });
    pool.start();
    pool.signal();
    await new Promise((r) => setTimeout(r, 10));
    await pool.stop();
    expect(queue.fail).toHaveBeenCalledWith(1, "boom", true);
  });

  it("calls fail when handler throws (treated as transient)", async () => {
    const queue = makeQueue([{ type: "sync_playlist", payload: {} }]);
    const handle = vi.fn(async () => { throw new Error("crash"); });
    const handlers = new Map<JobType, JobHandler>([["sync_playlist", { handle }]]);
    const pool = new WorkerPool(queue, handlers, { maxConcurrency: 1, pollIntervalMs: 60_000 });
    pool.start();
    pool.signal();
    await new Promise((r) => setTimeout(r, 10));
    await pool.stop();
    expect(queue.fail).toHaveBeenCalledWith(1, "crash", true);
  });

  it("respects maxConcurrency", async () => {
    const queue = makeQueue([
      { type: "sync_playlist", payload: {} },
      { type: "sync_playlist", payload: {} },
      { type: "sync_playlist", payload: {} },
    ]);
    let inFlight = 0;
    let peak = 0;
    const handle = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { success: true };
    });
    const handlers = new Map<JobType, JobHandler>([["sync_playlist", { handle }]]);
    const pool = new WorkerPool(queue, handlers, { maxConcurrency: 2, pollIntervalMs: 60_000 });
    pool.start();
    pool.signal();
    await new Promise((r) => setTimeout(r, 50));
    await pool.stop();
    expect(peak).toBeLessThanOrEqual(2);
  });
});
