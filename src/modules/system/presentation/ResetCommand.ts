import { LOG_EVENT_TEXT } from '../../../shared/ui/text/diagnostics.js';
import {
	RESET_ALL_DESCRIPTION,
	RESET_FLOW_TEXT,
	RESET_ALREADY_EMPTY,
	RESET_CANCEL_LABEL,
	RESET_CANCELLED,
	RESET_CONFIRM_HEADER,
	RESET_CONFIRM_LABEL,
	RESET_DESCRIPTION,
	RESET_DONE,
	RESET_NOT_OWNER,
	RESET_USER_CONFIRM_HEADER,
	RESET_USER_DESCRIPTION,
	RESET_USER_DONE,
	RESET_USER_NOT_FOUND,
	RESET_USER_OPTION_DESC,
} from '../../../shared/ui/text/reset.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { isOwner } from '../../../app/owners.js';
import { logger } from '../../../shared/utils/logger.js';
import { ResetService } from '../application/ResetService.js';

const CONFIRM_TTL_MS = 60_000;
const USER_CONFIRM_PREFIX = 'reset:user-confirm:';

/**
 * Admin-only reset. Ba lớp khoá, kiểm tra lúc runtime:
 *  1. `OWNER_DISCORD_IDS` (.env) — ai được gọi lệnh và bấm nút xác nhận;
 *     thiếu biến này / ID ngoài danh sách thì lệnh dừng trước khi đụng DB.
 *  2. Nút xác nhận 60 giây — chỉ người gọi lệnh bấm được.
 *  3. Target user được mã hoá trong customId của nút — nút của lượt confirm
 *     này không thể xoá nhầm user khác.
 *
 * `/reset all`: preview chỉ ĐẾM (`countAll`), xoá (`resetAll`) chỉ chạy khi
 * chủ bot bấm RESET (TRUNCATE users CASCADE + bảng log).
 * `/reset user`: đếm rows (`countUser`), xoá (`resetUser`) đúng 1 user trong
 * 1 transaction — FK lỗi là rollback hết; ghi dấu vết vào dev_logs.
 */
export class ResetCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('reset')
		.setDescription(RESET_DESCRIPTION)
		.setDefaultMemberPermissions(0) // ẩn khỏi everyone — gate thật là OWNER_DISCORD_IDS
		.addSubcommand((sub) => sub.setName('all').setDescription(RESET_ALL_DESCRIPTION))
		.addSubcommand((sub) =>
			sub
				.setName('user')
				.setDescription(RESET_USER_DESCRIPTION)
				.addUserOption((opt) => opt.setName('target').setDescription(RESET_USER_OPTION_DESC).setRequired(true)),
		);

	constructor(private readonly reset: Pick<ResetService, 'countAll' | 'resetAll' | 'countUser' | 'resetUser'>) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		if (!isOwner(interaction.user.id)) {
			await interaction.editReply(RESET_NOT_OWNER);
			return;
		}

		if (interaction.options.getSubcommand() === 'user') {
			await this.resetUserFlow(interaction);
			return;
		}
		await this.resetAllFlow(interaction);
	}

	private collectConfirm(
		interaction: ChatInputCommandInteraction,
		onConfirm: (button: ButtonInteraction) => Promise<void>,
	): void {
		const collector = interaction.channel?.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button: ButtonInteraction) =>
				button.user.id === interaction.user.id && button.message.interaction?.id === interaction.id,
			time: CONFIRM_TTL_MS,
		});
		collector?.on('collect', async (button) => {
			if (button.customId === 'reset:cancel' || button.customId === 'reset:user-cancel') {
				await button.update({ content: RESET_CANCELLED, components: [] });
				collector.stop('cancelled');
				return;
			}
			if (button.customId !== 'reset:confirm' && !button.customId.startsWith(USER_CONFIRM_PREFIX)) return;
			// Chốt lại quyền lúc bấm nút — owner list có thể đã đổi giữa chừng.
			if (!isOwner(button.user.id)) {
				await button.update({ content: RESET_NOT_OWNER, components: [] });
				collector.stop('not-owner');
				return;
			}
			collector.stop('confirmed');
			await button.deferUpdate();
			try {
				await onConfirm(button);
			} catch (error) {
				logger.error({ error }, LOG_EVENT_TEXT.resetFailed);
				await button.editReply({ content: RESET_FLOW_TEXT.failed, components: [] }).catch(() => undefined);
			}
		});
		collector?.on('end', async (_collected, reason) => {
			if (reason === 'confirmed' || reason === 'cancelled' || reason === 'not-owner') return;
			// Hết giờ — gỡ nút, coi như huỷ.
			await interaction.editReply({ content: RESET_CANCELLED, components: [] }).catch(() => undefined);
		});
	}

	private async resetAllFlow(interaction: ChatInputCommandInteraction): Promise<void> {
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

		this.collectConfirm(interaction, async (button) => {
			const result = await this.reset.resetAll(interaction.user.id);
			await button.editReply({
				content: result.status === 'ok' ? RESET_DONE(result.deletedUsers) : RESET_ALREADY_EMPTY,
				components: [],
			});
		});
	}

	private async resetUserFlow(interaction: ChatInputCommandInteraction): Promise<void> {
		const target = interaction.options.getUser('target', true);
		const label = `${target.username} (${target.id})`;
		const rows = await this.reset.countUser(target.id);
		if (rows === 0) {
			await interaction.editReply(RESET_USER_NOT_FOUND);
			return;
		}

		const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`${USER_CONFIRM_PREFIX}${target.id}`)
				.setLabel(RESET_CONFIRM_LABEL)
				.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
				.setCustomId('reset:user-cancel')
				.setLabel(RESET_CANCEL_LABEL)
				.setStyle(ButtonStyle.Secondary),
		);
		await interaction.editReply({ content: RESET_USER_CONFIRM_HEADER(label, rows), components: [confirmRow] });

		this.collectConfirm(interaction, async (button) => {
			const confirmedId = button.customId.slice(USER_CONFIRM_PREFIX.length);
			const result = await this.reset.resetUser(interaction.user.id, confirmedId);
			await button.editReply({
				content: result.status === 'ok' ? RESET_USER_DONE(label, result.deletedRows) : RESET_USER_NOT_FOUND,
				components: [],
			});
		});
	}
}
