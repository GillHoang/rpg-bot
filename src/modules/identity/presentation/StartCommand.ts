import { LOG_EVENT_TEXT } from '../../../shared/ui/text/diagnostics.js';
import { formatNumber } from '../../../shared/ui/text/format.js';
import {
	START_STATS_TEXT,
	START_AGREE_LABEL,
	START_ALREADY_DONE,
	START_BACK_LABEL,
	START_CLASSES_TITLE,
	START_CONFIRM_HEADER,
	START_CONFIRM_LABEL,
	START_CONFIRM_NOTE,
	START_CREATE_FAILED,
	START_DECLINE_LABEL,
	START_DECLINED,
	START_DESCRIPTION,
	START_SEED_MISSING,
	START_SUCCESS,
	START_WELCOME,
} from '../../../shared/ui/text/start.js';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type InteractionCollector,
	type InteractionUpdateOptions,
} from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { StartService } from '../application/StartService.js';
import { CLASSES, CLASS_NAMES, computeClassStats } from '../../../shared/config/classes.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../../../shared/config/starter.js';
import { logger } from '../../../shared/utils/logger.js';
import type { CombatClass } from '../domain/PlayerAccount.js';

/**
 * Onboarding một chạm thay cho cặp /register + /create: welcome (nút
 * Đồng ý / Không đồng ý) → bảng class (nút chọn class) → xác nhận (Xác nhận /
 * Quay lại). Toàn bộ chạy trên message gốc của /start qua editReply, kiểm
 * tra người bấm để người lạ không phá flow của ai đó. Ephemeral để không
 * spam kênh chung.
 */

const FLOW_TTL_MS = 10 * 60_000;

interface StartFlow {
	pickedClass: CombatClass | null;
	busy: boolean;
	ended: boolean;
}

const startCustomId = {
	agree: 'start:agree',
	decline: 'start:decline',
	back: 'start:back',
	confirm: 'start:confirm',
} as const;

const CLASS_PREFIX = 'start:class:';
const classCustomId = (name: string): string => `${CLASS_PREFIX}${name}`;

function parseClassCustomId(customId: string): CombatClass | null {
	if (!customId.startsWith(CLASS_PREFIX)) return null;
	const name = customId.slice(CLASS_PREFIX.length);
	return CLASS_NAMES.includes(name as CombatClass) ? (name as CombatClass) : null;
}

function classDetail(combatClass: CombatClass): string {
	const cls = CLASSES[combatClass];
	const stats = computeClassStats(combatClass, 1);
	return (
		START_STATS_TEXT.baseStats(
			formatNumber(stats.hp),
			formatNumber(stats.atk),
			formatNumber(stats.def),
			stats.crit,
		) + `_${cls.flavor}_\n${cls.passiveLine}`
	);
}

function welcomeView(): InteractionUpdateOptions {
	const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(startCustomId.agree).setLabel(START_AGREE_LABEL).setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(startCustomId.decline)
			.setLabel(START_DECLINE_LABEL)
			.setStyle(ButtonStyle.Danger),
	);
	return { content: START_WELCOME, components: [buttons] };
}

function classesView(): InteractionUpdateOptions {
	const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
		CLASS_NAMES.map((name) =>
			new ButtonBuilder().setCustomId(classCustomId(name)).setLabel(name).setStyle(ButtonStyle.Primary),
		),
	);
	return { content: START_CLASSES_TITLE, components: [buttons] };
}

function confirmView(combatClass: CombatClass): InteractionUpdateOptions {
	const cls = CLASSES[combatClass];
	const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(startCustomId.confirm)
			.setLabel(START_CONFIRM_LABEL)
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId(startCustomId.back).setLabel(START_BACK_LABEL).setStyle(ButtonStyle.Secondary),
	);
	return {
		content: [START_CONFIRM_HEADER(cls.emoji, combatClass), classDetail(combatClass), START_CONFIRM_NOTE].join(
			'\n\n',
		),
		components: [buttons],
	};
}

export class StartCommand implements ICommand {
	readonly data = new SlashCommandBuilder().setName('start').setDescription(START_DESCRIPTION);

	constructor(private readonly startService: Pick<StartService, 'start'> = new StartService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const flow: StartFlow = { pickedClass: null, busy: false, ended: false };
		await interaction.reply({ content: START_WELCOME, components: welcomeView().components, ephemeral: true });
		const message = await interaction.fetchReply();

		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button: ButtonInteraction) => button.user.id === interaction.user.id,
			time: FLOW_TTL_MS,
		});

		collector.on('collect', async (button) => {
			if (flow.ended) return;
			if (flow.busy) {
				await button.deferUpdate().catch(() => undefined);
				return;
			}
			flow.busy = true;
			try {
				await this.handleButton(button, collector, flow);
			} catch (error) {
				// Lỗi ngoài luồng confirm (welcome/class/back) — không để unhandled rejection.
				logger.error({ err: error, discordId: button.user.id }, LOG_EVENT_TEXT.startButtonFailed);
			} finally {
				flow.busy = false;
			}
		});

		collector.on('end', async (_collected, reason) => {
			flow.ended = true;
			if (reason === 'declined' || reason === 'started') return;
			// Hết giờ — gỡ nút, giữ nguyên nội dung đang hiển thị.
			await interaction.editReply({ components: [] }).catch(() => undefined);
		});
	}

	/** Định tuyến một cú bấm nút. Luồng confirm tự bắt lỗi; phần còn lại ném lên trên. */
	private async handleButton(
		button: ButtonInteraction,
		collector: InteractionCollector<ButtonInteraction>,
		flow: StartFlow,
	): Promise<void> {
		if (button.customId === startCustomId.agree) {
			flow.pickedClass = null;
			await button.update(classesView());
			return;
		}
		if (button.customId === startCustomId.decline) {
			collector.stop('declined');
			await button.update({ content: START_DECLINED, components: [] });
			return;
		}
		const chosenFromButton = parseClassCustomId(button.customId);
		if (chosenFromButton) {
			flow.pickedClass = chosenFromButton;
			await button.update(confirmView(chosenFromButton));
			return;
		}
		if (button.customId === startCustomId.back) {
			flow.pickedClass = null;
			await button.update(classesView());
			return;
		}
		if (button.customId !== startCustomId.confirm) return;
		const chosen = flow.pickedClass;
		if (!chosen) return;
		// Ack ngay để nút không kẹt "thinking" — kết quả update qua editReply sau.
		await button.deferUpdate();
		try {
			const result = await this.startService.start(button.user.id, button.user.username, chosen);
			if (result.status === 'already-has-character') {
				collector.stop('started');
				await interactionSafeEdit(button, START_ALREADY_DONE);
				return;
			}
			if (result.status === 'starter-gear-missing') {
				// Không stop collector — giữ nút Xác nhận để thử lại sau khi seed xong.
				await interactionSafeEdit(button, START_SEED_MISSING, flow.ended ? [] : confirmView(chosen).components);
				return;
			}
			collector.stop('started');
			const cls = CLASSES[chosen];
			await interactionSafeEdit(
				button,
				START_SUCCESS(
					cls.emoji,
					chosen,
					cls.passiveName,
					formatNumber(GRANT_BELIEF_SHARDS),
					GRANT_SILVER_CHESTS,
					result.weaponId,
					result.armorId,
				),
			);
		} catch (error) {
			// DB lỗi tạm thời — giữ nút Xác nhận, người chơi bấm lại là thử lại.
			logger.error({ err: error, discordId: button.user.id }, LOG_EVENT_TEXT.startConfirmFailed);
			await interactionSafeEdit(button, START_CREATE_FAILED, flow.ended ? [] : confirmView(chosen).components);
		}
	}
}

/** Update message gốc của flow /start qua reply của nút (đã deferUpdate). */
async function interactionSafeEdit(
	button: ButtonInteraction,
	content: string,
	components?: InteractionUpdateOptions['components'],
): Promise<void> {
	await button.editReply({ content, components: components ?? [] }).catch(() => undefined);
}
