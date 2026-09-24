import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema.js';
import * as identityTables from '../src/db/tables/identity.js';
import * as economyTables from '../src/db/tables/economy.js';
import * as pveTables from '../src/db/tables/pve.js';
import * as pvpTables from '../src/db/tables/pvp.js';
import * as progressionTables from '../src/db/tables/progression.js';
import * as metaTables from '../src/db/tables/meta.js';
import * as casinoTables from '../src/db/tables/casino.js';
import * as menuTables from '../src/db/tables/menu.js';
import * as systemTables from '../src/db/tables/system.js';
import * as identity from '../src/modules/identity/index.js';
import * as economy from '../src/modules/economy/index.js';
import * as pve from '../src/modules/pve/index.js';
import * as pvp from '../src/modules/pvp/index.js';
import * as progression from '../src/modules/progression/index.js';
import * as meta from '../src/modules/meta/index.js';
import * as casino from '../src/modules/casino/index.js';
import * as combatShared from '../src/modules/combat-shared/index.js';
import * as menu from '../src/modules/menu/index.js';
import * as system from '../src/modules/system/index.js';

const EXPECTED_TABLES: Array<[string, Record<string, unknown>, string[]]> = [
	['identity', identityTables, ['users', 'userCharacter', 'usersBag', 'userPresets', 'userGuildActivity']],
	['economy', economyTables, ['gameLogs']],
	[
		'pve', pveTables,
		[
			'mobRoster', 'raidLogs', 'bossAttackLog', 'bossSpawnQueue', 'bossState', 'huntCooldowns',
			'raidRewardDailyTotals', 'raidRewardGrants', 'activeBattles', 'autoRaids',
		],
	],
	[
		'pvp', pvpTables,
		[
			'activeDuels', 'activeDuelParticipants', 'activeRankedFights', 'pvpLogs', 'rankedLogs',
			'rankedReward', 'wagerLogs', 'pvpShopPurchases',
		],
	],
	[
		'progression', progressionTables,
		[
			'weaponRoster', 'armorRoster', 'deityRoster', 'runeRoster', 'userWeapons', 'userArmors',
			'userDeities', 'userRunes', 'essenceBagDef', 'socketUnlockCost', 'essenceExchangeSubmissions',
			'summonRewardGrants', 'pityCounters',
		],
	],
	[
		'meta', metaTables,
		[
			'dailyQuests', 'weeklyQuests', 'dailyQuestCompletionRewards', 'weeklyGrand', 'seasons',
			'cosmeticCatalog', 'titleCatalog', 'userCosmetics', 'equippedSkins', 'userTitles',
		],
	],
	['casino', casinoTables, ['activeCasinoSessions', 'casinoLogs']],
	['menu', menuTables, ['menuActionReceipts']],
	[
		'system', systemTables,
		[
			'serverConfig', 'devLogs', 'stripeEvents', 'supporterGrants', 'supporterItemGrants',
			'supporterTokenLedger', 'supporters', 'tickets', 'topggVoteEvents',
		],
	],
];

describe('split database schema', () => {
	it('exposes the same 59 tables through the barrel', () => {
		const listed = EXPECTED_TABLES.flatMap(([, , tables]) => tables).sort();
		expect(Object.keys(schema).sort()).toEqual(listed);
	});

	it.each(EXPECTED_TABLES.map(([group, mod, tables]) => [group, mod, tables]) as Array<[string, Record<string, unknown>, string[]]>)(
		'tables/%s.ts owns its tables',
		(_group, mod, tables) => {
			expect(Object.keys(mod).sort()).toEqual([...tables].sort());
		},
	);
});

describe('module facades', () => {
	it.each([
		['identity', identity],
		['economy', economy],
		['pve', pve],
		['pvp', pvp],
		['progression', progression],
		['meta', meta],
		['casino', casino],
		['combat-shared', combatShared],
		['menu', menu],
		['system', system],
	] as Array<[string, Record<string, unknown>]>)('modules/%s resolves its public API', (_name, mod) => {
		expect(Object.keys(mod).length).toBeGreaterThan(0);
	});
});
