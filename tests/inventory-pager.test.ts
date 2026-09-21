import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction, MessageEditOptions } from 'discord.js';
import type { InventoryService } from '../src/services/InventoryService.js';

const { repo, logger } = vi.hoisted(() => ({
	repo: { bag: vi.fn(), count: vi.fn(), list: vi.fn() },
	logger: { error: vi.fn() },
}));
vi.mock('../src/services/InventoryService.js', () => ({
	InventoryService: class {
		bag = repo.bag;
		count = repo.count;
		list = repo.list;
	},
}));
vi.mock('../src/utils/logger.js', () => ({ logger }));

import { InventoryCommand } from '../src/commands/rpg/InventoryCommand.js';
import { buildInventoryView, INVENTORY_CATEGORIES, parseInventoryAction } from '../src/render/InventoryPager.js';
import { GENERIC_ERROR, NOT_REGISTERED } from '../src/text/common.js';
import { INVENTORY_PAGER_TTL_MS } from '../src/text/inventory.js';

const bag = {
	credux: 100,
	beliefShards: 50,
	silverChest: 1,
	goldChest: 2,
	bossTreasureChest: 0,
	bossGoldenChest: 0,
	epicEssence: 0,
	mythicEssence: 0,
	legendaryEssence: 0,
	supremeEssence: 0,
} as Awaited<ReturnType<InventoryService['bag']>>;

beforeEach(() => {
	vi.resetAllMocks();
	repo.bag.mockResolvedValue(bag);
	repo.count.mockResolvedValue(24);
	repo.list.mockImplementation(async (_id: string, category: string, page: number) => [`${category} page ${page}`]);
});

function buttons(payload: MessageEditOptions) {
	const json = JSON.parse(JSON.stringify(payload));
	return json.components.flatMap(
		(row: { components: { custom_id: string; label: string; disabled?: boolean }[] }) => row.components,
	) as {
		custom_id: string;
		label: string;
		disabled?: boolean;
	}[];
}

async function openInventory(category = 'runes', page = 1) {
	let collect!: (button: ButtonInteraction) => Promise<void>;
	let end!: () => Promise<void>;
	let filter!: (button: ButtonInteraction) => boolean;
	const collector = {
		on: vi.fn((event: string, handler: typeof collect | typeof end) => {
			if (event === 'collect') collect = handler as typeof collect;
			if (event === 'end') end = handler as typeof end;
		}),
	};
	const message = {
		edit: vi.fn().mockResolvedValue(undefined),
		createMessageComponentCollector: vi.fn((options: { filter: typeof filter }) => {
			filter = options.filter;
			return collector;
		}),
	};
	const interaction = {
		user: { id: 'owner' },
		options: { getString: () => category, getInteger: () => page },
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(message),
	};
	await new InventoryCommand().execute(interaction as unknown as ChatInputCommandInteraction);
	let payload = interaction.editReply.mock.calls[0][0] as MessageEditOptions;
	return {
		interaction,
		message,
		get payload() {
			return payload;
		},
		end: () => end(),
		async click(customId: string, userId = 'owner', failUpdate = false) {
			const button = {
				customId,
				user: { id: userId },
				update: vi.fn(async (next: MessageEditOptions) => {
					if (failUpdate) throw new Error('Discord update failed');
					payload = next;
				}),
				reply: vi.fn().mockResolvedValue(undefined),
			};
			const typed = button as unknown as ButtonInteraction;
			if (filter(typed)) await collect(typed);
			return button;
		},
	};
}

describe('production inventory pager', () => {
	it('renders unique component IDs across every category and page', async () => {
		for (const category of INVENTORY_CATEGORIES) {
			for (let total = 1; total <= 4; total++) {
				repo.count.mockResolvedValue(total * 8);
				for (let page = 1; page <= total; page++) {
					const view = await buildInventoryView(repo, 'owner', category, page);
					const ids = buttons({ components: view.rows }).map((button) => button.custom_id);
					expect(new Set(ids).size).toBe(ids.length);
					expect(ids).toContain('inventory:cat:runes');
					if (category !== 'bag' && total > 1)
						expect(ids).toContain(`inventory:page:${category}:${view.page + 1}`);
				}
			}
		}
	});

	it('clamps requested pages and disables navigation at both boundaries', async () => {
		const first = await buildInventoryView(repo, 'owner', 'runes', 0);
		const last = await buildInventoryView(repo, 'owner', 'runes', 999);
		expect(first.page).toBe(1);
		expect(last.page).toBe(3);
		expect(buttons({ components: first.rows }).find((button) => button.label === 'Trước')?.disabled).toBe(true);
		expect(buttons({ components: last.rows }).find((button) => button.label === 'Sau')?.disabled).toBe(true);
		expect(repo.list).toHaveBeenNthCalledWith(1, 'owner', 'runes', 1);
		expect(repo.list).toHaveBeenNthCalledWith(2, 'owner', 'runes', 3);
	});

	it('renders the bag without item pagination and keeps empty inventories on page 1', async () => {
		const bagView = await buildInventoryView(repo, 'owner', 'bag', 99);
		expect(bagView.page).toBe(1);
		expect(bagView.rows).toHaveLength(1);
		expect(bagView.embed.toJSON().description).toContain('Credux: **100**');
		expect(repo.count).not.toHaveBeenCalled();
		expect(repo.list).not.toHaveBeenCalled();
		repo.count.mockResolvedValue(0);
		repo.list.mockResolvedValue([]);
		const empty = await buildInventoryView(repo, 'owner', 'weapons', 20);
		expect(empty.page).toBe(1);
		expect(empty.rows).toHaveLength(1);
		expect(empty.embed.toJSON().description).toBe('Trang trống.');
	});

	it('parses complete category and page actions', () => {
		expect(parseInventoryAction('inventory:cat:runes')).toEqual({ category: 'runes', page: 1 });
		expect(parseInventoryAction('inventory:page:runes:2')).toEqual({ category: 'runes', page: 2 });
	});
});

describe('InventoryCommand collector', () => {
	it('navigates next/previous with rendered IDs and resets the page on category changes', async () => {
		const pager = await openInventory();
		const clickLabel = async (label: string) => {
			const id = buttons(pager.payload).find((button) => button.label === label)!.custom_id;
			const clicked = await pager.click(id);
			expect(clicked.update).toHaveBeenCalledOnce();
		};
		await clickLabel('Sau');
		expect(repo.list).toHaveBeenLastCalledWith('owner', 'runes', 2);
		expect(JSON.stringify(pager.payload)).toContain('Inventory · runes · Trang 2');
		await clickLabel('Trước');
		expect(repo.list).toHaveBeenLastCalledWith('owner', 'runes', 1);
		await clickLabel('Sau');
		await clickLabel('Giáp');
		expect(repo.list).toHaveBeenLastCalledWith('owner', 'armors', 1);
		expect(JSON.stringify(pager.payload)).toContain('Inventory · armors · Trang 1');
		expect(pager.message.createMessageComponentCollector).toHaveBeenCalledWith(
			expect.objectContaining({ time: INVENTORY_PAGER_TTL_MS }),
		);
	});

	it('ignores malformed, legacy and disabled-indicator IDs without reading inventory', async () => {
		const pager = await openInventory();
		vi.clearAllMocks();
		for (const id of [
			'inventory:indicator',
			'inventory:runes:1',
			'inventory:cat:deities',
			'inventory:cat:runes:2',
			'inventory:page:deities:2',
			'inventory:page:runes',
			'inventory:page:runes:',
			'inventory:page:runes:2:extra',
			'inventory:page:runes:NaN',
			'inventory:page:runes:Infinity',
			'inventory:page:runes:0',
			'inventory:page:runes:-1',
			'inventory:page:runes:1.5',
			'inventory:page:runes:1e2',
			'inventory:page:runes:9007199254740992',
			'other:page:runes:2',
		]) {
			const button = await pager.click(id);
			expect(button.update).not.toHaveBeenCalled();
			expect(button.reply).not.toHaveBeenCalled();
		}
		expect(repo.bag).not.toHaveBeenCalled();
		expect(repo.count).not.toHaveBeenCalled();
		expect(repo.list).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
	});

	it('rejects other users at the collector ownership filter', async () => {
		const pager = await openInventory();
		vi.clearAllMocks();
		const button = await pager.click('inventory:page:runes:2', 'stranger');
		expect(button.update).not.toHaveBeenCalled();
		expect(repo.count).not.toHaveBeenCalled();
		expect(repo.list).not.toHaveBeenCalled();
	});

	it('does not create a collector for an unregistered user', async () => {
		repo.bag.mockResolvedValue(null);
		const pager = await openInventory();
		expect(pager.interaction.editReply).toHaveBeenCalledWith(NOT_REGISTERED);
		expect(pager.message.createMessageComponentCollector).not.toHaveBeenCalled();
	});

	it('removes buttons on expiry, retaining the displayed embed', async () => {
		const pager = await openInventory();
		await pager.end();
		expect(pager.message.edit).toHaveBeenCalledWith({ components: [] });
		pager.message.edit.mockRejectedValueOnce(new Error('message expired'));
		await expect(pager.end()).resolves.toBeUndefined();
	});

	it.each(['render', 'update'])('contains %s errors inside the collector', async (failure) => {
		const pager = await openInventory();
		if (failure === 'render') repo.count.mockRejectedValueOnce(new Error('inventory unavailable'));
		const button = await pager.click('inventory:page:runes:2', 'owner', failure === 'update');
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({ customId: 'inventory:page:runes:2' }),
			'inventory-page-failed',
		);
		expect(button.reply).toHaveBeenCalledWith({ content: GENERIC_ERROR, ephemeral: true });
	});
});
