import { describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { NullClassStrategy } from '../src/modules/combat-shared/domain/classes/NullClassStrategy.js';
import { WeaponPassiveDecorator } from '../src/modules/combat-shared/domain/WeaponPassiveDecorator.js';
import { RuneStrategyDecorator } from '../src/modules/combat-shared/domain/RuneStrategyDecorator.js';
import { DeityBlessingDecorator } from '../src/modules/combat-shared/domain/DeityBlessingDecorator.js';
import { EffectRegistry } from '../src/modules/combat-shared/domain/EffectRegistry.js';
import {
	createWeaponPassiveRegistry,
	DEFAULT_WEAPON_PASSIVE_ENTRIES,
} from '../src/modules/combat-shared/domain/weaponPassives.js';
import {
	createRuneEffectRegistry,
	DEFAULT_RUNE_EFFECT_ENTRIES,
} from '../src/modules/combat-shared/domain/runeEffects.js';
import {
	createBlessingEffectRegistry,
	DEFAULT_BLESSING_EFFECT_ENTRIES,
} from '../src/modules/combat-shared/domain/blessingEffects.js';
import { PlayerCombatantFactory } from '../src/modules/combat-shared/application/combatantFactory.js';
import type { AssembledPlayer } from '../src/modules/combat-shared/application/StatAssemblyService.js';

vi.mock('../src/db/client.js', () => {
	throw new Error('Effect registries must not import the database at runtime');
});

function ctx() {
	return {
		self: createCombatant({ name: 'Hero', combatClass: 'Fighter', hp: 5000, atk: 400, def: 150, crit: 10 }),
		enemy: createCombatant({ name: 'Mob', combatClass: null, hp: 5000, atk: 300, def: 120, crit: 5 }),
		round: 1,
		rng: () => 0.5,
		log: () => {},
	};
}

function hit() {
	return { damagePctBonus: 0, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false, varianceRange: [1, 1] as [number, number] };
}

describe('effect registries are open for extension', () => {
	it('ships every legacy key without touching decorator cores', () => {
		expect(DEFAULT_WEAPON_PASSIVE_ENTRIES.map(([k]) => k).sort()).toEqual(
			[
				'eagle_dive', 'eclipse_mark', 'first_blood', 'grass_cleaver', 'oath_pierce', 'sky_dive',
				'sky_sunder', 'solar_barque', 'soul_weigh', 'storm_echo', 'twin_sting', 'warlord_edge',
			].sort(),
		);
		expect(DEFAULT_RUNE_EFFECT_ENTRIES.map(([k]) => k).sort()).toEqual(
			['aegis_rune', 'blight', 'frost', 'piercing', 'thorns', 'vampiric', 'venom', 'warding'].sort(),
		);
		expect(DEFAULT_BLESSING_EFFECT_ENTRIES.map(([k]) => k).sort()).toEqual(
			['guardian_light', 'lunar_veil', 'moon_devourer', 'mountain_grace', 'sky_sovereign', 'solar_fury', 'tailwind', 'tidal_wrath'].sort(),
		);
	});

	it('adds a weapon passive with register() only — decorator file untouched', () => {
		const registry = createWeaponPassiveRegistry();
		registry.register('test_nuke', {
			prepareOutgoingHit(_ctx, h) {
				h.damagePctBonus += 999;
			},
		});
		const strategy = new WeaponPassiveDecorator(new NullClassStrategy(), 'test_nuke', registry);
		const c = ctx();
		const h = hit();
		strategy.prepareOutgoingHit(c, h);
		expect(h.damagePctBonus).toBe(999);
		// Unknown keys stay a no-op, as before the refactor.
		const unknown = new WeaponPassiveDecorator(new NullClassStrategy(), 'bogus_key');
		const h2 = hit();
		unknown.prepareOutgoingHit(ctx(), h2);
		expect(h2.damagePctBonus).toBe(0);
	});

	it('adds a rune effect and a blessing with register() only', () => {
		const runes = createRuneEffectRegistry();
		runes.register('test_sharp', {
			prepareOutgoingHit(_ctx, h, params) {
				h.damagePctBonus += params.value * 100;
			},
		});
		const rune = new RuneStrategyDecorator(new NullClassStrategy(), 'test_sharp' as never, 0.25, runes);
		const h = hit();
		rune.prepareOutgoingHit(ctx(), h);
		expect(h.damagePctBonus).toBe(25);

		const blessings = createBlessingEffectRegistry();
		blessings.register('test_might', {
			prepareOutgoingHit(_ctx, h2, params) {
				h2.damagePctBonus += 10 * params.strength;
			},
		});
		const blessing = new DeityBlessingDecorator(new NullClassStrategy(), 'test_might' as never, 0.5, blessings);
		const h3 = hit();
		blessing.prepareOutgoingHit(ctx(), h3);
		expect(h3.damagePctBonus).toBe(5);
	});

	it('isolates custom registries per factory — defaults never polluted', () => {
		const custom = createWeaponPassiveRegistry();
		custom.register('test_nuke', { prepareOutgoingHit(_ctx, h) { h.damagePctBonus += 999; } });
		const factory = new PlayerCombatantFactory({ weapons: custom });
		const base: AssembledPlayer = {
			stats: { hp: 5000, atk: 400, def: 150, crit: 10, spd: 100, acc: 0, eva: 0, ten: 0 },
			damageType: 'physical',
			armorType: 'light',
			combatEffectRunes: [],
			blessings: [],
			weaponPassive: { passiveKey: 'test_nuke' },
		};
		const strategy = factory.createStrategy('Fighter', base);
		const plainFactory = new PlayerCombatantFactory();
		const plain = { ...base, weaponPassive: null };
		const reference = plainFactory.createStrategy('Fighter', plain);
		const c = ctx();
		const h = hit();
		strategy.prepareOutgoingHit(c, h);
		const c2 = ctx();
		const h2 = hit();
		reference.prepareOutgoingHit(c2, h2);
		// The registered fake contributes exactly its bonus on top of the class base.
		expect(h.damagePctBonus - h2.damagePctBonus).toBe(999);
		// The shared default table knows nothing about the test key.
		expect(createWeaponPassiveRegistry().has('test_nuke')).toBe(false);
		expect(new EffectRegistry().size).toBe(0);
	});

	it('runs a full battle through a registered fake without engine changes', () => {
		const registry = createWeaponPassiveRegistry();
		registry.register('test_nuke', { prepareOutgoingHit(_ctx, h) { h.damagePctBonus += 50; } });
		const player = createCombatant({ name: 'Hero', combatClass: 'Fighter', hp: 5000, atk: 400, def: 150, crit: 10 });
		const enemy = createCombatant({ name: 'Mob', combatClass: null, hp: 5000, atk: 300, def: 120, crit: 5 });
		const plain = new BattleEngine().resolve(
			createCombatant({ name: 'Hero', combatClass: 'Fighter', hp: 5000, atk: 400, def: 150, crit: 10 }),
			createCombatant({ name: 'Mob', combatClass: null, hp: 5000, atk: 300, def: 120, crit: 5 }),
			7,
			{ playerStrategy: new NullClassStrategy() },
		);
		const nuked = new BattleEngine().resolve(player, enemy, 7, {
			playerStrategy: new WeaponPassiveDecorator(new NullClassStrategy(), 'test_nuke', registry),
		});
		expect(nuked.roundLogs.length).toBeGreaterThan(0);
		expect(JSON.stringify(nuked)).not.toBe(JSON.stringify(plain));
	});
});
