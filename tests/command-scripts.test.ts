import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ put: vi.fn(), register: vi.fn() }));
vi.mock('discord.js', () => ({
	REST: class {
		setToken() {
			return this;
		}
		put = api.put;
	},
	Routes: {
		applicationCommands: () => 'global',
		applicationGuildCommands: (_app: string, guild: string) => `guild:${guild}`,
	},
}));
vi.mock('../src/shared/config/env.js', () => ({
	env: { DISCORD_TOKEN: 'fake', DISCORD_CLIENT_ID: '123', DEPLOY_GUILD_ID: '456' },
}));
vi.mock('../src/shared/utils/logger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn() },
	flushErrorWebhook: vi.fn(async () => {}),
}));
vi.mock('../src/app/registerAllCommands.js', () => ({ registerAllCommands: api.register }));
vi.mock('../src/app/CommandRegistry.js', () => ({
	CommandRegistry: {
		getInstance: () => ({
			getAll: () => ['start', 'test'].map((name) => ({ data: { name, toJSON: () => ({ name }) } })),
		}),
	},
}));

const originalArgv = process.argv;
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	api.put.mockResolvedValue(undefined);
	vi.spyOn(process, 'exit').mockImplementation(() => {
		throw new Error('exit');
	});
});
afterEach(() => {
	process.argv = originalArgv;
	vi.restoreAllMocks();
});

describe('command script API boundaries', () => {
	it('clears only the explicit guild', async () => {
		process.argv = ['node', 'script', '--guild', '789'];
		await import('../src/scripts/clearCommands.js');
		expect(api.put.mock.calls).toEqual([['guild:789', { body: [] }]]);
	});
	it('clears only global when explicitly selected over the environment', async () => {
		process.argv = ['node', 'script', '--global'];
		await import('../src/scripts/clearCommands.js');
		expect(api.put.mock.calls).toEqual([['global', { body: [] }]]);
	});
	it('clears both scopes only with --all', async () => {
		process.argv = ['node', 'script', '--all'];
		await import('../src/scripts/clearCommands.js');
		expect(api.put.mock.calls).toEqual([
			['global', { body: [] }],
			['guild:456', { body: [] }],
		]);
	});
	it('rejects missing guild ID before clearing anything', async () => {
		process.argv = ['node', 'script', '--guild'];
		await expect(import('../src/scripts/clearCommands.js')).rejects.toThrow('exit');
		expect(api.put).not.toHaveBeenCalled();
	});
	it('rejects missing guild ID before registering or deploying anything', async () => {
		process.argv = ['node', 'script', '--guild='];
		await expect(import('../src/scripts/deployCommands.js')).rejects.toThrow('exit');
		expect(api.put).not.toHaveBeenCalled();
		expect(api.register).not.toHaveBeenCalled();
	});
	it('deploys global without the dev command', async () => {
		process.argv = ['node', 'script', '--global'];
		await import('../src/scripts/deployCommands.js');
		expect(api.put.mock.calls).toEqual([['global', { body: [{ name: 'start' }] }]]);
	});
	it('deploys the environment guild with the dev command', async () => {
		process.argv = ['node', 'script'];
		await import('../src/scripts/deployCommands.js');
		expect(api.put.mock.calls).toEqual([['guild:456', { body: [{ name: 'start' }, { name: 'test' }] }]]);
	});
});
