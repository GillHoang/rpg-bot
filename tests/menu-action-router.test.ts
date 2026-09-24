import { describe, expect, it } from 'vitest';
import { routeStatelessAction, navigateBattleLogPage } from '../src/modules/menu/MenuActionRouter.js';
import { pickQuestTemplates } from '../src/modules/meta/application/QuestTemplatePicker.js';
import type { MenuSession } from '../src/modules/menu/MenuSessionStore.js';

function session(): MenuSession {
	return { id: 's', revision: 1, ownerId: 'u', screen: { kind: 'home' } } as MenuSession;
}

describe('menu action router (SRP extraction)', () => {
	it('routes stateless actions without collaborators', () => {
		const s = session();
		expect(routeStatelessAction(s, 'battle')).toEqual({ kind: 'gateSelect' });
		expect(s.gateId).toBeUndefined();
		expect(routeStatelessAction(s, 'profile')).toEqual({ kind: 'profile' });
		expect(routeStatelessAction(s, 'result')).toEqual({ kind: 'result' });
		expect(routeStatelessAction(s, 'daily')).toBeNull();
		expect(routeStatelessAction(s, 'fight')).toBeNull();
	});

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
