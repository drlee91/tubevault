import type { JobHandler, JobRow, JobType } from "./types";

export interface QueueLike {
  claim(): Promise<JobRow | null>;
  complete(id: number): Promise<void>;
  fail(id: number, error: string, transient: boolean): Promise<void>;
}

export interface WorkerPoolOptions {
  maxConcurrency: number;
  pollIntervalMs?: number;
}

export class WorkerPool {
  private running = new Set<Promise<void>>();
  private stopped = false;
  private pollHandle: NodeJS.Timeout | null = null;
  private dispatching = false;

  constructor(
    private readonly queue: QueueLike,
    private readonly handlers: Map<JobType, JobHandler>,
    private readonly opts: WorkerPoolOptions,
  ) {}

  start(): void {
    if (this.pollHandle) return;
    this.stopped = false;
    this.pollHandle = setInterval(() => { void this.dispatch(); }, this.opts.pollIntervalMs ?? 30_000);
    void this.dispatch();
  }

  signal(): void {
    void this.dispatch();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
    await Promise.all(this.running);
  }

  private async dispatch(): Promise<void> {
    if (this.dispatching || this.stopped) return;
    this.dispatching = true;
    try {
      while (!this.stopped && this.running.size < this.opts.maxConcurrency) {
        const job = await this.queue.claim();
        if (!job) return;
        const handler = this.handlers.get(job.type as JobType);
        if (!handler) {
          await this.queue.fail(job.id, `no handler for type ${job.type}`, false);
          continue;
        }
        const promise = (async () => {
          try {
            const result = await handler.handle(job);
            if (result.success) {
              await this.queue.complete(job.id);
            } else {
              await this.queue.fail(job.id, result.error ?? "unknown", result.transient ?? true);
            }
          } catch (err) {
            await this.queue.fail(job.id, err instanceof Error ? err.message : String(err), true);
          }
        })();
        const tracked = promise.finally(() => {
          this.running.delete(tracked);
          if (!this.stopped) void this.dispatch();
        });
        this.running.add(tracked);
      }
    } finally {
      this.dispatching = false;
    }
  }
}
