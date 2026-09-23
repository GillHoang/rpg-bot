import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { DonationService } from '../../services/DonationService.js';
import { SUPPORTER_TEXT } from '../../text/supporter.js';

/** Private order lookup; the service verifies ownership before returning data. */
export class SupportStatusCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('ung-ho-trang-thai')
		.setDescription(SUPPORTER_TEXT.statusDescription)
		.addStringOption((option) =>
			option.setName('order_id').setDescription(SUPPORTER_TEXT.orderIdOption).setRequired(true),
		);

	constructor(private readonly donations: Pick<DonationService, 'getOrderStatus'> = new DonationService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const orderId = interaction.options.getString('order_id', true);
		const result = await this.donations.getOrderStatus(interaction.user.id, orderId);
		await interaction.editReply({
			content:
				result.status === 'not-found'
					? SUPPORTER_TEXT.orderNotFound
					: SUPPORTER_TEXT.orderStatus(result.orderId, result.amount, result.state, result.paymentCode),
		});
	}
}
