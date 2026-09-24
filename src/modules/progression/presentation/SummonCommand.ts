import { formatNumber } from '../../../shared/ui/text/format.js';
import {
	SUMMON_RELIC_TEXT,
	RELIC_NAMES,
	SUMMON_COUNT_OPTION_DESC,
	SUMMON_DESCRIPTION,
	SUMMON_DUPE_SUFFIX,
	SUMMON_DUPE_TIMES,
	SUMMON_INSUFFICIENT_RELICS,
	SUMMON_INSUFFICIENT_SHARDS,
	SUMMON_INVALID_COUNT,
	SUMMON_LINES_TRUNCATED,
	SUMMON_NEW_SUFFIX,
	SUMMON_NO_CHARACTER,
	SUMMON_NO_DEITIES_SEEDED,
	SUMMON_RELIC_OPTION_DESC,
	SUMMON_SUCCESS,
	SUMMON_SUCCESS_RELIC,
	TIER_ALIAS,
} from '../../../shared/ui/text/summon.js';
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { RunSummonUseCase } from '../application/RunSummonUseCase.js';
import { MAX_PULLS, type RelicKind } from '../../../shared/config/gachaRates.js';

/** Độ dài tối đa của content Discord. */
const MAX_CONTENT_CHARS = 2000;

/** Header + footer của SUMMON_SUCCESS/SUMMON_SUCCESS_RELIC — khoảng trống dành cho danh sách. */
const SUMMON_SUCCESS_OVERHEAD = 220;

interface PullLine {
	tier: string;
	name: string;
	mythology: string;
	isDupe: boolean;
	essenceGained: number;
}

/**
 * Gộp các lượt TRÙNG LIÊN TIẾP cùng deity thành một dòng với "×N" — một
 * pull x30 toàn trùng (thường gặp khi farm essence) không còn phình message
 * vượt 2000 ký tự của Discord (lỗi 50035 từng làm kết quả không gửi được).
 * Nếu vẫn vượt giới hạn (nhiều deity khác nhau), cắt đuôi và đếm số dòng ẩn.
 */
function summarizePulls(pulls: readonly PullLine[]): string {
	// Gom các lượt GIỐNG HỆT nhau (tier + tên + mythology + essence) thành
	// nhóm đếm được — kể cả không liền nhau, kết quả vẫn đầy đủ thông tin.
	const groups = new Map<string, { line: string; count: number }>();
	const order: string[] = [];
	for (const p of pulls) {
		const alias = TIER_ALIAS[p.tier];
		const suffix = p.isDupe ? SUMMON_DUPE_SUFFIX(p.essenceGained, p.tier) : SUMMON_NEW_SUFFIX;
		const line = `**[${p.tier} · ${alias}]** ${p.name} (${p.mythology})${suffix}`;
		const group = groups.get(line);
		if (group) group.count += 1;
		else {
			groups.set(line, { line, count: 1 });
			order.push(line);
		}
	}
	const lines = order.map((key) => {
		const { line, count } = groups.get(key)!;
		return count > 1 ? `${line}${SUMMON_DUPE_TIMES(count)}` : line;
	});
	return fitContent(lines).join('\n');
}

/** Bỏ đếm ×1 ở dòng đơn lẻ; nếu tổng vẫn vượt 2000 thì cắt đuôi kèm dòng tóm tắt. */
function fitContent(lines: string[]): string[] {
	const trimmed = lines.map((l) => l.replace(/ ×1$/, ''));
	const joined = trimmed.join('\n');
	if (joined.length <= MAX_CONTENT_CHARS - SUMMON_SUCCESS_OVERHEAD) return trimmed;

	const kept: string[] = [];
	let used = SUMMON_SUCCESS_OVERHEAD;
	for (let i = 0; i < trimmed.length; i++) {
		const line = trimmed[i]!;
		const tail = SUMMON_LINES_TRUNCATED(trimmed.length - i);
		if (used + line.length + 1 + tail.length > MAX_CONTENT_CHARS) {
			kept.push(tail);
			return kept;
		}
		kept.push(line);
		used += line.length + 1;
	}
	return kept;
}

export class SummonCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('summon')
		.setDescription(SUMMON_DESCRIPTION)
		.addIntegerOption((opt) =>
			opt
				.setName('count')
				.setDescription(SUMMON_COUNT_OPTION_DESC(MAX_PULLS))
				.setMinValue(1)
				.setMaxValue(MAX_PULLS)
				.setRequired(true),
		)
		.addStringOption((opt) =>
			opt
				.setName('relic')
				.setDescription(SUMMON_RELIC_OPTION_DESC)
				.addChoices(
					{ name: SUMMON_RELIC_TEXT.sacredChoice, value: 'sacred' },
					{ name: SUMMON_RELIC_TEXT.supremeChoice, value: 'supreme' },
				),
		);

	constructor(private readonly summon: Pick<RunSummonUseCase, 'run'> = new RunSummonUseCase()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Multi-pull transactions can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		const count = interaction.options.getInteger('count', true);
		const relic = (interaction.options.getString('relic') ?? undefined) as RelicKind | undefined;
		const result = await this.summon.run(interaction.user.id, count, relic);

		switch (result.status) {
			case 'invalid-count':
				await interaction.editReply({ content: SUMMON_INVALID_COUNT(MAX_PULLS) });
				return;
			case 'no-character':
				await interaction.editReply({ content: SUMMON_NO_CHARACTER });
				return;
			case 'insufficient-shards':
				await interaction.editReply({
					content: SUMMON_INSUFFICIENT_SHARDS(formatNumber(result.needed), formatNumber(result.have)),
				});
				return;
			case 'insufficient-relics':
				await interaction.editReply({
					content: SUMMON_INSUFFICIENT_RELICS(result.relic, result.needed, result.have),
				});
				return;
			case 'no-deities-seeded':
				await interaction.editReply({ content: SUMMON_NO_DEITIES_SEEDED(result.tier) });
				return;
			case 'ok': {
				const lines = summarizePulls(result.pulls);
				const cost = SUMMON_RELIC_TEXT.relicCost(
					count,
					relic === 'sacred' ? RELIC_NAMES.sacred : RELIC_NAMES.supreme,
				);
				await interaction.editReply(
					relic
						? SUMMON_SUCCESS_RELIC(result.pulls.length, cost, lines, result.finalPity)
						: SUMMON_SUCCESS(
								result.pulls.length,
								formatNumber(result.shardsSpent),
								lines,
								result.finalPity,
							),
				);
			}
		}
	}
}
