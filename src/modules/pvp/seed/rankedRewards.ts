/**
 * SEED DATA — ranked_reward
 * ---------------------------------------------------------------------------
 * Thưởng tuần theo bracket (M7 design defaults, không port từ bản gốc).
 * weeklyPayload: chest cộng vào users_bag khi claim tuần.
 * seasonEndPayload: thưởng khi claim mùa (Phase 5, /ranked season) — credux
 * + chest theo bracket, cộng seasonValor Valor Medals.
 */
export interface RankedRewardSeed {
	bracket: 'Mortal' | 'Champion' | 'Demigod' | 'Ascendant' | 'Divine';
	weeklyCredux: number;
	weeklyValor: number;
	weeklyPayload: {
		silverChest?: number;
		goldChest?: number;
		diamondChest?: number;
		genesisChest?: number;
	};
	seasonValor: number;
	seasonEndPayload: {
		credux: number;
		silverChest?: number;
		goldChest?: number;
		diamondChest?: number;
		genesisChest?: number;
	};
}

export const RANKED_REWARD_SEED: RankedRewardSeed[] = [
	{
		bracket: 'Mortal',
		weeklyCredux: 50_000,
		weeklyValor: 2,
		weeklyPayload: {},
		seasonValor: 10,
		seasonEndPayload: { credux: 100_000 },
	},
	{
		bracket: 'Champion',
		weeklyCredux: 150_000,
		weeklyValor: 8,
		weeklyPayload: { silverChest: 2 },
		seasonValor: 40,
		seasonEndPayload: { credux: 300_000, silverChest: 3 },
	},
	{
		bracket: 'Demigod',
		weeklyCredux: 300_000,
		weeklyValor: 15,
		weeklyPayload: { goldChest: 1 },
		seasonValor: 75,
		seasonEndPayload: { credux: 600_000, goldChest: 2 },
	},
	{
		bracket: 'Ascendant',
		weeklyCredux: 500_000,
		weeklyValor: 25,
		weeklyPayload: { goldChest: 1, diamondChest: 1 },
		seasonValor: 125,
		seasonEndPayload: { credux: 1_000_000, goldChest: 2, diamondChest: 1 },
	},
	{
		bracket: 'Divine',
		weeklyCredux: 800_000,
		weeklyValor: 40,
		weeklyPayload: { genesisChest: 1 },
		seasonValor: 200,
		seasonEndPayload: { credux: 1_600_000, genesisChest: 2 },
	},
];
