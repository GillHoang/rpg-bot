import { describe, expect, it } from 'vitest';
import { MonsterEncounterService } from '../src/modules/pve/application/MonsterEncounterService.js';
import { MOB_SEED } from '../src/modules/pve/seed/mobs.js';
import { CLASS_NAMES, computeClassStats } from '../src/shared/config/classes.js';
import { STARTER_ARMOR, STARTER_WEAPON } from '../src/shared/config/starter.js';
import { GEAR_STATS } from '../src/shared/config/chestLoot.js';
import { computeWeaponCurrAtk, computeArmorCurrStats } from '../src/shared/config/enhancement.js';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { ClassStrategyRegistry } from '../src/modules/combat-shared/domain/ClassStrategyRegistry.js';
import { MonsterStrategy } from '../src/modules/combat-shared/domain/classes/MonsterStrategy.js';
import type { Executor } from '../src/db/client.js';

const executor = {} as Executor;
const engine = new BattleEngine();
const midpoint = (range: readonly number[]) => (range[0] + range[1]) / 2;

async function winRates(
	level: number,
	enemyLevel: number,
	finalBoss: boolean,
	tier: 'starter' | keyof typeof GEAR_STATS,
	enhancement: number,
) {
	const rows = MOB_SEED.filter((row) => (finalBoss ? row.mobType === 'boss' : row.mobType === 'regular'));
	const rates: number[] = [];
	for (const combatClass of CLASS_NAMES) {
		const stats = computeClassStats(combatClass, level);
		const gear = tier === 'starter' ? null : GEAR_STATS[tier];
		const armor = gear
			? computeArmorCurrStats(
					midpoint(gear.hp),
					midpoint(gear.def),
					enhancement,
					tier as Exclude<typeof tier, 'starter'>,
				)
			: STARTER_ARMOR;
		stats.atk += gear
			? computeWeaponCurrAtk(midpoint(gear.atk), tier as Exclude<typeof tier, 'starter'>, enhancement)
			: STARTER_WEAPON.atk;
		stats.hp += armor.hp;
		stats.def += armor.def;
		stats.crit += gear ? midpoint(gear.crit) : STARTER_WEAPON.crit;
		let wins = 0;
		for (const row of rows) {
			const service = new MonsterEncounterService({ listForEncounter: async () => [row] });
			const mob = (await service.pickForLevel(executor, enemyLevel, () => 0, false, finalBoss))!;
			for (let seed = 1; seed <= 100; seed++) {
				const enemy = createCombatant({ ...mob, combatClass: null });
				enemy.immunityTags = mob.immunityTags;
				const result = engine.resolve(
					createCombatant({ name: combatClass, combatClass, ...stats }),
					enemy,
					seed,
					{
						playerStrategy: ClassStrategyRegistry.forClass(combatClass),
						enemyStrategy: new MonsterStrategy(mob.skillKey),
					},
				);
				if (result.outcome === 'player_win') wins++;
			}
		}
		rates.push(wins / rows.length);
	}
	return rates;
}

describe('portal equipment balance', () => {
	it('keeps the first gate accessible with unenhanced Rare gear for every class', async () => {
		const rates = await winRates(1, 1, false, 'Rare', 1);
		for (const rate of rates) expect(rate).toBeGreaterThan(60);
	});
	it('makes gate 4 demand equipment and rewards enhancing the same Rare gear', async () => {
		const starter = await winRates(7, 7, false, 'starter', 1);
		const base = await winRates(7, 7, false, 'Rare', 1);
		const upgraded = await winRates(7, 7, false, 'Rare', 11);
		for (let index = 0; index < CLASS_NAMES.length; index++) {
			expect(starter[index]).toBeLessThan(50);
			expect(upgraded[index]).toBeGreaterThan(base[index] + 10);
			expect(upgraded[index]).toBeGreaterThan(30);
		}
	});
	it('makes the first final boss a gear check while leaving a viable upgraded build for every class', async () => {
		const starter = await winRates(9, 9, true, 'starter', 1);
		const upgraded = await winRates(9, 9, true, 'Legendary', 11);
		for (let index = 0; index < CLASS_NAMES.length; index++) {
			expect(starter[index]).toBeLessThan(5);
			expect(upgraded[index]).toBeGreaterThan(80);
		}
	});
	it(
		'prevents leveling alone from trivializing late portals',
		async () => {
			const starter = await winRates(80, 80, false, 'starter', 1);
			const upgraded = await winRates(80, 80, false, 'Supreme', 11);
			for (let index = 0; index < CLASS_NAMES.length; index++) {
				expect(starter[index]).toBeLessThan(20);
				expect(upgraded[index]).toBeGreaterThan(50);
			}
		},
		// CPU-bound: thousands of full level-80 battle simulations; slow hosts need headroom.
		30_000,
	);
});
