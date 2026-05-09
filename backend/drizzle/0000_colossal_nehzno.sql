CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
