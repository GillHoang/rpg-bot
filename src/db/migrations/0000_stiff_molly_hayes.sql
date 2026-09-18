CREATE TABLE `active_battles` (
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
	`started_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_battles_unique_0` ON `active_battles` (`discord_id`);--> statement-breakpoint
CREATE TABLE `active_casino_sessions` (
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
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `active_duel_participants` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`duel_id` text NOT NULL,
	`lock_token` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `active_duels` (
	`duel_id` text PRIMARY KEY NOT NULL,
	`lock_token` text NOT NULL,
	`challenger_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`duel_type` text NOT NULL,
	`stake` integer,
	`status` text NOT NULL,
	`guild_id` text,
	`channel_id` text,
	`message_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`accepted_at` integer,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `active_ranked_fights` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`lock_token` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `armor_roster` (
	`armor_roster_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`tier` text NOT NULL,
	`mythology` text NOT NULL,
	`passive_key` text NOT NULL,
	`passive_name` text NOT NULL,
	`passive_description` text NOT NULL,
	`lore` text,
	`image_filename` text,
	`is_available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auto_raids` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ends_at` integer NOT NULL,
	`combat_level` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `boss_attack_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`boss_spawn_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`discord_id` text NOT NULL,
	`mob_id` integer NOT NULL,
	`total_damage` integer DEFAULT 0 NOT NULL,
	`attacked_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_daily_reset` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boss_attack_log_unique_0` ON `boss_attack_log` (`boss_spawn_id`,`discord_id`);--> statement-breakpoint
CREATE TABLE `boss_spawn_queue` (
	`queue_id` integer PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`boss_name` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`claim_started_at` integer,
	`spawned_at` integer,
	`cancelled_at` integer,
	`cancelled_by` text,
	`spawn_id` text
);
--> statement-breakpoint
CREATE TABLE `boss_state` (
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
	`passive_state` text
);
--> statement-breakpoint
CREATE TABLE `casino_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`game` text NOT NULL,
	`bet_amount` integer NOT NULL,
	`result` text NOT NULL,
	`payout` integer NOT NULL,
	`balance_before` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`metadata` text,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cosmetic_catalog` (
	`cosmetic_id` integer PRIMARY KEY NOT NULL,
	`cosmetic_key` text NOT NULL,
	`category` text NOT NULL,
	`tier` text NOT NULL,
	`display_name` text NOT NULL,
	`token_cost` integer DEFAULT 0 NOT NULL,
	`is_base` integer DEFAULT false NOT NULL,
	`has_top_label` integer DEFAULT false NOT NULL,
	`display_filename` text,
	`render_filename` text,
	`victory_filename` text,
	`defeated_filename` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`skin_code` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cosmetic_catalog_unique_0` ON `cosmetic_catalog` (`cosmetic_key`);--> statement-breakpoint
CREATE TABLE `daily_quest_completion_rewards` (
	`discord_id` text NOT NULL,
	`quest_date` text NOT NULL,
	`sacred_relics` integer DEFAULT 1 NOT NULL,
	`claimed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `quest_date`)
);
--> statement-breakpoint
CREATE TABLE `daily_quests` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`quest_type` text NOT NULL,
	`target_count` integer NOT NULL,
	`current_count` integer DEFAULT 0 NOT NULL,
	`reward_credux` integer NOT NULL,
	`reward_belief_shards` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`quest_date` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_quests_unique_0` ON `daily_quests` (`discord_id`,`quest_type`,`quest_date`);--> statement-breakpoint
CREATE TABLE `deity_roster` (
	`deity_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mythology` text NOT NULL,
	`tier` text NOT NULL,
	`base_hp` integer NOT NULL,
	`base_atk` integer NOT NULL,
	`base_def` integer NOT NULL,
	`blessing_key` text NOT NULL,
	`blessing_name` text NOT NULL,
	`blessing_description` text NOT NULL,
	`lore` text,
	`image_filename` text,
	`is_available` integer DEFAULT true NOT NULL,
	`blessing_scaling` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deity_roster_unique_0` ON `deity_roster` (`name`);--> statement-breakpoint
CREATE TABLE `dev_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`dev_id` text NOT NULL,
	`action_type` text NOT NULL,
	`target_discord_id` text NOT NULL,
	`amount_or_detail` text,
	`pre_reset_snapshot` text,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `equipped_skins` (
	`discord_id` text NOT NULL,
	`category` text NOT NULL,
	`cosmetic_id` integer,
	`override_path` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `category`)
);
--> statement-breakpoint
CREATE TABLE `essence_bag_def` (
	`bag_key` text PRIMARY KEY NOT NULL,
	`open_command` text NOT NULL,
	`essence_tier` text NOT NULL,
	`essence_cost` integer NOT NULL,
	`credux_cost` integer NOT NULL,
	`rune_pool` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `essence_exchange_submissions` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`action` text NOT NULL,
	`item_type` text,
	`previous_credux` integer,
	`updated_credux` integer,
	`previous_belief_shards` integer,
	`updated_belief_shards` integer,
	`previous_chest_count` integer,
	`updated_chest_count` integer,
	`previous_relic_count` integer,
	`updated_relic_count` integer,
	`previous_essence_count` integer,
	`updated_essence_count` integer,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mob_roster` (
	`mob_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mythology` text NOT NULL,
	`mob_type` text NOT NULL,
	`base_hp` integer NOT NULL,
	`base_atk` integer NOT NULL,
	`base_def` integer NOT NULL,
	`base_crit` real NOT NULL,
	`hp_per_level` integer DEFAULT 0 NOT NULL,
	`atk_per_level` integer DEFAULT 0 NOT NULL,
	`def_per_level` integer DEFAULT 0 NOT NULL,
	`skill_key` text NOT NULL,
	`skill_name` text NOT NULL,
	`skill_description` text NOT NULL,
	`immunity_tags` text NOT NULL,
	`special_flags` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pity_counters` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`pity_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pvp_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`duel_id` text,
	`challenger_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`winner_id` text NOT NULL,
	`challenger_damage` integer NOT NULL,
	`opponent_damage` integer NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pvp_shop_purchases` (
	`discord_id` text NOT NULL,
	`season_id` integer NOT NULL,
	`item_key` text NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`discord_id`, `season_id`, `item_key`)
);
--> statement-breakpoint
CREATE TABLE `raid_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`battle_type` text NOT NULL,
	`enemy_name` text NOT NULL,
	`enemy_tier` text NOT NULL,
	`result` text NOT NULL,
	`exp_earned` integer DEFAULT 0 NOT NULL,
	`updated_exp` integer NOT NULL,
	`belief_shards_dropped` integer DEFAULT 0 NOT NULL,
	`updated_belief_shards` integer NOT NULL,
	`credux_earned` integer DEFAULT 0 NOT NULL,
	`updated_credux` integer NOT NULL,
	`chest_dropped` text,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `raid_reward_daily_totals` (
	`discord_id` text NOT NULL,
	`reward_date` text NOT NULL,
	`silver_chests` integer DEFAULT 0 NOT NULL,
	`gold_chests` integer DEFAULT 0 NOT NULL,
	`belief_shards` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`discord_id`, `reward_date`)
);
--> statement-breakpoint
CREATE TABLE `raid_reward_grants` (
	`reward_key` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`reward` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ranked_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`result` text NOT NULL,
	`rating_before` integer NOT NULL,
	`rating_after` integer NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ranked_reward` (
	`bracket` text PRIMARY KEY NOT NULL,
	`weekly_credux` integer DEFAULT 0 NOT NULL,
	`weekly_payload` text NOT NULL,
	`season_end_payload` text NOT NULL,
	`weekly_valor` integer DEFAULT 0 NOT NULL,
	`season_valor` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rune_roster` (
	`rune_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lane` text NOT NULL,
	`effect_key` text NOT NULL,
	`tier` text NOT NULL,
	`value` real NOT NULL,
	`description` text NOT NULL,
	`is_available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`season_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`theme` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`featured_deity_id` integer,
	`is_active` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `server_config` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`prefix` text NOT NULL,
	`announcement_channel_id` text,
	`boss_announcement_channel_id` text,
	`bot_channel_id` text,
	`configured_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `socket_unlock_cost` (
	`tier` text NOT NULL,
	`slot_index` integer NOT NULL,
	`essence_tier` text NOT NULL,
	`essence_cost` integer NOT NULL,
	`credux_cost` integer NOT NULL,
	PRIMARY KEY(`tier`, `slot_index`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`processed_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `summon_reward_grants` (
	`reward_key` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supporter_grants` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`action` text NOT NULL,
	`tier` text,
	`months` integer,
	`paypal_ref` text,
	`granted_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supporter_item_grants` (
	`grant_id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`item_key` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`grant_reason` text NOT NULL,
	`grant_ref` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supporter_item_grants_unique_0` ON `supporter_item_grants` (`discord_id`,`item_key`,`grant_reason`,`grant_ref`);--> statement-breakpoint
CREATE TABLE `supporter_token_ledger` (
	`entry_id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supporters` (
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
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supporters_unique_0` ON `supporters` (`founder_number`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`ticket_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`completed_by` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `title_catalog` (
	`title_id` integer PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`display` text NOT NULL,
	`source` text NOT NULL,
	`is_repeatable` integer DEFAULT true NOT NULL,
	`how_to` text,
	`image_filename` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `title_catalog_unique_0` ON `title_catalog` (`code`);--> statement-breakpoint
CREATE TABLE `topgg_vote_events` (
	`topgg_vote_id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`discord_id` text NOT NULL,
	`topgg_user_id` text,
	`voted_at` integer NOT NULL,
	`expires_at` integer,
	`weight` integer DEFAULT 1 NOT NULL,
	`daily_cycle` text NOT NULL,
	`delivery_trace` text,
	`outcome` text NOT NULL,
	`streak_number` integer,
	`random_reward` text,
	`milestone_reward` text,
	`rewarded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_armors` (
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
	`obtained_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_character` (
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
	`lifetime_exp` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_cosmetics` (
	`discord_id` text NOT NULL,
	`cosmetic_id` integer NOT NULL,
	`source` text NOT NULL,
	`acquired_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `cosmetic_id`)
);
--> statement-breakpoint
CREATE TABLE `user_deities` (
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
	`ascended` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_deities_unique_0` ON `user_deities` (`discord_id`,`deity_id`);--> statement-breakpoint
CREATE TABLE `user_guild_activity` (
	`discord_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`last_active` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `guild_id`)
);
--> statement-breakpoint
CREATE TABLE `user_presets` (
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
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_presets_unique_0` ON `user_presets` (`discord_id`,`slot`);--> statement-breakpoint
CREATE TABLE `user_runes` (
	`rune_uid` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`rune_id` integer NOT NULL,
	`socketed_into` text,
	`is_locked` integer DEFAULT false NOT NULL,
	`obtained_at` integer DEFAULT (unixepoch()) NOT NULL,
	`rolled_value` real
);
--> statement-breakpoint
CREATE TABLE `user_titles` (
	`discord_id` text NOT NULL,
	`title_id` integer NOT NULL,
	`earned_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`discord_id`, `title_id`)
);
--> statement-breakpoint
CREATE TABLE `user_weapons` (
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
	`opposite_sockets` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`discord_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`monthly_streak` integer DEFAULT 0 NOT NULL,
	`overall_streak` integer DEFAULT 0 NOT NULL,
	`last_daily_claim_date` text,
	`last_bestow_received` text,
	`bestow_received_today` integer DEFAULT 0 NOT NULL,
	`last_boss_attack_date` text,
	`is_banned` integer DEFAULT false NOT NULL,
	`registered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`quest_refreshes_today` integer DEFAULT 0 NOT NULL,
	`last_quest_refresh_date` text
);
--> statement-breakpoint
CREATE TABLE `users_bag` (
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
	`genesis_chest` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wager_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`challenger_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`winner_id` text NOT NULL,
	`amount` integer NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weapon_roster` (
	`weapon_roster_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`tier` text NOT NULL,
	`mythology` text NOT NULL,
	`passive_key` text NOT NULL,
	`passive_name` text NOT NULL,
	`passive_description` text NOT NULL,
	`lore` text,
	`image_filename` text,
	`is_available` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_grand` (
	`discord_id` text NOT NULL,
	`quest_week` integer NOT NULL,
	`claimed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`discord_id`, `quest_week`)
);
--> statement-breakpoint
CREATE TABLE `weekly_quests` (
	`id` integer PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`quest_type` text NOT NULL,
	`target_count` integer NOT NULL,
	`current_count` integer DEFAULT 0 NOT NULL,
	`reward_credux` integer NOT NULL,
	`reward_valor` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`quest_week` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_quests_unique_0` ON `weekly_quests` (`discord_id`,`quest_type`,`quest_week`);