import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { PvpShopService } from '../../services/PvpShopService.js';
import { PVP_BUY_DESC, PVP_DESCRIPTION, PVP_ITEM_OPTION_DESC, PVP_SHOP_DESC } from '../../text/pvp.js';

export class PvpCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('pvp')
		.setDescription(PVP_DESCRIPTION)
		.addSubcommand((s) => s.setName('shop').setDescription(PVP_SHOP_DESC))
		.addSubcommand((s) =>
			s
				.setName('buy')
				.setDescription(PVP_BUY_DESC)
				.addStringOption((o) => {
					o.setName('item').setDescription(PVP_ITEM_OPTION_DESC).setRequired(true);
					for (const key of [
						'change_class',
						'diamond_chest',
						'frame_gold',
						'frame_eternal',
						'title_champion',
						'banner_crimson',
						'summon_circle_gold',
						'title_legend',
					])
						o.addChoices({ name: key, value: key });
					return o;
				}),
		);

	constructor(private readonly shop: Pick<PvpShopService, 'list' | 'buy'> = new PvpShopService()) {}

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
