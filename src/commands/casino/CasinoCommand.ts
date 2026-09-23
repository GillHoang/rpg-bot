import { CASINO_DESCRIPTION_TEXT } from '../../text/casino.js';
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CasinoService } from '../../services/CasinoService.js';
import { MAX_BET } from '../../config/casinoPayouts.js';
import type { StatelessCasinoGameKey } from '../../domain/casino/CasinoGameRegistry.js';
import { InteractiveCasinoController } from './interactiveCasino.js';
import {
	CASINO_BET_OPTION_DESC,
	CASINO_CHOICE_OPTION_DESC,
	CASINO_DESCRIPTION,
	CASINO_GAME_LABELS,
	CASINO_INSUFFICIENT_CREDUX,
	CASINO_INVALID_BET,
	CASINO_LOSE,
	CASINO_NOT_REGISTERED,
	CASINO_PUSH,
	CASINO_RESULT_LINE,
	CASINO_WIN,
} from '../../text/casino.js';

export class CasinoCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('casino')
		.setDescription(CASINO_DESCRIPTION)
		.addSubcommand((s) => casinoOptions(s, 'coin_toss', CASINO_GAME_LABELS.coin_toss))
		.addSubcommand((s) => casinoOptions(s, 'dice_roll', CASINO_GAME_LABELS.dice_roll))
		.addSubcommand((s) => casinoOptions(s, 'slot_machine', CASINO_GAME_LABELS.slot_machine))
		.addSubcommand((s) => casinoOptions(s, 'baccarat', CASINO_GAME_LABELS.baccarat))
		.addSubcommand((s) => casinoOptions(s, 'blackjack', CASINO_DESCRIPTION_TEXT.blackjack))
		.addSubcommand((s) => casinoOptions(s, 'crash', CASINO_DESCRIPTION_TEXT.crash));

	constructor(
		private readonly casino: Pick<CasinoService, 'play'> = new CasinoService(),
		private readonly interactive: Pick<InteractiveCasinoController, 'execute'> = new InteractiveCasinoController(),
	) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const game = interaction.options.getSubcommand(true);
		const bet = interaction.options.getInteger('bet', true);
		if (game === 'blackjack' || game === 'crash') {
			await this.interactive.execute(interaction, game, bet);
			return;
		}
		await interaction.deferReply();
		const choice = interaction.options.getString('choice') ?? undefined;

		const result = await this.casino.play(interaction.user.id, game as StatelessCasinoGameKey, bet, choice);

		if (result.status === 'not-registered') {
			await interaction.editReply({ content: CASINO_NOT_REGISTERED });
			return;
		}
		if (result.status === 'invalid-bet') {
			await interaction.editReply({ content: CASINO_INVALID_BET(MAX_BET.toLocaleString()) });
			return;
		}
		if (result.status === 'insufficient-credux') {
			await interaction.editReply({
				content: CASINO_INSUFFICIENT_CREDUX(result.have.toLocaleString()),
			});
			return;
		}

		const { outcome, balanceAfter } = result;
		let verdict = CASINO_LOSE;
		if (outcome.won) verdict = CASINO_WIN;
		else if (outcome.payout > 0) verdict = CASINO_PUSH;
		const delta = (outcome.payout - bet >= 0 ? '+' : '') + (outcome.payout - bet).toLocaleString();
		await interaction.editReply(CASINO_RESULT_LINE(verdict, outcome.result, delta, balanceAfter.toLocaleString()));
	}
}

function casinoOptions(s: import('discord.js').SlashCommandSubcommandBuilder, name: string, description: string) {
	s.setName(name)
		.setDescription(description)
		.addIntegerOption((o) =>
			o
				.setName('bet')
				.setDescription(CASINO_BET_OPTION_DESC(MAX_BET.toLocaleString()))
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(MAX_BET),
		);
	if (name === 'coin_toss' || name === 'dice_roll' || name === 'baccarat')
		s.addStringOption((o) => o.setName('choice').setDescription(CASINO_CHOICE_OPTION_DESC));
	return s;
}
