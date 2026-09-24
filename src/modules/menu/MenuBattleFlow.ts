import { AppError } from '../../shared/kernel/Result.js';
import type { Clock } from '../../shared/kernel/clock.js';
import { MENU_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';
import { GAMEPLAY_NOTICE } from '../../shared/ui/text/gameplay.js';
import { DAILY_ALREADY_CLAIMED } from '../../shared/ui/text/daily.js';
import { dailyRewardText } from '../../shared/ui/render/dailyRewardText.js';
import type { StartService } from '../identity/application/StartService.js';
import type { ClaimDailyUseCase } from '../economy/application/ClaimDailyUseCase.js';
import type { QuestService } from '../meta/application/QuestService.js';
import type { RaidService } from '../pve/application/RaidService.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';

export interface BattleFlowDependencies {
	start: Pick<StartService, 'start'>;
	daily: Pick<ClaimDailyUseCase, 'claim'>;
	quests: Pick<QuestService, 'refresh'>;
	raid: Pick<RaidService, 'run'>;
	clock: Clock;
}

/**
 * SRP extraction from MenuGameplayService: stateful battle flows
 * (daily claim, confirmations, raid fight). The service facade keeps
 * render() + act() dispatch; all progression writes live here.
 */
export class MenuBattleFlow {
	constructor(private readonly deps: BattleFlowDependencies) {}

	async claimDaily(session: MenuSession): Promise<MenuScreen> {
		const r = await this.deps.daily.claim(session.ownerId);
		if (r.status === 'ok') {
			session.notice = dailyRewardText(r);
		} else if (r.status === 'already-claimed') {
			session.notice = DAILY_ALREADY_CLAIMED(r.overall);
		} else {
			session.notice = GAMEPLAY_NOTICE.createFirst;
		}
		return { kind: 'home' };
	}

	cancelConfirmation(screen: MenuScreen): MenuScreen {
		if (screen.kind !== 'confirm') return { kind: 'home' };
		if (screen.operation === 'reroll') return { kind: 'quests' };
		if (screen.operation === 'boss') return { kind: 'gateSelect' };
		return { kind: 'home' };
	}

	async confirm(session: MenuSession, username: string): Promise<MenuScreen> {
		const s = session.screen;
		if (s.kind !== 'confirm') throw new AppError('MENU_MISSING_CONFIRMATION', MENU_ERROR_TEXT.missingConfirmation);
		if (s.operation === 'start') {
			const r = await this.deps.start.start(session.ownerId, username, s.combatClass);
			if (r.status === 'ok') session.notice = GAMEPLAY_NOTICE.created;
			else if (r.status === 'already-has-character') session.notice = GAMEPLAY_NOTICE.alreadyCreated;
			else session.notice = GAMEPLAY_NOTICE.starterUnavailable;
			return { kind: 'home' };
		}
		if (s.operation === 'reroll') {
			const refreshed = await this.deps.quests.refresh(session.ownerId, s.day);
			session.notice = refreshed.ok ? refreshed.value : refreshed.error.message;
			return { kind: 'quests' };
		}
		return this.fight(session, true, s.day);
	}

	async fight(session: MenuSession, boss: boolean, expectedDay?: string): Promise<MenuScreen> {
		const r = await this.deps.raid.run(session.ownerId, boss, {
			requestId: `${session.id}:${session.revision}`,
			expectedDay,
			...(!boss ? { gate: session.gateId, tier: session.portalGate } : {}),
		});
		if (r.status === 'ok') {
			session.battle = {
				...r,
				boss,
				portal:
					!boss && session.gateId !== undefined && session.portalGate !== undefined
						? { gate: session.gateId, tier: session.portalGate }
						: undefined,
			};
			// Win clears the fought tier: drop the tier number so the next render
			// falls back to defaultGateTier (the tier just unlocked), keeping the gate.
			if (!boss && r.battle.outcome === 'player_win') session.portalGate = undefined;
			return { kind: 'result' };
		}
		if (r.status === 'boss-locked' || r.status === 'portal-locked') session.notice = r.message;
		else if (r.status === 'cooldown') {
			session.notice = GAMEPLAY_NOTICE.cooldown(
				Math.max(1, Math.ceil((r.retryAt.getTime() - this.deps.clock.now().getTime()) / 1000)),
			);
			return session.battle ? { kind: 'result' } : { kind: 'gateTiers' };
		} else if (r.status === 'already-processed') session.notice = GAMEPLAY_NOTICE.alreadyProcessed;
		else if (r.status === 'no-monsters-seeded') session.notice = GAMEPLAY_NOTICE.noMonster;
		else session.notice = GAMEPLAY_NOTICE.createFirst;
		return { kind: 'gateTiers' };
	}
}
