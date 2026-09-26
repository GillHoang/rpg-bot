import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { PersistenceContext } from '../src/shared/kernel/persistence.js';
import { createAppContainer } from '../src/app/container.js';
import { registerAllCommands } from '../src/app/registerAllCommands.js';
import { CommandRegistry } from '../src/app/CommandRegistry.js';
import { EventBus } from '../src/shared/kernel/EventBus.js';
import { subscribeDomainEvents } from '../src/app/events.js';

vi.mock('../src/db/client.js', () => ({
	db: new Proxy(
		{},
		{
			get() {
				throw new Error('Global database accessed');
			},
		},
	),
}));
afterEach(() => vi.restoreAllMocks());

function context(): PersistenceContext {
	return {
		executor: new Proxy(
			{},
			{
				get() {
					throw new Error('Unexpected database access');
				},
			},
		) as PersistenceContext['executor'],
		unitOfWork: {
			run: vi.fn(async () => {
				throw new Error('Unexpected transaction');
			}),
		},
	};
}

describe('application composition', () => {
	it('constructs isolated graphs without I/O or timers and registers the injected menu', async () => {
		const timer = vi.spyOn(globalThis, 'setInterval');
		const first = createAppContainer({ persistence: context() });
		const second = createAppContainer({ persistence: context() });
		expect(first.events).not.toBe(second.events);
		expect(first.menu).not.toBe(second.menu);
		expect(first.daily).not.toBe(second.daily);
		expect(timer).not.toHaveBeenCalled();
		const open = vi.spyOn(first.menu, 'open').mockResolvedValue();
		const other = vi.spyOn(second.menu, 'open').mockResolvedValue();
		const registry = new CommandRegistry();
		registerAllCommands(first, registry);
		expect(registry.getAll()).toHaveLength(30);
		const interaction = {} as ChatInputCommandInteraction;
		await registry
			.getAll()
			.find((command) => command.data.name === 'menu')!
			.execute(interaction);
		expect(open).toHaveBeenCalledExactlyOnceWith(interaction);
		expect(other).not.toHaveBeenCalled();
	});

	it('isolates event observers and skips progression already applied in the transaction', () => {
		const first = createAppContainer({ persistence: context() });
		const second = createAppContainer({ persistence: context() });
		const progress = vi.spyOn(first.quests, 'progress').mockResolvedValue();
		const award = vi.spyOn(first.reputation, 'award').mockResolvedValue({ granted: 0, newLevel: null });
		subscribeDomainEvents(first.events);
		second.events.emit('daily.claimed', { discordId: 'other', streak: 1 });
		first.events.emit('daily.claimed', { discordId: 'atomic', streak: 1, progressApplied: true });
		expect(progress).not.toHaveBeenCalled();
		first.events.emit('daily.claimed', { discordId: 'owner', streak: 1 });
		expect(progress).not.toHaveBeenCalled();
		expect(award).not.toHaveBeenCalled();
	});

	it('builds explicit registration on an isolated event bus, never a shared singleton', async () => {
		const explicit = createAppContainer({ persistence: context() });
		const open = vi.spyOn(explicit.menu, 'open').mockResolvedValue();
		const registry = new CommandRegistry();
		registerAllCommands(explicit, registry);
		expect(registry.getAll()).toHaveLength(30);
		const interaction = {} as ChatInputCommandInteraction;
		await registry
			.getAll()
			.find((command) => command.data.name === 'menu')!
			.execute(interaction);
		expect(open).toHaveBeenCalledExactlyOnceWith(interaction);
	});
});
