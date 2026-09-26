import { describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import type { PersistenceContext } from '../src/shared/kernel/persistence.js';
import { EventBus } from '../src/shared/kernel/index.js';
import { systemClock } from '../src/shared/kernel/index.js';
import { subscribeDomainEvents } from '../src/app/events.js';
import { createAppContainer } from '../src/app/container.js';
import { createBot } from '../src/app/bot.js';
import { DiscordBot } from '../src/app/DiscordBot.js';
import { CommandRegistry } from '../src/app/CommandRegistry.js';

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

function context(): PersistenceContext {
	return {
		executor: new Proxy({}, { get: () => { throw new Error('Unexpected database access'); } }) as PersistenceContext['executor'],
		unitOfWork: { run: vi.fn(async () => { throw new Error('Unexpected transaction'); }) },
	};
}

describe('shared kernel canonical locations', () => {
	it('exposes EventBus, clock and domain events from one barrel, with no shared singletons', () => {
		expect(new EventBus()).toBeInstanceOf(EventBus);
		expect(new EventBus()).not.toBe(new EventBus());
		expect(new CommandRegistry()).toBeInstanceOf(CommandRegistry);
		expect('getInstance' in EventBus).toBe(false);
		expect('getInstance' in CommandRegistry).toBe(false);
		expect(systemClock.now()).toBeInstanceOf(Date);
		expect(typeof subscribeDomainEvents).toBe('function');
	});
});

describe('composition root', () => {
	it('shares one use-case owner between container fields and module facades', () => {
		const first = createAppContainer({ persistence: context() });
		const second = createAppContainer({ persistence: context() });
		for (const services of [first, second]) {
			expect(services.progressionModule.runSummon).toBe(services.summon);
			expect(services.economyModule.claimDaily).toBe(services.daily);
			expect(services.combatShared.setup).toBe(services.combatSetup);
		}
		expect(first.events).not.toBe(second.events);
		expect(first.menu).not.toBe(second.menu);
		expect(first.daily).not.toBe(second.daily);
	});
});

describe('app bootstrap', () => {
	it('wires registry, events and client collaborators without I/O', async () => {
		const container = createAppContainer({ persistence: context() });
		const client = { on: vi.fn(), once: vi.fn(), login: vi.fn(), destroy: vi.fn() } as unknown as Client;
		const registry = new CommandRegistry();
		const bot = createBot(container, { client, registry });
		expect(bot).toBeInstanceOf(DiscordBot);
		expect(registry.getAll()).toHaveLength(31);
		expect(client.once).toHaveBeenCalled();
		await bot.stop();
		expect(client.destroy).toHaveBeenCalledTimes(1);
	});
});
