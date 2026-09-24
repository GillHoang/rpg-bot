import { beforeEach, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { RaidResult, RaidService } from '../src/services/RaidService.js';
vi.mock('../src/db/client.js', () => ({ db: {}, pool: {} }));
vi.mock('../src/render/BattleLogPager.js', () => ({ sendBattleLog: vi.fn() }));
import { sendBattleLog } from '../src/render/BattleLogPager.js';
import { RaidCommand } from '../src/commands/rpg/RaidCommand.js';

beforeEach(() => vi.clearAllMocks());
it.each(['player_win', 'enemy_win', 'draw'] as const)('replay after %s only advances on a win', async (outcome) => {
	const result: RaidResult = {
		status: 'ok',
		battle: { outcome, rounds: 1, log: [], roundLogs: [], playerHpRemaining: 1, enemyHpRemaining: 0 },
		monsterName: 'Gate 4',
		credux: 0,
		shards: 0,
		expGained: 0,
		gotChest: false,
		chestName: '',
		gearDrop: null,
		progress: { previousLevel: 7, newLevel: 7, leveledUp: false },
	};
	const run = vi.fn<RaidService['run']>().mockResolvedValue(result);
	const interaction = {
		id: 'initial',
		user: { id: 'owner', username: 'Owner' },
		deferReply: vi.fn(),
		editReply: vi.fn(),
		options: {
			getSubcommand: () => 'hunt',
			getInteger: (name: string) => (name === 'gate' ? 4 : name === 'tier' ? 4 : undefined),
		},
	} as unknown as ChatInputCommandInteraction;
	await new RaidCommand({ run }).execute(interaction);
	const options = vi.mocked(sendBattleLog).mock.calls[0][1];
	await options.replay!.run();
	expect(run).toHaveBeenNthCalledWith(2, 'owner', false, {
		gate: 4,
		tier: outcome === 'player_win' ? undefined : 4,
	});
});
