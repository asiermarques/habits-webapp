CREATE TABLE `applied_idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`entry_id` integer,
	`response_body` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
