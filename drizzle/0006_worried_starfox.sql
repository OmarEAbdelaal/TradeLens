CREATE TABLE `ai_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`kind` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`subject` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	`prompt` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_history_user_created` ON `ai_history` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `ai_selections` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`history_id` text NOT NULL
);
