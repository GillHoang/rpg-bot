import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/domain/combat/BattleEngine.js';
import { createCombatant } from '../src/domain/combat/CombatantState.js';
import { ClassStrategyRegistry } from '../src/domain/combat/ClassStrategyRegistry.js';
import { MonsterStrategy } from '../src/domain/combat/classes/MonsterStrategy.js';

describe('raid balance (Pugot 6 HP regression)', () => {
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
