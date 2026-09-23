import { formatNumber } from '../text/format.js';
import { MENU_ERROR_TEXT } from '../text/diagnostics.js';
import { GAMEPLAY_NOTICE } from '../text/gameplay.js';
import { MenuPlayerRepository } from '../repositories/MenuPlayerRepository.js';
import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { CLASS_NAMES } from '../config/classes.js';
import { ProfileService } from '../services/ProfileService.js';
import { StartService } from '../services/StartService.js';
import { DailyService } from '../services/DailyService.js';
import { QuestService } from '../services/QuestService.js';
import { RaidService } from '../services/RaidService.js';
import { DailyCycle } from '../utils/dailyCycle.js';
import { DAILY_ALREADY_CLAIMED, DAILY_MILESTONE_LINE, DAILY_SUCCESS } from '../text/daily.js';
import type { GamePanel, MenuGameplay } from './MenuGameplay.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { MenuAction } from './menuIds.js';
import {
	battlePanel,
	battleLobbyPanel,
	confirmationPanel,
	homePanel,
	onboardingPanel,
	profilePanel,
	questsPanel,
} from './gameplayPanels.js';

const n = (value: number) => formatNumber(value, 'vi-VN');

export interface MenuGameplayDependencies {
	persistence?: PersistenceContext;
	players?: Pick<MenuPlayerRepository, 'findState'>;
}

export class MenuGameplayService implements MenuGameplay {
	private readonly players: Pick<MenuPlayerRepository, 'findState'>;
	private readonly profiles: Pick<ProfileService, 'get'>;
	private readonly start: Pick<StartService, 'start'>;
	private readonly daily: Pick<DailyService, 'claim'>;
	private readonly quests: Pick<QuestService, 'snapshot' | 'claimWeeklyGrand' | 'refresh'>;
	private readonly raid: Pick<RaidService, 'run'>;

	constructor(
		profiles?: Pick<ProfileService, 'get'>,
		start?: Pick<StartService, 'start'>,
		daily?: Pick<DailyService, 'claim'>,
		quests?: Pick<QuestService, 'snapshot' | 'claimWeeklyGrand' | 'refresh'>,
		raid?: Pick<RaidService, 'run'>,
		options: MenuGameplayDependencies = {},
	) {
		const persistence = options.persistence ?? defaultPersistence;
		this.players = options.players ?? new MenuPlayerRepository(persistence.executor);
		this.profiles = profiles ?? new ProfileService(undefined, undefined, undefined, { persistence });
		this.start = start ?? new StartService(undefined, undefined, undefined, undefined, undefined, { persistence });
		this.daily = daily ?? new DailyService(undefined, undefined, { persistence });
		this.quests = quests ?? new QuestService(undefined, { persistence });
		this.raid = raid ?? new RaidService({ persistence });
	}

	async render(session: MenuSession): Promise<GamePanel | undefined> {
		const screen = session.screen;
		if (['help', 'topic', 'search'].includes(screen.kind)) return undefined;
		if (screen.kind === 'section' && !['character', 'daily', 'battle'].includes(screen.section)) return undefined;
		if (screen.kind === 'result' || screen.kind === 'log') return battlePanel(session);
		if (screen.kind === 'confirm') return confirmationPanel(screen);

		const kind =
			screen.kind === 'section'
				? ({ character: 'profile', daily: 'quests', battle: 'battle' } as Record<string, string>)[
						screen.section
					]
				: screen.kind;
		if (kind === 'profile') {
			const detail = await this.profiles.get(session.ownerId);
			return detail.status === 'ok' ? profilePanel(detail.data) : onboardingPanel();
		}
		const profile = await this.profiles.get(session.ownerId, 'summary');
		if (profile.status !== 'ok') return onboardingPanel();
		const user = await this.players.findState(session.ownerId);
		const day = DailyCycle.keyAt();
		const dailyDone = user?.lastDailyClaimDate === day;
		const bossDone = user?.lastBossAttackDate === day;
		if (kind === 'quests') {
			const snapshot = await this.quests.snapshot(session.ownerId);
			if (!snapshot) throw new Error(MENU_ERROR_TEXT.playerDisappeared);
			return questsPanel(snapshot, dailyDone);
		}
		if (kind === 'battle') return battleLobbyPanel(profile.data, bossDone, !!session.battle);
		return homePanel(profile.data, { dailyDone, bossDone });
	}

	async act(session: MenuSession, action: MenuAction, username: string, value?: string): Promise<MenuScreen> {
		const id = session.ownerId;
		switch (action) {
			case 'inventory':
			case 'deity':
			case 'shop':
			case 'casino':
				return { kind: 'section', section: action };
			case 'battle':
				return { kind: 'battle' };
			case 'class': {
				const combatClass = CLASS_NAMES.find((c) => c === value);
				if (!combatClass) throw new Error(MENU_ERROR_TEXT.invalidClass);
				return { kind: 'confirm', operation: 'start', combatClass };
			}
			case 'profile':
				return { kind: 'profile' };
			case 'quests':
				return { kind: 'quests' };
			case 'daily':
				return this.claimDaily(session);
			case 'claim':
				session.notice = await this.quests.claimWeeklyGrand(id);
				return { kind: 'quests' };
			case 'reroll':
			case 'boss':
				return { kind: 'confirm', operation: action, day: DailyCycle.keyAt() };
			case 'cancel':
				return this.cancelConfirmation(session.screen);
			case 'confirm':
				return this.confirm(session, username);
			case 'hunt':
				return this.fight(session, false);
			case 'result':
				return { kind: 'result' };
			case 'log':
				return { kind: 'log', page: Math.max(0, (session.battle?.battle.roundLogs.length ?? 1) - 1) };
			case 'first':
			case 'last':
			case 'prev':
			case 'next':
				return this.navigateBattleLog(session, action);
			default:
				throw new Error(MENU_ERROR_TEXT.unknownAction);
		}
	}

	private navigateBattleLog(session: MenuSession, action: 'first' | 'last' | 'prev' | 'next'): MenuScreen {
		if ((session.screen.kind !== 'log' && session.screen.kind !== 'result') || !session.battle)
			throw new Error(MENU_ERROR_TEXT.missingBattleLog);
		const lastPage = Math.max(0, session.battle.battle.roundLogs.length - 1);
		const currentPage = session.screen.kind === 'log' ? session.screen.page : lastPage;
		let page = currentPage;
		if (action === 'first') page = 0;
		else if (action === 'last') page = lastPage;
		else if (action === 'next') page += 1;
		else page -= 1;
		return { kind: 'log', page: Math.max(0, Math.min(lastPage, page)) };
	}

	private async claimDaily(session: MenuSession): Promise<MenuScreen> {
		const r = await this.daily.claim(session.ownerId);
		if (r.status === 'ok') {
			const milestone = r.milestoneChestLabel ? DAILY_MILESTONE_LINE(r.milestoneChestLabel) : '';
			session.notice = DAILY_SUCCESS(r.day, r.monthly, r.overall, n(r.credux), r.shards, r.chestLabel, milestone);
		} else if (r.status === 'already-claimed') {
			session.notice = DAILY_ALREADY_CLAIMED(r.overall);
		} else {
			session.notice = GAMEPLAY_NOTICE.createFirst;
		}
		return { kind: 'home' };
	}

	private cancelConfirmation(screen: MenuScreen): MenuScreen {
		if (screen.kind !== 'confirm') return { kind: 'home' };
		if (screen.operation === 'reroll') return { kind: 'quests' };
		if (screen.operation === 'boss') return { kind: 'battle' };
		return { kind: 'home' };
	}

	private async confirm(session: MenuSession, username: string): Promise<MenuScreen> {
		const s = session.screen;
		if (s.kind !== 'confirm') throw new Error(MENU_ERROR_TEXT.missingConfirmation);
		if (s.operation === 'start') {
			const r = await this.start.start(session.ownerId, username, s.combatClass);
			if (r.status === 'ok') session.notice = GAMEPLAY_NOTICE.created;
			else if (r.status === 'already-has-character') session.notice = GAMEPLAY_NOTICE.alreadyCreated;
			else session.notice = GAMEPLAY_NOTICE.starterUnavailable;
			return { kind: 'home' };
		}
		if (s.operation === 'reroll') {
			session.notice = await this.quests.refresh(session.ownerId, s.day);
			return { kind: 'quests' };
		}
		return this.fight(session, true, s.day);
	}

	private async fight(session: MenuSession, boss: boolean, expectedDay?: string): Promise<MenuScreen> {
		if (!boss && Date.now() < (session.huntReadyAt ?? 0)) {
			session.notice = GAMEPLAY_NOTICE.cooldown(Math.ceil((session.huntReadyAt! - Date.now()) / 1000));
			return session.screen;
		}
		const r = await this.raid.run(session.ownerId, boss, {
			requestId: `${session.id}:${session.revision}`,
			expectedDay,
		});
		if (r.status === 'ok') {
			if (!boss) session.huntReadyAt = Date.now() + 15_000;
			session.battle = { ...r, boss };
			return { kind: 'result' };
		}
		if (r.status === 'boss-locked') session.notice = r.message;
		else if (r.status === 'already-processed') session.notice = GAMEPLAY_NOTICE.alreadyProcessed;
		else if (r.status === 'no-monsters-seeded') session.notice = GAMEPLAY_NOTICE.noMonster;
		else session.notice = GAMEPLAY_NOTICE.createFirst;
		return { kind: 'battle' };
	}
}

export const menuGameplay = new MenuGameplayService();
