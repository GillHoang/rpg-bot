import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type InteractionUpdateOptions,
} from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { StartService } from '../../services/StartService.js';
import { CLASSES, CLASS_NAMES, computeClassStats } from '../../config/classes.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../../config/starter.js';
import type { CombatClass } from '../../domain/entities/PlayerAccount.js';
import {
	START_AGREE_LABEL,
	START_ALREADY_DONE,
	START_BACK_LABEL,
	START_CLASSES_TITLE,
	START_CONFIRM_HEADER,
	START_CONFIRM_LABEL,
	START_CONFIRM_NOTE,
	START_DECLINE_LABEL,
	START_DECLINED,
	START_DESCRIPTION,
	START_SUCCESS,
	START_WELCOME,
} from '../../text/start.js';

/**
 * Onboarding một chạm thay cho cặp /register + /create: welcome (nút
 * Đồng ý / Không đồng ý) → bảng class (nút chọn class) → xác nhận (Xác nhận /
 * Quay lại). Toàn bộ chạy trên message gốc của /start qua editReply, kiểm
 * tra người bấm để người lạ không phá flow của ai đó. Ephemeral để không
 * spam kênh chung.
 */

const FLOW_TTL_MS = 10 * 60_000;

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
		`HP ${stats.hp.toLocaleString()} · ATK ${stats.atk.toLocaleString()} · DEF ${stats.def.toLocaleString()} · CRIT ${stats.crit}%\n` +
		`_${cls.flavor}_\n${cls.passiveLine}`
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

	constructor(private readonly startService = new StartService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.reply({ content: START_WELCOME, components: welcomeView().components, ephemeral: true });
		const message = await interaction.fetchReply();

		let pickedClass: CombatClass | null = null;
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (button: ButtonInteraction) => button.user.id === interaction.user.id,
			time: FLOW_TTL_MS,
		});

		collector.on('collect', async (button) => {
			if (button.customId === startCustomId.agree) {
				pickedClass = null;
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
				pickedClass = chosenFromButton;
				await button.update(confirmView(chosenFromButton));
				return;
			}
			if (button.customId === startCustomId.back) {
				pickedClass = null;
				await button.update(classesView());
				return;
			}
			if (button.customId === startCustomId.confirm && pickedClass) {
				const chosen = pickedClass;
				collector.stop('started');
				const result = await this.startService.start(interaction.user.id, interaction.user.username, chosen);
				if (result.status === 'already-has-character') {
					await button.update({ content: START_ALREADY_DONE, components: [] });
					return;
				}
				if (result.status === 'starter-gear-missing') {
					await button.update({ content: START_DECLINED, components: [] });
					return;
				}
				const cls = CLASSES[chosen];
				await button.update({
					content: START_SUCCESS(
						cls.emoji,
						chosen,
						cls.passiveName,
						GRANT_BELIEF_SHARDS.toLocaleString(),
						GRANT_SILVER_CHESTS,
						result.weaponId,
						result.armorId,
					),
					components: [],
				});
			}
		});

		collector.on('end', async (_collected, reason) => {
			if (reason === 'declined' || reason === 'started') return;
			// Hết giờ — gỡ nút, giữ nguyên nội dung đang hiển thị.
			await interaction.editReply({ components: [] }).catch(() => undefined);
		});
	}
}
