import { CASINO_LOG_TEXT } from '../../../shared/ui/text/diagnostics.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { CasinoSessionService, type SessionView } from '../application/CasinoSessionService.js';
import type { CasinoAction, InteractiveGame } from '../domain/InteractiveGame.js';
import { logger } from '../../../shared/utils/logger.js';
import {
	CASINO_CASH_OUT_LABEL,
	CASINO_HIT_LABEL,
	CASINO_NOT_YOUR_ROUND,
	CASINO_PUSH_LABEL,
	CASINO_STAND_LABEL,
} from '../../../shared/ui/text/casino.js';

export class InteractiveCasinoController {
	constructor(private readonly sessions: Pick<CasinoSessionService, 'start' | 'act'> = new CasinoSessionService()) {}

	async execute(i: ChatInputCommandInteraction, game: InteractiveGame, bet: number): Promise<void> {
		await i.deferReply();
		const start = await this.sessions.start(i.user.id, game, bet);
		const render = (view: SessionView) => ({
			content: view.text,
			components:
				view.status === 'error' || view.done
					? []
					: [
							new ActionRowBuilder<ButtonBuilder>().addComponents(
								new ButtonBuilder()
									.setCustomId(
										`${view.sessionId}:${game === 'blackjack' ? 'hit' : 'push'}:${view.revision}`,
									)
									.setLabel(game === 'blackjack' ? CASINO_HIT_LABEL : CASINO_PUSH_LABEL)
									.setStyle(ButtonStyle.Primary),
								new ButtonBuilder()
									.setCustomId(
										`${view.sessionId}:${game === 'blackjack' ? 'stand' : 'cash'}:${view.revision}`,
									)
									.setLabel(game === 'blackjack' ? CASINO_STAND_LABEL : CASINO_CASH_OUT_LABEL)
									.setStyle(ButtonStyle.Success),
							),
						],
		});
		const message = await i.editReply(render(start));
		if (start.status !== 'ok' || start.done) return;
		const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
		let queue = Promise.resolve();
		collector.on('collect', (button) => {
			if (button.user.id !== i.user.id) {
				void button.reply({ content: CASINO_NOT_YOUR_ROUND, ephemeral: true }).catch(() => {});
				return;
			}
			// Acknowledge before waiting behind a previous click; serialize both state and UI.
			const ack = button.deferUpdate().then(
				() => true,
				(error) => {
					logger.error({ error }, CASINO_LOG_TEXT.acknowledgementFailed);
					return false;
				},
			);
			queue = queue
				.then(async () => {
					if (!(await ack)) return;
					const [sessionId, action, revision] = button.customId.split(':');
					if (sessionId !== start.sessionId) return;
					const view = await this.sessions.act(
						i.user.id,
						sessionId,
						action as CasinoAction,
						Number(revision),
					);
					await i.editReply(render(view));
					if (view.status === 'ok' && view.done) collector.stop('settled');
				})
				.catch((error) => {
					logger.error({ error }, CASINO_LOG_TEXT.interactionFailed);
					collector.stop('error');
				});
		});
		collector.on('end', (_collected, reason) => {
			if (reason === 'settled') return;
			void queue
				.then(async () => {
					const view = await this.sessions.act(i.user.id, start.sessionId, 'timeout');
					await i.editReply(render(view));
				})
				.catch((error) => logger.error({ error }, CASINO_LOG_TEXT.timeoutFailed));
		});
	}
}

const defaultController = new InteractiveCasinoController();

/** Compatibility entry point for callers using the original function API. */
export async function interactiveCasino(
	i: ChatInputCommandInteraction,
	game: InteractiveGame,
	bet: number,
): Promise<void> {
	await defaultController.execute(i, game, bet);
}
