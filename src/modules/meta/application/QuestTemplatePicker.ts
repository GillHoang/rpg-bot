import { choose } from '../../../shared/utils/weightedRandom.js';
import { QUESTS_PER_CYCLE, type QuestTemplate } from '../../../shared/config/quests.js';

/**
 * SRP extraction from QuestService: pure template-pick rules.
 * No DB, no clock — fully unit-testable.
 */
export function pickQuestTemplates(
	pool: readonly QuestTemplate[],
	rng: () => number,
	count: number = QUESTS_PER_CYCLE,
): QuestTemplate[] {
	const remaining = [...pool];
	const picked: QuestTemplate[] = [];
	for (let i = 0; i < count && remaining.length > 0; i++) {
		const template = choose(remaining, rng);
		remaining.splice(remaining.indexOf(template), 1);
		picked.push(template);
	}
	return picked;
}
