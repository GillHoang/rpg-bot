import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { LoadoutService } from '../../services/LoadoutService.js';

export class EquipCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('equip')
		.setDescription('Trang bị gear hoặc deity vào preset')
		.addStringOption((o) =>
			o
				.setName('kind')
				.setDescription('Loại')
				.setRequired(true)
				.addChoices(...['weapon', 'armor', 'deity'].map((value) => ({ name: value, value }))),
		)
		.addStringOption((o) => o.setName('id').setDescription('ID từ /inventory hoặc /deities').setRequired(true))
		.addIntegerOption((o) =>
			o.setName('preset').setDescription('Mặc định: preset đang dùng').setMinValue(1).setMaxValue(2),
		);
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		await i.editReply(
			await new LoadoutService().equip(
				i.user.id,
				i.options.getString('kind', true),
				i.options.getString('id', true),
				i.options.getInteger('preset') ?? undefined,
			),
		);
	}
}
export class PresetCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('preset')
		.setDescription('Đổi bộ trang bị')
		.addSubcommand((s) =>
			s
				.setName('switch')
				.setDescription('Chuyển preset đang dùng')
				.addIntegerOption((o) =>
					o.setName('slot').setDescription('Preset').setRequired(true).setMinValue(1).setMaxValue(2),
				),
		);
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		await i.editReply(await new LoadoutService().switch(i.user.id, i.options.getInteger('slot', true)));
	}
}
