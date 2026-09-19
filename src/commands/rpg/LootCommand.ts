import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { LootService } from '../../services/LootService.js';
import { CHESTS, type ChestKey } from '../../config/chestLoot.js';
import {
	OPEN_CHEST_OPTION_DESC,
	OPEN_COUNT_OPTION_DESC,
	OPEN_DESCRIPTION,
	RUNES_DESCRIPTION,
	RUNES_OPEN_BAG_OPTION_DESC,
	RUNES_OPEN_DESC,
	RUNES_SHOP_BAG_OPTION_DESC,
	RUNES_SHOP_DESC,
} from '../../text/loot.js';

export class OpenCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('open')
		.setDescription(OPEN_DESCRIPTION)
		.addStringOption((o) =>
			o
				.setName('chest')
				.setDescription(OPEN_CHEST_OPTION_DESC)
				.setRequired(true)
				.addChoices(...Object.entries(CHESTS).map(([value, c]) => ({ name: c.label, value }))),
		)
		.addIntegerOption((o) =>
			o.setName('count').setDescription(OPEN_COUNT_OPTION_DESC).setMinValue(1).setMaxValue(10),
		);
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const result = await new LootService().open(
			i.user.id,
			i.options.getString('chest', true) as ChestKey,
			i.options.getInteger('count') ?? 1,
		);
		await i.editReply({ embeds: [new EmbedBuilder().setDescription(result.slice(0, 4000))] });
	}
}
export class RunesCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('runes')
		.setDescription(RUNES_DESCRIPTION)
		.addSubcommand((s) =>
			s
				.setName('shop')
				.setDescription(RUNES_SHOP_DESC)
				.addStringOption((o) =>
					o
						.setName('bag')
						.setDescription(RUNES_SHOP_BAG_OPTION_DESC)
						.addChoices(...['lb', 'gb', 'db'].map((value) => ({ name: value, value }))),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('open')
				.setDescription(RUNES_OPEN_DESC)
				.addStringOption((o) =>
					o
						.setName('bag')
						.setDescription(RUNES_OPEN_BAG_OPTION_DESC)
						.setRequired(true)
						.addChoices(...['lb', 'gb', 'db'].map((value) => ({ name: value, value }))),
				),
		);
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		if (i.options.getSubcommand(false) === 'open') {
			await i.editReply(await new LootService().openRuneBag(i.user.id, i.options.getString('bag', true)));
			return;
		}
		await i.editReply(await new LootService().shop(i.user.id, i.options.getString('bag') ?? undefined));
	}
}
