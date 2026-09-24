import { describe, expect, it, vi } from 'vitest';
import { MessageFlags, type ChatInputCommandInteraction, type Interaction } from 'discord.js';

vi.mock('../src/shared/utils/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
import { MenuRouter } from '../src/modules/menu/MenuRouter.js';
import { MenuSessionStore } from '../src/modules/menu/MenuSessionStore.js';
import { MENU_OPEN_ID, menuId, parseMenuId } from '../src/modules/menu/menuIds.js';
import { MENU_TEXT } from '../src/shared/ui/text/menu.js';
import { MenuCommand } from '../src/modules/menu/presentation/MenuCommand.js';

function fixture(kind: 'command' | 'button' | 'select' | 'modal', customId = '', userId = 'alice', messageId = 'm1') {
	const i = {
		customId,
		user: { id: userId },
		message: kind === 'command' ? null : { id: messageId },
		values: [] as string[],
		deferred: false,
		replied: false,
		isButton: () => kind === 'button',
		isStringSelectMenu: () => kind === 'select',
		isModalSubmit: () => kind === 'modal',
		isFromMessage: () => kind === 'modal',
		fields: { getTextInputValue: vi.fn().mockReturnValue('rune') },
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
		showModal: vi.fn(async (_payload: unknown) => {
			i.replied = true;
		}),
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
			const click = fixture('button', action(root.view, 'help'));
			click.raw.editReply.mockResolvedValueOnce({ id: `child-${index}` });
			await router.handle(click.interaction);
			expect(click.raw.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
			expect(click.raw.deferUpdate).not.toHaveBeenCalled();
			const view = click.raw.editReply.mock.calls[0]![0];
			expect(parseMenuId(action(view, 'home'))!.id).not.toBe(parseMenuId(action(root.view, 'help'))!.id);
			const topic = fixture('select', action(view, 'topic'), 'alice', `child-${index}`);
			topic.raw.values = ['0'];
			await router.handle(topic.interaction);
			expect(topic.raw.deferUpdate).toHaveBeenCalledOnce();
		}
	});
	it('opens an ephemeral V2 menu through /menu and leaves legacy interactions alone', async () => {
		const router = new MenuRouter();
		const f = await opened(router);
		expect(f.raw.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
		expect(json(f.view).flags).toBe(MessageFlags.IsComponentsV2);
		const legacy = fixture('button', 'duel:accept:abc');
		expect(await router.handle(legacy.interaction)).toBe(false);
		expect(legacy.raw.deferUpdate).not.toHaveBeenCalled();
		expect(legacy.raw.reply).not.toHaveBeenCalled();
		expect(await router.handle(f.interaction)).toBe(false);
	});

	it.each([
		['alice', 'bob'],
		['alice', 'alice'],
	])('isolates two sessions for %s/%s and rejects replayed buttons', async (a, b) => {
		const router = new MenuRouter();
		const first = await opened(router, a, 'one'),
			second = await opened(router, b, 'two');
		const select = fixture('select', action(first.view, 'section'), a, 'one');
		select.raw.values = ['inventory'];
		await router.handle(select.interaction);
		expect(JSON.stringify(json(select.raw.editReply.mock.calls[0]![0]))).toContain('Kho đồ');
		const help = fixture('button', action(second.view, 'help'), b, 'two');
		await router.handle(help.interaction);
		expect(help.raw.editReply).toHaveBeenCalledOnce();
		const childView = select.raw.editReply.mock.calls[0]![0];
		await router.handle(fixture('button', action(childView, 'refresh'), a, 'one').interaction);
		const stale = fixture('button', action(childView, 'refresh'), a, 'one');
		await router.handle(stale.interaction);
		expect(JSON.stringify(stale.raw.reply.mock.calls)).toContain(MENU_TEXT.stale);
		expect(stale.raw.editReply).not.toHaveBeenCalled();
	});

	it('checks ownership and the source message before acknowledging or rendering', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		for (const [user, message, reason] of [
			['bob', 'm1', MENU_TEXT.forbidden],
			['alice', 'other', MENU_TEXT.invalid],
		]) {
			const bad = fixture('button', action(f.view, 'help'), user, message);
			await router.handle(bad.interaction);
			expect(JSON.stringify(bad.raw.reply.mock.calls)).toContain(reason);
			expect(bad.raw.deferUpdate).not.toHaveBeenCalled();
		}
	});

	it('navigates sections, back, and home within the new panel', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		const help = fixture('button', action(f.view, 'help'));
		await router.handle(help.interaction);
		const topic = fixture('select', action(help.raw.editReply.mock.calls[0]![0], 'topic'));
		topic.raw.values = ['0'];
		await router.handle(topic.interaction);
		const back = fixture('button', action(topic.raw.editReply.mock.calls[0]![0], 'back'));
		await router.handle(back.interaction);
		expect(JSON.stringify(json(back.raw.editReply.mock.calls[0]![0]))).toContain(MENU_TEXT.helpIntro);
		const home = fixture('button', action(back.raw.editReply.mock.calls[0]![0], 'home'));
		await router.handle(home.interaction);
		expect(JSON.stringify(json(home.raw.editReply.mock.calls[0]![0]))).toContain(MENU_TEXT.welcome);
	});

	it('opens a modal as the first response and searches after submit', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		const button = fixture('button', action(f.view, 'search'));
		await router.handle(button.interaction);
		expect(button.raw.deferUpdate).not.toHaveBeenCalled();
		expect(button.raw.showModal).toHaveBeenCalledOnce();
		const modalId = json(button.raw.showModal.mock.calls[0]![0]).custom_id as string;
		const modal = fixture('modal', modalId);
		await router.handle(modal.interaction);
		expect(modal.raw.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
		expect(modal.raw.deferUpdate).not.toHaveBeenCalled();
		expect(ids(modal.raw.editReply.mock.calls[0]![0]).some((id) => parseMenuId(id)?.action === 'topic')).toBe(true);
		const replay = fixture('modal', modalId);
		await router.handle(replay.interaction);
		expect(replay.raw.editReply).not.toHaveBeenCalled();
	});

	it('invalidates a modal after navigation and when another modal replaces it', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		const first = fixture('button', action(f.view, 'search'));
		await router.handle(first.interaction);
		const second = fixture('button', action(f.view, 'search'));
		await router.handle(second.interaction);
		const old = fixture('modal', json(first.raw.showModal.mock.calls[0]![0]).custom_id as string);
		await router.handle(old.interaction);
		expect(old.raw.editReply).not.toHaveBeenCalled();
		const navigate = fixture('button', action(f.view, 'help'));
		await router.handle(navigate.interaction);
		const stale = fixture('modal', json(second.raw.showModal.mock.calls[0]![0]).custom_id as string);
		await router.handle(stale.interaction);
		expect(stale.raw.editReply).not.toHaveBeenCalled();
	});

	it.each(['   ', 'a'.repeat(81), 'line\nbreak'])('validates modal input on the server: %j', async (query) => {
		const router = new MenuRouter(),
			f = await opened(router);
		const button = fixture('button', action(f.view, 'search'));
		await router.handle(button.interaction);
		const modal = fixture('modal', json(button.raw.showModal.mock.calls[0]![0]).custom_id as string);
		modal.raw.fields.getTextInputValue.mockReturnValue(query);
		await router.handle(modal.interaction);
		expect(modal.raw.editReply).not.toHaveBeenCalled();
		expect(JSON.stringify(modal.raw.reply.mock.calls)).toContain(MENU_TEXT.invalidSearch);
	});

	it('rejects forged select values and route/type mismatches', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		const parsed = parseMenuId(action(f.view, 'section'))!;
		for (const value of ['__proto__', 'reset', 'unknown']) {
			const select = fixture('select', action(f.view, 'section'));
			select.raw.values = [value];
			await router.handle(select.interaction);
			expect(select.raw.editReply).not.toHaveBeenCalled();
		}
		const topicFromHome = fixture('select', menuId(parsed.id, parsed.revision, 'topic'));
		topicFromHome.raw.values = ['0'];
		await router.handle(topicFromHome.interaction);
		expect(topicFromHome.raw.editReply).not.toHaveBeenCalled();
		const button = fixture('button', action(f.view, 'section'));
		await router.handle(button.interaction);
		expect(button.raw.editReply).not.toHaveBeenCalled();
	});

	it('serializes rapid clicks while allowing another session to progress', async () => {
		const router = new MenuRouter(),
			f = await opened(router),
			other = await opened(router, 'bob', 'm2');
		let resolve!: (value: { id: string }) => void;
		const first = fixture('button', action(f.view, 'help'));
		first.raw.editReply.mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				}),
		);
		const pending = router.handle(first.interaction);
		await vi.waitFor(() => expect(first.raw.editReply).toHaveBeenCalledOnce());
		const duplicate = fixture('button', action(f.view, 'help'));
		await router.handle(duplicate.interaction);
		expect(duplicate.raw.editReply).not.toHaveBeenCalled();
		expect(JSON.stringify(duplicate.raw.reply.mock.calls)).toContain(MENU_TEXT.busy);
		const second = fixture('button', action(other.view, 'help'), 'bob', 'm2');
		await router.handle(second.interaction);
		expect(second.raw.editReply).toHaveBeenCalledOnce();
		resolve({ id: 'm1' });
		await pending;
	});

	it('offers a fresh private menu after expiry or restart without replaying the action', async () => {
		let now = 0;
		const router = new MenuRouter(new MenuSessionStore(() => now, 100));
		const f = await opened(router);
		now = 101;
		router.sweep();
		for (const target of [router, new MenuRouter()]) {
			const expired = fixture('button', action(f.view, 'help'));
			await target.handle(expired.interaction);
			expect(expired.raw.editReply).not.toHaveBeenCalled();
			expect(ids(expired.raw.reply.mock.calls[0]![0])).toContain(MENU_OPEN_ID);
		}
		const reopen = fixture('button', MENU_OPEN_ID, 'alice', 'new-message');
		await router.handle(reopen.interaction);
		expect(reopen.raw.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
	});

	it('closes only its own session and retires its old buttons', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		const close = fixture('button', action(f.view, 'close'));
		await router.handle(close.interaction);
		expect(ids(close.raw.editReply.mock.calls[0]![0])).toEqual([MENU_OPEN_ID]);
		const old = fixture('button', action(f.view, 'help'));
		await router.handle(old.interaction);
		expect(old.raw.editReply).not.toHaveBeenCalled();
	});

	it('retires a failed panel while keeping the launcher available', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		const broken = fixture('button', action(f.view, 'help'));
		broken.raw.editReply.mockRejectedValueOnce(new Error('network'));
		await router.handle(broken.interaction);
		expect(broken.raw.editReply).toHaveBeenCalledOnce();
		expect(JSON.stringify(broken.raw.followUp.mock.calls)).toContain(MENU_TEXT.failed);
		const retry = fixture('button', action(f.view, 'help'));
		await router.handle(retry.interaction);
		expect(retry.raw.deferReply).toHaveBeenCalledOnce();
		expect(retry.raw.editReply).toHaveBeenCalledOnce();
	});

	it('does not render after failed acknowledgement and tolerates failed recovery replies', async () => {
		const router = new MenuRouter(),
			f = await opened(router);
		const broken = fixture('button', action(f.view, 'help'));
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
});
