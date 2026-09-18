import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { SummonService } from '../../services/SummonService.js';
import { MAX_PULLS } from '../../config/gachaRates.js';
import {
	SUMMON_COUNT_OPTION_DESC,
	SUMMON_DESCRIPTION,
	SUMMON_DUPE_SUFFIX,
	SUMMON_INSUFFICIENT_SHARDS,
	SUMMON_INVALID_COUNT,
	SUMMON_NEW_SUFFIX,
	SUMMON_NO_CHARACTER,
	SUMMON_NO_DEITIES_SEEDED,
	SUMMON_SUCCESS,
	TIER_ALIAS,
} from '../../text/summon.js';

export class SummonCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('summon')
		.setDescription(SUMMON_DESCRIPTION)
		.addIntegerOption((opt) =>
			opt
				.setName('count')
				.setDescription(SUMMON_COUNT_OPTION_DESC(MAX_PULLS))
				.setMinValue(1)
				.setMaxValue(MAX_PULLS)
				.setRequired(true),
		);

	constructor(private readonly summon = new SummonService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Multi-pull transactions can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const count = interaction.options.getInteger('count', true);
		const result = await this.summon.run(interaction.user.id, count);

		switch (result.status) {
			case 'invalid-count':
				await interaction.editReply({ content: SUMMON_INVALID_COUNT(MAX_PULLS) });
				return;
			case 'no-character':
				await interaction.editReply({ content: SUMMON_NO_CHARACTER });
				return;
			case 'insufficient-shards':
				await interaction.editReply({
					content: SUMMON_INSUFFICIENT_SHARDS(result.needed.toLocaleString(), result.have.toLocaleString()),
				});
				return;
			case 'no-deities-seeded':
				await interaction.editReply({ content: SUMMON_NO_DEITIES_SEEDED(result.tier) });
				return;
			case 'ok': {
				const lines = result.pulls.map((p) => {
					const alias = TIER_ALIAS[p.tier];
					const suffix = p.isDupe ? SUMMON_DUPE_SUFFIX(p.essenceGained, p.tier) : SUMMON_NEW_SUFFIX;
					return `**[${p.tier} · ${alias}]** ${p.name} (${p.mythology})${suffix}`;
				});
				await interaction.editReply(
					SUMMON_SUCCESS(
						result.pulls.length,
						result.shardsSpent.toLocaleString(),
						lines.join('\n'),
						result.finalPity,
					),
				);
			}
		}
	}
}
