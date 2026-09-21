import { describe, expect, it } from 'vitest';
import { parseCommandScope } from '../src/scripts/commandScope.js';

describe('command scope', () => {
	it.each([['--guild'], ['--guild='], ['--guild', '--global'], ['--guild', 'abc']])(
		'rejects invalid guild arguments even with an environment fallback: %j',
		(...args) => {
			expect(() => parseCommandScope(args, '123')).toThrow();
		},
	);
	it('uses the default scope only when no scope flag was provided', () => {
		expect(parseCommandScope([])).toEqual({ global: true, guildId: null });
		expect(parseCommandScope([], '123')).toEqual({ global: false, guildId: '123' });
		expect(parseCommandScope(['--global'], '123')).toEqual({ global: true, guildId: null });
	});
	it.each([['--guild', '456'], ['--guild=456'], ['--', '--guild', '456']])(
		'keeps guild operations isolated: %j',
		(...args) => {
			expect(parseCommandScope(args, '123', true)).toEqual({ global: false, guildId: '456' });
		},
	);
	it('requires an explicit all flag and a known guild to clear both scopes', () => {
		expect(parseCommandScope(['--all', '--guild', '456'], undefined, true)).toEqual({
			global: true,
			guildId: '456',
		});
		expect(parseCommandScope(['--all'], '123', true)).toEqual({ global: true, guildId: '123' });
		expect(() => parseCommandScope(['--all'], undefined, true)).toThrow();
		expect(() => parseCommandScope(['--all'], '123')).toThrow();
	});
	it.each([
		['--global', '--guild', '123'],
		['--global', '--all'],
		['--guild=123', '--guild=456'],
		['--guld', '123'],
	])('rejects ambiguous or mistyped arguments: %j', (...args) => {
		expect(() => parseCommandScope(args, undefined, true)).toThrow();
	});
});
