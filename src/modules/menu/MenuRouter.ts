import { MENU_LOG_TEXT } from '../../shared/ui/text/diagnostics.js';
import {
	MessageFlags,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Interaction,
	type StringSelectMenuInteraction,
} from 'discord.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/kernel/Result.js';
import { MENU_TEXT } from '../../shared/ui/text/menu.js';
import { MenuCapacityError, MenuSessionStore, type MenuScreen, type MenuSession } from './MenuSessionStore.js';
import { MENU_OPEN_ID, MENU_PREFIX, parseMenuId, type MenuAction } from './menuIds.js';
import type { MenuGameplay } from './MenuGameplay.js';
import { CLASS_NAMES } from '../../shared/config/classes.js';
import { menuView, recoveryView } from './menuViews.js';
import { isNavigationAction } from './MenuRegistry.js';

type MenuInteraction = ButtonInteraction | StringSelectMenuInteraction;

/**
 * Menu-side error boundary, mirroring CommandRegistry.dispatch: AppError
 * carries a user-safe message (shown as-is); unknown errors fall back to a
 * generic failure notice and are logged with stack.
 */
function userMessage(error: unknown, fallback: string): string {
	return error instanceof AppError ? error.message : fallback;
}

export class MenuRouter {
	constructor(
		private readonly sessions: Pick<
			MenuSessionStore,
			'create' | 'bind' | 'acquire' | 'release' | 'touch' | 'delete' | 'sweep'
		> = new MenuSessionStore(),
		private readonly gameplay?: MenuGameplay,
	) {}

	async open(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
		let session: MenuSession | undefined;
		try {
			await interaction.deferReply();
			session = this.sessions.create(interaction.user.id);
			session.avatarUrl = interaction.user.displayAvatarURL?.({ size: 256 });
			session.gamePanel = await this.gameplay?.render(session);
			const message = await interaction.editReply(menuView(session));
			this.sessions.bind(session, message.id);
		} catch (error) {
			if (session) this.sessions.delete(session.id);
			logger.error({ err: error, userId: interaction.user.id }, MENU_LOG_TEXT.openFailed);
			// Use V2 even on failure: a failed HTTP response may have already applied the flag.
			const text = error instanceof MenuCapacityError ? MENU_TEXT.capacity : userMessage(error, MENU_TEXT.failed);
			if (interaction.deferred) {
				try {
					await interaction.editReply(recoveryView(text));
				} catch {
					await this.notice(interaction, text);
				}
			} else await this.notice(interaction, text);
		}
	}

	/** Returns false for other components so existing duel/casino/pager collectors still own them. */
	async handle(interaction: Interaction): Promise<boolean> {
		if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
		if (!interaction.customId.startsWith(MENU_PREFIX)) return false;
		if (interaction.isButton() && interaction.customId === MENU_OPEN_ID) {
			await this.open(interaction);
			return true;
		}
		const parsed = parseMenuId(interaction.customId);
		if (!parsed) {
			await this.notice(interaction, MENU_TEXT.invalid);
			return true;
		}
		const result = this.sessions.acquire(parsed.id, interaction.user.id, interaction.message?.id, parsed.revision);
		if (result.status !== 'ok') {
			await this.notice(interaction, MENU_TEXT[result.status]);
			return true;
		}
		const session = result.session;
		try {
			await this.dispatch(interaction, session, parsed.action, parsed.nonce);
		} catch (error) {
			// HTTP failures can be ambiguous. Retire the session, never replay an action.
			this.sessions.delete(session.id);
			logger.error({ err: error, sessionId: session.id, action: parsed.action }, MENU_LOG_TEXT.interactionFailed);
			await this.notice(interaction, userMessage(error, MENU_TEXT.failed));
		} finally {
			this.sessions.release(session);
			this.sessions.touch(session);
		}
		return true;
	}

	private async dispatch(
		interaction: MenuInteraction,
		session: MenuSession,
		action: MenuAction,
		value?: string,
	): Promise<void> {
		if (interaction.isButton() && isNavigationAction(action)) {
			await this.handleNavigation(interaction, session, action);
			return;
		}
		if (!this.gameplay) {
			await this.notice(interaction, MENU_TEXT.invalid);
			return;
		}
		await this.handleGameplay(interaction, session, action, value);
	}

	private async handleGameplay(
		interaction: MenuInteraction,
		session: MenuSession,
		action: MenuAction,
		value?: string,
	): Promise<void> {
		const classSelect =
			action === 'class' &&
			interaction.isStringSelectMenu() &&
			session.gamePanel?.classes &&
			interaction.values.length === 1 &&
			(CLASS_NAMES as readonly string[]).includes(interaction.values[0]!);
		const button =
			interaction.isButton() &&
			session.gamePanel?.buttons?.some((b) => b.action === action && b.value === value && !b.disabled);
		if (!this.gameplay || (!classSelect && !button)) {
			await this.notice(interaction, MENU_TEXT.invalid);
			return;
		}
		// Every gameplay action edits the /menu message in place.
		await this.acknowledge(interaction);
		session.notice = undefined;
		session.playerName = interaction.user.username;
		const next = await this.gameplay.act(
			session,
			action,
			interaction.user.username,
			interaction.isStringSelectMenu() ? interaction.values[0] : value,
		);
		// Do not carry old confirmations through a gameplay action.
		await this.navigate(interaction, session, next, []);
	}

	private async handleNavigation(
		interaction: ButtonInteraction,
		session: MenuSession,
		action: MenuAction,
	): Promise<void> {
		if (!['home', 'back', 'refresh', 'close'].includes(action)) {
			await this.notice(interaction, MENU_TEXT.invalid);
			return;
		}
		await this.acknowledge(interaction);
		if (action === 'close') {
			this.sessions.delete(session.id);
			await interaction.editReply(recoveryView(MENU_TEXT.closed));
		} else if (action === 'home') {
			await this.navigate(interaction, session, { kind: 'home' }, []);
		} else if (action === 'back') {
			await this.navigate(
				interaction,
				session,
				session.history.at(-1) ?? { kind: 'home' },
				session.history.slice(0, -1),
			);
		} else {
			await this.navigate(interaction, session, session.screen, session.history);
		}
	}

	sweep(): void {
		this.sessions.sweep();
	}

	private async acknowledge(interaction: MenuInteraction): Promise<void> {
		await interaction.deferUpdate();
	}

	private async navigate(
		interaction: MenuInteraction,
		session: MenuSession,
		screen: MenuScreen,
		history?: MenuScreen[],
	): Promise<void> {
		const next: MenuSession = {
			...session,
			screen,
			revision: session.revision + 1,
			history:
				history ??
				(JSON.stringify(screen) === JSON.stringify(session.screen)
					? session.history
					: [...session.history, session.screen].slice(-12)),
		};
		next.gamePanel = await this.gameplay?.render(next);
		const view = menuView(next);
		const message = await interaction.editReply(view);
		Object.assign(session, next);
		if (!session.messageId) this.sessions.bind(session, message.id);
		this.sessions.touch(session);
	}

	private async notice(interaction: MenuInteraction | ChatInputCommandInteraction, text: string): Promise<void> {
		// Error/recovery notices are always ephemeral: a forged or stale
		// click (including clicks on another user's menu) must never let
		// anyone spam public messages into the channel.
		const payload = {
			...recoveryView(text),
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		} as const;
		try {
			if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
			else await interaction.reply(payload);
		} catch (error) {
			logger.warn({ err: error }, MENU_LOG_TEXT.recoveryFailed);
		}
	}
}
