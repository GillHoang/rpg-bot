import { pick } from '../utils/weightedRandom.js';
import { choose } from '../config/chestLoot.js';
import type { Executor } from '../db/client.js';
import { MonsterRosterRepository } from '../repositories/MonsterRosterRepository.js';

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
 *   Boss giữ công thức riêng đã seed (base 4000 + 180/lv) vì có gate level 10.
 */
const AVG_CLASS_CURVE = {
	hp: (lv: number) => 750 + 145 * (lv - 1),
	atk: (lv: number) => 275 + 100 * (lv - 1),
	def: (lv: number) => 165 + 61 * (lv - 1),
};

const REGULAR_SCALE = { hp: 3.2, atk: 0.72, def: 0.55 };
const ELITE_BONUS = { hp: 1.45, atk: 1.15, def: 1.0 };

export class MonsterEncounterService {
	constructor(
		private readonly roster: Pick<MonsterRosterRepository, 'listForEncounter'> = new MonsterRosterRepository(),
	) {}

	/** Picks a weighted regular/elite encounter, or Bakunawa, scaled to the player's level. */
	async pickForLevel(
		executor: Executor,
		level: number,
		rng: () => number,
		boss = false,
	): Promise<MonsterStats | null> {
		const rows = await this.roster.listForEncounter(executor, boss);
		if (!rows.length) return null;
		const type = boss
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
		if (boss) {
			// Boss: công thức seed gốc (đã cân với gate minLevel 10 + eclipse).
			return {
				name: row.name,
				hp: row.baseHp + row.hpPerLevel * lv,
				atk: row.baseAtk + row.atkPerLevel * lv,
				def: row.baseDef + row.defPerLevel * lv,
				crit: row.baseCrit,
				mobType: row.mobType,
				skillKey: row.skillKey,
				immunityTags: Array.isArray(row.immunityTags) ? row.immunityTags : [],
			};
		}

		// Regular/elite: base curve theo level, roster chỉ giữ TỈ LỆ hình dạng.
		// Pugot mỏng hơn Batibat... nhờ baseHp của từng mob so với mốc seed (600).
		const shape = row.baseHp / 600;
		const scale = type === 'elite' ? ELITE_BONUS : REGULAR_SCALE;
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
