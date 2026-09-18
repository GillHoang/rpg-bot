import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { SocketService } from '../../services/SocketService.js';

export class SocketCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('socket')
		.setDescription('Gắn/tháo rune vào trang bị')
		.addSubcommand((sub) =>
			sub
				.setName('equip')
				.setDescription('Gắn rune vào 1 slot native của trang bị')
				.addStringOption((opt) => opt.setName('rune_uid').setDescription('UID của rune').setRequired(true))
				.addStringOption((opt) => opt.setName('gear_id').setDescription('ID vũ khí/giáp').setRequired(true))
				.addIntegerOption((opt) =>
					opt
						.setName('slot_num')
						.setDescription('Số thứ tự slot (1, 2, ...)')
						.setMinValue(1)
						.setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('unequip')
				.setDescription('Tháo rune khỏi trang bị')
				.addStringOption((opt) => opt.setName('rune_uid').setDescription('UID của rune').setRequired(true)),
		);

	constructor(private readonly socket = new SocketService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(true);
		const runeUid = interaction.options.getString('rune_uid', true);

		if (sub === 'equip') {
			const gearId = interaction.options.getString('gear_id', true);
			const slotNum = interaction.options.getInteger('slot_num', true);
			const result = await this.socket.equip(interaction.user.id, runeUid, gearId, slotNum);

			switch (result.status) {
				case 'rune-not-owned':
					await interaction.editReply({ content: 'Bạn không sở hữu rune này.' });
					return;
				case 'gear-not-owned':
					await interaction.editReply({ content: 'Bạn không sở hữu trang bị này.' });
					return;
				case 'invalid-slot':
					await interaction.editReply({ content: 'Trang bị không có slot số đó (hoặc chưa mở khoá).' });
					return;
				case 'slot-occupied':
					await interaction.editReply({ content: 'Slot này đã có rune khác. Hãy tháo trước.' });
					return;
				case 'lane-mismatch':
					await interaction.editReply({
						content: `Sai lane: slot yêu cầu **${result.expected}**, rune này là **${result.actual}**.`,
					});
					return;
				case 'ok':
					await interaction.editReply('✅ Đã gắn rune vào trang bị.');
					return;
			}
		} else {
			const result = await this.socket.unequip(interaction.user.id, runeUid);
			switch (result.status) {
				case 'rune-not-owned':
					await interaction.editReply({ content: 'Bạn không sở hữu rune này.' });
					return;
				case 'not-socketed':
					await interaction.editReply({ content: 'Rune này chưa được gắn vào đâu cả.' });
					return;
				case 'ok':
					await interaction.editReply('✅ Đã tháo rune khỏi trang bị.');
					return;
			}
		}
	}
}
