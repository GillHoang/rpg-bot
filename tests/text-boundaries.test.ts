import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkTextBoundaries, findTextViolations } from '../scripts/check-text-boundaries.mjs';

describe('text and emoji boundaries', () => {
	it('keeps production sources within the content boundary', () => {
		expect(checkTextBoundaries(fileURLToPath(new URL('../', import.meta.url)))).toEqual([]);
	});

	it.each([
		"const icon = '🎉';",
		"const icon = '\\u{1F389}';",
		'const text = `Done ${value} 🎉`; ',
		"const icon = '<a:success:123456789012345678>';",
		"const icon = '🇻🇳';",
		"const icon = '1️⃣';",
	])('rejects emoji literals and decoded escape sequences: %s', (source) => {
		expect(findTextViolations(source, 'src/text/newFeature.ts').join('\n')).toContain('Move emoji');
	});

	it.each([
		"button.setLabel('Confirm');",
		"const label = 'Nhận thưởng';",
		"throw new Error('Could not load player');",
		"logger.error('Could not update profile');",
	])('rejects embedded presentation and diagnostic copy: %s', (source) => {
		expect(findTextViolations(source, 'src/commands/Example.ts').join('\n')).toContain('Move display/diagnostic');
	});

	it('allows prose in text modules and emoji definitions in the registry', () => {
		expect(findTextViolations("export const title = 'Nhận thưởng';", 'src/text/newFeature.ts')).toEqual([]);
		expect(findTextViolations("export const icon = '🎉';", 'src/text/icons.ts')).toEqual([]);
	});

	it('does not confuse comments, regexes, SQL and protocol IDs with display copy', () => {
		const source =
			"// 🎉 Nhận thưởng\nconst pattern = /🎉/u; const id = 'menu:v1:home'; const query = sql`select * from users`;";
		expect(findTextViolations(source, 'src/repositories/Example.ts')).toEqual([]);
	});

	it('requires the shared formatter even when a locale was supplied', () => {
		expect(
			findTextViolations("const amount = value.toLocaleString('vi-VN');", 'src/render/Example.ts'),
		).toHaveLength(1);
		expect(findTextViolations('const amount = formatNumber(value);', 'src/render/Example.ts')).toEqual([]);
	});

	it('keeps content modules safe for bootstrap without forbidding type-only contracts', () => {
		expect(findTextViolations("import { env } from '../shared/config/env.js';", 'src/shared/ui/text/example.ts')).toHaveLength(1);
		expect(findTextViolations("import { ICONS } from './icons.js';", 'src/shared/ui/text/example.ts')).toEqual([]);
		expect(
			findTextViolations(
				"import type { PlayerAccount } from '../../../modules/identity/domain/PlayerAccount.js';",
				'src/shared/ui/text/example.ts',
			),
			).toEqual([]);
	});

	it.each([
		['ab cd', true],
		['longer words', true],
		['123ab cd456', true],
		['ab c', false],
		['a cd', false],
		['ab  cd', false],
		['ab\tcd', false],
	])('preserves prose detection for %j', (value, expected) => {
		const violations = findTextViolations(`const value = ${JSON.stringify(value)};`, 'src/example.ts');
		expect(violations.some((message) => message.includes('Move display/diagnostic'))).toBe(expected);
	});

	it('handles long word runs without unbounded regex backtracking', () => {
		const word = 'a'.repeat(100_000);
		expect(findTextViolations(`const value = '${word}';`, 'src/example.ts')).toEqual([]);
		expect(findTextViolations(`const value = '${word} b';`, 'src/example.ts')).toEqual([]);
		expect(findTextViolations(`const value = '${word} bc';`, 'src/example.ts')).toHaveLength(1);
	});

	it('preserves mixed import and logger diagnostics after separating the AST checks', () => {
		for (const source of [
			"import '../config/env.js';",
			"import env, { type Env } from '../config/env.js';",
			"import { type Env, env } from '../config/env.js';",
		])
			expect(findTextViolations(source, 'src/text/example.ts')).toHaveLength(1);
		expect(findTextViolations("import { type Env } from '../config/env.js';", 'src/text/example.ts')).toEqual([]);
		const violations = findTextViolations('logger.error({ err }, `Could not load ${id}`);', 'src/example.ts');
		expect(violations.some((message) => message.includes('Move log messages'))).toBe(true);
		expect(violations.some((message) => message.includes('Move display/diagnostic'))).toBe(true);
	});
});
