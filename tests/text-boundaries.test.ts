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
		expect(findTextViolations("import { env } from '../config/env.js';", 'src/text/example.ts')).toHaveLength(1);
		expect(findTextViolations("import { ICONS } from './icons.js';", 'src/text/example.ts')).toEqual([]);
		expect(
			findTextViolations(
				"import type { PlayerAccount } from '../domain/entities/PlayerAccount.js';",
				'src/text/example.ts',
			),
		).toEqual([]);
	});
});
