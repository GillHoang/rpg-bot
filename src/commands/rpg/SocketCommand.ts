import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { SocketService } from '../../services/SocketService.js';
import {
	SOCKET_DESCRIPTION,
	SOCKET_EQUIP_SUB_DESC,
	SOCKET_UNEQUIP_SUB_DESC,
	SOCKET_RUNE_OPTION_DESC,
	SOCKET_GEAR_OPTION_DESC,
	SOCKET_SLOT_OPTION_DESC,
	SOCKET_LANE_OPTION_DESC,
	SOCKET_RUNE_NOT_OWNED,
	SOCKET_GEAR_NOT_OWNED,
	SOCKET_INVALID_SLOT,
	SOCKET_SLOT_OCCUPIED,
	SOCKET_LANE_MISMATCH,
	SOCKET_EQUIP_SUCCESS,
	SOCKET_NOT_SOCKETED,
	SOCKET_UNEQUIP_SUCCESS,
	SOCKET_UNLOCK_SUB_DESC,
	SOCKET_UNLOCK_GEAR_OPTION_DESC,
} from '../../text/socket.js';

export class SocketCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('socket')
		.setDescription(SOCKET_DESCRIPTION)
		.addSubcommand((sub) =>
			sub
				.setName('equip')
				.setDescription(SOCKET_EQUIP_SUB_DESC)
				.addStringOption((opt) =>
					opt.setName('rune_uid').setDescription(SOCKET_RUNE_OPTION_DESC).setRequired(true),
				)
				.addStringOption((opt) =>
					opt.setName('gear_id').setDescription(SOCKET_GEAR_OPTION_DESC).setRequired(true),
				)
				.addIntegerOption((opt) =>
					opt.setName('slot_num').setDescription(SOCKET_SLOT_OPTION_DESC).setMinValue(1).setRequired(true),
				)
				.addStringOption((o) =>
					o
						.setName('lane')
						.setDescription(SOCKET_LANE_OPTION_DESC)
						.addChoices({ name: 'native', value: 'native' }, { name: 'opposite', value: 'opposite' }),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('unequip')
				.setDescription(SOCKET_UNEQUIP_SUB_DESC)
				.addStringOption((opt) =>
					opt.setName('rune_uid').setDescription(SOCKET_RUNE_OPTION_DESC).setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('unlock')
				.setDescription(SOCKET_UNLOCK_SUB_DESC)
				.addStringOption((o) =>
					o.setName('gear_id').setDescription(SOCKET_UNLOCK_GEAR_OPTION_DESC).setRequired(true),
				),
		);

	constructor(private readonly socket = new SocketService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(true);
		if (sub === 'unlock') {
			await interaction.editReply(
				await this.socket.unlock(interaction.user.id, interaction.options.getString('gear_id', true)),
			);
			return;
		}
		const runeUid = interaction.options.getString('rune_uid', true);

		if (sub === 'equip') {
			const gearId = interaction.options.getString('gear_id', true);
			const slotNum = interaction.options.getInteger('slot_num', true);
			const result = await this.socket.equip(
				interaction.user.id,
				runeUid,
				gearId,
				slotNum,
				(interaction.options.getString('lane') ?? 'native') as 'native' | 'opposite',
			);

			switch (result.status) {
				case 'rune-not-owned':
					await interaction.editReply({ content: SOCKET_RUNE_NOT_OWNED });
					return;
				case 'gear-not-owned':
					await interaction.editReply({ content: SOCKET_GEAR_NOT_OWNED });
					return;
				case 'invalid-slot':
					await interaction.editReply({ content: SOCKET_INVALID_SLOT });
					return;
				case 'slot-occupied':
					await interaction.editReply({ content: SOCKET_SLOT_OCCUPIED });
					return;
				case 'lane-mismatch':
					await interaction.editReply({ content: SOCKET_LANE_MISMATCH(result.expected, result.actual) });
					return;
				case 'ok':
					await interaction.editReply(SOCKET_EQUIP_SUCCESS);
					return;
			}
		} else {
			const result = await this.socket.unequip(interaction.user.id, runeUid);
			switch (result.status) {
				case 'rune-not-owned':
					await interaction.editReply({ content: SOCKET_RUNE_NOT_OWNED });
					return;
				case 'not-socketed':
					await interaction.editReply({ content: SOCKET_NOT_SOCKETED });
					return;
				case 'ok':
					await interaction.editReply(SOCKET_UNEQUIP_SUCCESS);
					return;
			}
		}
	}
}
