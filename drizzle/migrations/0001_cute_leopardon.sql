ALTER TABLE `jobs` ADD `next_attempt_at` integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jobs_claim
  ON jobs (status, priority DESC, created_at ASC, next_attempt_at);