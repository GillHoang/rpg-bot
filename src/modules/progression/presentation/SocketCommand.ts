import { SlashCommandBuilder, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { SocketService } from '../application/SocketService.js';
import { InventoryService } from '../application/InventoryService.js';
import { GEAR_CHOICE_LABEL, RUNE_CHOICE_LABEL } from '../../../shared/ui/text/autocomplete.js';
import {
	SOCKET_LANE_LABELS,
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
} from '../../../shared/ui/text/socket.js';

export class SocketCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('socket')
		.setDescription(SOCKET_DESCRIPTION)
		.addSubcommand((sub) =>
			sub
				.setName('equip')
				.setDescription(SOCKET_EQUIP_SUB_DESC)
				.addStringOption((opt) =>
					opt
						.setName('rune_uid')
						.setDescription(SOCKET_RUNE_OPTION_DESC)
						.setRequired(true)
						.setAutocomplete(true),
				)
				.addStringOption((opt) =>
					opt
						.setName('gear_id')
						.setDescription(SOCKET_GEAR_OPTION_DESC)
						.setRequired(true)
						.setAutocomplete(true),
				)
				.addIntegerOption((opt) =>
					opt.setName('slot_num').setDescription(SOCKET_SLOT_OPTION_DESC).setMinValue(1).setRequired(true),
				)
				.addStringOption((o) =>
					o
						.setName('lane')
						.setDescription(SOCKET_LANE_OPTION_DESC)
						.addChoices(
							{ name: SOCKET_LANE_LABELS.native, value: 'native' },
							{ name: SOCKET_LANE_LABELS.opposite, value: 'opposite' },
						),
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
					o
						.setName('gear_id')
						.setDescription(SOCKET_UNLOCK_GEAR_OPTION_DESC)
						.setRequired(true)
						.setAutocomplete(true),
				),
		);

	constructor(
		private readonly socket: Pick<SocketService, 'unlock' | 'equip' | 'unequip'>,
		private readonly inventory: Pick<InventoryService, 'searchWeapons' | 'searchArmors' | 'searchRunes'>,
	) {}

	async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
		const focused = interaction.options.getFocused(true).name;
		const query = String(interaction.options.getFocused());
		const repo = this.inventory;
		if (focused === 'rune_uid') {
			const rows = await repo.searchRunes(interaction.user.id, query);
			await interaction.respond(rows.map((r) => ({ name: RUNE_CHOICE_LABEL(r), value: r.uid })));
			return;
		}
		if (focused === 'gear_id') {
			const [weapons, armors] = await Promise.all([
				repo.searchWeapons(interaction.user.id, query),
				repo.searchArmors(interaction.user.id, query),
			]);
			// Xen kẽ vũ khí/giáp trong 25 slot — cả hai loại luôn xuất hiện.
			const rows: typeof weapons = [];
			for (let i = 0; rows.length < 25 && (i < weapons.length || i < armors.length); i++) {
				if (i < weapons.length) rows.push(weapons[i]!);
				if (i < armors.length && rows.length < 25) rows.push(armors[i]!);
			}
			await interaction.respond(rows.map((g) => ({ name: GEAR_CHOICE_LABEL(g), value: g.id })));
		}
	}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(true);
		if (sub === 'unlock') {
			const unlocked = await this.socket.unlock(
				interaction.user.id,
				interaction.options.getString('gear_id', true),
			);
			await interaction.editReply(unlocked.ok ? unlocked.value : unlocked.error.message);
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
