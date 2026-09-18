PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_active_battles` (
	`battle_id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text NOT NULL,
	`battle_type` text NOT NULL,
	`mob_id` integer NOT NULL,
	`enemy_level` integer,
	`player_hp` integer NOT NULL,
	`player_max_hp` integer NOT NULL,
	`enemy_hp` integer NOT NULL,
	`enemy_max_hp` integer NOT NULL,
	`current_turn` integer DEFAULT 1 NOT NULL,
	`player_goes_first` integer NOT NULL,
	`active_debuffs` text NOT NULL,
	`battle_log` text NOT NULL,
	`overcharge_pct` integer DEFAULT 0 NOT NULL,
	`bleed_stacks` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mob_id`) REFERENCES `mob_roster`(`mob_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_active_battles`("battle_id", "discord_id", "channel_id", "message_id", "battle_type", "mob_id", "enemy_level", "player_hp", "player_max_hp", "enemy_hp", "enemy_max_hp", "current_turn", "player_goes_first", "active_debuffs", "battle_log", "overcharge_pct", "bleed_stacks", "started_at") SELECT "battle_id", "discord_id", "channel_id", "message_id", "battle_type", "mob_id", "enemy_level", "player_hp", "player_max_hp", "enemy_hp", "enemy_max_hp", "current_turn", "player_goes_first", "active_debuffs", "battle_log", "overcharge_pct", "bleed_stacks", "started_at" FROM `active_battles`;--> statement-breakpoint
DROP TABLE `active_battles`;--> statement-breakpoint
ALTER TABLE `__new_active_battles` RENAME TO `active_battles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `active_battles_unique_0` ON `active_battles` (`discord_id`);--> statement-breakpoint
CREATE TABLE `__new_active_casino_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`game` text NOT NULL,
	`status` text NOT NULL,
	`bet_amount` integer NOT NULL,
	`balance_before` integer NOT NULL,
	`balance_after_debit` integer NOT NULL,
	`payout` integer,
	`balance_after` integer,
	`channel_id` text,
	`message_id` text,
	`state_json` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_active_casino_sessions`("session_id", "discord_id", "game", "status", "bet_amount", "balance_before", "balance_after_debit", "payout", "balance_after", "channel_id", "message_id", "state_json", "metadata", "created_at", "updated_at", "expires_at") SELECT "session_id", "discord_id", "game", "status", "bet_amount", "balance_before", "balance_after_debit", "payout", "balance_after", "channel_id", "message_id", "state_json", "metadata", "created_at", "updated_at", "expires_at" FROM `active_casino_sessions`;--> statement-breakpoint
DROP TABLE `active_casino_sessions`;--> statement-breakpoint
ALTER TABLE `__new_active_casino_sessions` RENAME TO `active_casino_sessions`;--> statement-breakpoint
CREATE TABLE `__new_active_duel_participants` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`duel_id` text NOT NULL,
	`lock_token` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`duel_id`) REFERENCES `active_duels`(`duel_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_active_duel_participants`("discord_id", "duel_id", "lock_token", "role", "expires_at") SELECT "discord_id", "duel_id", "lock_token", "role", "expires_at" FROM `active_duel_participants`;--> statement-breakpoint
DROP TABLE `active_duel_participants`;--> statement-breakpoint
ALTER TABLE `__new_active_duel_participants` RENAME TO `active_duel_participants`;--> statement-breakpoint
CREATE TABLE `__new_boss_attack_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`boss_spawn_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`discord_id` text NOT NULL,
	`mob_id` integer NOT NULL,
	`total_damage` integer DEFAULT 0 NOT NULL,
	`attacked_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_daily_reset` text NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_boss_attack_log`("id", "boss_spawn_id", "guild_id", "discord_id", "mob_id", "total_damage", "attacked_at", "last_daily_reset") SELECT "id", "boss_spawn_id", "guild_id", "discord_id", "mob_id", "total_damage", "attacked_at", "last_daily_reset" FROM `boss_attack_log`;--> statement-breakpoint
DROP TABLE `boss_attack_log`;--> statement-breakpoint
ALTER TABLE `__new_boss_attack_log` RENAME TO `boss_attack_log`;--> statement-breakpoint
CREATE UNIQUE INDEX `boss_attack_log_unique_0` ON `boss_attack_log` (`boss_spawn_id`,`discord_id`);--> statement-breakpoint
CREATE TABLE `__new_boss_state` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`spawn_id` text NOT NULL,
	`mob_id` integer NOT NULL,
	`boss_level` integer,
	`max_hp` integer NOT NULL,
	`current_hp` integer NOT NULL,
	`scaled_atk` integer NOT NULL,
	`scaled_def` integer NOT NULL,
	`spawn_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`spawn_source` text NOT NULL,
	`last_attack_at` integer,
	`passive_state` text,
	FOREIGN KEY (`mob_id`) REFERENCES `mob_roster`(`mob_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_boss_state`("guild_id", "spawn_id", "mob_id", "boss_level", "max_hp", "current_hp", "scaled_atk", "scaled_def", "spawn_at", "expires_at", "status", "spawn_source", "last_attack_at", "passive_state") SELECT "guild_id", "spawn_id", "mob_id", "boss_level", "max_hp", "current_hp", "scaled_atk", "scaled_def", "spawn_at", "expires_at", "status", "spawn_source", "last_attack_at", "passive_state" FROM `boss_state`;--> statement-breakpoint
DROP TABLE `boss_state`;--> statement-breakpoint
ALTER TABLE `__new_boss_state` RENAME TO `boss_state`;--> statement-breakpoint
CREATE TABLE `__new_daily_quest_completion_rewards` (
	`discord_id` text NOT NULL,
	`quest_date` text NOT NULL,
	`sacred_relics` integer DEFAULT 1 NOT NULL,
	`claimed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `quest_date`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_daily_quest_completion_rewards`("discord_id", "quest_date", "sacred_relics", "claimed_at") SELECT "discord_id", "quest_date", "sacred_relics", "claimed_at" FROM `daily_quest_completion_rewards`;--> statement-breakpoint
DROP TABLE `daily_quest_completion_rewards`;--> statement-breakpoint
ALTER TABLE `__new_daily_quest_completion_rewards` RENAME TO `daily_quest_completion_rewards`;--> statement-breakpoint
CREATE TABLE `__new_daily_quests` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`quest_type` text NOT NULL,
	`target_count` integer NOT NULL,
	`current_count` integer DEFAULT 0 NOT NULL,
	`reward_credux` integer NOT NULL,
	`reward_belief_shards` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`quest_date` text NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_daily_quests`("id", "discord_id", "quest_type", "target_count", "current_count", "reward_credux", "reward_belief_shards", "completed", "quest_date") SELECT "id", "discord_id", "quest_type", "target_count", "current_count", "reward_credux", "reward_belief_shards", "completed", "quest_date" FROM `daily_quests`;--> statement-breakpoint
DROP TABLE `daily_quests`;--> statement-breakpoint
ALTER TABLE `__new_daily_quests` RENAME TO `daily_quests`;--> statement-breakpoint
CREATE UNIQUE INDEX `daily_quests_unique_0` ON `daily_quests` (`discord_id`,`quest_type`,`quest_date`);--> statement-breakpoint
CREATE TABLE `__new_equipped_skins` (
	`discord_id` text NOT NULL,
	`category` text NOT NULL,
	`cosmetic_id` integer,
	`override_path` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `category`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cosmetic_id`) REFERENCES `cosmetic_catalog`(`cosmetic_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_equipped_skins`("discord_id", "category", "cosmetic_id", "override_path", "updated_at") SELECT "discord_id", "category", "cosmetic_id", "override_path", "updated_at" FROM `equipped_skins`;--> statement-breakpoint
DROP TABLE `equipped_skins`;--> statement-breakpoint
ALTER TABLE `__new_equipped_skins` RENAME TO `equipped_skins`;--> statement-breakpoint
CREATE TABLE `__new_pity_counters` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`pity_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pity_counters`("discord_id", "pity_count") SELECT "discord_id", "pity_count" FROM `pity_counters`;--> statement-breakpoint
DROP TABLE `pity_counters`;--> statement-breakpoint
ALTER TABLE `__new_pity_counters` RENAME TO `pity_counters`;--> statement-breakpoint
CREATE TABLE `__new_pvp_shop_purchases` (
	`discord_id` text NOT NULL,
	`season_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`discord_id`, `season_id`, `item_key`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pvp_shop_purchases`("discord_id", "season_id", "item_key", "qty") SELECT "discord_id", "season_id", "item_key", "qty" FROM `pvp_shop_purchases`;--> statement-breakpoint
DROP TABLE `pvp_shop_purchases`;--> statement-breakpoint
ALTER TABLE `__new_pvp_shop_purchases` RENAME TO `pvp_shop_purchases`;--> statement-breakpoint
CREATE TABLE `__new_raid_reward_daily_totals` (
	`discord_id` text NOT NULL,
	`reward_date` text NOT NULL,
	`silver_chests` integer DEFAULT 0 NOT NULL,
	`gold_chests` integer DEFAULT 0 NOT NULL,
	`belief_shards` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`discord_id`, `reward_date`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_raid_reward_daily_totals`("discord_id", "reward_date", "silver_chests", "gold_chests", "belief_shards") SELECT "discord_id", "reward_date", "silver_chests", "gold_chests", "belief_shards" FROM `raid_reward_daily_totals`;--> statement-breakpoint
DROP TABLE `raid_reward_daily_totals`;--> statement-breakpoint
ALTER TABLE `__new_raid_reward_daily_totals` RENAME TO `raid_reward_daily_totals`;--> statement-breakpoint
CREATE TABLE `__new_raid_reward_grants` (
	`reward_key` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`reward` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_raid_reward_grants`("reward_key", "discord_id", "reward", "created_at") SELECT "reward_key", "discord_id", "reward", "created_at" FROM `raid_reward_grants`;--> statement-breakpoint
DROP TABLE `raid_reward_grants`;--> statement-breakpoint
ALTER TABLE `__new_raid_reward_grants` RENAME TO `raid_reward_grants`;--> statement-breakpoint
CREATE TABLE `__new_ranked_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`result` text NOT NULL,
	`rating_before` integer NOT NULL,
	`rating_after` integer NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_ranked_logs`("id", "player_id", "opponent_id", "result", "rating_before", "rating_after", "timestamp") SELECT "id", "player_id", "opponent_id", "result", "rating_before", "rating_after", "timestamp" FROM `ranked_logs`;--> statement-breakpoint
DROP TABLE `ranked_logs`;--> statement-breakpoint
ALTER TABLE `__new_ranked_logs` RENAME TO `ranked_logs`;--> statement-breakpoint
CREATE TABLE `__new_seasons` (
	`season_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`theme` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`featured_deity_id` integer,
	`is_active` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`featured_deity_id`) REFERENCES `deity_roster`(`deity_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_seasons`("season_id", "name", "theme", "starts_at", "ends_at", "featured_deity_id", "is_active") SELECT "season_id", "name", "theme", "starts_at", "ends_at", "featured_deity_id", "is_active" FROM `seasons`;--> statement-breakpoint
DROP TABLE `seasons`;--> statement-breakpoint
ALTER TABLE `__new_seasons` RENAME TO `seasons`;--> statement-breakpoint
CREATE TABLE `__new_summon_reward_grants` (
	`reward_key` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_summon_reward_grants`("reward_key", "discord_id", "source", "created_at") SELECT "reward_key", "discord_id", "source", "created_at" FROM `summon_reward_grants`;--> statement-breakpoint
DROP TABLE `summon_reward_grants`;--> statement-breakpoint
ALTER TABLE `__new_summon_reward_grants` RENAME TO `summon_reward_grants`;--> statement-breakpoint
CREATE TABLE `__new_supporter_item_grants` (
	`grant_id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`item_key` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`grant_reason` text NOT NULL,
	`grant_ref` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_supporter_item_grants`("grant_id", "discord_id", "item_key", "quantity", "grant_reason", "grant_ref", "created_at") SELECT "grant_id", "discord_id", "item_key", "quantity", "grant_reason", "grant_ref", "created_at" FROM `supporter_item_grants`;--> statement-breakpoint
DROP TABLE `supporter_item_grants`;--> statement-breakpoint
ALTER TABLE `__new_supporter_item_grants` RENAME TO `supporter_item_grants`;--> statement-breakpoint
CREATE UNIQUE INDEX `supporter_item_grants_unique_0` ON `supporter_item_grants` (`discord_id`,`item_key`,`grant_reason`,`grant_ref`);--> statement-breakpoint
CREATE TABLE `__new_supporter_token_ledger` (
	`entry_id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_supporter_token_ledger`("entry_id", "discord_id", "delta", "reason", "ref", "created_at") SELECT "entry_id", "discord_id", "delta", "reason", "ref", "created_at" FROM `supporter_token_ledger`;--> statement-breakpoint
DROP TABLE `supporter_token_ledger`;--> statement-breakpoint
ALTER TABLE `__new_supporter_token_ledger` RENAME TO `supporter_token_ledger`;--> statement-breakpoint
CREATE TABLE `__new_supporters` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`tier` text NOT NULL,
	`status` text NOT NULL,
	`current_period_end` integer,
	`founder_number` integer,
	`founder_purchased_at` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`token_balance` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`founding_supporter` integer DEFAULT false NOT NULL,
	`granted_by` text,
	`subscribed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_supporters`("discord_id", "tier", "status", "current_period_end", "founder_number", "founder_purchased_at", "cancel_at_period_end", "token_balance", "created_at", "updated_at", "active", "founding_supporter", "granted_by", "subscribed_at", "expires_at") SELECT "discord_id", "tier", "status", "current_period_end", "founder_number", "founder_purchased_at", "cancel_at_period_end", "token_balance", "created_at", "updated_at", "active", "founding_supporter", "granted_by", "subscribed_at", "expires_at" FROM `supporters`;--> statement-breakpoint
DROP TABLE `supporters`;--> statement-breakpoint
ALTER TABLE `__new_supporters` RENAME TO `supporters`;--> statement-breakpoint
CREATE UNIQUE INDEX `supporters_unique_0` ON `supporters` (`founder_number`);--> statement-breakpoint
CREATE TABLE `__new_tickets` (
	`ticket_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`completed_by` text,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tickets`("ticket_id", "type", "user_id", "status", "created_at", "updated_at", "completed_at", "completed_by", "notes") SELECT "ticket_id", "type", "user_id", "status", "created_at", "updated_at", "completed_at", "completed_by", "notes" FROM `tickets`;--> statement-breakpoint
DROP TABLE `tickets`;--> statement-breakpoint
ALTER TABLE `__new_tickets` RENAME TO `tickets`;--> statement-breakpoint
CREATE TABLE `__new_user_armors` (
	`discord_id` text NOT NULL,
	`armor_id` text PRIMARY KEY NOT NULL,
	`armor_roster_id` integer NOT NULL,
	`curr_hp` integer NOT NULL,
	`curr_def` integer NOT NULL,
	`enhancement` integer DEFAULT 1 NOT NULL,
	`base_hp` integer NOT NULL,
	`base_def` integer NOT NULL,
	`native_sockets` text NOT NULL,
	`opposite_sockets` text NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`obtained_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`armor_roster_id`) REFERENCES `armor_roster`(`armor_roster_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_armors`("discord_id", "armor_id", "armor_roster_id", "curr_hp", "curr_def", "enhancement", "base_hp", "base_def", "native_sockets", "opposite_sockets", "is_locked", "obtained_at") SELECT "discord_id", "armor_id", "armor_roster_id", "curr_hp", "curr_def", "enhancement", "base_hp", "base_def", "native_sockets", "opposite_sockets", "is_locked", "obtained_at" FROM `user_armors`;--> statement-breakpoint
DROP TABLE `user_armors`;--> statement-breakpoint
ALTER TABLE `__new_user_armors` RENAME TO `user_armors`;--> statement-breakpoint
CREATE TABLE `__new_user_character` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`class` text NOT NULL,
	`combat_level` integer DEFAULT 1 NOT NULL,
	`combat_exp` integer DEFAULT 0 NOT NULL,
	`active_preset_slot` integer DEFAULT 1 NOT NULL,
	`highest_raid_streak` integer DEFAULT 0 NOT NULL,
	`highest_rank_streak` integer DEFAULT 0 NOT NULL,
	`equipped_weapon_id` text,
	`active_deity_id` integer,
	`raids_won` integer DEFAULT 0 NOT NULL,
	`raids_lost` integer DEFAULT 0 NOT NULL,
	`pvp_wins` integer DEFAULT 0 NOT NULL,
	`pvp_losses` integer DEFAULT 0 NOT NULL,
	`believer_level` integer DEFAULT 1 NOT NULL,
	`believer_exp` integer DEFAULT 0 NOT NULL,
	`reputation_exp_today` integer DEFAULT 0 NOT NULL,
	`reputation_exp_reset_date` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`equipped_armor_id` text,
	`active_deity_id_2` integer,
	`active_deity_id_3` integer,
	`pvp_rating` integer DEFAULT 1000 NOT NULL,
	`boss_kills` integer DEFAULT 0 NOT NULL,
	`equipped_title_id` integer,
	`active_echo_deity_id` integer,
	`pvp_peak` integer DEFAULT 1000 NOT NULL,
	`last_weekly_claim_week` integer,
	`pvp_demotion_shield` integer DEFAULT true NOT NULL,
	`boss_top_damage` integer DEFAULT 0 NOT NULL,
	`lifetime_exp` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipped_weapon_id`) REFERENCES `user_weapons`(`weapon_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`active_deity_id`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipped_armor_id`) REFERENCES `user_armors`(`armor_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`active_deity_id_2`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`active_deity_id_3`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipped_title_id`) REFERENCES `title_catalog`(`title_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`active_echo_deity_id`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_user_character`("discord_id", "class", "combat_level", "combat_exp", "active_preset_slot", "highest_raid_streak", "highest_rank_streak", "equipped_weapon_id", "active_deity_id", "raids_won", "raids_lost", "pvp_wins", "pvp_losses", "believer_level", "believer_exp", "reputation_exp_today", "reputation_exp_reset_date", "created_at", "equipped_armor_id", "active_deity_id_2", "active_deity_id_3", "pvp_rating", "boss_kills", "equipped_title_id", "active_echo_deity_id", "pvp_peak", "last_weekly_claim_week", "pvp_demotion_shield", "boss_top_damage", "lifetime_exp") SELECT "discord_id", "class", "combat_level", "combat_exp", "active_preset_slot", "highest_raid_streak", "highest_rank_streak", "equipped_weapon_id", "active_deity_id", "raids_won", "raids_lost", "pvp_wins", "pvp_losses", "believer_level", "believer_exp", "reputation_exp_today", "reputation_exp_reset_date", "created_at", "equipped_armor_id", "active_deity_id_2", "active_deity_id_3", "pvp_rating", "boss_kills", "equipped_title_id", "active_echo_deity_id", "pvp_peak", "last_weekly_claim_week", "pvp_demotion_shield", "boss_top_damage", "lifetime_exp" FROM `user_character`;--> statement-breakpoint
DROP TABLE `user_character`;--> statement-breakpoint
ALTER TABLE `__new_user_character` RENAME TO `user_character`;--> statement-breakpoint
CREATE TABLE `__new_user_cosmetics` (
	`discord_id` text NOT NULL,
	`cosmetic_id` integer NOT NULL,
	`source` text NOT NULL,
	`acquired_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `cosmetic_id`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cosmetic_id`) REFERENCES `cosmetic_catalog`(`cosmetic_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_cosmetics`("discord_id", "cosmetic_id", "source", "acquired_at") SELECT "discord_id", "cosmetic_id", "source", "acquired_at" FROM `user_cosmetics`;--> statement-breakpoint
DROP TABLE `user_cosmetics`;--> statement-breakpoint
ALTER TABLE `__new_user_cosmetics` RENAME TO `user_cosmetics`;--> statement-breakpoint
CREATE TABLE `__new_user_deities` (
	`user_deity_id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`deity_id` integer NOT NULL,
	`curr_atk` integer NOT NULL,
	`curr_hp` integer NOT NULL,
	`curr_def` integer NOT NULL,
	`enhancement` integer DEFAULT 1 NOT NULL,
	`obtained_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_pull_date` text NOT NULL,
	`sigils` integer DEFAULT 0 NOT NULL,
	`ascended` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deity_id`) REFERENCES `deity_roster`(`deity_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_deities`("user_deity_id", "discord_id", "deity_id", "curr_atk", "curr_hp", "curr_def", "enhancement", "obtained_at", "last_pull_date", "sigils", "ascended") SELECT "user_deity_id", "discord_id", "deity_id", "curr_atk", "curr_hp", "curr_def", "enhancement", "obtained_at", "last_pull_date", "sigils", "ascended" FROM `user_deities`;--> statement-breakpoint
DROP TABLE `user_deities`;--> statement-breakpoint
ALTER TABLE `__new_user_deities` RENAME TO `user_deities`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_deities_unique_0` ON `user_deities` (`discord_id`,`deity_id`);--> statement-breakpoint
CREATE TABLE `__new_user_guild_activity` (
	`discord_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`last_active` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `guild_id`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_guild_activity`("discord_id", "guild_id", "last_active") SELECT "discord_id", "guild_id", "last_active" FROM `user_guild_activity`;--> statement-breakpoint
DROP TABLE `user_guild_activity`;--> statement-breakpoint
ALTER TABLE `__new_user_guild_activity` RENAME TO `user_guild_activity`;--> statement-breakpoint
CREATE TABLE `__new_user_presets` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`slot` integer NOT NULL,
	`name` text,
	`equipped_deity_1_id` integer,
	`equipped_deity_2_id` integer,
	`equipped_deity_3_id` integer,
	`equipped_echo_deity_id` integer,
	`equipped_armor_id` text,
	`equipped_weapon_id` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipped_deity_1_id`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipped_deity_2_id`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipped_deity_3_id`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipped_echo_deity_id`) REFERENCES `user_deities`(`user_deity_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipped_armor_id`) REFERENCES `user_armors`(`armor_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipped_weapon_id`) REFERENCES `user_weapons`(`weapon_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_user_presets`("id", "discord_id", "slot", "name", "equipped_deity_1_id", "equipped_deity_2_id", "equipped_deity_3_id", "equipped_echo_deity_id", "equipped_armor_id", "equipped_weapon_id", "updated_at") SELECT "id", "discord_id", "slot", "name", "equipped_deity_1_id", "equipped_deity_2_id", "equipped_deity_3_id", "equipped_echo_deity_id", "equipped_armor_id", "equipped_weapon_id", "updated_at" FROM `user_presets`;--> statement-breakpoint
DROP TABLE `user_presets`;--> statement-breakpoint
ALTER TABLE `__new_user_presets` RENAME TO `user_presets`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_presets_unique_0` ON `user_presets` (`discord_id`,`slot`);--> statement-breakpoint
CREATE TABLE `__new_user_runes` (
	`rune_uid` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`rune_id` integer NOT NULL,
	`socketed_into` text,
	`is_locked` integer DEFAULT false NOT NULL,
	`obtained_at` integer DEFAULT (unixepoch()) NOT NULL,
	`rolled_value` real,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rune_id`) REFERENCES `rune_roster`(`rune_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_runes`("rune_uid", "discord_id", "rune_id", "socketed_into", "is_locked", "obtained_at", "rolled_value") SELECT "rune_uid", "discord_id", "rune_id", "socketed_into", "is_locked", "obtained_at", "rolled_value" FROM `user_runes`;--> statement-breakpoint
DROP TABLE `user_runes`;--> statement-breakpoint
ALTER TABLE `__new_user_runes` RENAME TO `user_runes`;--> statement-breakpoint
CREATE TABLE `__new_user_titles` (
	`discord_id` text NOT NULL,
	`title_id` integer NOT NULL,
	`earned_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `title_id`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`title_id`) REFERENCES `title_catalog`(`title_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_titles`("discord_id", "title_id", "earned_at") SELECT "discord_id", "title_id", "earned_at" FROM `user_titles`;--> statement-breakpoint
DROP TABLE `user_titles`;--> statement-breakpoint
ALTER TABLE `__new_user_titles` RENAME TO `user_titles`;--> statement-breakpoint
CREATE TABLE `__new_user_weapons` (
	`discord_id` text NOT NULL,
	`weapon_id` text PRIMARY KEY NOT NULL,
	`weapon_roster_id` integer NOT NULL,
	`curr_atk` integer NOT NULL,
	`enhancement` integer DEFAULT 1 NOT NULL,
	`base_atk` integer NOT NULL,
	`crit` real NOT NULL,
	`bonus_dmg_pct` real,
	`is_locked` integer DEFAULT false NOT NULL,
	`obtained_at` integer DEFAULT (unixepoch()) NOT NULL,
	`native_sockets` text NOT NULL,
	`opposite_sockets` text NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`weapon_roster_id`) REFERENCES `weapon_roster`(`weapon_roster_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_weapons`("discord_id", "weapon_id", "weapon_roster_id", "curr_atk", "enhancement", "base_atk", "crit", "bonus_dmg_pct", "is_locked", "obtained_at", "native_sockets", "opposite_sockets") SELECT "discord_id", "weapon_id", "weapon_roster_id", "curr_atk", "enhancement", "base_atk", "crit", "bonus_dmg_pct", "is_locked", "obtained_at", "native_sockets", "opposite_sockets" FROM `user_weapons`;--> statement-breakpoint
DROP TABLE `user_weapons`;--> statement-breakpoint
ALTER TABLE `__new_user_weapons` RENAME TO `user_weapons`;--> statement-breakpoint
CREATE TABLE `__new_users_bag` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`credux` integer DEFAULT 0 NOT NULL,
	`belief_shards` integer DEFAULT 0 NOT NULL,
	`sacred_relics` integer DEFAULT 0 NOT NULL,
	`supreme_relics` integer DEFAULT 0 NOT NULL,
	`silver_chest` integer DEFAULT 0 NOT NULL,
	`gold_chest` integer DEFAULT 0 NOT NULL,
	`boss_treasure_chest` integer DEFAULT 0 NOT NULL,
	`boss_golden_chest` integer DEFAULT 0 NOT NULL,
	`supreme_chest` integer DEFAULT 0 NOT NULL,
	`epic_essence` integer DEFAULT 0 NOT NULL,
	`mythic_essence` integer DEFAULT 0 NOT NULL,
	`legendary_essence` integer DEFAULT 0 NOT NULL,
	`supreme_essence` integer DEFAULT 0 NOT NULL,
	`lifetime_credux_earned` integer DEFAULT 0 NOT NULL,
	`lesser_rune_bag` integer DEFAULT 0 NOT NULL,
	`greater_rune_bag` integer DEFAULT 0 NOT NULL,
	`divine_rune_bag` integer DEFAULT 0 NOT NULL,
	`valor_medals` integer DEFAULT 0 NOT NULL,
	`custom_avatar_token` integer DEFAULT 0 NOT NULL,
	`custom_deity_token` integer DEFAULT 0 NOT NULL,
	`change_class` integer DEFAULT 0 NOT NULL,
	`diamond_chest` integer DEFAULT 0 NOT NULL,
	`genesis_chest` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users_bag`("discord_id", "credux", "belief_shards", "sacred_relics", "supreme_relics", "silver_chest", "gold_chest", "boss_treasure_chest", "boss_golden_chest", "supreme_chest", "epic_essence", "mythic_essence", "legendary_essence", "supreme_essence", "lifetime_credux_earned", "lesser_rune_bag", "greater_rune_bag", "divine_rune_bag", "valor_medals", "custom_avatar_token", "custom_deity_token", "change_class", "diamond_chest", "genesis_chest") SELECT "discord_id", "credux", "belief_shards", "sacred_relics", "supreme_relics", "silver_chest", "gold_chest", "boss_treasure_chest", "boss_golden_chest", "supreme_chest", "epic_essence", "mythic_essence", "legendary_essence", "supreme_essence", "lifetime_credux_earned", "lesser_rune_bag", "greater_rune_bag", "divine_rune_bag", "valor_medals", "custom_avatar_token", "custom_deity_token", "change_class", "diamond_chest", "genesis_chest" FROM `users_bag`;--> statement-breakpoint
DROP TABLE `users_bag`;--> statement-breakpoint
ALTER TABLE `__new_users_bag` RENAME TO `users_bag`;--> statement-breakpoint
CREATE TABLE `__new_weekly_grand` (
	`discord_id` text NOT NULL,
	`quest_week` integer NOT NULL,
	`claimed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`discord_id`, `quest_week`),
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_weekly_grand`("discord_id", "quest_week", "claimed") SELECT "discord_id", "quest_week", "claimed" FROM `weekly_grand`;--> statement-breakpoint
DROP TABLE `weekly_grand`;--> statement-breakpoint
ALTER TABLE `__new_weekly_grand` RENAME TO `weekly_grand`;--> statement-breakpoint
CREATE TABLE `__new_weekly_quests` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`quest_type` text NOT NULL,
	`target_count` integer NOT NULL,
	`current_count` integer DEFAULT 0 NOT NULL,
	`reward_credux` integer NOT NULL,
	`reward_valor` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`quest_week` integer NOT NULL,
	FOREIGN KEY (`discord_id`) REFERENCES `users`(`discord_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_weekly_quests`("id", "discord_id", "quest_type", "target_count", "current_count", "reward_credux", "reward_valor", "completed", "quest_week") SELECT "id", "discord_id", "quest_type", "target_count", "current_count", "reward_credux", "reward_valor", "completed", "quest_week" FROM `weekly_quests`;--> statement-breakpoint
DROP TABLE `weekly_quests`;--> statement-breakpoint
ALTER TABLE `__new_weekly_quests` RENAME TO `weekly_quests`;--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_quests_unique_0` ON `weekly_quests` (`discord_id`,`quest_type`,`quest_week`);