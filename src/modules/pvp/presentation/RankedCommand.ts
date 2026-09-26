import { formatNumber } from '../../../shared/ui/text/format.js';
import {
	RANKED_RESULT_TEXT,
	RANKED_ALREADY_CLAIMED,
	RANKED_BUSY,
	RANKED_CLAIM_DESC,
	RANKED_CLAIM_OK,
	RANKED_DESCRIPTION,
	RANKED_FIGHT_DESC,
	RANKED_FOOTER,
	RANKED_MATCHUP,
	RANKED_NO_CHARACTER,
	RANKED_NO_FIGHTS,
	RANKED_NO_OPPONENT,
	RANKED_NOT_REGISTERED,
	RANKED_NO_REWARD_ROW,
	RANKED_NO_SEASON,
	RANKED_OUTCOME_DRAW,
	RANKED_OUTCOME_LOSE,
	RANKED_OUTCOME_WIN,
	RANKED_SEASON_ALREADY_CLAIMED,
	RANKED_SEASON_DESC,
	RANKED_SEASON_NO_FIGHTS,
	RANKED_SEASON_OK,
	RANKED_SHIELD_NOTE,
	RANKED_STATS_DESC,
} from '../../../shared/ui/text/ranked.js';
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { sendBattleLog } from '../../../shared/ui/render/BattleLogPager.js';
import { RankedService, type RankedClaimResult, type RankedSeasonClaimResult } from '../application/RankedService.js';

export class RankedCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('ranked')
		.setDescription(RANKED_DESCRIPTION)
		.addSubcommand((s) => s.setName('fight').setDescription(RANKED_FIGHT_DESC))
		.addSubcommand((s) => s.setName('claim').setDescription(RANKED_CLAIM_DESC))
		.addSubcommand((s) => s.setName('season').setDescription(RANKED_SEASON_DESC))
		.addSubcommand((s) => s.setName('stats').setDescription(RANKED_STATS_DESC));

	constructor(private readonly ranked: Pick<RankedService, 'claim' | 'claimSeason' | 'stats' | 'fight'>) {}

	private claimMessage(result: RankedClaimResult): string {
		switch (result.status) {
			case 'not-registered':
				return RANKED_NOT_REGISTERED;
			case 'already-claimed':
				return RANKED_ALREADY_CLAIMED;
			case 'no-fights':
				return RANKED_NO_FIGHTS;
			case 'no-reward-row':
				return RANKED_NO_REWARD_ROW;
			default:
				return (
					RANKED_CLAIM_OK(result.bracket, formatNumber(result.credux), result.valor) +
					(result.chests.length ? ` · ${result.chests.join(' · ')}` : '')
				);
		}
	}

	private seasonMessage(result: RankedSeasonClaimResult): string {
		switch (result.status) {
			case 'not-registered':
				return RANKED_NOT_REGISTERED;
			case 'no-season':
				return RANKED_NO_SEASON;
			case 'no-fights':
				return RANKED_SEASON_NO_FIGHTS;
			case 'already-claimed':
				return RANKED_SEASON_ALREADY_CLAIMED;
			case 'no-reward-row':
				return RANKED_NO_REWARD_ROW;
			default:
				return (
					RANKED_SEASON_OK(result.bracket, formatNumber(result.credux), result.valor) +
					(result.chests.length ? ` · ${result.chests.join(' · ')}` : '')
				);
		}
	}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		await interaction.deferReply();
		const sub = interaction.options.getSubcommand(false);

		if (sub === 'claim') {
			const result = await this.ranked.claim(interaction.user.id);
			await interaction.editReply(this.claimMessage(result));
			return;
		}

		if (sub === 'season') {
			const result = await this.ranked.claimSeason(interaction.user.id);
			await interaction.editReply(this.seasonMessage(result));
			return;
		}

		if (sub === 'stats') {
			const stats = await this.ranked.stats(interaction.user.id);
			await interaction.editReply(stats.ok ? stats.value : stats.error.message);
			return;
		}

		const result = await this.ranked.fight(interaction.user.id);
		if (result.status === 'not-registered') {
			await interaction.editReply(RANKED_NOT_REGISTERED);
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply(RANKED_NO_CHARACTER);
			return;
		}
		if (result.status === 'busy') {
			await interaction.editReply(RANKED_BUSY);
			return;
		}
		if (result.status === 'no-opponent') {
			await interaction.editReply(RANKED_NO_OPPONENT);
			return;
		}

		let outcome = RANKED_OUTCOME_LOSE;
		if (result.draw) outcome = RANKED_OUTCOME_DRAW;
		else if (result.won) outcome = RANKED_OUTCOME_WIN;

		await sendBattleLog(
			interaction,
			{
				battle: result.battle,
				playerName: interaction.user.username,
				enemyName: result.opponentName,
				headerLines: [
					RANKED_MATCHUP(result.opponentName, outcome),
					RANKED_RESULT_TEXT.rating(
						result.ratingBefore,
						result.ratingAfter,
						result.delta >= 0 ? '+' : '',
						result.delta,
					) +
						RANKED_RESULT_TEXT.bracket(result.bracketBefore, result.bracketAfter, result.peak) +
						(result.shieldUsed ? RANKED_SHIELD_NOTE : ''),
				],
				footerLine: RANKED_FOOTER,
			},
			'edit',
		);
	}
}
