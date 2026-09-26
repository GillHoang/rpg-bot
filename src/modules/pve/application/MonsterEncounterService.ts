import { pick } from '../../../shared/utils/weightedRandom.js';
import { choose } from '../../../shared/config/chestLoot.js';
import type { Executor } from '../../../db/client.js';
import { MonsterRosterRepository } from '../infrastructure/MonsterRosterRepository.js';
import type { GateModifier } from '../../../shared/config/portals.js';

export interface MonsterStats {
	name: string;
	hp: number;
	atk: number;
	def: number;
	crit: number;
	spd: number;
	acc: number;
	eva: number;
	ten: number;
	mobType: string;
	skillKey: string;
	immunityTags: string[];
	/** Elite affixes + gate traits resolved at pick time (read by MonsterStrategy). */
	affixes: string[];
	regenPct: number;
	damageType: 'physical';
	armorType: 'light' | 'medium' | 'heavy';
}

/**
 * Mob scaling targets (viện toán nằm ở đây, seed chỉ là baseline hình dạng):
 * roster stats định TỈ LỆ tương đối giữa các mob (Pugot mỏng hơn Batibat...),
 * còn con số tuyệt đối bám curve class trung bình của người chơi cùng level —
 * nếu không, player scaling (atk +50~100/level) bỏ xa mob per-level (atk
 * +9~11/level) và mọi mob đều ra đòn như cỏ (bệnh "Pugot gây 6 HP").
 *
 *   mob = avg-class-curve(level) × hệ số loại:
 *     hp  × 2.8   (trận kéo 4-8 đòn mỗi bên thay vì 1-2 đòn one-shot)
 *     atk × 0.68  (sau mitigation còn ~55-70% → đe dọa thật nhưng không át player)
 *     def × 0.5
 *   Elite dày hơn ~45% và đánh đau hơn ~15% regular (hệ số nhân thêm).
 *   Gate difficulty rises 8% per monster level above 1, capped at +50%.
 *   Gate modifiers shift the monster's identity per gate (tanky/aggressive/...).
 *   Boss tier (tầng 10) uses this curve plus its own multipliers and boss skill.
 *   Daily Bakunawa keeps the seeded formula and its separate level-10 entry gate.
 */
const AVG_CLASS_CURVE = {
	hp: (lv: number) => 750 + 145 * (lv - 1),
	atk: (lv: number) => 275 + 100 * (lv - 1),
	def: (lv: number) => 165 + 61 * (lv - 1),
};

const REGULAR_SCALE = { hp: 2.0, atk: 0.93, def: 0.45 };
const ELITE_BONUS = { hp: 1.45, atk: 1.15, def: 1.0 };
const FINAL_BOSS_BONUS = { hp: 1.0, atk: 1.15, def: 1.2 };
const NEUTRAL_BONUS = { hp: 1, atk: 1, def: 1 };

/** Hệ số thưởng theo bậc encounter — tách riêng để tránh ternary lồng nhau. */
function tierBonus(finalBoss: boolean, mobType: string): { hp: number; atk: number; def: number } {
	if (finalBoss) return FINAL_BOSS_BONUS;
	if (mobType === 'elite') return ELITE_BONUS;
	return NEUTRAL_BONUS;
}
/** Đặc điểm riêng từng Gate: nhân chỉ số quái để tạo bản sắc. */
const GATE_MODIFIER_BONUS: Record<GateModifier, { hp: number; atk: number; def: number }> = {
	none: { hp: 1, atk: 1, def: 1 },
	tanky: { hp: 1.1, atk: 0.95, def: 1.45 },
	aggressive: { hp: 0.9, atk: 1.35, def: 0.9 },
	regen: { hp: 1.35, atk: 0.95, def: 1.1 },
	evasive: { hp: 1.1, atk: 1.1, def: 1.25 },
};

/** Elite affix pool (P4): trash variety in modifier gates + final-boss menace. */
const AFFIX_POOL = ['vampiric', 'frenzy_echo', 'stone_skin', 'swift', 'tenacious'] as const;

function rollAffixes(rng: () => number, count: number): string[] {
	const pool = [...AFFIX_POOL];
	const picked: string[] = [];
	for (let i = 0; i < count && pool.length > 0; i++) {
		const index = Math.floor(rng() * pool.length);
		picked.push(pool.splice(index, 1)[0]!);
	}
	return picked;
}

/** Mob-type tier index into the secondary-stat tables below. */
const MOB_TIER_INDEX: Record<string, number> = { boss: 2, elite: 1 };

/** Gate 3 (Abyss, minLevel 30): regulars fight in formation — medium armor. */
const FORMATION_LEVEL = 30;

/**
 * Counter-matrix armor (Phase 1): elite = medium always; boss and regulars
 * harden from gate 3 (lv 30). Early bosses stay medium so every upgraded
 * class can clear gate 1-2 (portal-balance pin); late content demands
 * counter-play (magical/ranged vs heavy, or pierce).
 */
function armorForEncounter(mobType: string, lv: number): 'light' | 'medium' | 'heavy' {
	if (mobType === 'elite') return 'medium';
	if (mobType === 'boss') return lv >= FORMATION_LEVEL ? 'heavy' : 'medium';
	return lv >= FORMATION_LEVEL ? 'medium' : 'light';
}

/** Secondary stats + traits derived in code (no roster migration needed). */
function secondaryStats(
	lv: number,
	mobType: string,
	gateModifier: GateModifier,
): { spd: number; acc: number; eva: number; ten: number; regenPct: number; damageType: 'physical'; armorType: 'light' | 'medium' | 'heavy' } {
	const tier = MOB_TIER_INDEX[mobType] ?? 0;
	return {
		spd: Math.floor(95 + [0, 7, 15][tier]! + lv * 0.3),
		acc: 0,
		eva: [0, 3, 5][tier]! + (gateModifier === 'evasive' ? 10 : 0),
		ten: [0, 15, 40][tier]!,
		regenPct: gateModifier === 'regen' ? 0.03 : 0,
		// Counter-matrix traits derived in code (no roster migration): tier maps to
		// armor weight, regulars harden from gate 3; mobs deal physical damage
		// by default. Live since DAMAGE_TYPE_MATRIX_ENABLED.
		damageType: 'physical' as const,
		armorType: armorForEncounter(mobType, lv),
	};
}

export class MonsterEncounterService {
	constructor(
		private readonly roster: Pick<MonsterRosterRepository, 'listForEncounter'> = new MonsterRosterRepository(),
	) {}

	/** Picks an encounter scaled to the gate tier level (player level only for the daily boss). */
	async pickForLevel(
		executor: Executor,
		level: number,
		rng: () => number,
		boss = false,
		finalBoss = false,
		gateModifier: GateModifier = 'none',
	): Promise<MonsterStats | null> {
		const rows = await this.roster.listForEncounter(executor, boss || finalBoss);
		if (!rows.length) return null;
		const type =
			boss || finalBoss
				? 'boss'
				: pick(
						[
							{ original: 'regular', weight: 80 },
							{ original: 'elite', weight: 20 },
						].filter((t) => rows.some((r) => r.mobType === t.original)),
						{ next: rng },
					);
		const pool = rows.filter((r) => r.mobType === type);
		if (!pool.length) return null;
		const row = choose(pool, rng);

		const lv = Math.max(1, level);
		if (boss && !finalBoss) {
			// Daily Bakunawa retains its separate entry fee and seeded balance.
			const sec = secondaryStats(lv, 'boss', gateModifier);
			return {
				name: row.name,
				hp: Math.round(row.baseHp + row.hpPerLevel * lv),
				atk: Math.round(row.baseAtk + row.atkPerLevel * lv),
				def: Math.round(row.baseDef + row.defPerLevel * lv),
				crit: row.baseCrit,
				...sec,
				mobType: row.mobType,
				skillKey: row.skillKey,
				immunityTags: Array.isArray(row.immunityTags) ? row.immunityTags : [],
				affixes: [],
			};
		}

		// Regular/elite: base curve theo level, roster chỉ giữ TỈ LỆ hình dạng.
		// Normalize roster shape within each tier before applying its stat multiplier.
		const shapeBase = type === 'elite' ? 1500 : 600;
		const shape = finalBoss ? 1 : row.baseHp / shapeBase;
		// Gate strength is fixed by its level, never by the player's equipment.
		// Steep early slope + low cap: low tiers stay demanding in starter
		// gear while endgame stays reachable for geared builds.
		const difficulty = 1 + Math.min(0.5, (lv - 1) * 0.08);
		const modifier = GATE_MODIFIER_BONUS[gateModifier] ?? GATE_MODIFIER_BONUS.none!;
		const bonus = tierBonus(finalBoss, type);
		const scale = {
			hp: REGULAR_SCALE.hp * bonus.hp * modifier.hp * difficulty,
			atk: REGULAR_SCALE.atk * bonus.atk * modifier.atk * difficulty,
			def: REGULAR_SCALE.def * bonus.def * modifier.def * difficulty,
		};
		return {
			name: row.name,
			hp: Math.round(AVG_CLASS_CURVE.hp(lv) * shape * scale.hp),
			atk: Math.round(AVG_CLASS_CURVE.atk(lv) * shape * scale.atk),
			def: Math.round(AVG_CLASS_CURVE.def(lv) * shape * scale.def),
			crit: row.baseCrit,
			...secondaryStats(lv, row.mobType, gateModifier),
			mobType: row.mobType,
			skillKey: row.skillKey,
			immunityTags: Array.isArray(row.immunityTags) ? row.immunityTags : [],
			// Regulars in modifier gates roll one affix; final bosses roll two.
			// Elites keep their signature skill; daily boss stays seeded-pure.
			affixes: rollEncounterAffixes(type, gateModifier, finalBoss, rng),
		};
	}
}

/** Affix budget per encounter kind (see comment at the call site). */
function rollEncounterAffixes(
	type: string,
	gateModifier: GateModifier,
	finalBoss: boolean,
	rng: () => number,
): string[] {
	if (type === 'regular' && gateModifier !== 'none') return rollAffixes(rng, 1);
	if (finalBoss) return rollAffixes(rng, 2);
	return [];
}
