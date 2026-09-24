import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';
import { and, eq } from 'drizzle-orm';
import type { ChatInputCommandInteraction, Interaction } from 'discord.js';

vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
vi.mock('../src/utils/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { MenuGameplayService } from '../src/modules/menu/MenuGameplayService.js';
import { MenuRouter } from '../src/modules/menu/MenuRouter.js';
import { MenuSessionStore } from '../src/modules/menu/MenuSessionStore.js';
import { menuId, parseMenuId } from '../src/modules/menu/menuIds.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { ClaimDailyUseCase } from '../src/modules/economy/application/ClaimDailyUseCase.js';
import { RaidService } from '../src/modules/pve/application/RaidService.js';
import { QuestService } from '../src/modules/meta/application/QuestService.js';
import { ReputationService } from '../src/modules/meta/application/ReputationService.js';
import { DailyCycle } from '../src/shared/utils/dailyCycle.js';
import { subscribeDomainEvents } from '../src/app/events.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { MOB_SEED } from '../src/modules/pve/seed/mobs.js';
import { COSMETIC_SEED } from '../src/modules/meta/seed/cosmetics.js';
import { TITLE_SEED } from '../src/modules/meta/seed/titles.js';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { MonsterEncounterService } from '../src/modules/pve/application/MonsterEncounterService.js';
import { findGateTier } from '../src/shared/config/portals.js';

let id: string;
let sequence = 0;
beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
	await db.insert(s.mobRoster).values(MOB_SEED);
	await db.insert(s.cosmeticCatalog).values(COSMETIC_SEED.map((c) => ({ ...c, isActive: true })));
	await db.insert(s.titleCatalog).values(TITLE_SEED);
	subscribeDomainEvents();
}, 30000);
afterAll(async () => {
	await pool.end();
});
beforeEach(() => {
	vi.restoreAllMocks();
	id = `menu-${++sequence}`;
});
const start = () => new StartService().start(id, id, 'Knight');
const bag = async () => (await db.select().from(s.usersBag).where(eq(s.usersBag.discordId, id)))[0];

function fixture(kind: 'command' | 'button' | 'select', customId = '', values: string[] = []) {
	const raw = {
		user: { id, username: id, displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' },
		message: { id: 'message' },
		customId,
		values,
		deferred: false,
		replied: false,
		isButton: () => kind === 'button',
		isStringSelectMenu: () => kind === 'select',
		isModalSubmit: () => false,
		deferReply: vi.fn(async () => {
			raw.deferred = true;
		}),
		deferUpdate: vi.fn(async () => {
			raw.deferred = true;
		}),
		editReply: vi.fn(async (_payload: unknown) => ({ id: 'message' })),
		reply: vi.fn(async (_payload: unknown) => {}),
		followUp: vi.fn(async (_payload: unknown) => {}),
	};
	return { raw, interaction: raw as unknown as Interaction, command: raw as unknown as ChatInputCommandInteraction };
}
function action(payload: unknown, name: string, value?: string): string {
	const json = JSON.stringify(payload);
	const ids = [...json.matchAll(/"custom_id":"([^"]+)"/g)].map((m) => m[1]);
	const result = ids.find((id) => {
		const parsed = parseMenuId(id);
		return parsed?.action === name && (value === undefined || parsed.nonce === value);
	});
	if (!result) throw new Error(`Missing ${name}: ${json}`);
	return result;
}
function checkPayload(payload: unknown) {
	const json = JSON.parse(JSON.stringify(payload));
	const ids: string[] = [];
	let count = 0,
		length = 0;
	function walk(node: {
		type?: number;
		custom_id?: string;
		content?: string;
		components?: unknown[];
		accessory?: unknown;
	}) {
		if (node.type) count++;
		if (node.custom_id) ids.push(node.custom_id);
		if (node.content) length += node.content.length;
		if (node.type === 1) expect(node.components!.length).toBeLessThanOrEqual(5);
		node.components?.forEach((child) => walk(child as typeof node));
		if (node.accessory) walk(node.accessory as typeof node);
	}
	walk(json);
	expect(count).toBeLessThanOrEqual(40);
	expect(length).toBeLessThanOrEqual(4000);
}

describe('phase 2 menu', () => {
	it.each([
		{ gate: 1, tier: 2, outcome: 'player_win' as const, label: 'Tầng tiếp theo', next: 3 },
		{ gate: 1, tier: 2, outcome: 'enemy_win' as const, label: 'Đánh lại tầng này', next: 2 },
		{ gate: 1, tier: 2, outcome: 'draw' as const, label: 'Đánh lại tầng này', next: 2 },
		{ gate: 1, tier: 10, outcome: 'player_win' as const, label: 'Gate tiếp theo', next: 0 },
		{ gate: 5, tier: 10, outcome: 'player_win' as const, label: undefined, next: 0 },
	])('continues gate $gate tier $tier after $outcome', async ({ gate, tier, outcome, label, next }) => {
		await start();
		await db
			.update(s.userCharacter)
			.set({
				combatLevel: 75,
				gate1TiersCleared: 10,
				gate2TiersCleared: 10,
				gate3TiersCleared: 10,
				gate4TiersCleared: 10,
				gate5TiersCleared: 10,
			})
			.where(eq(s.userCharacter.discordId, id));
		vi.spyOn(BattleEngine.prototype, 'resolve').mockReturnValue({
			outcome,
			rounds: 1,
			log: [],
			roundLogs: [],
			playerHpRemaining: 1,
			enemyHpRemaining: 0,
		});
		const run = vi.spyOn(RaidService.prototype, 'run');
		const game = new MenuGameplayService();
		const session = new MenuSessionStore().create(id);
		session.screen = { kind: 'gateTiers' };
		session.gateId = gate;
		session.screen = await game.act(session, 'fight', id, String(tier));
		expect(session.battle?.portal).toEqual({ gate, tier });
		const panel = await game.render(session);
		expect(panel?.buttons.find((b) => b.action === 'continue')?.label).toBe(label);
		if (!label) return;
		session.revision++;
		if (next) {
			// A cooldown attempt keeps the completed battle as the source of the next target.
			session.screen = await game.act(session, 'continue', id);
			expect(session.battle?.portal).toEqual({ gate, tier });
			await db.delete(s.huntCooldowns).where(eq(s.huntCooldowns.discordId, id));
			session.revision++;
		}
		session.screen = await game.act(session, 'continue', id);
		if (next) {
			expect(run).toHaveBeenLastCalledWith(id, false, expect.objectContaining({ gate, tier: next }));
			expect(session.battle?.portal).toEqual({ gate, tier: next });
		} else {
			expect(session.screen.kind).toBe('gateTiers');
			expect(session.gateId).toBe(gate + 1);
			expect(run).toHaveBeenCalledTimes(1);
		}
	});

	it('opens gates on every hunt entry and fights only the clicked unlocked tier', async () => {
		await start();
		await db
			.update(s.userCharacter)
			.set({ combatLevel: 15, gate1TiersCleared: 3, gate2TiersCleared: 1 })
			.where(eq(s.userCharacter.discordId, id));
		const run = vi.spyOn(RaidService.prototype, 'run');
		const router = new MenuRouter(undefined, new MenuGameplayService());
		const open = fixture('command');
		await router.open(open.command);
		const home = open.raw.editReply.mock.calls[0][0];
		const entry = fixture('button', action(home, 'hunt'));
		await router.handle(entry.interaction);
		const gates = entry.raw.editReply.mock.calls[0][0];
		checkPayload(gates);
		expect(run).not.toHaveBeenCalled();
		const choose = fixture('button', action(gates, 'gate', '2'));
		await router.handle(choose.interaction);
		const tiers = choose.raw.editReply.mock.calls[0][0];
		checkPayload(tiers);
		expect(JSON.stringify(tiers)).toContain('Gate 2');
		expect(JSON.stringify(tiers)).toContain('Đánh tầng 10');
		const locked = fixture('button', action(tiers, 'fight', '3'));
		await router.handle(locked.interaction);
		expect(locked.raw.reply).toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
		const fight = fixture('button', action(tiers, 'fight', '2'));
		await router.handle(fight.interaction);
		expect(run).toHaveBeenCalledExactlyOnceWith(id, false, expect.objectContaining({ gate: 2, tier: 2 }));
		const reopen = fixture('button', action(home, 'hunt'));
		await router.handle(reopen.interaction);
		const fresh = reopen.raw.editReply.mock.calls[0][0];
		expect(action(fresh, 'gate', '1')).toBeTruthy();
		expect(JSON.stringify(fresh)).not.toContain('Đánh tầng');
		expect(run).toHaveBeenCalledTimes(1);
	});

	it.each([
		{ options: { gate: 2 }, cleared: [10, 3, 0, 0, 0], gate: 2, tier: 4 },
		{ options: { tier: 3 }, cleared: [10, 3, 0, 0, 0], gate: 2, tier: 3 },
		{ options: { gate: 2, tier: 2 }, cleared: [10, 3, 0, 0, 0], gate: 2, tier: 2 },
		{ options: {}, cleared: [10, 10, 10, 10, 10], gate: 1, tier: 10 },
		{ options: { gate: 2 }, cleared: [10, 10, 0, 0, 0], gate: 2, tier: 10 },
	])('resolves portal selection $options to gate $gate tier $tier', async ({ options, cleared, gate, tier }) => {
		await start();
		await db
			.update(s.userCharacter)
			.set({
				combatLevel: 75,
				gate1TiersCleared: cleared[0],
				gate2TiersCleared: cleared[1],
				gate3TiersCleared: cleared[2],
				gate4TiersCleared: cleared[3],
				gate5TiersCleared: cleared[4],
			})
			.where(eq(s.userCharacter.discordId, id));
		const pick = vi.spyOn(MonsterEncounterService.prototype, 'pickForLevel');
		vi.spyOn(BattleEngine.prototype, 'resolve').mockReturnValue({
			outcome: 'player_win',
			rounds: 1,
			log: [],
			roundLogs: [],
			playerHpRemaining: 1,
			enemyHpRemaining: 0,
		});
		const raid = new RaidService();
		expect((await raid.run(id, false, { ...options, requestId: 'portal-replay' })).status).toBe('ok');
		expect(pick.mock.calls[0][1]).toBe(findGateTier(gate, tier)!.level);
		const [character] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(character[gate === 1 ? 'gate1TiersCleared' : 'gate2TiersCleared']).toBe(
			Math.max(cleared[gate - 1], tier),
		);
		// Receipt protection must work independently of the cooldown.
		await db.delete(s.huntCooldowns).where(eq(s.huntCooldowns.discordId, id));
		expect((await raid.run(id, false, { ...options, requestId: 'portal-replay' })).status).toBe(
			'already-processed',
		);
		expect(pick).toHaveBeenCalledTimes(1);
	});

	it('rejects invalid and locked gate attempts without consuming cooldown or writing rewards', async () => {
		await start();
		const before = await bag();
		const raid = new RaidService();
		for (const options of [
			{ gate: 6 },
			{ gate: 2 },
			{ gate: 1, tier: 2 },
			{ gate: 1, tier: 0 },
			{ gate: 1, tier: 11 },
		]) {
			expect((await raid.run(id, false, { ...options, requestId: 'invalid-attempt' })).status).toBe(
				'portal-locked',
			);
		}
		expect(await bag()).toEqual(before);
		expect(await db.select().from(s.huntCooldowns).where(eq(s.huntCooldowns.discordId, id))).toHaveLength(0);
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(0);
		expect(await db.select().from(s.menuActionReceipts).where(eq(s.menuActionReceipts.discordId, id))).toHaveLength(
			0,
		);
	});
	it('refreshes onboarding in place and keeps class selection bound to the same message', async () => {
		const router = new MenuRouter(undefined, new MenuGameplayService());
		const open = fixture('command');
		await router.open(open.command);
		const refresh = fixture('button', action(open.raw.editReply.mock.calls[0][0], 'refresh'));
		await router.handle(refresh.interaction);
		expect(refresh.raw.deferUpdate).toHaveBeenCalledOnce();
		expect(refresh.raw.deferReply).not.toHaveBeenCalled();
		const select = fixture('select', action(refresh.raw.editReply.mock.calls[0][0], 'class'), ['Knight']);
		await router.handle(select.interaction);
		expect(select.raw.editReply).toHaveBeenCalledOnce();
	});
	it.each([
		[10, 1],
		[7, 3],
	])('advances past tier %i/%i after winning without returning to the lobby', async (level, cleared) => {
		await start();
		await db
			.update(s.userCharacter)
			.set({ combatLevel: level, gate1TiersCleared: cleared })
			.where(eq(s.userCharacter.discordId, id));
		vi.spyOn(BattleEngine.prototype, 'resolve').mockReturnValue({
			outcome: 'player_win',
			rounds: 1,
			log: [],
			roundLogs: [],
			playerHpRemaining: 1,
			enemyHpRemaining: 0,
		});
		const game = new MenuGameplayService();
		const session = new MenuSessionStore().create(id);
		session.screen = { kind: 'gateTiers' };
		session.gateId = 1;
		await game.render(session);
		expect(session.portalGate).toBe(cleared + 1);
		session.screen = await game.act(session, 'fight', id, String(cleared + 1));
		expect(session.screen.kind).toBe('result');
		if (cleared === 3) {
			const lobbySession = { ...session, screen: { kind: 'gateTiers' } as const };
			const lobby = await game.render(lobbySession);
			expect(lobbySession.portalGate).toBe(5);
			expect(lobby?.buttons.find((button) => button.action === 'fight' && button.value === '5')?.disabled).toBe(
				false,
			);
		}
		await db.delete(s.huntCooldowns).where(eq(s.huntCooldowns.discordId, id));
		session.revision++;
		session.screen = await game.act(session, 'hunt', id);
		expect(session.screen.kind).toBe('gateSelect');
		expect(session.gateId).toBeUndefined();
		expect(session.portalGate).toBeUndefined();
		session.screen = await game.act(session, 'gate', id, '1');
		session.screen = await game.act(session, 'fight', id, String(cleared + 2));
		const [character] = await db.select().from(s.userCharacter).where(eq(s.userCharacter.discordId, id));
		expect(character.gate1TiersCleared).toBe(cleared + 2);
	});
	it('claims daily in the launcher message and keeps other buttons opening separate replies', async () => {
		await start();
		const router = new MenuRouter(undefined, new MenuGameplayService());
		const open = fixture('command');
		await router.open(open.command);
		const initial = open.raw.editReply.mock.calls[0][0];
		const daily = fixture('button', action(initial, 'daily'));
		await router.handle(daily.interaction);
		expect(daily.raw.deferUpdate).toHaveBeenCalledOnce();
		expect(daily.raw.deferReply).not.toHaveBeenCalled();
		const updated = daily.raw.editReply.mock.calls[0][0];
		expect(JSON.stringify(updated)).toContain('Đã nhận daily');
		expect(parseMenuId(action(updated, 'profile'))!.id).toBe(parseMenuId(action(initial, 'profile'))!.id);
		let view = updated;
		for (const name of ['quests', 'reroll', 'cancel', 'refresh', 'home']) {
			const click = fixture('button', action(view, name));
			await router.handle(click.interaction);
			expect(click.raw.deferUpdate).toHaveBeenCalledOnce();
			expect(click.raw.deferReply).not.toHaveBeenCalled();
			view = click.raw.editReply.mock.calls[0][0];
			expect(parseMenuId(action(view, 'home'))!.id).toBe(parseMenuId(action(initial, 'profile'))!.id);
		}
		const profile = fixture('button', action(view, 'profile'));
		await router.handle(profile.interaction);
		expect(profile.raw.deferReply).toHaveBeenCalledOnce();
		expect(profile.raw.deferUpdate).not.toHaveBeenCalled();
	});
	it('requires confirmation for boss, allows cancel, and rejects changed balances', async () => {
		await start();
		await db.update(s.userCharacter).set({ combatLevel: 10 }).where(eq(s.userCharacter.discordId, id));
		await db.update(s.usersBag).set({ credux: 10000 }).where(eq(s.usersBag.discordId, id));
		const router = new MenuRouter(undefined, new MenuGameplayService());
		const open = fixture('command');
		await router.open(open.command);
		let view = open.raw.editReply.mock.calls[0][0];
		const click = async (name: string) => {
			const f = fixture('button', action(view, name));
			await router.handle(f.interaction);
			expect(f.raw.editReply).toHaveBeenCalledOnce();
			view = f.raw.editReply.mock.calls[0][0];
			checkPayload(view);
		};
		await click('boss');
		expect(JSON.stringify(view)).toContain('10.000');
		expect((await bag()).credux).toBe(10000);
		await click('cancel');
		expect((await bag()).credux).toBe(10000);
		await click('boss');
		await db.update(s.usersBag).set({ credux: 0 }).where(eq(s.usersBag.discordId, id));
		await click('confirm');
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(0);
		await db.update(s.usersBag).set({ credux: 10000 }).where(eq(s.usersBag.discordId, id));
		await click('refresh');
		await click('boss');
		await click('confirm');
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(1);
		const bossPayload = JSON.parse(JSON.stringify(view));
		expect(bossPayload.components).toHaveLength(2);
		expect(bossPayload.components[1].components).toHaveLength(1);
		expect(parseMenuId(bossPayload.components[1].components[0].custom_id)?.action).toBe('home');
		expect(JSON.stringify(view)).toContain('HP');
		expect(JSON.stringify(view)).not.toContain('Xem nhật ký');
		await click('home');
		await click('inventory');
		expect(JSON.stringify(view)).toContain('Kho đồ');
	});

	it('keeps completed quests when rerolling and does not write on cancellation', async () => {
		await start();
		const game = new MenuGameplayService();
		const session = new MenuSessionStore().create(id);
		const quests = new QuestService();
		const before = (await quests.snapshot(id))!;
		await db.update(s.dailyQuests).set({ completed: true }).where(eq(s.dailyQuests.id, before.dailies[0].id));
		session.screen = { kind: 'quests' };
		session.screen = await game.act(session, 'reroll', id);
		expect((await game.render(session))!.body).toContain('Tiến độ');
		session.screen = await game.act(session, 'cancel', id);
		expect((await quests.snapshot(id))!.refreshAvailable).toBe(true);
		session.screen = await game.act(session, 'reroll', id);
		await game.act(session, 'confirm', id);
		const after = (await quests.snapshot(id))!;
		expect(after.refreshAvailable).toBe(false);
		expect(after.dailies).toHaveLength(3);
		expect(after.dailies.some((q) => q.id === before.dailies[0].id && q.completed)).toBe(true);
	});

	it('keeps journal pagination aligned to rounds even for very long logs', async () => {
		const session = new MenuSessionStore().create(id);
		const game = new MenuGameplayService();
		const longLine = '🔥'.repeat(4000) + 'END';
		session.battle = {
			status: 'ok',
			boss: false,
			monsterName: 'Test',
			credux: 0,
			shards: 0,
			expGained: 0,
			gotChest: false,
			chestName: '',
			gearDrop: null,
			progress: { previousLevel: 1, newLevel: 1, leveledUp: false },
			battle: {
				outcome: 'draw',
				rounds: 1,
				log: [longLine],
				playerHpRemaining: 1,
				enemyHpRemaining: 1,
				roundLogs: [{ round: 1, lines: [longLine], playerHp: 1, playerMaxHp: 1, enemyHp: 1, enemyMaxHp: 1 }],
			},
		};
		session.screen = { kind: 'log', page: 0 };
		const panel = (await game.render(session))!;
		expect(panel.buttons.find((b) => b.action === 'next')!.disabled).toBe(true);
		expect(panel.buttons.find((b) => b.action === 'last')!.disabled).toBe(true);
		expect(await game.act(session, 'next', id)).toEqual({ kind: 'log', page: 0 });
	});

	it('does not create an account when starter seed is missing', async () => {
		const { GearRepository } = await import('../src/modules/progression/infrastructure/GearRepository.js');
		vi.spyOn(GearRepository.prototype, 'findWeaponRosterIdByName').mockResolvedValueOnce(null);
		expect((await start()).status).toBe('starter-gear-missing');
		expect(await bag()).toBeUndefined();
		expect(await db.select().from(s.users).where(eq(s.users.discordId, id))).toHaveLength(0);
	});
	it('plays onboarding → daily → quest → hunt → paginated log using only /menu', async () => {
		const router = new MenuRouter(undefined, new MenuGameplayService());
		const open = fixture('command');
		await router.open(open.command);
		let view = open.raw.editReply.mock.calls[0][0];
		const click = async (name: string, value?: string) => {
			const f = fixture(value ? 'select' : 'button', action(view, name), value ? [value] : []);
			await router.handle(f.interaction);
			expect(f.raw.deferUpdate.mock.calls.length + f.raw.deferReply.mock.calls.length).toBe(1);
			expect(f.raw.editReply).toHaveBeenCalledOnce();
			view = f.raw.editReply.mock.calls[0][0];
			checkPayload(view);
			return f;
		};
		checkPayload(view);
		await click('class', 'Knight');
		expect(JSON.stringify(view)).toContain('Tạo nhân vật');
		const confirm = action(view, 'confirm');
		await click('confirm');
		expect(JSON.stringify(view)).toContain('Thông tin');
		expect(JSON.stringify(view)).toContain('Hoạt động');
		expect(JSON.stringify(view)).toContain('Tài sản');
		expect(JSON.stringify(view)).toContain('"type":11');
		expect((await bag()).beliefShards).toBe(1000);
		const duplicate = fixture('button', confirm);
		await router.handle(duplicate.interaction);
		expect(duplicate.raw.editReply).not.toHaveBeenCalled();
		expect((await bag()).beliefShards).toBe(1000);
		await click('daily');
		expect(JSON.stringify(view)).toContain('Đã nhận daily');
		await click('quests');
		await click('hunt');
		expect(JSON.stringify(view)).toContain('Gate 1');
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(0);
		await click('gate');
		expect(JSON.stringify(view)).toContain('Đánh tầng 10');
		await click('fight');
		expect(JSON.stringify(view)).toContain('HP');
		expect(JSON.stringify(view)).not.toContain('Chọn khu vực');
		expect(JSON.stringify(view)).not.toContain('Menu riêng tư');
		const battlePayload = JSON.parse(JSON.stringify(view));
		expect(battlePayload.components[0].type).toBe(17);
		expect(battlePayload.components[1].type).toBe(1);
		expect(battlePayload.components).toHaveLength(2);
		expect(battlePayload.components[1].components).toHaveLength(3);
		expect(parseMenuId(battlePayload.components[1].components[0].custom_id)?.action).toBe('home');
		await click('hunt');
		expect(JSON.stringify(view)).toContain('Gate 1');
		await click('gate');
		await click('fight');
		expect(JSON.stringify(view)).toContain('giây nữa để đánh lại');
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(1);
		const journal = JSON.stringify(view);
		if (!journal.includes('Hiệp 1/')) {
			await click('first');
			expect(JSON.stringify(view)).toContain('Hiệp 1/');
			await click('next');
			expect(JSON.stringify(view)).toContain('Hiệp 2/');
			await click('prev');
			expect(JSON.stringify(view)).toContain('Hiệp 1/');
			await click('last');
			expect(JSON.stringify(view)).toContain('HP');
		}
		expect(await db.select().from(s.menuActionReceipts).where(eq(s.menuActionReceipts.discordId, id))).toHaveLength(
			1,
		);
		await click('home');
		await click('profile');
		expect(JSON.stringify(view)).toContain('HP');
	}, 15000);

	it('rejects forged gameplay actions and class values without writing', async () => {
		const router = new MenuRouter(undefined, new MenuGameplayService());
		const open = fixture('command');
		await router.open(open.command);
		const parsed = parseMenuId(action(open.raw.editReply.mock.calls[0][0], 'class'))!;
		for (const f of [
			fixture('button', menuId(parsed.id, 0, 'hunt')),
			fixture('select', menuId(parsed.id, 0, 'class'), ['__proto__']),
			fixture('button', menuId(parsed.id, 0, 'confirm')),
		]) {
			await router.handle(f.interaction);
			expect(f.raw.deferUpdate).not.toHaveBeenCalled();
		}
		expect(await bag()).toBeUndefined();
	});

	it('commits daily quest/reputation once and does not double count the subscriber', async () => {
		const asyncProgress = vi.spyOn(QuestService.prototype, 'progress');
		await start();
		await db.insert(s.dailyQuests).values({
			discordId: id,
			questType: 'daily',
			targetCount: 1,
			currentCount: 0,
			rewardCredux: 123,
			rewardBeliefShards: 7,
			questDate: DailyCycle.keyAt(),
		});
		const daily = new ClaimDailyUseCase();
		expect((await daily.claim(id, new Date())).status).toBe('ok');
		const first = await bag();
		const [quest] = await db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, id));
		expect(quest.completed).toBe(true);
		expect(quest.currentCount).toBe(1);
		expect((await daily.claim(id, new Date())).status).toBe('already-claimed');
		expect(await bag()).toEqual(first);
		expect(asyncProgress).not.toHaveBeenCalled();
	});

	it('rolls back daily rewards and date when atomic progression fails', async () => {
		await start();
		const before = await bag();
		vi.spyOn(ReputationService.prototype, 'awardInTx').mockRejectedValueOnce(new Error('failure'));
		await expect(new ClaimDailyUseCase().claim(id, new Date())).rejects.toThrow('failure');
		expect(await bag()).toEqual(before);
		const [user] = await db.select().from(s.users).where(eq(s.users.discordId, id));
		expect(user.lastDailyClaimDate).not.toBe(DailyCycle.keyAt());
	});

	it('deduplicates raid rewards durably across service instances', async () => {
		await start();
		const first = await new RaidService().run(id, false, { requestId: 'same-action' });
		expect(first.status).toBe('ok');
		const before = await bag();
		expect((await new RaidService().run(id, false, { requestId: 'same-action' })).status).toBe('already-processed');
		expect(await bag()).toEqual(before);
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(1);
	});

	it('rolls back boss fee, attempt, rewards and receipt on progression failure', async () => {
		await start();
		await db.update(s.userCharacter).set({ combatLevel: 10 }).where(eq(s.userCharacter.discordId, id));
		await db.update(s.usersBag).set({ credux: 100000 }).where(eq(s.usersBag.discordId, id));
		const before = await bag();
		vi.spyOn(BattleEngine.prototype, 'resolve').mockReturnValue({
			outcome: 'player_win',
			rounds: 1,
			log: [],
			roundLogs: [],
			playerHpRemaining: 10,
			enemyHpRemaining: 0,
		});
		vi.spyOn(QuestService.prototype, 'progressInTx').mockRejectedValueOnce(new Error('quest failure'));
		await expect(new RaidService().run(id, true, { requestId: 'boss-failed' })).rejects.toThrow('quest failure');
		expect(await bag()).toEqual(before);
		expect(await db.select().from(s.menuActionReceipts).where(eq(s.menuActionReceipts.discordId, id))).toHaveLength(
			0,
		);
		const [user] = await db.select().from(s.users).where(eq(s.users.discordId, id));
		expect(user.lastBossAttackDate).not.toBe(DailyCycle.keyAt());
	});

	it('revalidates boss gates and expired quest confirmations', async () => {
		await start();
		expect((await new RaidService().run(id, true, { requestId: 'locked' })).status).toBe('boss-locked');
		expect(await db.select().from(s.menuActionReceipts).where(eq(s.menuActionReceipts.discordId, id))).toHaveLength(
			0,
		);
		const quests = new QuestService();
		const before = await quests.snapshot(id);
		expect(await quests.refresh(id, '2000-01-01')).toContain('ngày mới');
		expect(await quests.snapshot(id)).toEqual(before);
		await quests.refresh(id, DailyCycle.keyAt());
		expect((await quests.snapshot(id))!.refreshAvailable).toBe(false);
		expect((await quests.snapshot(id))!.dailies).toHaveLength(3);
	});

	it('weekly claim grants exactly once and exposes structured button state', async () => {
		await start();
		const quests = new QuestService();
		const snapshot = (await quests.snapshot(id))!;
		await db
			.update(s.weeklyQuests)
			.set({ completed: true })
			.where(and(eq(s.weeklyQuests.discordId, id), eq(s.weeklyQuests.questWeek, snapshot.week)));
		expect((await quests.snapshot(id))!.grandReady).toBe(true);
		await quests.claimWeeklyGrand(id);
		const after = await bag();
		await quests.claimWeeklyGrand(id);
		expect(await bag()).toEqual(after);
		expect((await quests.snapshot(id))!.grandReady).toBe(false);
	});

	it('does not replay a committed hunt after Discord edit fails', async () => {
		await start();
		const game = new MenuGameplayService();
		const act = vi.spyOn(game, 'act');
		const router = new MenuRouter(new MenuSessionStore(), game);
		const open = fixture('command');
		await router.open(open.command);
		const entry = fixture('button', action(open.raw.editReply.mock.calls[0][0], 'hunt'));
		await router.handle(entry.interaction);
		const gate = fixture('button', action(entry.raw.editReply.mock.calls[0][0], 'gate'));
		await router.handle(gate.interaction);
		act.mockClear();
		const huntId = action(gate.raw.editReply.mock.calls[0][0], 'fight');
		const first = fixture('button', huntId);
		first.raw.editReply.mockRejectedValueOnce(new Error('network'));
		await router.handle(first.interaction);
		await router.handle(fixture('button', huntId).interaction);
		expect(act).toHaveBeenCalledOnce();
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(1);
	});
});
