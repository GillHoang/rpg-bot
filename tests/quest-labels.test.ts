import { describe, expect, it } from 'vitest';
import { DAILY_POOL, WEEKLY_POOL } from '../src/shared/config/quests.js';
import { DAILY_QUEST_LABELS, WEEKLY_QUEST_LABELS } from '../src/shared/ui/text/quest.js';

/**
 * Quest labels hardcode target numbers that also live in config/quests.ts.
 * If a pool target changes without its label, the UI lies — pin them together.
 */
describe('quest labels track pool targets', () => {
	it.each(DAILY_POOL)('daily $type target $target appears in its label', (template) => {
		expect(DAILY_QUEST_LABELS[template.type]).toContain(String(template.target));
	});
	it.each(WEEKLY_POOL)('weekly $type target $target appears in its label', (template) => {
		expect(WEEKLY_QUEST_LABELS[template.type]).toContain(String(template.target));
	});
});
