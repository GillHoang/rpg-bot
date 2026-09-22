import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	ContainerBuilder,
	MessageFlags,
	SeparatorSpacingSize,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Message,
} from 'discord.js';
import type { BattleResult, BattleRoundLog } from '../domain/combat/BattleEngine.js';
import {
	BATTLE_LOG_FIRST_LABEL,
	BATTLE_LOG_HP_CELLS,
	BATTLE_LOG_HP_LINE,
	BATTLE_LOG_LAST_LABEL,
	BATTLE_LOG_NEXT_LABEL,
	BATTLE_LOG_PAGE_INDICATOR,
	BATTLE_LOG_PAGER_TTL_MS,
	BATTLE_LOG_PREV_LABEL,
} from '../text/battleLog.js';
import { renderProgressBar } from '../utils/progressBar.js';

export interface BattleLogPagerOptions {
	battle: BattleResult;
	playerName: string;
	enemyName: string;
	/** Lines shown above the log on every page (outcome, rewards, rating…). */
	headerLines: string[];
	/** Optional line pinned to the bottom of every page. */
	footerLine?: string;
}

const PAGE_CUSTOM_IDS = {
	first: 'battlelog:first',
	prev: 'battlelog:prev',
	next: 'battlelog:next',
	last: 'battlelog:last',
} as const;

const ACCENT_BY_OUTCOME = {
	player_win: 0x57f287,
	enemy_win: 0xed4245,
	draw: 0xfee75c,
} as const;

/** One round's lines can't overflow a TextDisplay — keep the tail if it ever does. */
const MAX_ROUND_TEXT_CHARS = 3500;

function roundLinesText(round: BattleRoundLog | undefined): string {
	if (!round) return '—';
	const text = round.lines.join('\n');
	return text.length > MAX_ROUND_TEXT_CHARS ? `…\n${text.slice(-MAX_ROUND_TEXT_CHARS)}` : text;
}

function hpBlock(round: BattleRoundLog | undefined, playerName: string, enemyName: string): string {
	const playerHp = round?.playerHp ?? 0;
	const playerMax = round?.playerMaxHp || 1;
	const enemyHp = round?.enemyHp ?? 0;
	const enemyMax = round?.enemyMaxHp || 1;
	return [
		BATTLE_LOG_HP_LINE(playerName, playerHp, playerMax),
		renderProgressBar({ current: playerHp, max: playerMax, cells: BATTLE_LOG_HP_CELLS, color: 'blue' }),
		BATTLE_LOG_HP_LINE(enemyName, enemyHp, enemyMax),
		renderProgressBar({ current: enemyHp, max: enemyMax, cells: BATTLE_LOG_HP_CELLS, color: 'green' }),
	].join('\n');
}

/**
 * Builds one page of the Components V2 battle log: header → HP bars (7 cells)
 * → the round's log lines → optional footer → navigation row. The caller picks
 * the page; the pager opens on the LAST round so the fresh result is visible
 * immediately and older rounds stay one click away.
 */
export function buildBattleLogPage(
	options: BattleLogPagerOptions,
	pageIndex: number,
	{
		locked = false,
		navigation = true,
		customIds = PAGE_CUSTOM_IDS,
	}: { locked?: boolean; navigation?: boolean; customIds?: Record<keyof typeof PAGE_CUSTOM_IDS, string> } = {},
): { components: [ContainerBuilder]; flags: number } {
	const { battle } = options;
	const total = Math.max(battle.roundLogs.length, 1);
	const index = Math.min(Math.max(pageIndex, 0), total - 1);
	const round = battle.roundLogs[index];

	const container = new ContainerBuilder().setAccentColor(ACCENT_BY_OUTCOME[battle.outcome]);
	container.addTextDisplayComponents((t) => t.setContent(options.headerLines.join('\n')));
	container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
	container.addTextDisplayComponents((t) => t.setContent(hpBlock(round, options.playerName, options.enemyName)));
	container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
	container.addTextDisplayComponents((t) => t.setContent(roundLinesText(round)));

	const footer = options.footerLine;
	if (footer) {
		container.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true));
		container.addTextDisplayComponents((t) => t.setContent(footer));
	}

	if (navigation && total > 1) {
		const atStart = locked || index === 0;
		const atEnd = locked || index === total - 1;
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(customIds.first)
					.setLabel(BATTLE_LOG_FIRST_LABEL)
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(atStart),
				new ButtonBuilder()
					.setCustomId(customIds.prev)
					.setLabel(BATTLE_LOG_PREV_LABEL)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(atStart),
				new ButtonBuilder()
					.setCustomId('battlelog:indicator')
					.setLabel(BATTLE_LOG_PAGE_INDICATOR(round?.round ?? 1, total))
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId(customIds.next)
					.setLabel(BATTLE_LOG_NEXT_LABEL)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(atEnd),
				new ButtonBuilder()
					.setCustomId(customIds.last)
					.setLabel(BATTLE_LOG_LAST_LABEL)
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(atEnd),
			),
		);
	}

	return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/**
 * Sends the paginated battle log as the command's reply (`mode: 'edit'` for
 * deferred interactions) or a follow-up (duel accept chain), then wires the
 * round navigation buttons for BATTLE_LOG_PAGER_TTL_MS.
 */
export async function sendBattleLog(
	interaction: ChatInputCommandInteraction,
	options: BattleLogPagerOptions,
	mode: 'edit' | 'followUp' = 'edit',
): Promise<void> {
	const total = Math.max(options.battle.roundLogs.length, 1);
	let current = total - 1;
	const payload = () => buildBattleLogPage(options, current);

	let message: Message;
	if (mode === 'edit') message = await interaction.editReply(payload());
	else message = await interaction.followUp(payload());

	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: BATTLE_LOG_PAGER_TTL_MS,
	});
	collector.on('collect', async (button: ButtonInteraction) => {
		switch (button.customId) {
			case PAGE_CUSTOM_IDS.first:
				current = 0;
				break;
			case PAGE_CUSTOM_IDS.prev:
				current = Math.max(0, current - 1);
				break;
			case PAGE_CUSTOM_IDS.next:
				current = Math.min(total - 1, current + 1);
				break;
			case PAGE_CUSTOM_IDS.last:
				current = total - 1;
				break;
			default:
				return;
		}
		await button.update(payload());
	});
	collector.on('end', async () => {
		// Expired — lock the buttons on whichever page is showing.
		await message
			.edit({ components: buildBattleLogPage(options, current, { locked: true }).components })
			.catch(() => undefined);
	});
}
