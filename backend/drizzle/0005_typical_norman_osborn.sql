ALTER TABLE `habit_definitions` ADD `user_id` integer REFERENCES users(id) ON DELETE cascade;--> statement-breakpoint
UPDATE `habit_definitions` SET `user_id` = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE `user_id` IS NULL;
