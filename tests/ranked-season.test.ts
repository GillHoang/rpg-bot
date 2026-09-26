import { describe, expect, it, vi } from 'vitest';
import { RankedService } from '../src/modules/pvp/application/RankedService.js';
import { RANKED_REWARD_SEED } from '../src/modules/pvp/seed/rankedRewards.js';

function testPersistence() {
	return { unitOfWork: { run: async <T>(fn: (tx: object) => Promise<T>): Promise<T> => fn({}) } } as never;
}

const SEASON = {
	seasonId: 3,
	name: 'Season 3',
	startsAt: new Date('2026-01-01T00:00:00+07:00'),
	endsAt: new Date('2026-01-31T00:00:00+07:00'),
	isActive: false,
};

const REWARD = {
	bracket: 'Demigod',
	weeklyCredux: 300_000,
	weeklyValor: 15,
	weeklyPayload: {},
	seasonValor: 75,
	seasonEndPayload: { credux: 600_000, goldChest: 2 },
};

function harness(opts: {
	bag?: Record<string, number> | null;
	character?: Record<string, unknown> | null;
	seasons?: unknown[];
	fights?: unknown[];
	reward?: unknown | null;
}) {
	const queries = {
		lockBag: vi.fn().mockResolvedValue(
			opts.bag === undefined
				? [{ credux: 0, lifetimeCreduxEarned: 0, valorMedals: 0, silverChest: 0, goldChest: 0, diamondChest: 0, genesisChest: 0 }]
				: opts.bag === null
					? []
					: [opts.bag],
		),
		lockCharacter: vi.fn().mockResolvedValue(
			opts.character === undefined
				? [{ pvpRating: 1500, lastSeasonClaimId: null }]
				: opts.character === null
					? []
					: [opts.character],
		),
		lastClosedSeason: vi.fn().mockResolvedValue(opts.seasons ?? [SEASON]),
		findSeasonFight: vi.fn().mockResolvedValue(opts.fights ?? [{ id: 1 }]),
		findWeeklyReward: vi.fn().mockResolvedValue(opts.reward === undefined ? [REWARD] : (opts.reward === null ? [] : [opts.reward])),
		updateBag: vi.fn().mockResolvedValue([]),
		updateCharacter: vi.fn().mockResolvedValue([]),
	};
	const ranked = new RankedService(undefined, undefined, undefined, { emit: vi.fn() }, {
		persistence: testPersistence(),
		queries: queries as never,
	});
	return { ranked, queries };
}

describe('season payout seed (Phase 5c)', () => {
	it('fills seasonEndPayload for every bracket', () => {
		expect(RANKED_REWARD_SEED).toHaveLength(5);
		for (const row of RANKED_REWARD_SEED) {
			expect(row.seasonEndPayload.credux).toBeGreaterThan(0);
			expect(row.seasonValor).toBeGreaterThan(0);
		}
		const divine = RANKED_REWARD_SEED.find((row) => row.bracket === 'Divine')!;
		expect(divine.seasonEndPayload.genesisChest).toBe(2);
	});
});

describe('RankedService.claimSeason', () => {
	it('pays the season purse and stamps the claimed season', async () => {
		const { ranked, queries } = harness({});
		const result = await ranked.claimSeason('hero');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.seasonId).toBe(3);
		expect(result.credux).toBe(600_000);
		expect(result.valor).toBe(75);
		expect(result.chests).toHaveLength(1);
		expect(queries.updateBag).toHaveBeenCalledWith(
			expect.anything(),
			'hero',
			expect.objectContaining({ credux: 600_000, goldChest: 2, valorMedals: 75 }),
		);
		expect(queries.updateCharacter).toHaveBeenCalledWith(
			expect.anything(),
			'hero',
			{ lastSeasonClaimId: 3 },
		);
	});

	it('rejects double claims, missing seasons, idle players and unseeded rows', async () => {
		expect((await harness({ character: { pvpRating: 1500, lastSeasonClaimId: 3 } }).ranked.claimSeason('hero')).status).toBe(
			'already-claimed',
		);
		expect((await harness({ seasons: [] }).ranked.claimSeason('hero')).status).toBe('no-season');
		expect((await harness({ fights: [] }).ranked.claimSeason('hero')).status).toBe('no-fights');
		expect((await harness({ reward: null }).ranked.claimSeason('hero')).status).toBe('no-reward-row');
		expect((await harness({ bag: null }).ranked.claimSeason('hero')).status).toBe('not-registered');
		expect((await harness({ character: null }).ranked.claimSeason('hero')).status).toBe('not-registered');
	});
});
