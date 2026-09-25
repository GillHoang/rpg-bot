import { SlashCommandBuilder, type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import type { AppError, Result } from '../../../shared/kernel/Result.js';
import type { WeaponService } from '../application/WeaponService.js';
import type { InventoryService } from '../application/InventoryService.js';
import { DEITY_CHOICE_LABEL, GEAR_CHOICE_LABEL } from '../../../shared/ui/text/autocomplete.js';
import {
	WEAPON_CRATE_SUB,
	WEAPON_DEITY_OPTION,
	WEAPON_DESCRIPTION,
	WEAPON_DISMANTLE_SUB,
	WEAPON_EQUIP_SUB,
	WEAPON_ID_OPTION,
	WEAPON_SELL_SUB,
	WEAPON_UNEQUIP_SUB,
	WEAPON_UPGRADE_SUB,
	WEAPON_VIEW_SUB,
} from '../../../shared/ui/text/weapon.js';

/** OwO-style weapon lifecycle: weapons are wielded by deities, never presets. */
export class WeaponCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('weapon')
		.setDescription(WEAPON_DESCRIPTION)
		.addSubcommand((s) =>
			s
				.setName('view')
				.setDescription(WEAPON_VIEW_SUB)
				.addStringOption((o) =>
					o.setName('weapon_id').setDescription(WEAPON_ID_OPTION).setRequired(true).setAutocomplete(true),
				),
		)
		.addSubcommand((s) => s.setName('crate').setDescription(WEAPON_CRATE_SUB))
		.addSubcommand((s) =>
			s
				.setName('equip')
				.setDescription(WEAPON_EQUIP_SUB)
				.addStringOption((o) =>
					o.setName('weapon_id').setDescription(WEAPON_ID_OPTION).setRequired(true).setAutocomplete(true),
				)
				.addStringOption((o) =>
					o.setName('deity_id').setDescription(WEAPON_DEITY_OPTION).setRequired(true).setAutocomplete(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('unequip')
				.setDescription(WEAPON_UNEQUIP_SUB)
				.addStringOption((o) =>
					o.setName('weapon_id').setDescription(WEAPON_ID_OPTION).setRequired(true).setAutocomplete(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('upgrade')
				.setDescription(WEAPON_UPGRADE_SUB)
				.addStringOption((o) =>
					o.setName('weapon_id').setDescription(WEAPON_ID_OPTION).setRequired(true).setAutocomplete(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('dismantle')
				.setDescription(WEAPON_DISMANTLE_SUB)
				.addStringOption((o) =>
					o.setName('weapon_id').setDescription(WEAPON_ID_OPTION).setRequired(true).setAutocomplete(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('sell')
				.setDescription(WEAPON_SELL_SUB)
				.addStringOption((o) =>
					o.setName('weapon_id').setDescription(WEAPON_ID_OPTION).setRequired(true).setAutocomplete(true),
				),
		);

	constructor(
		private readonly weapons: Pick<
			WeaponService,
			'view' | 'openCrate' | 'attach' | 'detach' | 'upgrade' | 'dismantle' | 'sell'
		>,
		private readonly inventory: Pick<InventoryService, 'searchWeapons' | 'searchDeities'>,
	) {}

	async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
		const focused = interaction.options.getFocused(true).name;
		const query = String(interaction.options.getFocused());
		if (focused === 'weapon_id') {
			const rows = await this.inventory.searchWeapons(interaction.user.id, query);
			await interaction.respond(rows.map((g) => ({ name: GEAR_CHOICE_LABEL(g), value: g.id })));
			return;
		}
		if (focused === 'deity_id') {
			const rows = await this.inventory.searchDeities(interaction.user.id, query);
			await interaction.respond(rows.map((d) => ({ name: DEITY_CHOICE_LABEL(d), value: String(d.id) })));
		}
	}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const result = await this.runSubcommand(interaction);
		await interaction.editReply(result.ok ? result.value : result.error.message);
	}

	private weaponId(interaction: ChatInputCommandInteraction): string {
		return interaction.options.getString('weapon_id', true);
	}

	private runSubcommand(interaction: ChatInputCommandInteraction): Promise<Result<string, AppError>> {
		const userId = interaction.user.id;
		switch (interaction.options.getSubcommand()) {
			case 'crate':
				return this.weapons.openCrate(userId);
			case 'equip':
				return this.weapons.attach(
					userId,
					this.weaponId(interaction),
					Number(interaction.options.getString('deity_id', true)),
				);
			case 'unequip':
				return this.weapons.detach(userId, this.weaponId(interaction));
			case 'upgrade':
				return this.weapons.upgrade(userId, this.weaponId(interaction));
			case 'dismantle':
				return this.weapons.dismantle(userId, this.weaponId(interaction));
			case 'sell':
				return this.weapons.sell(userId, this.weaponId(interaction));
			default:
				return this.weapons.view(userId, this.weaponId(interaction));
		}
	}
}
