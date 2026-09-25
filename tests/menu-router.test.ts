import { describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ChatInputCommandInteraction, type Interaction } from 'discord.js';

vi.mock('../src/shared/utils/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
import { MenuRouter } from '../src/modules/menu/MenuRouter.js';
import { MenuSessionStore } from '../src/modules/menu/MenuSessionStore.js';
import { MENU_OPEN_ID, menuId, parseMenuId } from '../src/modules/menu/menuIds.js';
import { MENU_TEXT } from '../src/shared/ui/text/menu.js';
import { MenuCommand } from '../src/modules/menu/presentation/MenuCommand.js';

function fixture(kind: 'command' | 'button' | 'select', customId = '', userId = 'alice', messageId = 'm1') {
	const i = {
		customId,
		user: { id: userId },
		message: kind === 'command' ? null : { id: messageId },
		values: [] as string[],
		deferred: false,
		replied: false,
		isButton: () => kind === 'button',
		isStringSelectMenu: () => kind === 'select',
		isModalSubmit: () => false,
		deferReply: vi.fn(async (_payload?: unknown) => {
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
	return { raw: i, interaction: i as unknown as Interaction, command: i as unknown as ChatInputCommandInteraction };
}

function json(payload: unknown): Record<string, unknown> {
	return JSON.parse(JSON.stringify(payload));
}

function ids(payload: unknown): string[] {
	const result: string[] = [];
	function walk(value: unknown) {
		if (!value || typeof value !== 'object') return;
		const obj = value as Record<string, unknown>;
		if (typeof obj.custom_id === 'string') result.push(obj.custom_id);
		Object.values(obj).forEach(walk);
	}
	walk(json(payload));
	return result;
}

function action(payload: unknown, name: string): string {
	const id = ids(payload).find((value) => parseMenuId(value)?.action === name);
	if (!id) throw new Error(`missing action ${name}`);
	return id;
}

async function opened(router: MenuRouter, user = 'alice', message = 'm1') {
	const f = fixture('command', '', user, message);
	await new MenuCommand(router).execute(f.command);
	const view = f.raw.editReply.mock.calls[0]![0];
	return { ...f, view };
}

describe('menu router', () => {
	it('keeps the launcher reusable and binds each reply to its own message', async () => {
		const router = new MenuRouter();
		const root = await opened(router);
		for (let index = 0; index < 7; index++) {
			const click = fixture('button', action(root.view, 'refresh'));
			click.raw.editReply.mockResolvedValueOnce({ id: `child-${index}` });
			await router.handle(click.interaction);
			expect(click.raw.deferReply).toHaveBeenCalledWith();
			expect(click.raw.deferUpdate).not.toHaveBeenCalled();
			const view = click.raw.editReply.mock.calls[0]![0];
			expect(parseMenuId(action(view, 'home'))!.id).not.toBe(parseMenuId(action(root.view, 'refresh'))!.id);
		}
	});

	it('opens a public V2 menu through /menu and leaves legacy interactions alone', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		expect(f.raw.deferReply).toHaveBeenCalledWith();
		expect(json(f.view).flags).toBe(MessageFlags.IsComponentsV2);
		const legacy = fixture('button', 'duel:accept:abc');
		expect(await router.handle(legacy.interaction)).toBe(false);
		expect(legacy.raw.deferUpdate).not.toHaveBeenCalled();
		expect(legacy.raw.reply).not.toHaveBeenCalled();
		expect(await router.handle(f.interaction)).toBe(false);
	});

	it('isolates two sessions for alice/bob and rejects replayed buttons', async () => {
		const router = new MenuRouter();
		const first = await opened(router, 'alice', 'one');
		const second = await opened(router, 'bob', 'two');
		const step = fixture('button', action(first.view, 'refresh'), 'alice', 'one');
		await router.handle(step.interaction);
		const childView = step.raw.editReply.mock.calls[0]![0];
		const other = fixture('button', action(second.view, 'refresh'), 'bob', 'two');
		await router.handle(other.interaction);
		expect(other.raw.editReply).toHaveBeenCalledOnce();
		await router.handle(fixture('button', action(childView, 'refresh'), 'alice', 'one').interaction);
		const stale = fixture('button', action(childView, 'refresh'), 'alice', 'one');
		await router.handle(stale.interaction);
		expect(JSON.stringify(stale.raw.reply.mock.calls)).toContain(MENU_TEXT.stale);
		expect(stale.raw.editReply).not.toHaveBeenCalled();
	});

	it('checks ownership and the source message before acknowledging or rendering', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		for (const [user, message, reason] of [
			['bob', 'm1', MENU_TEXT.forbidden],
			['alice', 'other', MENU_TEXT.invalid],
		] as const) {
			const bad = fixture('button', action(f.view, 'refresh'), user, message);
			await router.handle(bad.interaction);
			expect(JSON.stringify(bad.raw.reply.mock.calls)).toContain(reason);
			expect(bad.raw.deferUpdate).not.toHaveBeenCalled();
			// Error notices must stay ephemeral so nobody can spam the channel
			// by clicking other users' (or stale) menu buttons.
			const payload = bad.raw.reply.mock.calls[0]![0] as { flags?: number };
			expect(payload.flags! & MessageFlags.Ephemeral).toBeTruthy();
		}
	});

	it('navigates home, refresh and back within the new panel', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		const refresh = fixture('button', action(f.view, 'refresh'));
		await router.handle(refresh.interaction);
		const child = refresh.raw.editReply.mock.calls[0]![0];
		expect(JSON.stringify(json(child))).toContain(MENU_TEXT.welcome);
		const home = fixture('button', action(child, 'home'));
		await router.handle(home.interaction);
		expect(JSON.stringify(json(home.raw.editReply.mock.calls[0]![0]))).toContain(MENU_TEXT.welcome);
	});

	it('rejects forged actions and buttons that are not shown on the current screen', async () => {
		const store = new MenuSessionStore();
		const act = vi.fn(async () => ({ kind: 'home' as const }));
		const router = new MenuRouter(store, {
			render: async () => ({ title: 't', body: 'b', buttons: [] }),
			act,
		} as never);
		const session = store.create('alice');
		session.launcher = true;
		session.screen = { kind: 'home' };
		session.gamePanel = { title: 't', body: 'b', buttons: [] };
		store.bind(session, 'm1');
		const forgedAction = fixture('button', menuId(session.id, 0, 'reset' as never), 'alice', 'm1');
		await router.handle(forgedAction.interaction);
		expect(forgedAction.raw.editReply).not.toHaveBeenCalled();
		const notShown = fixture('button', menuId(session.id, 0, 'fight', '2'), 'alice', 'm1');
		await router.handle(notShown.interaction);
		expect(notShown.raw.editReply).not.toHaveBeenCalled();
		expect(act).not.toHaveBeenCalled();
	});

	it('serializes rapid clicks while allowing another session to progress', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		const other = await opened(router, 'bob', 'm2');
		let resolve!: (value: { id: string }) => void;
		const first = fixture('button', action(f.view, 'refresh'));
		first.raw.editReply.mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				}),
		);
		const pending = router.handle(first.interaction);
		await vi.waitFor(() => expect(first.raw.editReply).toHaveBeenCalledOnce());
		const duplicate = fixture('button', action(f.view, 'refresh'));
		await router.handle(duplicate.interaction);
		expect(duplicate.raw.editReply).not.toHaveBeenCalled();
		expect(JSON.stringify(duplicate.raw.reply.mock.calls)).toContain(MENU_TEXT.busy);
		const second = fixture('button', action(other.view, 'refresh'), 'bob', 'm2');
		await router.handle(second.interaction);
		expect(second.raw.editReply).toHaveBeenCalledOnce();
		resolve({ id: 'm1' });
		await pending;
	});

	it('offers a fresh public menu after expiry or restart without replaying the action', async () => {
		let now = 0;
		const router = new MenuRouter(new MenuSessionStore(() => now, 100));
		const f = await opened(router);
		now = 101;
		router.sweep();
		for (const target of [router, new MenuRouter()]) {
			const expired = fixture('button', action(f.view, 'refresh'));
			await target.handle(expired.interaction);
			expect(expired.raw.editReply).not.toHaveBeenCalled();
			expect(ids(expired.raw.reply.mock.calls[0]![0])).toContain(MENU_OPEN_ID);
		}
		const reopen = fixture('button', MENU_OPEN_ID, 'alice', 'new-message');
		await router.handle(reopen.interaction);
		expect(reopen.raw.deferReply).toHaveBeenCalledWith();
	});

	it('closes only its own session and retires its old buttons', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		const close = fixture('button', action(f.view, 'close'));
		await router.handle(close.interaction);
		expect(ids(close.raw.editReply.mock.calls[0]![0])).toEqual([MENU_OPEN_ID]);
		const old = fixture('button', action(f.view, 'refresh'));
		await router.handle(old.interaction);
		expect(old.raw.editReply).not.toHaveBeenCalled();
	});

	it('retires a failed panel while keeping the launcher available', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		const broken = fixture('button', action(f.view, 'refresh'));
		broken.raw.editReply.mockRejectedValueOnce(new Error('network'));
		await router.handle(broken.interaction);
		expect(broken.raw.editReply).toHaveBeenCalledOnce();
		expect(JSON.stringify(broken.raw.followUp.mock.calls)).toContain(MENU_TEXT.failed);
		const retry = fixture('button', action(f.view, 'refresh'));
		await router.handle(retry.interaction);
		expect(retry.raw.deferReply).toHaveBeenCalledOnce();
		expect(retry.raw.editReply).toHaveBeenCalledOnce();
	});

	it('does not render after failed acknowledgement and tolerates failed recovery replies', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		const broken = fixture('button', action(f.view, 'refresh'));
		broken.raw.deferReply.mockRejectedValueOnce(new Error('expired'));
		broken.raw.reply.mockRejectedValueOnce(new Error('expired'));
		await expect(router.handle(broken.interaction)).resolves.toBe(true);
		expect(broken.raw.editReply).not.toHaveBeenCalled();
	});

	it('replaces the deferred loading message if opening fails', async () => {
		const router = new MenuRouter(new MenuSessionStore(Date.now, 10000, 0));
		const f = fixture('command');
		await router.open(f.command);
		expect(JSON.stringify(f.raw.editReply.mock.calls)).toContain(MENU_TEXT.capacity);
		expect(f.raw.followUp).not.toHaveBeenCalled();
	});

	it('carries the viewed gate into child sessions for fight actions', async () => {
		const store = new MenuSessionStore();
		const seen: Array<{ gateId?: number; action: string }> = [];
		const panel = {
			title: 't',
			body: 'b',
			buttons: [{ action: 'fight', label: 'x', value: '2' }],
		};
		const gameplay = {
			render: vi.fn(async () => panel),
			act: vi.fn(async (session: { gateId?: number }, action: string) => {
				seen.push({ gateId: session.gateId, action });
				return { kind: 'gateTiers' as const };
			}),
		};
		const router = new MenuRouter(store, gameplay as never);
		const session = store.create('alice');
		session.launcher = true;
		session.screen = { kind: 'gateTiers' };
		session.gateId = 2;
		session.portalGate = 2;
		session.gamePanel = panel as never;
		store.bind(session, 'm1');
		const click = fixture('button', menuId(session.id, 0, 'fight', '2'), 'alice', 'm1');
		await router.handle(click.interaction);
		expect(gameplay.act).toHaveBeenCalledOnce();
		expect(seen[0]).toEqual({ gateId: 2, action: 'fight' });
	});
});
