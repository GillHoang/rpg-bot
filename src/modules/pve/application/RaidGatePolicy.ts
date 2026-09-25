import {
	GATES,
	findGateTier,
	defaultGateTier,
	highestAccessibleGate,
	gateUnlocked,
	type GateTier,
} from '../../../shared/config/portals.js';
import { GATE_TEXT } from '../../../shared/ui/text/portals.js';

/**
 * SRP extraction from RaidService: pure portal gate/tier selection rules.
 * No DB, no clock — takes explicit inputs, returns a tier or a lock reason.
 */
export type GateSelection = { tier?: GateTier } | { status: 'portal-locked'; message: string };

export function selectGateTier(
	gatesCleared: number[],
	level: number,
	gateId?: number,
	tierNumber?: number,
): GateSelection {
	const selectedGate =
		gateId === undefined ? highestAccessibleGate(gatesCleared) : GATES.find((gate) => gate.id === gateId);
	const tier =
		selectedGate && findGateTier(selectedGate.id, tierNumber ?? defaultGateTier(gatesCleared, selectedGate).number);
	if (!tier) return { status: 'portal-locked', message: GATE_TEXT.invalid };
	if (!gateUnlocked(tier.gate, gatesCleared, level))
		return { status: 'portal-locked', message: GATE_TEXT.locked(tier.gate.minLevel) };
	if (tier.number > (gatesCleared[tier.gate.id - 1] ?? 0) + 1)
		return { status: 'portal-locked', message: GATE_TEXT.tierLocked() };
	return { tier };
}
