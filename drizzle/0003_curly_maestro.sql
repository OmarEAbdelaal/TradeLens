CREATE TABLE `user_price_history` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
