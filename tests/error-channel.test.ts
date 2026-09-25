import { describe, expect, it, vi } from 'vitest';
import type { Interaction } from 'discord.js';

vi.mock('../src/shared/utils/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { LootService } from '../src/modules/economy/application/LootService.js';
import { SocketService } from '../src/modules/progression/application/SocketService.js';
import { MenuRouter } from '../src/modules/menu/MenuRouter.js';
import { MenuSessionStore } from '../src/modules/menu/MenuSessionStore.js';
import { menuId } from '../src/modules/menu/menuIds.js';
import { MENU_TEXT } from '../src/shared/ui/text/menu.js';
import { AppError } from '../src/shared/kernel/Result.js';
import type { PersistenceContext } from '../src/shared/kernel/persistence.js';

// In-memory persistence: the tx callback runs directly, no SQL.
function fakePersistence(): PersistenceContext {
	return {
		executor: {} as never,
		unitOfWork: { run: (work: (tx: never) => Promise<never>) => work({} as never) } as never,
	};
}

function fixture(kind: 'command' | 'button', customId = '', userId = 'alice', messageId = 'm1') {
	const i = {
		customId,
		user: { id: userId },
		message: kind === 'command' ? null : { id: messageId },
		values: [] as string[],
		deferred: false,
		replied: false,
		isButton: () => kind === 'button',
		isStringSelectMenu: () => false,
		deferReply: vi.fn(async () => {
			i.deferred = true;
		}),
		deferUpdate: vi.fn(async () => {
			i.deferred = true;
		}),
		editReply: vi.fn(async (_payload: unknown) => {
			i.replied = true;
			return { id: messageId };
		}),
		reply: vi.fn(async (_payload: unknown) => {
			i.replied = true;
		}),
		followUp: vi.fn(async (_payload: unknown) => undefined),
	};
	return { raw: i, interaction: i as unknown as Interaction };
}

describe('unified error channel', () => {
	it('returns err (never throws) for a corrupted rune-bag seed', async () => {
		const loot = new LootService(
			{
				lockBag: async () => ({ lesserRuneBag: 1 }) as never,
				bags: async () => [{ bagKey: 'lb', runePool: [] }] as never,
			} as never,
			undefined,
			{ persistence: fakePersistence() },
		);
		const opened = await loot.openRuneBag('u1', 'lb');
		expect(opened.ok).toBe(false);
		if (!opened.ok) expect(opened.error.code).toBe('LOOT_INVALID_RUNE_POOL');

		const shopped = await loot.shop('u1', 'lb');
		expect(shopped.ok).toBe(false);
	});

	it('returns err (never throws) for a corrupted socket unlock cost tier', async () => {
		const socket = new SocketService(undefined, {
			findSocketInfo: async () => ({ kind: 'weapon', nativeSockets: [null] }) as never,
		} as never, {
			persistence: fakePersistence(),
			queries: {
				lockBag: async () => [{ credux: 100, lesserRuneBag: 0 }] as never,
				findWeaponTier: async () => [{ tier: 'Rare' }] as never,
				findUnlockCost: async () => [{ essenceTier: 'bogus', creduxCost: 1, essenceCost: 1 }] as never,
			} as never,
		});
		const result = await socket.unlock('u1', 'g1');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('SOCKET_INVALID_ESSENCE_TIER');
	});

	it('surfaces AppError messages (not generic failure) when menu open fails', async () => {
		const failing = new MenuRouter(new MenuSessionStore(), {
			render: async () => {
				throw new AppError('MENU_TEST_BOOM', 'boom-specific-message');
			},
			act: async () => ({ kind: 'home' as const }),
		});
		const f = fixture('command');
		await failing.open(f.interaction as never);
		const payload = JSON.stringify(f.raw.editReply.mock.calls[0]![0]);
		expect(payload).toContain('boom-specific-message');

		const broken = new MenuRouter(new MenuSessionStore(), {
			render: async () => {
				throw new Error('raw infra failure');
			},
			act: async () => ({ kind: 'home' as const }),
		});
		const g = fixture('command');
		await broken.open(g.interaction as never);
		expect(JSON.stringify(g.raw.editReply.mock.calls[0]![0])).toContain(MENU_TEXT.failed);
	});

	it('surfaces AppError messages for failed menu button actions', async () => {
		const store = new MenuSessionStore();
		const router = new MenuRouter(store, {
			render: async () => undefined,
			act: async () => {
				throw new AppError('MENU_TEST_ACT', 'act-specific-message');
			},
		});
		const session = store.create('alice');
		store.bind(session, 'm1');
		session.gamePanel = { title: 't', body: 'b', buttons: [{ action: 'daily', label: 'Daily' }] };
		const f = fixture('button', menuId(session.id, session.revision, 'daily'), 'alice', 'm1');
		expect(await router.handle(f.interaction)).toBe(true);
		const payload = JSON.stringify(f.raw.followUp.mock.calls[0]![0]);
		expect(payload).toContain('act-specific-message');
	});
});
