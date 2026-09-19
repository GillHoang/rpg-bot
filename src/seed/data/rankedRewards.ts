/**
 * SEED DATA — ranked_reward
 * ---------------------------------------------------------------------------
 * Thưởng tuần theo bracket (M7 design defaults, không port từ bản gốc).
 * weeklyPayload: chest cộng vào users_bag khi claim tuần.
 * seasonEndPayload: để trống — trao mùa hiện chưa thuộc phạm vi.
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
	seasonEndPayload: Record<string, never>;
}

export const RANKED_REWARD_SEED: RankedRewardSeed[] = [
	{
		bracket: 'Mortal',
		weeklyCredux: 50_000,
		weeklyValor: 2,
		weeklyPayload: {},
		seasonValor: 10,
		seasonEndPayload: {},
	},
	{
		bracket: 'Champion',
		weeklyCredux: 150_000,
		weeklyValor: 8,
		weeklyPayload: { silverChest: 2 },
		seasonValor: 40,
		seasonEndPayload: {},
	},
	{
		bracket: 'Demigod',
		weeklyCredux: 300_000,
		weeklyValor: 15,
		weeklyPayload: { goldChest: 1 },
		seasonValor: 75,
		seasonEndPayload: {},
	},
	{
		bracket: 'Ascendant',
		weeklyCredux: 500_000,
		weeklyValor: 25,
		weeklyPayload: { goldChest: 1, diamondChest: 1 },
		seasonValor: 125,
		seasonEndPayload: {},
	},
	{
		bracket: 'Divine',
		weeklyCredux: 800_000,
		weeklyValor: 40,
		weeklyPayload: { genesisChest: 1 },
		seasonValor: 200,
		seasonEndPayload: {},
	},
];
