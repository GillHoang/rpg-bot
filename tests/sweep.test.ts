import { describe, expect, it, vi } from 'vitest';
import { SweepService, SWEEP_RATE } from '../src/modules/pve/application/SweepService.js';
import type { MonsterStats } from '../src/modules/pve/application/MonsterEncounterService.js';
import type { PlayerAccount } from '../src/modules/identity/domain/PlayerAccount.js';

function testPersistence() {
	return { unitOfWork: { run: async <T>(fn: (tx: object) => Promise<T>): Promise<T> => fn({}) } } as never;
}

const ACCOUNT = { username: 'Hero', combatClass: 'Knight', combatLevel: 50 } as unknown as PlayerAccount;

function weakMonster(): MonsterStats {
	return {
		name: 'Ant',
		hp: 100,
		atk: 10,
		def: 0,
		crit: 0,
		spd: 50,
		acc: 0,
		eva: 0,
		ten: 0,
		regenPct: 0,
		damageType: 'physical',
		armorType: 'light',
		mobType: 'regular',
		skillKey: 'none',
		immunityTags: [],
		affixes: [],
		modifiers: [],
		finalBoss: false,
	};
}

function harness(opts: {
	cleared?: number[];
	cooldown?: boolean;
	monster?: MonsterStats | null;
	account?: PlayerAccount | null;
}) {
	const cleared = opts.cleared ?? [10, 0, 0, 0, 0];
	const queries = {
		lockBag: vi.fn().mockResolvedValue([{}]),
		lockCharacter: vi.fn().mockResolvedValue([
			{
				gate1TiersCleared: cleared[0],
				gate2TiersCleared: cleared[1],
				gate3TiersCleared: cleared[2],
				gate4TiersCleared: cleared[3],
				gate5TiersCleared: cleared[4],
			},
		]),
		findReceipt: vi.fn().mockResolvedValue([]),
		insertReceipt: vi.fn().mockResolvedValue([]),
		lockHuntCooldown: vi.fn().mockResolvedValue(opts.cooldown ? [{ readyAt: new Date(Date.now() + 60_000) }] : []),
		upsertHuntCooldown: vi.fn().mockResolvedValue([]),
	};
	const grants: unknown[] = [];
	const service = new SweepService({
		accounts: { findByIdWithExecutor: vi.fn().mockResolvedValue(opts.account === undefined ? ACCOUNT : opts.account) },
		characters: { hasCharacter: vi.fn().mockResolvedValue(true) },
		monsters: { pickForLevel: vi.fn().mockResolvedValue(opts.monster === undefined ? weakMonster() : opts.monster) },
		rewards: {
			grant: vi.fn(async (_tx: unknown, _id: string, grant: Record<string, unknown>) => {
				grants.push(grant);
				return { previousLevel: 50, newLevel: 50, leveledUp: false };
			}),
		},
		progress: { apply: vi.fn().mockResolvedValue(undefined) },
		events: { emit: vi.fn() },
		clock: { now: () => new Date('2026-03-02T12:00:00+07:00') },
		persistence: testPersistence(),
		queries: queries as never,
		huntCooldownSeconds: 60,
	});
	return { service, queries, grants };
}

describe('SweepService (Phase 6b)', () => {
	it('sweeps a cleared tier at the sweep rate with no chest', async () => {
		const { service, grants, queries } = harness({});
		const result = await service.run('hero', { gate: 1, tier: 4, requestId: 'sw-1' });
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.gate).toBe(1);
		expect(result.tier).toBe(4);
		expect(result.expGained).toBeGreaterThanOrEqual(0);
		expect(result.credux).toBeGreaterThanOrEqual(0);
		expect(grants).toHaveLength(1);
		const grant = grants[0] as Record<string, unknown>;
		expect(grant.grantChest).toBe(false);
		expect(grant.boss).toBe(false);
		expect(grant.outcome).toBe('player_win');
		expect(queries.upsertHuntCooldown).toHaveBeenCalled();
		expect(queries.insertReceipt).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ kind: 'sweep' }),
		);
	});

	it('passes shards through unscaled and never grants chests', async () => {
		const { service, grants } = harness({});
		const result = await service.run('hero', { gate: 1, tier: 4 });
		if (result.status !== 'ok') throw new Error('unreachable');
		const grant = grants[0] as Record<string, unknown>;
		expect(grant.grantChest).toBe(false);
		expect(result.shards).toBe(grant.shards);
		expect(result.credux).toBe(grant.credux);
		expect(result.expGained).toBe((grant as { expGain: number }).expGain);
	});

	it('refuses uncleared tiers, cooldowns and duplicates', async () => {
		const cleared9 = harness({ cleared: [9, 0, 0, 0, 0] });
		expect((await cleared9.service.run('hero', { gate: 1, tier: 10 })).status).toBe('sweep-locked');
		const cold = harness({ cleared: [0, 0, 0, 0, 0] });
		expect((await cold.service.run('hero', { gate: 1 })).status).toBe('sweep-locked');
		expect((await harness({ cooldown: true }).service.run('hero', { gate: 1, tier: 1 })).status).toBe('cooldown');
		const dup = harness({});
		dup.queries.findReceipt.mockResolvedValue([{}]);
		expect((await dup.service.run('hero', { gate: 1, tier: 1, requestId: 'seen' })).status).toBe(
			'already-processed',
		);
	});

	it('handles missing accounts and empty rosters', async () => {
		expect((await harness({ account: null }).service.run('hero', { gate: 1, tier: 1 })).status).toBe(
			'not-registered',
		);
		expect((await harness({ monster: null }).service.run('hero', { gate: 1, tier: 1 })).status).toBe(
			'no-monsters-seeded',
		);
	});
});
