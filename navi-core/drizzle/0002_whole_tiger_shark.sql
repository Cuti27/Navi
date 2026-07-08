CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`content` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memories_file_path_unique` ON `memories` (`file_path`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_compacted_message_id` text;