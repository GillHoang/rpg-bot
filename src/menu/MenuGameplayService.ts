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

const n = (value: number) => value.toLocaleString('vi-VN');

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

		const profile = await this.profiles.get(session.ownerId);
		if (profile.status !== 'ok') return onboardingPanel();
		const user = await this.players.findState(session.ownerId);
		const day = DailyCycle.keyAt();
		const dailyDone = user?.lastDailyClaimDate === day;
		const bossDone = user?.lastBossAttackDate === day;
		const kind =
			screen.kind === 'section'
				? ({ character: 'profile', daily: 'quests', battle: 'battle' } as Record<string, string>)[
						screen.section
					]
				: screen.kind;
		if (kind === 'quests') {
			const snapshot = await this.quests.snapshot(session.ownerId);
			if (!snapshot) throw new Error('Menu player disappeared');
			return questsPanel(snapshot, dailyDone);
		}
		if (kind === 'battle') return battleLobbyPanel(profile.data, bossDone, !!session.battle);
		if (kind === 'profile') return profilePanel(profile.data, dailyDone);
		const snapshot = await this.quests.snapshot(session.ownerId);
		return homePanel(profile.data, { dailyDone, bossDone, overallStreak: user?.overallStreak ?? 0 }, snapshot);
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
				if (!combatClass) throw new Error('Invalid class');
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
			case 'next': {
				if ((session.screen.kind !== 'log' && session.screen.kind !== 'result') || !session.battle)
					throw new Error('No battle log');
				const currentPage =
					session.screen.kind === 'log'
						? session.screen.page
						: Math.max(0, session.battle.battle.roundLogs.length - 1);
				return {
					kind: 'log',
					page: Math.max(
						0,
						Math.min(
							session.battle.battle.roundLogs.length - 1,
							action === 'first'
								? 0
								: action === 'last'
									? session.battle.battle.roundLogs.length - 1
									: currentPage + (action === 'next' ? 1 : -1),
						),
					),
				};
			}
			default:
				throw new Error('Unknown gameplay action');
		}
	}

	private async claimDaily(session: MenuSession): Promise<MenuScreen> {
		const r = await this.daily.claim(session.ownerId, new Date(), true);
		if (r.status === 'ok') {
			const milestone = r.milestoneChestLabel ? DAILY_MILESTONE_LINE(r.milestoneChestLabel) : '';
			session.notice = DAILY_SUCCESS(r.day, r.monthly, r.overall, n(r.credux), r.shards, r.chestLabel, milestone);
		} else if (r.status === 'already-claimed') {
			session.notice = DAILY_ALREADY_CLAIMED(r.overall);
		} else {
			session.notice = 'Hãy tạo nhân vật trước.';
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
		if (s.kind !== 'confirm') throw new Error('Confirmation missing');
		if (s.operation === 'start') {
			const r = await this.start.start(session.ownerId, username, s.combatClass);
			if (r.status === 'ok')
				session.notice = 'Đã tạo nhân vật và nhận quà khởi đầu! Chọn Nhận daily hoặc Săn quái để chơi.';
			else if (r.status === 'already-has-character') session.notice = 'Bạn đã có nhân vật.';
			else session.notice = 'Dữ liệu trang bị khởi đầu chưa sẵn sàng. Hãy thử lại sau.';
			return { kind: 'home' };
		}
		if (s.operation === 'reroll') {
			session.notice = await this.quests.refresh(session.ownerId, s.day);
			return { kind: 'quests' };
		}
		return this.fight(session, true, s.day);
	}

	private async fight(session: MenuSession, boss: boolean, expectedDay?: string): Promise<MenuScreen> {
		const r = await this.raid.run(session.ownerId, boss, {
			requestId: `${session.id}:${session.revision}`,
			atomicProgress: true,
			expectedDay,
		});
		if (r.status === 'ok') {
			session.battle = { ...r, boss };
			return { kind: 'result' };
		}
		if (r.status === 'boss-locked') session.notice = r.message;
		else if (r.status === 'already-processed')
			session.notice = 'Trận đấu đã được xử lý; không nhận thưởng lần hai.';
		else if (r.status === 'no-monsters-seeded') session.notice = 'Chưa có quái phù hợp. Hãy thử lại sau.';
		else session.notice = 'Hãy tạo nhân vật trước.';
		return { kind: 'battle' };
	}
}

export const menuGameplay = new MenuGameplayService();
