import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { ClassChangeService } from '../application/ClassChangeService.js';
import { CLASSES, CLASS_NAMES } from '../../../shared/config/classes.js';
import {
	CLASS_CHANGE_DESC,
	CLASS_DESCRIPTION,
	CLASS_INFO_BASE,
	CLASS_INFO_DESC,
	CLASS_INFO_HEADER,
	CLASS_INFO_OPTION_DESC,
	CLASS_INFO_SCALING,
	CLASS_NEW_CLASS_OPTION_DESC,
} from '../../../shared/ui/text/class.js';
import type { CombatClass } from '../domain/PlayerAccount.js';

export class ClassCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('class')
		.setDescription(CLASS_DESCRIPTION)
		.addSubcommand((s) =>
			s
				.setName('change')
				.setDescription(CLASS_CHANGE_DESC)
				.addStringOption((opt) =>
					opt
						.setName('new_class')
						.setDescription(CLASS_NEW_CLASS_OPTION_DESC)
						.setRequired(true)
						.addChoices(...CLASS_NAMES.map((name) => ({ name, value: name }))),
				),
		)
		.addSubcommand((s) =>
			s
				.setName('info')
				.setDescription(CLASS_INFO_DESC)
				.addStringOption((opt) =>
					opt
						.setName('class')
						.setDescription(CLASS_INFO_OPTION_DESC)
						.setRequired(true)
						.addChoices(...CLASS_NAMES.map((name) => ({ name, value: name }))),
				),
		);

	constructor(private readonly classChange: Pick<ClassChangeService, 'change'>) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		if (interaction.options.getSubcommand(true) === 'info') {
			await interaction.editReply(this.info(interaction.options.getString('class', true) as CombatClass));
			return;
		}
		const newClass = interaction.options.getString('new_class', true) as CombatClass;
		const result = await this.classChange.change(interaction.user.id, newClass);
		await interaction.editReply(result.ok ? result.value : result.error.message);
	}

	/** Xem trước class — flavor + nội tại + chỉ số, không cần tạo nhân vật. */
	private info(combatClass: CombatClass): string {
		const cls = CLASSES[combatClass];
		const fmtCrit = (crit: number) => (Number.isInteger(crit) ? crit.toFixed(0) : crit.toFixed(1));
		return [
			CLASS_INFO_HEADER(cls.emoji, combatClass),
			`_${cls.flavor}_`,
			cls.passiveLine,
			CLASS_INFO_BASE(cls.base.hp, cls.base.atk, cls.base.def, fmtCrit(cls.base.crit)),
			CLASS_INFO_SCALING(cls.scaling.hp, cls.scaling.atk, cls.scaling.def, fmtCrit(cls.scaling.crit)),
		].join('\n\n');
	}
}
