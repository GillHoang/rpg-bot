import { SlashCommandBuilder } from 'discord.js';
import { SupportCommand } from './SupportCommand.js';
import type { DonationService } from '../../services/DonationService.js';
import { SUPPORTER_TEXT } from '../../text/supporter.js';

/** Optional English alias for `/ung-ho`; it shares the exact same service. */
export class DonateCommand extends SupportCommand {
	override readonly data = new SlashCommandBuilder()
		.setName('donate')
		.setDescription(SUPPORTER_TEXT.description)
		.addIntegerOption((option) =>
			option.setName('amount').setDescription(SUPPORTER_TEXT.amountOption).setRequired(true).setMinValue(1),
		);

	constructor(donations?: Pick<DonationService, 'createOrder'>) {
		super(donations);
	}
}
