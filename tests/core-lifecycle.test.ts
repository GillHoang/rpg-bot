import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events, type Client, type Interaction } from 'discord.js';

const log = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock('../src/shared/utils/logger.js', () => ({ logger: log }));
vi.mock('../src/shared/config/env.js', () => ({ env: { DISCORD_TOKEN: 'lifecycle-token' } }));
vi.mock('../src/db/client.js', () => ({ db: {}, pool: {} }));
vi.mock('../src/modules/casino/application/CasinoSessionService.js', () => ({
	CasinoSessionService: class {
		constructor() {
			throw new Error('Use injected sessions');
		}
	},
}));
vi.mock('../src/modules/pvp/application/DuelService.js', () => ({
	DuelService: class {
		constructor() {
			throw new Error('Use injected duels');
		}
	},
}));
import { BotMaintenance } from '../src/app/BotMaintenance.js';
import { Scheduler } from '../src/app/Scheduler.js';
import { DiscordBot } from '../src/app/DiscordBot.js';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-21T00:00:00Z'));
	vi.clearAllMocks();
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

function maintenanceFixture() {
	const sessions = { recoverExpired: vi.fn(async () => {}) };
	const scheduler = { start: vi.fn(), stop: vi.fn() };
	const menu = { sweep: vi.fn() };
	return { sessions, scheduler, menu, maintenance: new BotMaintenance(sessions, scheduler, menu) };
}

describe('BotMaintenance lifecycle', () => {
	it('recovers immediately, preserves 15s/60s timers and avoids duplicate starts', async () => {
		const f = maintenanceFixture();
		f.maintenance.start();
		f.maintenance.start();
		expect(f.sessions.recoverExpired).toHaveBeenCalledOnce();
		expect(f.scheduler.start).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(2);
		await vi.advanceTimersByTimeAsync(14_999);
		expect(f.sessions.recoverExpired).toHaveBeenCalledOnce();
		expect(f.menu.sweep).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(f.sessions.recoverExpired).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(45_000);
		expect(f.sessions.recoverExpired).toHaveBeenCalledTimes(5);
		expect(f.menu.sweep).toHaveBeenCalledOnce();
		f.maintenance.stop();
		expect(f.scheduler.stop).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(120_000);
		expect(f.sessions.recoverExpired).toHaveBeenCalledTimes(5);
		expect(f.menu.sweep).toHaveBeenCalledOnce();
		f.maintenance.start();
		f.maintenance.start();
		expect(f.sessions.recoverExpired).toHaveBeenCalledTimes(6);
		expect(f.scheduler.start).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(2);
		f.maintenance.stop();
	});

	it('suppresses overlapping recovery and permits recovery after failure', async () => {
		const f = maintenanceFixture();
		let fail!: (error: Error) => void;
		f.sessions.recoverExpired.mockImplementationOnce(
			() =>
				new Promise<void>((_resolve, reject) => {
					fail = reject;
				}),
		);
		f.maintenance.start();
		await vi.advanceTimersByTimeAsync(45_000);
		expect(f.sessions.recoverExpired).toHaveBeenCalledOnce();
		fail(new Error('temporary failure'));
		await vi.advanceTimersByTimeAsync(0);
		expect(log.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Casino expiry recovery failed');
		await vi.advanceTimersByTimeAsync(15_000);
		expect(f.sessions.recoverExpired).toHaveBeenCalledTimes(2);
		f.maintenance.stop();
	});

	it('does not overlap an in-flight recovery when stopped and restarted', async () => {
		const f = maintenanceFixture();
		let finish!: () => void;
		f.sessions.recoverExpired.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		f.maintenance.start();
		f.maintenance.stop();
		f.maintenance.start();
		expect(f.sessions.recoverExpired).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(2);
		finish();
		await vi.advanceTimersByTimeAsync(15_000);
		expect(f.sessions.recoverExpired).toHaveBeenCalledTimes(2);
		f.maintenance.stop();
	});
});

describe('Scheduler lifecycle', () => {
	it('preserves the 30s sweep and single timer across repeated start/stop calls', async () => {
		const duels = { expireStale: vi.fn(async () => 2) };
		const repository = { clearExpiredRankedLocks: vi.fn(async (_now: Date) => {}) };
		const scheduler = new Scheduler(duels, repository);
		scheduler.start();
		scheduler.start();
		expect(duels.expireStale).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(29_999);
		expect(duels.expireStale).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(duels.expireStale).toHaveBeenCalledOnce();
		expect(repository.clearExpiredRankedLocks).toHaveBeenCalledExactlyOnceWith(new Date('2026-09-21T00:00:30Z'));
		expect(log.info).toHaveBeenCalledWith({ expired: 2 }, 'Expired pending duels swept');
		expect(duels.expireStale.mock.invocationCallOrder[0]).toBeLessThan(
			repository.clearExpiredRankedLocks.mock.invocationCallOrder[0],
		);
		scheduler.stop();
		scheduler.stop();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(duels.expireStale).toHaveBeenCalledOnce();
		scheduler.start();
		scheduler.start();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(duels.expireStale).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(1);
		scheduler.stop();
	});

	it('contains duel/lock failures and retries on the following scheduled sweep', async () => {
		const duels = { expireStale: vi.fn(async () => 0).mockRejectedValueOnce(new Error('duel failed')) };
		const repository = {
			clearExpiredRankedLocks: vi
				.fn(async (_now: Date) => {})
				.mockRejectedValueOnce(new Error('lock cleanup failed')),
		};
		const scheduler = new Scheduler(duels, repository);
		scheduler.start();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(repository.clearExpiredRankedLocks).not.toHaveBeenCalled();
		expect(log.error).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(repository.clearExpiredRankedLocks).toHaveBeenCalledOnce();
		expect(log.error).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(duels.expireStale).toHaveBeenCalledTimes(3);
		expect(repository.clearExpiredRankedLocks).toHaveBeenCalledTimes(2);
		expect(log.error).toHaveBeenCalledTimes(2);
		scheduler.stop();
	});
});

describe('DiscordBot lifecycle and injected routing', () => {
	it('starts maintenance on ready, dispatches through supplied ports, and stops before destroying the client', async () => {
		const client = Object.assign(new EventEmitter(), {
			login: vi.fn(async (_token: string) => 'connected'),
			destroy: vi.fn(async () => {}),
		});
		const maintenance = { start: vi.fn(), stop: vi.fn() };
		const menu = { handle: vi.fn(async (_interaction: Interaction) => false) };
		const registry = { dispatch: vi.fn(async () => {}), dispatchAutocomplete: vi.fn(async () => {}) };
		const bot = new DiscordBot({ client: client as unknown as Client, registry, menu, maintenance });
		await bot.start();
		expect(client.login).toHaveBeenCalledExactlyOnceWith('lifecycle-token');
		expect(maintenance.start).not.toHaveBeenCalled();
		client.emit(Events.ClientReady, { user: { tag: 'TestBot' } });
		client.emit(Events.ClientReady, { user: { tag: 'TestBot' } });
		expect(maintenance.start).toHaveBeenCalledOnce();
		const handle = client.listeners(Events.InteractionCreate)[0] as (interaction: Interaction) => Promise<void>;
		const command = { isAutocomplete: () => false, isChatInputCommand: () => true } as unknown as Interaction;
		menu.handle.mockResolvedValueOnce(true);
		await handle(command);
		expect(registry.dispatch).not.toHaveBeenCalled();
		await handle(command);
		expect(registry.dispatch).toHaveBeenCalledExactlyOnceWith(command);
		const autocomplete = { isAutocomplete: () => true } as unknown as Interaction;
		await handle(autocomplete);
		expect(registry.dispatchAutocomplete).toHaveBeenCalledExactlyOnceWith(autocomplete);
		await bot.stop();
		expect(maintenance.stop).toHaveBeenCalledOnce();
		expect(client.destroy).toHaveBeenCalledOnce();
		expect(maintenance.stop.mock.invocationCallOrder[0]).toBeLessThan(client.destroy.mock.invocationCallOrder[0]);
	});
});
