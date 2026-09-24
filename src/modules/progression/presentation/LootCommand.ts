import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { LootService } from '../../economy/application/LootService.js';
import { CHESTS, type ChestKey } from '../../../shared/config/chestLoot.js';
import {
	OPEN_CHEST_OPTION_DESC,
	OPEN_COUNT_OPTION_DESC,
	OPEN_DESCRIPTION,
	RUNES_DESCRIPTION,
	RUNES_OPEN_BAG_OPTION_DESC,
	RUNES_OPEN_DESC,
	RUNES_SHOP_BAG_OPTION_DESC,
	RUNES_SHOP_DESC,
} from '../../../shared/ui/text/loot.js';

export class OpenCommand implements ICommand {
	constructor(private readonly loot: Pick<LootService, 'open'>) {}

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
		const result = await this.loot.open(
			i.user.id,
			i.options.getString('chest', true) as ChestKey,
			i.options.getInteger('count') ?? 1,
		);
		const text = result.ok ? result.value : result.error.message;
		await i.editReply({ embeds: [new EmbedBuilder().setDescription(text.slice(0, 4000))] });
	}
}
export class RunesCommand implements ICommand {
	constructor(private readonly loot: Pick<LootService, 'openRuneBag' | 'shop'>) {}

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
			const opened = await this.loot.openRuneBag(i.user.id, i.options.getString('bag', true));
			await i.editReply(opened.ok ? opened.value : opened.error.message);
			return;
		}
		const listed = await this.loot.shop(i.user.id, i.options.getString('bag') ?? undefined);
		await i.editReply(listed.ok ? listed.value : listed.error.message);
	}
}
