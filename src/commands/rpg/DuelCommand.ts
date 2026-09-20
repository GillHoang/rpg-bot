import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { DuelService, DUEL_STAKE_MIN, type DuelAcceptResult } from '../../services/DuelService.js';
import { sendBattleLog } from '../../render/BattleLogPager.js';
import {
	DUEL_ACCEPT_LABEL,
	DUEL_BUSY,
	DUEL_CASUAL_LINE,
	DUEL_CHALLENGE,
	DUEL_DECLINE_LABEL,
	DUEL_DECLINED,
	DUEL_DESCRIPTION,
	DUEL_DRAW,
	DUEL_EXPIRED,
	DUEL_EXPIRED_ACCEPT,
	DUEL_INSUFFICIENT_FUNDS,
	DUEL_INSUFFICIENT_FUNDS_ACCEPT,
	DUEL_NO_CHARACTER,
	DUEL_NOT_FOUND,
	DUEL_NOT_REGISTERED,
	DUEL_ONLY_OPPONENT_BUTTON,
	DUEL_OPPONENT_OPTION_DESC,
	DUEL_POT,
	DUEL_SELF,
	DUEL_STAKE_OPTION_DESC,
	DUEL_STAKE_TOO_LOW,
	DUEL_WIN,
	DUEL_WAGER_LINE,
	DUEL_WHO,
} from '../../text/duel.js';

const STAKE_OPTION = 'stake';

export class DuelCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('duel')
		.setDescription(DUEL_DESCRIPTION)
		.addUserOption((o) => o.setName('opponent').setDescription(DUEL_OPPONENT_OPTION_DESC).setRequired(true))
		.addIntegerOption((o) =>
			o
				.setName(STAKE_OPTION)
				.setDescription(DUEL_STAKE_OPTION_DESC(DUEL_STAKE_MIN.toLocaleString()))
				.setMinValue(0),
		);

	constructor(private readonly duels = new DuelService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const opponent = interaction.options.getUser('opponent', true);
		const stake = interaction.options.getInteger(STAKE_OPTION) ?? 0;

		const created = await this.duels.create(interaction.user.id, opponent.id, stake);
		switch (created.status) {
			case 'self':
				await interaction.reply({ content: DUEL_SELF, ephemeral: true });
				return;
			case 'invalid-stake':
				await interaction.reply({
					content: DUEL_STAKE_TOO_LOW(DUEL_STAKE_MIN.toLocaleString()),
					ephemeral: true,
				});
				return;
			case 'not-registered':
				await interaction.reply({ content: DUEL_NOT_REGISTERED(DUEL_WHO[created.who]), ephemeral: true });
				return;
			case 'no-character':
				await interaction.reply({ content: DUEL_NO_CHARACTER(DUEL_WHO[created.who]), ephemeral: true });
				return;
			case 'busy':
				await interaction.reply({ content: DUEL_BUSY(DUEL_WHO[created.who]), ephemeral: true });
				return;
			case 'insufficient-funds':
				await interaction.reply({ content: DUEL_INSUFFICIENT_FUNDS, ephemeral: true });
				return;
		}

		const wagerLine = created.stake > 0 ? DUEL_WAGER_LINE(created.stake.toLocaleString()) : DUEL_CASUAL_LINE;
		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`duel:accept:${created.duelId}`)
				.setLabel(DUEL_ACCEPT_LABEL)
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`duel:decline:${created.duelId}`)
				.setLabel(DUEL_DECLINE_LABEL)
				.setStyle(ButtonStyle.Danger),
		);
		await interaction.reply({
			content: DUEL_CHALLENGE(interaction.user.username, opponent.username, wagerLine),
			components: [buttons],
		});

		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 62_000,
		});
		collector.on('collect', async (button) => {
			if (button.customId === `duel:decline:${created.duelId}`) {
				// Only the two participants may decline — anyone else clicking must
				// not stop the collector or kill the pending invite.
				if (button.user.id !== interaction.user.id && button.user.id !== opponent.id) {
					await button.reply({ content: DUEL_ONLY_OPPONENT_BUTTON, ephemeral: true });
					return;
				}
				await button.deferUpdate();
				const declined = await this.duels.decline(created.duelId, button.user.id);
				collector.stop(declined ? 'declined' : 'stale');
				return;
			}
			if (button.customId !== `duel:accept:${created.duelId}`) return;
			if (button.user.id !== opponent.id) {
				await button.reply({ content: DUEL_ONLY_OPPONENT_BUTTON, ephemeral: true });
				return;
			}
			await button.deferUpdate();
			collector.stop('accepted');
		});
		collector.on('end', async (_collected, reason) => {
			if (reason === 'accepted') {
				const result = await this.duels.accept(created.duelId, opponent.id);
				await interaction.editReply({ components: [] });
				if (result.status !== 'ok') {
					await interaction.followUp(duelFailureLine(result));
					return;
				}
				let outcomeLine = DUEL_DRAW;
				if (!result.draw) {
					outcomeLine = DUEL_WIN(result.winnerName ?? '');
					if (result.stake > 0) outcomeLine += DUEL_POT((result.stake * 2).toLocaleString());
				}
				await sendBattleLog(
					interaction,
					{
						battle: result.battle,
						playerName: result.challengerName,
						enemyName: result.opponentName,
						headerLines: [outcomeLine],
					},
					'followUp',
				);
				return;
			}
			if (reason === 'declined') {
				await interaction.editReply({ content: DUEL_DECLINED, components: [] });
				return;
			}
			if (reason === 'stale') return;
			// Expired — the sweep drops the pending row; just clean the buttons.
			await interaction
				.editReply({ content: DUEL_EXPIRED(interaction.user.username), components: [] })
				.catch(() => undefined);
		});
	}
}

function duelFailureLine(
	result: Extract<DuelAcceptResult, { status: 'not-found' | 'not-opponent' | 'expired' | 'insufficient-funds' }>,
): string {
	switch (result.status) {
		case 'not-found':
			return DUEL_NOT_FOUND;
		case 'not-opponent':
			return DUEL_ONLY_OPPONENT_BUTTON;
		case 'expired':
			return DUEL_EXPIRED_ACCEPT;
		default:
			return DUEL_INSUFFICIENT_FUNDS_ACCEPT;
	}
}
