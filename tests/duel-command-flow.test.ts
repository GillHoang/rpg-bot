import { describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
vi.mock('../src/db/client.js', () => ({ db: {}, pool: {} }));
vi.mock('../src/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { DuelCommand } from '../src/commands/rpg/DuelCommand.js';

async function fixture() {
	let collect!: (button: ButtonInteraction) => Promise<void>;
	let end!: (collected: unknown, reason: string) => Promise<void>;
	const collector = {
		on: vi.fn((event, callback) => {
			if (event === 'collect') collect = callback;
			else end = callback;
		}),
		stop: vi.fn(),
	};
	const duels = {
		create: vi.fn().mockResolvedValue({ status: 'ok', duelId: 'duel', stake: 0 }),
		decline: vi.fn().mockResolvedValue(false),
		accept: vi.fn().mockRejectedValue(new Error('DB failure')),
	};
	const interaction = {
		user: { id: 'owner', username: 'Owner' },
		options: { getUser: () => ({ id: 'opponent', username: 'Opponent' }), getInteger: () => 0 },
		reply: vi.fn().mockResolvedValue(undefined),
		fetchReply: vi.fn().mockResolvedValue({ createMessageComponentCollector: () => collector }),
		editReply: vi.fn().mockResolvedValue(undefined),
	};
	await new DuelCommand(duels).execute(interaction as unknown as ChatInputCommandInteraction);
	return { collect, end, collector, duels, interaction };
}
describe('duel collector recovery', () => {
	it('removes stale invite buttons', async () => {
		const f = await fixture();
		await f.end([], 'stale');
		expect(f.interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
	});
	it('contains acceptance failures and removes the dead invite', async () => {
		const f = await fixture();
		await expect(f.end([], 'accepted')).resolves.toBeUndefined();
		expect(f.collector.stop).toHaveBeenCalledWith('error');
		expect(f.interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
	});
	it('contains failed acknowledgements and a failed recovery edit', async () => {
		const f = await fixture();
		f.interaction.editReply.mockRejectedValue(new Error('Unknown message'));
		await expect(
			f.collect({
				customId: 'duel:accept:duel',
				user: { id: 'opponent' },
				deferUpdate: vi.fn().mockRejectedValue(new Error('Unknown interaction')),
			} as unknown as ButtonInteraction),
		).resolves.toBeUndefined();
		expect(f.duels.accept).not.toHaveBeenCalled();
	});
});
