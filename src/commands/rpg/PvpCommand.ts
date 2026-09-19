import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { PvpShopService } from '../../services/PvpShopService.js';

export class PvpCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('pvp')
		.setDescription('Cửa hàng Valor Medals')
		.addSubcommand((s) => s.setName('shop').setDescription('Xem danh sách item và giá Valor'))
		.addSubcommand((s) =>
			s
				.setName('buy')
				.setDescription('Mua item bằng Valor Medals')
				.addStringOption((o) => {
					o.setName('item').setDescription('Mã item').setRequired(true);
					for (const key of [
						'change_class',
						'diamond_chest',
						'frame_gold',
						'frame_eternal',
						'title_champion',
					])
						o.addChoices({ name: key, value: key });
					return o;
				}),
		);

	constructor(private readonly shop = new PvpShopService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		if (interaction.options.getSubcommand(false) === 'shop') {
			await interaction.editReply(this.shop.list());
			return;
		}
		const item = interaction.options.getString('item', true);
		await interaction.editReply(await this.shop.buy(interaction.user.id, item));
	}
}
