import { describe, expect, it } from 'vitest';
import { navigateBattleLogPage } from '../src/modules/menu/MenuActionRouter.js';
import { pickQuestTemplates } from '../src/modules/meta/application/QuestTemplatePicker.js';

describe('menu action router (SRP extraction)', () => {
	it('clamps battle-log paging', () => {
		expect(navigateBattleLogPage(5, 0, 'next')).toBe(1);
		expect(navigateBattleLogPage(5, 4, 'next')).toBe(4);
		expect(navigateBattleLogPage(5, 0, 'prev')).toBe(0);
		expect(navigateBattleLogPage(5, 2, 'first')).toBe(0);
		expect(navigateBattleLogPage(5, 2, 'last')).toBe(4);
	});
});

describe('quest template picker (SRP extraction)', () => {
	it('picks distinct templates deterministically', () => {
		const pool = [
			{ type: 'a', target: 1 },
			{ type: 'b', target: 1 },
			{ type: 'c', target: 1 },
		] as never[];
		const rng = (() => {
			let i = 0;
			return () => [0, 0.5, 0.99][i++ % 3];
		})();
		const picked = pickQuestTemplates(pool as never, rng, 2);
		expect(picked).toHaveLength(2);
		expect(new Set(picked.map((p) => (p as { type: string }).type)).size).toBe(2);
	});
});
