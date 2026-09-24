import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';

const service = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock('../src/modules/identity/application/StartService.js', () => ({
	StartService: class {
		start = service.start;
	},
}));
vi.mock('../src/shared/utils/logger.js', () => ({ logger: { error: vi.fn() } }));
import { StartCommand } from '../src/modules/identity/presentation/StartCommand.js';
import { StartService } from '../src/modules/identity/application/StartService.js';

function fixture(id: string) {
	const collector = Object.assign(new EventEmitter(), { stop: vi.fn() });
	collector.stop.mockImplementation((reason: string) => collector.emit('end', [], reason));
	const interaction = {
		user: { id, username: id },
		reply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		fetchReply: vi.fn().mockResolvedValue({ createMessageComponentCollector: () => collector }),
	};
	const button = (customId: string) => ({
		user: interaction.user,
		customId,
		update: vi.fn().mockResolvedValue(undefined),
		deferUpdate: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
	});
	const press = async (customId: string) => {
		const b = button(customId);
		await collector.listeners('collect')[0]!(b);
		return b;
	};
	return { interaction: interaction as unknown as ChatInputCommandInteraction, collector, press };
}

beforeEach(() => {
	vi.resetAllMocks();
	service.start.mockResolvedValue({ status: 'ok', weaponId: 'w', armorId: 'a' });
});

describe('start sessions', () => {
	it.each([
		['alice', 'bob'],
		['alice', 'alice'],
	])('isolates interleaved sessions for %s and %s', async (a, b) => {
		const command = new StartCommand(new StartService());
		const first = fixture(a),
			second = fixture(b);
		await command.execute(first.interaction);
		await command.execute(second.interaction);
		await first.press('start:class:Knight');
		await second.press('start:class:Mage');
		const confirmed = await first.press('start:confirm');
		await second.press('start:confirm');
		expect(service.start.mock.calls).toEqual([
			[a, a, 'Knight'],
			[b, b, 'Mage'],
		]);
		expect(confirmed.editReply).toHaveBeenCalledWith(expect.objectContaining({ components: [] }));
	});
	it('going back in another session does not clear the first selection', async () => {
		const command = new StartCommand(new StartService()),
			a = fixture('a'),
			b = fixture('b');
		await command.execute(a.interaction);
		await command.execute(b.interaction);
		await a.press('start:class:Knight');
		await b.press('start:back');
		await a.press('start:confirm');
		expect(service.start).toHaveBeenCalledWith('a', 'a', 'Knight');
	});
	it('ignores repeated confirms while creation is in progress', async () => {
		let finish!: (result: unknown) => void;
		service.start.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		const f = fixture('a');
		await new StartCommand(new StartService()).execute(f.interaction);
		await f.press('start:class:Knight');
		const pending = f.press('start:confirm');
		const duplicate = await f.press('start:confirm');
		expect(service.start).toHaveBeenCalledTimes(1);
		expect(duplicate.deferUpdate).toHaveBeenCalledOnce();
		finish({ status: 'ok', weaponId: 'w', armorId: 'a' });
		await pending;
	});
	it('allows retry after a temporary failure', async () => {
		service.start.mockRejectedValueOnce(new Error('temporary'));
		const f = fixture('a');
		await new StartCommand(new StartService()).execute(f.interaction);
		await f.press('start:class:Mage');
		const failed = await f.press('start:confirm');
		expect(failed.editReply.mock.calls[0]![0].components).toHaveLength(1);
		expect(f.collector.stop).not.toHaveBeenCalled();
		await f.press('start:confirm');
		expect(service.start).toHaveBeenCalledTimes(2);
		expect(f.collector.stop).toHaveBeenCalledWith('started');
	});
	it('does not write to the database if acknowledging the button fails', async () => {
		const f = fixture('a');
		await new StartCommand(new StartService()).execute(f.interaction);
		await f.press('start:class:Knight');
		await f.collector.listeners('collect')[0]!({
			customId: 'start:confirm',
			user: { id: 'a' },
			deferUpdate: vi.fn().mockRejectedValue(new Error('expired')),
		});
		expect(service.start).not.toHaveBeenCalled();
	});
});
