CREATE TABLE `simulation_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_simulation_archives_user` ON `simulation_archives` (`user_id`,`market`,`currency`);