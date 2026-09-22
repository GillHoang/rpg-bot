import type { WebhookMessageCreateOptions } from 'discord.js';

/** Receives serialized Pino records, so child logger context is included too. */
export class ErrorWebhook {
	private readonly pending = new Set<Promise<unknown>>();

	constructor(
		private readonly send: (payload: WebhookMessageCreateOptions) => Promise<unknown>,
		private readonly secrets: string[] = [],
	) {}

	write(line: string): void {
		try {
			const record = JSON.parse(line) as Record<string, unknown>;
			if (Number(record.level) < 50) return;
			const { level, time, msg, ...context } = record;
			const message = typeof msg === 'string' ? msg : JSON.stringify(msg ?? 'Unknown error');
			const description = this.redact(`${message}\n\n${JSON.stringify(context, null, 2)}`);
			const payload: WebhookMessageCreateOptions = {
				allowedMentions: { parse: [] },
				embeds: [
					{
						title: Number(level) >= 60 ? 'Fatal error' : 'Bot error',
						color: 0xed4245,
						description: description.slice(0, 4096),
						timestamp: new Date(Number(time)).toISOString(),
					},
				],
			};
			// Never report delivery failures through this logger: that would recurse.
			const task = Promise.resolve()
				.then(() => this.send(payload))
				.catch(() => {
					process.stderr.write('Error webhook delivery failed\n');
				});
			this.pending.add(task);
			void task.finally(() => this.pending.delete(task));
		} catch {
			process.stderr.write('Could not format error webhook notification\n');
		}
	}

	async flush(timeoutMs = 5000): Promise<void> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				Promise.all(this.pending),
				new Promise<void>((resolve) => {
					timer = setTimeout(resolve, timeoutMs);
				}),
			]);
		} finally {
			clearTimeout(timer);
		}
	}

	private redact(value: string): string {
		for (const secret of this.secrets.filter(Boolean)) {
			value = value.split(secret).join('[REDACTED]');
		}
		return value
			.replace(
				/https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[^\s"\\]+/g,
				'[REDACTED WEBHOOK]',
			)
			.replace(/("(?:token|password|authorization|secret)"\s*:\s*)"[^"\n]*"/gi, '$1"[REDACTED]"');
	}
}
