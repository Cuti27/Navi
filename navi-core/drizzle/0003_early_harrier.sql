CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`media_type` text NOT NULL,
	`file_name` text,
	`size` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
