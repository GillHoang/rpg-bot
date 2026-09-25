import { describe, expect, it } from 'vitest';
import { HELP_PAGES } from '../src/shared/ui/text/help.js';
import { BRACKETS } from '../src/shared/config/ranked.js';
import {
	PITY_THRESHOLD,
	TIER_WEIGHTS,
	RELIC_TIER_WEIGHTS,
	ESSENCE_PER_DUPLICATE,
	SHARDS_PER_PULL,
	MAX_PULLS,
} from '../src/shared/config/gachaRates.js';
import { MAX_BET, CASINO_SESSION_TTL_MS } from '../src/shared/config/casinoPayouts.js';
import { DUEL_STAKE_MIN, DUEL_EXPIRES_SECONDS } from '../src/modules/pvp/application/DuelService.js';
import { SUCCESS_RATE } from '../src/shared/config/enhancement.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../src/shared/config/starter.js';
import { BELIEVER_DAILY_CAP, COSMETIC_TIER_MIN_LEVEL } from '../src/shared/config/reputation.js';
import { WEEKLY_GRAND } from '../src/shared/config/quests.js';
import { BOSS_ENTRY } from '../src/shared/config/raidLoot.js';

/**
 * /help bodies are hand-written snapshots of balance numbers. When a config
 * value changes without its help line, the UI lies (past cases: pity 500,
 * Fighter 30%, Knight 2%). These pins force the two to move together.
 * Help uses Vietnamese number style regardless of TEXT_LOCALE.
 */
const body = HELP_PAGES.map((p) => `${p.title}\n${p.body}`).join('\n');
const vi = (n: number): string => n.toLocaleString('vi-VN');
const viPct = (fraction: number): string => `${String(Number((fraction * 100).toFixed(1))).replace('.', ',')}%`;

describe('help numbers track balance config', () => {
	it('lists current ranked brackets', () => {
		for (const bracket of BRACKETS) {
			if (bracket.min > 0) expect(body).toContain(`(${bracket.min})`);
		}
	});

	it('states the live summon economy', () => {
		expect(body).toContain(`Pity ${PITY_THRESHOLD} lượt`);
		expect(body).toContain(`count:1–${MAX_PULLS}`);
		expect(body).toContain(`${SHARDS_PER_PULL} Shards`);
		for (const [tier, weight] of TIER_WEIGHTS) expect(body).toContain(`${tier} ${viPct(weight)}`);
		for (const [tier, essence] of Object.entries(ESSENCE_PER_DUPLICATE))
			expect(body).toContain(`${tier} ${essence}`);
		const [mythic, legendary, supreme] = RELIC_TIER_WEIGHTS.sacred.map(([, w]) => viPct(w));
		expect(body).toContain(`${mythic} Mythic · ${legendary} Legendary · ${supreme} Supreme`);
	});

	it('states live duel/casino limits', () => {
		expect(body).toContain(vi(MAX_BET));
		expect(body).toContain(vi(DUEL_STAKE_MIN));
		expect(body).toContain(`${DUEL_EXPIRES_SECONDS} giây`);
		expect(body).toContain(`${CASINO_SESSION_TTL_MS / 1000} giây`);
	});

	it('states live class passives', () => {
		expect(body).toContain('15% cơ hội Bash (35% nếu địch đang Dizzy)');
		expect(body).toContain('2,5% HP mỗi lượt');
		expect(body).toContain('+5% ATK mỗi lượt');
		expect(body).toContain('25% DEF');
	});

	it('states live progression numbers', () => {
		expect(body).toContain(`+1 ${SUCCESS_RATE[1]! * 100}%`);
		expect(body).toContain(`+10 ${SUCCESS_RATE[10]! * 100}%`);
		expect(body).toContain(vi(GRANT_BELIEF_SHARDS));
		expect(body).toContain(`${GRANT_SILVER_CHESTS} Silver Chest`);
		expect(body).toContain(`${BELIEVER_DAILY_CAP} EXP`);
		expect(body).toContain(`lv ${COSMETIC_TIER_MIN_LEVEL.chosen}`);
		expect(body).toContain(`lv ${COSMETIC_TIER_MIN_LEVEL.eternal}`);
		expect(body).toContain(vi(WEEKLY_GRAND.credux));
		expect(body).toContain(vi(BOSS_ENTRY.credux));
		expect(body).toContain(`cấp ${BOSS_ENTRY.minLevel}`);
	});
});
