import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { DuelService, DUEL_STAKE_MIN, type DuelAcceptResult } from '../../services/DuelService.js';
import { RAID_LOG_TRUNCATE_PREFIX, RAID_MAX_LOG_CHARS, RAID_ROUND_SUMMARY } from '../../text/raid.js';

const STAKE_OPTION = 'stake';

export class DuelCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('duel')
		.setDescription('Thách đấu 1v1 với người chơi khác (tuỳ chọn cược Credux)')
		.addUserOption((o) => o.setName('opponent').setDescription('Người chơi bị thách đấu').setRequired(true))
		.addIntegerOption((o) =>
			o
				.setName(STAKE_OPTION)
				.setDescription(`Cược Credux cho cả hai (tối thiểu ${DUEL_STAKE_MIN.toLocaleString()})`)
				.setMinValue(0),
		);

	constructor(private readonly duels = new DuelService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const opponent = interaction.options.getUser('opponent', true);
		const stake = interaction.options.getInteger(STAKE_OPTION) ?? 0;

		const created = await this.duels.create(interaction.user.id, opponent.id, stake);
		switch (created.status) {
			case 'self':
				await interaction.reply({ content: 'Không thể tự thách chính mình.', ephemeral: true });
				return;
			case 'invalid-stake':
				await interaction.reply({
					content: `Cược tối thiểu ${DUEL_STAKE_MIN.toLocaleString()} Credux (hoặc 0 để giao hữu).`,
					ephemeral: true,
				});
				return;
			case 'not-registered':
				await interaction.reply({
					content: `${created.who === 'challenger' ? 'Bạn' : 'Đối thủ'} chưa /register.`,
					ephemeral: true,
				});
				return;
			case 'no-character':
				await interaction.reply({
					content: `${created.who === 'challenger' ? 'Bạn' : 'Đối thủ'} chưa /create nhân vật.`,
					ephemeral: true,
				});
				return;
			case 'busy':
				await interaction.reply({
					content: `${created.who === 'challenger' ? 'Bạn' : 'Đối thủ'} đang có một duel khác chờ xử lý.`,
					ephemeral: true,
				});
				return;
			case 'insufficient-funds':
				await interaction.reply({
					content: 'Một trong hai người không đủ Credux cho mức cược này.',
					ephemeral: true,
				});
				return;
		}

		const wagerLine =
			created.stake > 0
				? `\n💰 **Wager**: ${created.stake.toLocaleString()} Credux mỗi bên — winner ăn trọn pot.`
				: '\n🤝 Giao hữu (không cược).';
		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`duel:accept:${created.duelId}`)
				.setLabel('Chấp nhận')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`duel:decline:${created.duelId}`)
				.setLabel('Từ chối')
				.setStyle(ButtonStyle.Danger),
		);
		await interaction.reply({
			content: `⚔️ **${interaction.user.username}** thách đấu **${opponent.username}**!${wagerLine}\n⏳ Hết hạn sau 60 giây.`,
			components: [buttons],
		});

		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 62_000,
		});
		collector.on('collect', async (button) => {
			if (button.customId === `duel:decline:${created.duelId}`) {
				await button.deferUpdate();
				const declined = await this.duels.decline(created.duelId, button.user.id);
				collector.stop(declined ? 'declined' : 'stale');
				return;
			}
			if (button.customId !== `duel:accept:${created.duelId}`) return;
			if (button.user.id !== opponent.id) {
				await button.reply({ content: 'Chỉ đối thủ mới được chấp nhận.', ephemeral: true });
				return;
			}
			await button.deferUpdate();
			collector.stop('accepted');
		});
		collector.on('end', async (_collected, reason) => {
			if (reason === 'accepted') {
				const result = await this.duels.accept(created.duelId, opponent.id);
				await interaction.editReply({ components: [] });
				await interaction.followUp(renderDuel(result));
				return;
			}
			if (reason === 'declined') {
				await interaction.editReply({ content: 'Duel đã bị từ chối.', components: [] });
				return;
			}
			if (reason === 'stale') return;
			// Expired — the sweep drops the pending row; just clean the buttons.
			await interaction
				.editReply({
					content: `⌛ Duel hết hạn — ${interaction.user.username} không dám đánh.`,
					components: [],
				})
				.catch(() => undefined);
		});
	}
}

export function renderDuel(result: DuelAcceptResult): string {
	if (result.status === 'not-found') return 'Duel không còn tồn tại.';
	if (result.status === 'not-opponent') return 'Chỉ đối thủ mới được chấp nhận.';
	if (result.status === 'expired') return 'Duel đã hết hạn.';
	if (result.status === 'insufficient-funds')
		return 'Một trong hai người không đủ Credux lúc chấp nhận — duel bị huỷ.';

	const outcomeLine = result.draw
		? '⚖️ **Hòa!** Cược được hoàn lại cho cả hai.'
		: `🏆 **${result.winnerName} thắng!**` +
			(result.stake > 0 ? ` Nhận ${(result.stake * 2).toLocaleString()} Credux.` : '');
	let logText = result.battle.log.join('\n');
	if (logText.length > RAID_MAX_LOG_CHARS) logText = RAID_LOG_TRUNCATE_PREFIX + logText.slice(-RAID_MAX_LOG_CHARS);
	return (
		outcomeLine +
		'\n' +
		RAID_ROUND_SUMMARY(result.battle.rounds, result.battle.playerHpRemaining, result.battle.enemyHpRemaining) +
		`\n\`\`\`\n${logText}\n\`\`\``
	);
}
