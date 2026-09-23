import { describe, expect, it, vi } from 'vitest';
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { CommandRegistry } from '../src/core/CommandRegistry.js';

vi.mock('../src/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

function fixture(deferred = false, replied = false) {
	const value = {
		commandName: 'test',
		user: { id: 'owner', username: 'Owner' },
		options: { data: [] },
		deferred,
		replied,
		reply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		followUp: vi.fn().mockResolvedValue(undefined),
	};
	return { value, interaction: value as unknown as ChatInputCommandInteraction };
}
function failingRegistry() {
	const registry = new CommandRegistry();
	registry.register({
		data: new SlashCommandBuilder().setName('test').setDescription('Test'),
		execute: async () => {
			throw new Error('DB unavailable');
		},
	});
	return registry;
}
describe('command response recovery', () => {
	it('acknowledges commands left registered on Discord after removal from the bot', async () => {
		const f = fixture();
		await new CommandRegistry().dispatch(f.interaction);
		expect(f.value.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
	});
	it('finishes the original deferred reply when execution fails', async () => {
		const f = fixture(true);
		await failingRegistry().dispatch(f.interaction);
		expect(f.value.editReply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.any(String), components: [] }),
		);
		expect(f.value.followUp).not.toHaveBeenCalled();
	});
	it('preserves an existing result and sends a private follow-up on subsequent failure', async () => {
		const f = fixture(true, true);
		await failingRegistry().dispatch(f.interaction);
		expect(f.value.followUp).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
		expect(f.value.editReply).not.toHaveBeenCalled();
	});
	it('contains Discord errors when even the fallback cannot be delivered', async () => {
		const f = fixture(true);
		f.value.editReply.mockRejectedValue(new Error('Unknown interaction'));
		await expect(failingRegistry().dispatch(f.interaction)).resolves.toBeUndefined();
	});
});
