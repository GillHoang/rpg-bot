/**
 * Portal hunt — 5 Gate, mỗi Gate 10 tầng tăng dần từ dễ đến khó, tầng 10 là
 * boss của Gate (finalBoss). Vượt tầng 10 của Gate N mới mở Gate N+1.
 * Mỗi Gate có modifier riêng để tạo độ phong phú (nhân chỉ số quái).
 * `tierLevel` của tầng là cấp quái — chia đều từ minLevel của Gate lên bossLevel.
 */
export const GATE_COUNT = 5;
export const TIERS_PER_GATE = 10;

export type GateModifier = 'none' | 'tanky' | 'aggressive' | 'regen' | 'evasive';

export interface Gate {
	id: number;
	name: string;
	minLevel: number;
	/** Cấp quái của tầng boss (tầng 10). */
	bossLevel: number;
	modifier: GateModifier;
}

/** Tên Gate ở src/text/portals.ts (GATE_NAMES) — config chỉ giữ dữ liệu thuần. */
export const GATES: readonly Gate[] = [
	{ id: 1, name: 'forest', minLevel: 1, bossLevel: 12, modifier: 'none' },
	{ id: 2, name: 'ruins', minLevel: 15, bossLevel: 26, modifier: 'tanky' },
	{ id: 3, name: 'abyss', minLevel: 30, bossLevel: 42, modifier: 'aggressive' },
	{ id: 4, name: 'volcano', minLevel: 45, bossLevel: 58, modifier: 'regen' },
	{ id: 5, name: 'celestial', minLevel: 60, bossLevel: 75, modifier: 'evasive' },
];

export interface GateTier {
	gate: Gate;
	number: number;
	/** Tầng 10 là boss của Gate. */
	finalBoss: boolean;
	/** Cấp quái của tầng này. */
	level: number;
}

export const GATE_TIERS: readonly GateTier[] = GATES.flatMap((gate) =>
	Array.from({ length: TIERS_PER_GATE }, (_, index) => ({
		gate,
		number: index + 1,
		finalBoss: index === TIERS_PER_GATE - 1,
		level: gate.minLevel + Math.round(((gate.bossLevel - gate.minLevel) * index) / (TIERS_PER_GATE - 1)),
	})),
);

export type PortalGate = GateTier;

export function findGateTier(gateId: number, tier: number): GateTier | undefined {
	const gate = GATES.find((g) => g.id === gateId);
	if (!gate) return undefined;
	return GATE_TIERS.find((t) => t.gate.id === gateId && t.number === tier);
}

/**
 * Tầng mặc định khi vào một Gate: tầng kế tiếp chưa vượt trong Gate đó.
 * `tiersClearedPerGate` là mảng số tầng đã vượt của Gate 1..5 (0 nếu chưa).
 */
export function defaultGateTier(gatesCleared: readonly number[], gate: Gate): GateTier {
	const cleared = Math.min(gatesCleared[gate.id - 1] ?? 0, TIERS_PER_GATE);
	return GATE_TIERS.find((t) => t.gate.id === gate.id && t.number === cleared + 1) ?? GATE_TIERS.at(-1)!;
}

/**
 * Gate mặc định khi mở màn săn quái: Gate đầu tiên chưa hoàn thành 10 tầng.
 * Người chơi đủ level vẫn có thể tự chọn Gate cao hơn ở màn chọn Gate.
 */
export function highestAccessibleGate(gatesCleared: readonly number[]): Gate {
	for (const gate of GATES) {
		if ((gatesCleared[gate.id - 1] ?? 0) < TIERS_PER_GATE) return gate;
	}
	return GATES[0]!;
}

/** Gate có thể vào: Gate đã mở bằng tiến độ, hoặc Gate kế tiếp nếu đủ level. */
export function gateUnlocked(gate: Gate, gatesCleared: readonly number[], level: number): boolean {
	if (gate.id === 1) return true;
	const previous = GATES[gate.id - 2]!;
	if ((gatesCleared[previous.id - 1] ?? 0) >= TIERS_PER_GATE) return true;
	return gate.minLevel <= level;
}
