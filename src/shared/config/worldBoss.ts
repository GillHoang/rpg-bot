/**
 * Phase 5 World Boss (battle-upgrade-plan.md §Trục E): one shared boss per
 * Discord guild. Everyone contributes damage; rewards split by contribution
 * rank when the pool hits zero. Lazy spawn (no cron): the first attack of
 * the week spawns the boss with a 7-day expiry.
 */
export const WORLD_BOSS = {
	/** Shared HP pool per spawn. */
	maxHp: 50_000_000,
	/** Boss battle stats (Bakunawa AI via `moon_threshold`). */
	atk: 12000,
	def: 4000,
	crit: 10,
	spd: 110,
	acc: 20,
	eva: 10,
	ten: 60,
	skillKey: 'moon_threshold',
	/** Roster species of the World Boss (seeded Bakunawa, `moon_threshold` AI). */
	mobId: 201,
	/** Free attacks per player per day; auto_raids subscribers get the bonus pool. */
	dailyAttacks: 3,
	autoDailyAttacks: 5,
	/** Per-attack contribution cap (fraction of max HP, anti-exploit). */
	maxContributionPct: 0.1,
	/** Boss lifetime per spawn. */
	ttlMs: 7 * 24 * 3_600_000,
} as const;

/** Credux by kill rank (participants outside the board get the base purse). */
export function worldBossKillCredux(rank: number): number {
	if (rank === 1) return 500_000;
	if (rank <= 3) return 200_000;
	if (rank <= 10) return 100_000;
	return 50_000;
}

/** Chest prize by kill rank (null = credux only). */
export function worldBossKillChest(rank: number): 'supremeChest' | 'bossGoldenChest' | 'bossTreasureChest' | null {
	if (rank === 1) return 'supremeChest';
	if (rank <= 3) return 'bossGoldenChest';
	if (rank <= 10) return 'bossTreasureChest';
	return null;
}
