import { describe, expect, it } from 'vitest';
import { MessageFlags } from 'discord.js';
import { BattleEngine, type BattleResult } from '../src/domain/combat/BattleEngine.js';
import { createCombatant } from '../src/domain/combat/CombatantState.js';
import { NullClassStrategy } from '../src/domain/combat/classes/NullClassStrategy.js';
import { buildBattleLogPage } from '../src/render/BattleLogPager.js';
import { COMBAT_STRIKE_EMOJIS } from '../src/text/combat.js';

const strategy = { playerStrategy: new NullClassStrategy(), enemyStrategy: new NullClassStrategy() };

describe('BattleEngine round logs', () => {
	it('snapshots both sides\' HP at the end of every round and flattens back to log', () => {
		const player = createCombatant({ name: 'P', combatClass: null, hp: 1_000, atk: 100, def: 10, crit: 0 });
		const enemy = createCombatant({ name: 'E', combatClass: null, hp: 300, atk: 5, def: 0, crit: 0 });
		const result = new BattleEngine().resolve(player, enemy, 7, strategy);

		expect(result.roundLogs.length).toBeGreaterThanOrEqual(1);
		expect(result.log).toEqual(result.roundLogs.flatMap((r) => r.lines));
		const last = result.roundLogs.at(-1)!;
		expect(last.playerHp).toBe(result.playerHpRemaining);
		expect(last.enemyHp).toBe(result.enemyHpRemaining);
		for (const round of result.roundLogs) {
			expect(round.lines.length).toBeGreaterThan(0);
			expect(round.playerHp).toBeGreaterThanOrEqual(0);
			expect(round.playerHp).toBeLessThanOrEqual(round.playerMaxHp);
			expect(round.enemyHp).toBeGreaterThanOrEqual(0);
			expect(round.enemyHp).toBeLessThanOrEqual(round.enemyMaxHp);
		}
		expect(last.enemyHp).toBe(0); // enemy died, snapshot must show it
	});

	it('keeps the sudden death header inside exactly one round', () => {
		const wall = () =>
			createCombatant({ name: 'Wall', combatClass: null, hp: 1_000_000_000, atk: 1, def: 0, crit: 0 });
		const result = new BattleEngine().resolve(wall(), wall(), 7, strategy);
		expect(result.roundLogs.filter((r) => r.lines.some((l) => l.includes('TỬ CHIẾN')))).toHaveLength(1);
	});
});

describe('strike emojis', () => {
	it('logs the bare-hand PHYS emoji by default and the weapon emoji when set', () => {
		const player = createCombatant({ name: 'P', combatClass: null, hp: 1_000, atk: 100, def: 0, crit: 0 });
		const enemy = createCombatant({
			name: 'E',
			combatClass: null,
			hp: 1_000,
			atk: 10,
			def: 0,
			crit: 0,
			attackEmoji: '<:AXE:42>',
		});
		const result = new BattleEngine().resolve(player, enemy, 3, strategy);
		expect(result.log.some((l) => l.includes(`[PHYS] ${COMBAT_STRIKE_EMOJIS.bareHand} \`P\` đánh`))).toBe(true);
		expect(result.log.some((l) => l.includes('[PHYS] <:AXE:42> `E` đánh'))).toBe(true);
	});

	it('overrides the weapon emoji with the global crit emoji on crit hits', () => {
		const player = createCombatant({ name: 'P', combatClass: null, hp: 1_000, atk: 100, def: 0, crit: 100 });
		const enemy = createCombatant({
			name: 'E',
			combatClass: null,
			hp: 10_000,
			atk: 0,
			def: 0,
			crit: 0,
			attackEmoji: '<:AXE:42>',
		});
		const result = new BattleEngine().resolve(player, enemy, 3, strategy);
		const critLines = result.log.filter((l) => l.includes('[CRIT]'));
		expect(critLines.length).toBeGreaterThan(0);
		for (const line of critLines) {
			expect(line).toContain(COMBAT_STRIKE_EMOJIS.crit);
			expect(line).not.toContain('<:AXE:42>');
		}
	});
});

const fakeBattle: BattleResult = {
	outcome: 'player_win',
	rounds: 2,
	log: [],
	roundLogs: [
		{
			round: 1,
			lines: ['— Hiệp 1 —', '[PHYS] `A` đánh `B`, gây __10 HP__.'],
			playerHp: 90,
			playerMaxHp: 100,
			enemyHp: 80,
			enemyMaxHp: 100,
		},
		{
			round: 2,
			lines: ['— Hiệp 2 —', '[CRIT] `A` đánh `B`, gây __80 HP__ — `B` gục ngã!'],
			playerHp: 90,
			playerMaxHp: 100,
			enemyHp: 0,
			enemyMaxHp: 100,
		},
	],
	playerHpRemaining: 90,
	enemyHpRemaining: 0,
};

interface PageJson {
	flags: number;
	accent_color: number;
	text: string;
	buttons: Array<{ custom_id: string; label?: string; disabled?: boolean }>;
}

function pageJson(battle: BattleResult, index: number, locked = false): PageJson {
	const { components, flags } = buildBattleLogPage(
		{ battle, playerName: 'Gill', enemyName: 'Bakunawa', headerLines: ['header'], footerLine: 'footer' },
		index,
		{ locked },
	);
	const json = JSON.parse(JSON.stringify(components[0])) as {
		accent_color: number;
		components: Array<Record<string, unknown>>;
	};
	const row = json.components.find((c) => c.type === 1) as { components: PageJson['buttons'] } | undefined;
	return { flags, accent_color: json.accent_color, text: JSON.stringify(json), buttons: row?.components ?? [] };
}

describe('battle log pager (Components V2)', () => {
	it('opens with disabled next/last on the last page and yellow-over-gray bars', () => {
		const page = pageJson(fakeBattle, 1);
		expect(page.flags).toBe(MessageFlags.IsComponentsV2);
		expect(page.accent_color).toBe(0x57f287); // player_win accent
		expect(page.text).toContain('Hiệp 2/2');
		// 90% HP is partial → yellow fill; enemy at 0 → gray track.
		expect(page.text).toContain(':linee3:');
		expect(page.text).toContain(':line7:');
		const byId = (id: string) => page.buttons.find((b) => b.custom_id === id);
		expect(byId('battlelog:prev')?.disabled).toBe(false);
		expect(byId('battlelog:first')?.disabled).toBe(false);
		expect(byId('battlelog:next')?.disabled).toBe(true);
		expect(byId('battlelog:last')?.disabled).toBe(true);
	});

	it('enables forward navigation on the first page', () => {
		const page = pageJson(fakeBattle, 0);
		expect(page.text).toContain('Hiệp 1/2');
		const byId = (id: string) => page.buttons.find((b) => b.custom_id === id);
		expect(byId('battlelog:prev')?.disabled).toBe(true);
		expect(byId('battlelog:next')?.disabled).toBe(false);
	});

	it('renders full accent bars at max HP and omits navigation for a single round', () => {
		const battle: BattleResult = {
			...fakeBattle,
			roundLogs: [
				{
					round: 1,
					lines: ['— Hiệp 1 —'],
					playerHp: 100,
					playerMaxHp: 100,
					enemyHp: 100,
					enemyMaxHp: 100,
				},
			],
		};
		const page = pageJson(battle, 0);
		expect(page.text).toContain(':line1:'); // player full → blue bar
		expect(page.text).toContain(':linea1:'); // enemy full → green bar
		expect(page.buttons).toHaveLength(0);
	});

	it('locks every navigation button when expired', () => {
		const page = pageJson(fakeBattle, 1, true);
		for (const button of page.buttons) {
			if (button.custom_id === 'battlelog:indicator') continue;
			expect(button.disabled).toBe(true);
		}
	});
});
