import { MENU_LOG_TEXT } from '../text/diagnostics.js';
import { randomBytes } from 'node:crypto';
import {
	MessageFlags,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Interaction,
	type ModalSubmitInteraction,
	type StringSelectMenuInteraction,
} from 'discord.js';
import { logger } from '../utils/logger.js';
import { MENU_SECTIONS, MENU_TEXT, type MenuSection } from '../text/menu.js';
import { MenuCapacityError, MenuSessionStore, type MenuScreen, type MenuSession } from './MenuSessionStore.js';
import { GAME_ACTIONS, MENU_OPEN_ID, MENU_PREFIX, parseMenuId, type MenuAction } from './menuIds.js';
import type { MenuGameplay } from './MenuGameplay.js';
import { CLASS_NAMES } from '../config/classes.js';
import { helpMatches, menuView, recoveryView, searchModal } from './menuViews.js';
import { HELP_PAGES } from '../text/help.js';

type MenuInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

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
			session.launcher = true;
			session.avatarUrl = interaction.user.displayAvatarURL?.({ size: 256 });
			session.gamePanel = await this.gameplay?.render(session);
			const message = await interaction.editReply(menuView(session));
			this.sessions.bind(session, message.id);
		} catch (error) {
			if (session) this.sessions.delete(session.id);
			logger.error({ err: error, userId: interaction.user.id }, MENU_LOG_TEXT.openFailed);
			// Use V2 even on failure: a failed HTTP response may have already applied the flag.
			const text = error instanceof MenuCapacityError ? MENU_TEXT.capacity : MENU_TEXT.failed;
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
		if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return false;
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
		const source = result.session;
		let session = source;
		try {
			session = this.selectSession(source, parsed.action);
			await this.dispatch(interaction, session, parsed);
		} catch (error) {
			// HTTP failures can be ambiguous. Retire the session, never replay an action.
			this.sessions.delete(session.id);
			if ((GAME_ACTIONS as readonly string[]).includes(parsed.action)) this.sessions.delete(source.id);
			logger.error({ err: error, sessionId: session.id, action: parsed.action }, MENU_LOG_TEXT.interactionFailed);
			await this.notice(interaction, MENU_TEXT.failed);
		} finally {
			if (session !== source && !session.messageId) this.sessions.delete(session.id);
			this.sessions.release(session);
			this.sessions.touch(source);
			this.sessions.release(source);
		}
		return true;
	}

	private selectSession(source: MenuSession, action: MenuAction): MenuSession {
		if (
			!source.launcher ||
			this.updatesInPlace(source, action) ||
			source.gamePanel?.classes ||
			['search', 'close'].includes(action)
		)
			return source;
		const session = this.sessions.create(source.ownerId);
		Object.assign(session, {
			screen: source.screen,
			gamePanel: source.gamePanel,
			avatarUrl: source.avatarUrl,
			pendingModal: source.pendingModal,
		});
		source.pendingModal = null;
		return session;
	}

	private updatesInPlace(source: MenuSession, action: MenuAction): boolean {
		if (source.gamePanel?.classes) return true;
		if (['daily', 'quests', 'claim', 'reroll'].includes(action)) return true;
		if (
			source.screen.kind === 'confirm' &&
			source.screen.operation === 'reroll' &&
			['confirm', 'cancel'].includes(action)
		)
			return true;
		return source.screen.kind !== 'home' && ['home', 'back', 'refresh'].includes(action);
	}

	private async dispatch(
		interaction: MenuInteraction,
		session: MenuSession,
		parsed: NonNullable<ReturnType<typeof parseMenuId>>,
	): Promise<void> {
		if ((GAME_ACTIONS as readonly string[]).includes(parsed.action)) {
			await this.handleGameplay(interaction, session, parsed.action);
			return;
		}
		session.notice = undefined;
		if (interaction.isModalSubmit()) await this.handleSearch(interaction, session, parsed);
		else if (interaction.isStringSelectMenu()) await this.handleSelect(interaction, session, parsed.action);
		else await this.handleButton(interaction, session, parsed.action);
	}

	private async handleGameplay(
		interaction: MenuInteraction,
		session: MenuSession,
		action: MenuAction,
	): Promise<void> {
		const classSelect =
			action === 'class' &&
			interaction.isStringSelectMenu() &&
			session.gamePanel?.classes &&
			interaction.values.length === 1 &&
			(CLASS_NAMES as readonly string[]).includes(interaction.values[0]!);
		const button =
			interaction.isButton() && session.gamePanel?.buttons.some((b) => b.action === action && !b.disabled);
		if (!this.gameplay || (!classSelect && !button)) {
			await this.notice(interaction, MENU_TEXT.invalid);
			return;
		}
		if (['daily', 'quests', 'claim', 'reroll'].includes(action) || session.gamePanel?.classes)
			await interaction.deferUpdate();
		else await this.acknowledge(interaction, session);
		session.notice = undefined;
		session.playerName = interaction.user.username;
		const next = await this.gameplay.act(
			session,
			action,
			interaction.user.username,
			interaction.isStringSelectMenu() ? interaction.values[0] : undefined,
		);
		// Do not carry old confirmations through a gameplay action.
		await this.navigate(interaction, session, next, []);
	}

	private async handleSearch(
		interaction: ModalSubmitInteraction,
		session: MenuSession,
		parsed: NonNullable<ReturnType<typeof parseMenuId>>,
	): Promise<void> {
		if (
			parsed.action !== 'find' ||
			!interaction.isFromMessage() ||
			!session.pendingModal ||
			session.pendingModal !== parsed.nonce
		) {
			await this.notice(interaction, MENU_TEXT.stale);
			return;
		}
		session.pendingModal = null;
		const query = interaction.fields.getTextInputValue('query').trim();
		if (!query || query.length > 80 || [...query].some((character) => character.codePointAt(0)! < 32)) {
			await this.notice(interaction, MENU_TEXT.invalidSearch);
			return;
		}
		await this.acknowledge(interaction, session);
		await this.navigate(interaction, session, { kind: 'search', query });
	}

	private async handleSelect(
		interaction: StringSelectMenuInteraction,
		session: MenuSession,
		action: MenuAction,
	): Promise<void> {
		const value = interaction.values.length === 1 ? interaction.values[0]! : '';
		let next: MenuScreen | undefined;
		if (action === 'section' && Object.hasOwn(MENU_SECTIONS, value)) {
			next = { kind: 'section', section: value as MenuSection };
		} else if (action === 'topic' && /^(0|[1-9]\d*)$/.test(value)) {
			const available = this.availableTopics(session.screen);
			if (available.includes(Number(value))) next = { kind: 'topic', index: Number(value) };
		}
		if (!next) {
			await this.notice(interaction, MENU_TEXT.invalid);
			return;
		}
		await this.acknowledge(interaction, session);
		await this.navigate(interaction, session, next);
	}

	private async handleButton(
		interaction: ButtonInteraction,
		session: MenuSession,
		action: MenuAction,
	): Promise<void> {
		if (action === 'search') {
			const nonce = randomBytes(8).toString('hex');
			// Opening a modal MUST be the first response, never deferred.
			await interaction.showModal(searchModal(session, nonce));
			session.pendingModal = nonce;
			this.sessions.touch(session);
			return;
		}
		if (!['help', 'home', 'back', 'refresh', 'close'].includes(action)) {
			await this.notice(interaction, MENU_TEXT.invalid);
			return;
		}
		await this.acknowledge(interaction, session);
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
		} else if (action === 'refresh') {
			await this.navigate(interaction, session, session.screen, session.history);
		} else {
			await this.navigate(interaction, session, { kind: 'help' });
		}
	}

	private availableTopics(screen: MenuScreen): number[] {
		if (screen.kind === 'help') return HELP_PAGES.map((_, n) => n);
		if (screen.kind === 'search') return helpMatches(screen.query).slice(0, 25);
		return [];
	}

	sweep(): void {
		this.sessions.sweep();
	}

	private async acknowledge(interaction: MenuInteraction, session: MenuSession): Promise<void> {
		if (!session.messageId || (session.launcher && session.screen.kind === 'home'))
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		else await interaction.deferUpdate();
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
			pendingModal: null,
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
		const payload = { ...recoveryView(text), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral } as const;
		try {
			if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
			else await interaction.reply(payload);
		} catch (error) {
			logger.warn({ err: error }, MENU_LOG_TEXT.recoveryFailed);
		}
	}
}
