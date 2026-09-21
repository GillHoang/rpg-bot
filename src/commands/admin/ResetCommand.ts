import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { isOwner } from '../../core/owners.js';
import { ResetService } from '../../services/ResetService.js';
import {
	RESET_ALREADY_EMPTY,
	RESET_CANCEL_LABEL,
	RESET_CANCELLED,
	RESET_CONFIRM_HEADER,
	RESET_CONFIRM_LABEL,
	RESET_DESCRIPTION,
	RESET_DONE,
	RESET_NOT_OWNER,
} from '../../text/reset.js';

const CONFIRM_TTL_MS = 60_000;

/**
 * Admin-only full reset. Hai lớp khoá, cả hai kiểm tra lúc runtime:
 *  1. `OWNER_DISCORD_IDS` (.env) — ai được gọi lệnh và bấm nút xác nhận;
 *     thiếu biến này / ID ngoài danh sách thì lệnh dừng trước khi đụng DB.
 *  2. Nút xác nhận 60 giây — chỉ người gọi lệnh bấm được.
 *
 * Preview chỉ ĐẾM (`countAll`), xoá (`resetAll`) chỉ chạy khi chủ bot bấm
 * RESET — bấm Huỷ không mất dữ liệu. Xoá qua ResetService (TRUNCATE users
 * CASCADE + bảng log), giữ catalog seed và server_config; ghi dấu vết vào
 * dev_logs.
 */
export class ResetCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('reset')
		.setDescription(RESET_DESCRIPTION)
		.setDefaultMemberPermissions(0); // ẩn khỏieveryone — gate thật là OWNER_DISCORD_IDS

	constructor(private readonly reset: Pick<ResetService, 'countAll' | 'resetAll' | 'audit'> = new ResetService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		if (!isOwner(interaction.user.id)) {
			await interaction.editReply(RESET_NOT_OWNER);
			return;
		}

		// Đếm trước để hiển thị số người chơi sẽ mất trong cảnh báo — KHÔNG xoá gì.
		const playerCount = await this.reset.countAll();
		if (playerCount === 0) {
			await interaction.editReply(RESET_ALREADY_EMPTY);
			return;
		}

		const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId('reset:confirm').setLabel(RESET_CONFIRM_LABEL).setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
				.setCustomId('reset:cancel')
				.setLabel(RESET_CANCEL_LABEL)
				.setStyle(ButtonStyle.Secondary),
		);
		await interaction.editReply({ content: RESET_CONFIRM_HEADER(playerCount), components: [confirmRow] });

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
			if (button.customId !== 'reset:confirm') return;
			// Chốt lại quyền lúc bấm nút — owner list có thể đã đổi giữa chừng.
			if (!isOwner(button.user.id)) {
				await button.update({ content: RESET_NOT_OWNER, components: [] });
				collector.stop('not-owner');
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
			if (reason === 'confirmed' || reason === 'cancelled' || reason === 'not-owner') return;
			// Hết giờ — gỡ nút, coi như huỷ.
			await interaction.editReply({ content: RESET_CANCELLED, components: [] }).catch(() => undefined);
		});
	}
}
