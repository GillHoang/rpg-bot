import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';

vi.mock('../src/db/client.js', () => ({ db: {}, pool: {} }));
vi.mock('../src/shared/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const owners = vi.hoisted(() => ({ isOwner: vi.fn(() => true) }));
vi.mock('../src/app/owners.js', () => ({ isOwner: owners.isOwner }));
const reset = vi.hoisted(() => ({ countAll: vi.fn(), resetAll: vi.fn(), audit: vi.fn() }));
vi.mock('../src/modules/system/application/ResetService.js', () => ({
	ResetService: class {
		countAll = reset.countAll;
		resetAll = reset.resetAll;
		audit = reset.audit;
	},
}));
import { ResetCommand } from '../src/modules/system/presentation/ResetCommand.js';

function fixture() {
	const collector = new EventEmitter() as EventEmitter & { stop: ReturnType<typeof vi.fn> };
	collector.stop = vi.fn((reason: string) => collector.emit('end', [], reason));
	const channel = { createMessageComponentCollector: vi.fn(() => collector) };
	const i = {
		user: { id: 'owner-1' },
		channel,
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		id: 'interaction-1',
	};
	return { i, interaction: i as unknown as ChatInputCommandInteraction, collector, channel };
}

/** Giả lập một cú bấm nút đi qua collector của lệnh. */
function press(collector: EventEmitter, overrides: Record<string, unknown> = {}) {
	const button = {
		user: { id: 'owner-1' },
		customId: 'reset:confirm',
		deferUpdate: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		message: { interaction: { id: 'interaction-1' } },
		...overrides,
	};
	collector.emit('collect', button);
	return button;
}

beforeEach(() => {
	vi.clearAllMocks();
	owners.isOwner.mockImplementation((id: string) => id === 'owner-1');
	reset.countAll.mockResolvedValue(7);
	reset.resetAll.mockResolvedValue({ status: 'ok', deletedUsers: 7 });
});

describe('ResetCommand confirm flow', () => {
	it('non-owner caller gets refused before any DB call', async () => {
		const f = fixture();
		owners.isOwner.mockReturnValue(false);
		await new ResetCommand().execute(f.interaction);
		expect(f.i.editReply).toHaveBeenCalledExactlyOnceWith('Lệnh này chỉ dành cho chủ bot.');
		expect(reset.countAll).not.toHaveBeenCalled();
		expect(f.channel.createMessageComponentCollector).not.toHaveBeenCalled();
	});

	it('preview only counts — nothing is deleted before the owner presses RESET', async () => {
		const f = fixture();
		await new ResetCommand().execute(f.interaction);
		expect(reset.countAll).toHaveBeenCalledOnce();
		expect(reset.resetAll).not.toHaveBeenCalled();
		expect(f.i.editReply).toHaveBeenCalledWith(expect.objectContaining({ components: [expect.anything()] }));
	});

	it('cancel leaves data untouched', async () => {
		const f = fixture();
		await new ResetCommand().execute(f.interaction);
		press(f.collector, { customId: 'reset:cancel' });
		await vi.waitFor(() => expect(f.collector.stop).toHaveBeenCalledWith('cancelled'));
		expect(reset.resetAll).not.toHaveBeenCalled();
		expect(reset.audit).not.toHaveBeenCalled();
	});

	it('confirm wipes, audits, and reports the deleted count', async () => {
		const f = fixture();
		await new ResetCommand().execute(f.interaction);
		const button = press(f.collector);
		// stop('confirmed') bắn trước khi resetAll xong — chờ tới khi kết quả hiển thị.
		await vi.waitFor(() => expect(button.editReply).toHaveBeenCalled());
		expect(f.collector.stop).toHaveBeenCalledWith('confirmed');
		expect(reset.resetAll).toHaveBeenCalledOnce();
		expect(reset.resetAll).toHaveBeenCalledWith('owner-1');
		expect(button.deferUpdate).toHaveBeenCalledOnce();
		expect(button.editReply).toHaveBeenCalledWith(
			expect.objectContaining({ content: expect.stringContaining('7') }),
		);
	});

	it('owner list is re-checked at button press time', async () => {
		const f = fixture();
		await new ResetCommand().execute(f.interaction);
		owners.isOwner.mockReturnValue(false); // list đổi giữa lúc gọi lệnh và lúc bấm
		const button = press(f.collector);
		await vi.waitFor(() => expect(f.collector.stop).toHaveBeenCalledWith('not-owner'));
		expect(reset.resetAll).not.toHaveBeenCalled();
		expect(button.update).toHaveBeenCalledWith(
			expect.objectContaining({ content: 'Lệnh này chỉ dành cho chủ bot.' }),
		);
	});

	it('empty database short-circuits before showing buttons', async () => {
		const f = fixture();
		reset.countAll.mockResolvedValue(0);
		await new ResetCommand().execute(f.interaction);
		expect(f.i.editReply).toHaveBeenCalledExactlyOnceWith('Không có dữ liệu người chơi nào để reset.');
		expect(f.channel.createMessageComponentCollector).not.toHaveBeenCalled();
	});
});
