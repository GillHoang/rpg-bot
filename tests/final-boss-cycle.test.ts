import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { MonsterStrategy } from '../src/modules/combat-shared/domain/classes/MonsterStrategy.js';

const player = () =>
	createCombatant({ name: 'Player', combatClass: 'Fighter', hp: 20000, atk: 300, def: 100, crit: 5 });
const boss = (skill: string, finalBoss = true) =>
	createCombatant({ name: 'Boss', combatClass: null, hp: 20000, atk: 200, def: 100, crit: 5 });

function fight(skill: string, finalBoss: boolean, seed = 7) {
	const enemy = boss(skill, finalBoss);
	const result = new BattleEngine().resolve(player(), enemy, seed, {
		enemyStrategy: new MonsterStrategy(skill, { affixes: [], finalBoss }),
	});
	return { result, enemy };
}

describe('final-boss heavy cycle (Phase 4)', () => {
	it('telegraphs on rounds 3, 7, … and lands a heavy strike on rounds 4, 8, …', () => {
		const { result } = fight('blood_frenzy', true);
		expect(result.roundLogs.length).toBeGreaterThanOrEqual(4);
		const round3 = result.roundLogs[2]!.lines.join('\n');
		const round4 = result.roundLogs[3]!.lines.join('\n');
		expect(round3).toContain('tụ lực cho đòn kết liễu');
		expect(round4).toContain('tung đòn nặng');
		// Regular rounds carry no telegraph.
		expect(result.roundLogs[0]!.lines.join('\n')).not.toContain('tụ lực');
		expect(result.roundLogs[1]!.lines.join('\n')).not.toContain('tụ lực');
	});

	it('stays silent for regular encounters and for Bakunawa', () => {
		const plain = fight('blood_frenzy', false);
		expect(plain.result.log.join('\n')).not.toContain('tụ lực');
		expect(plain.result.log.join('\n')).not.toContain('tung đòn nặng');
		const baku = fight('moon_threshold', true);
		expect(baku.result.log.join('\n')).not.toContain('tung đòn nặng');
	});
});
