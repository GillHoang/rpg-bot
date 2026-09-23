import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { DonationService } from '../../services/DonationService.js';
import { SUPPORTER_TEXT } from '../../text/supporter.js';

/** Creates a voluntary donation order and shows fixed-amount VietQR instructions. */
export class SupportCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('ung-ho')
		.setDescription(SUPPORTER_TEXT.description)
		.addIntegerOption((option) =>
			option.setName('amount').setDescription(SUPPORTER_TEXT.amountOption).setRequired(true).setMinValue(1),
		);

	constructor(private readonly donations: Pick<DonationService, 'createOrder'> = new DonationService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const amount = interaction.options.getInteger('amount', true);
		const result = await this.donations.createOrder(interaction.user.id, amount, interaction.id);

		if (result.status === 'disabled') {
			await interaction.editReply({ content: SUPPORTER_TEXT.disabled });
			return;
		}
		if (result.status === 'invalid-amount') {
			await interaction.editReply({ content: SUPPORTER_TEXT.invalidAmount(result.minimum, result.maximum) });
			return;
		}

		const tier = result.tier?.name;
		await interaction.editReply({
			content: [
				SUPPORTER_TEXT.pending(result.amount, tier, result.paymentCode, result.bankName, result.accountNumber),
				'',
				SUPPORTER_TEXT.qr(result.qrUrl),
				SUPPORTER_TEXT.orderId(result.orderId),
				SUPPORTER_TEXT.orderExpiresAt(result.expiresAt),
			].join('\n'),
		});
	}
}
