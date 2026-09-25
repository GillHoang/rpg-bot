import { describe, expect, it } from 'vitest';
import { MENU_ITEMS, buildPanelButtons, getMenuItem } from '../src/modules/menu/MenuRegistry.js';
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
			['inventory', 'Tài sản'],
			['deity', 'Tài sản'],
			['shop', 'Tài sản'],
			['casino', 'Tài sản'],
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

	it('exposes button options only on the screens they belong to', () => {
		const session = sessionFor({ kind: 'quests' });
		const panel = { title: '', body: '', data: { claimDisabled: true, rerollDisabled: false } };
		const buttons = buildPanelButtons(session, panel);
		expect(buttons.find((button) => button.action === 'claim')?.disabled).toBe(true);
		expect(buttons.find((button) => button.action === 'reroll')?.disabled).toBe(false);
		expect(buttons.find((button) => button.action === 'boss')).toBeUndefined();
	});
});
