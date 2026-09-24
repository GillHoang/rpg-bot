import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';

vi.mock('../src/db/client.js', () => ({ db: {}, pool: {} }));
vi.mock('../src/shared/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const casino = vi.hoisted(() => ({ start: vi.fn(), act: vi.fn() }));
vi.mock('../src/modules/casino/application/CasinoSessionService.js', () => ({
	CasinoSessionService: class { start = casino.start; act = casino.act; },
}));
import { interactiveCasino } from '../src/modules/casino/presentation/interactiveCasino.js';
import { registerAllCommands } from '../src/app/registerAllCommands.js';
import { CommandRegistry } from '../src/app/CommandRegistry.js';

function fixture() {
	const collector = new EventEmitter() as EventEmitter & { stop: ReturnType<typeof vi.fn> };
	collector.stop = vi.fn((reason: string) => collector.emit('end', [], reason));
	const createMessageComponentCollector = vi.fn(() => collector);
	const i = { user: { id: 'owner' }, deferReply: vi.fn(), editReply: vi.fn().mockResolvedValue({ createMessageComponentCollector }) };
	return { i, interaction: i as unknown as ChatInputCommandInteraction, collector, createMessageComponentCollector };
}
beforeEach(() => {
	vi.clearAllMocks();
	casino.start.mockResolvedValue({ status: 'ok', sessionId: 'session', game: 'blackjack', done: false, text: 'Hand', revision: 0 });
	casino.act.mockResolvedValue({ status: 'ok', sessionId: 'session', game: 'blackjack', done: true, text: 'Settled', revision: 1 });
});

describe('Discord gameplay surface', () => {
	it('serializes all slash commands, including their new subcommands', () => {
		registerAllCommands();
		const commands = CommandRegistry.getInstance().getAll().map(c => c.data.toJSON());
		expect(commands.map(c => c.name)).toEqual(expect.arrayContaining(['inventory', 'deities', 'open', 'runes', 'equip', 'preset', 'raid', 'casino']));
		expect(commands.find(c => c.name === 'casino')?.options?.map(o => o.name)).toEqual(expect.arrayContaining(['blackjack', 'crash', 'coin_toss', 'dice_roll', 'slot_machine', 'baccarat']));
		expect(commands.find(c => c.name === 'raid')?.options?.map(o => o.name)).toEqual(['gates', 'hunt', 'boss']);
		expect(commands.find(c => c.name === 'socket')?.options?.map(o => o.name)).toContain('unlock');
	});
	it('renders revision-bound buttons and a 60 second collector', async () => {
		const f = fixture();
		await interactiveCasino(f.interaction, 'blackjack', 100);
		expect(f.i.deferReply).toHaveBeenCalledOnce();
		expect(f.createMessageComponentCollector).toHaveBeenCalledWith(expect.objectContaining({ time: 60000 }));
		const row = f.i.editReply.mock.calls[0][0].components[0].toJSON();
		expect(row.components.map((b: { custom_id: string }) => b.custom_id)).toEqual(['session:hit:0', 'session:stand:0']);
	});
	it('rejects a different player without calling the game service', async () => {
		const f = fixture();
		await interactiveCasino(f.interaction, 'blackjack', 100);
		const button = { user: { id: 'intruder' }, reply: vi.fn().mockResolvedValue(undefined), deferUpdate: vi.fn(), customId: 'session:hit:0' };
		f.collector.emit('collect', button);
		expect(button.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
		expect(casino.act).not.toHaveBeenCalled();
	});
	it('acknowledges the owner, settles, and removes the buttons', async () => {
		const f = fixture();
		await interactiveCasino(f.interaction, 'blackjack', 100);
		const button = { user: { id: 'owner' }, deferUpdate: vi.fn().mockResolvedValue(undefined), customId: 'session:stand:0' };
		f.collector.emit('collect', button);
		await vi.waitFor(() => expect(f.collector.stop).toHaveBeenCalledWith('settled'));
		expect(button.deferUpdate).toHaveBeenCalledOnce();
		expect(casino.act).toHaveBeenCalledExactlyOnceWith('owner', 'session', 'stand', 0);
		expect(f.i.editReply).toHaveBeenLastCalledWith({ content: 'Settled', components: [] });
	});
	it('auto-resolves timeout and does not leave active buttons', async () => {
		const f = fixture();
		await interactiveCasino(f.interaction, 'crash', 100);
		f.collector.emit('end', [], 'time');
		await vi.waitFor(() => expect(casino.act).toHaveBeenCalledWith('owner', 'session', 'timeout'));
		expect(f.i.editReply).toHaveBeenLastCalledWith({ content: 'Settled', components: [] });
	});
	it('does not open a collector for an immediate natural or insufficient balance', async () => {
		for (const start of [{ status: 'error', text: 'Không đủ Credux.' }, { status: 'ok', sessionId: 's', game: 'blackjack', done: true, text: 'Natural', revision: 0 }]) {
			casino.start.mockResolvedValue(start);
			const f = fixture();
			await interactiveCasino(f.interaction, 'blackjack', 100);
			expect(f.createMessageComponentCollector).not.toHaveBeenCalled();
			expect(f.i.editReply).toHaveBeenCalledWith({ content: start.text, components: [] });
		}
	});
});
