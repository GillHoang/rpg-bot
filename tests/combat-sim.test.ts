import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { ClassStrategyRegistry } from '../src/modules/combat-shared/domain/ClassStrategyRegistry.js';
import { MonsterStrategy } from '../src/modules/combat-shared/domain/classes/MonsterStrategy.js';
import { NullClassStrategy } from '../src/modules/combat-shared/domain/classes/NullClassStrategy.js';
import type { CombatantState } from '../src/modules/combat-shared/domain/CombatantState.js';
import type { StrategyContext } from '../src/modules/combat-shared/domain/IClassStrategy.js';

class ObservingStrategy extends NullClassStrategy {
	constructor(private readonly enemies: CombatantState[]) {
		super();
	}

	override onRoundEnd(ctx: StrategyContext): void {
		this.enemies.push(ctx.enemy);
	}
}

describe('raid balance (Pugot 6 HP regression)', () => {
	it('draws equal HP percentages at the round limit and passes the real opponent to end-of-round hooks', () => {
		const player = createCombatant({ name: 'player', combatClass: null, hp: 100, atk: 0, def: 0, crit: 0 });
		const enemy = createCombatant({ name: 'enemy', combatClass: null, hp: 200, atk: 0, def: 0, crit: 0 });
		const playerEnemies: CombatantState[] = [];
		const enemyEnemies: CombatantState[] = [];
		const battle = new BattleEngine().resolve(
			player,
			enemy,
			42,
			{ playerStrategy: new ObservingStrategy(playerEnemies), enemyStrategy: new ObservingStrategy(enemyEnemies) },
		);
		expect(battle.outcome).toBe('draw');
		expect(battle.rounds).toBe(40);
		expect(playerEnemies[0]).toBe(enemy);
		expect(enemyEnemies[0]).toBe(player);
	});

	it('a level-1 raid is neither a one-shot nor a 20-round slog', () => {
		// Fighter lv1 + starter gear vs Pugot lv1 với stats mới từ pickForLevel
		// (hp 3.2×, atk 0.72×, def 0.55× avg class curve; shape 560/600 ≈ 0.93).
		const player = createCombatant({ name: 'fighter', combatClass: 'Fighter', hp: 890, atk: 315, def: 160, crit: 2.0 });
		const mob = createCombatant({ name: 'Pugot', combatClass: null, hp: 2237, atk: 195, def: 93, crit: 3.0 });
		const battle = new BattleEngine().resolve(player, mob, 12345, {
			playerStrategy: ClassStrategyRegistry.forClass('Fighter'),
			enemyStrategy: new MonsterStrategy('blood_frenzy'),
		});
		expect(battle.outcome).toBe('player_win');
		// Player vẫn thắng nhưng không one-shot: cần >= 2 hiệp.
		expect(battle.rounds).toBeGreaterThanOrEqual(2);
		// Mob ra đòn đủ đau để đe dọa: player mất ít nhất 25% HP trong trận.
		expect(890 - battle.playerHpRemaining).toBeGreaterThanOrEqual(890 * 0.25);
	});

	it('mob hits are a real threat, not single digits', () => {
		// Máu player giảm mỗi đòn mob phải ở bậc hàng trăm (không phải 6 HP).
		const player = createCombatant({ name: 'fighter', combatClass: 'Fighter', hp: 890, atk: 315, def: 160, crit: 2.0 });
		const mob = createCombatant({ name: 'Pugot', combatClass: null, hp: 2237, atk: 195, def: 93, crit: 3.0 });
		const battle = new BattleEngine().resolve(player, mob, 777, {
			playerStrategy: ClassStrategyRegistry.forClass('Fighter'),
			enemyStrategy: new MonsterStrategy('blood_frenzy'),
		});
		const perRound = (890 - battle.playerHpRemaining) / battle.rounds;
		expect(perRound).toBeGreaterThan(40);
	});
});
