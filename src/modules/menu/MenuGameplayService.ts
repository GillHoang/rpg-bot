import { GATES, TIERS_PER_GATE } from '../../shared/config/portals.js';
import { GATE_TEXT } from '../../shared/ui/text/portals.js';
import { MENU_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';
import { MenuPlayerRepository } from './infrastructure/MenuPlayerRepository.js';
import { requirePersistence, type PersistenceContext } from '../../shared/kernel/persistence.js';
import { systemClock, type Clock } from '../../shared/kernel/clock.js';
import { AppError } from '../../shared/kernel/Result.js';
import { CLASS_NAMES } from '../../shared/config/classes.js';
import { ProfileService } from '../identity/application/ProfileService.js';
import { StartService } from '../identity/application/StartService.js';
import { ClaimDailyUseCase } from '../economy/application/ClaimDailyUseCase.js';
import { QuestService } from '../meta/application/QuestService.js';
import { RaidService } from '../pve/application/RaidService.js';
import { DailyCycle } from '../../shared/utils/dailyCycle.js';
import type { GamePanel, MenuGameplay } from './MenuGameplay.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { MenuAction } from './menuIds.js';
import {
	battlePanel,
	confirmationPanel,
	homePanel,
	onboardingPanel,
	profilePanel,
	questsPanel,
} from './gameplayPanels.js';
import { routeStatelessAction, navigateBattleLogPage, assertBattleLogNavigable } from './MenuActionRouter.js';
import { gateSelectPanel, gateTiersPanel } from './MenuGatePanels.js';
import { MenuBattleFlow } from './MenuBattleFlow.js';

export interface MenuGameplayDependencies {
	persistence: PersistenceContext;
	clock?: Clock;
	players?: Pick<MenuPlayerRepository, 'findState'>;
}

/** section của MenuScreen → kind panel tương ứng (các section khác không render ở đây). */
const SECTION_KIND: Record<string, string> = { character: 'profile', daily: 'quests', battle: 'battle' };

/**
 * Thin facade over menu rendering + actions. Gate panels live in
 * MenuGatePanels, stateless routing in MenuActionRouter, stateful battle
 * flows in MenuBattleFlow — this class only wires them together.
 */
export class MenuGameplayService implements MenuGameplay {
	private readonly clock: Clock;
	private readonly players: Pick<MenuPlayerRepository, 'findState'>;
	private readonly profiles: Pick<ProfileService, 'get'>;
	private readonly quests: Pick<QuestService, 'snapshot' | 'claimWeeklyGrand' | 'refresh'>;
	private readonly flow: MenuBattleFlow;

	constructor(
		profiles?: Pick<ProfileService, 'get'>,
		start?: Pick<StartService, 'start'>,
		daily?: Pick<ClaimDailyUseCase, 'claim'>,
		quests?: Pick<QuestService, 'snapshot' | 'claimWeeklyGrand' | 'refresh'>,
		raid?: Pick<RaidService, 'run'>,
		options: MenuGameplayDependencies = {} as MenuGameplayDependencies,
	) {
		const persistence = requirePersistence(options, 'MenuGameplayService');
		this.clock = options.clock ?? systemClock;
		this.players = options.players ?? new MenuPlayerRepository(persistence.executor);
		this.profiles = profiles ?? new ProfileService(undefined, undefined, undefined, { persistence });
		const startSvc =
			start ?? new StartService(undefined, undefined, undefined, undefined, undefined, { persistence });
		const dailySvc = daily ?? new ClaimDailyUseCase(undefined, undefined, { persistence });
		this.quests = quests ?? new QuestService(undefined, { persistence });
		const raidSvc = raid ?? new RaidService({ persistence });
		this.flow = new MenuBattleFlow({
			start: startSvc,
			daily: dailySvc,
			quests: this.quests,
			raid: raidSvc,
			clock: this.clock,
		});
	}

	async render(session: MenuSession): Promise<GamePanel | undefined> {
		const screen = session.screen;
		if (screen.kind === 'result' || screen.kind === 'log') return battlePanel(session);
		if (screen.kind === 'confirm') return confirmationPanel(screen);
		const kind = this.resolveKind(screen);
		if (kind === undefined) return undefined;
		if (kind === 'profile') {
			const detail = await this.profiles.get(session.ownerId);
			return detail.status === 'ok' ? profilePanel(detail.data) : onboardingPanel();
		}
		const profile = await this.profiles.get(session.ownerId, 'summary');
		if (profile.status !== 'ok') return onboardingPanel();
		const user = await this.players.findState(session.ownerId);
		const day = DailyCycle.keyAt(this.clock.now());
		const dailyDone = user?.lastDailyClaimDate === day;
		const bossDone = user?.lastBossAttackDate === day;
		if (kind === 'quests') {
			const snapshot = await this.quests.snapshot(session.ownerId);
			if (!snapshot) throw new AppError('MENU_PLAYER_DISAPPEARED', MENU_ERROR_TEXT.playerDisappeared);
			return questsPanel(snapshot, dailyDone);
		}
		if (kind === 'gateSelect') return gateSelectPanel(session, profile.data, user, bossDone);
		if (kind === 'gateTiers') return gateTiersPanel(session, profile.data, user, bossDone);
		if (kind === 'battle') {
			session.screen = { kind: 'gateSelect' };
			return this.render(session);
		}
		return homePanel(profile.data, { dailyDone, bossDone });
	}

	/** Kind panel cho screen hiện tại; `undefined` = screen không render gì (help/search/section lạ). */
	private resolveKind(screen: MenuScreen): string | undefined {
		if (screen.kind === 'section') {
			if (!['character', 'daily', 'battle'].includes(screen.section)) return undefined;
			return SECTION_KIND[screen.section];
		}
		if (['help', 'topic', 'search'].includes(screen.kind)) return undefined;
		return screen.kind;
	}

	async act(session: MenuSession, action: MenuAction, username: string, value?: string): Promise<MenuScreen> {
		// SRP: stateless routing lives in MenuActionRouter; stateful battle
		// flows live in MenuBattleFlow; only menu-specific gates stay here.
		const routed = routeStatelessAction(session, action, value);
		if (routed) return routed;
		switch (action) {
			case 'class':
				return this.startClassConfirm(value);
			case 'daily':
				return this.flow.claimDaily(session);
			case 'claim':
				return this.claimGrand(session);
			case 'reroll':
			case 'boss':
				return { kind: 'confirm', operation: action, day: DailyCycle.keyAt(this.clock.now()) };
			case 'cancel':
				return this.flow.cancelConfirmation(session.screen);
			case 'confirm':
				return this.flow.confirm(session, username);
			case 'fight':
				return this.fightTier(session, value);
			case 'continue':
				return this.continueBattle(session);
			// NOTE: result/log route statelessly via MenuActionRouter above.
			case 'first':
			case 'last':
			case 'prev':
			case 'next':
				return this.navigateBattleLog(session, action);
			default:
				throw new AppError('MENU_UNKNOWN_ACTION', MENU_ERROR_TEXT.unknownAction);
		}
	}

	/** Class pick gate: unknown values never reach the confirm screen. */
	private startClassConfirm(value?: string): MenuScreen {
		const combatClass = CLASS_NAMES.find((c) => c === value);
		if (!combatClass) throw new AppError('MENU_INVALID_CLASS', MENU_ERROR_TEXT.invalidClass);
		return { kind: 'confirm', operation: 'start', combatClass };
	}

	/** Weekly-grand claim surfaces as an ephemeral menu notice. */
	private async claimGrand(session: MenuSession): Promise<MenuScreen> {
		const claimed = await this.quests.claimWeeklyGrand(session.ownerId);
		session.notice = claimed.ok ? claimed.value : claimed.error.message;
		return { kind: 'quests' };
	}

	/** Tier button gate: only a 1-10 tier on the tier screen starts a fight. */
	private async fightTier(session: MenuSession, value?: string): Promise<MenuScreen> {
		if (session.screen.kind !== 'gateTiers' || !/^(?:[1-9]|10)$/.test(value ?? '')) {
			session.notice = GATE_TEXT.invalid;
			return { kind: 'gateSelect' };
		}
		session.portalGate = Number(value);
		return this.flow.fight(session, false);
	}

	/** Post-result continue: advance the portal cursor, then fight the next tier. */
	private async continueBattle(session: MenuSession): Promise<MenuScreen> {
		const battle = session.battle;
		if (!battle?.portal || battle.boss || !['result', 'log'].includes(session.screen.kind)) {
			return { kind: 'gateSelect' };
		}
		const { gate, tier } = battle.portal;
		const won = battle.battle.outcome === 'player_win';
		if (won && tier === TIERS_PER_GATE) {
			if (gate >= GATES.length) return { kind: 'gateSelect' };
			session.gateId = gate + 1;
			session.portalGate = undefined;
			return { kind: 'gateTiers' };
		}
		session.gateId = gate;
		session.portalGate = won ? tier + 1 : tier;
		return this.flow.fight(session, false);
	}

	private navigateBattleLog(session: MenuSession, action: 'first' | 'last' | 'prev' | 'next'): MenuScreen {
		assertBattleLogNavigable(session);
		const total = session.battle!.battle.roundLogs.length;
		const lastPage = Math.max(0, total - 1);
		const currentPage = session.screen.kind === 'log' ? session.screen.page : lastPage;
		return { kind: 'log', page: navigateBattleLogPage(total, currentPage, action) };
	}
}
