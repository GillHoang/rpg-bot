import { SlashCommandBuilder, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { LoadoutService } from '../application/LoadoutService.js';
import { InventoryService } from '../application/InventoryService.js';
import { DEITY_CHOICE_LABEL, GEAR_CHOICE_LABEL } from '../../../shared/ui/text/autocomplete.js';
import {
	EQUIP_DESCRIPTION,
	EQUIP_ID_OPTION_DESC,
	EQUIP_KIND_OPTION_DESC,
	EQUIP_PRESET_OPTION_DESC,
	PRESET_DESCRIPTION,
	PRESET_SLOT_OPTION_DESC,
	PRESET_SWITCH_DESC,
} from '../../../shared/ui/text/loadout.js';

export class EquipCommand implements ICommand {
	constructor(
		private readonly loadout: Pick<LoadoutService, 'equip'>,
		private readonly inventory: Pick<InventoryService, 'searchDeities' | 'searchArmors' | 'searchWeapons'>,
	) {}

	readonly data = new SlashCommandBuilder()
		.setName('equip')
		.setDescription(EQUIP_DESCRIPTION)
		.addStringOption((o) =>
			o
				.setName('kind')
				.setDescription(EQUIP_KIND_OPTION_DESC)
				.setRequired(true)
				.addChoices(...['armor', 'deity', 'deity2', 'deity3'].map((value) => ({ name: value, value }))),
		)
		.addStringOption((o) =>
			o.setName('id').setDescription(EQUIP_ID_OPTION_DESC).setRequired(true).setAutocomplete(true),
		)
		.addIntegerOption((o) =>
			o.setName('preset').setDescription(EQUIP_PRESET_OPTION_DESC).setMinValue(1).setMaxValue(2),
		);
	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const result = await this.loadout.equip(
			i.user.id,
			i.options.getString('kind', true),
			i.options.getString('id', true),
			i.options.getInteger('preset') ?? undefined,
		);
		await i.editReply(result.ok ? result.value : result.error.message);
	}

	async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
		if (interaction.options.getFocused(true).name !== 'id') return;
		const query = String(interaction.options.getFocused());
		const kind = interaction.options.getString('kind');
		const repo = this.inventory;
		if (kind === 'deity' || kind === 'deity2' || kind === 'deity3') {
			const rows = await repo.searchDeities(interaction.user.id, query);
			await interaction.respond(rows.map((d) => ({ name: DEITY_CHOICE_LABEL(d), value: String(d.id) })));
			return;
		}
		// Weapons are wielded by deities via /weapon equip, never through /equip.
		const rows =
			kind === 'weapon'
				? await repo.searchWeapons(interaction.user.id, query)
				: await repo.searchArmors(interaction.user.id, query);
		await interaction.respond(rows.map((g) => ({ name: GEAR_CHOICE_LABEL(g), value: g.id })));
	}
}
export class PresetCommand implements ICommand {
	constructor(private readonly loadout: Pick<LoadoutService, 'switch'>) {}

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
		const result = await this.loadout.switch(i.user.id, i.options.getInteger('slot', true));
		await i.editReply(result.ok ? result.value : result.error.message);
	}
}
