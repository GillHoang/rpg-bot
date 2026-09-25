import { GATES, TIERS_PER_GATE } from '../../shared/config/portals.js';
import { GATE_TEXT } from '../../shared/ui/text/portals.js';
import { MENU_ERROR_TEXT } from '../../shared/ui/text/diagnostics.js';
import { MENU_SECTIONS } from '../../shared/ui/text/menu.js';
import { GAMEPLAY_TEXT } from '../../shared/ui/text/gameplay.js';
import { bagSummary } from '../../shared/ui/text/inventory.js';
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
import { InventoryService, INVENTORY_PAGE_SIZE } from '../progression/application/InventoryService.js';
import { PvpShopService } from '../pvp/application/PvpShopService.js';
import { DailyCycle } from '../../shared/utils/dailyCycle.js';
import type { GamePanel, MenuGameplay } from './MenuGameplay.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { MenuAction } from './menuIds.js';
import type { MenuItemApi } from './MenuItem.js';
import { buildPanelButtons, getMenuItem } from './MenuRegistry.js';
import {
	battlePanel,
	confirmationPanel,
	casinoPanel,
	deitiesPanel,
	homePanel,
	inventoryPanel,
	onboardingPanel,
	profilePanel,
	questsPanel,
	shopPanel,
} from './gameplayPanels.js';
import { navigateBattleLogPage, assertBattleLogNavigable } from './MenuActionRouter.js';
import { gateSelectPanel, gateTiersPanel } from './MenuGatePanels.js';
import { MenuBattleFlow } from './MenuBattleFlow.js';

export interface MenuGameplayDependencies {
	persistence: PersistenceContext;
	clock?: Clock;
	players?: Pick<MenuPlayerRepository, 'findState'>;
	inventory?: Pick<InventoryService, 'bag' | 'count' | 'list'>;
	pvpShop?: Pick<PvpShopService, 'list'>;
}

/** section của MenuScreen → kind panel tương ứng (các section khác chỉ hiển thị hướng dẫn tĩnh). */
const SECTION_KIND: Record<string, string> = { character: 'profile', daily: 'quests', battle: 'battle' };

/**
 * Sync panels need no data: adding one = one map entry, no new branch in
 * buildPanel. Data-backed kinds (profile/quests/gates/home) stay in
 * buildPanel where their awaits live.
 */
const SYNC_PANELS: ReadonlyMap<string, (session: MenuSession) => GamePanel | undefined> = new Map([
	['result', (session) => battlePanel(session)],
	['log', (session) => battlePanel(session)],
	['confirm', (session) => (session.screen.kind === 'confirm' ? confirmationPanel(session.screen) : undefined)],
]);

/**
 * Thin facade over menu rendering + actions. Menu elements come from the
 * file registry (`items/registry.generated.ts`); this class only renders
 * panels, attaches the registry buttons, and exposes the business operations
 * items call. Gate panels live in MenuGatePanels, stateless routing in
 * MenuActionRouter, stateful battle flows in MenuBattleFlow.
 */
export class MenuGameplayService implements MenuGameplay, MenuItemApi {
	private readonly clock: Clock;
	private readonly players: Pick<MenuPlayerRepository, 'findState'>;
	private readonly profiles: Pick<ProfileService, 'get'>;
	private readonly quests: Pick<QuestService, 'snapshot' | 'claimWeeklyGrand' | 'refresh'>;
	private readonly inventory: Pick<InventoryService, 'bag' | 'count' | 'list'>;
	private readonly shop: Pick<PvpShopService, 'list'>;
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
		this.inventory = options.inventory ?? new InventoryService(persistence.executor);
		this.shop = options.pvpShop ?? new PvpShopService(undefined, { persistence });
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
		const panel = await this.buildPanel(session);
		if (panel) panel.buttons = buildPanelButtons(session, panel);
		return panel;
	}

	private async buildPanel(session: MenuSession): Promise<GamePanel | undefined> {
		const screen = session.screen;
		if (screen.kind === 'section') {
			const section = MENU_SECTIONS[screen.section];
			return { title: section.title, body: section.body };
		}
		const sync = SYNC_PANELS.get(screen.kind);
		if (sync) return sync(session);
		const kind = this.resolveKind(screen);
		if (kind === undefined) return undefined;
		if (kind === 'profile') {
			const detail = await this.profiles.get(session.ownerId);
			return detail.status === 'ok'
				? profilePanel(detail.data, session.profileTab ?? 'stats')
				: onboardingPanel();
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
			return this.buildPanel(session);
		}
		if (kind === 'inventory') {
			const screen = session.screen as Extract<MenuScreen, { kind: 'inventory' }>;
			return this.buildInventoryPanel(session, screen);
		}
		if (kind === 'deities') {
			const screen = session.screen as Extract<MenuScreen, { kind: 'deities' }>;
			return this.buildDeitiesPanel(session, screen);
		}
		if (kind === 'shop') {
			const bag = await this.inventory.bag(session.ownerId);
			return shopPanel(bag?.valorMedals ?? 0, this.shop.list());
		}
		if (kind === 'casino') return casinoPanel();
		return homePanel(profile.data, { dailyDone, bossDone });
	}

	private async buildInventoryPanel(
		session: MenuSession,
		screen: Extract<MenuScreen, { kind: 'inventory' }>,
	): Promise<GamePanel> {
		if (screen.category === 'bag') {
			const bag = await this.inventory.bag(session.ownerId);
			return inventoryPanel(bag ? bagSummary(bag) : GAMEPLAY_TEXT.inventoryEmpty, 'bag', 1, 1);
		}
		const count = await this.inventory.count(session.ownerId, screen.category);
		const total = Math.max(1, Math.ceil(count / INVENTORY_PAGE_SIZE));
		const page = Math.min(Math.max(screen.page, 1), total);
		screen.page = page;
		const lines = await this.inventory.list(session.ownerId, screen.category, page);
		return inventoryPanel(lines.join('\n\n') || GAMEPLAY_TEXT.inventoryEmpty, screen.category, page, total);
	}

	private async buildDeitiesPanel(
		session: MenuSession,
		screen: Extract<MenuScreen, { kind: 'deities' }>,
	): Promise<GamePanel> {
		const count = await this.inventory.count(session.ownerId, 'deities');
		const total = Math.max(1, Math.ceil(count / INVENTORY_PAGE_SIZE));
		const page = Math.min(Math.max(screen.page, 1), total);
		screen.page = page;
		const lines = await this.inventory.list(session.ownerId, 'deities', page);
		return deitiesPanel(lines.join('\n\n') || GAMEPLAY_TEXT.deitiesEmpty, page, total);
	}

	/** Kind panel cho screen hiện tại; section đã xử lý riêng ở buildPanel. */
	private resolveKind(screen: MenuScreen): string | undefined {
		if (screen.kind === 'section') {
			if (!['character', 'daily', 'battle'].includes(screen.section)) return undefined;
			return SECTION_KIND[screen.section];
		}
		return screen.kind;
	}

	async act(session: MenuSession, action: MenuAction, username: string, value?: string): Promise<MenuScreen> {
		// Class is a select (not a registered button) and stays a direct gate.
		if (action === 'class') return this.startClassConfirm(value);
		const item = getMenuItem(action);
		if (!item) throw new AppError('MENU_UNKNOWN_ACTION', MENU_ERROR_TEXT.unknownAction);
		return item.run({ session, value, username, api: this });
	}

	// --- MenuItemApi: business operations items invoke ---

	async claimDaily(session: MenuSession): Promise<MenuScreen> {
		return this.flow.claimDaily(session);
	}

	async claimGrand(session: MenuSession): Promise<MenuScreen> {
		const claimed = await this.quests.claimWeeklyGrand(session.ownerId);
		session.notice = claimed.ok ? claimed.value : claimed.error.message;
		return { kind: 'quests' };
	}

	beginConfirmation(_session: MenuSession, operation: 'boss' | 'reroll'): MenuScreen {
		return { kind: 'confirm', operation, day: DailyCycle.keyAt(this.clock.now()) };
	}

	cancel(session: MenuSession): MenuScreen {
		return this.flow.cancelConfirmation(session.screen);
	}

	async confirm(session: MenuSession, username: string): Promise<MenuScreen> {
		return this.flow.confirm(session, username);
	}

	async fightTier(session: MenuSession, value?: string): Promise<MenuScreen> {
		if (session.screen.kind !== 'gateTiers' || !/^(?:[1-9]|10)$/.test(value ?? '')) {
			session.notice = GATE_TEXT.invalid;
			return { kind: 'gateSelect' };
		}
		session.portalGate = Number(value);
		return this.flow.fight(session, false);
	}

	async continueBattle(session: MenuSession): Promise<MenuScreen> {
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

	navigateLog(session: MenuSession, action: 'first' | 'last' | 'prev' | 'next'): MenuScreen {
		assertBattleLogNavigable(session);
		const total = session.battle!.battle.roundLogs.length;
		const lastPage = Math.max(0, total - 1);
		const currentPage = session.screen.kind === 'log' ? session.screen.page : lastPage;
		return { kind: 'log', page: navigateBattleLogPage(total, currentPage, action) };
	}

	/** Class pick gate: unknown values never reach the confirm screen. */
	private startClassConfirm(value?: string): MenuScreen {
		const combatClass = CLASS_NAMES.find((c) => c === value);
		if (!combatClass) throw new AppError('MENU_INVALID_CLASS', MENU_ERROR_TEXT.invalidClass);
		return { kind: 'confirm', operation: 'start', combatClass };
	}
}
