import { describe, expect, it, vi } from 'vitest';
import { PreviewService } from '../src/modules/pve/application/PreviewService.js';
import type { MonsterStats } from '../src/modules/pve/application/MonsterEncounterService.js';
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
	monster?: MonsterStats | null;
	account?: PlayerAccount | null;
	character?: Record<string, number> | null;
}) {
	const service = new PreviewService({
		accounts: { findByIdWithExecutor: vi.fn().mockResolvedValue(opts.account === undefined ? ACCOUNT : opts.account) },
		characters: { hasCharacter: vi.fn().mockResolvedValue(true) },
		monsters: { pickForLevel: vi.fn().mockResolvedValue(opts.monster === undefined ? weakMonster() : opts.monster) },
		statAssembly: { assemble: vi.fn().mockResolvedValue(ASSEMBLED) },
		persistence: testPersistence(),
		queries: {
			lockCharacter: vi.fn().mockResolvedValue(
				opts.character === undefined
					? [{ gate1TiersCleared: 10, gate2TiersCleared: 0, gate3TiersCleared: 0, gate4TiersCleared: 0, gate5TiersCleared: 0 }]
					: opts.character === null
						? []
						: [opts.character],
			),
		},
	});
	return service;
}

describe('PreviewService (Phase 6a)', () => {
	it('sims the current loadout deterministically without writing anything', async () => {
		const service = harness({});
		const first = await service.preview('hero', 1, 1, 10);
		const second = await service.preview('hero', 1, 1, 10);
		expect(first).toEqual(second);
		if (first.status !== 'ok') throw new Error('unreachable');
		expect(first.sims).toBe(10);
		expect(first.wins).toBe(10);
		expect(first.winRate).toBe(1);
		expect(first.avgDamageDealt).toBeGreaterThan(0);
		expect(first.monsterName).toBe('Ant');
		expect(first.gate).toBe(1);
		expect(first.tier).toBe(1);
	});

	it('reports losses honestly against overwhelming odds', async () => {
		const service = harness({
			monster: { ...weakMonster(), hp: 5_000_000, atk: 50_000, def: 5000 },
		});
		const result = await service.preview('hero', 1, 1, 5);
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.wins).toBe(0);
		expect(result.winRate).toBe(0);
	});

	it('locks cleared+2 tiers and clamps the sim count', async () => {
		const service = harness({});
		expect((await service.preview('hero', 2, 5, 10)).status).toBe('portal-locked');
		const clamped = await service.preview('hero', 1, 1, 0);
		if (clamped.status !== 'ok') throw new Error('unreachable');
		expect(clamped.sims).toBe(1);
	});

	it('handles missing accounts, characters and roster rows', async () => {
		expect((await harness({ account: null }).preview('ghost', 1, 1)).status).toBe('not-registered');
		expect((await harness({ character: null }).preview('hero', 1, 1)).status).toBe('no-character');
		expect((await harness({ monster: null }).preview('hero', 1, 1)).status).toBe('no-monsters-seeded');
	});
});
