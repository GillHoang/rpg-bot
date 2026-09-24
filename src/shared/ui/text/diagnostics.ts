/** Operational messages, validation failures and CLI output. Keep keys stable.
 * No runtime imports: safe to use during bootstrap and environment validation. */

/** index */
export const BOOT_LOG_TEXT = {
	unhandledRejection: 'Unhandled promise rejection',
	uncaughtException: 'Uncaught exception — exiting',
	bootstrapFailed: 'Fatal error during bootstrap',
} as const;

/** config/enhancement */
export const ENHANCEMENT_ERROR_TEXT = {
	invalidWeapon: (enhancement: number, tier: string): string =>
		`computeWeaponCurrAtk: invalid enhancement ${enhancement} for tier ${tier}`,
	invalidArmor: (enhancement: number, tier: string): string =>
		`computeArmorCurrStats: invalid enhancement ${enhancement} for tier ${tier}`,
} as const;

/** config/env */
export const ENV_ERROR_TEXT = {
	discordTokenRequired: 'DISCORD_TOKEN is required',
	clientIdRequired: 'DISCORD_CLIENT_ID is required',
	databaseUrlRequired: 'DATABASE_URL is required',
	invalidWebhook: 'Expected a Discord webhook URL',
	ownersRequired: 'OWNER_DISCORD_IDS is required (comma-separated Discord user IDs)',
	invalidOwners: 'OWNER_DISCORD_IDS must contain at least one numeric Discord ID',
	invalidGuild: 'DEPLOY_GUILD_ID must be a numeric guild ID',
	invalidConfiguration: 'Invalid environment configuration:',
} as const;

/** core/BotMaintenance */
export const MAINTENANCE_LOG_TEXT = {
	casinoRecoveryFailed: 'Casino expiry recovery failed',
} as const;

/** core/CommandRegistry */
export const COMMAND_LOG_TEXT = {
	duplicate: (name: string): string => `Duplicate command registration: "${name}"`,
	unknownCommand: 'Unknown command invoked',
	unknownReplyFailed: 'Unknown command reply failed',
	executionFailed: 'Command execution failed',
	errorReplyFailed: 'Failed to send error reply — interaction likely expired',
	autocompleteFailed: 'Autocomplete failed',
} as const;

/** core/DiscordBot */
export const BOT_LOG_TEXT = {
	clientError: 'Discord client error',
	shardError: 'Discord shard error',
	loggedIn: (tag: string): string => `Logged in as ${tag}`,
} as const;

/** core/Scheduler */
export const SCHEDULER_LOG_TEXT = {
	duelsSwept: 'Expired pending duels swept',
	sweepFailed: 'Scheduler sweep failed',
} as const;

/** db/migrate */
export const DATABASE_LOG_TEXT = {
	migrationsApplied: 'Migrations applied.',
} as const;

/** menu/MenuGameplayService */
export const MENU_ERROR_TEXT = {
	playerDisappeared: 'Menu player disappeared',
	invalidClass: 'Invalid class',
	unknownAction: 'Unknown gameplay action',
	missingBattleLog: 'No battle log',
	missingConfirmation: 'Confirmation missing',
} as const;

/** menu/MenuRouter */
export const MENU_LOG_TEXT = {
	openFailed: 'Menu open failed',
	interactionFailed: 'Menu interaction failed',
	recoveryFailed: 'Could not send menu recovery message',
} as const;

/** render/BattleLogPager */
export const BATTLE_LOG_DIAGNOSTICS = {
	interactionFailed: 'Battle log interaction failed',
	errorReplyFailed: 'Battle log error reply failed',
} as const;

/** repositories/CasinoRepository */
export const CASINO_REPOSITORY_ERROR_TEXT = {
	missingBag: (discordId: string): string => `settle: no users_bag row for ${discordId}`,
} as const;

/** repositories/DailyRepository */
export const DAILY_REPOSITORY_ERROR_TEXT = {
	missingBag: (discordId: string): string => `applyReward: no users_bag row for ${discordId}`,
} as const;

/** scripts/clearCommands */
export const CLEAR_COMMANDS_LOG_TEXT = {
	globalCleared: 'Global slash commands cleared.',
	guildCleared: 'Guild slash commands cleared.',
	failed: 'Failed to clear slash commands',
} as const;

/** scripts/commandScope */
export const COMMAND_SCOPE_ERROR_TEXT = {
	unknownArgument: (argument: string): string => `Unknown or repeated argument: ${argument}`,
	repeatedGuild: 'Specify --guild only once.',
	guildRequired: '--guild requires a numeric guild ID.',
	incompatibleGlobal: '--global cannot be combined with --guild or --all.',
	invalidDefaultGuild: 'Invalid default guild ID.',
	allRequiresGuild: '--all requires --guild <id> or DEPLOY_GUILD_ID.',
} as const;

/** scripts/deployCommands */
export const DEPLOY_COMMANDS_LOG_TEXT = {
	guildDeployed: (count: number, guildId: string): string => `Deployed ${count} command(s) to guild ${guildId}.`,
	globalDeployed: (count: number): string => `Deployed ${count} global slash command(s).`,
	failed: 'Failed to deploy commands',
} as const;

/** scripts/rolloverSeason */
export const SEASON_CLI_TEXT = {
	usage: 'Usage: pnpm season:rollover <expected-active-season-id>',
} as const;

/** seed/seed */
export const SEED_LOG_TEXT = {
	complete:
		'Seed complete: deities=%s, mobs=%s, weapons=%s, armors=%s, runes=%s, socketUnlockCosts=%s, essenceBags=%s, cosmetics=%s, titles=%s, rankedRewards=%s',
} as const;

/** services/AscensionService */
export const ASCENSION_ERROR_TEXT = {
	sigilMissingBag: (discordId: string): string => `addSigil: no users_bag row for ${discordId}`,
	ascendMissingBag: (discordId: string): string => `ascend: no users_bag row for ${discordId}`,
} as const;

/** services/EconomyService */
export const ECONOMY_ERROR_TEXT = {
	missingAccount: (discordId: string): string => `No account for ${discordId}; register first`,
} as const;

/** services/QuestService */
export const QUEST_ERROR_TEXT = {
	invalidProgress: 'Progress amount must be a positive integer',
} as const;

/** services/RaidRewardService */
export const RAID_REWARD_ERROR_TEXT = {
	missingCharacter: (discordId: string): string => `grant: no user_character row for ${discordId}`,
	missingBag: (discordId: string): string => `grant: no users_bag row for ${discordId}`,
} as const;

/** services/ResetService */
export const RESET_ERROR_TEXT = {
	missingAdministrator: 'Reset requires an administrator ID',
	invalidTarget: 'Reset target must be a numeric Discord ID',
} as const;

/** services/SocketService */
export const SOCKET_ERROR_TEXT = {
	invalidEssenceTier: 'Invalid socket essence tier',
} as const;

/** services/StartService */
export const START_ERROR_TEXT = {
	missingBag: (discordId: string): string => `start: no users_bag row for ${discordId}`,
} as const;

/** summon (RunSummonUseCase) */
export const SUMMON_ERROR_TEXT = {
	missingBag: (discordId: string): string => `run: no users_bag row for ${discordId}`,
	missingCharacter: (discordId: string): string => `run: no user_character row for ${discordId}`,
} as const;

/** modules/progression */
export const PROGRESSION_MODULE_ERROR_TEXT = {
	emptyDiscordId: 'UseCase requires discordId',
} as const;

/** utils/errorWebhook */
export const WEBHOOK_DIAGNOSTICS = {
	unknownError: 'Unknown error',
	fatal: 'Fatal error',
	error: 'Bot error',
	deliveryFailed: 'Error webhook delivery failed\n',
	formatFailed: 'Could not format error webhook notification\n',
} as const;

/** utils/idGenerator */
export const GEAR_ID_ERROR_TEXT = {
	exhausted: 'Failed to generate a unique gear id after 10 attempts',
} as const;

/** utils/progressBar */
export const PROGRESS_BAR_ERROR_TEXT = {
	nonFinite: 'current and max must be finite numbers',
	invalidCells: (min: number, max: number): string => `cells must be an integer in [${min}, ${max}]`,
} as const;

/** utils/weightedRandom */
export const RANDOM_ERROR_TEXT = {
	nonFiniteProbability: 'Probability must be finite',
} as const;

/** commands/casino/interactiveCasino */
export const CASINO_LOG_TEXT = {
	acknowledgementFailed: 'Casino button acknowledgement failed',
	interactionFailed: 'Casino interaction failed',
	timeoutFailed: 'Casino timeout failed; expiry worker will recover',
} as const;

/** commands/rpg/DuelCommand */
export const DUEL_LOG_TEXT = {
	interactionFailed: 'Duel interaction failed',
	errorReplyFailed: 'Duel error reply failed',
} as const;

/** domain/casino/CardDeck */
export const CARD_DECK_ERROR_TEXT = {
	exhausted: 'cardDeck: deck exhausted',
} as const;

/** domain/entities/PlayerAccount */
export const ACCOUNT_ERROR_TEXT = {
	insufficientCredux: (balance: number, amount: number): string =>
		`Insufficient credux: has ${balance}, needs ${amount}`,
	invalidEarning: (amount: number): string => `earn: amount must be a positive integer, got ${amount}`,
} as const;

/** modules/economy */
export const ECONOMY_MODULE_ERROR_TEXT = {
	emptyDiscordId: 'UseCase requires discordId',
} as const;

/** Stable operational event names. Preserve values used by log consumers. */
export const LOG_EVENT_TEXT = {
	command: 'command',
	eventObserverFailed: 'event-observer-failed',
	domainEvent: 'domain-event',
	seasonRollover: 'season-rollover',
	gearEnhanced: 'gear-enhanced',
	gearEnhanceFailed: 'gear-enhance-failed',
	gearEquipped: 'gear-equipped',
	presetSwitched: 'preset-switched',
	fullReset: 'full-reset',
	runeSocketed: 'rune-socketed',
	runeUnequipped: 'rune-unequipped',
	onboardingStart: 'onboarding-start',
	gameplayFailure: 'gameplay-failure',
	resetFailed: 'reset-failed',
	helpPageFailed: 'help-page-failed',
	inventoryPageFailed: 'inventory-page-failed',
	startButtonFailed: 'start-button-failed',
	startConfirmFailed: 'start-confirm-failed',
} as const;
