import { describe, expect, it } from 'vitest';
import { MessageFlags } from 'discord.js';
import { MENU_SECTIONS, MENU_TEXT, type MenuSection } from '../src/shared/ui/text/menu.js';
import { MenuSessionStore, type MenuScreen } from '../src/modules/menu/MenuSessionStore.js';
import { MENU_OPEN_ID, menuId, parseMenuId } from '../src/modules/menu/menuIds.js';
import { menuView, recoveryView } from '../src/modules/menu/menuViews.js';
import { buildPanelButtons } from '../src/modules/menu/MenuRegistry.js';
import { buildBattleLogPage } from '../src/shared/ui/render/BattleLogPager.js';
import { raidBattleOptions } from '../src/shared/ui/render/raidBattleOptions.js';
import { battlePanel } from '../src/modules/menu/gameplayPanels.js';

function json(payload: unknown): Record<string, unknown> {
	return JSON.parse(JSON.stringify(payload));
}

describe('menu payloads', () => {
	it('renders every journal round identically to raid hunt, including pager controls', () => {
		const session = new MenuSessionStore().create('alice');
		session.playerName = 'Alice';
		session.battle = {
			status: 'ok',
			boss: false,
			monsterName: 'Mob',
			credux: 10,
			shards: 1,
			expGained: 100,
			gotChest: false,
			chestName: '',
			gearDrop: null,
			progress: { previousLevel: 1, newLevel: 1, leveledUp: false },
			battle: {
				outcome: 'player_win',
				rounds: 3,
				log: [],
				playerHpRemaining: 70,
				enemyHpRemaining: 0,
				roundLogs: [1, 2, 3].map((round) => ({
					round,
					lines: [`Round ${round}`],
					playerHp: 100 - round * 10,
					playerMaxHp: 100,
					enemyHp: 90 - round * 30,
					enemyMaxHp: 90,
				})),
			},
		};
		const withoutIds = (value: unknown) =>
			JSON.parse(JSON.stringify(value, (key, item) => (key === 'custom_id' ? undefined : item)));
		for (const page of [-1, 0, 1, 2]) {
			session.screen = page === -1 ? { kind: 'result' } : { kind: 'log', page };
			session.gamePanel = battlePanel(session);
			const actual = menuView(session).components[0];
			const expected = buildBattleLogPage(
				raidBattleOptions(session.battle, false, 'Alice'),
				page === -1 ? 2 : page,
			).components[0];
			expect(withoutIds(actual)).toEqual(withoutIds(expected));
			const payload = json(menuView(session));
			expect(payload.components).toHaveLength(2);
			expect((payload.components as unknown[])[1] as Record<string, unknown>).toBeDefined();
			const row = (payload.components as { components: { custom_id: string; label: string }[] }[])[1]!;
			expect(row.components).toHaveLength(2);
			expect(parseMenuId(row.components[0]!.custom_id)?.action).toBe('home');
			expect(parseMenuId(row.components[1]!.custom_id)?.action).toBe('hunt');
			expect(row.components[1]!.label).toBe('Chọn Gate (Cửa)');
		}
	});

	it('serializes real V2 views within Discord limits with unique component IDs', () => {
		const session = new MenuSessionStore().create('a');
		const screens: MenuScreen[] = [
			{ kind: 'home' },
			...Object.keys(MENU_SECTIONS).map((section) => ({
				kind: 'section' as const,
				section: section as MenuSection,
			})),
			{ kind: 'profile' },
			{ kind: 'quests' },
			{ kind: 'gateSelect' },
			{ kind: 'gateTiers' },
			{ kind: 'confirm', operation: 'boss', day: '2026-09-21' },
			{ kind: 'result' },
			{ kind: 'log', page: 0 },
		];
		for (const screen of screens) {
			session.screen = screen;
			session.gamePanel = { title: 'T', body: 'B', buttons: buildPanelButtons(session, undefined) };
			const view = menuView(session);
			const payload = JSON.parse(JSON.stringify(view)); // Executes builder validation, not a copy of rendering logic.
			expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
			expect(payload).not.toHaveProperty('content');
			expect(payload).not.toHaveProperty('embeds');
			expect(payload.allowedMentions).toEqual({ parse: [] });
			const ids: string[] = [];
			let componentCount = 0,
				textLength = 0;
			function walk(node: {
				type: number;
				custom_id?: string;
				content?: string;
				options?: unknown[];
				components?: (typeof node)[];
			}) {
				componentCount++;
				if (node.custom_id) {
					ids.push(node.custom_id);
					expect(node.custom_id.length).toBeLessThanOrEqual(100);
				}
				if (node.content) textLength += node.content.length;
				if (node.options) expect(node.options.length).toBeLessThanOrEqual(25);
				if (node.type === 1) expect(node.components!.length).toBeLessThanOrEqual(5);
				node.components?.forEach(walk);
			}
			payload.components.forEach(walk);
			expect(new Set(ids).size).toBe(ids.length);
			expect(componentCount).toBeLessThanOrEqual(40);
			expect(textLength).toBeLessThanOrEqual(4000);
		}
	});

	it('renders the home buttons from the file registry and drops help-search/section selectors', () => {
		const session = new MenuSessionStore().create('a');
		session.screen = { kind: 'home' };
		session.gamePanel = { title: 'T', body: 'B', buttons: buildPanelButtons(session, undefined) };
		const payload = JSON.stringify(menuView(session));
		for (const action of ['profile', 'daily', 'home', 'close']) {
			expect(payload).toContain(`:${action}`);
		}
		expect(payload).not.toContain(MENU_TEXT.chooseSection);
		expect(payload).not.toContain(MENU_TEXT.search);
		expect(payload).not.toContain('"find"');
	});

	it('recovery has only the stateless open button', () => {
		const view = JSON.stringify(recoveryView('Expired'));
		expect(view).toContain(MENU_OPEN_ID);
		expect(view).not.toContain('menu:v1:undefined');
	});

	it('rejects malformed, unknown-version, overflowing and forged action IDs', () => {
		const id = 'a'.repeat(24);
		for (const value of [
			'menu:v2:open',
			'menu:v1:garbage',
			`menu:v1:${id}:-1:help`,
			`menu:v1:${id}:9007199254740992:help`,
			`menu:v1:${id}:0:reset`,
			`menu:v1:${id}:0:find`,
			`menu:v1:${id}:0:section`,
			`menu:v1:${id}:0:help:1`,
			'x'.repeat(101),
		])
			expect(parseMenuId(value)).toBeNull();
		expect(parseMenuId(menuId(id, 12, 'refresh'))).toEqual({
			id,
			revision: 12,
			action: 'refresh',
			nonce: undefined,
		});
		expect(parseMenuId(menuId(id, 0, 'fight', '7'))).toEqual({
			id,
			revision: 0,
			action: 'fight',
			nonce: '7',
		});
	});
});
