CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`habit_definition_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`habit_definition_id`) REFERENCES `habit_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entry_custom_data` (
	`entry_id` integer PRIMARY KEY NOT NULL,
	`number` real,
	`amount` real,
	`duration` integer,
	`binary` integer,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entry_workout_data` (
	`entry_id` integer PRIMARY KEY NOT NULL,
	`duration` integer NOT NULL,
	`distance` real,
	`weight` real,
	`amount` real,
	`notes` text,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `entry_writing_data` (
	`entry_id` integer PRIMARY KEY NOT NULL,
	`words` integer NOT NULL,
	`time` integer,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
