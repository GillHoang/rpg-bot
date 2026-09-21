import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { menuRouter } from '../../menu/menuRuntime.js';
import type { MenuRouter } from '../../menu/MenuRouter.js';
import { MENU_TEXT } from '../../text/menu.js';

export class MenuCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('menu').setDescription(MENU_TEXT.description);

	constructor(private readonly router: Pick<MenuRouter, 'open'> = menuRouter) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await this.router.open(interaction);
	}
}
