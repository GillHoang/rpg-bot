import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { InventoryService } from '../src/modules/progression/application/InventoryService.js';
import type { CasinoSessionService } from '../src/modules/casino/application/CasinoSessionService.js';
import type { SocketService } from '../src/modules/progression/application/SocketService.js';
import type { EnhancementService } from '../src/modules/progression/application/EnhancementService.js';

const defaultQuery = vi.hoisted(() =>
	vi.fn(() => {
		throw new Error('Default database must not be used');
	}),
);
vi.mock('../src/db/client.js', () => ({
	db: {
		execute: defaultQuery,
		select: defaultQuery,
		insert: defaultQuery,
		update: defaultQuery,
		delete: defaultQuery,
		transaction: defaultQuery,
	},
	pool: {},
}));
vi.mock('../src/shared/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { BalanceCommand } from '../src/modules/economy/presentation/BalanceCommand.js';
import { PingCommand } from '../src/modules/system/presentation/PingCommand.js';
import { CasinoCommand } from '../src/modules/casino/presentation/CasinoCommand.js';
import { InteractiveCasinoController } from '../src/modules/casino/presentation/interactiveCasino.js';
import { InventoryCommand, DeitiesCommand } from '../src/modules/progression/presentation/InventoryCommand.js';
import { EquipCommand, PresetCommand } from '../src/modules/progression/presentation/LoadoutCommand.js';
import { OpenCommand, RunesCommand } from '../src/modules/progression/presentation/LootCommand.js';
import { EnhanceCommand } from '../src/modules/progression/presentation/EnhanceCommand.js';
import { SocketCommand } from '../src/modules/progression/presentation/SocketCommand.js';
import { MenuCommand } from '../src/modules/menu/presentation/MenuCommand.js';
import { PlayerAccount } from '../src/modules/identity/domain/PlayerAccount.js';
import { HealthService } from '../src/modules/system/application/HealthService.js';

function interaction(options: Record<string, string | number> = {}) {
	const raw = {
		user: { id: 'owner', username: 'Hero' },
		client: { ws: { ping: 12.4 } },
		options: {
			getString: (name: string) => options[name] ?? null,
			getInteger: (name: string) => options[name] ?? null,
			getSubcommand: () => options.sub ?? null,
			getFocused: (full?: boolean) =>
				full ? { name: options.focused ?? 'id', value: options.query ?? '' } : (options.query ?? ''),
		},
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		respond: vi.fn().mockResolvedValue(undefined),
	};
	return {
		raw,
		command: raw as unknown as ChatInputCommandInteraction,
		autocomplete: raw as unknown as AutocompleteInteraction,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});
afterEach(() => {
	expect(defaultQuery).not.toHaveBeenCalled();
	vi.restoreAllMocks();
});

describe('commands accept narrow structural dependencies', () => {
	it('uses the supplied inventory reads for both inventory commands', async () => {
		const inventory = {
			bag: vi.fn<InventoryService['bag']>().mockResolvedValue(null),
			count: vi.fn<InventoryService['count']>(),
			list: vi.fn<InventoryService['list']>().mockResolvedValue(['Injected deity']),
		};
		const missing = interaction();
		await new InventoryCommand(inventory).execute(missing.command);
		expect(inventory.bag).toHaveBeenCalledExactlyOnceWith('owner');
		expect(inventory.count).not.toHaveBeenCalled();
		const deities = interaction({ page: 2 });
		await new DeitiesCommand({ list: inventory.list }).execute(deities.command);
		expect(inventory.list).toHaveBeenCalledExactlyOnceWith('owner', 'deities', 2);
		expect(JSON.stringify(deities.raw.editReply.mock.calls[0][0])).toContain('Injected deity');
	});

	it('uses injected equipment services and category-specific autocomplete queries', async () => {
		const loadout = { equip: vi.fn(async () => 'Equipped') };
		const inventory = {
			searchWeapons: vi.fn<InventoryService['searchWeapons']>().mockResolvedValue([]),
			searchArmors: vi
				.fn<InventoryService['searchArmors']>()
				.mockResolvedValue([{ id: 'a1', name: 'Armor', tier: 'Common', plus: 0, equipped: true }]),
			searchDeities: vi
				.fn<InventoryService['searchDeities']>()
				.mockResolvedValue([{ id: 5, name: 'Zeus', tier: 'Epic' }]),
		};
		const equip = new EquipCommand(loadout, inventory);
		const command = interaction({ kind: 'armor', id: 'a1', preset: 2 });
		await equip.execute(command.command);
		expect(loadout.equip).toHaveBeenCalledExactlyOnceWith('owner', 'armor', 'a1', 2);
		expect(command.raw.editReply).toHaveBeenCalledWith('Equipped');
		const armor = interaction({ kind: 'armor', query: 'Arm' });
		await equip.autocomplete(armor.autocomplete);
		expect(inventory.searchArmors).toHaveBeenCalledExactlyOnceWith('owner', 'Arm');
		expect(armor.raw.respond).toHaveBeenCalledWith([{ name: 'Armor +0 (Common) — a1 · đang dùng', value: 'a1' }]);
		const deity = interaction({ kind: 'deity', query: 'Ze' });
		await equip.autocomplete(deity.autocomplete);
		expect(inventory.searchDeities).toHaveBeenCalledExactlyOnceWith('owner', 'Ze');
		expect(inventory.searchWeapons).not.toHaveBeenCalled();
		const presets = { switch: vi.fn(async () => 'Preset switched') };
		const preset = interaction({ slot: 2 });
		await new PresetCommand(presets).execute(preset.command);
		expect(presets.switch).toHaveBeenCalledExactlyOnceWith('owner', 2);
	});

	it('routes chest and rune operations through injected use cases', async () => {
		const loot = {
			open: vi.fn(async () => 'Chest loot'),
			openRuneBag: vi.fn(async () => 'Rune loot'),
			shop: vi.fn(async () => 'Rune shop'),
		};
		const chest = interaction({ chest: 'silver', count: 3 });
		await new OpenCommand({ open: loot.open }).execute(chest.command);
		expect(loot.open).toHaveBeenCalledExactlyOnceWith('owner', 'silver', 3);
		expect(JSON.stringify(chest.raw.editReply.mock.calls[0][0])).toContain('Chest loot');
		const runes = new RunesCommand({ openRuneBag: loot.openRuneBag, shop: loot.shop });
		await runes.execute(interaction({ sub: 'open', bag: 'lb' }).command);
		expect(loot.openRuneBag).toHaveBeenCalledExactlyOnceWith('owner', 'lb');
		await runes.execute(interaction({ sub: 'shop' }).command);
		expect(loot.shop).toHaveBeenCalledExactlyOnceWith('owner', undefined);
	});

	it('uses the injected account and bag readers without creating a default repository', async () => {
		const economy = { getAccount: vi.fn(async () => new PlayerAccount('owner', 'Hero', 1, 0, 'Knight', 200)) };
		const inventory = { bag: vi.fn<InventoryService['bag']>().mockResolvedValue(null) };
		const i = interaction();
		await new BalanceCommand(economy, inventory).execute(i.command);
		expect(economy.getAccount).toHaveBeenCalledExactlyOnceWith('owner');
		expect(inventory.bag).toHaveBeenCalledExactlyOnceWith('owner');
		expect(i.raw.editReply.mock.calls[0][0]).toContain('200');
	});

	it('uses injected enhancement/socket actions and autocomplete inventory', async () => {
		const inventory = {
			searchWeapons: vi
				.fn<InventoryService['searchWeapons']>()
				.mockResolvedValue([{ id: 'w1', name: 'Sword', tier: 'Common', plus: 0, equipped: false }]),
			searchArmors: vi.fn<InventoryService['searchArmors']>().mockResolvedValue([]),
			searchRunes: vi
				.fn<InventoryService['searchRunes']>()
				.mockResolvedValue([{ uid: 'r1', name: 'Rune', tier: 'Epic', socketedInto: null }]),
		};
		const enhancement = {
			attempt: vi.fn<EnhancementService['attempt']>().mockResolvedValue({ status: 'not-found' }),
		};
		const enhance = new EnhanceCommand(enhancement, inventory);
		await enhance.execute(interaction({ gear_id: 'w1' }).command);
		expect(enhancement.attempt).toHaveBeenCalledExactlyOnceWith('owner', 'w1');
		const gear = interaction({ focused: 'gear_id', query: 'sw' });
		await enhance.autocomplete(gear.autocomplete);
		expect(inventory.searchWeapons).toHaveBeenCalledExactlyOnceWith('owner', 'sw');
		expect(inventory.searchArmors).toHaveBeenCalledExactlyOnceWith('owner', 'sw');
		expect(gear.raw.respond).toHaveBeenCalledWith([{ name: 'Sword +0 (Common) — w1', value: 'w1' }]);
		const sockets = {
			equip: vi.fn<SocketService['equip']>().mockResolvedValue({ status: 'ok' }),
			unequip: vi.fn<SocketService['unequip']>().mockResolvedValue({ status: 'ok' }),
			unlock: vi.fn<SocketService['unlock']>().mockResolvedValue('Unlocked'),
		};
		const socket = new SocketCommand(sockets, inventory);
		await socket.execute(
			interaction({ sub: 'equip', rune_uid: 'r1', gear_id: 'w1', slot_num: 1, lane: 'native' }).command,
		);
		expect(sockets.equip).toHaveBeenCalledExactlyOnceWith('owner', 'r1', 'w1', 1, 'native');
		const rune = interaction({ focused: 'rune_uid', query: 'ru' });
		await socket.autocomplete(rune.autocomplete);
		expect(inventory.searchRunes).toHaveBeenCalledExactlyOnceWith('owner', 'ru');
		expect(rune.raw.respond).toHaveBeenCalledWith([{ name: 'Rune (Epic) — r1 · rảnh', value: 'r1' }]);
	});

	it('accepts a menu opener without requiring a concrete router', async () => {
		const router = { open: vi.fn(async () => {}) };
		const i = interaction();
		await new MenuCommand(router).execute(i.command);
		expect(router.open).toHaveBeenCalledExactlyOnceWith(i.command);
	});

	it('uses only the selected casino collaborator', async () => {
		const casino = { play: vi.fn(async () => ({ status: 'not-registered' as const })) };
		const interactive = { execute: vi.fn(async () => {}) };
		const command = new CasinoCommand(casino, interactive);
		const blackjack = interaction({ sub: 'blackjack', bet: 100 });
		await command.execute(blackjack.command);
		expect(interactive.execute).toHaveBeenCalledExactlyOnceWith(blackjack.command, 'blackjack', 100);
		expect(casino.play).not.toHaveBeenCalled();
		await command.execute(interaction({ sub: 'coin_toss', bet: 50, choice: 'heads' }).command);
		expect(casino.play).toHaveBeenCalledExactlyOnceWith('owner', 'coin_toss', 50, 'heads');
		expect(interactive.execute).toHaveBeenCalledTimes(1);
	});

	it('preserves ping output and failure handling through an injected health port', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(100);
		const health = { checkDatabase: vi.fn(async () => {}) };
		const command = new PingCommand(health);
		const ok = interaction();
		await command.execute(ok.command);
		expect(health.checkDatabase).toHaveBeenCalledOnce();
		expect(ok.raw.editReply).toHaveBeenCalledWith('WebSocket: **12ms**\nREST API: **0ms**\nPostgreSQL: **0ms**');
		health.checkDatabase.mockRejectedValueOnce(new Error('offline'));
		const failed = interaction();
		await command.execute(failed.command);
		expect(failed.raw.editReply).toHaveBeenCalledWith(
			'WebSocket: **12ms**\nREST API: **0ms**\nPostgreSQL: **Không kết nối được DB (0ms)**',
		);
	});

	it('probes only the database passed to HealthService', async () => {
		const execute = vi.fn(async () => ({ rows: [] }));
		const health = new HealthService({ execute });
		await health.checkDatabase();
		expect(execute).toHaveBeenCalledOnce();
		execute.mockRejectedValueOnce(new Error('offline'));
		await expect(health.checkDatabase()).rejects.toThrow('offline');
	});
});

describe('injected interactive casino controller', () => {
	it('keeps owner checks, revision-bound actions and settlement on the supplied session port', async () => {
		const sessions = {
			start: vi.fn<CasinoSessionService['start']>().mockResolvedValue({
				status: 'ok',
				sessionId: 'injected',
				game: 'blackjack',
				done: false,
				text: 'Hand',
				revision: 2,
			}),
			act: vi.fn<CasinoSessionService['act']>().mockResolvedValue({
				status: 'ok',
				sessionId: 'injected',
				game: 'blackjack',
				done: true,
				text: 'Settled',
				revision: 3,
			}),
		};
		const collector = new EventEmitter() as EventEmitter & { stop: ReturnType<typeof vi.fn> };
		collector.stop = vi.fn((reason: string) => collector.emit('end', [], reason));
		const createMessageComponentCollector = vi.fn(() => collector);
		const i = interaction();
		i.raw.editReply.mockResolvedValue({ createMessageComponentCollector });
		await new InteractiveCasinoController(sessions).execute(i.command, 'blackjack', 100);
		expect(sessions.start).toHaveBeenCalledExactlyOnceWith('owner', 'blackjack', 100);
		expect(createMessageComponentCollector).toHaveBeenCalledWith(expect.objectContaining({ time: 60000 }));
		expect(JSON.stringify(i.raw.editReply.mock.calls[0][0])).toContain('injected:stand:2');
		collector.emit('collect', { user: { id: 'stranger' }, reply: vi.fn().mockResolvedValue(undefined) });
		expect(sessions.act).not.toHaveBeenCalled();
		collector.emit('collect', {
			user: { id: 'owner' },
			deferUpdate: vi.fn().mockResolvedValue(undefined),
			customId: 'injected:stand:2',
		});
		await vi.waitFor(() => expect(collector.stop).toHaveBeenCalledWith('settled'));
		expect(sessions.act).toHaveBeenCalledExactlyOnceWith('owner', 'injected', 'stand', 2);
		expect(i.raw.editReply).toHaveBeenLastCalledWith({ content: 'Settled', components: [] });
	});
});
