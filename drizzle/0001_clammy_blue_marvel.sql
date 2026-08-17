CREATE TABLE `auth_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `estimate_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`estimateId` int NOT NULL,
	`pricingRuleId` int,
	`productKey` varchar(48) NOT NULL,
	`productName` varchar(80) NOT NULL,
	`places` varchar(32) NOT NULL,
	`itemType` varchar(64) NOT NULL,
	`fabric` varchar(64) NOT NULL,
	`dirtLevel` enum('leve','medio','pesado') NOT NULL,
	`dirtSurcharge` int NOT NULL,
	`service` enum('lavagem','impermeabilizacao') NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`lineTotal` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `estimate_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estimates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`customerPhone` varchar(32) NOT NULL,
	`customerAddress` text NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`status` enum('draft','sent') NOT NULL DEFAULT 'sent',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estimates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productKey` varchar(48) NOT NULL,
	`productName` varchar(80) NOT NULL,
	`places` varchar(32) NOT NULL,
	`itemType` varchar(64) NOT NULL,
	`fabric` varchar(64) NOT NULL,
	`washPrice` decimal(10,2) NOT NULL,
	`waterproofPrice` decimal(10,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_rules_variant_unique` UNIQUE(`productKey`,`places`,`itemType`,`fabric`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(160);--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_open_id_unique` UNIQUE(`openId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `estimate_items_estimate_idx` ON `estimate_items` (`estimateId`);--> statement-breakpoint
CREATE INDEX `estimates_customer_idx` ON `estimates` (`customerName`);--> statement-breakpoint
CREATE INDEX `estimates_schedule_idx` ON `estimates` (`scheduledAt`);--> statement-breakpoint
CREATE INDEX `estimates_creator_idx` ON `estimates` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `pricing_rules_product_idx` ON `pricing_rules` (`productKey`);