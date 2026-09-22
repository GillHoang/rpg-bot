import { describe, expect, it } from 'vitest';
import { MessageFlags } from 'discord.js';
import { HELP_PAGES } from '../src/text/help.js';
import { MENU_SECTIONS, type MenuSection } from '../src/text/menu.js';
import { MenuSessionStore, type MenuScreen } from '../src/menu/MenuSessionStore.js';
import { MENU_OPEN_ID, menuId, parseMenuId } from '../src/menu/menuIds.js';
import { helpMatches, menuView, recoveryView, searchModal } from '../src/menu/menuViews.js';
import { buildBattleLogPage } from '../src/render/BattleLogPager.js';
import { raidBattleOptions } from '../src/render/raidBattleOptions.js';
import { battlePanel } from '../src/menu/gameplayPanels.js';

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
			const payload = JSON.parse(JSON.stringify(menuView(session)));
			expect(payload.components).toHaveLength(2);
			expect(payload.components[1].components).toHaveLength(2);
			expect(parseMenuId(payload.components[1].components[0].custom_id)?.action).toBe('home');
			expect(parseMenuId(payload.components[1].components[1].custom_id)?.action).toBe('hunt');
			expect(payload.components[1].components[1].label).toBe('Đánh lại (15s)');
		}
	});
	it('serializes real V2 views within Discord limits with unique component IDs', () => {
		const store = new MenuSessionStore(),
			session = store.create('a');
		const screens: MenuScreen[] = [
			{ kind: 'home' },
			{ kind: 'help' },
			{ kind: 'search', query: 'rune' },
			{ kind: 'search', query: 'not-a-topic-xyz' },
			...Object.keys(MENU_SECTIONS).map((section) => ({
				kind: 'section' as const,
				section: section as MenuSection,
			})),
			...HELP_PAGES.map((_, index) => ({ kind: 'topic' as const, index })),
		];
		for (const screen of screens) {
			session.screen = screen;
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

	it('builds a valid modal with a one-time nonce and a Label/TextInput', () => {
		const session = new MenuSessionStore().create('a');
		const modal = searchModal(session, '1234567890abcdef').toJSON();
		expect(parseMenuId(modal.custom_id)).toEqual({
			id: session.id,
			revision: 0,
			action: 'find',
			nonce: '1234567890abcdef',
		});
		expect(modal.components[0]!.type).toBe(18);
		expect(JSON.stringify(modal)).toContain('"max_length":80');
	});

	it('matches Vietnamese help without requiring accents and treats input as literal text', () => {
		expect(helpMatches('trieu hoi')).toContain(2);
		expect(helpMatches('triệu hồi')).toEqual(helpMatches('trieu hoi'));
		expect(helpMatches('[')).toContain(3);
		expect(helpMatches('^.*$')).toEqual([]);
		expect(helpMatches('not-a-topic-xyz')).toEqual([]);
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
			`menu:v1:${id}:0:help:1234567890abcdef`,
			'x'.repeat(101),
		])
			expect(parseMenuId(value)).toBeNull();
		expect(parseMenuId(menuId(id, 12, 'refresh'))).toEqual({
			id,
			revision: 12,
			action: 'refresh',
			nonce: undefined,
		});
	});
});
