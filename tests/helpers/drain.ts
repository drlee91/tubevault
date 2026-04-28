/**
 * drainQueue — processes all queued jobs in a TestBootContext synchronously
 * by claiming each job, running the appropriate handler, and marking it
 * complete or failed. Requires the context to have been created with
 * `withHandlers: true`.
 *
 * The loop exits when no queued job is available. A max-iteration safety
 * prevents infinite loops (e.g. jobs that keep re-queuing themselves).
 */

import { SyncPlaylistHandler } from "@/lib/jobs/handlers/sync-playlist";
import { DownloadVideoHandler } from "@/lib/jobs/handlers/download-video";
import type { TestBootContext } from "@/lib/test-utils/boot-test-context";
import type { JobHandler, JobType } from "@/lib/jobs/types";

export async function drainQueue(
  ctx: TestBootContext,
  maxIterations = 50,
): Promise<void> {
  const handlers = new Map<JobType, JobHandler>([
    ["sync_playlist", new SyncPlaylistHandler(ctx.syncService)],
    ["download_video", new DownloadVideoHandler(ctx.downloadService, ctx.videoRepo)],
  ]);

  for (let i = 0; i < maxIterations; i++) {
    const job = await ctx.queue.claim();
    if (!job) return; // queue is empty — we are done

    const handler = handlers.get(job.type as JobType);
    if (!handler) {
      await ctx.queue.fail(job.id, `drainQueue: no handler for type ${job.type}`, false);
      continue;
    }

    try {
      const result = await handler.handle(job);
      if (result.success) {
        await ctx.queue.complete(job.id);
      } else {
        await ctx.queue.fail(
          job.id,
          result.error ?? "handler returned failure",
          result.transient ?? false,
        );
      }
    } catch (err) {
      await ctx.queue.fail(
        job.id,
        err instanceof Error ? err.message : String(err),
        false,
      );
    }
  }

  throw new Error(
    `drainQueue: queue did not empty within ${maxIterations} iterations — possible infinite loop`,
  );
}
