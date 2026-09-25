import { describe, expect, it } from 'vitest';
import { MENU_ITEMS, buildPanelButtons, getMenuItem } from '../src/modules/menu/MenuRegistry.js';
import { menuAccent, groupHeading } from '../src/modules/menu/menuTheme.js';
import { MenuSessionStore } from '../src/modules/menu/MenuSessionStore.js';
import { menuId, parseMenuId } from '../src/modules/menu/menuIds.js';

const NAME_RE = /^[a-z]+$/;

function sessionFor(screen: ReturnType<MenuSessionStore['create']>['screen']) {
	const session = new MenuSessionStore().create('alice');
	session.screen = screen;
	return session;
}

describe('menu item registry', () => {
	it('registers uniquely named items with valid action tokens', () => {
		const names = MENU_ITEMS.map((item) => item.name);
		expect(names.length).toBeGreaterThan(0);
		expect(new Set(names).size).toBe(names.length);
		for (const item of MENU_ITEMS) {
			expect(item.name).toMatch(NAME_RE);
			// Parameterized items (gate/fight) carry a value nonce and are checked below.
			if (item.name !== 'gate' && item.name !== 'fight') {
				expect(parseMenuId(menuId('a'.repeat(24), 0, item.name))?.action).toBe(item.name);
			}
			expect(typeof item.visibleWhen).toBe('function');
			expect(typeof item.options).toBe('function');
			expect(typeof item.run).toBe('function');
		}
	});

	it('accepts parameterized button values and rejects forged ones', () => {
		for (const [name, value] of [
			['gate', '1'],
			['gate', '5'],
			['fight', '1'],
			['fight', '10'],
		] as const) {
			expect(parseMenuId(menuId('a'.repeat(24), 0, name, value))).toMatchObject({ action: name, nonce: value });
		}
		expect(parseMenuId(menuId('a'.repeat(24), 0, 'gate', '6'))).toBeNull();
		expect(parseMenuId(menuId('a'.repeat(24), 0, 'fight', '11'))).toBeNull();
		expect(parseMenuId(menuId('a'.repeat(24), 0, 'help', '1'))).toBeNull();
	});

	it('builds grouped home buttons in registry order', () => {
		const session = sessionFor({ kind: 'home' });
		const buttons = buildPanelButtons(session, { title: '', body: '' });
		expect(buttons.map((button) => [button.action, button.group])).toEqual([
			['profile', 'Thông tin'],
			['help', 'Thông tin'],
			['daily', 'Hoạt động'],
			['hunt', 'Hoạt động'],
			['boss', 'Hoạt động'],
			['quests', 'Hoạt động'],
			['home', 'Điều hướng'],
			['back', 'Điều hướng'],
			['refresh', 'Điều hướng'],
			['close', 'Điều hướng'],
		]);
	});

	it('hides every home item while the onboarding class picker is shown', () => {
		const session = sessionFor({ kind: 'home' });
		const buttons = buildPanelButtons(session, { title: '', body: '', classes: true });
		expect(buttons.map((button) => button.action)).toEqual(['home', 'back', 'refresh', 'close']);
	});

	it('lets pure items decide navigation without collaborators', () => {
		const api = {} as never;
		expect(getMenuItem('profile')!.run({ session: sessionFor({ kind: 'home' }), username: 'a', api })).toEqual({
			kind: 'profile',
		});
		const session = sessionFor({ kind: 'gateTiers' });
		session.gateId = 3;
		session.portalGate = 4;
		expect(getMenuItem('hunt')!.run({ session, username: 'a', api })).toEqual({ kind: 'gateSelect' });
		expect(session.gateId).toBeUndefined();
		expect(session.portalGate).toBeUndefined();
		expect(
			getMenuItem('gate')!.run({ session: sessionFor({ kind: 'gateSelect' }), value: '2', username: 'a', api }),
		).toEqual({ kind: 'gateTiers' });
	});

	it('exposes button options only on the screens they belong to', () => {		const session = sessionFor({ kind: 'quests' });
		const panel = { title: '', body: '', data: { claimDisabled: true, rerollDisabled: false } };
		const buttons = buildPanelButtons(session, panel);
		expect(buttons.find((button) => button.action === 'claim')?.disabled).toBe(true);
		expect(buttons.find((button) => button.action === 'reroll')?.disabled).toBe(false);
		expect(buttons.find((button) => button.action === 'boss')).toBeUndefined();
	});

	it('shows the profile info-toggle tabs and highlights the open one', () => {
		const session = sessionFor({ kind: 'profile' });
		const tabs = buildPanelButtons(session, { title: '', body: '' })
			.filter((button) => ['stats', 'gear', 'deity'].includes(button.action))
			.map((button) => button.action);
		expect(tabs).toEqual(['stats', 'gear', 'deity']);
		session.profileTab = 'gear';
		const gear = buildPanelButtons(session, { title: '', body: '' }).find((b) => b.action === 'gear');
		expect(gear?.style).toBe('primary');
		const stats = buildPanelButtons(session, { title: '', body: '' }).find((b) => b.action === 'stats');
		expect(stats?.style).toBe('secondary');
	});

	it('marks grid items (gate/tier) to start their own action row', () => {
		const panel = { title: '', body: '', data: { gates: [{ id: 1, disabled: false }], tiers: [{ number: 1, disabled: false }] } };
		const gate = buildPanelButtons(sessionFor({ kind: 'gateSelect' }), panel).find((b) => b.action === 'gate');
		expect(gate?.row).toBe(true);
		const fight = buildPanelButtons(sessionFor({ kind: 'gateTiers' }), panel).find((b) => b.action === 'fight');
		expect(fight?.row).toBe(true);
		const boss = buildPanelButtons(sessionFor({ kind: 'home' }), { title: '', body: '' }).find((b) => b.action === 'boss');
		expect(boss?.row).toBeFalsy();
	});

	it('only uses valid Discord emoji on buttons', () => {
		// '✦'-style text glyphs look like icons but Discord rejects them as
		// component emoji (COMPONENT_INVALID_EMOJI) — catch that at test time.
		const VALID_EMOJI = /^(?:<a?:\w+:\d+>|\p{Extended_Pictographic}\uFE0F?)$/u;
		const panel = {
			title: '',
			body: '',
			data: {
				dailyDone: false,
				bossDisabled: false,
				hasBattle: true,
				claimDisabled: false,
				rerollDisabled: false,
				boss: false,
				page: 0,
				pages: 1,
				continuation: { label: 'x' },
				gates: [{ id: 1, disabled: false }],
				tiers: [{ number: 1, disabled: false }],
			},
		};
		const screens = [
			{ kind: 'home' },
			{ kind: 'profile' },
			{ kind: 'quests' },
			{ kind: 'gateSelect' },
			{ kind: 'gateTiers' },
			{ kind: 'result' },
			{ kind: 'log', page: 0 },
			{ kind: 'confirm', operation: 'boss', day: 'd' },
		] as const;
		for (const item of MENU_ITEMS) {
			for (const screen of screens) {
				const session = new MenuSessionStore().create('a');
				session.screen = screen;
				for (const option of item.options(session, panel)) {
					if (option.emoji) expect(option.emoji, `${item.name} uses an invalid emoji`).toMatch(VALID_EMOJI);
				}
			}
		}
	});

	it('themes each surface and labels buttons with icons', () => {
		expect(menuAccent(sessionFor({ kind: 'home' }))).toBe(0xf1c232);
		expect(menuAccent(sessionFor({ kind: 'profile' }))).toBe(0x5865f2);
		expect(menuAccent(sessionFor({ kind: 'quests' }))).toBe(0x57f287);
		expect(menuAccent(sessionFor({ kind: 'confirm', operation: 'boss', day: 'd' }))).toBe(0xed4245);
		const home = buildPanelButtons(sessionFor({ kind: 'home' }), { title: '', body: '' });
		for (const action of ['profile', 'help', 'daily', 'hunt', 'boss', 'quests']) {
			expect(home.find((button) => button.action === action)?.emoji).toBeTruthy();
		}
		expect(home.find((button) => button.action === 'hunt')?.style).toBe('primary');
		expect(groupHeading('Hoạt động')).toContain('Hoạt động');
	});
});
