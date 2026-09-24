import { describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { CombatSetup } from '../src/modules/combat-shared/application/CombatSetup.js';
import { COMBAT_SHARED_CONFIG } from '../src/modules/combat-shared/config.js';
import { MAX_ROUNDS, SUDDEN_DEATH_START } from '../src/modules/combat-shared/domain/combatRules.js';
import { createAppContainer } from '../src/app/container.js';

function context() {
	return { executor: {} as never, unitOfWork: { run: vi.fn() } };
}

describe('combat-shared module (facade + setup)', () => {
	it('keeps module config in sync with combat rules', () => {
		expect(COMBAT_SHARED_CONFIG.maxRounds).toBe(MAX_ROUNDS);
		expect(COMBAT_SHARED_CONFIG.suddenDeathStart).toBe(SUDDEN_DEATH_START);
	});

	it('preparePlayer bundles assemble + combatant + strategy', async () => {
		const assembled = { stats: { hp: 100, atk: 10, def: 5, crit: 5 }, combatEffectRunes: [], blessings: [] };
		const combatant = createCombatant({ name: 'hero', combatClass: 'Mage', hp: 100, atk: 10, def: 5, crit: 5 });
		const strategy = { onRoundStart: vi.fn(), onRoundEnd: vi.fn() };
		const statAssembly = { assemble: vi.fn(async () => assembled) };
		const factory = {
			createCombatant: vi.fn(() => combatant),
			createStrategy: vi.fn(() => strategy),
		};
		const setup = new CombatSetup(statAssembly as never, factory as never, new BattleEngine());
		const result = await setup.preparePlayer('u1', 'Mage', 3, 'hero');
		expect(statAssembly.assemble).toHaveBeenCalledWith('u1', 'Mage', 3);
		expect(factory.createCombatant).toHaveBeenCalledWith('hero', 'Mage', assembled);
		expect(result).toMatchObject({ assembled, combatant, strategy });
	});

	it('resolve delegates to the engine', () => {
		const resolve = vi.fn(() => ({ outcome: 'draw' }));
		const setup = new CombatSetup({} as never, {} as never, { resolve } as never);
		const player = createCombatant({ name: 'a', combatClass: 'Mage', hp: 10, atk: 1, def: 1, crit: 0 });
		const enemy = createCombatant({ name: 'b', combatClass: null, hp: 10, atk: 1, def: 1, crit: 0 });
		expect(setup.resolve(player, enemy, 7)).toEqual({ outcome: 'draw' });
		expect(resolve).toHaveBeenCalledWith(player, enemy, 7, undefined);
	});

	it('app container exposes shared combat singletons without extra I/O', () => {
		const container = createAppContainer({ persistence: context() as never });
		expect(container.combatShared.engine).toBeInstanceOf(BattleEngine);
		expect(container.combatShared.setup).toBeInstanceOf(CombatSetup);
		expect(container.combatShared.setup.resolve).toBeDefined();
	});

	it('shares one combat setup across raid/duel/ranked with explicit overrides winning', async () => {
		const { RaidService } = await import('../src/modules/pve/application/RaidService.js');
		const { DuelService } = await import('../src/modules/pvp/application/DuelService.js');
		const engine = new BattleEngine();
		const { PlayerCombatantFactory } = await import('../src/modules/combat-shared/application/combatantFactory.js');
		const { StatAssemblyService } = await import('../src/modules/combat-shared/application/StatAssemblyService.js');
		const persistence = context() as never;
		const statAssembly = new StatAssemblyService(undefined, undefined, undefined, { persistence });
		const setup = new CombatSetup(statAssembly, new PlayerCombatantFactory(), engine);
		const explicit = { resolve: vi.fn() };
		const raid = new RaidService({ persistence, combat: setup, engine: explicit } as never);
		expect((raid as unknown as { engine: unknown }).engine).toBe(explicit);
		const duel = new DuelService(undefined, undefined, undefined, undefined, undefined, {
			persistence,
			combat: setup,
		} as never);
		expect((duel as unknown as { engine: unknown }).engine).toBe(engine);
	});
});
