import { EventBus } from './EventBus.js';
import { QuestService } from '../services/QuestService.js';
import { ReputationService } from '../services/ReputationService.js';
import type { QuestType } from '../config/quests.js';
import type { BelieverExpSource } from '../config/reputation.js';
import { logger } from '../utils/logger.js';

/**
 * Wiring for legacy asynchronous quest/reputation observers. Menu daily/raid
 * applies core progression in its reward transaction and marks the event so
 * these observers skip it. Call once at bootstrap.
 */
export function subscribeDomainEvents(
	bus: Pick<EventBus, 'on'> = EventBus.getInstance(),
	quests: Pick<QuestService, 'progress'> = new QuestService(),
	reputation: Pick<ReputationService, 'award'> = new ReputationService(),
): void {
	const run = (what: string, task: Promise<unknown>): void => {
		void task.catch((error) => logger.error({ error, what }, 'Domain event subscriber failed'));
	};

	const battleQuestType: Record<'raid' | 'duel' | 'ranked' | 'boss', QuestType> = {
		raid: 'raid_win',
		boss: 'raid_win',
		duel: 'duel_win',
		ranked: 'ranked',
	};
	const battleExpSource: Record<'raid' | 'duel' | 'ranked' | 'boss', BelieverExpSource> = {
		raid: 'raid_win',
		boss: 'raid_win',
		duel: 'duel_win',
		ranked: 'ranked_win',
	};

	bus.on('battle.won', (event) => {
		if (event.progressApplied) return;
		run('battle.won quest', quests.progress(event.discordId, battleQuestType[event.battleType]));
		run('battle.won exp', reputation.award(event.discordId, battleExpSource[event.battleType]));
	});
	bus.on('daily.claimed', (event) => {
		if (event.progressApplied) return;
		run('daily.claimed quest', quests.progress(event.discordId, 'daily'));
		run('daily.claimed exp', reputation.award(event.discordId, 'daily'));
	});
	bus.on('summon.done', (event) => {
		run('summon.done quest', quests.progress(event.discordId, 'summon'));
	});
	bus.on('gear.enhanced', (event) => {
		// Attempt-based: both success and failure count as one enhance progress.
		run('gear.enhanced quest', quests.progress(event.discordId, 'enhance'));
	});
	bus.on('chest.opened', (event) => {
		run('chest.opened quest', quests.progress(event.discordId, 'open_chest'));
	});
	bus.on('casino.played', (event) => {
		run('casino.played quest', quests.progress(event.discordId, 'casino'));
	});
}
