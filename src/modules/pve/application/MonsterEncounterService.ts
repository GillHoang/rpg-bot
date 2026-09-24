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
	mobType: string;
	skillKey: string;
	immunityTags: string[];
}

/**
 * Mob scaling targets (viện toán nằm ở đây, seed chỉ là baseline hình dạng):
 * roster stats định TỈ LỆ tương đối giữa các mob (Pugot mỏng hơn Batibat...),
 * còn con số tuyệt đối bám curve class trung bình của người chơi cùng level —
 * nếu không, player scaling (atk +50~100/level) bỏ xa mob per-level (atk
 * +9~11/level) và mọi mob đều ra đòn như cỏ (bệnh "Pugot gây 6 HP").
 *
 *   mob = avg-class-curve(level) × hệ số loại:
 *     hp  × 3.2   (trận kéo 4-8 đòn mỗi bên thay vì 1-2 đòn one-shot)
 *     atk × 0.72  (sau mitigation còn ~55-70% → đe dọa thật nhưng không át player)
 *     def × 0.55
 *   Elite dày hơn ~45% và đánh đau hơn ~15% regular (hệ số nhân thêm).
 *   Gate difficulty adds 4% per monster level above 1, capped at 60%.
 *   Gate modifiers shift the monster's identity per gate (tanky/aggressive/...).
 *   Boss tier (tầng 10) uses this curve plus its own multipliers and boss skill.
 *   Daily Bakunawa keeps the seeded formula and its separate level-10 entry gate.
 */
const AVG_CLASS_CURVE = {
	hp: (lv: number) => 750 + 145 * (lv - 1),
	atk: (lv: number) => 275 + 100 * (lv - 1),
	def: (lv: number) => 165 + 61 * (lv - 1),
};

const REGULAR_SCALE = { hp: 3.2, atk: 0.72, def: 0.55 };
const ELITE_BONUS = { hp: 1.45, atk: 1.15, def: 1.0 };
/** Đặc điểm riêng từng Gate: nhân chỉ số quái để tạo bản sắc. */
const GATE_MODIFIER_BONUS: Record<GateModifier, { hp: number; atk: number; def: number }> = {
	none: { hp: 1, atk: 1, def: 1 },
	tanky: { hp: 1.1, atk: 0.95, def: 1.45 },
	aggressive: { hp: 0.9, atk: 1.35, def: 0.9 },
	regen: { hp: 1.35, atk: 0.95, def: 1.1 },
	evasive: { hp: 1.1, atk: 1.1, def: 1.25 },
};

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
			return {
				name: row.name,
				hp: Math.round(row.baseHp + row.hpPerLevel * lv),
				atk: Math.round(row.baseAtk + row.atkPerLevel * lv),
				def: Math.round(row.baseDef + row.defPerLevel * lv),
				crit: row.baseCrit,
				mobType: row.mobType,
				skillKey: row.skillKey,
				immunityTags: Array.isArray(row.immunityTags) ? row.immunityTags : [],
			};
		}

		// Regular/elite: base curve theo level, roster chỉ giữ TỈ LỆ hình dạng.
		// Normalize roster shape within each tier before applying its stat multiplier.
		const shape = finalBoss ? 1 : row.baseHp / (type === 'elite' ? 1500 : 600);
		// Gate strength is fixed by its level, never by the player's equipment.
		// Early gates remain farmable; later gates require equipment investment.
		const difficulty = 1 + Math.min(0.6, (lv - 1) * 0.04);
		const modifier = GATE_MODIFIER_BONUS[gateModifier] ?? GATE_MODIFIER_BONUS.none!;
		const bonus = finalBoss
			? { hp: 1.25, atk: 1.15, def: 1.2 }
			: type === 'elite'
				? ELITE_BONUS
				: { hp: 1, atk: 1, def: 1 };
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
			mobType: row.mobType,
			skillKey: row.skillKey,
			immunityTags: Array.isArray(row.immunityTags) ? row.immunityTags : [],
		};
	}
}
