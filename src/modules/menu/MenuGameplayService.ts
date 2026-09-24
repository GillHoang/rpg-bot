import {
	GATES,
	GATE_TIERS,
	TIERS_PER_GATE,
	defaultGateTier,
	gateUnlocked,
	highestAccessibleGate,
} from '../../shared/config/portals.js';
import { GATE_TEXT } from '../../shared/ui/text/portals.js';
import { dailyRewardText } from '../../shared/ui/render/dailyRewardText.js';
import { MENU_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';
import { GAMEPLAY_NOTICE } from '../../shared/ui/text/gameplay.js';
import { MenuPlayerRepository, type MenuPlayerState } from './infrastructure/MenuPlayerRepository.js';
import type { PersistenceContext } from '../../shared/kernel/persistence.js';
import { defaultPersistence } from '../../db/defaultPersistence.js';
import { systemClock, type Clock } from '../../shared/kernel/clock.js';
import { AppError } from '../../shared/kernel/Result.js';
import { CLASS_NAMES } from '../../shared/config/classes.js';
import { ProfileService, type ProfileSummaryData } from '../identity/application/ProfileService.js';
import { StartService } from '../identity/application/StartService.js';
import { ClaimDailyUseCase } from '../economy/application/ClaimDailyUseCase.js';
import { QuestService } from '../meta/application/QuestService.js';
import { RaidService } from '../pve/application/RaidService.js';
import { DailyCycle } from '../../shared/utils/dailyCycle.js';
import { DAILY_ALREADY_CLAIMED } from '../../shared/ui/text/daily.js';
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
import { routeStatelessAction, navigateBattleLogPage, assertBattleLogNavigable } from './MenuActionRouter.js';

export interface MenuGameplayDependencies {
	persistence?: PersistenceContext;
	clock?: Clock;
	players?: Pick<MenuPlayerRepository, 'findState'>;
}

/** section của MenuScreen → kind panel tương ứng (các section khác không render ở đây). */
const SECTION_KIND: Record<string, string> = { character: 'profile', daily: 'quests', battle: 'battle' };

export class MenuGameplayService implements MenuGameplay {
	private readonly clock: Clock;
	private readonly players: Pick<MenuPlayerRepository, 'findState'>;
	private readonly profiles: Pick<ProfileService, 'get'>;
	private readonly start: Pick<StartService, 'start'>;
	private readonly daily: Pick<ClaimDailyUseCase, 'claim'>;
	private readonly quests: Pick<QuestService, 'snapshot' | 'claimWeeklyGrand' | 'refresh'>;
	private readonly raid: Pick<RaidService, 'run'>;

	constructor(
		profiles?: Pick<ProfileService, 'get'>,
		start?: Pick<StartService, 'start'>,
		daily?: Pick<ClaimDailyUseCase, 'claim'>,
		quests?: Pick<QuestService, 'snapshot' | 'claimWeeklyGrand' | 'refresh'>,
		raid?: Pick<RaidService, 'run'>,
		options: MenuGameplayDependencies = {},
	) {
		const persistence = options.persistence ?? defaultPersistence;
		this.clock = options.clock ?? systemClock;
		this.players = options.players ?? new MenuPlayerRepository(persistence.executor);
		this.profiles = profiles ?? new ProfileService(undefined, undefined, undefined, { persistence });
		this.start = start ?? new StartService(undefined, undefined, undefined, undefined, undefined, { persistence });
		this.daily = daily ?? new ClaimDailyUseCase(undefined, undefined, { persistence });
		this.quests = quests ?? new QuestService(undefined, { persistence });
		this.raid = raid ?? new RaidService({ persistence });
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
		if (kind === 'gateSelect') return this.gateSelectPanel(session, profile.data, user, bossDone);
		if (kind === 'gateTiers') return this.gateTiersPanel(session, profile.data, user, bossDone);
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

	/** Màn chọn Gate: danh sách 5 Gate kèm trạng thái unlocked theo tiến độ + level. */
	private gateSelectPanel(
		session: MenuSession,
		profile: ProfileSummaryData,
		user: MenuPlayerState | undefined,
		bossDone: boolean,
	): GamePanel {
		const gatesCleared = this.gatesCleared(user);
		const level = profile.level;
		const panel = battleLobbyPanel(profile, bossDone, !!session.battle);
		panel.title = GATE_TEXT.title;
		panel.body = [
			...GATES.map((g) => {
				const cleared = gatesCleared[g.id - 1] ?? 0;
				return (
					GATE_TEXT.gateRow(g.id, g.name, g.modifier, g.minLevel, cleared, level) +
					` · ` +
					GATE_TEXT.tiersStatus(cleared)
				);
			}),
			GATE_TEXT.rules,
			panel.body,
		].join('\n');
		panel.buttons = [
			...GATES.map((g) => ({
				action: 'gate' as MenuAction,
				label: `Gate ${g.id}`,
				value: String(g.id),
				disabled: !gateUnlocked(g, gatesCleared, level),
			})),
			...panel.buttons.slice(1),
		];
		return panel;
	}

	/** Màn tier trong một Gate: khóa tầng vượt quá `cleared + 1` (chỉ mở dần từng tầng). */
	private gateTiersPanel(
		session: MenuSession,
		profile: ProfileSummaryData,
		user: MenuPlayerState | undefined,
		bossDone: boolean,
	): GamePanel {
		const gatesCleared = this.gatesCleared(user);
		const level = profile.level;
		const gate = GATES.find((g) => g.id === session.gateId) ?? highestAccessibleGate(gatesCleared);
		const gateCleared = gatesCleared[gate.id - 1] ?? 0;
		const tiers = GATE_TIERS.filter((t) => t.gate.id === gate.id);
		const selected = tiers.find((t) => t.number === session.portalGate) ?? defaultGateTier(gatesCleared, gate);
		session.gateId = gate.id;
		session.portalGate = selected.number;
		const panel = battleLobbyPanel(profile, bossDone, !!session.battle);
		panel.title = GATE_TEXT.title;
		panel.body = [
			GATE_TEXT.gateHeader(gate.id, gate.name, gate.modifier, gate.minLevel),
			...tiers.map((t) => GATE_TEXT.tierRow(t, gateCleared)),
			gateCleared >= TIERS_PER_GATE ? GATE_TEXT.gateCleared : '',
			panel.body,
		]
			.filter(Boolean)
			.join('\n');
		panel.buttons = [
			...tiers.map((tier) => ({
				action: 'fight' as const,
				label: GATE_TEXT.fightTier(tier.number),
				value: String(tier.number),
				disabled: !gateUnlocked(gate, gatesCleared, level) || tier.number > gateCleared + 1,
			})),
			{ action: 'hunt', label: GATE_TEXT.chooseGate },
			...panel.buttons.slice(1),
		];
		return panel;
	}

	private gatesCleared(
		user:
			| {
					gate1TiersCleared?: number | null;
					gate2TiersCleared?: number | null;
					gate3TiersCleared?: number | null;
					gate4TiersCleared?: number | null;
					gate5TiersCleared?: number | null;
			  }
			| undefined,
	): number[] {
		return [
			user?.gate1TiersCleared ?? 0,
			user?.gate2TiersCleared ?? 0,
			user?.gate3TiersCleared ?? 0,
			user?.gate4TiersCleared ?? 0,
			user?.gate5TiersCleared ?? 0,
		];
	}

	async act(session: MenuSession, action: MenuAction, username: string, value?: string): Promise<MenuScreen> {
		// SRP: stateless routing lives in MenuActionRouter; this facade only
		// handles stateful actions needing collaborators/clock.
		const routed = routeStatelessAction(session, action, value);
		if (routed) return routed;
		switch (action) {
			case 'class': {
				const combatClass = CLASS_NAMES.find((c) => c === value);
				if (!combatClass) throw new AppError('MENU_INVALID_CLASS', MENU_ERROR_TEXT.invalidClass);
				return { kind: 'confirm', operation: 'start', combatClass };
			}
			case 'daily':
				return this.claimDaily(session);
			case 'claim':
				session.notice = await this.quests.claimWeeklyGrand(session.ownerId);
				return { kind: 'quests' };
			case 'reroll':
			case 'boss':
				return { kind: 'confirm', operation: action, day: DailyCycle.keyAt(this.clock.now()) };
			case 'cancel':
				return this.cancelConfirmation(session.screen);
			case 'confirm':
				return this.confirm(session, username);
			case 'fight':
				if (session.screen.kind !== 'gateTiers' || !/^(?:[1-9]|10)$/.test(value ?? '')) {
					session.notice = GATE_TEXT.invalid;
					return { kind: 'gateSelect' };
				}
				session.portalGate = Number(value);
				return this.fight(session, false);
			case 'continue': {
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
				return this.fight(session, false);
			}
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

	private navigateBattleLog(session: MenuSession, action: 'first' | 'last' | 'prev' | 'next'): MenuScreen {
		assertBattleLogNavigable(session);
		const total = session.battle!.battle.roundLogs.length;
		const lastPage = Math.max(0, total - 1);
		const currentPage = session.screen.kind === 'log' ? session.screen.page : lastPage;
		return { kind: 'log', page: navigateBattleLogPage(total, currentPage, action) };
	}

	private async claimDaily(session: MenuSession): Promise<MenuScreen> {
		const r = await this.daily.claim(session.ownerId);
		if (r.status === 'ok') {
			session.notice = dailyRewardText(r);
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
		if (screen.operation === 'boss') return { kind: 'gateSelect' };
		return { kind: 'home' };
	}

	private async confirm(session: MenuSession, username: string): Promise<MenuScreen> {
		const s = session.screen;
		if (s.kind !== 'confirm') throw new AppError('MENU_MISSING_CONFIRMATION', MENU_ERROR_TEXT.missingConfirmation);
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
		const r = await this.raid.run(session.ownerId, boss, {
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
				Math.max(1, Math.ceil((r.retryAt.getTime() - this.clock.now().getTime()) / 1000)),
			);
			return session.battle ? { kind: 'result' } : { kind: 'gateTiers' };
		} else if (r.status === 'already-processed') session.notice = GAMEPLAY_NOTICE.alreadyProcessed;
		else if (r.status === 'no-monsters-seeded') session.notice = GAMEPLAY_NOTICE.noMonster;
		else session.notice = GAMEPLAY_NOTICE.createFirst;
		return { kind: 'gateTiers' };
	}
}

/** @deprecated Import the service from `createAppContainer` instead of this
 * module-level singleton; it exists only for legacy presentation imports. */
export const menuGameplay = new MenuGameplayService();
