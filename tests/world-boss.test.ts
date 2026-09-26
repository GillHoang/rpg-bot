import { describe, expect, it, vi } from 'vitest';
import { WorldBossService } from '../src/modules/pve/application/WorldBossService.js';
import {
	WORLD_BOSS,
	worldBossKillChest,
	worldBossKillCredux,
} from '../src/shared/config/worldBoss.js';
import type { BattleResult } from '../src/modules/combat-shared/domain/BattleEngine.js';
import type { PlayerAccount } from '../src/modules/identity/domain/PlayerAccount.js';

function testPersistence() {
	return { unitOfWork: { run: async <T>(fn: (tx: object) => Promise<T>): Promise<T> => fn({}) } } as never;
}

const ASSEMBLED = {
	stats: { atk: 5000, hp: 20000, def: 500, crit: 5, spd: 120, acc: 10, eva: 5, ten: 10 },
	combatEffectRunes: [],
	blessings: [],
	weaponPassive: null,
	damageType: 'physical',
	armorType: 'medium',
	skills: [],
	stance: 'balanced',
	branch: null,
	runeResonance: [],
} as never;

const ACCOUNT = { username: 'Hero', combatClass: 'Knight', combatLevel: 50 } as unknown as PlayerAccount;

function battle(enemyHpRemaining: number, outcome: BattleResult['outcome'] = 'player_win'): BattleResult {
	return { outcome, rounds: 5, log: [], roundLogs: [], playerHpRemaining: 100, enemyHpRemaining };
}

interface BossRow {
	spawnId: string;
	currentHp: number;
	status: string;
	expiresAt: Date;
}

function harness(opts: {
	boss?: BossRow[] | null;
	attack?: Record<string, unknown>[];
	auto?: Record<string, unknown>[];
	battle?: BattleResult;
	board?: Record<string, unknown>[];
	usernames?: Record<string, string>;
}) {
	const bossRows = opts.boss === undefined ? [] : opts.boss;
	const queries = {
		lockBag: vi.fn().mockResolvedValue([{}]),
		lockCharacter: vi.fn().mockResolvedValue([
			{ combatLevel: 50, combatExp: 0, lifetimeExp: 0, bossTopDamage: 0 },
		]),
		findReceipt: vi.fn().mockResolvedValue([]),
		insertReceipt: vi.fn().mockResolvedValue([]),
		updateCharacter: vi.fn().mockResolvedValue([]),
	};
	const bosses = {
		findBoss: vi.fn().mockResolvedValue(bossRows),
		insertBoss: vi.fn().mockResolvedValue([]),
		updateBoss: vi.fn().mockResolvedValue([]),
		findAttack: vi.fn().mockResolvedValue(opts.attack ?? []),
		upsertAttack: vi.fn().mockResolvedValue([]),
		topAttackers: vi.fn().mockResolvedValue(opts.board ?? []),
		countAttackers: vi.fn().mockResolvedValue(0),
		recordSpawn: vi.fn().mockResolvedValue([]),
		findAuto: vi.fn().mockResolvedValue(opts.auto ?? []),
		upsertAuto: vi.fn().mockResolvedValue([]),
		grantPurse: vi.fn().mockResolvedValue([]),
	};
	const accounts = {
		findByIdWithExecutor: vi
			.fn()
			.mockImplementation(async (_tx: unknown, id: string) =>
				id === 'hero' ? ACCOUNT : ({ username: opts.usernames?.[id] ?? id } as unknown as PlayerAccount),
			),
	};
	const service = new WorldBossService({
		accounts,
		characters: { hasCharacter: vi.fn().mockResolvedValue(true) },
		statAssembly: { assemble: vi.fn().mockResolvedValue(ASSEMBLED) },
		events: { emit: vi.fn() },
		clock: { now: () => new Date('2026-03-02T12:00:00+07:00') },
		persistence: testPersistence(),
		queries,
		bosses: bosses as never,
		engine: { resolve: vi.fn().mockReturnValue(opts.battle ?? battle(WORLD_BOSS.maxHp - 12345)) },
	});
	return { service, queries, bosses, accounts };
}

const ACTIVE: BossRow = {
	spawnId: 'spawn-1',
	currentHp: WORLD_BOSS.maxHp,
	status: 'active',
	expiresAt: new Date('2026-04-01T00:00:00+07:00'),
};

describe('world boss config (Phase 5a)', () => {
	it('tiers the kill purse by rank', () => {
		expect(worldBossKillCredux(1)).toBe(500_000);
		expect(worldBossKillCredux(3)).toBe(200_000);
		expect(worldBossKillCredux(10)).toBe(100_000);
		expect(worldBossKillCredux(11)).toBe(50_000);
		expect(worldBossKillChest(1)).toBe('supremeChest');
		expect(worldBossKillChest(2)).toBe('bossGoldenChest');
		expect(worldBossKillChest(10)).toBe('bossTreasureChest');
		expect(worldBossKillChest(11)).toBeNull();
	});
});

describe('WorldBossService.attack', () => {
	it('spawns the boss lazily on first attack and records the spawn queue', async () => {
		const { service, bosses } = harness({});
		const result = await service.attack('guild-1', 'hero', 'req-1');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.spawned).toBe(true);
		expect(result.contribution).toBe(12345);
		expect(result.totalDamage).toBe(12345);
		expect(result.bossHpRemaining).toBe(WORLD_BOSS.maxHp - 12345);
		expect(bosses.insertBoss).toHaveBeenCalled();
		expect(bosses.recordSpawn).toHaveBeenCalled();
		expect(bosses.upsertAttack).toHaveBeenCalled();
	});

	it('caps each contribution at 10% of the pool (anti-exploit)', async () => {
		const { service } = harness({ boss: [ACTIVE], battle: battle(0) });
		const result = await service.attack('guild-1', 'hero', 'req-2');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.contribution).toBe(Math.floor(WORLD_BOSS.maxHp * WORLD_BOSS.maxContributionPct));
	});

	it('enforces the daily budget and grants auto subscribers +2', async () => {
		const spent = [{ totalDamage: 100, dailyAttacks: 3, lastDailyReset: '2026-03-02' }];
		const capped = harness({ boss: [ACTIVE], attack: spent });
		expect((await capped.service.attack('guild-1', 'hero')).status).toBe('capped');
		const auto = harness({
			boss: [ACTIVE],
			attack: spent,
			auto: [{ endsAt: new Date('2026-04-01T00:00:00+07:00') }],
		});
		const result = await auto.service.attack('guild-1', 'hero');
		expect(result.status).toBe('ok');
	});

	it('kills the boss, pays the purse by rank and records top damage', async () => {
		const dying: BossRow = { ...ACTIVE, currentHp: 100 };
		const board = [
			{ discordId: 'hero', totalDamage: 9000 },
			{ discordId: 'ally', totalDamage: 1000 },
		];
		const { service, bosses, queries } = harness({ boss: [dying], board });
		const result = await service.attack('guild-1', 'hero', 'req-kill');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.killed).toBe(true);
		expect(result.bossHpRemaining).toBe(0);
		expect(result.rank).toBe(1);
		expect(result.killCredux).toBe(500_000);
		expect(result.killChest).toBe('supremeChest');
		expect(bosses.updateBoss).toHaveBeenCalledWith(expect.anything(), 'guild-1', expect.objectContaining({ status: 'dead' }));
		// Both participants paid in one transaction.
		expect(bosses.grantPurse).toHaveBeenCalledTimes(2);
		expect(queries.updateCharacter).toHaveBeenCalledWith(
			expect.anything(),
			'hero',
			expect.objectContaining({ bossTopDamage: result.totalDamage }),
		);
	});

	it('rejects attacks on a dead boss and duplicate receipts', async () => {
		const dead = harness({ boss: [{ ...ACTIVE, status: 'dead' }] });
		expect((await dead.service.attack('guild-1', 'hero')).status).toBe('dead');
		const dup = harness({ boss: [ACTIVE] });
		dup.queries.findReceipt.mockResolvedValue([{}]);
		expect((await dup.service.attack('guild-1', 'hero', 'seen')).status).toBe('already-processed');
	});

	it('requires a guild and a registered character', async () => {
		const { service } = harness({ boss: [ACTIVE] });
		expect((await service.attack(null, 'hero')).status).toBe('no-guild');
	});
});

describe('WorldBossService.board + toggleAuto', () => {
	it('ranks contributors with resolved names', async () => {
		const { service } = harness({
			boss: [ACTIVE],
			board: [
				{ discordId: 'hero', totalDamage: 5000 },
				{ discordId: 'ally', totalDamage: 3000 },
			],
			usernames: { ally: 'Ally' },
		});
		const board = await service.board('guild-1');
		expect(board).toEqual([
			{ rank: 1, discordId: 'hero', name: 'Hero', totalDamage: 5000 },
			{ rank: 2, discordId: 'ally', name: 'Ally', totalDamage: 3000 },
		]);
		expect(await service.board(null)).toEqual([]);
	});

	it('toggles the auto-raid subscription', async () => {
		const { service, bosses } = harness({});
		const on = await service.toggleAuto('hero');
		expect(on.active).toBe(true);
		expect(bosses.upsertAuto).toHaveBeenCalled();
		const off = harness({ auto: [{ endsAt: new Date('2026-04-01T00:00:00+07:00'), startedAt: new Date(), combatLevel: 50 }] });
		const result = await off.service.toggleAuto('hero');
		expect(result.active).toBe(false);
	});
});
