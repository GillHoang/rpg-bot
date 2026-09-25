import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import type { MenuRouter } from '../MenuRouter.js';
import { MENU_TEXT } from '../../../shared/ui/text/menu.js';

export class MenuCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('menu').setDescription(MENU_TEXT.description);

	constructor(private readonly router: Pick<MenuRouter, 'open'>) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await this.router.open(interaction);
	}
}
