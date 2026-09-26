import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { SkillService } from '../application/SkillService.js';
import {
	SKILL_DESCRIPTION,
	SKILL_EQUIP_SUBCOMMAND,
	SKILL_KEY_OPTION_DESC,
	SKILL_LIST_SUBCOMMAND,
	SKILL_ORDER_OPTION_DESC,
	SKILL_ORDER_SUBCOMMAND,
	SKILL_SLOT_OPTION_DESC,
} from '../../../shared/ui/text/skills.js';

export class SkillCommand implements ICommand {
	constructor(private readonly skills: Pick<SkillService, 'list' | 'equip' | 'setOrder'>) {}

	readonly data = new SlashCommandBuilder()
		.setName('skill')
		.setDescription(SKILL_DESCRIPTION)
		.addSubcommand((s) => s.setName('list').setDescription(SKILL_LIST_SUBCOMMAND))
		.addSubcommand((s) =>
			s
				.setName('equip')
				.setDescription(SKILL_EQUIP_SUBCOMMAND)
				.addIntegerOption((o) =>
					o
						.setName('slot')
						.setDescription(SKILL_SLOT_OPTION_DESC)
						.setRequired(true)
						.setMinValue(1)
						.setMaxValue(2),
				)
				.addStringOption((o) => o.setName('key').setDescription(SKILL_KEY_OPTION_DESC).setRequired(false)),
		)
		.addSubcommand((s) =>
			s
				.setName('order')
				.setDescription(SKILL_ORDER_SUBCOMMAND)
				.addStringOption((o) =>
					o
						.setName('order')
						.setDescription(SKILL_ORDER_OPTION_DESC)
						.setRequired(true)
						.addChoices(
							...['aggressive', 'balanced', 'defensive', 'counter'].map((value) => ({
								name: value,
								value,
							})),
						),
				),
		);

	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const sub = i.options.getSubcommand(true);
		if (sub === 'list') {
			const result = await this.skills.list(i.user.id);
			await i.editReply(result.ok ? result.value : result.error.message);
			return;
		}
		if (sub === 'equip') {
			const result = await this.skills.equip(
				i.user.id,
				i.options.getInteger('slot', true),
				i.options.getString('key') ?? null,
			);
			await i.editReply(result.ok ? result.value : result.error.message);
			return;
		}
		const result = await this.skills.setOrder(i.user.id, i.options.getString('order', true));
		await i.editReply(result.ok ? result.value : result.error.message);
	}
}
