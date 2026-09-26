CREATE TABLE `exchange_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`market` text NOT NULL,
	`generation` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exchange_cache_market` ON `exchange_cache` (`market`);--> statement-breakpoint
CREATE TABLE `exchange_history` (
	`key` text PRIMARY KEY NOT NULL,
	`market` text NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exchange_history_market_date` ON `exchange_history` (`market`,`date`);--> statement-breakpoint
CREATE TABLE `market_accounts` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
