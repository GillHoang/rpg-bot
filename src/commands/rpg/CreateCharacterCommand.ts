import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CharacterCreationService } from '../../services/CharacterCreationService.js';
import { CLASSES, CLASS_NAMES } from '../../config/classes.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../../config/starter.js';
import type { CombatClass } from '../../domain/entities/PlayerAccount.js';

/**
 * Simplified UX vs the original create.js: that version shows a button
 * flow (class select -> preview card -> confirm). Here the class is a
 * slash-command option instead — same guarded transaction underneath,
 * no portrait canvas card yet (that's M2 scope).
 */
export class CreateCharacterCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('create')
		.setDescription('Tạo nhân vật của bạn')
		.addStringOption((opt) =>
			opt
				.setName('class')
				.setDescription('Lớp nhân vật')
				.setRequired(true)
				.addChoices(...CLASS_NAMES.map((name) => ({ name, value: name }))),
		);

	constructor(private readonly creation = new CharacterCreationService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const combatClass = interaction.options.getString('class', true) as CombatClass;
		const result = this.creation.createCharacter(interaction.user.id, combatClass);

		switch (result.status) {
			case 'not-registered':
				await interaction.reply({ content: 'Bạn chưa đăng ký. Dùng `/register` trước đã.', ephemeral: true });
				return;
			case 'already-has-character':
				await interaction.reply({
					content: 'Bạn đã có nhân vật rồi. Dùng `/balance` hoặc lệnh profile để xem.',
					ephemeral: true,
				});
				return;
			case 'starter-gear-missing':
				await interaction.reply({
					content: 'Tạo nhân vật tạm thời không khả dụng (thiếu dữ liệu gear khởi đầu). Thử lại sau.',
					ephemeral: true,
				});
				return;
			case 'ok': {
				const cls = CLASSES[combatClass];
				await interaction.reply(
					`${cls.emoji} **Character Created — ${combatClass}**\n` +
						`Passive: ${cls.passiveName}\n\n` +
						`Starter gear equipped. Starter grant: +${GRANT_BELIEF_SHARDS.toLocaleString()} Belief Shards, ` +
						`+${GRANT_SILVER_CHESTS} Silver Chests.`,
				);
			}
		}
	}
}
