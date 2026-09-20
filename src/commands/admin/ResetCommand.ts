import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { ResetService } from '../../services/ResetService.js';
import {
	RESET_ALREADY_EMPTY,
	RESET_CANCEL_LABEL,
	RESET_CANCELLED,
	RESET_CONFIRM_HEADER,
	RESET_CONFIRM_LABEL,
	RESET_DESCRIPTION,
	RESET_DONE,
} from '../../text/reset.js';

const CONFIRM_TTL_MS = 60_000;

/**
 * Admin-only full reset: /reset đếm số người chơi sẽ bị xoá, hiện cảnh báo
 * kèm nút xác nhận 60 giây — chỉ người gọi lệnh bấm được. Xoá qua
 * ResetService (TRUNCATE users CASCADE + bảng log), giữ catalog seed và
 * server_config; ghi dấu vết vào dev_logs.
 */
export class ResetCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('reset')
		.setDescription(RESET_DESCRIPTION)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

	constructor(private readonly reset = new ResetService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId('reset:confirm').setLabel(RESET_CONFIRM_LABEL).setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('reset:cancel').setLabel(RESET_CANCEL_LABEL).setStyle(ButtonStyle.Secondary),
		);

		// Đếm trước để hiển thị số người chơi sẽ mất trong cảnh báo.
		const preview = await this.reset.resetAll();
		if (preview.status === 'nothing-to-reset') {
			await interaction.editReply(RESET_ALREADY_EMPTY);
			return;
		}
		await interaction.editReply({
			content: RESET_CONFIRM_HEADER(preview.deletedUsers),
			components: [confirmRow],
		});
		// resetAll chỉ chạy khi xác nhận — preview ở trên chỉ là count, không xoá gì.
		const collector = interaction.channel?.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button: ButtonInteraction) =>
				button.user.id === interaction.user.id && button.message.interaction?.id === interaction.id,
			time: CONFIRM_TTL_MS,
		});
		collector?.on('collect', async (button) => {
			if (button.customId === 'reset:cancel') {
				await button.update({ content: RESET_CANCELLED, components: [] });
				collector.stop('cancelled');
				return;
			}
			collector.stop('confirmed');
			const result = await this.reset.resetAll();
			if (result.status === 'nothing-to-reset') {
				await button.update({ content: RESET_ALREADY_EMPTY, components: [] });
				return;
			}
			await this.reset.audit(interaction.user.id, result.deletedUsers);
			await button.update({ content: RESET_DONE(result.deletedUsers), components: [] });
		});
		collector?.on('end', async (_collected, reason) => {
			if (reason === 'confirmed' || reason === 'cancelled') return;
			// Hết giờ — gỡ nút, coi như huỷ.
			await interaction.editReply({ content: RESET_CANCELLED, components: [] }).catch(() => undefined);
		});
	}
}
