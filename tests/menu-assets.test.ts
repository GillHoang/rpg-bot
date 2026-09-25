import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testPersistence } from './helpers/persistence.js';
import { migrateTestDatabase, type TestDatabase } from './helpers/database.js';

vi.mock('../src/db/client.js', async () => {
	const { createTestDatabase } = await import('./helpers/database.js');
	return createTestDatabase();
});
vi.mock('../src/shared/utils/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
import { db, pool } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { MenuGameplayService } from '../src/modules/menu/MenuGameplayService.js';
import { MenuSessionStore } from '../src/modules/menu/MenuSessionStore.js';
import { StartService } from '../src/modules/identity/application/StartService.js';
import { WEAPON_SEED } from '../src/modules/progression/seed/weapons.js';
import { ARMOR_SEED } from '../src/modules/progression/seed/armors.js';
import { DEITY_SEED } from '../src/modules/progression/seed/deities.js';

let id: string;
let sequence = 0;

beforeAll(async () => {
	const { testClient } = (await import('../src/db/client.js')) as unknown as TestDatabase;
	await migrateTestDatabase(testClient);
	await db.insert(s.weaponRoster).values(WEAPON_SEED);
	await db.insert(s.armorRoster).values(ARMOR_SEED);
	await db.insert(s.deityRoster).values(DEITY_SEED);
}, 120000);
afterAll(async () => {
	await pool.end();
});
beforeEach(async () => {
	vi.restoreAllMocks();
	id = `assets-${++sequence}`;
	const started = await new StartService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	}).start(id, id, 'Knight');
	if (started.status !== 'ok') throw new Error(started.status);
});

const game = () =>
	new MenuGameplayService(undefined, undefined, undefined, undefined, undefined, {
		persistence: testPersistence(),
	});
const session = () => {
	const s = new MenuSessionStore().create(id);
	s.screen = { kind: 'home' };
	return s;
};

describe('menu asset panels (P2 read-only)', () => {
	it('opens the inventory at the bag summary', async () => {
		const svc = game();
		const sess = session();
		sess.screen = await svc.act(sess, 'inventory', id);
		expect(sess.screen).toEqual({ kind: 'inventory', category: 'bag', page: 1 });
		const panel = (await svc.render(sess))!;
		expect(panel.title).toContain('Kho đồ');
		expect(panel.body).toContain('Credux');
		expect(panel.data?.pages).toBe(1);
	});

	it('switches categories and pages through weapons', async () => {
		// Starter gear + 8 more → 9 weapons → 2 pages of 8.
		await db.insert(s.userWeapons).values(
			Array.from({ length: 8 }, (_, i) => ({
				discordId: id,
				weaponId: `w-${i + 1}`,
				weaponRosterId: 1,
				currAtk: 100,
				baseAtk: 100,
				crit: 5,
				quality: 'Rare',
				nativeSockets: [],
				oppositeSockets: [],
			})),
		);
		const svc = game();
		const sess = session();
		sess.screen = await svc.act(sess, 'invcat', id, 'weapons');
		expect(sess.screen).toEqual({ kind: 'inventory', category: 'weapons', page: 1 });
		let panel = (await svc.render(sess))!;
		expect(panel.title).toContain('Vũ khí');
		expect(panel.data?.pages).toBe(2);
		expect(panel.data?.page).toBe(1);
		expect(panel.body).not.toContain('Chưa có vật phẩm');
		const page1 = panel.body;

		sess.screen = await svc.act(sess, 'invnext', id);
		expect(sess.screen).toEqual({ kind: 'inventory', category: 'weapons', page: 2 });
		panel = (await svc.render(sess))!;
		expect(panel.data?.page).toBe(2);
		expect(panel.body).not.toBe(page1);

		sess.screen = await svc.act(sess, 'invprev', id);
		expect(sess.screen).toEqual({ kind: 'inventory', category: 'weapons', page: 1 });
		panel = (await svc.render(sess))!;
		expect(panel.data?.page).toBe(1);
	});

	it('lists deities with their IDs', async () => {
		await db.insert(s.userDeities).values({
			discordId: id,
			deityId: 1,
			currAtk: 10,
			currHp: 10,
			currDef: 10,
			lastPullDate: '2026-01-01',
		});
		const svc = game();
		const sess = session();
		sess.screen = await svc.act(sess, 'deities', id);
		expect(sess.screen).toEqual({ kind: 'deities', page: 1 });
		const panel = (await svc.render(sess))!;
		expect(panel.title).toContain('Thần đồng hành');
		expect(panel.body).toContain(DEITY_SEED[0]!.name);
	});

	it('shows the pvp shop with the current valor balance', async () => {
		const svc = game();
		const sess = session();
		sess.screen = await svc.act(sess, 'shop', id);
		expect(sess.screen).toEqual({ kind: 'shop' });
		const panel = (await svc.render(sess))!;
		expect(panel.body).toContain('PVP Shop');
		expect(panel.body).toContain('Valor Medals');
	});

	it('shows the casino game list', async () => {
		const svc = game();
		const sess = session();
		sess.screen = await svc.act(sess, 'casino', id);
		expect(sess.screen).toEqual({ kind: 'casino' });
		const panel = (await svc.render(sess))!;
		expect(panel.body).toContain('Coin Toss');
		expect(panel.body).toContain('Baccarat');
		expect(panel.body).toContain('Crash');
	});

	it('falls back to onboarding for unregistered players', async () => {
		const stranger = `assets-stranger-${++sequence}`;
		const svc = game();
		const sess = new MenuSessionStore().create(stranger);
		sess.screen = { kind: 'inventory', category: 'bag', page: 1 };
		const panel = (await svc.render(sess))!;
		expect(panel.classes).toBe(true);
	});
});
