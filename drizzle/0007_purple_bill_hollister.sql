CREATE TABLE `provider_price_history` (
	`key` text PRIMARY KEY NOT NULL,
	`market` text NOT NULL,
	`symbol` text NOT NULL,
	`currency` text NOT NULL,
	`provider_id` integer NOT NULL,
	`source` text NOT NULL,
	`data` text NOT NULL,
	`fetched_through` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_provider_history_market_symbol` ON `provider_price_history` (`market`,`symbol`);