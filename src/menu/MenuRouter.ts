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
import { GAME_ACTIONS, MENU_OPEN_ID, MENU_PREFIX, parseMenuId } from './menuIds.js';
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
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			session = this.sessions.create(interaction.user.id);
			session.avatarUrl = interaction.user.displayAvatarURL?.({ size: 256 });
			session.gamePanel = await this.gameplay?.render(session);
			const message = await interaction.editReply(menuView(session));
			this.sessions.bind(session, message.id);
		} catch (error) {
			if (session) this.sessions.delete(session.id);
			logger.error({ err: error, userId: interaction.user.id }, 'Menu open failed');
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
		const session = result.session;
		try {
			if ((GAME_ACTIONS as readonly string[]).includes(parsed.action)) {
				const classSelect =
					parsed.action === 'class' &&
					interaction.isStringSelectMenu() &&
					session.gamePanel?.classes &&
					interaction.values.length === 1 &&
					CLASS_NAMES.some((c) => c === interaction.values[0]);
				const button =
					interaction.isButton() &&
					session.gamePanel?.buttons.some((b) => b.action === parsed.action && !b.disabled);
				if (!this.gameplay || (!classSelect && !button)) {
					await this.notice(interaction, MENU_TEXT.invalid);
					return true;
				}
				await interaction.deferUpdate();
				session.notice = undefined;
				const next = await this.gameplay.act(
					session,
					parsed.action,
					interaction.user.username,
					interaction.isStringSelectMenu() ? interaction.values[0] : undefined,
				);
				// Do not carry old confirmations through a gameplay action.
				await this.navigate(interaction, session, next, []);
				return true;
			}
			session.notice = undefined;
			if (interaction.isModalSubmit()) {
				if (
					parsed.action !== 'find' ||
					!interaction.isFromMessage() ||
					!session.pendingModal ||
					session.pendingModal !== parsed.nonce
				) {
					await this.notice(interaction, MENU_TEXT.stale);
					return true;
				}
				session.pendingModal = null;
				const query = interaction.fields.getTextInputValue('query').trim();
				if (!query || query.length > 80 || [...query].some((character) => character.charCodeAt(0) < 32)) {
					await this.notice(interaction, MENU_TEXT.invalidSearch);
					return true;
				}
				await interaction.deferUpdate();
				await this.navigate(interaction, session, { kind: 'search', query });
			} else if (interaction.isStringSelectMenu()) {
				const value = interaction.values.length === 1 ? interaction.values[0]! : '';
				let next: MenuScreen | undefined;
				if (parsed.action === 'section' && Object.hasOwn(MENU_SECTIONS, value)) {
					next = { kind: 'section', section: value as MenuSection };
				} else if (parsed.action === 'topic' && /^(0|[1-9]\d*)$/.test(value)) {
					const available =
						session.screen.kind === 'help'
							? HELP_PAGES.map((_, n) => n)
							: session.screen.kind === 'search'
								? helpMatches(session.screen.query).slice(0, 25)
								: [];
					if (available.includes(Number(value))) next = { kind: 'topic', index: Number(value) };
				}
				if (!next) {
					await this.notice(interaction, MENU_TEXT.invalid);
					return true;
				}
				await interaction.deferUpdate();
				await this.navigate(interaction, session, next);
			} else {
				if (parsed.action === 'search') {
					const nonce = randomBytes(8).toString('hex');
					// Opening a modal MUST be the first response, never deferred.
					await interaction.showModal(searchModal(session, nonce));
					session.pendingModal = nonce;
					this.sessions.touch(session);
					return true;
				}
				if (!['help', 'home', 'back', 'refresh', 'close'].includes(parsed.action)) {
					await this.notice(interaction, MENU_TEXT.invalid);
					return true;
				}
				await interaction.deferUpdate();
				if (parsed.action === 'close') {
					this.sessions.delete(session.id);
					await interaction.editReply(recoveryView(MENU_TEXT.closed));
				} else if (parsed.action === 'home') {
					await this.navigate(interaction, session, { kind: 'home' }, []);
				} else if (parsed.action === 'back') {
					await this.navigate(
						interaction,
						session,
						session.history.at(-1) ?? { kind: 'home' },
						session.history.slice(0, -1),
					);
				} else if (parsed.action === 'refresh') {
					await this.navigate(interaction, session, session.screen, session.history);
				} else {
					await this.navigate(interaction, session, { kind: 'help' });
				}
			}
		} catch (error) {
			// HTTP failures can be ambiguous. Retire the session, never replay an action.
			this.sessions.delete(session.id);
			logger.error({ err: error, sessionId: session.id, action: parsed.action }, 'Menu interaction failed');
			await this.notice(interaction, MENU_TEXT.failed);
		} finally {
			this.sessions.release(session);
		}
		return true;
	}

	sweep(): void {
		this.sessions.sweep();
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
		await interaction.editReply(menuView(next));
		Object.assign(session, next);
		this.sessions.touch(session);
	}

	private async notice(interaction: MenuInteraction | ChatInputCommandInteraction, text: string): Promise<void> {
		const payload = { ...recoveryView(text), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral } as const;
		try {
			if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
			else await interaction.reply(payload);
		} catch (error) {
			logger.warn({ err: error }, 'Could not send menu recovery message');
		}
	}
}
