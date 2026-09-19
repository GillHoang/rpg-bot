import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { LoadoutService } from '../../services/LoadoutService.js';
import {
	EQUIP_DESCRIPTION,
	EQUIP_ID_OPTION_DESC,
	EQUIP_KIND_OPTION_DESC,
	EQUIP_PRESET_OPTION_DESC,
	PRESET_DESCRIPTION,
	PRESET_SLOT_OPTION_DESC,
	PRESET_SWITCH_DESC,
} from '../../text/loadout.js';

export class EquipCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('equip')
		.setDescription(EQUIP_DESCRIPTION)
		.addStringOption((o) =>
			o
				.setName('kind')
				.setDescription(EQUIP_KIND_OPTION_DESC)
				.setRequired(true)
				.addChoices(...['weapon', 'armor', 'deity'].map((value) => ({ name: value, value }))),
		)
		.addStringOption((o) => o.setName('id').setDescription(EQUIP_ID_OPTION_DESC).setRequired(true))
		.addIntegerOption((o) =>
			o.setName('preset').setDescription(EQUIP_PRESET_OPTION_DESC).setMinValue(1).setMaxValue(2),
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
		.setDescription(PRESET_DESCRIPTION)
		.addSubcommand((s) =>
			s
				.setName('switch')
				.setDescription(PRESET_SWITCH_DESC)
				.addIntegerOption((o) =>
					o
						.setName('slot')
						.setDescription(PRESET_SLOT_OPTION_DESC)
						.setRequired(true)
						.setMinValue(1)
						.setMaxValue(2),
				),
		);
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		await i.editReply(await new LoadoutService().switch(i.user.id, i.options.getInteger('slot', true)));
	}
}
