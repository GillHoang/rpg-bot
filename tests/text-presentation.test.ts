import { afterEach, describe, expect, it, vi } from 'vitest';
import { ICONS, UNICODE_ICONS } from '../src/shared/ui/text/icons.js';
import { formatNumber } from '../src/shared/ui/text/format.js';
import { PROFILE_CLASS_ICONS } from '../src/shared/ui/text/profile.js';
import { ESSENCE_BAG_DEF_SEED } from '../src/modules/progression/seed/runeEconomy.js';
import { RUNE_SEED } from '../src/modules/progression/seed/runes.js';

afterEach(() => {
	vi.doUnmock('../src/shared/ui/text/icons.js');
	vi.doUnmock('@napi-rs/canvas');
	vi.resetModules();
});

describe('content rendering', () => {
	it('formats numbers independently of the host locale and supports explicit overrides', () => {
		expect(formatNumber(1234567.89)).toBe('1,234,567.89');
		expect(formatNumber(-1000)).toBe('-1,000');
		expect(formatNumber(1234567.89, 'vi-VN')).toBe('1.234.567,89');
		expect(formatNumber(1.23456, 'en-US', { maximumFractionDigits: 2 })).toBe('1.23');
	});

	it('provides Unicode fallbacks for every Discord icon without custom markup', () => {
		for (const group of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
			expect(Object.keys(UNICODE_ICONS[group]).sort()).toEqual(Object.keys(ICONS[group]).sort());
			for (const value of Object.values(UNICODE_ICONS[group])) {
				expect(value).not.toMatch(/<a?:\w+:\d+>/);
				expect(value).not.toBe('');
			}
		}
		expect(ICONS.economy.wallet).toMatch(/^<:/);
		expect(UNICODE_ICONS.economy.wallet).not.toMatch(/^<:/);
		expect(Object.keys(PROFILE_CLASS_ICONS)).toHaveLength(5);
	});

	it('propagates custom icon overrides into menu, help and gameplay text', async () => {
		vi.doMock('../src/shared/ui/text/icons.js', async (importOriginal) => {
			const original = await importOriginal<typeof import('../src/shared/ui/text/icons.js')>();
			return {
				...original,
				ICONS: {
					...original.ICONS,
					combatClass: { ...original.ICONS.combatClass, swordsman: '<:sword:123456789012345678>' },
					gear: { ...original.ICONS.gear, weapon: '<:weapon:123456789012345678>' },
					menu: { ...original.ICONS.menu, home: '<:home:123456789012345678>' },
				},
			};
		});
		const { MENU_TEXT } = await import('../src/shared/ui/text/menu.js');
		const { HELP_PAGES } = await import('../src/shared/ui/text/help.js');
		const { GAMEPLAY_TEXT } = await import('../src/shared/ui/text/gameplay.js');
		const { PROFILE_CLASS_ICONS: canvasClasses } = await import('../src/shared/ui/text/profile.js');
		expect(MENU_TEXT.home_emoji).toBe('<:home:123456789012345678>');
		expect(HELP_PAGES.map((page) => page.body).join('\n')).toContain('<:sword:123456789012345678> **Swordsman**');
		expect(GAMEPLAY_TEXT.equipmentSection('Sword', 'Armor')).toContain(
			'<:weapon:123456789012345678> Vũ khí: Sword',
		);
		expect(canvasClasses.Swordsman).toBe(UNICODE_ICONS.combatClass.swordsman);
	});

	it('keeps rune bag pools aligned with seeded catalog names', () => {
		const names = new Set(RUNE_SEED.map((rune) => rune.name));
		for (const bag of ESSENCE_BAG_DEF_SEED) {
			expect(bag.runePool.length).toBeGreaterThan(0);
			for (const rune of bag.runePool) expect(names.has(rune)).toBe(true);
		}
	});

	it('draws readable Unicode on the profile card instead of Discord emoji markup', async () => {
		const fillText = vi.fn();
		const context = {
			fillText,
			fillRect: vi.fn(),
			createLinearGradient: () => ({ addColorStop: vi.fn() }),
		};
		vi.doMock('@napi-rs/canvas', () => ({
			createCanvas: () => ({ getContext: () => context, toBuffer: () => Buffer.from('png') }),
		}));
		const { renderProfileCard } = await import('../src/shared/ui/render/ProfileCardRenderer.js');
		renderProfileCard({
			username: 'Player',
			combatClass: 'Swordsman',
			level: 1,
			exp: 0,
			expToNext: 100,
			stats: { hp: 700, atk: 225, def: 225, crit: 5 },
			credux: 1000,
			beliefShards: 200,
		});
		const drawn = fillText.mock.calls.map(([value]) => value).join('\n');
		expect(drawn).not.toMatch(/<a?:\w+:\d+>/);
		expect(drawn).toContain(`${UNICODE_ICONS.economy.wallet} 1,000 Credux`);
		expect(drawn).toContain(`${UNICODE_ICONS.economy.shards} 200 Belief Shards`);
	});
});
