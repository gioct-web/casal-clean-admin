ALTER TABLE `estimates` ADD `customerCity` varchar(160);--> statement-breakpoint
ALTER TABLE `estimates` ADD `customerCity` varchar(160);--> statement-breakpoint
ALTER TABLE `estimates` ADD `customerState` varchar(2);--> statement-breakpoint
CREATE INDEX `estimates_identifier_idx` ON `estimates` (`id`);
