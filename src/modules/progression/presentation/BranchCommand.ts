import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { BranchService } from '../application/BranchService.js';
import {
	BRANCH_DESCRIPTION,
	BRANCH_KEY_OPTION_DESC,
	BRANCH_LIST_SUBCOMMAND,
	BRANCH_SET_SUBCOMMAND,
} from '../../../shared/ui/text/branch.js';

export class BranchCommand implements ICommand {
	constructor(private readonly branch: Pick<BranchService, 'list' | 'set'>) {}

	readonly data = new SlashCommandBuilder()
		.setName('branch')
		.setDescription(BRANCH_DESCRIPTION)
		.addSubcommand((s) => s.setName('list').setDescription(BRANCH_LIST_SUBCOMMAND))
		.addSubcommand((s) =>
			s
				.setName('set')
				.setDescription(BRANCH_SET_SUBCOMMAND)
				.addStringOption((o) => o.setName('key').setDescription(BRANCH_KEY_OPTION_DESC).setRequired(true)),
		);

	async execute(i: ChatInputCommandInteraction): Promise<void> {
		await i.deferReply({ ephemeral: true });
		const sub = i.options.getSubcommand(true);
		const result =
			sub === 'list' ? await this.branch.list(i.user.id) : await this.branch.set(i.user.id, i.options.getString('key', true));
		await i.editReply(result.ok ? result.value : result.error.message);
	}
}
