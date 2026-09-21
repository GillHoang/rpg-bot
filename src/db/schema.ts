// AUTO-GENERATED from PostgreSQL schema.sql (pg_dump) — review before use.
// Generator: convert/gen_drizzle.py. Postgres-specific features (RLS, sequences,
// ARRAY/ANY() CHECK constraints, GENERATED IDENTITY) are approximated for SQLite.
import { pgTable, text, integer, real, primaryKey, unique, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Written in the same transaction as menu raid rewards. No interaction tokens stored.
export const menuActionReceipts = pgTable(
	'menu_action_receipts',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		requestId: text('request_id').notNull(),
		kind: text('kind').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.discordId, table.requestId] })],
);

// active_battles — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((battle_type)::text = ANY ((ARRAY['raid'::character varying, 'boss'::character varying])::text[])))
export const activeBattles = pgTable(
	'active_battles',
	{
		battleId: integer('battle_id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		channelId: text('channel_id').notNull(),
		messageId: text('message_id').notNull(),
		battleType: text('battle_type').notNull(),
		mobId: integer('mob_id')
			.notNull()
			.references(() => mobRoster.mobId),
		enemyLevel: integer('enemy_level'),
		playerHp: integer('player_hp').notNull(),
		playerMaxHp: integer('player_max_hp').notNull(),
		enemyHp: integer('enemy_hp').notNull(),
		enemyMaxHp: integer('enemy_max_hp').notNull(),
		currentTurn: integer('current_turn').notNull().default(1),
		playerGoesFirst: boolean('player_goes_first').notNull(),
		activeDebuffs: jsonb('active_debuffs').notNull(),
		battleLog: jsonb('battle_log').notNull(),
		overchargePct: integer('overcharge_pct').notNull().default(0),
		bleedStacks: jsonb('bleed_stacks').notNull(),
		startedAt: timestamp('started_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		unique0: unique('active_battles_unique_0').on(table.discordId),
	}),
);

// active_casino_sessions — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK ((bet_amount > 0))
//   CHECK (((game)::text = ANY ((ARRAY['blackjack'::character varying, 'crash'::character varying])::text[])))
//   CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolving'::character varying, 'settled'::character varying, 'refunded'::character varying, 'expired'::character varying])::text[])))
export const activeCasinoSessions = pgTable('active_casino_sessions', {
	sessionId: text('session_id') /* TODO pg type: uuid */
		.primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	game: text('game').notNull(),
	status: text('status').notNull(),
	betAmount: integer('bet_amount').notNull(),
	balanceBefore: integer('balance_before').notNull(),
	balanceAfterDebit: integer('balance_after_debit').notNull(),
	payout: integer('payout'),
	balanceAfter: integer('balance_after'),
	channelId: text('channel_id'),
	messageId: text('message_id'),
	stateJson: jsonb('state_json').notNull(),
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

// active_duel_participants — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((role)::text = ANY ((ARRAY['challenger'::character varying, 'opponent'::character varying])::text[])))
export const activeDuelParticipants = pgTable('active_duel_participants', {
	discordId: text('discord_id').primaryKey(),
	duelId: text('duel_id') /* TODO pg type: uuid */
		.notNull()
		.references(() => activeDuels.duelId, { onDelete: 'cascade' }),
	lockToken: text('lock_token') /* TODO pg type: uuid */
		.notNull(),
	role: text('role').notNull(),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

// active_duels — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((duel_type)::text = ANY ((ARRAY['casual'::character varying, 'wager'::character varying])::text[])))
//   CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'settling'::character varying])::text[])))
export const activeDuels = pgTable('active_duels', {
	duelId: text('duel_id') /* TODO pg type: uuid */
		.primaryKey(),
	lockToken: text('lock_token') /* TODO pg type: uuid */
		.notNull(),
	challengerId: text('challenger_id').notNull(),
	opponentId: text('opponent_id').notNull(),
	duelType: text('duel_type').notNull(),
	stake: integer('stake'),
	status: text('status').notNull(),
	guildId: text('guild_id'),
	channelId: text('channel_id'),
	messageId: text('message_id'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	acceptedAt: timestamp('accepted_at', { mode: 'date', withTimezone: false }),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

export const activeRankedFights = pgTable('active_ranked_fights', {
	discordId: text('discord_id').primaryKey(),
	lockToken: text('lock_token').notNull(),
	startedAt: timestamp('started_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
});

// armor_roster — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((tier)::text = ANY ((ARRAY['Common'::character varying, 'Rare'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))
//   CHECK (((type)::text = ANY ((ARRAY['Heavy'::character varying, 'Medium'::character varying, 'Light'::character varying])::text[])))
export const armorRoster = pgTable('armor_roster', {
	armorRosterId: integer('armor_roster_id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	type: text('type').notNull(),
	tier: text('tier').notNull(),
	mythology: text('mythology').notNull(),
	passiveKey: text('passive_key').notNull(),
	passiveName: text('passive_name').notNull(),
	passiveDescription: text('passive_description').notNull(),
	lore: text('lore'),
	imageFilename: text('image_filename'),
	isAvailable: boolean('is_available').notNull().default(true),
});

export const autoRaids = pgTable('auto_raids', {
	discordId: text('discord_id').primaryKey(),
	startedAt: timestamp('started_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	endsAt: timestamp('ends_at', { mode: 'date', withTimezone: false }).notNull(),
	combatLevel: integer('combat_level').notNull(),
});

export const bossAttackLog = pgTable(
	'boss_attack_log',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		bossSpawnId: text('boss_spawn_id') /* TODO pg type: uuid */
			.notNull(),
		guildId: text('guild_id').notNull(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		mobId: integer('mob_id').notNull(),
		totalDamage: integer('total_damage').notNull().default(0),
		attackedAt: timestamp('attacked_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		lastDailyReset: text('last_daily_reset').notNull(),
	},
	(table) => ({
		unique0: unique('boss_attack_log_unique_0').on(table.bossSpawnId, table.discordId),
	}),
);

// boss_spawn_queue — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'spawning'::character varying, 'spawned'::character varying, 'cancelled'::character varying])::text[])))
export const bossSpawnQueue = pgTable('boss_spawn_queue', {
	queueId: integer('queue_id').primaryKey().generatedByDefaultAsIdentity(),
	guildId: text('guild_id').notNull(),
	bossName: text('boss_name').notNull(),
	requestedBy: text('requested_by').notNull(),
	status: text('status').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	claimStartedAt: timestamp('claim_started_at', { mode: 'date', withTimezone: false }),
	spawnedAt: timestamp('spawned_at', { mode: 'date', withTimezone: false }),
	cancelledAt: timestamp('cancelled_at', { mode: 'date', withTimezone: false }),
	cancelledBy: text('cancelled_by'),
	spawnId: text('spawn_id') /* TODO pg type: uuid */,
});

// boss_state — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'dead'::character varying, 'escaped'::character varying])::text[])))
export const bossState = pgTable('boss_state', {
	guildId: text('guild_id').primaryKey(),
	spawnId: text('spawn_id') /* TODO pg type: uuid */
		.notNull(),
	mobId: integer('mob_id')
		.notNull()
		.references(() => mobRoster.mobId),
	bossLevel: integer('boss_level'),
	maxHp: integer('max_hp').notNull(),
	currentHp: integer('current_hp').notNull(),
	scaledAtk: integer('scaled_atk').notNull(),
	scaledDef: integer('scaled_def').notNull(),
	spawnAt: timestamp('spawn_at', { mode: 'date', withTimezone: false }).notNull(),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }).notNull(),
	status: text('status').notNull(),
	spawnSource: text('spawn_source').notNull(),
	lastAttackAt: timestamp('last_attack_at', { mode: 'date', withTimezone: false }),
	passiveState: jsonb('passive_state'),
});

// casino_logs — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((result)::text = ANY ((ARRAY['win'::character varying, 'loss'::character varying])::text[])))
export const casinoLogs = pgTable('casino_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	game: text('game').notNull(),
	betAmount: integer('bet_amount').notNull(),
	result: text('result').notNull(),
	payout: integer('payout').notNull(),
	balanceBefore: integer('balance_before').notNull(),
	balanceAfter: integer('balance_after').notNull(),
	metadata: jsonb('metadata'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// cosmetic_catalog — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((category)::text = ANY ((ARRAY['profile'::character varying, 'battle'::character varying, 'battle_result'::character varying, 'summon'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['believer'::character varying, 'chosen'::character varying, 'eternal'::character varying])::text[])))
//   CHECK ((token_cost >= 0))
export const cosmeticCatalog = pgTable(
	'cosmetic_catalog',
	{
		cosmeticId: integer('cosmetic_id').primaryKey().generatedByDefaultAsIdentity(),
		cosmeticKey: text('cosmetic_key').notNull(),
		category: text('category').notNull(),
		tier: text('tier').notNull(),
		displayName: text('display_name').notNull(),
		tokenCost: integer('token_cost').notNull().default(0),
		isBase: boolean('is_base').notNull().default(false),
		hasTopLabel: boolean('has_top_label').notNull().default(false),
		displayFilename: text('display_filename'),
		renderFilename: text('render_filename'),
		victoryFilename: text('victory_filename'),
		defeatedFilename: text('defeated_filename'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		skinCode: text('skin_code'),
	},
	(table) => ({
		unique0: unique('cosmetic_catalog_unique_0').on(table.cosmeticKey),
	}),
);

// daily_quest_completion_rewards — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK ((sacred_relics = 1))
export const dailyQuestCompletionRewards = pgTable(
	'daily_quest_completion_rewards',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		questDate: text('quest_date').notNull(),
		sacredRelics: integer('sacred_relics').notNull().default(1),
		claimedAt: timestamp('claimed_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.questDate] }),
	}),
);

export const dailyQuests = pgTable(
	'daily_quests',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		questType: text('quest_type').notNull(),
		targetCount: integer('target_count').notNull(),
		currentCount: integer('current_count').notNull().default(0),
		rewardCredux: integer('reward_credux').notNull(),
		rewardBeliefShards: integer('reward_belief_shards').notNull(),
		completed: boolean('completed').notNull().default(false),
		questDate: text('quest_date').notNull(),
	},
	(table) => ({
		unique0: unique('daily_quests_unique_0').on(table.discordId, table.questType, table.questDate),
	}),
);

// deity_roster — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((blessing_scaling)::text = ANY ((ARRAY['scalable'::character varying, 'binary'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['Epic'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))
export const deityRoster = pgTable(
	'deity_roster',
	{
		deityId: integer('deity_id').primaryKey().generatedByDefaultAsIdentity(),
		name: text('name').notNull(),
		mythology: text('mythology').notNull(),
		tier: text('tier').notNull(),
		baseHp: integer('base_hp').notNull(),
		baseAtk: integer('base_atk').notNull(),
		baseDef: integer('base_def').notNull(),
		blessingKey: text('blessing_key').notNull(),
		blessingName: text('blessing_name').notNull(),
		blessingDescription: text('blessing_description').notNull(),
		lore: text('lore'),
		imageFilename: text('image_filename'),
		isAvailable: boolean('is_available').notNull().default(true),
		blessingScaling: text('blessing_scaling').notNull(),
	},
	(table) => ({
		unique0: unique('deity_roster_unique_0').on(table.name),
	}),
);

export const devLogs = pgTable('dev_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	devId: text('dev_id').notNull(),
	actionType: text('action_type').notNull(),
	targetDiscordId: text('target_discord_id').notNull(),
	amountOrDetail: text('amount_or_detail'),
	preResetSnapshot: jsonb('pre_reset_snapshot'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// equipped_skins — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((category)::text = ANY ((ARRAY['profile'::character varying, 'battle'::character varying, 'battle_result'::character varying, 'summon'::character varying])::text[])))
export const equippedSkins = pgTable(
	'equipped_skins',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		category: text('category').notNull(),
		cosmeticId: integer('cosmetic_id').references(() => cosmeticCatalog.cosmeticId, { onDelete: 'set null' }),
		overridePath: text('override_path'),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.category] }),
	}),
);

export const essenceBagDef = pgTable('essence_bag_def', {
	bagKey: text('bag_key').primaryKey(),
	openCommand: text('open_command').notNull(),
	essenceTier: text('essence_tier').notNull(),
	essenceCost: integer('essence_cost').notNull(),
	creduxCost: integer('credux_cost').notNull(),
	runePool: jsonb('rune_pool').notNull(),
});

export const essenceExchangeSubmissions = pgTable('essence_exchange_submissions', {
	submissionId: text('submission_id').primaryKey(),
	discordId: text('discord_id').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

export const gameLogs = pgTable('game_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	action: text('action').notNull(),
	itemType: text('item_type'),
	previousCredux: integer('previous_credux'),
	updatedCredux: integer('updated_credux'),
	previousBeliefShards: integer('previous_belief_shards'),
	updatedBeliefShards: integer('updated_belief_shards'),
	previousChestCount: integer('previous_chest_count'),
	updatedChestCount: integer('updated_chest_count'),
	previousRelicCount: integer('previous_relic_count'),
	updatedRelicCount: integer('updated_relic_count'),
	previousEssenceCount: integer('previous_essence_count'),
	updatedEssenceCount: integer('updated_essence_count'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// mob_roster — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((mob_type)::text = ANY ((ARRAY['regular'::character varying, 'elite'::character varying, 'boss'::character varying])::text[])))
export const mobRoster = pgTable(
	'mob_roster',
	{
		mobId: integer('mob_id').primaryKey().generatedByDefaultAsIdentity(),
		name: text('name').notNull(),
		mythology: text('mythology').notNull(),
		mobType: text('mob_type').notNull(),
		baseHp: integer('base_hp').notNull(),
		baseAtk: integer('base_atk').notNull(),
		baseDef: integer('base_def').notNull(),
		baseCrit: real('base_crit').notNull(),
		hpPerLevel: integer('hp_per_level').notNull().default(0),
		atkPerLevel: integer('atk_per_level').notNull().default(0),
		defPerLevel: integer('def_per_level').notNull().default(0),
		skillKey: text('skill_key').notNull(),
		skillName: text('skill_name').notNull(),
		skillDescription: text('skill_description').notNull(),
		immunityTags: jsonb('immunity_tags').notNull(),
		specialFlags: jsonb('special_flags').notNull(),
	},
	(table) => [
		// Business-key upsert target for the seed runner (identity PK can't be used).
		unique('mob_roster_business_key').on(table.name, table.mythology, table.mobType),
	],
);

export const pityCounters = pgTable('pity_counters', {
	discordId: text('discord_id')
		.primaryKey()
		.references(() => users.discordId),
	pityCount: integer('pity_count').notNull().default(0),
});

export const pvpLogs = pgTable('pvp_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	duelId: text('duel_id') /* TODO pg type: uuid */,
	challengerId: text('challenger_id').notNull(),
	opponentId: text('opponent_id').notNull(),
	winnerId: text('winner_id').notNull(),
	challengerDamage: integer('challenger_damage').notNull(),
	opponentDamage: integer('opponent_damage').notNull(),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

export const pvpShopPurchases = pgTable(
	'pvp_shop_purchases',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		seasonId: integer('season_id').notNull(),
		itemKey: text('item_key').notNull(),
		qty: integer('qty').notNull().default(0),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.seasonId, table.itemKey] }),
	}),
);

// raid_logs — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enemy_tier)::text = ANY ((ARRAY['regular'::character varying, 'elite'::character varying, 'boss'::character varying])::text[])))
//   CHECK (((result)::text = ANY ((ARRAY['win'::character varying, 'loss'::character varying])::text[])))
export const raidLogs = pgTable('raid_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	battleType: text('battle_type').notNull(),
	enemyName: text('enemy_name').notNull(),
	enemyTier: text('enemy_tier').notNull(),
	result: text('result').notNull(),
	expEarned: integer('exp_earned').notNull().default(0),
	updatedExp: integer('updated_exp').notNull(),
	beliefShardsDropped: integer('belief_shards_dropped').notNull().default(0),
	updatedBeliefShards: integer('updated_belief_shards').notNull(),
	creduxEarned: integer('credux_earned').notNull().default(0),
	updatedCredux: integer('updated_credux').notNull(),
	chestDropped: text('chest_dropped'),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// raid_reward_daily_totals — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((silver_chests >= 0) AND (silver_chests <= 20)))
//   CHECK (((gold_chests >= 0) AND (gold_chests <= 10)))
//   CHECK (((belief_shards >= 0) AND (belief_shards <= 10000)))
export const raidRewardDailyTotals = pgTable(
	'raid_reward_daily_totals',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		rewardDate: text('reward_date').notNull(),
		silverChests: integer('silver_chests').notNull().default(0),
		goldChests: integer('gold_chests').notNull().default(0),
		beliefShards: integer('belief_shards').notNull().default(0),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.rewardDate] }),
	}),
);

export const raidRewardGrants = pgTable('raid_reward_grants', {
	rewardKey: text('reward_key').primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	reward: jsonb('reward').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// ranked_logs — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((result)::text = ANY ((ARRAY['win'::character varying, 'loss'::character varying])::text[])))
export const rankedLogs = pgTable('ranked_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	playerId: text('player_id')
		.notNull()
		.references(() => users.discordId),
	opponentId: text('opponent_id').notNull(),
	result: text('result').notNull(),
	ratingBefore: integer('rating_before').notNull(),
	ratingAfter: integer('rating_after').notNull(),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// ranked_reward — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((bracket)::text = ANY ((ARRAY['Mortal'::character varying, 'Champion'::character varying, 'Demigod'::character varying, 'Ascendant'::character varying, 'Divine'::character varying])::text[])))
export const rankedReward = pgTable('ranked_reward', {
	bracket: text('bracket').primaryKey(),
	weeklyCredux: integer('weekly_credux').notNull().default(0),
	weeklyPayload: jsonb('weekly_payload').notNull(),
	seasonEndPayload: jsonb('season_end_payload').notNull(),
	weeklyValor: integer('weekly_valor').notNull().default(0),
	seasonValor: integer('season_valor').notNull().default(0),
});

// rune_roster — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((lane)::text = ANY ((ARRAY['offense'::character varying, 'defense'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['Common'::character varying, 'Rare'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))
export const runeRoster = pgTable('rune_roster', {
	runeId: integer('rune_id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	lane: text('lane').notNull(),
	effectKey: text('effect_key').notNull(),
	tier: text('tier').notNull(),
	value: real('value').notNull(),
	description: text('description').notNull(),
	isAvailable: boolean('is_available').notNull().default(true),
});

export const seasons = pgTable('seasons', {
	seasonId: integer('season_id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	theme: text('theme'),
	startsAt: timestamp('starts_at', { mode: 'date', withTimezone: false }).notNull(),
	endsAt: timestamp('ends_at', { mode: 'date', withTimezone: false }).notNull(),
	featuredDeityId: integer('featured_deity_id').references(() => deityRoster.deityId),
	isActive: boolean('is_active').notNull().default(false),
});

export const serverConfig = pgTable('server_config', {
	guildId: text('guild_id').primaryKey(),
	prefix: text('prefix').notNull(),
	announcementChannelId: text('announcement_channel_id'),
	bossAnnouncementChannelId: text('boss_announcement_channel_id'),
	botChannelId: text('bot_channel_id'),
	configuredAt: timestamp('configured_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// socket_unlock_cost — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((tier)::text = ANY ((ARRAY['Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))
export const socketUnlockCost = pgTable(
	'socket_unlock_cost',
	{
		tier: text('tier').notNull(),
		slotIndex: integer('slot_index').notNull(),
		essenceTier: text('essence_tier').notNull(),
		essenceCost: integer('essence_cost').notNull(),
		creduxCost: integer('credux_cost').notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.tier, table.slotIndex] }),
	}),
);

export const stripeEvents = pgTable('stripe_events', {
	eventId: text('event_id').primaryKey(),
	type: text('type').notNull(),
	processedAt: timestamp('processed_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// summon_reward_grants — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((source)::text = ANY ((ARRAY['belief_shards'::character varying, 'sacred_relic'::character varying, 'supreme_relic'::character varying])::text[])))
export const summonRewardGrants = pgTable('summon_reward_grants', {
	rewardKey: text('reward_key').primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	source: text('source').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// supporter_grants — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((action)::text = ANY ((ARRAY['grant'::character varying, 'extend'::character varying, 'revoke'::character varying])::text[])))
export const supporterGrants = pgTable('supporter_grants', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id').notNull(),
	action: text('action').notNull(),
	tier: text('tier'),
	months: integer('months'),
	paypalRef: text('paypal_ref'),
	grantedBy: text('granted_by').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// supporter_item_grants — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((item_key)::text = 'custom_deity_token'::text))
//   CHECK (quantity > 0)
export const supporterItemGrants = pgTable(
	'supporter_item_grants',
	{
		grantId: integer('grant_id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		itemKey: text('item_key').notNull(),
		quantity: integer('quantity').notNull().default(1),
		grantReason: text('grant_reason').notNull(),
		grantRef: text('grant_ref').notNull(),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		unique0: unique('supporter_item_grants_unique_0').on(
			table.discordId,
			table.itemKey,
			table.grantReason,
			table.grantRef,
		),
	}),
);

export const supporterTokenLedger = pgTable('supporter_token_ledger', {
	entryId: integer('entry_id').primaryKey().generatedByDefaultAsIdentity(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	delta: integer('delta').notNull(),
	reason: text('reason').notNull(),
	ref: text('ref'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// supporters — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((founder_number >= 1) AND (founder_number <= 50)))
//   CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'past_due'::character varying, 'canceled'::character varying, 'expired'::character varying])::text[])))
//   CHECK (((tier)::text = ANY ((ARRAY['believer'::character varying, 'chosen_believer'::character varying, 'eternal_believer'::character varying])::text[])))
//   CHECK ((token_balance >= 0))
export const supporters = pgTable(
	'supporters',
	{
		discordId: text('discord_id')
			.primaryKey()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		tier: text('tier').notNull(),
		status: text('status').notNull(),
		currentPeriodEnd: timestamp('current_period_end', { mode: 'date', withTimezone: false }),
		founderNumber: integer('founder_number'),
		founderPurchasedAt: timestamp('founder_purchased_at', { mode: 'date', withTimezone: false }),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
		tokenBalance: integer('token_balance').notNull().default(0),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		active: boolean('active').notNull().default(true),
		foundingSupporter: boolean('founding_supporter').notNull().default(false),
		grantedBy: text('granted_by'),
		subscribedAt: timestamp('subscribed_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }),
	},
	(table) => ({
		unique0: unique('supporters_unique_0').on(table.founderNumber),
	}),
);

// tickets — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (type = ANY (ARRAY['avatar'::text, 'deity'::text]))
//   CHECK (status = ANY (ARRAY['queued'::text, 'in_progress'::text, 'done'::text]))
export const tickets = pgTable('tickets', {
	ticketId: text('ticket_id').primaryKey(),
	type: text('type').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	status: text('status').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	completedAt: timestamp('completed_at', { mode: 'date', withTimezone: false }),
	completedBy: text('completed_by'),
	notes: text('notes'),
});

// title_catalog — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((source)::text = ANY ((ARRAY['believer'::character varying, 'rank_season'::character varying, 'boss_feat'::character varying, 'collection'::character varying, 'event'::character varying])::text[])))
export const titleCatalog = pgTable(
	'title_catalog',
	{
		titleId: integer('title_id').primaryKey().generatedByDefaultAsIdentity(),
		code: text('code').notNull(),
		display: text('display').notNull(),
		source: text('source').notNull(),
		isRepeatable: boolean('is_repeatable').notNull().default(true),
		howTo: text('how_to'),
		imageFilename: text('image_filename'),
	},
	(table) => ({
		unique0: unique('title_catalog_unique_0').on(table.code),
	}),
);

// topgg_vote_events — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK ( (rewarded_at IS NULL AND streak_number IS NULL AND random_reward IS NULL AND milestone_reward IS NULL AND outcome <> 'rewarded') OR (rewarded_at IS NOT NULL AND streak_number IS NOT NULL AND random_reward IS NOT NULL AND outcome = 'rewarded') )
export const topggVoteEvents = pgTable('topgg_vote_events', {
	topggVoteId: text('topgg_vote_id').primaryKey(),
	eventType: text('event_type').notNull(),
	discordId: text('discord_id').notNull(),
	topggUserId: text('topgg_user_id'),
	votedAt: timestamp('voted_at', { mode: 'date', withTimezone: false }).notNull(),
	expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: false }),
	weight: integer('weight').notNull().default(1),
	dailyCycle: text('daily_cycle').notNull(),
	deliveryTrace: text('delivery_trace'),
	outcome: text('outcome').notNull(),
	streakNumber: integer('streak_number'),
	randomReward: text('random_reward'),
	milestoneReward: text('milestone_reward'),
	rewardedAt: timestamp('rewarded_at', { mode: 'date', withTimezone: false }),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// user_armors — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enhancement >= 1) AND (enhancement <= 11)))
export const userArmors = pgTable('user_armors', {
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId),
	armorId: text('armor_id').primaryKey(),
	armorRosterId: integer('armor_roster_id')
		.notNull()
		.references(() => armorRoster.armorRosterId),
	currHp: integer('curr_hp').notNull(),
	currDef: integer('curr_def').notNull(),
	enhancement: integer('enhancement').notNull().default(1),
	baseHp: integer('base_hp').notNull(),
	baseDef: integer('base_def').notNull(),
	nativeSockets: jsonb('native_sockets').notNull(),
	oppositeSockets: jsonb('opposite_sockets').notNull(),
	isLocked: boolean('is_locked').notNull().default(false),
	obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// user_character — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((class)::text = ANY ((ARRAY['Swordsman'::character varying, 'Fighter'::character varying, 'Mage'::character varying, 'Knight'::character varying, 'Archer'::character varying])::text[])))
//   CHECK (((combat_level >= 1) AND (combat_level <= 50)))
//   CHECK (active_preset_slot = ANY (ARRAY[1, 2]))
//   CHECK (highest_raid_streak >= 0)
//   CHECK (highest_rank_streak >= 0)
export const userCharacter = pgTable('user_character', {
	discordId: text('discord_id')
		.primaryKey()
		.references(() => users.discordId, { onDelete: 'cascade' }),
	class: text('class').notNull(),
	combatLevel: integer('combat_level').notNull().default(1),
	combatExp: integer('combat_exp').notNull().default(0),
	activePresetSlot: integer('active_preset_slot').notNull().default(1),
	highestRaidStreak: integer('highest_raid_streak').notNull().default(0),
	highestRankStreak: integer('highest_rank_streak').notNull().default(0),
	equippedWeaponId: text('equipped_weapon_id').references(() => userWeapons.weaponId, { onDelete: 'set null' }),
	activeDeityId: integer('active_deity_id').references(() => userDeities.userDeityId, { onDelete: 'set null' }),
	raidsWon: integer('raids_won').notNull().default(0),
	raidsLost: integer('raids_lost').notNull().default(0),
	pvpWins: integer('pvp_wins').notNull().default(0),
	pvpLosses: integer('pvp_losses').notNull().default(0),
	believerLevel: integer('believer_level').notNull().default(1),
	believerExp: integer('believer_exp').notNull().default(0),
	reputationExpToday: integer('reputation_exp_today').notNull().default(0),
	reputationExpResetDate: text('reputation_exp_reset_date'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	equippedArmorId: text('equipped_armor_id').references(() => userArmors.armorId, { onDelete: 'set null' }),
	activeDeityId2: integer('active_deity_id_2').references(() => userDeities.userDeityId, { onDelete: 'set null' }),
	activeDeityId3: integer('active_deity_id_3').references(() => userDeities.userDeityId, { onDelete: 'set null' }),
	pvpRating: integer('pvp_rating').notNull().default(1000),
	bossKills: integer('boss_kills').notNull().default(0),
	equippedTitleId: integer('equipped_title_id').references(() => titleCatalog.titleId, { onDelete: 'set null' }),
	activeEchoDeityId: integer('active_echo_deity_id').references(() => userDeities.userDeityId, {
		onDelete: 'set null',
	}),
	pvpPeak: integer('pvp_peak').notNull().default(1000),
	lastWeeklyClaimWeek: integer('last_weekly_claim_week'),
	pvpDemotionShield: boolean('pvp_demotion_shield').notNull().default(true),
	bossTopDamage: integer('boss_top_damage').notNull().default(0),
	lifetimeExp: integer('lifetime_exp').notNull().default(0),
});

// user_cosmetics — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((source)::text = ANY ((ARRAY['base'::character varying, 'shop'::character varying, 'founder'::character varying, 'grant'::character varying])::text[])))
export const userCosmetics = pgTable(
	'user_cosmetics',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		cosmeticId: integer('cosmetic_id')
			.notNull()
			.references(() => cosmeticCatalog.cosmeticId, { onDelete: 'cascade' }),
		source: text('source').notNull(),
		acquiredAt: timestamp('acquired_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.cosmeticId] }),
	}),
);

// user_deities — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enhancement >= 1) AND (enhancement <= 11)))
export const userDeities = pgTable(
	'user_deities',
	{
		userDeityId: integer('user_deity_id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		deityId: integer('deity_id')
			.notNull()
			.references(() => deityRoster.deityId),
		currAtk: integer('curr_atk').notNull(),
		currHp: integer('curr_hp').notNull(),
		currDef: integer('curr_def').notNull(),
		enhancement: integer('enhancement').notNull().default(1),
		obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
		lastPullDate: text('last_pull_date').notNull(),
		sigils: integer('sigils').notNull().default(0),
		ascended: boolean('ascended').notNull().default(false),
	},
	(table) => ({
		unique0: unique('user_deities_unique_0').on(table.discordId, table.deityId),
	}),
);

export const userGuildActivity = pgTable(
	'user_guild_activity',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		guildId: text('guild_id').notNull(),
		lastActive: timestamp('last_active', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.guildId] }),
	}),
);

// user_presets — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (slot = ANY (ARRAY[1, 2]))
//   CHECK ( equipped_echo_deity_id IS NULL OR equipped_echo_deity_id IS NOT DISTINCT FROM equipped_deity_2_id OR equipped_echo_deity_id IS NOT DISTINCT FROM equipped_deity_3_id )
export const userPresets = pgTable(
	'user_presets',
	{
		id: integer(
			'id',
		).primaryKey() /* was GENERATED BY DEFAULT AS IDENTITY -> use autoIncrement via {autoIncrement:true} if needed */,
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId, { onDelete: 'cascade' }),
		slot: integer('slot').notNull(),
		name: text('name'),
		equippedDeity1Id: integer('equipped_deity_1_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedDeity2Id: integer('equipped_deity_2_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedDeity3Id: integer('equipped_deity_3_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedEchoDeityId: integer('equipped_echo_deity_id').references(() => userDeities.userDeityId, {
			onDelete: 'set null',
		}),
		equippedArmorId: text('equipped_armor_id').references(() => userArmors.armorId, { onDelete: 'set null' }),
		equippedWeaponId: text('equipped_weapon_id').references(() => userWeapons.weaponId, { onDelete: 'set null' }),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		unique0: unique('user_presets_unique_0').on(table.discordId, table.slot),
	}),
);

export const userRunes = pgTable('user_runes', {
	runeUid: text('rune_uid').primaryKey(),
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId),
	runeId: integer('rune_id')
		.notNull()
		.references(() => runeRoster.runeId),
	socketedInto: text('socketed_into'),
	isLocked: boolean('is_locked').notNull().default(false),
	obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	rolledValue: real('rolled_value'),
});

export const userTitles = pgTable(
	'user_titles',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		titleId: integer('title_id')
			.notNull()
			.references(() => titleCatalog.titleId),
		earnedAt: timestamp('earned_at', { mode: 'date', withTimezone: false })
			.notNull()
			.default(sql`now()`),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.titleId] }),
	}),
);

// user_weapons — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((enhancement >= 1) AND (enhancement <= 11)))
export const userWeapons = pgTable('user_weapons', {
	discordId: text('discord_id')
		.notNull()
		.references(() => users.discordId),
	weaponId: text('weapon_id').primaryKey(),
	weaponRosterId: integer('weapon_roster_id')
		.notNull()
		.references(() => weaponRoster.weaponRosterId),
	currAtk: integer('curr_atk').notNull(),
	enhancement: integer('enhancement').notNull().default(1),
	baseAtk: integer('base_atk').notNull(),
	crit: real('crit').notNull(),
	bonusDmgPct: real('bonus_dmg_pct'),
	isLocked: boolean('is_locked').notNull().default(false),
	obtainedAt: timestamp('obtained_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	nativeSockets: jsonb('native_sockets').notNull(),
	oppositeSockets: jsonb('opposite_sockets').notNull(),
});

export const users = pgTable('users', {
	discordId: text('discord_id').primaryKey(),
	username: text('username').notNull(),
	monthlyStreak: integer('monthly_streak').notNull().default(0),
	overallStreak: integer('overall_streak').notNull().default(0),
	lastDailyClaimDate: text('last_daily_claim_date'),
	lastBestowReceived: text('last_bestow_received'),
	bestowReceivedToday: integer('bestow_received_today').notNull().default(0),
	lastBossAttackDate: text('last_boss_attack_date'),
	isBanned: boolean('is_banned').notNull().default(false),
	registeredAt: timestamp('registered_at', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
	questRefreshesToday: integer('quest_refreshes_today').notNull().default(0),
	lastQuestRefreshDate: text('last_quest_refresh_date'),
});

// users_bag — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (custom_avatar_token >= 0)
//   CHECK (custom_deity_token >= 0)
export const usersBag = pgTable('users_bag', {
	discordId: text('discord_id')
		.primaryKey()
		.references(() => users.discordId),
	credux: integer('credux').notNull().default(0),
	beliefShards: integer('belief_shards').notNull().default(0),
	sacredRelics: integer('sacred_relics').notNull().default(0),
	supremeRelics: integer('supreme_relics').notNull().default(0),
	silverChest: integer('silver_chest').notNull().default(0),
	goldChest: integer('gold_chest').notNull().default(0),
	bossTreasureChest: integer('boss_treasure_chest').notNull().default(0),
	bossGoldenChest: integer('boss_golden_chest').notNull().default(0),
	supremeChest: integer('supreme_chest').notNull().default(0),
	epicEssence: integer('epic_essence').notNull().default(0),
	mythicEssence: integer('mythic_essence').notNull().default(0),
	legendaryEssence: integer('legendary_essence').notNull().default(0),
	supremeEssence: integer('supreme_essence').notNull().default(0),
	lifetimeCreduxEarned: integer('lifetime_credux_earned').notNull().default(0),
	lesserRuneBag: integer('lesser_rune_bag').notNull().default(0),
	greaterRuneBag: integer('greater_rune_bag').notNull().default(0),
	divineRuneBag: integer('divine_rune_bag').notNull().default(0),
	valorMedals: integer('valor_medals').notNull().default(0),
	customAvatarToken: integer('custom_avatar_token').notNull().default(0),
	customDeityToken: integer('custom_deity_token').notNull().default(0),
	changeClass: integer('change_class').notNull().default(0),
	diamondChest: integer('diamond_chest').notNull().default(0),
	genesisChest: integer('genesis_chest').notNull().default(0),
});

export const wagerLogs = pgTable('wager_logs', {
	id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
	challengerId: text('challenger_id').notNull(),
	opponentId: text('opponent_id').notNull(),
	winnerId: text('winner_id').notNull(),
	amount: integer('amount').notNull(),
	timestamp: timestamp('timestamp', { mode: 'date', withTimezone: false })
		.notNull()
		.default(sql`now()`),
});

// weapon_roster — original CHECK constraints (enforce in application/service layer, SQLite CHECK optional):
//   CHECK (((tier)::text = ANY ((ARRAY['Common'::character varying, 'Rare'::character varying, 'Mythic'::character varying, 'Legendary'::character varying, 'Supreme'::character varying])::text[])))
//   CHECK (((type)::text = ANY ((ARRAY['Sword'::character varying, 'Staff'::character varying, 'Gloves'::character varying, 'Bow'::character varying])::text[])))
export const weaponRoster = pgTable('weapon_roster', {
	weaponRosterId: integer('weapon_roster_id').primaryKey().generatedByDefaultAsIdentity(),
	name: text('name').notNull(),
	type: text('type').notNull(),
	tier: text('tier').notNull(),
	mythology: text('mythology').notNull(),
	passiveKey: text('passive_key').notNull(),
	passiveName: text('passive_name').notNull(),
	passiveDescription: text('passive_description').notNull(),
	lore: text('lore'),
	imageFilename: text('image_filename'),
	isAvailable: boolean('is_available').notNull().default(true),
});

export const weeklyGrand = pgTable(
	'weekly_grand',
	{
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		questWeek: integer('quest_week').notNull(),
		claimed: boolean('claimed').notNull().default(false),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.discordId, table.questWeek] }),
	}),
);

export const weeklyQuests = pgTable(
	'weekly_quests',
	{
		id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
		discordId: text('discord_id')
			.notNull()
			.references(() => users.discordId),
		questType: text('quest_type').notNull(),
		targetCount: integer('target_count').notNull(),
		currentCount: integer('current_count').notNull().default(0),
		rewardCredux: integer('reward_credux').notNull(),
		rewardValor: integer('reward_valor').notNull(),
		completed: boolean('completed').notNull().default(false),
		questWeek: integer('quest_week').notNull(),
	},
	(table) => ({
		unique0: unique('weekly_quests_unique_0').on(table.discordId, table.questType, table.questWeek),
	}),
);
