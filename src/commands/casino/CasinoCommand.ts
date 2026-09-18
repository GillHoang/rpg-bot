import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../core/ICommand.js';
import { CasinoService } from '../../services/CasinoService.js';
import { MAX_BET } from '../../config/casinoPayouts.js';
import type { StatelessCasinoGameKey } from '../../domain/casino/CasinoGameRegistry.js';

export class CasinoCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('casino')
		.setDescription('Chơi 1 ván casino (Credux)')
		.addStringOption((opt) =>
			opt
				.setName('game')
				.setDescription('Trò chơi')
				.setRequired(true)
				.addChoices(
					{ name: 'Coin Toss', value: 'coin_toss' },
					{ name: 'Dice Roll', value: 'dice_roll' },
					{ name: 'Slot Machine', value: 'slot_machine' },
					{ name: 'Baccarat', value: 'baccarat' },
				),
		)
		.addIntegerOption((opt) =>
			opt
				.setName('bet')
				.setDescription(`Tiền cược (tối đa ${MAX_BET.toLocaleString()})`)
				.setMinValue(1)
				.setRequired(true),
		)
		.addStringOption((opt) =>
			opt
				.setName('choice')
				.setDescription('Lựa chọn (coin: heads/tails · dice: odd/even · baccarat: player/banker)')
				.setRequired(false),
		);

	constructor(private readonly casino = new CasinoService()) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		const game = interaction.options.getString('game', true) as StatelessCasinoGameKey;
		const bet = interaction.options.getInteger('bet', true);
		const choice = interaction.options.getString('choice') ?? undefined;

		const result = this.casino.play(interaction.user.id, game, bet, choice);

		if (result.status === 'not-registered') {
			await interaction.reply({ content: 'Bạn chưa đăng ký. Dùng `/register` trước đã!', ephemeral: true });
			return;
		}
		if (result.status === 'invalid-bet') {
			await interaction.reply({
				content: `Tiền cược không hợp lệ (1-${MAX_BET.toLocaleString()}).`,
				ephemeral: true,
			});
			return;
		}
		if (result.status === 'insufficient-credux') {
			await interaction.reply({
				content: `Không đủ Credux. Hiện có ${result.have.toLocaleString()}.`,
				ephemeral: true,
			});
			return;
		}

		const { outcome, balanceAfter } = result;
		const verdict = outcome.won ? '🎉 **Thắng!**' : outcome.payout > 0 ? '🤝 **Hòa (push).**' : '💸 **Thua.**';
		await interaction.reply(
			`${verdict} Kết quả: \`${outcome.result}\`\n` +
				`Thay đổi: ${(outcome.payout - bet >= 0 ? '+' : '') + (outcome.payout - bet).toLocaleString()} Credux · Số dư: ${balanceAfter.toLocaleString()}`,
		);
	}
}
