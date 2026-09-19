import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { LootService } from '../../services/LootService.js';
import { CHESTS, type ChestKey } from '../../config/chestLoot.js';

export class OpenCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('open')
		.setDescription('Mở rương nhận tiền, rune và gear')
		.addStringOption((o) =>
			o
				.setName('chest')
				.setDescription('Loại rương')
				.setRequired(true)
				.addChoices(...Object.entries(CHESTS).map(([value, c]) => ({ name: c.label, value }))),
		)
		.addIntegerOption((o) => o.setName('count').setDescription('Số lượng (1–10)').setMinValue(1).setMaxValue(10));
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
		.setDescription('Shop và túi rune')
		.addSubcommand((s) =>
			s
				.setName('shop')
				.setDescription('Xem giá hoặc mua và mở ngay túi rune (essence + Credux)')
				.addStringOption((o) =>
					o
						.setName('bag')
						.setDescription('Bỏ trống để xem giá')
						.addChoices(...['lb', 'gb', 'db'].map((value) => ({ name: value, value }))),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('open')
				.setDescription('Mở 1 túi rune đang có trong bag (từ /open hoặc shop)')
				.addStringOption((o) =>
					o
						.setName('bag')
						.setDescription('lb = lesser · gb = greater · db = divine')
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
