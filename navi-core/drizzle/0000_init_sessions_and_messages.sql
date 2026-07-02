CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`image_url` text,
	`tool_calls` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`context_summary` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
