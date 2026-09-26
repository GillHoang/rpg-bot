import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { testPersistence } from './helpers/persistence.js';
import { eq } from 'drizzle-orm';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { NullClassStrategy } from '../src/modules/combat-shared/domain/classes/NullClassStrategy.js';
import {
	wrapWithWeaponPassive,
	WeaponPassiveDecorator,
} from '../src/modules/combat-shared/domain/WeaponPassiveDecorator.js';
import type { OutgoingHit, StrategyContext } from '../src/modules/combat-shared/domain/IClassStrategy.js';
import { PlayerCombatantFactory } from '../src/modules/combat-shared/application/combatantFactory.js';
import {
	WEAPON_QUALITIES,
	WEAPON_CRATE_COST,
	WEAPON_QUALITY_ATK_MULT,
	dismantleYield,
	isWeaponQuality,
	nextWeaponQuality,
	rollCrateTier,
	rollWeaponQuality,
	sellValue,
	WEAPON_UPGRADE_COSTS,
} from '../src/shared/config/weaponQuality.js';
import * as rngModule from '../src/modules/combat-shared/domain/Rng.js';
import { WeaponService } from '../src/modules/progression/application/WeaponService.js';
import { WeaponCommand } from '../src/modules/progression/presentation/WeaponCommand.js';
import { StatAssemblyService, type AssembledPlayer } from '../src/modules/combat-shared/application/StatAssemblyService.js';
import { computeClassStats } from '../src/shared/config/classes.js';

function duel(passiveKey: string, seed = 42) {
	const player = createCombatant({ name: 'Hero', combatClass: 'Fighter', hp: 5000, atk: 400, def: 150, crit: 10 });
	const enemy = createCombatant({ name: 'Mob', combatClass: null, hp: 5000, atk: 300, def: 120, crit: 5 });
	const strategy = wrapWithWeaponPassive(new NullClassStrategy(), passiveKey);
	return new BattleEngine().resolve(player, enemy, seed, { playerStrategy: strategy });
}

function hookCtx(overrides: Partial<StrategyContext> = {}): StrategyContext {
	return {
		self: createCombatant({ name: 'Hero', combatClass: 'Fighter', hp: 5000, atk: 400, def: 150, crit: 10 }),
		enemy: createCombatant({ name: 'Mob', combatClass: null, hp: 5000, atk: 300, def: 120, crit: 5 }),
		round: 1,
		rng: () => 0.5,
		log: () => {},
		...overrides,
	};
}

function freshHit(): OutgoingHit {
	return {
		damagePctBonus: 0,
		armorPierceFraction: 0,
		forcedMultiplier: null,
		suppressCrit: false,
		varianceRange: [1, 1],
	};
}

describe('weapon quality config', () => {
	it('grades only move forward and end at Fabled', () => {
		expect(WEAPON_QUALITIES[0]).toBe('Common');
		expect(nextWeaponQuality('Common')).toBe('Uncommon');
		expect(nextWeaponQuality('Fabled')).toBeNull();
		expect(isWeaponQuality('Fabled')).toBe(true);
		expect(isWeaponQuality('Rusty')).toBe(false);
	});

	it('rolls deterministically from the tier table', () => {
		expect(rollWeaponQuality('Rare', () => 0)).toBe('Common');
		expect(rollWeaponQuality('Rare', () => 0.9999)).toBe('Mythical');
		expect(rollWeaponQuality('Supreme', () => 0.9999)).toBe('Fabled');
		expect(rollCrateTier(() => 0)).toBe('Rare');
		expect(rollCrateTier(() => 0.9999)).toBe('Supreme');
	});

	it('keeps Fabled strictly strongest and every upgrade step payable', () => {
		const mults = WEAPON_QUALITIES.map((q) => WEAPON_QUALITY_ATK_MULT[q]);
		expect([...mults].sort((a, b) => a - b)).toEqual(mults);
		expect(WEAPON_QUALITY_ATK_MULT.Fabled).toBeGreaterThan(WEAPON_QUALITY_ATK_MULT.Common);
		for (const q of WEAPON_QUALITIES.slice(0, -1)) expect(WEAPON_UPGRADE_COSTS[q]).toBeDefined();
	});

	it('pays more shards and credux for higher-tier, higher-quality spares', () => {
		const rareCommon = dismantleYield('Rare', 'Common');
		const rareFabled = dismantleYield('Rare', 'Fabled');
		const supremeCommon = dismantleYield('Supreme', 'Common');
		expect(rareFabled.shards).toBeGreaterThan(rareCommon.shards);
		expect(supremeCommon.shards).toBeGreaterThan(rareCommon.shards);
		expect(sellValue('Rare', 'Common')).toBeGreaterThan(0);
		expect(WEAPON_CRATE_COST).toBeGreaterThan(0);
	});
});

describe('weapon passive decorator', () => {
	it('ignores none and unknown keys', () => {
		const base = new NullClassStrategy();
		expect(wrapWithWeaponPassive(base, 'none')).toBe(base);
		expect(wrapWithWeaponPassive(base, null)).toBe(base);
		expect(wrapWithWeaponPassive(base, 'warlord_edge')).toBeInstanceOf(WeaponPassiveDecorator);
		const ctx = hookCtx();
		const hit = freshHit();
		new WeaponPassiveDecorator(base, 'bogus_key').prepareOutgoingHit(ctx, hit);
		expect(hit.damagePctBonus).toBe(0);
	});

	it('grants first blood once and warlord edge only against bigger foes', () => {
		const first = new WeaponPassiveDecorator(new NullClassStrategy(), 'first_blood');
		const ctx = hookCtx();
		const firstHit = freshHit();
		first.prepareOutgoingHit(ctx, firstHit);
		expect(firstHit.damagePctBonus).toBe(10);
		const secondHit = freshHit();
		first.prepareOutgoingHit(ctx, secondHit);
		expect(secondHit.damagePctBonus).toBe(0);

		const warlord = new WeaponPassiveDecorator(new NullClassStrategy(), 'warlord_edge');
		const bigCtx = hookCtx();
		bigCtx.enemy.maxHp = 9999;
		const bigHit = freshHit();
		warlord.prepareOutgoingHit(bigCtx, bigHit);
		expect(bigHit.damagePctBonus).toBe(5);
		const smallCtx = hookCtx();
		smallCtx.enemy.maxHp = 10;
		const smallHit = freshHit();
		warlord.prepareOutgoingHit(smallCtx, smallHit);
		expect(smallHit.damagePctBonus).toBe(0);
	});

	it('marks on crit and cashes the mark in the next two rounds', () => {
		const passive = new WeaponPassiveDecorator(new NullClassStrategy(), 'eclipse_mark');
		const ctx = hookCtx({ round: 1 });
		passive.onHitLanded(ctx, { damageDealt: 100, crit: true, missed: false, triggerExtraAttack: false });
		expect(ctx.enemy.flags.eclipseMarkUntil).toBe(3);
		const marked = hookCtx({ round: 2, self: ctx.self, enemy: ctx.enemy });
		const hit = freshHit();
		passive.prepareOutgoingHit(marked, hit);
		expect(hit.damagePctBonus).toBe(15);
		const expired = hookCtx({ round: 4, self: ctx.self, enemy: ctx.enemy });
		const late = freshHit();
		passive.prepareOutgoingHit(expired, late);
		expect(late.damagePctBonus).toBe(0);
	});

	it('bumps crit at full HP and always restores it after the hit', () => {
		const passive = new WeaponPassiveDecorator(new NullClassStrategy(), 'sky_dive');
		const ctx = hookCtx();
		const before = ctx.self.crit;
		const hit = freshHit();
		passive.prepareOutgoingHit(ctx, hit);
		expect(ctx.self.crit).toBe(before + 8);
		passive.onHitLanded(ctx, { damageDealt: 0, crit: false, missed: true, triggerExtraAttack: false });
		expect(ctx.self.crit).toBe(before);
		const hurt = hookCtx();
		hurt.self.hp = 100;
		const hurtHit = freshHit();
		passive.prepareOutgoingHit(hurt, hurtHit);
		expect(hurt.self.crit).toBe(before);
	});

	it('echoes after crits, stings twice sometimes, and never double-spends', () => {
		const echo = new WeaponPassiveDecorator(new NullClassStrategy(), 'storm_echo');
		const ctx = hookCtx();
		echo.onHitLanded(ctx, { damageDealt: 100, crit: true, missed: false, triggerExtraAttack: false });
		const armed = freshHit();
		echo.prepareOutgoingHit(ctx, armed);
		expect(armed.damagePctBonus).toBe(25);
		const spent = freshHit();
		echo.prepareOutgoingHit(ctx, spent);
		expect(spent.damagePctBonus).toBe(0);

		const sting = new WeaponPassiveDecorator(new NullClassStrategy(), 'twin_sting');
		const lucky = hookCtx({ rng: () => 0 });
		const proc = { damageDealt: 100, crit: false, missed: false, triggerExtraAttack: false };
		sting.onHitLanded(lucky, proc);
		expect(proc.triggerExtraAttack).toBe(true);
		const unlucky = hookCtx({ rng: () => 0.9999 });
		const noProc = { damageDealt: 100, crit: false, missed: false, triggerExtraAttack: false };
		sting.onHitLanded(unlucky, noProc);
		expect(noProc.triggerExtraAttack).toBe(false);
	});

	it('weighs souls, cleaves armor, pierces oaths, splits the sky and sails the sun', () => {
		const weigh = new WeaponPassiveDecorator(new NullClassStrategy(), 'soul_weigh');
		const dying = hookCtx();
		dying.enemy.hp = 2500;
		const execHit = freshHit();
		weigh.prepareOutgoingHit(dying, execHit);
		expect(execHit.damagePctBonus).toBe(10);

		const cleave = new WeaponPassiveDecorator(new NullClassStrategy(), 'grass_cleaver');
		const cleaveCtx = hookCtx();
		const cleaveHit = freshHit();
		cleave.prepareOutgoingHit(cleaveCtx, cleaveHit);
		expect(cleaveHit.damagePctBonus).toBe(10);
		cleave.onHitLanded(cleaveCtx, { damageDealt: 50, crit: false, missed: false, triggerExtraAttack: false });
		expect(cleaveCtx.enemy.debuffs.find((d) => d.tag === 'def_down')?.value).toBe(0.1);

		const pierce = new WeaponPassiveDecorator(new NullClassStrategy(), 'oath_pierce');
		const pierceHit = freshHit();
		pierce.prepareOutgoingHit(hookCtx(), pierceHit);
		expect(pierceHit.armorPierceFraction).toBeCloseTo(0.3);

		const sunder = new WeaponPassiveDecorator(new NullClassStrategy(), 'sky_sunder');
		const sunderHit = freshHit();
		sunder.prepareOutgoingHit(hookCtx(), sunderHit);
		expect(sunderHit.damagePctBonus).toBe(15);
		expect(sunderHit.armorPierceFraction).toBeCloseTo(0.1);

		const sun = new WeaponPassiveDecorator(new NullClassStrategy(), 'solar_barque');
		const sunCtx = hookCtx();
		sunCtx.self.hp = 4000;
		const logs: string[] = [];
		sunCtx.log = (m) => logs.push(m);
		sun.onRoundEnd(sunCtx);
		expect(sunCtx.self.hp).toBeGreaterThan(4000);
		expect(logs.length).toBeGreaterThan(0);
	});

	it('flows through real battles for both PvE and PvP-style engagements', () => {
		const firstBlood = duel('first_blood');
		expect(firstBlood.log.some((line) => line.includes('đòn đầu'))).toBe(true);
		const sunder = duel('sky_sunder');
		expect(sunder.log.some((line) => line.includes('chẻ toang'))).toBe(true);
		// sky_dive must never leak its temporary crit into post-battle state.
		const player = createCombatant({
			name: 'Hero',
			combatClass: 'Fighter',
			hp: 5000,
			atk: 400,
			def: 150,
			crit: 10,
		});
		const enemy = createCombatant({ name: 'Mob', combatClass: null, hp: 5000, atk: 300, def: 120, crit: 5 });
		new BattleEngine().resolve(player, enemy, 7, {
			playerStrategy: wrapWithWeaponPassive(new NullClassStrategy(), 'sky_dive'),
		});
		expect(player.crit).toBe(10);
	});

	it('plugs into the shared factory between base strategy and rune wrappers', () => {
		const plain: AssembledPlayer = {
			stats: { hp: 5000, atk: 400, def: 150, crit: 10, spd: 100, acc: 0, eva: 0, ten: 0 },
			damageType: 'physical',
			armorType: 'light',
			skills: [],
			stance: 'balanced',
			branch: null,
			runeResonance: [],
			combatEffectRunes: [],
			blessings: [],
			weaponPassive: null,
		};
		const armed: AssembledPlayer = { ...plain, weaponPassive: { passiveKey: 'first_blood' } };
		const factory = new PlayerCombatantFactory();
		expect(factory.createStrategy('Fighter', armed)).not.toBe(factory.createStrategy('Fighter', plain));
	});
});

describe('weapon command routing', () => {
	it('bonds weapons to deities and pulls crates through the weapon use-case', async () => {
		const weapons = {
			view: vi.fn(async () => ({ ok: true as const, value: 'Detail' })),
			openCrate: vi.fn(async () => ({ ok: true as const, value: 'Crate' })),
			attach: vi.fn(async () => ({ ok: true as const, value: 'Attached' })),
			detach: vi.fn(async () => ({ ok: true as const, value: 'Detached' })),
			upgrade: vi.fn(async () => ({ ok: true as const, value: 'Upgraded' })),
			dismantle: vi.fn(async () => ({ ok: true as const, value: 'Dismantled' })),
			sell: vi.fn(async () => ({ ok: true as const, value: 'Sold' })),
		};
		const inventory = {
			searchWeapons: vi.fn(async () => [{ id: 'w1', name: 'Sword', tier: 'Rare', plus: 0, equipped: false }]),
			searchDeities: vi.fn(async () => [{ id: 7, name: 'Zeus', tier: 'Epic' }]),
		};
		const command = new WeaponCommand(weapons, inventory);
		const fake = (sub: string, opts: Record<string, string | number> = {}) => {
			const editReply = vi.fn().mockResolvedValue(undefined);
			return {
				interaction: {
					user: { id: 'owner' },
					options: {
						getSubcommand: () => sub,
						getString: (name: string) => (opts[name] as string) ?? null,
						getInteger: (name: string) => (opts[name] as number) ?? null,
						getFocused: () => '',
					},
					deferReply: vi.fn().mockResolvedValue(undefined),
					editReply,
				} as never,
				editReply,
			};
		};
		const equip = fake('equip', { weapon_id: 'w1', deity_id: '7' });
		await command.execute(equip.interaction as never);
		expect(weapons.attach).toHaveBeenCalledExactlyOnceWith('owner', 'w1', 7);
		expect(equip.editReply).toHaveBeenCalledWith('Attached');
		const unequip = fake('unequip', { weapon_id: 'w1' });
		await command.execute(unequip.interaction as never);
		expect(weapons.detach).toHaveBeenCalledExactlyOnceWith('owner', 'w1');
		const crate = fake('crate');
		await command.execute(crate.interaction as never);
		expect(weapons.openCrate).toHaveBeenCalledExactlyOnceWith('owner');
		const view = fake('view', { weapon_id: 'w1' });
		await command.execute(view.interaction as never);
		expect(weapons.view).toHaveBeenCalledExactlyOnceWith('owner', 'w1');
	});
});

describe('lead-deity weapon assembly', () => {
	function assembly(gear: {
		findWeaponByDeity: (...args: never[]) => Promise<never>;
		findWeaponCurrStats: (...args: never[]) => Promise<never>;
	}) {
		const preset = {
			equippedWeaponId: 'w_legacy',
			equippedArmorId: null,
			equippedDeity1Id: 7,
			equippedDeity2Id: null,
			equippedDeity3Id: null,
		};
		const queries = {
			findCharacter: async () => [{ activePresetSlot: 1 }],
			findPreset: async () => [preset],
		};
		const persistence = { executor: {}, unitOfWork: { run: async () => undefined } } as never;
		return new StatAssemblyService(
			gear as never,
			{ findUserDeityAssemblyInfo: async () => null } as never,
			{ findSocketedEffects: async () => [] } as never,
			{ persistence, queries: queries as never },
		);
	}

	it('counts the pantheon lead weapon first and falls back to the legacy preset weapon', async () => {
		const divine = { weaponId: 'w_divine', currAtk: 500, crit: 5, quality: 'Epic', passiveKey: 'sky_sunder' };
		const legacy = { weaponId: 'w_legacy', currAtk: 50, crit: 1, quality: 'Common', passiveKey: 'first_blood' };
		const findWeaponByDeity = vi.fn(async (): Promise<typeof divine | null> => divine);
		const findWeaponCurrStats = vi.fn(async () => legacy);
		const service = assembly({ findWeaponByDeity, findWeaponCurrStats } as never);
		const cls = computeClassStats('Fighter', 1);

		const lead = await service.assemble('owo', 'Fighter', 1, {} as never);
		expect(findWeaponByDeity).toHaveBeenCalledWith({}, 'owo', 7);
		expect(findWeaponCurrStats).not.toHaveBeenCalled();
		expect(lead.weaponPassive).toEqual({ passiveKey: 'sky_sunder' });
		expect(lead.stats.atk).toBe(cls.atk + Math.floor(500 * 1.45));
		expect(lead.stats.crit).toBe(cls.crit + 5 + 1.5);

		findWeaponByDeity.mockResolvedValueOnce(null);
		const fallback = await service.assemble('owo', 'Fighter', 1, {} as never);
		expect(findWeaponCurrStats).toHaveBeenCalledWith({}, 'owo', 'w_legacy');
		expect(fallback.weaponPassive).toEqual({ passiveKey: 'first_blood' });
		expect(fallback.stats.atk).toBe(cls.atk + 50);
	});
});

describe('weapon service lifecycle', () => {
	beforeAll(async () => {
		const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
		await migrateTestDatabase(testClient);
		await db.insert(s.users).values({ discordId: 'owo', username: 'OwO' });
		await db.insert(s.usersBag).values({ discordId: 'owo', credux: 1_000_000, weaponShards: 10_000 });
		await db.insert(s.weaponRoster).values([
			{
				weaponRosterId: 101,
				name: 'Crate Sword',
				type: 'Sword',
				tier: 'Rare',
				mythology: 'Neutral',
				passiveKey: 'first_blood',
				passiveName: 'First Blood',
				passiveDescription: 'First hit +10%.',
				lore: 'Crate blade.',
				imageFilename: null,
				isAvailable: true,
			},
			{
				weaponRosterId: 301,
				name: 'Crate Fang',
				type: 'Dagger',
				tier: 'Legendary',
				mythology: 'Neutral',
				passiveKey: 'eclipse_mark',
				passiveName: 'Eclipse Mark',
				passiveDescription: 'Crits mark.',
				lore: 'Crate fang.',
				imageFilename: null,
				isAvailable: true,
			},
			{
				weaponRosterId: 201,
				name: 'Crate Spear',
				type: 'Spear',
				tier: 'Mythic',
				mythology: 'Neutral',
				passiveKey: 'none',
				passiveName: 'No Passive',
				passiveDescription: 'Plain.',
				lore: 'Crate spear.',
				imageFilename: null,
				isAvailable: true,
			},
			{
				weaponRosterId: 401,
				name: 'Crate Crown',
				type: 'Scepter',
				tier: 'Supreme',
				mythology: 'Neutral',
				passiveKey: 'storm_echo',
				passiveName: 'Storm Echo',
				passiveDescription: 'Echoes after crits.',
				lore: 'Crate crown.',
				imageFilename: null,
				isAvailable: true,
			},
		]);
		await db.insert(s.deityRoster).values({
			deityId: 1,
			name: 'Zeus',
			mythology: 'Neutral',
			tier: 'Epic',
			baseHp: 100,
			baseAtk: 10,
			baseDef: 5,
			blessingKey: 'solar_fury',
			blessingName: 'Solar Fury',
			blessingDescription: 'Damage.',
			lore: null,
			imageFilename: null,
			isAvailable: true,
			blessingScaling: 'binary',
		});
		await db.insert(s.userDeities).values({
			userDeityId: 7,
			discordId: 'owo',
			deityId: 1,
			currAtk: 10,
			currHp: 100,
			currDef: 5,
			enhancement: 1,
			lastPullDate: '2026-09-25',
			sigils: 0,
			ascended: false,
		});
	}, 120000);
	afterAll(async () => {
		await pool.end();
	});

	it('pulls crates, upgrades quality, and bonds weapons to deities', async () => {
		// Deterministic crate (Rare/Common): upgrade cost then always fits the
		// seeded shards. Unmocked crypto RNG made this test flaky.
		const rngSpy = vi.spyOn(rngModule, 'createRng').mockReturnValue(() => 0);
		try {
			const service = new WeaponService({ persistence: testPersistence() });
		const before = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'owo')))[0]!;
		const pulled = await service.openCrate('owo');
		expect(pulled.ok).toBe(true);
		const crateId = (await db.select().from(s.userWeapons).where(eq(s.userWeapons.discordId, 'owo'))).at(
			-1,
		)!.weaponId;
		expect(crateId.startsWith('w_')).toBe(true);
		const afterCrate = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'owo')))[0]!;
		expect(before.credux - afterCrate.credux).toBe(WEAPON_CRATE_COST);

		const detail = await service.view('owo', crateId);
		expect(detail.ok).toBe(true);

		const [row] = await db.select().from(s.userWeapons).where(eq(s.userWeapons.weaponId, crateId));
		const upgraded = await service.upgrade('owo', crateId);
		const expectedNext = nextWeaponQuality(isWeaponQuality(row!.quality) ? row!.quality : 'Common');
		if (expectedNext) {
			expect(upgraded.ok).toBe(true);
			const [next] = await db.select().from(s.userWeapons).where(eq(s.userWeapons.weaponId, crateId));
			expect(next!.quality).toBe(expectedNext);
		}

		const attached = await service.attach('owo', crateId, 7);
		expect(attached.ok).toBe(true);
		const [wielded] = await db.select().from(s.userWeapons).where(eq(s.userWeapons.weaponId, crateId));
		expect(wielded!.attachedDeityId).toBe(7);
		// A wielded weapon cannot be dismantled until it is detached.
		const blocked = await service.dismantle('owo', crateId);
		expect(blocked.ok).toBe(false);
		if (!blocked.ok) expect(blocked.error.code).toBe('WEAPON_EQUIPPED');
		const detached = await service.detach('owo', crateId);
		expect(detached.ok).toBe(true);
		const [freed] = await db.select().from(s.userWeapons).where(eq(s.userWeapons.weaponId, crateId));
		expect(freed!.attachedDeityId).toBeNull();
		} finally {
			rngSpy.mockRestore();
		}
	}, 120000);

	it('dismantles spares into shards and sells the rest for exactly the configured yield', async () => {
		const service = new WeaponService({ persistence: testPersistence() });
		const first = (await db.select().from(s.userWeapons).where(eq(s.userWeapons.discordId, 'owo')))[0]!;
		const [roster] = await db
			.select()
			.from(s.weaponRoster)
			.where(eq(s.weaponRoster.weaponRosterId, first.weaponRosterId));
		const quality = isWeaponQuality(first.quality) ? first.quality : 'Common';
		await db.insert(s.userWeapons).values({
			...first,
			weaponId: 'w_spare_dismantle',
			isLocked: false,
			nativeSockets: [null],
			oppositeSockets: [null],
		});
		const bagBefore = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'owo')))[0]!;
		const dismantled = await service.dismantle('owo', 'w_spare_dismantle');
		expect(dismantled.ok).toBe(true);
		const bagAfter = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'owo')))[0]!;
		// Exact delta proves the credit is applied once and is not lost/duplicated.
		const expectedDismantle = dismantleYield(roster!.tier, quality);
		expect(bagAfter.weaponShards - bagBefore.weaponShards).toBe(expectedDismantle.shards);
		expect(bagAfter.credux - bagBefore.credux).toBe(expectedDismantle.credux);
		expect(await db.select().from(s.userWeapons).where(eq(s.userWeapons.weaponId, 'w_spare_dismantle'))).toEqual(
			[],
		);

		await db.insert(s.userWeapons).values({
			...first,
			weaponId: 'w_spare_sell',
			isLocked: false,
			nativeSockets: [null],
			oppositeSockets: [null],
		});
		const sold = await service.sell('owo', 'w_spare_sell');
		expect(sold.ok).toBe(true);
		const bagFinal = (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, 'owo')))[0]!;
		expect(bagFinal.credux - bagAfter.credux).toBe(sellValue(roster!.tier, quality));
		expect(await service.view('owo', 'missing')).toEqual(expect.objectContaining({ ok: false }));
	}, 120000);
});
