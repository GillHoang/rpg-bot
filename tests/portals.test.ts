import { describe, expect, it } from 'vitest';
import { GATES, TIERS_PER_GATE, defaultGateTier, gateUnlocked, highestAccessibleGate, findGateTier } from '../src/config/portals.js';

describe('gate tier defaults', () => {
	it.each([
		[[], 1, 1, 1],
		[[1], 1, 1, 2],
		[[5], 1, 1, 6],
		[[9], 1, 1, 10],
		[[10], 1, 1, 10],
		[[10, 0], 1, 1, 1],
		[[10, 3], 1, 1, 4],
		[[0, 2], 1, 1, 1],
	])('selects the next uncleared tier for gate gate=%i', (_a, gateId, _level, _tier) => {
		const gate = GATES.find((g) => g.id === gateId)!;
		expect(gate).toBeDefined();
	});

	it.each([
		[[0, 0, 0, 0, 0], GATES[0]!.id],
		[[10, 0, 0, 0, 0], GATES[1]!.id],
		[[10, 10, 0, 0, 0], GATES[2]!.id],
		[[10, 10, 10, 10, 10], GATES[0]!.id],
		[[9, 0, 0, 0, 0], GATES[0]!.id],
		[[10, 10, 10, 10, 9], GATES[4]!.id],
	])('defaults to the first unfinished gate for cleared=%j', (cleared, expected) => {
		expect(highestAccessibleGate(cleared).id).toBe(expected);
	});

	it('unlocks gate 2 only after beating gate 1 boss or reaching its level', () => {
		expect(gateUnlocked(GATES[1]!, [0, 0, 0, 0, 0], 1)).toBe(false);
		expect(gateUnlocked(GATES[1]!, [0, 0, 0, 0, 0], GATES[1]!.minLevel)).toBe(true);
		expect(gateUnlocked(GATES[1]!, [TIERS_PER_GATE, 0, 0, 0, 0], 1)).toBe(true);
		expect(gateUnlocked(GATES[0]!, [0, 0, 0, 0, 0], 1)).toBe(true);
	});

	it('finds gate tiers by gate and tier number', () => {
		expect(findGateTier(1, 1)?.finalBoss).toBe(false);
		expect(findGateTier(1, TIERS_PER_GATE)?.finalBoss).toBe(true);
		expect(findGateTier(1, 11)).toBeUndefined();
		expect(findGateTier(6, 1)).toBeUndefined();
	});

	it('defaults to the next uncleared tier in the selected gate', () => {
		const gate = GATES[0]!;
		expect(defaultGateTier([0, 0, 0, 0, 0], gate).number).toBe(1);
		expect(defaultGateTier([5, 0, 0, 0, 0], gate).number).toBe(6);
		expect(defaultGateTier([TIERS_PER_GATE, 0, 0, 0, 0], gate).number).toBe(TIERS_PER_GATE);
	});
});
