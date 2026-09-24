import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { HealthService } from '../application/HealthService.js';
import {
	PING_VALUE_TEXT,
	PING_DB_ERROR,
	PING_DB_LABEL,
	PING_DESCRIPTION,
	PING_REST_LABEL,
	PING_WS_LABEL,
} from '../../../shared/ui/text/ping.js';

/** Một số đo latency, round về ms nguyên. */
interface Latency {
	ms: number;
	/** Đo thất bại (DB chết...) — hiển thị lỗi thay vì số. */
	error?: string;
}

/**
 * Đo độ trễ 3 lớp:
 *  - WebSocket: heartbeat Discord gateway (ws.ping) — độ trễ kết nối realtime.
 *  - REST: chu kỳ deferReply → followUp — thời gian Discord API nhận/xác nhận request.
 *  - PostgreSQL: SELECT 1 đi-đến-đáp-là.
 */
export class PingCommand implements ICommand {
	constructor(private readonly health: Pick<HealthService, 'checkDatabase'>) {}

	readonly data = new SlashCommandBuilder().setName('ping').setDescription(PING_DESCRIPTION);

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// deferReply vừa trả REST latency vừa giữ interaction sống trong lúc đo DB.
		const restStart = Date.now();
		await interaction.deferReply();
		const rest: Latency = { ms: Date.now() - restStart };
		const ws: Latency = { ms: Math.max(0, Math.round(interaction.client.ws.ping)) };
		const dbLatency = await this.measureDb();

		await interaction.editReply(
			[
				`${PING_WS_LABEL}: **${format(ws)}**`,
				`${PING_REST_LABEL}: **${format(rest)}**`,
				`${PING_DB_LABEL}: **${format(dbLatency)}**`,
			].join('\n'),
		);
	}

	private async measureDb(): Promise<Latency> {
		const start = Date.now();
		try {
			await this.health.checkDatabase();
			return { ms: Date.now() - start };
		} catch {
			return { ms: Date.now() - start, error: PING_DB_ERROR };
		}
	}
}

function format(latency: Latency): string {
	if (latency.error) return PING_VALUE_TEXT.error(latency.error, latency.ms);
	return PING_VALUE_TEXT.latency(latency.ms);
}
