import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { RankedService } from '../../services/RankedService.js';
import {
	RANKED_ALREADY_CLAIMED,
	RANKED_BUSY,
	RANKED_CLAIM_DESC,
	RANKED_CLAIM_OK,
	RANKED_DESCRIPTION,
	RANKED_FIGHT_DESC,
	RANKED_FOOTER,
	RANKED_LOG_MAX_CHARS,
	RANKED_LOG_TRUNCATE_PREFIX,
	RANKED_MATCHUP,
	RANKED_NO_CHARACTER,
	RANKED_NO_FIGHTS,
	RANKED_NO_OPPONENT,
	RANKED_NOT_REGISTERED,
	RANKED_NO_REWARD_ROW,
	RANKED_OUTCOME_DRAW,
	RANKED_OUTCOME_LOSE,
	RANKED_OUTCOME_WIN,
	RANKED_SHIELD_NOTE,
	RANKED_STATS_DESC,
} from '../../text/ranked.js';

export class RankedCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('ranked')
		.setDescription(RANKED_DESCRIPTION)
		.addSubcommand((s) => s.setName('fight').setDescription(RANKED_FIGHT_DESC))
		.addSubcommand((s) => s.setName('claim').setDescription(RANKED_CLAIM_DESC))
		.addSubcommand((s) => s.setName('stats').setDescription(RANKED_STATS_DESC));

	constructor(private readonly ranked = new RankedService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(false);

		if (sub === 'claim') {
			const result = await this.ranked.claim(interaction.user.id);
			let message: string;
			switch (result.status) {
				case 'not-registered':
					message = RANKED_NOT_REGISTERED;
					break;
				case 'already-claimed':
					message = RANKED_ALREADY_CLAIMED;
					break;
				case 'no-fights':
					message = RANKED_NO_FIGHTS;
					break;
				case 'no-reward-row':
					message = RANKED_NO_REWARD_ROW;
					break;
				default:
					message =
						RANKED_CLAIM_OK(result.bracket, result.credux.toLocaleString(), result.valor) +
						(result.chests.length ? ` · ${result.chests.join(' · ')}` : '');
			}
			await interaction.editReply(message);
			return;
		}

		if (sub === 'stats') {
			await interaction.editReply(await this.ranked.stats(interaction.user.id));
			return;
		}

		const result = await this.ranked.fight(interaction.user.id);
		if (result.status === 'not-registered') {
			await interaction.editReply(RANKED_NOT_REGISTERED);
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply(RANKED_NO_CHARACTER);
			return;
		}
		if (result.status === 'busy') {
			await interaction.editReply(RANKED_BUSY);
			return;
		}
		if (result.status === 'no-opponent') {
			await interaction.editReply(RANKED_NO_OPPONENT);
			return;
		}

		const outcome = result.draw ? RANKED_OUTCOME_DRAW : result.won ? RANKED_OUTCOME_WIN : RANKED_OUTCOME_LOSE;
		let logText = result.battle.log.join('\n');
		if (logText.length > RANKED_LOG_MAX_CHARS) {
			logText = RANKED_LOG_TRUNCATE_PREFIX + logText.slice(-RANKED_LOG_MAX_CHARS);
		}
		await interaction.editReply(
			RANKED_MATCHUP(result.opponentName, outcome) +
				'\n' +
				`Rating: **${result.ratingBefore} → ${result.ratingAfter}** (${result.delta >= 0 ? '+' : ''}${result.delta}) · ` +
				`Bracket: ${result.bracketBefore} → **${result.bracketAfter}** · Peak ${result.peak}` +
				(result.shieldUsed ? RANKED_SHIELD_NOTE : '') +
				`\n\`\`\`\n${logText}\n\`\`\`\n` +
				RANKED_FOOTER,
		);
	}
}
