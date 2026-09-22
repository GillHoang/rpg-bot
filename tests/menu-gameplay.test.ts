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
import { MenuGameplayService } from '../src/menu/MenuGameplayService.js';
import { MenuRouter } from '../src/menu/MenuRouter.js';
import { MenuSessionStore } from '../src/menu/MenuSessionStore.js';
import { menuId, parseMenuId } from '../src/menu/menuIds.js';
import { StartService } from '../src/services/StartService.js';
import { DailyService } from '../src/services/DailyService.js';
import { RaidService } from '../src/services/RaidService.js';
import { QuestService } from '../src/services/QuestService.js';
import { ReputationService } from '../src/services/ReputationService.js';
import { DailyCycle } from '../src/utils/dailyCycle.js';
import { subscribeDomainEvents } from '../src/core/subscribeDomainEvents.js';
import { WEAPON_SEED } from '../src/seed/data/weapons.js';
import { ARMOR_SEED } from '../src/seed/data/armors.js';
import { MOB_SEED } from '../src/seed/data/mobs.js';
import { COSMETIC_SEED } from '../src/seed/data/cosmetics.js';
import { TITLE_SEED } from '../src/seed/data/titles.js';
import { BattleEngine } from '../src/domain/combat/BattleEngine.js';

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
function action(payload: unknown, name: string): string {
	const json = JSON.stringify(payload);
	const ids = [...json.matchAll(/"custom_id":"([^"]+)"/g)].map((m) => m[1]);
	const result = ids.find((value) => parseMenuId(value)?.action === name);
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
	expect(new Set(ids).size).toBe(ids.length);
}

describe('phase 2 menu', () => {
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
		const { GearRepository } = await import('../src/repositories/GearRepository.js');
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
		expect(JSON.stringify(view)).toContain('HP');
		expect(JSON.stringify(view)).not.toContain('Chọn khu vực');
		expect(JSON.stringify(view)).not.toContain('Menu riêng tư');
		const battlePayload = JSON.parse(JSON.stringify(view));
		expect(battlePayload.components[0].type).toBe(17);
		expect(battlePayload.components[1].type).toBe(1);
		expect(battlePayload.components).toHaveLength(2);
		expect(battlePayload.components[1].components).toHaveLength(1);
		expect(parseMenuId(battlePayload.components[1].components[0].custom_id)?.action).toBe('home');
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
		const daily = new DailyService();
		expect((await daily.claim(id, new Date(), true)).status).toBe('ok');
		const first = await bag();
		const [quest] = await db.select().from(s.dailyQuests).where(eq(s.dailyQuests.discordId, id));
		expect(quest.completed).toBe(true);
		expect(quest.currentCount).toBe(1);
		expect((await daily.claim(id, new Date(), true)).status).toBe('already-claimed');
		expect(await bag()).toEqual(first);
		expect(asyncProgress).not.toHaveBeenCalled();
	});

	it('rolls back daily rewards and date when atomic progression fails', async () => {
		await start();
		const before = await bag();
		vi.spyOn(ReputationService.prototype, 'awardInTx').mockRejectedValueOnce(new Error('failure'));
		await expect(new DailyService().claim(id, new Date(), true)).rejects.toThrow('failure');
		expect(await bag()).toEqual(before);
		const [user] = await db.select().from(s.users).where(eq(s.users.discordId, id));
		expect(user.lastDailyClaimDate).not.toBe(DailyCycle.keyAt());
	});

	it('deduplicates raid rewards durably across service instances', async () => {
		await start();
		const first = await new RaidService().run(id, false, { requestId: 'same-action', atomicProgress: true });
		expect(first.status).toBe('ok');
		const before = await bag();
		expect(
			(await new RaidService().run(id, false, { requestId: 'same-action', atomicProgress: true })).status,
		).toBe('already-processed');
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
		await expect(
			new RaidService().run(id, true, { requestId: 'boss-failed', atomicProgress: true }),
		).rejects.toThrow('quest failure');
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
		const huntId = action(open.raw.editReply.mock.calls[0][0], 'hunt');
		const first = fixture('button', huntId);
		first.raw.editReply.mockRejectedValueOnce(new Error('network'));
		await router.handle(first.interaction);
		await router.handle(fixture('button', huntId).interaction);
		expect(act).toHaveBeenCalledOnce();
		expect(await db.select().from(s.raidLogs).where(eq(s.raidLogs.discordId, id))).toHaveLength(1);
	});
});
