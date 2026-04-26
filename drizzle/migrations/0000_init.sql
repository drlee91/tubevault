CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `jobs_status_priority_idx` ON `jobs` (`status`,`priority`);--> statement-breakpoint
CREATE TABLE `media_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`kind` text NOT NULL,
	`file_path` text NOT NULL,
	`format` text NOT NULL,
	`quality` text,
	`file_size_bytes` integer,
	`duration_seconds` integer,
	`checksum` text,
	`downloaded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_files_video_kind_uq` ON `media_files` (`video_id`,`kind`);--> statement-breakpoint
CREATE TABLE `playlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer NOT NULL,
	`video_id` integer NOT NULL,
	`position` integer NOT NULL,
	`in_playlist` integer DEFAULT true NOT NULL,
	`removed_from_playlist_at` integer,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_items_playlist_video_uq` ON `playlist_items` (`playlist_id`,`video_id`);--> statement-breakpoint
CREATE INDEX `playlist_items_playlist_idx` ON `playlist_items` (`playlist_id`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`channel_title` text,
	`url` text NOT NULL,
	`default_format` text DEFAULT 'audio' NOT NULL,
	`format_overrides` text,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`sync_schedule_cron` text,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_provider_external_id_uq` ON `playlists` (`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	`status` text DEFAULT 'running' NOT NULL,
	`videos_added` integer DEFAULT 0 NOT NULL,
	`videos_removed` integer DEFAULT 0 NOT NULL,
	`videos_unavailable` integer DEFAULT 0 NOT NULL,
	`videos_downloaded` integer DEFAULT 0 NOT NULL,
	`error_log` text,
	`triggered_by` text DEFAULT 'manual' NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`channel_title` text,
	`channel_id` text,
	`duration_seconds` integer,
	`thumbnail_url` text,
	`availability_status` text DEFAULT 'unknown' NOT NULL,
	`availability_reason` text,
	`availability_changed_at` integer,
	`first_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_provider_external_id_uq` ON `videos` (`provider`,`external_id`);--> statement-breakpoint
CREATE INDEX `videos_availability_status_idx` ON `videos` (`availability_status`);