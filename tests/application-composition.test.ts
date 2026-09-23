import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { PersistenceContext } from '../src/application/ports/PersistenceContext.js';
import { createApplicationServices } from '../src/application/createApplicationServices.js';
import { registerAllCommands } from '../src/core/registerAllCommands.js';
import { CommandRegistry } from '../src/core/CommandRegistry.js';
import { EventBus } from '../src/core/EventBus.js';
import { subscribeDomainEvents } from '../src/core/subscribeDomainEvents.js';
import { menuRouter } from '../src/menu/menuRuntime.js';

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
		const first = createApplicationServices({ persistence: context() });
		const second = createApplicationServices({ persistence: context() });
		expect(first.events).not.toBe(second.events);
		expect(first.menu).not.toBe(second.menu);
		expect(first.daily).not.toBe(second.daily);
		expect(timer).not.toHaveBeenCalled();
		const open = vi.spyOn(first.menu, 'open').mockResolvedValue();
		const other = vi.spyOn(second.menu, 'open').mockResolvedValue();
		const registry = new CommandRegistry();
		registerAllCommands(first, registry);
		expect(registry.getAll()).toHaveLength(28);
		const interaction = {} as ChatInputCommandInteraction;
		await registry
			.getAll()
			.find((command) => command.data.name === 'menu')!
			.execute(interaction);
		expect(open).toHaveBeenCalledExactlyOnceWith(interaction);
		expect(other).not.toHaveBeenCalled();
	});

	it('isolates event observers and skips progression already applied in the transaction', () => {
		const first = createApplicationServices({ persistence: context() });
		const second = createApplicationServices({ persistence: context() });
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

	it('keeps zero-argument registration on the legacy shared menu and event bus', async () => {
		const open = vi.spyOn(menuRouter, 'open').mockResolvedValue();
		const singleton = vi.spyOn(EventBus, 'getInstance');
		registerAllCommands();
		expect(singleton).toHaveBeenCalled();
		const interaction = {} as ChatInputCommandInteraction;
		await CommandRegistry.getInstance()
			.getAll()
			.find((command) => command.data.name === 'menu')!
			.execute(interaction);
		expect(open).toHaveBeenCalledExactlyOnceWith(interaction);
	});
});
