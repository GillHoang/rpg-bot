import { describe, expect, it, vi } from 'vitest';
import {
	TOWER,
	towerCreduxForFloor,
	towerExpForFloor,
	towerGateModifiers,
	towerLevelForFloor,
	towerMobKind,
} from '../src/shared/config/tower.js';
import { TowerService, type TowerRunOptions } from '../src/modules/pve/application/TowerService.js';
import type { MonsterStats } from '../src/modules/pve/application/MonsterEncounterService.js';
import { weekWindowAt } from '../src/shared/config/ranked.js';
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

function strongMonster(): MonsterStats {
	return { ...weakMonster(), name: 'Titan', hp: 5_000_000, atk: 50_000, def: 5000 };
}

interface CharacterRow {
	combatLevel: number;
	combatExp: number;
	lifetimeExp: number;
	towerFloor: number;
	towerWeek: string | null;
}

function harness(opts: {
	character: CharacterRow;
	monster?: MonsterStats | null;
	clock?: Date;
	receipt?: boolean;
}) {
	const updates: Record<string, unknown>[] = [];
	const bagUpdates: Record<string, unknown>[] = [];
	const queries = {
		lockBag: vi.fn().mockResolvedValue([{ credux: 0, lifetimeCreduxEarned: 0 }]),
		lockCharacter: vi.fn().mockResolvedValue([{ ...opts.character }]),
		findReceipt: vi.fn().mockResolvedValue(opts.receipt ? [{}] : []),
		insertReceipt: vi.fn().mockResolvedValue([]),
		updateCharacter: vi.fn((...args: unknown[]) => {
			updates.push(args[2] as Record<string, unknown>);
			return Promise.resolve([]);
		}),
		updateBag: vi.fn((...args: unknown[]) => {
			bagUpdates.push(args[2] as Record<string, unknown>);
			return Promise.resolve([]);
		}),
	};
	const service = new TowerService({
		accounts: { findByIdWithExecutor: vi.fn().mockResolvedValue(ACCOUNT) },
		monsters: { pickForLevel: vi.fn().mockResolvedValue(opts.monster === undefined ? weakMonster() : opts.monster) },
		characters: { hasCharacter: vi.fn().mockResolvedValue(true) },
		statAssembly: { assemble: vi.fn().mockResolvedValue(ASSEMBLED) },
		events: { emit: vi.fn() },
		clock: { now: () => opts.clock ?? new Date('2026-03-02T12:00:00+07:00') },
		persistence: testPersistence(),
		queries,
	});
	return { service, queries, updates, bagUpdates };
}

const WEEK = weekWindowAt(new Date('2026-03-02T12:00:00+07:00')).key;

function freshCharacter(): CharacterRow {
	return { combatLevel: 50, combatExp: 0, lifetimeExp: 0, towerFloor: 0, towerWeek: null };
}

describe('tower config (Phase 4e)', () => {
	it('scales level past the portal curve and caps at 100', () => {
		expect(towerLevelForFloor(1)).toBe(56);
		expect(towerLevelForFloor(20)).toBe(75);
		expect(towerLevelForFloor(100)).toBe(100);
		expect(towerLevelForFloor(999)).toBe(100);
	});

	it('marks every 10th floor a final boss and 5th floors elite', () => {
		expect(towerMobKind(3)).toEqual({ mobType: 'regular', finalBoss: false });
		expect(towerMobKind(5)).toEqual({ mobType: 'elite', finalBoss: false });
		expect(towerMobKind(10)).toEqual({ mobType: 'boss', finalBoss: true });
		expect(towerMobKind(100)).toEqual({ mobType: 'boss', finalBoss: true });
	});

	it('cycles gate identity per block and adds enrage deep in the climb', () => {
		expect(towerGateModifiers(1).modifier).toBe('none');
		expect(towerGateModifiers(11).modifier).toBe('tanky');
		expect(towerGateModifiers(31).modifier2).toBe('enrage');
		expect(towerGateModifiers(30).modifier2).toBe('none');
	});

	it('pays per floor with a first-clear double', () => {
		expect(towerCreduxForFloor(1, false)).toBe(TOWER.creduxPerFloor);
		expect(towerCreduxForFloor(3, true)).toBe(TOWER.creduxPerFloor * 3 * 2);
		expect(towerExpForFloor(4)).toBe(TOWER.expPerFloor * 4);
	});
});

describe('TowerService', () => {
	async function run(
		service: TowerService,
		options: TowerRunOptions = {},
	): Promise<Extract<Awaited<ReturnType<TowerService['run']>>, { status: 'ok' }>> {
		const result = await service.run('hero', options);
		if (result.status !== 'ok') throw new Error(`expected ok, got ${result.status}`);
		return result;
	}

	it('wins floor 1 with first-clear double rewards and records the best', async () => {
		const { service, queries, updates, bagUpdates } = harness({ character: freshCharacter() });
		const result = await run(service);
		expect(result.floor).toBe(1);
		expect(result.battle.outcome).toBe('player_win');
		expect(result.newBest).toBe(true);
		expect(result.credux).toBe(towerCreduxForFloor(1, true));
		expect(result.expGained).toBe(towerExpForFloor(1));
		expect(queries.updateCharacter).toHaveBeenCalled();
		expect(updates[0]).toMatchObject({ towerFloor: 1, towerWeek: WEEK });
		expect(bagUpdates[0]).toMatchObject({ credux: result.credux });
	});

	it('defaults to best+1 and locks skipped floors', async () => {
		const { service } = harness({
			character: { ...freshCharacter(), towerFloor: 2, towerWeek: WEEK },
		});
		const result = await run(service);
		expect(result.floor).toBe(3);
		const locked = await service.run('hero', { floor: 5 });
		expect(locked.status).toBe('tower-locked');
		const invalid = await service.run('hero', { floor: 0 });
		expect(invalid.status).toBe('tower-locked');
	});

	it('replays a cleared floor without first-clear bonus or best change', async () => {
		const { service, updates } = harness({
			character: { ...freshCharacter(), towerFloor: 4, towerWeek: WEEK },
		});
		const result = await run(service, { floor: 2 });
		expect(result.newBest).toBe(false);
		expect(result.credux).toBe(towerCreduxForFloor(2, false));
		expect(updates.some((u) => 'towerFloor' in u)).toBe(false);
	});

	it('resets the best on a new ISO week', async () => {
		const { service } = harness({
			character: { ...freshCharacter(), towerFloor: 9, towerWeek: '2020-W01' },
			clock: new Date('2026-03-02T12:00:00+07:00'),
		});
		const result = await run(service);
		expect(result.floor).toBe(1);
		expect(result.newBest).toBe(true);
	});

	it('records losses without rewards or progress', async () => {
		const { service, queries } = harness({ character: freshCharacter(), monster: strongMonster() });
		const result = await run(service);
		expect(result.battle.outcome).toBe('enemy_win');
		expect(result.credux).toBe(0);
		expect(result.expGained).toBe(0);
		expect(queries.updateCharacter).not.toHaveBeenCalled();
		expect(queries.updateBag).not.toHaveBeenCalled();
	});

	it('labels every 10th floor as a boss encounter', async () => {
		const { service } = harness({
			character: { ...freshCharacter(), towerFloor: 9, towerWeek: WEEK },
		});
		const result = await run(service, { floor: 10 });
		expect(result.monsterName).toContain('Boss');
		expect(result.newBest).toBe(true);
	});

	it('returns already-processed on duplicate receipts and no-monsters on empty roster', async () => {
		const dup = harness({ character: freshCharacter(), receipt: true });
		expect((await dup.service.run('hero', { requestId: 'seen' })).status).toBe('already-processed');
		const empty = harness({ character: freshCharacter(), monster: null });
		expect((await empty.service.run('hero')).status).toBe('no-monsters-seeded');
	});
});
